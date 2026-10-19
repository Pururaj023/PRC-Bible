# PRC

Fast, static, liquid-glass reference site. Built with [Astro](https://astro.build), deployed on Netlify.

## Deploy on Netlify

**Git (recommended):** push this folder to a repo, then in Netlify choose *Add new site → Import from Git*.
Build settings are already in `netlify.toml` (`npm run build`, publish `dist`).

**Drag & drop:** run `npm install && npm run build`, then drop the `dist/` folder on https://app.netlify.com/drop.

## Add a guide

Create a markdown file in `src/content/guides/`, for example `my-guide.md`:

```md
---
title: My Guide
summary: One line shown on the card.
category: how-to        # how-to | rnd | issues | commands | k8s | linux
icon: "🛠️"
tag: Infra Playbook
order: 6
meta:
  - { label: Env, value: DEV }
---

Intro text.

## Step 1 — Do the thing

(code blocks, lists, numbered steps and > callouts all work)
```

The card, page, search entry and category count appear automatically.

## Develop

```
npm install
npm run dev
```
