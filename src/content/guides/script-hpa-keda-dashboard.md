---
title: HPA & KEDA Status Dashboard
summary: Colour-coded dashboard of deployment health, HPAs, KEDA ScaledObjects and scaling coverage.
category: scripts
icon: "📈"
tag: Reporting
order: 2
meta:
  - { label: Script, value: Hpa.sh }
  - { label: Requires, value: "kubectl, jq" }
  - { label: Mode, value: Read-only }
  - { label: Scope, value: All namespaces or one }
---

A read-only dashboard for scaling health on the cluster. It fetches deployments, HPAs, KEDA ScaledObjects and ScaledJobs once each, then prints five sections with colour-coded status (green healthy, yellow warning, red unhealthy).

## What it shows

- **Deployment health** — desired vs ready replicas.
- **HPA status** — min/max, current and desired replicas, live metrics, and the reason when an HPA is limited or unhealthy.
- **KEDA ScaledObjects** — target, min/max, Ready / Active / Fallback state and trigger types, with conditions printed for anything unhealthy.
- **Scaling coverage** — whether each deployment is scaled by HPA, KEDA, both or neither.
- **ScaledJobs** — shown only when any exist.

## How to run

```bash
chmod +x Hpa.sh

# all namespaces (default)
./Hpa.sh

# a single namespace
./Hpa.sh custom
```

> ℹ `Active = NO` on a ScaledObject is not necessarily an error — it can simply mean no trigger is currently firing. HPA and KEDA overlap is expected because KEDA creates and manages an HPA per ScaledObject.

## Script

