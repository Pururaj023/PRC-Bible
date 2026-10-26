---
title: Argo CD Upgrade & Backup
summary: Back up the Helm config and RBAC to a file first, then upgrade Argo CD to chart 10.9.5.
category: how-to
icon: "🔄"
tag: Upgrade
order: 6
meta:
  - { label: Namespace, value: argocd }
  - { label: Release, value: argocd }
  - { label: Chart version, value: 10.9.5 }
  - { label: Backup file, value: argocd-values-backup.yaml }
---

Before upgrading, save the values the release is currently running with — config and RBAC included — to a file, then upgrade the chart. If the upgrade goes wrong, that file is your way back.

## Step 1 — Back up the current config and RBAC

Export the values the `argocd` release is using into a file:

```bash
helm -n argocd get values argocd -o yaml > argocd-values-backup.yaml
```

> ⚠ The backup holds your group object IDs and URLs, so keep it somewhere private and don't commit it to Git.

> ℹ Extra, not part of the original steps: `helm get values` only captures what was passed to Helm. If `argocd-cm` or `argocd-rbac-cm` were ever edited directly with `kubectl edit` (as in the read-only user guide), an upgrade can overwrite those edits. To keep a copy of the live ConfigMaps too: `kubectl -n argocd get cm argocd-cm argocd-rbac-cm -o yaml > argocd-cm-rbac-backup.yaml`

## Step 2 — Prepare the upgrade values

Create `argocd-values-upgrade.yaml` with the config and RBAC you want after the upgrade:

```yaml
configs:
  params:
    server.insecure: true

  cm:
    admin.enabled: "false"
    url: https://tjciwargocdsfystag.idealworld.tv

  rbac:
    policy.csv: |
      p, role:sync-only, applications, get, */*, allow
      p, role:sync-only, applications, sync, */*, allow
      g, a5232624-fd05-48bf-9ad4-dc0fac69b8a9, role:sync-only
      g, 46acb860-f190-4371-baac-a17a820bb48a, role:admin
      g, a5232624-fd05-48bf-9ad4-dc0fac69b8a9, role:readonly
```

- `server.insecure: true` — the server serves plain HTTP behind the ingress
- `admin.enabled: "false"` — turns the local admin account off, so sign-in goes through SSO
- `policy.csv` — `sync-only` can view and sync applications, and the listed group IDs map to `sync-only`, `admin` and `readonly`

## Step 3 — Upgrade Argo CD

```bash
helm upgrade argocd argo/argo-cd \
  -n argocd \
  --version 10.9.5 \
  -f argocd-values-backup.yaml
```

> ℹ As written, this applies the values from the backup file. `argocd-values-upgrade.yaml` isn't passed, so to roll out the new values as well, add `-f argocd-values-upgrade.yaml` after the backup file — later files override earlier ones.

> ℹ If Helm can't find version `10.9.5`, refresh the repo first with `helm repo update`.
