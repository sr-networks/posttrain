# Reinforcement Learning (RLVR, Agentic RL & Online RL)

In 2025–2026, **Reinforcement Learning became the primary engine for making small and midsize models (8B–35B) beat frontier models on real industry workflows**. Unlike SFT—which teaches imitation of static reference answers—RL lets a model explore inside your actual production harness, learn from its own multi-turn mistakes, optimize latency/tool-call efficiency directly, and forget far less (*RL's Razor*, 2025).

---

## 1. Why RL Wins for Enterprise Small & Midsize Models

Real production wins from 2025–2026 demonstrate four business outcomes that SFT alone rarely delivers:

- **Beating Frontier Accuracy on Owned Ground Truth:** Coinbase post-trained `Qwen3.5-9B` with SkyRL on proprietary fraud outcomes for **<$100** and beat Claude Opus 4.5 by **+9.6% F1** at **55% lower latency**.
- **Slashing Token & Tool-Call Costs:** Harvey's GRPO on `Qwen3.5-9B` cut redundant `grep` calls by **67%**; Harvey × Applied Compute's RL on `Qwen3.6-35B-A3B` cut input tokens by **50.3%** and output tokens by **28.6%**; Mercor's RL on APEX-Agents cut average steps from **72 to 43**.
- **Closing Live Product Loops:** Cursor's online policy-gradient RL on accept/reject/silence telemetry ships every **1.5–2 hours**, reducing noisy suggestions by **21%** while lifting accept rate by **+28%**.
- **Removing the Data-Labeling Tax:** Databricks TAO runs RL over *unlabeled* enterprise SQL/DocQA logs scored by automated verifiers/DBRM—beating SFT trained on thousands of human labels with zero runtime latency penalty.

:::insight
**When RL Is Worth the Complexity:** Use RL when (1) your base/SFT model already solves some fraction of tasks (`pass@k > 0`), (2) you have a reliable verifier, real outcome signal, or calibrated rubric, and (3) multi-turn strategy, tool efficiency, or OOD generalization directly affects your unit economics.
:::

---

## 2. Algorithm Landscape (2024–2026)

| Algorithm | How It Works | Strengths for 7B–35B Industry Models | Primary Pitfalls / Notes |
| --- | --- | --- | --- |
| **GRPO** *(DeepSeekMath)* | Samples a group of $G$ rollouts per prompt; normalizes advantages relative to group mean/std without a Critic network. | Massive VRAM savings (no value model); proven on 1× H100 (`ART·E` 14B, Harvey 9B, NVIDIA ToolOrchestra 8B). | Length bias under rollout-level averaging; entropy collapse if clipping is too tight; noisy when all $G$ rollouts score 0 or 1. |
| **DAPO** *(ByteDance)* | Four targeted GRPO upgrades: **Clip-Higher** (asymmetric clipping), **Dynamic Sampling** (drop zero-variance groups), **Token-Level Loss**, **Overlong Reward Shaping**. | Much healthier exploration on long multi-turn reasoning & coding tasks (`DeepSWE`, `verl`). | Slightly higher rollout waste when filtering all-pass/all-fail groups; needs tuned overlong buffer. |
| **GSPO** *(Qwen)* | Computes and clips importance-sampling ratios at the **sequence level** rather than per token. | Dramatically stabilizes **MoE models** (e.g., 35B-A3B) and very long agent trajectories (Harvey Tenet). | Newer than GRPO; supported in `verl`, `Unsloth`, and custom stacks. |
| **CISPO** *(Thinking Machines / PrimeRL)* | Clips importance-sampling weights directly in policy gradient updates (often with asymmetric bounds). | Stable under off-policy/async lag; used in Thinking Machines × Bridgewater financial judgment models. | Requires careful logprob tracking between rollout sampler and trainer. |
| **GDPO** *(NVIDIA, 2026)* | **Group reward-Decoupled Normalization** — normalizes each reward component independently before summing. | **Essential for multi-reward enterprise RL** (e.g., accuracy + format + cost/tool efficiency) so one noisy term never swamps outcome advantage. | Simple drop-in upgrade over naive weighted sums in GRPO. |
| **PPO** *(Classic)* | Policy gradient with clipped surrogate objective + learned Critic (value network) + GAE. | Strong token/turn-level credit assignment on very long horizons when critic can be trained cleanly. | 2× memory footprint & critic warmup complexity; largely superseded by GRPO/DAPO/GSPO for <35B models. |
| **DPO / SimPO / KTO** | Offline contrastive loss on static `(chosen, rejected)` preference pairs (no live rollouts). | Very cheap, stable, easy to run on 1 GPU for tone, safety, and concise style preferences. | Off-policy: weaker than online RL on multi-turn tool use, reasoning, and error recovery. |

---

## 3. Reward Engineering: The Real Moat

Across every audited industry project, **reward and environment design mattered 10× more than swapping RL algorithms**.

### Tier A: Verifiable Outcome Rewards (RLVR) — Highest ROI
Whenever business logic can be checked deterministically, prefer RLVR over LLM judges:
- **Software & Data:** Unit tests in microVMs (`DeepSWE`), SQL execution equivalence (`Databricks TAO`), JSON/API schema AST checks.
- **Retrieval & Search:** Ground-truth file & line F1 (`Cognition SWE-grep`), curated recall (`Harness-1`).
- **Real Business Outcomes:** Chargeback/fraud labels (`Coinbase`), user accept/reject/silence telemetry (`Cursor Tab`), conversion or resolution deflection.

### Tier B: Hybrid Code + LLM-Judge Rewards — Best for Enterprise Extraction
Modeled directly on **Harvey × Applied Compute (Review Tables)**:
- **Deterministic code** verifies strict JSON schema, dates, numbers, and exact verbatim sentence presence.
- **LLM Judge** evaluates semantic extraction accuracy and whether the cited sentence actually supports the claim.

### Tier C: Rubrics as Rewards (RaR) — For Non-Verifiable Knowledge Work
For legal memos, clinical notes, financial briefings, and consulting decks (*Paper Instruments Ultramarine*, *Harvey LAB*, *Mercor APEX*):
- Break quality into **atomic, binary/checkable rubric items** per case (distinguishing *Essential* vs. *Nice-to-have* criteria).
- **Mitigate Reward Hacking with Rubric Dropout** (*arXiv:2608.11669*): randomly drop a subset of rubric items per rollout so the model cannot game a fixed checklist with boilerplate keywords.
- **Audit Judge Variance:** Measure inter-run judge agreement on a fixed sample (even strong judges often have **~85% item agreement** and `0.05–0.13` reward noise per answer). Report paired standard errors before declaring a checkpoint win!
- **Watch the Hallucination Tax** (*arXiv:2505.13988*): Pure outcome rewards without an explicit abstention reward train models to bluff confidently whenever unsure.

:::warning
**Field Trap — Multi-Reward Term Dominance:** In multi-turn agentic RL, a per-turn shaping reward (such as rewarding each search tool call that finds a keyword) can easily reach magnitudes like `-0.27` while your final outcome advantage is only `±0.10`. The agent will then optimize search mechanics while *ignoring final answer quality*. Fix: keep auxiliary weights tiny, verify component magnitudes per update, or use **NVIDIA GDPO** decoupled normalization!
:::

---

## 4. Systems & Stability Pitfalls in Multi-Turn Agentic RL

Most failed industry RL runs fail due to **engineering bugs**, not math. Five non-negotiable failure modes to inspect on day one:

### 1. Training–Inference Logprob Mismatch
Rollout engines (`vLLM`, `SGLang`, FP8 kernels) and trainers (`FSDP2`, `BF16`) produce slightly different token logprobs for the exact same prompt (*When Speed Kills Stability*, 2025). Even a small systematic `kl_v1` drift (e.g., `-6e-3`) silently collapses unclipped RL runs.
- **Fix:** Always log and inspect sampler-vs-trainer logprob diff on step 0; keep clipping active; consider **IcePOP**, **Score Centering** (*arXiv:2609.20807*), and run a BF16 control when debugging FP8 RL.

### 2. Chat-Template Re-Application & Thinking-Block Corruption
Re-rendering the conversation history through a chat template at every turn alters special tokens or strips `<think>...</think>` blocks—meaning the trainer's token IDs no longer match the rollout engine's stored logprobs!
- **Fix (Token-In, Token-Out):** Preserve exact raw token IDs emitted during rollouts. With modern hybrid-reasoning models (e.g., `Qwen3.8`), you do **not** have to disable thinking in multi-turn RL—use `enable_thinking` + `preserve_thinking` consistently across rollouts, training, and evaluation, or use separate turn histories (`ART Additional Histories`).

### 3. Unconstrained Rollout Sampling Collapse
Although textbook RL prescribes pure sampling (`temperature=1.0, top_p=1.0, top_k=-1`), on small/midsize models like Qwen this can trigger multilingual drift (stray CJK characters or word salad) during early exploration.
- **Fix:** Constrain sampling sensibly (e.g., model-recommended `top_p=0.95, top_k=20`) while monitoring entropy so exploration stays coherent.

### 4. Artificial Turn Caps & Loss Normalization Bias
- **Loss Normalization:** Summing loss across all tokens gives long verbose rollouts disproportionately more gradient weight, causing answer lengths to double without real quality gains! Compare **token-normalized** vs. **rollout-normalized** loss intentionally and monitor mean response length every step.
- **Turn & Token Caps:** Tight caps (`max_turns=3` or aggressive answer truncation) cut off valid multi-step recovery paths and inject zero-reward noise into good trajectories.

### 5. Sandboxing Multi-Tenant / Code Rollouts
Never run untrusted RL code-execution rollouts inside vanilla Docker containers. Production setups use **gVisor**, **Kata Containers**, or **Firecracker microVMs** with fast pre-warmed snapshots.
