---
title: Deployment Capacity Report
summary: Per-deployment table of HPA min/max, pods, requests, limits and live CPU/memory usage.
category: scripts
icon: "📦"
tag: Reporting
order: 1
meta:
  - { label: Script, value: deploymentcap.sh }
  - { label: Requires, value: "kubectl, jq, awk" }
  - { label: Mode, value: Read-only }
  - { label: Needs, value: Metrics Server }
---

Prints one row per deployment across every namespace: HPA min/max, current pod count, memory and CPU **requests and limits** (summed across containers), and the **aggregate live CPU and memory** across the deployment's pods.

## What it shows

- `MIN` / `MAX` come from the HPA that targets the deployment (KEDA-managed HPAs count too). With no HPA, MIN shows `1` and MAX shows `N/A`.
- `MEM-REQ`, `MEM-LIMIT`, `CPU-REQ`, `CPU-LIMIT` are totals across all containers in the pod template.
- `CPU-NOW` and `MEM-NOW` are summed from `kubectl top pods` for pods matching the deployment's selector; `N/A` means no metrics were returned.

## How to run

```bash
chmod +x deploymentcap.sh
./deploymentcap.sh
```

> ℹ It makes several `kubectl` calls per deployment, so on clusters with many deployments it takes a while to finish.

## Script

```bash
#!/bin/bash

printf "\n"
printf "%-20s %-32s %4s %4s %5s %10s %10s %8s %8s %10s %12s\n" \
"NAMESPACE" "DEPLOYMENT" "MIN" "MAX" "PODS" \
"MEM-REQ" "MEM-LIMIT" "CPU-REQ" "CPU-LIMIT" "CPU-NOW" "MEM-NOW"

printf '%s\n' "$(printf '=%.0s' {1..145})"

kubectl get deployments -A -o json |
jq -r '.items[] | [.metadata.namespace, .metadata.name] | @tsv' |
while IFS=$'\t' read -r NS DEPLOYMENT; do

  JSON=$(kubectl get deployment "$DEPLOYMENT" -n "$NS" -o json)

  REPLICAS=$(echo "$JSON" | jq -r '.spec.replicas // 1')

  SELECTOR=$(echo "$JSON" | jq -r '
    .spec.selector.matchLabels // {} |
    to_entries | map("\(.key)=\(.value)") | join(",")
  ')

  HPA=$(kubectl get hpa -n "$NS" -o json 2>/dev/null |
    jq -r --arg d "$DEPLOYMENT" '
      [.items[] | select(
        .spec.scaleTargetRef.kind == "Deployment" and
        .spec.scaleTargetRef.name == $d
      )][0] // {} |
      [(.spec.minReplicas // 1), (.spec.maxReplicas // "N/A")] | @tsv
    ')

  MIN=$(echo "$HPA" | cut -f1)
  MAX=$(echo "$HPA" | cut -f2)

  read -r MEM_REQ MEM_LIMIT CPU_REQ CPU_LIMIT < <(
    echo "$JSON" | jq -r '
      def mem:
        if . == null then 0
        elif test("Ki$") then (sub("Ki$";"")|tonumber)/1048576
        elif test("Mi$") then (sub("Mi$";"")|tonumber)/1024
        elif test("Gi$") then (sub("Gi$";"")|tonumber)
        elif test("Ti$") then (sub("Ti$";"")|tonumber)*1024
        else 0 end;
      def cpu:
        if . == null then 0
        elif test("m$") then (sub("m$";"")|tonumber)
        else (tonumber*1000) end;
      [.spec.template.spec.containers[].resources.requests.memory | mem] as $mr |
      [.spec.template.spec.containers[].resources.limits.memory | mem] as $ml |
      [.spec.template.spec.containers[].resources.requests.cpu | cpu] as $cr |
      [.spec.template.spec.containers[].resources.limits.cpu | cpu] as $cl |
      [
        ((($mr|add)*1024|round)|tostring)+"Mi",
        ((($ml|add)*1024|round)|tostring)+"Mi",
        ((($cr|add)|round)|tostring)+"m",
        ((($cl|add)|round)|tostring)+"m"
      ] | @tsv
    '
  )

  # Actual aggregate CPU and memory across deployment pods
  USAGE=$(kubectl top pods -n "$NS" -l "$SELECTOR" \
    --no-headers 2>/dev/null |
    awk '
      function cpu(v) {
        if (v ~ /m$/) {sub(/m$/, "", v); return v+0}
        return v*1000
      }
      function mem(v) {
        if (v ~ /Ki$/) {sub(/Ki$/, "", v); return v/1024}
        if (v ~ /Mi$/) {sub(/Mi$/, "", v); return v+0}
        if (v ~ /Gi$/) {sub(/Gi$/, "", v); return v*1024}
        if (v ~ /Ti$/) {sub(/Ti$/, "", v); return v*1048576}
        return 0
      }
      NF >= 3 {
        c += cpu($2)
        m += mem($3)
        n++
      }
      END {
        if (n == 0) print "N/A N/A"
        else printf "%.0fm %.0fMi\n", c, m
      }
    ')

  read -r CPU_NOW MEM_NOW <<< "$USAGE"

  printf "%-20s %-32s %4s %4s %5s %10s %10s %8s %8s %10s %12s\n" \
    "$NS" "$DEPLOYMENT" "$MIN" "$MAX" "$REPLICAS" \
    "$MEM_REQ" "$MEM_LIMIT" "$CPU_REQ" "$CPU_LIMIT" \
    "$CPU_NOW" "$MEM_NOW"

done

printf '%s\n' "$(printf '=%.0s' {1..145})"
printf "CPU-NOW and MEM-NOW represent aggregate usage across matching pods.\n"
printf "Memory: Mi = MiB; CPU: m = millicores.\n"
```