```bash
#!/usr/bin/env bash
 
set -uo pipefail
 
# AKS KEDA + HPA status dashboard
# Read-only: queries Kubernetes API only.
 
for cmd in kubectl jq; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
        echo "ERROR: Required command '$cmd' is not installed."
        exit 1
    fi
done
 
if ! kubectl cluster-info >/dev/null 2>&1; then
    echo "ERROR: Cannot access Kubernetes cluster. Check your AKS context."
    exit 1
fi
 
# Terminal colors
if [[ -t 1 ]]; then
    GREEN=$'\033[32m'
    RED=$'\033[31m'
    YELLOW=$'\033[33m'
    CYAN=$'\033[36m'
    BLUE=$'\033[34m'
    BOLD=$'\033[1m'
    RESET=$'\033[0m'
else
    GREEN='' RED='' YELLOW='' CYAN='' BLUE='' BOLD='' RESET=''
fi
 
hr() {
    printf '%s\n' "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}
 
section() {
    printf "\n${BOLD}${CYAN}%s${RESET}\n" "$1"
    hr
}
 
status_color() {
    case "$1" in
        HEALTHY|READY|ACTIVE|OK) printf '%s' "$GREEN" ;;
        WARNING|INACTIVE|UNKNOWN) printf '%s' "$YELLOW" ;;
        ERROR|NOT_READY|FAILED) printf '%s' "$RED" ;;
        *) printf '%s' "$RESET" ;;
    esac
}
 
CTX=$(kubectl config current-context 2>/dev/null || echo "unknown")
NAMESPACE_FILTER="${1:-all}"
 
if [[ "$NAMESPACE_FILTER" == "all" ]]; then
    NS_ARGS=(-A)
    NS_LABEL="ALL NAMESPACES"
else
    NS_ARGS=(-n "$NAMESPACE_FILTER")
    NS_LABEL="$NAMESPACE_FILTER"
fi
 
echo
printf "${BOLD}${BLUE}                 AKS SCALING STATUS DASHBOARD${RESET}\n"
hr
printf " Context     : %s\n" "$CTX"
printf " Scope       : %s\n" "$NS_LABEL"
printf " Timestamp   : %s\n" "$(date '+%Y-%m-%d %H:%M:%S %Z')"
hr
 
# Fetch cluster objects once per resource type.
if ! DEPLOYMENTS=$(kubectl get deployments "${NS_ARGS[@]}" -o json 2>/dev/null); then
    echo "ERROR: Failed to retrieve deployments."
    exit 1
fi
 
if ! HPAS=$(kubectl get hpa "${NS_ARGS[@]}" -o json 2>/dev/null); then
    echo "WARNING: Unable to retrieve HPAs; check RBAC permissions."
    HPAS='{"items":[]}'
fi
 
if ! SCALEDOBJECTS=$(kubectl get scaledobjects.keda.sh "${NS_ARGS[@]}" -o json 2>/dev/null); then
    echo "WARNING: Unable to retrieve KEDA ScaledObjects; check CRD/RBAC."
    SCALEDOBJECTS='{"items":[]}'
fi
 
if ! SCALEDJOBS=$(kubectl get scaledjobs.keda.sh "${NS_ARGS[@]}" -o json 2>/dev/null); then
    SCALEDJOBS='{"items":[]}'
fi
 
DEPLOYMENT_COUNT=$(jq '.items | length' <<< "$DEPLOYMENTS")
HPA_COUNT=$(jq '.items | length' <<< "$HPAS")
KEDA_COUNT=$(jq '.items | length' <<< "$SCALEDOBJECTS")
JOB_COUNT=$(jq '.items | length' <<< "$SCALEDJOBS")
 
printf "\n Deployments: %s | HPAs: %s | KEDA ScaledObjects: %s | ScaledJobs: %s\n" \
    "$DEPLOYMENT_COUNT" "$HPA_COUNT" "$KEDA_COUNT" "$JOB_COUNT"
 
# -------------------------------------------------------------------
# Deployment health
# -------------------------------------------------------------------
section "1. DEPLOYMENT HEALTH"
 
printf "%-32s %-28s %8s %8s %8s %10s\n" \
    "NAMESPACE" "DEPLOYMENT" "DESIRED" "READY" "UP-TO-DATE" "STATUS"
 
while IFS=$'\t' read -r ns name desired ready updated; do
    [[ -z "$name" ]] && continue
 
    status="HEALTHY"
    [[ "$ready" != "$desired" ]] && status="NOT_READY"
 
    color=$(status_color "$status")
    printf "%-32.32s %-28.28s %8s %8s %8s " \
        "$ns" "$name" "$desired" "$ready" "$updated"
    printf "%s%-10s%s\n" "$color" "$status" "$RESET"
done < <(
    jq -r '
      .items[] |
      [
        .metadata.namespace,
        .metadata.name,
        (.spec.replicas // 1 | tostring),
        (.status.readyReplicas // 0 | tostring),
        (.status.updatedReplicas // 0 | tostring)
      ] | @tsv
    ' <<< "$DEPLOYMENTS"
)
 
# -------------------------------------------------------------------
# HPA status
# -------------------------------------------------------------------
section "2. HPA STATUS"
 
printf "%-26s %-28s %-22s %5s %5s %5s %-16s %-10s\n" \
    "NAMESPACE" "HPA" "TARGET" "MIN" "MAX" "NOW" "DESIRED / METRICS" "STATUS"
 
while IFS= read -r item; do
    ns=$(jq -r '.metadata.namespace' <<< "$item")
    name=$(jq -r '.metadata.name' <<< "$item")
    target=$(jq -r '.spec.scaleTargetRef.name // "?"' <<< "$item")
    min=$(jq -r '(.spec.minReplicas // 1) | tostring' <<< "$item")
    max=$(jq -r '(.spec.maxReplicas // 1) | tostring' <<< "$item")
    current=$(jq -r '(.status.currentReplicas // 0) | tostring' <<< "$item")
    desired=$(jq -r '(.status.desiredReplicas // 0) | tostring' <<< "$item")
 
    metrics=$(jq -r '
      [.status.currentMetrics[]? |
        if .resource then
          (.resource.name + ":" +
           (.resource.current.averageUtilization // "n/a" | tostring) + "%")
        elif .pods then
          (.pods.metric.name + ":" +
           (.pods.current.averageValue // "n/a" | tostring))
        elif .external then
          (.external.metric.name + ":" +
           (.external.current.averageValue // "n/a" | tostring))
        else "other"
        end
      ] | if length == 0 then "n/a" else join(",") end
    ' <<< "$item")
 
    able=$(jq -r '[.status.conditions[]? |
      select(.type=="AbleToScale" and .status=="True")] | length' <<< "$item")
    active=$(jq -r '[.status.conditions[]? |
      select(.type=="ScalingActive" and .status=="True")] | length' <<< "$item")
    limited=$(jq -r '[.status.conditions[]? |
      select(.type=="ScalingLimited" and .status=="True")] | length' <<< "$item")
 
    status="HEALTHY"
    [[ "$able" != "1" || "$active" != "1" ]] && status="WARNING"
    [[ "$limited" == "1" ]] && status="WARNING"
 
    color=$(status_color "$status")
    printf "%-26.26s %-28.28s %-22.22s %5s %5s %5s %-16.16s " \
        "$ns" "$name" "$target" "$min" "$max" "$current" \
        "$desired / $metrics"
    printf "%s%-10s%s\n" "$color" "$status" "$RESET"
 
    # Show why an HPA is unhealthy or limited.
    if [[ "$status" != "HEALTHY" ]]; then
        jq -r '.status.conditions[]? |
          select(.status != "True" or .type == "ScalingLimited") |
          "    \(.type): \(.status) - \(.reason // "") \(.message // "")"
        ' <<< "$item"
    fi
done < <(jq -c '.items[]' <<< "$HPAS")
 
if [[ "$HPA_COUNT" -eq 0 ]]; then
    echo "No HPAs found in the selected scope."
fi
 
# -------------------------------------------------------------------
# KEDA ScaledObjects
# -------------------------------------------------------------------
section "3. KEDA SCALEDOBJECT STATUS"
 
printf "%-24s %-28s %-24s %5s %5s %-10s %-10s %-10s %-18s\n" \
    "NAMESPACE" "SCALEDOBJECT" "TARGET DEPLOYMENT" \
    "MIN" "MAX" "READY" "ACTIVE" "FALLBACK" "TRIGGERS"
 
while IFS= read -r item; do
    ns=$(jq -r '.metadata.namespace' <<< "$item")
    name=$(jq -r '.metadata.name' <<< "$item")
    target=$(jq -r '.spec.scaleTargetRef.name // "?"' <<< "$item")
    min=$(jq -r '(.spec.minReplicaCount // 0) | tostring' <<< "$item")
    max=$(jq -r '(.spec.maxReplicaCount // 100) | tostring' <<< "$item")
 
    ready=$(jq -r '
      [.status.conditions[]? |
       select(.type=="Ready" and .status=="True")] | length
    ' <<< "$item")
    active=$(jq -r '
      [.status.conditions[]? |
       select(.type=="Active" and .status=="True")] | length
    ' <<< "$item")
    fallback=$(jq -r '
      [.status.conditions[]? |
       select(.type=="Fallback" and .status=="True")] | length
    ' <<< "$item")
 
    triggers=$(jq -r '[.spec.triggers[]?.type] |
      if length == 0 then "none" else join(",") end' <<< "$item")
 
    ready_text="NO"
    active_text="NO"
    fallback_text="NO"
    [[ "$ready" == "1" ]] && ready_text="YES"
    [[ "$active" == "1" ]] && active_text="YES"
    [[ "$fallback" == "1" ]] && fallback_text="YES"
 
    status="HEALTHY"
    [[ "$ready" != "1" ]] && status="NOT_READY"
    [[ "$fallback" == "1" ]] && status="WARNING"
 
    color=$(status_color "$status")
    printf "%-24.24s %-28.28s %-24.24s %5s %5s %-10s %-10s %-10s %-18.18s\n" \
        "$ns" "$name" "$target" "$min" "$max" \
        "$ready_text" "$active_text" "$fallback_text" "$triggers"
 
    if [[ "$status" != "HEALTHY" ]]; then
        jq -r '.status.conditions[]? |
          select(.type=="Ready" or .type=="Fallback") |
          "    \(.type): \(.status) - \(.reason // "") \(.message // "")"
        ' <<< "$item"
    fi
done < <(jq -c '.items[]' <<< "$SCALEDOBJECTS")
 
if [[ "$KEDA_COUNT" -eq 0 ]]; then
    echo "No KEDA ScaledObjects found in the selected scope."
fi
 
# -------------------------------------------------------------------
# Deployment scaling coverage
# -------------------------------------------------------------------
section "4. DEPLOYMENT SCALING COVERAGE"
 
printf "%-32s %-28s %-12s %-12s\n" \
    "NAMESPACE" "DEPLOYMENT" "HPA" "KEDA"
 
while IFS=$'\t' read -r ns name; do
    [[ -z "$name" ]] && continue
 
    hpa=$(jq -r --arg ns "$ns" --arg name "$name" '
      [.items[] |
       select(.metadata.namespace==$ns and
              .spec.scaleTargetRef.kind=="Deployment" and
              .spec.scaleTargetRef.name==$name)] | length
    ' <<< "$HPAS")
 
    keda=$(jq -r --arg ns "$ns" --arg name "$name" '
      [.items[] |
       select(.metadata.namespace==$ns and
              (.spec.scaleTargetRef.kind // "Deployment")=="Deployment" and
              .spec.scaleTargetRef.name==$name)] | length
    ' <<< "$SCALEDOBJECTS")
 
    if [[ "$hpa" -gt 0 && "$keda" -gt 0 ]]; then
        coverage="BOTH"
        color="$YELLOW"
    elif [[ "$keda" -gt 0 ]]; then
        coverage="KEDA"
        color="$GREEN"
    elif [[ "$hpa" -gt 0 ]]; then
        coverage="HPA"
        color="$GREEN"
    else
        coverage="NONE"
        color="$YELLOW"
    fi
 
    printf "%-32.32s %-28.28s %-12s " "$ns" "$name" "$hpa"
    printf "%s%-12s%s\n" "$color" "$coverage" "$RESET"
done < <(
    jq -r '.items[] | [.metadata.namespace,.metadata.name] | @tsv' \
<<< "$DEPLOYMENTS"
)
 
# -------------------------------------------------------------------
# ScaledJobs
# -------------------------------------------------------------------
if [[ "$JOB_COUNT" -gt 0 ]]; then
    section "5. KEDA SCALEDJOBS"
    printf "%-28s %-30s %-10s %-10s\n" "NAMESPACE" "SCALEDJOB" "READY" "ACTIVE"
 
    while IFS= read -r item; do
        jq -r '[
          .metadata.namespace,
          .metadata.name,
          ([.status.conditions[]? |
            select(.type=="Ready" and .status=="True")] | length | tostring),
          ([.status.conditions[]? |
            select(.type=="Active" and .status=="True")] | length | tostring)
        ] | @tsv' <<< "$item" |
        while IFS=$'\t' read -r ns name ready active; do
            printf "%-28.28s %-30.30s %-10s %-10s\n" \
                "$ns" "$name" "$ready" "$active"
        done
    done < <(jq -c '.items[]' <<< "$SCALEDJOBS")
fi
 
hr
printf "${BOLD}Legend:${RESET} "
printf "${GREEN}Green = healthy${RESET} | "
printf "${YELLOW}Yellow = warning / needs review${RESET} | "
printf "${RED}Red = unhealthy${RESET}\n"
echo "Note: KEDA Active=NO is not necessarily an error; it can mean no scaling trigger is currently active."
echo "Note: HPA and KEDA coverage may overlap intentionally because KEDA manages HPAs for ScaledObjects."
echo
```
