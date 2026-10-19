---
title: Argo CD — Read-Only User
summary: Create a read-only account, wire up Azure AD OIDC/SSO, and lock it down with RBAC.
category: how-to
icon: "🔐"
tag: Access Control
order: 2
meta:
  - { label: Namespace, value: argocd }
  - { label: IdP, value: Azure AD (OIDC) }
  - { label: Server, value: argocdshopifydev.tjc.tv }
---

Adds a dedicated read-only account to Argo CD, wires the instance up to Azure AD via OIDC for SSO, and scopes access with RBAC so the account (and any SSO group) can only view — never modify.

## Step 1 — Inspect current config

```bash
kubectl get ns
kubectl get cm argocd-cm      -n argocd -o yaml
kubectl get cm argocd-rbac-cm -n argocd -o yaml
```

## Step 2 — Declare the account & configure OIDC

Under `argocd-cm`'s `data:`, declare the account:

```yaml
accounts.readonly: login
```

Create the OIDC client secret:

```bash
kubectl -n argocd patch secret argocd-secret \
  -p '{"stringData": {"oidc.azure.clientSecret": "<your-client-secret-value>"}}'
```

Then edit the ConfigMap with `kubectl edit cm argocd-cm -n argocd`:

```yaml
apiVersion: v1
data:
  admin.enabled: "true"
  url: https://argocdshopifydev.tjc.tv
  application.instanceLabelKey: argocd.argoproj.io/instance
  application.sync.impersonation.enabled: "false"
  exec.enabled: "false"
  oidc.config: |
    name: Azure
    issuer: https://login.microsoftonline.com/448203bd-eb06-47eb-916c-af6b29c0dcb8/v2.0
    clientID: d5ff4bff-bd3f-4e0a-98c0-306dc22f4596
    clientSecret: $oidc.azure.clientSecret
    requestedIDTokenClaims:
      groups:
        essential: true
    requestedScopes:
     - openid
     - profile
     - email
```

## Step 3 — Grant RBAC access

Under `argocd-rbac-cm`'s `data.policy.csv`, add:

```text
g, readonly, role:readonly
```

Full example after editing with `kubectl edit cm argocd-rbac-cm -n argocd`:

```yaml
apiVersion: v1
data:
  policy.csv: |
    p, role:sync-only, applications, get, */*, allow
    p, role:sync-only, applications, sync, */*, allow
    g, <sync-group-object-id>, role:sync-only
    g, <admins-group-object-id>, role:admin
    g, <readers-group-object-id>, role:readonly
  policy.default: ""
  policy.matchMode: glob
  scopes: '[groups]'
kind: ConfigMap
metadata:
  annotations:
    meta.helm.sh/release-name: argocd
    meta.helm.sh/release-namespace: argocd
  labels:
    app.kubernetes.io/component: server
    app.kubernetes.io/instance: argocd
    app.kubernetes.io/managed-by: Helm
    app.kubernetes.io/name: argocd-rbac-cm
    app.kubernetes.io/part-of: argocd
    app.kubernetes.io/version: v3.4.4
    helm.sh/chart: argo-cd-9.7.0
  name: argocd-rbac-cm
  namespace: argocd
```

Useful checks while wiring RBAC up:

```bash
# current RBAC
kubectl -n argocd get cm argocd-rbac-cm -o jsonpath='{.data.policy\.csv}'

# find User Info, an alternative check
kubectl -n argocd logs deploy/argocd-server | grep -i -E "rbac|claim|group" | tail -30
```

## Step 4 — Restart the server (if changes don't auto-apply)

```bash
kubectl rollout restart deployment argocd-server -n argocd
kubectl rollout status  deployment argocd-server -n argocd
```

## Step 5 — Verify the account exists

Expect to see both `admin` and `readonly` listed:

```bash
argocd account list
```

## Step 6 — Log in as admin, set the new user's password

```bash
argocd login <ARGOCD_SERVER>
argocd account update-password \
  --account readonly \
  --new-password '<strong-password>'
```

## Step 7 — Confirm as the read-only user

```bash
argocd login <ARGOCD_SERVER> \
  --username readonly \
  --password '<strong-password>'
```

> ✓ A successful login with no write access confirms the read-only account and SSO/RBAC wiring are working as expected.
