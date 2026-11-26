---
title: Argo CD Notifications to Microsoft Teams
summary: Send Argo CD sync and health alerts to Teams as Adaptive Cards, with triggers, templates and ApplicationSet subscriptions.
category: how-to
icon: "🔔"
tag: Notifications
order: 7
meta:
  - { label: Namespace, value: argocd }
  - { label: Service, value: teams-workflows }
  - { label: ConfigMap, value: argocd-notifications-cm }
  - { label: Argo CD, value: v3.6.2 }
---

Step-by-step setup guide for sending Argo CD application notifications
to Microsoft Teams using Adaptive Cards.

## Environment

| Item | Value |
| --- | --- |
| Namespace | `argocd` |
| Notifications ConfigMap | `argocd-notifications-cm` |
| Notifications Secret | `argocd-notifications-secret` |
| Teams service | `teams-workflows` |
| Recipient | `devops-alerts` |
| Argo CD URL | `https://amsnextgenargo-lower.tjc.tv` |

> ⚠ Keep the Teams Workflow webhook URL private. Do not commit it to Git
> or paste it into logs.

## Step 1 — Check existing resources

```bash
kubectl get configmap argocd-notifications-cm -n argocd
kubectl get secret argocd-notifications-secret -n argocd
kubectl get deployment argocd-notifications-controller -n argocd
```

## Step 2 — Add the Teams Workflow webhook to the Secret

Encode the webhook URL:

```bash
echo -n 'YOUR_TEAMS_WORKFLOW_URL' | base64 -w 0
```

Edit the existing Secret:

```bash
kubectl edit secret argocd-notifications-secret -n argocd
```

Add the encoded value under `data`:

```yaml
data:
  channel-workflows-url: BASE64_ENCODED_WEBHOOK_URL
```

If the Secret already contains other keys, preserve them. Do not replace
the whole Secret.

## Step 3 — Configure the Teams service

Edit the Notifications ConfigMap:

```bash
kubectl edit configmap argocd-notifications-cm -n argocd
```

Add or update this service configuration under `data`:

```yaml
service.teams-workflows: |
  recipientUrls:
    devops-alerts: $channel-workflows-url
```

The recipient name `devops-alerts` must match the recipient used in the
Application subscription annotations.

## Step 4 — Add notification templates

Add the following template keys under `data` in the same ConfigMap.
Insert the complete Adaptive Card JSON under each `adaptiveCard` field.
Use the same card layout and application details consistently across
templates.

```yaml
template.app-sync-succeeded-advanced: |
  teams-workflows:
    adaptiveCard: |
      PASTE_SYNC_SUCCEEDED_ADAPTIVE_CARD_JSON_HERE

template.app-sync-failed: |
  teams-workflows:
    adaptiveCard: |
      PASTE_SYNC_FAILED_ADAPTIVE_CARD_JSON_HERE

template.app-health-degraded: |
  teams-workflows:
    adaptiveCard: |
      PASTE_HEALTH_DEGRADED_ADAPTIVE_CARD_JSON_HERE

template.app-sync-unknown: |
  teams-workflows:
    adaptiveCard: |
      PASTE_SYNC_UNKNOWN_ADAPTIVE_CARD_JSON_HERE

template.app-health-unknown: |
  teams-workflows:
    adaptiveCard: |
      PASTE_HEALTH_UNKNOWN_ADAPTIVE_CARD_JSON_HERE
```

Use these template names exactly; the trigger configuration in the next
step references them.

For this ApplicationSet's multi-source Applications, the repository
expression for the first source is:

```text
{{(index .app.spec.sources 0).repoURL}}
```

Common fields used in the cards:

- Application: `{{.app.metadata.name}}`
- Namespace: `{{.app.metadata.namespace}}`
- Destination cluster: `{{.app.spec.destination.server}}`
- Repository (first source): `{{(index .app.spec.sources 0).repoURL}}`
- Sync phase: `{{.app.status.operationState.phase}}`
- Sync completion time: `{{.app.status.operationState.finishedAt}}`
- Sync operation message: `{{.app.status.operationState.message}}`
- Health status: `{{.app.status.health.status}}`

