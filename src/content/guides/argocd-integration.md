---
title: ArgoCD Integration
summary: Shopify Argo CD setup on AKS — ingress, Helm install, and multi-cluster registration.
category: how-to
icon: "🚀"
tag: Infra Playbook
order: 1
meta:
  - { label: Subscription, value: ShopLC-DEV-Shopify-Apps }
  - { label: Env, value: DEV }
  - { label: Location, value: US }
  - { label: Author, value: Pururaj Choudhary }
  - { label: Date, value: 24 Jun 2026 }
---

A comprehensive guide to setting up Argo CD on the AKS environment — from cluster ingress to exposing the UI through Application Gateway, wiring up GitHub, and enabling self-heal.

## Goals

- Set up and integrate Argo CD on the AKS cluster
- Expose the Argo CD UI using the Application Gateway
- Set up the GitHub repos with Argo CD
- Enable self-heal and automatic deployment in Argo CD

## Infrastructure requirements

- AKS cluster
- SH VM
- Helm installed on SH VM & AKS
- GitHub repo
- Application Gateway
- DNS name

## Steps to set up Argo CD

1. **Set up the ingress file for Argo CD** — create and edit `argocd-ingress.yaml`:

    ```yaml
    apiVersion: networking.k8s.io/v1
    kind: Ingress
    metadata:
      name: argocd-ingress
      namespace: argocd
      annotations:
        appgw.ingress.kubernetes.io/appgw-ssl-certificate: ssl-tjc.tv
        appgw.ingress.kubernetes.io/use-private-ip: "true"
    spec:
      ingressClassName: azure-application-gateway
      rules:
      - host: argocddevtvp.tjc.tv  # change host to required name
        http:
          paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: argocd-server
                port:
                  number: 80
    ```

2. **Create the namespace**

    ```bash
    kubectl create namespace argocd
    ```

3. **Add the Argo Helm repo**

    ```bash
    helm repo add argo https://argoproj.github.io/argo-helm
    ```

4. **Update Helm repos**

    ```bash
    helm repo update
    ```

5. **Install Argo CD**

    ```bash
    helm install argocd argo/argo-cd \
      --namespace argocd
    ```

6. **Retrieve the initial admin password**

    ```bash
    kubectl -n argocd get secret argocd-initial-admin-secret \
      -o jsonpath="{.data.password}" | base64 -d
    ```

7. **Edit `values.yaml`** and add:

    ```yaml
    configs:
      params:
        server.insecure: true
    ```

8. **Upgrade the release** with the updated values

    ```bash
    helm upgrade argocd argo/argo-cd -n argocd -f values.yaml
    ```

9. **Apply the ingress**

    ```bash
    kubectl apply -f argocd-ingress.yaml -n argocd
    ```

## Steps to add multiple clusters to a single Argo CD

1. **Network requirement** — clusters must be on the same network.

2. **Install the Argo CD CLI** on the SH VM:

    ```bash
    curl -sSL -o argocd https://github.com/argoproj/argo-cd/releases/latest/download/argocd-linux-amd64
    chmod +x argocd
    sudo mv argocd /usr/local/bin/
    ```

3. **Log in via the CLI**

    ```bash
    argocd login <argocdshopifydev.tjc.tv>
    ```

    > ⚠ Use the configured domain, with the `admin` user and its password.

4. **Get the target cluster's context**

    ```bash
    kubectl config get-contexts
    ```

5. **Register the new cluster**

    ```bash
    argocd cluster add <cluster-name>
    ```

    > ✓ Verify in the UI under `Settings → Clusters` — the new cluster should be listed there.
