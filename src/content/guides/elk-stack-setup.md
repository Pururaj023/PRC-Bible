---
title: ELK Stack Setup on VM
summary: Install Elasticsearch, Kibana, and Nginx as a reverse proxy — one script, ready to go.
category: how-to
icon: "🔎"
tag: Infra Playbook
order: 4
meta:
  - { label: Stack, value: Elasticsearch + Kibana + Nginx }
  - { label: Repo, value: Elastic 9.x apt }
  - { label: OS, value: Debian/Ubuntu }
---

A single script that adds the official Elastic apt repository, installs Elasticsearch, Kibana, and Nginx, and pre-wires Nginx as a reverse proxy in front of Kibana. Services are installed but deliberately **not started** — that's a separate step once config is reviewed.

## What it does

- Adds the Elastic GPG key and the 9.x apt repository
- Installs Elasticsearch, Kibana, and Nginx via apt
- Writes an Nginx reverse-proxy config pointing at Kibana on `localhost:5601`
- Enables the site, removes the default Nginx site, and validates the config with `nginx -t`

## Setup script

```bash
#!/bin/bash
# Add Elastic GPG Key
wget -qO - https://artifacts.elastic.co/GPG-KEY-elasticsearch | \
sudo gpg --dearmor -o /usr/share/keyrings/elasticsearch-keyring.gpg
# Install required package
sudo apt-get install -y apt-transport-https
# Add Elastic repository
echo "deb [signed-by=/usr/share/keyrings/elasticsearch-keyring.gpg] \
https://artifacts.elastic.co/packages/9.x/apt stable main" | \
sudo tee /etc/apt/sources.list.d/elastic-9.x.list
# Update package list
sudo apt-get update
# Install Elasticsearch, Kibana, and Nginx
sudo apt-get install -y elasticsearch kibana nginx
# Create Nginx config for Kibana reverse proxy
sudo tee /etc/nginx/sites-available/kibana > /dev/null <<EOF
server {
    listen 80;
    server_name your_domain_or_ip;
    location / {
        proxy_pass http://localhost:5601;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF
# Enable Nginx site
sudo ln -sf /etc/nginx/sites-available/kibana /etc/nginx/sites-enabled/kibana
# Optional: remove default site
sudo rm -f /etc/nginx/sites-enabled/default
# Test Nginx config (won't start it)
sudo nginx -t
echo "Installation complete. Services are NOT started."
```

> ℹ Before going further, edit `server_name` in the Nginx config to your actual domain or IP, then start the services when ready: `sudo systemctl start elasticsearch kibana nginx`.
