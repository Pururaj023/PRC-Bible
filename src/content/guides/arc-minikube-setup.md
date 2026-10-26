---
title: ARC Setup on Minikube
summary: Run GitHub Actions Runner Controller on a local Minikube cluster with temporary runner pods.
category: rnd
icon: "🧪"
tag: Experiment
order: 1
meta:
  - { label: Cluster, value: Minikube }
  - { label: Controller, value: GitHub Actions Runner Controller }
  - { label: Repo, value: Pururaj023/archwiz }
  - { label: Runner set, value: arc-runner-set }
---

This README documents the steps to run **GitHub Actions Runner
Controller (ARC)** on a local **Minikube** Kubernetes cluster and use
temporary runner pods for the `Pururaj023/archwiz` repository.

> ℹ Run the commands in a Linux terminal with `kubectl`, `Helm`,
> `Minikube`, and Git installed. Replace the repository URL if you use a
> different repository.

## Step 1 — Verify prerequisites

```bash
minikube status
kubectl cluster-info
kubectl get nodes
helm version
kubectl version --client
```

If Minikube is not running, start it:

```bash
minikube start
```

## Step 2 — Create a namespace and install the ARC controller

```bash
helm upgrade --install arc \
  --namespace arc-systems \
  --create-namespace \
  oci://ghcr.io/actions/actions-runner-controller-charts/gha-runner-scale-set-controller \
  --wait \
  --timeout 5m
```

Check that the controller is ready:

```bash
kubectl get deployments -n arc-systems
kubectl get pods -n arc-systems
kubectl logs -n arc-systems deployment/arc-gha-rs-controller --all-containers --since=5m
```

## Step 3 — Create a GitHub Personal Access Token (PAT)

Create a PAT in GitHub for an account that has the required access to
the repository.

- For a **private repository**, a classic PAT generally needs the
    `repo` scope.
- For a fine-grained PAT, grant access to the repository and the
    required repository permissions for runner registration (including
    **Administration: Read and write**).
- Keep the token private. Do not commit it to Git or paste it into
    logs or chat.

Enter the token securely in your Linux terminal and create the
Kubernetes Secret with the key `github_token`:

```bash
read -rsp "Enter GitHub PAT: " GITHUB_PAT
echo

kubectl create namespace arc-runners --dry-run=client -o yaml | kubectl apply -f -

kubectl create secret generic arc-github-auth \
  --namespace arc-runners \
  --from-literal=github_token="$GITHUB_PAT" \
  --dry-run=client -o yaml | kubectl apply -f -

unset GITHUB_PAT
```

Confirm the Secret exists without displaying the token:

```bash
kubectl get secret arc-github-auth -n arc-runners
kubectl get secret arc-github-auth -n arc-runners \
  -o jsonpath='{.data.github_token}' | base64 -d | wc -c
```

The second command should return a non-zero byte count. **Never print or
share the decoded token.**

## Step 4 — Install the runner scale set

Use the repository URL **without** the `.git` suffix:

```bash
export GITHUB_CONFIG_URL="https://github.com/Pururaj023/archwiz"

helm upgrade --install arc-runner-set \
  --namespace arc-runners \
  --set-string githubConfigUrl="$GITHUB_CONFIG_URL" \
  --set-string githubConfigSecret=arc-github-auth \
  --set minRunners=0 \
  --set maxRunners=2 \
  oci://ghcr.io/actions/actions-runner-controller-charts/gha-runner-scale-set \
  --wait \
  --timeout 5m
```

`minRunners=0` allows the runner count to scale down to zero when no
workflow jobs need a runner. `maxRunners=2` caps this scale set at two
runners.

Check the scale set and its pods:

```bash
kubectl get autoscalingrunnersets -n arc-runners
kubectl get pods -n arc-runners
kubectl get events -n arc-runners --sort-by='.lastTimestamp'
```

The scale set can be ready while there are no runner pods; with
`minRunners=0`, that is expected when no job is queued.

## Step 5 — Add a test workflow to the repository

Create `.github/workflows/arc-test.yml` in the repository:

```yaml
name: ARC Runner Test

on:
  workflow_dispatch:

jobs:
  test:
    runs-on: arc-runner-set
    steps:
      - name: Verify ARC runner
        run: |
          echo "ARC runner is working!"
          hostname
          uname -a
```

Commit and push the file, then open **GitHub → Actions → ARC Runner Test
→ Run workflow**.

The value in `runs-on` must match the runner scale set name:
`arc-runner-set`.

## Step 6 — Watch the temporary runner pod

While the workflow is queued or running, use another terminal:

```bash
kubectl get pods -n arc-runners -w
```

To inspect runner resources:

```bash
kubectl get ephemeralrunners -n arc-runners
kubectl get ephemeralrunnersets -n arc-runners
kubectl describe pods -n arc-runners
```

After the workflow finishes, ARC should clean up the ephemeral runner
pod. With no queued jobs and `minRunners=0`, the runner count should
return to zero.

## Step 7 — Troubleshooting

### Runner scale set is pending or cannot get a registration token

Check the controller logs:

```bash
kubectl logs -n arc-systems deployment/arc-gha-rs-controller \
  --all-containers --since=10m
```

Verify the repository URL and secret key:

```bash
kubectl get autoscalingrunnersets -n arc-runners
kubectl get secret arc-github-auth -n arc-runners
kubectl get secret arc-github-auth -n arc-runners \
  -o jsonpath='{.data.github_token}' | base64 -d | wc -c
```

Use `https://github.com/OWNER/REPOSITORY` as the repository URL (without
`.git`). If GitHub returns `404`, check that the repository owner/name
is correct and the PAT account has sufficient access and permissions.

### Runner pod is stuck at `ContainerCreating`

Inspect pod events:

```bash
kubectl get pods -n arc-runners
kubectl describe pod <runner-pod-name> -n arc-runners
kubectl get events -n arc-runners --sort-by='.lastTimestamp'
```

Check whether Minikube can reach GitHub Container Registry:

```bash
minikube ssh -- "curl -I -m 10 https://ghcr.io/v2/"
```

An HTTP `401 Unauthorized` response from the registry endpoint can be
normal; it indicates the endpoint responded but requires registry
authentication. Look at the Kubernetes events for the actual image-pull
error, such as a timeout, rate limit, or insufficient disk space.

### Restart the controller only if needed

After correcting a configuration or Secret issue:

```bash
kubectl rollout restart deployment/arc-gha-rs-controller -n arc-systems
kubectl rollout status deployment/arc-gha-rs-controller -n arc-systems
```

## Step 8 — Useful status commands

```bash
kubectl get pods -n arc-systems
kubectl get pods -n arc-runners
kubectl get autoscalingrunnersets -n arc-runners
kubectl get ephemeralrunners -n arc-runners
kubectl get events -n arc-runners --sort-by='.lastTimestamp'
```

## Security notes

- Never commit the PAT or Kubernetes Secret YAML containing the token.
- Do not run commands that print the decoded PAT.
- Keep the PAT's permissions limited to what the runner setup
    requires.
- Rotate the PAT if it is exposed.
