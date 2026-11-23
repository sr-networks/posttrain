# Post-Training Small & Midsize Models for Industry

A static, zero-dependency knowledge hub (deployed via **GitHub Pages** and ready for **GitLab Pages**) collecting practical industry intelligence on **Supervised Fine-Tuning (SFT / iSFT)**, **Reinforcement Learning (RLVR, GRPO, GSPO, DAPO, GDPO, Online RL)**, and **Distillation (Off-Policy KD, On-Policy Distillation / OPD, Self-Distillation)** for small and midsize models (**4B–35B dense & small-active MoEs**).

Live site: https://sr-networks.github.io/posttrain/

## What's Inside

- **Executive Overview & Interactive Method Selector** (`public/index.html`): Choose your enterprise workload to get the highest-ROI method, model tier, starter stack, and matching case studies.
- **15 Audited Industry Case Studies** (`data/case-studies.json` → `public/case-studies/`): Coinbase Fraud Agent (`9B`), Cursor Tab Online RL, Intercom Fin Apex, Baseten Medical Scribes (`32B` iSFT), Harvey Legal Suite (`9B/27B/35B-A3B`), Cognition SWE-grep, OpenPipe ART·E (`14B`), Booking.com/Checkr/Uber/DoorDash SLMs (`3.8B–8B`), Databricks TAO, NVIDIA ToolOrchestra (`8B`), Thinking Machines × Bridgewater OPD, Paper Instruments Ultramarine, Harness-1 (`20B`), DeepSWE (`32B`), and Mercor APEX / Amazon Nova Forge.
- **Deep-Dive Method Chapters** (`docs/sft.md`, `docs/rl.md`, `docs/distillation.md`).
- **10-Rule Field Playbook** (`docs/best-practices.md`): Production engineering checklist combining industry postmortems with hands-on multi-turn RL & LoRA lessons.
- **Frameworks & Hardware Sizing** (`data/frameworks.json` → `public/frameworks/`): `verl`, `SkyRL`, `PrimeRL + Verifiers`, `OpenPipe ART`, `Unsloth`, `HF TRL`, `Tinker`, `OpenRLHF`, `rLLM`, `Agent Lightning`, `Scale AgentEnv`.
- **Curated Reference Library** (`data/references.json` → `public/references/`): Searchable & filterable archive consolidating curated practitioner links and 2024–2026 primary research.

## Local Build & Preview

Requires only Node.js (zero third-party `npm` dependencies):

```bash
npm run build
npm run serve
# Open http://localhost:8080
```

## Editing Content

- Edit prose chapters directly in `docs/*.md` (Markdown-native, works cleanly in Obsidian or GitLab Web IDE).
- Add or update audited projects in `data/case-studies.json`.
- Add frameworks in `data/frameworks.json` or links in `data/references.json`.
- Run `npm run build` (or push to GitLab's default branch — `.gitlab-ci.yml` rebuilds and publishes `public/` automatically).

## Deploying to GitLab Pages

1. Push this repository to GitLab:
   ```bash
   git init
   git add .
   git commit -m "Initial industrial post-training GitLab Pages hub"
   git remote add origin <your-gitlab-repo-url>
   git push -u origin main
   ```
2. GitLab CI picks up `.gitlab-ci.yml`, runs `node scripts/build.mjs` in `node:22-alpine`, and publishes `public/` via the `pages` job.
3. All links and asset paths are strictly relative, so the site works cleanly both under subpath URLs (`https://<namespace>.gitlab.io/posttrain/`) and custom domains.
