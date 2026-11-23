# Distillation: Off-Policy KD, On-Policy Distillation (OPD) & Self-Distillation

Distillation is how industry teams capture the intelligence of **200B–600B+ frontier teachers**—or expensive multi-step test-time search—inside **4B–32B student models** that serve at 5×–64× lower cost and sub-second latency.

Between 2024 and late 2026, distillation evolved through three distinct generations: **Off-Policy Sequence Distillation**, **On-Policy Distillation (OPD)**, and **Self-Distillation**—each with sharp trade-offs that every engineering lead must understand before committing GPU budget.

---

## 1. The Three Generations of LLM Distillation

| Method | How It Works | Sample / Compute Efficiency | Main Industry Use Case | Biggest Limitation |
| --- | --- | --- | --- | --- |
| **1. Off-Policy Distillation (Teacher SFT)** | Frontier/large teacher generates outputs; student trains via cross-entropy SFT on those static traces. | Very fast, zero online rollout infra required. | High-volume classification, extraction, routing, cold-start harness bootstrap (Booking.com, DoorDash, Checkr, Harness-1). | **Exposure bias:** student never sees or learns to recover from its *own* mistakes; 2026 closed-API ToS restrictions. |
| **2. On-Policy Distillation (OPD / GKD)** | **Student generates its own rollouts**; a stronger teacher scores every token along the student's trajectory via per-token reverse KL. | **9×–30× cheaper than sparse RL** (dense feedback on every single token!). | Compressing a strong open-weight teacher (e.g. 235B/397B) into a fast 8B–32B production student (Thinking Machines, `verl`, `PrimeRL`, `TRL`). | Requires token-level logprob access to a stronger teacher with a matching tokenizer (open-weight teachers only). |
| **3. Self-Distillation (SDFT / SDPO / OPSD / RGSD)** | The **same model** acts as teacher by giving it privileged context (demonstrations, error critiques, solution hints, or rubrics) and distilling into the unconditioned student. | Very cheap—no separate giant teacher needed; low forgetting for continual skills. | Continual skill updates (SDFT), absorbing textual error critiques (SDPO), knowledge injection (MixSD / Engram). | **Late-2026 Caveat:** Can overfit, suppress backtracking ("wait, let me recheck"), and fail OOD if privileged hints diverge from true reward gradients! |

---

## 2. Why On-Policy Distillation (OPD) Is a Breakthrough for Small & Midsize Models

Standard post-training historically forced a painful choice:
- **SFT / Off-Policy Distillation** gives dense feedback on every token, *but* only on trajectories the teacher wrote—so once the student makes one tiny deviation in production, errors compound uncontrollably.
- **RL (GRPO / PPO)** trains on the student's own trajectories (fixing exposure bias), *but* only gives a single sparse scalar reward at the end of a 5,000-token rollout—requiring massive compute for credit assignment.

**On-Policy Distillation (OPD)**—rooted in Google DeepMind's *GKD* (2023) and brought to industrial prominence by **Thinking Machines Lab (2025–2026)**—combines the best of both worlds:

1. Sample rollouts directly from the **student** policy $\pi_\theta$ on real tasks.
2. Run a single forward pass of a stronger **teacher** policy $\pi_{\text{teacher}}$ over the student's exact generated tokens to obtain per-token teacher logprobs.
3. Minimize per-token **reverse KL divergence** (mode-seeking) so the student learns *at the exact token where it drifted* how the stronger teacher would steer back on track.

:::insight
**The Economics of OPD:** Thinking Machines demonstrated **9×–30× lower compute** than sparse outcome RL to achieve equivalent accuracy—making it the #1 method whenever you already have a strong open-weight teacher (e.g., `Qwen3-235B` or `GLM-5.3`) and want a fast 8B–32B student (`Qwen3.5-9B`, `Qwen3-32B`, `Qwen3.6-35B-A3B`) for production serving.
:::

### Built-In Framework Support (2026)
You do not need to write OPD from scratch—it is natively implemented in:
- **verl:** Built-in `OPD` algorithm module (`verl.readthedocs.io/en/latest/algo/opd.html`)
- **PrimeRL:** Native `opd.py` orchestrator algorithm
- **Hugging Face TRL:** `DistillationTrainer` (GKD / On-Policy Distillation)
- **Tinker (Thinking Machines API):** First-class Off-Policy & On-Policy Distillation cookbook recipes
- **rLLM:** Math & agent OPD recipes on top of Tinker

