---
title: AKS Node Capacity Report
summary: Node CPU/memory capacity vs usage, pod counts, and where every pod is placed with its live usage.
category: scripts
icon: "🖥️"
tag: Reporting
order: 3
meta:
  - { label: Script, value: nodecapacity.sh }
  - { label: Requires, value: "kubectl, jq, awk" }
  - { label: Mode, value: Read-only }
  - { label: Needs, value: Metrics Server }
---

Generates a two-part report. The first table summarises each node's CPU and memory capacity, current usage, allocatable CPU, utilisation percentages, pods running now and the max pod count. The second lists every pod grouped by node with its **actual** CPU and memory usage.

## What it shows

- **Node resource summary** — CPU/memory capacity and usage from `kubectl top node`, plus `PODS NOW` vs `MAX PODS`.
- **Pod placement & usage** — node, namespace, pod name, CPU and memory usage (not requests or limits).
- `N/A` means metrics were unavailable for that node or pod; the script warns up front if Metrics Server isn't answering.

## How to run

```bash
chmod +x nodecapacity.sh
./nodecapacity.sh
```

> ℹ It runs one `kubectl get pods` per node to count pods, so allow some time on large clusters.

## Script

```bash
#!/bin/bash
set -o pipefail

# Requirements: kubectl, jq, awk
# Metrics Server must be available for kubectl top.

printf "\n"
printf '%s\n' "================================================================================================================================================================"
printf '%s\n' "                                                            AKS NODE CAPACITY REPORT"
printf '%s\n' "================================================================================================================================================================"
printf " Generated At : %s\n" "$(date)"
printf "\n"

# Verify cluster connectivity
if ! kubectl get nodes >/dev/null 2>&1; then
    echo "ERROR: Unable to connect to Kubernetes cluster."
    exit 1
fi

# Check metrics availability
if ! kubectl top nodes >/dev/null 2>&1; then
    echo "WARNING: Node metrics unavailable. Check Metrics Server."
    echo
fi

# -------------------------------------------------------------------
# NODE RESOURCE SUMMARY
# -------------------------------------------------------------------

printf '%s\n' "================================================================================================================================================================"
printf '%s\n' "                                                            NODE RESOURCE SUMMARY"
printf '%s\n' "================================================================================================================================================================"

printf "%-38s | %8s | %10s | %10s | %9s | %12s | %12s | %9s | %10s | %9s\n" \
    "NODE NAME" "CPU CAP" "CPU USED" "CPU ALLOC" "CPU %" \
    "MEM CAP" "MEM USED" "MEM %" "PODS NOW" "MAX PODS"

printf '%s\n' "$(printf '=%.0s' {1..165})"

kubectl get nodes -o json |
jq -r '
.items[] |
[
    .metadata.name,
    .status.capacity.cpu,
    .status.allocatable.cpu,
    .status.capacity.memory,
    .status.allocatable.memory,
    .status.capacity.pods
] | @tsv
' |
while IFS=$'\t' read -r NODE CPU_CAP CPU_ALLOC MEM_CAP MEM_ALLOC MAX_PODS; do

    METRICS=$(kubectl top node "$NODE" --no-headers 2>/dev/null)

    CPU_NOW=$(awk '{print $2}' <<< "$METRICS")
    CPU_PERCENT=$(awk '{print $3}' <<< "$METRICS")
    MEM_NOW=$(awk '{print $4}' <<< "$METRICS")
    MEM_PERCENT=$(awk '{print $5}' <<< "$METRICS")

    CPU_NOW=${CPU_NOW:-N/A}
    CPU_PERCENT=${CPU_PERCENT:-N/A}
    MEM_NOW=${MEM_NOW:-N/A}
    MEM_PERCENT=${MEM_PERCENT:-N/A}

    # Convert memory capacity to MiB
    MEM_CAP_FMT=$(awk -v v="$MEM_CAP" 'BEGIN {
        if (v ~ /Ki$/) {sub(/Ki$/,"",v); printf "%.0fMi",v/1024}
        else if (v ~ /Mi$/) {sub(/Mi$/,"",v); printf "%.0fMi",v}
        else if (v ~ /Gi$/) {sub(/Gi$/,"",v); printf "%.0fMi",v*1024}
        else if (v ~ /Ti$/) {sub(/Ti$/,"",v); printf "%.0fMi",v*1048576}
        else printf "%s",v
    }')

    # Count pods scheduled on the node
    PODS=$(kubectl get pods -A \
        --field-selector "spec.nodeName=$NODE" \
        --no-headers 2>/dev/null | wc -l | tr -d ' ')

    printf "%-38s | %8s | %10s | %10s | %9s | %12s | %12s | %9s | %9s | %9s\n" \
        "$NODE" "$CPU_CAP" "$CPU_NOW" "$CPU_ALLOC" "$CPU_PERCENT" \
        "$MEM_CAP_FMT" "$MEM_NOW" "$MEM_PERCENT" "$PODS" "$MAX_PODS"

done

printf "\n"

# -------------------------------------------------------------------
# POD PLACEMENT AND INDIVIDUAL RESOURCE USAGE
# -------------------------------------------------------------------

printf '%s\n' "================================================================================================================================================================"
printf '%s\n' "                                                      POD PLACEMENT & RESOURCE USAGE"
printf '%s\n' "================================================================================================================================================================"

printf "%-38s | %-22s | %-48s | %12s | %12s\n" \
    "NODE NAME" "NAMESPACE" "POD NAME" "CPU USAGE" "MEM USAGE"

printf '%s\n' "$(printf '=%.0s' {1..145})"

# Fetch pod metrics once and index them by namespace/name.
declare -A POD_CPU POD_MEM

while read -r NS POD CPU MEM; do
    [[ -z "$NS" || -z "$POD" ]] && continue
    POD_CPU["$NS/$POD"]="$CPU"
    POD_MEM["$NS/$POD"]="$MEM"
done < <(
    kubectl top pods -A --containers=false --no-headers 2>/dev/null |
    awk 'NF >= 4 {print $1, $2, $3, $4}'
)

kubectl get pods -A -o json |
jq -r '
.items[]
| select(.spec.nodeName != null)
| [
    .spec.nodeName,
    .metadata.namespace,
    .metadata.name
] | @tsv
' |
sort -k1,1 -k2,2 -k3,3 |
while IFS=$'\t' read -r NODE NS POD; do

    KEY="$NS/$POD"
    CPU="${POD_CPU[$KEY]:-N/A}"
    MEM="${POD_MEM[$KEY]:-N/A}"

    printf "%-38s | %-22s | %-48s | %12s | %12s\n" \
        "$NODE" "$NS" "$POD" "$CPU" "$MEM"

done

printf "\n"
printf '%s\n' "================================================================================================================================================================"
printf '%s\n' "                                                            REPORT COMPLETED"
printf '%s\n' "================================================================================================================================================================"
printf "\n"
printf '%s\n' "NOTES:"
printf '%s\n' "  1. CPU CAP = total node CPU cores; CPU ALLOC = allocatable CPU in millicores."
printf '%s\n' "  2. CPU USED and MEM USED are current node usage from Metrics Server."
printf '%s\n' "  3. CPU % and MEM % are the utilization percentages reported by kubectl top."
printf '%s\n' "  4. MEM CAP is total node memory in MiB; MEM USED is current usage in MiB."
printf '%s\n' "  5. PODS NOW counts pods assigned to the node; MAX PODS is the configured pod capacity."
printf '%s\n' "  6. Pod-level CPU and memory values are actual usage, not resource requests or limits."
printf '%s\n' "  7. N/A means metrics were unavailable."
printf "\n"
```
