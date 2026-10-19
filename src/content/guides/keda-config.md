---
title: KEDA Configuration
summary: Event-driven autoscaling off Azure Event Hub (Kafka protocol) — TriggerAuthentication, ScaledObject & secret.
category: how-to
icon: "⚡"
tag: Autoscaling
order: 3
meta:
  - { label: Namespace, value: custom }
  - { label: Event source, value: Azure Event Hub }
  - { label: API, value: keda.sh/v1alpha1 }
---

Currently we use Azure Event Hub as a Kafka alternative. There are two ways to implement KEDA against it, depending on how the consuming application talks to Event Hub.

## How it works

- Event Hub can operate in two modes: as a **Kafka endpoint**, or as a native **Event Hub endpoint**.
- If the application uses a **Kafka SDK**, Event Hub behaves like Kafka and stores consumer lag itself — KEDA's `kafka` trigger scales directly off that.
- If the application uses the **Azure Event Hub SDK**, Event Hub requires a storage account to persist the consumer lag/checkpoint, and KEDA's `azure-eventhub` trigger reads from there instead.

> ℹ The configuration below covers the Kafka-endpoint path — used when the application connects via a Kafka SDK.

## TriggerAuthentication

References the Kafka-mode secret for SASL credentials:

```yaml
apiVersion: keda.sh/v1alpha1
kind: TriggerAuthentication
metadata:
  name: customerconsumer-kafka-trigger-auth
  namespace: custom
spec:
  secretTargetRef:
    - parameter: username
      name: kafka-eh-secret-kafka
      key: username
    - parameter: password
      name: kafka-eh-secret-kafka
      key: password
```

## ScaledObject

Scales the deployment on the Kafka lag trigger, with a memory trigger as a secondary safeguard:

```yaml
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: customerconsumer-api-scaledobject
  namespace: custom
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: customerconsumer-api
  minReplicaCount: 1
  maxReplicaCount: 2
  pollingInterval: 15
  cooldownPeriod: 60
  advanced:
    horizontalPodAutoscalerConfig:
      behavior:
        scaleUp:
          stabilizationWindowSeconds: 30
          policies:
            - type: Pods
              value: 2
              periodSeconds: 30
        scaleDown:
          stabilizationWindowSeconds: 120
          policies:
            - type: Pods
              value: 1
              periodSeconds: 60

  triggers:
    - type: kafka
      metadata:
        bootstrapServers: SLC-Prod-Shopify-App-EH.servicebus.windows.net:9093
        consumerGroup: customer-inactive-push-consumer-group
        topic: ca.customer.inactive-push
        lagThreshold: "5000"
        activationLagThreshold: "2000"
        sasl: plaintext
        tls: enable
      authenticationRef:
        name: customerconsumer-kafka-trigger-auth

    - type: memory
      metricType: Utilization
      metadata:
        value: "70"
```

> ⚠ `lagThreshold` is the target lag per replica; `activationLagThreshold` is the minimum lag before KEDA activates a scale-from-zero-or-idle event.

## Kubernetes secret

Holds the Kafka-mode SASL credentials referenced by the TriggerAuthentication above:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: kafka-eh-secret
  namespace: custom
type: Opaque
stringData:
  sasl: "plaintext"
  tls: "enable"
  username: "$ConnectionString"
  password: "endpoint connection string"
```