> ℹ `finishedAt` is the sync operation completion time. It may be
> empty or represent an earlier sync for health-only notifications.
> Application health status does not guarantee a populated
> `health.message`; use a fixed explanatory message or omit that field if
> it is unavailable.

## Step 5 — Configure notification triggers

Add these trigger definitions under `data` in `argocd-notifications-cm`:

```yaml
trigger.on-sync-succeeded: |
  - when: app.status.operationState.phase == 'Succeeded'
    send: [app-sync-succeeded-advanced]

trigger.on-sync-failed: |
  - when: app.status.operationState.phase in ['Failed', 'Error']
    send: [app-sync-failed]

trigger.on-health-degraded: |
  - when: app.status.health.status == 'Degraded'
    send: [app-health-degraded]

trigger.on-sync-status-unknown: |
  - when: app.status.sync.status == 'Unknown'
    send: [app-sync-unknown]

trigger.on-health-unknown: |
  - when: app.status.health.status == 'Unknown'
    send: [app-health-unknown]
```

Ensure each trigger's `send` template name matches a template key
exactly.

## Step 6 — Subscribe generated Applications through the ApplicationSet

Edit the ApplicationSet:

```bash
kubectl edit applicationset <APPLICATIONSET_NAME> -n argocd
```

Add the annotations under `spec.template.metadata.annotations` (not the
ApplicationSet's top-level `metadata.annotations`):

```yaml
spec:
  template:
    metadata:
      annotations:
        notifications.argoproj.io/subscribe.on-sync-succeeded.teams-workflows: devops-alerts
        notifications.argoproj.io/subscribe.on-sync-failed.teams-workflows: devops-alerts
        notifications.argoproj.io/subscribe.on-health-degraded.teams-workflows: devops-alerts
        notifications.argoproj.io/subscribe.on-sync-status-unknown.teams-workflows: devops-alerts
        notifications.argoproj.io/subscribe.on-health-unknown.teams-workflows: devops-alerts
```

Preserve existing ApplicationSet fields and annotations. After the
ApplicationSet reconciles, the annotations should appear on its
generated Applications.

## Step 7 — Validate generated Application annotations

```bash
kubectl get applications -n argocd
kubectl get application <APP_NAME> -n argocd -o yaml
```

Check the generated Application's `metadata.annotations` for all
expected subscriptions.

## Step 8 — Restart and verify the Notifications controller

After updating the ConfigMap and Secret:

```bash
kubectl rollout restart deployment argocd-notifications-controller -n argocd
kubectl rollout status deployment argocd-notifications-controller -n argocd
```

Check the resources and configuration:

```bash
kubectl get configmap argocd-notifications-cm -n argocd -o yaml
kubectl get secret argocd-notifications-secret -n argocd
kubectl get deployment argocd-notifications-controller -n argocd
```

Avoid printing Secret values in shared terminals, screenshots, or logs.

## Step 9 — Monitor controller logs

```bash
kubectl logs deployment/argocd-notifications-controller -n argocd --tail=100 -f
```

Look for successful notification delivery and investigate errors such
as:

- Template not supported / template not found: check that trigger
    `send` names exactly match `template.<name>` keys.
- Recipient or service errors: verify `teams-workflows`,
    `devops-alerts`, and the Secret key reference.
- Webhook delivery errors: verify the Workflow URL and that the Teams
    Workflow is enabled.

## Step 10 — Test notifications

1. Trigger a successful sync on a safe test Application.
2. Test a failed sync using a controlled test change.
3. Test degraded and unknown states only on a non-production test
    Application where possible.
4. Confirm the Adaptive Card layout, status, namespace, cluster,
    repository, timestamp, message, and **View in Argo CD** link in
    Teams.

## Production considerations

- Review trigger behavior and configure deduplication (`oncePer`)
    where appropriate to avoid repeated notifications during
    reconciliation. Validate the chosen key and behavior against the
    installed Argo CD Notifications version.
- Do not deliberately break production applications to test failure
    alerts.
- Use a trusted, stable HTTPS-hosted image URL for the card image.
    Teams must be able to retrieve it.
- Keep the webhook URL in the Kubernetes Secret; do not place it in
    the ConfigMap, source control, or README.
- Back up the existing ConfigMap, Secret metadata, and ApplicationSet
    before making changes. Protect backups because they may contain
    sensitive configuration.

## Quick command reference

```bash
# Inspect notification resources
kubectl get cm argocd-notifications-cm -n argocd
kubectl get secret argocd-notifications-secret -n argocd

# Edit notification configuration
kubectl edit cm argocd-notifications-cm -n argocd
kubectl edit secret argocd-notifications-secret -n argocd

# Edit the ApplicationSet
kubectl edit applicationset <APPLICATIONSET_NAME> -n argocd

# Restart and verify controller
kubectl rollout restart deployment argocd-notifications-controller -n argocd
kubectl rollout status deployment argocd-notifications-controller -n argocd

# Follow controller logs
kubectl logs deployment/argocd-notifications-controller -n argocd --tail=100 -f

# Verify a generated Application's annotations
kubectl get application <APP_NAME> -n argocd -o yaml
```

## Heads-up: differences from the live ConfigMap

The working ConfigMap exported below differs from the steps above in a few places. Worth checking before you rely on either:

- **Recipient name.** The steps use `devops-alerts`, but the live `service.teams-workflows` defines `devopsAlerts`. The value in each Application's subscription annotation must match the recipient key exactly.
- **Sync-succeeded template.** The steps send `app-sync-succeeded-advanced`; the live ConfigMap defines and sends `app-sync-succeeded`.
- **Sync-failed template.** The live ConfigMap has `trigger.on-sync-failed` sending `app-sync-failed`, but no `template.app-sync-failed` key is defined in the export. Until it is added, failed-sync alerts will log a template-not-found error instead of reaching Teams.
- **Card images.** The example cards load images from third-party links. As noted above, use a trusted, stable HTTPS-hosted image that Teams can always retrieve, ideally one you host yourself.

## Reference: the working ConfigMap

The live `argocd-notifications-cm` (Argo CD v3.6.2, chart argo-cd-10.18.2), with runtime metadata removed. The `app-sync-succeeded` template is re-indented as a block so it is readable; its content is unchanged. Use it as the source for the Adaptive Card JSON that the templates above ask you to paste.

```yaml
apiVersion: v1
data:
  context: |
    argocdUrl: https://amsnextgenargo-lower.tjc.tv
  service.teams-workflows: |
    recipientUrls:
      devopsAlerts: $channel-workflows-url
  template.app-health-degraded: |
    teams-workflows:
      adaptiveCard: |
        {
          "type": "AdaptiveCard",
          "version": "1.4",
          "body": [
            {
              "type": "ColumnSet",
              "columns": [
                {
                  "type": "Column",
                  "width": "auto",
                  "items": [
                    {
                      "type": "Image",
                      "url": "https://www.seekpng.com/png/detail/8-89018_you-can-use-all-these-vectors-or-pngs.png",
                      "size": "Medium"
                    }
                  ]
                },
                {
                  "type": "Column",
                  "width": "stretch",
                  "items": [
                    {
                      "type": "TextBlock",
                      "text": "Application {{.app.metadata.name}}",
                      "weight": "Bolder",
                      "size": "Large",
                      "wrap": true
                    },
                    {
                      "type": "TextBlock",
                      "text": "Health Degraded!",
                      "color": "Attention",
                      "weight": "Bolder"
                    }
                  ]
                }
              ]
            },
            {
              "type": "FactSet",
              "facts": [
                {"title": "Status", "value": "{{.app.status.health.status}}"},
                {"title": "Namespace", "value": "{{.app.metadata.namespace}}"},
                {"title": "Cluster", "value": "{{.app.spec.destination.server}}"},
                {"title": "Repository", "value": "{{(index .app.spec.sources 0).repoURL}}"},
                {"title": "Sync Time", "value": "{{.app.status.operationState.finishedAt}}"}
              ]
            },
            {
              "type": "TextBlock",
              "text": "{{.app.status.health.message}}",
              "wrap": true,
              "color": "Attention"
            }
          ],
          "actions": [
            {
              "type": "Action.OpenUrl",
              "title": "View in Argo CD",
              "url": "{{.context.argocdUrl}}/applications/{{.app.metadata.name}}"
            }
          ]
        }
  template.app-health-unknown: |
    teams-workflows:
      adaptiveCard: |
        {
          "type": "AdaptiveCard",
          "version": "1.4",
          "body": [
            {
              "type": "ColumnSet",
              "columns": [
                {
                  "type": "Column",
                  "width": "auto",
                  "items": [
                    {
                      "type": "Image",
                      "url": "https://www.seekpng.com/png/detail/987-9877847_happy-meme-face-png-troll-face-thumbs-up.png",
                      "size": "Medium"
                    }
                  ]
                },
                {
                  "type": "Column",
                  "width": "stretch",
                  "items": [
                    {
                      "type": "TextBlock",
                      "text": "Application {{.app.metadata.name}}",
                      "weight": "Bolder",
                      "size": "Large",
                      "wrap": true
                    },
                    {
                      "type": "TextBlock",
                      "text": "Health Status Unknown!",
                      "color": "Warning",
                      "weight": "Bolder"
                    }
                  ]
                }
              ]
            },
            {
              "type": "FactSet",
              "facts": [
                {"title": "Status", "value": "{{.app.status.health.status}}"},
                {"title": "Namespace", "value": "{{.app.metadata.namespace}}"},
                {"title": "Cluster", "value": "{{.app.spec.destination.server}}"},
                {"title": "Repository", "value": "{{(index .app.spec.sources 0).repoURL}}"},
                {"title": "Sync Time", "value": "{{.app.status.operationState.finishedAt}}"}
              ]
            },
            {
              "type": "TextBlock",
              "text": "Argo CD cannot determine the current application health status.",
              "wrap": true,
              "color": "Warning"
            }
          ],
          "actions": [
            {
              "type": "Action.OpenUrl",
              "title": "View in Argo CD",
              "url": "{{.context.argocdUrl}}/applications/{{.app.metadata.name}}"
            }
          ]
        }
  template.app-sync-succeeded: |
    teams-workflows:
      adaptiveCard: |
        {
          "type": "AdaptiveCard",
          "version": "1.4",
          "body": [
            {
              "type": "Container",
              "items": [
                {
                  "type": "ColumnSet",
                  "columns": [
                    {
                      "type": "Column",
                      "width": "auto",
                      "items": [
                        {
                          "type": "Image",
                          "url": "https://www.seekpng.com/png/detail/146-1466258_spiderman-ok-meme-vastadehastag-drogas-muymucho-spider-man.png",
                          "size": "Medium",
                          "style": "Person"
                        }
                      ]
                    },
                    {
                      "type": "Column",
                      "width": "stretch",
                      "items": [
                        {
                          "type": "TextBlock",
                          "text": "Application {{.app.metadata.name}}",
                          "weight": "Bolder",
                          "size": "Large",
                          "wrap": true
                        },
                        {
                          "type": "TextBlock",
                          "text": "Successfully synced! 👍",
                          "color": "Good",
                          "spacing": "None",
                          "isSubtle": true
                        }
                      ]
                    }
                  ]
                },
                {
                  "type": "FactSet",
                  "facts": [
                    {
                      "title": "Status",
                      "value": "{{.app.status.sync.status}}"
                    },
                    {
                      "title": "Namespace",
                      "value": "{{.app.metadata.namespace}}"
                    },
                    {
                      "title": "Cluster",
                      "value": "{{.app.spec.destination.server}}"
                    },
                    {
                      "title": "Repository",
                      "value": "{{(index .app.spec.sources 0).repoURL}}"
                    },
                    {
                      "title": "Sync Time",
                      "value": "{{.app.status.operationState.finishedAt}}"
                    }
                  ]
                }
              ]
            }
          ],
          "actions": [
            {
              "type": "Action.OpenUrl",
              "title": "View in Argo CD",
              "url": "{{.context.argocdUrl}}/applications/{{.app.metadata.name}}"
            }
          ]
        }
  template.app-sync-unknown: |
    teams-workflows:
      adaptiveCard: |
        {
          "type": "AdaptiveCard",
          "version": "1.4",
          "body": [
            {
              "type": "ColumnSet",
              "columns": [
                {
                  "type": "Column",
                  "width": "auto",
                  "items": [
                    {
                      "type": "Image",
                      "url": "https://www.seekpng.com/png/detail/987-9877847_happy-meme-face-png-troll-face-thumbs-up.png",
                      "size": "Medium"
                    }
                  ]
                },
                {
                  "type": "Column",
                  "width": "stretch",
                  "items": [
                    {
                      "type": "TextBlock",
                      "text": "Application {{.app.metadata.name}}",
                      "weight": "Bolder",
                      "size": "Large",
                      "wrap": true
                    },
                    {
                      "type": "TextBlock",
                      "text": "Sync Status Unknown!",
                      "color": "Warning",
                      "weight": "Bolder"
                    }
                  ]
                }
              ]
            },
            {
              "type": "FactSet",
              "facts": [
                {"title": "Status", "value": "{{.app.status.sync.status}}"},
                {"title": "Namespace", "value": "{{.app.metadata.namespace}}"},
                {"title": "Cluster", "value": "{{.app.spec.destination.server}}"},
                {"title": "Repository", "value": "{{(index .app.spec.sources 0).repoURL}}"},
                {"title": "Sync Time", "value": "{{.app.status.operationState.finishedAt}}"}
              ]
            },
            {
              "type": "TextBlock",
              "text": "Argo CD cannot determine the current synchronization status.",
              "wrap": true,
              "color": "Warning"
            }
          ],
          "actions": [
            {
              "type": "Action.OpenUrl",
              "title": "View in Argo CD",
              "url": "{{.context.argocdUrl}}/applications/{{.app.metadata.name}}"
            }
          ]
        }
  trigger.on-health-degraded: |
    - when: app.status.health.status == 'Degraded'
      send: [app-health-degraded]
  trigger.on-health-unknown: |
    - when: app.status.health.status == 'Unknown'
      send: [app-health-unknown]
  trigger.on-sync-failed: |
    - when: app.status.operationState.phase in ['Failed', 'Error']
      send: [app-sync-failed]
  trigger.on-sync-status-unknown: |
    - when: app.status.sync.status == 'Unknown'
      send: [app-sync-unknown]
  trigger.on-sync-succeeded: |
    - when: app.status.operationState.phase in ['Succeeded']
      send: [app-sync-succeeded]
kind: ConfigMap
metadata:
  annotations:
    meta.helm.sh/release-name: argocd
    meta.helm.sh/release-namespace: argocd
  labels:
    app.kubernetes.io/component: notifications-controller
    app.kubernetes.io/instance: argocd
    app.kubernetes.io/managed-by: Helm
    app.kubernetes.io/name: argocd-notifications-controller
    app.kubernetes.io/part-of: argocd
    app.kubernetes.io/version: v3.6.2
    helm.sh/chart: argo-cd-10.18.2
  name: argocd-notifications-cm
  namespace: argocd
```