---

## 3. Advanced 2026 Variants: PivotOPD & Self-Distillation

### PivotOPD (*arXiv:2609.40285*) — Fixing Multi-Turn Agent Recovery
In multi-turn agents, 90% of turns are routine, while 1–2 **pivotal mistakes** derail the whole task. PivotOPD targets teacher OPD corrections specifically at pivotal error turns and the immediate recovery turns afterward, explicitly teaching small models **how to recover mid-trajectory** rather than only mimicking flawless paths.

### The Self-Distillation Wave (SDFT, SDPO, OPSD, RGSD)
When you lack a larger teacher model, 2026 research explored turning **context into a self-teacher**:
- **SDFT** (*Self-Distillation Enables Continual Learning*, `arXiv:2601.19897`): Conditions the model on in-context demonstrations as teacher for its own rollouts—absorbing new domain skills with dramatically less catastrophic forgetting than SFT.
- **SDPO** (*RL via Self-Distillation*, `arXiv:2601.20802`): Feeds textual error feedback ("your SQL missed the `JOIN` condition") into the self-teacher context, converting qualitative critique into dense per-token gradients.
- **RGSD** (*Rubric-Guided Self-Distillation*, `arXiv:2606.12507`): Conditions the self-teacher on the evaluation rubric itself to distill rubric adherence without paying for an online LLM judge during every RL step.

---

## 4. Critical Late-2026 Reality Check: When Self-Distillation Fails

Before betting a production roadmap on privileged-information self-distillation (SDPO / OPSD / RGSD), weigh three crucial empirical warnings published in late 2026:

1. **Weak Out-of-Distribution Generalization** (*Does Self-Distillation Improve Reasoning?*, `arXiv:2610.18613`): Re-evaluating SDPO and OPSD across math, code, and science found that many reported gains come from in-distribution overfitting rather than genuinely internalizing privileged information, because self-distillation gradients do not reliably align with true expected-reward policy gradients.
2. **Epistemic Overconfidence & Suppressed Backtracking:** Because the privileged teacher already sees the answer or rubric, it never hesitates or backtracks ("wait, let me double-check"). Distilling directly from it suppresses the student's uncertainty verbalization and self-correction cues—making the model brittle on unfamiliar production inputs.
3. **Multi-Turn Instability** (*From Self-Distillation to Self-Practice*, `arXiv:2609.29051`; Will Brown): Privileged hints in multi-turn self-teachers frequently destabilize agentic training. Mixing **attractive (correct) and repulsive (incorrect) teachers** (*On Repulsive and Attractive Teachers*, 2026) or converting hints into guided exploration rollouts trained with **GRPO** ("Self-Practice") proves far more robust.

:::warning
**Practical Production Verdict on Distillation (Nov 2026):**
- **Off-Policy SFT / iSFT:** Use for cold-start formatting, high-volume structured tasks, and clinical/legal draft repair (Baseten iSFT).
- **Cross-Model On-Policy Distillation (OPD):** Use whenever you have a genuinely stronger open-weight teacher (same tokenizer family) and want a 4B–32B student at 10× lower compute than RL.
- **Privileged Self-Distillation (SDFT / SDPO / RGSD):** Treat as a targeted tool for *continual skill/knowledge transfer* and always validate on strict out-of-distribution holdouts—do **not** assume it replaces GRPO/GSPO on hard reasoning or multi-turn agents.
:::

---

## 5. The Continual Learning Bridge: Harness Memory → Weight Distillation

A recurring enterprise challenge—explored in both **Engram × Harvey** (27B firm knowledge self-study) and continual-learning agent research—is that **naive continual pre-training or frequent SFT either learns too little or causes catastrophic forgetting**.

The winning 2026 hybrid architecture works in two loops:
1. **Fast Loop (Learn in the Harness & Memory):** Give the agent persistent structured memory; use RL to train the agent's *memory policy* (when to store user corrections, when to retrieve them, and how to apply them across sessions).
2. **Slow Loop (Distill Verified Behavior into Weights):** Periodically consolidate high-frequency, verified memory-mediated trajectories into compact student weights via **On-Policy Distillation / SDFT / LoRA + SLERP**—keeping the runtime scaffold thin and fast without corrupting core reasoning.
