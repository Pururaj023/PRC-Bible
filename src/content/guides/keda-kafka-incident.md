---
title: KEDA Kafka Trigger Misconfiguration
summary: 13 Event Hub consumer services silently mis-scaled from a Kafka-vs-Event-Hub trigger type mismatch.
category: issues
icon: "⚠️"
tag: Incident · High
order: 1
meta:
  - { label: Severity, value: High }
  - { label: Status, value: Resolved }
  - { label: Services affected, value: "13" }
  - { label: Namespace, value: decustomsvc }
  - { label: Date, value: 26 Jun 2026 }
---

## Issue

13 Kafka consumer microservices in AKS had their KEDA `ScaledObject` triggers set to `azure-eventhub`, even though the applications were built with KafkaJS. This caused auto-scaling to fail and behave unpredictably across all affected services.

## Cause

KafkaJS stores consumer offsets in the Kafka broker's `__consumer_offsets` topic, but the `azure-eventhub` trigger type looks for checkpoints in Azure Blob Storage instead. That mismatch meant KEDA was checking a location the application never wrote to, so it could never calculate real message lag.

## Impact

- ScaledObjects stuck in `ScaledObjectCheckFailed` / `UnknownState`
- HPA metrics unavailable — `memory: <unknown>/70%`
- Pods scaling erratically, with no correlation to actual message load
- Continuous KEDA operator warnings every 30 seconds
- Elevated risk of service degradation during high-traffic periods, across all 13 services

## Resolution

Changed the trigger type from `azure-eventhub` to `kafka` on every affected `ScaledObject`, and updated the paired `TriggerAuthentication` to use SASL `username`/`password` instead of the Azure SDK's `connection`/`storageConnection` parameters.

```diff
- type: azure-eventhub  # wrong — expects Blob Storage checkpoints
+ type: kafka           # correct — reads offsets from Kafka broker
```

> ✓ Verified via `kubectl logs -n keda deployment/keda-operator` and ScaledObject status returning `READY=True` with lag metrics flowing normally.
