# Knowledge Distillation: Off-Policy, On-Policy, and Self-Distillation

Knowledge distillation transfers behavioral competence from a high-capacity teacher policy (or a computationally expensive test-time search procedure) into a smaller student model $\pi_\theta$ suitable for low-latency, cost-constrained deployment. Contemporary LLM distillation methods fall into three distinct formulations defined by *which policy generates the training trajectories* and *whether supervision is provided by a separate model or privileged context*.

---

## 1. Taxonomy of Distillation Regimes

| Formulation | Trajectory Source | Supervision Signal | Sample & Compute Profile | Primary Limitation |
| --- | --- | --- | --- | --- |
| **Off-policy sequence distillation** | Teacher $\pi_T$ | Token cross-entropy on static teacher completions | Lowest training complexity; no online rollout loop | **Exposure bias** (student never observes recovery from its own state distribution); closed-API terms-of-service restrictions |
| **On-policy distillation (OPD / GKD)** | Student $\pi_\theta$ | Per-token reverse KL divergence against teacher log-probabilities | $9\times$–$30\times$ fewer compute FLOPs than sparse outcome RL | Requires token-level logit/logprob access to a stronger teacher sharing a compatible tokenizer |
| **Context-conditioned self-distillation** | Student $\pi_\theta$ | Same model $\pi_\theta(\cdot \mid x, c)$ conditioned on demonstrations, critiques, or rubrics $c$ | No external larger teacher required | Weak OOD generalization and suppressed epistemic backtracking on complex reasoning (*arXiv:2610.18613*) |

---

## 2. On-Policy Distillation (OPD)

Standard post-training presents a trade-off between **supervision density** and **state-distribution alignment**:
- Off-policy SFT provides dense supervision of $\mathcal{O}(1)$ bits per token, but exclusively along teacher-visited states. At test time, minor student errors compound quadratically with horizon length (*Ross et al., 2011*).
- Outcome-based RL evaluates states visited by the student policy $\pi_\theta$, resolving exposure bias, but provides only a single scalar reward over sequences of $10^3$–$10^5$ tokens.

**On-Policy Distillation** (*Agarwal et al., 2023*; *Thinking Machines Lab, 2025*) combines on-policy state visitation with dense token-level supervision:

1. Sample trajectories $y \sim \pi_\theta(\cdot \mid x)$ from the **student** model.
2. Evaluate the **teacher** model $\pi_T$ via a single parallel forward pass on $(x, y)$ to obtain conditional token distributions $\pi_T(y_t \mid x, y_{<t})$.
3. Minimize token-level **reverse Kullback–Leibler divergence** $D_{\mathrm{KL}}(\pi_\theta \,\|\, \pi_T)$ along the student-generated trajectory.

:::insight
**Computational efficiency.** Because every token receives a low-variance directional gradient from $\pi_T$ without requiring large group rollouts for baseline estimation, OPD achieves comparable downstream performance to sparse RL at roughly $9\times$–$30\times$ lower training compute when an open-weight teacher (e.g., `Qwen3-235B` or `GLM-5.3`) is available for a same-family student (4B–32B).
:::

Native OPD implementations are available in `verl`, `PrimeRL`, Hugging Face `TRL` (`DistillationTrainer`), `rLLM`, and the `Tinker` API. For multi-turn tool agents, **PivotOPD** (*arXiv:2609.40285*) concentrates teacher supervision specifically on pivotal error turns and subsequent recovery steps.

---

## 3. Context-Conditioned Self-Distillation and Empirical Limitations

When no larger open-weight teacher exists, several 2026 methods construct an implicit teacher by conditioning the student model itself on privileged context $c$:
- **SDFT** (*arXiv:2601.19897*): Conditions the self-teacher on in-context demonstrations to support continual skill acquisition with reduced forgetting relative to off-policy SFT.
- **SDPO** (*arXiv:2601.20802*): Conditions the self-teacher on natural-language error critiques or execution tracebacks, converting textual feedback into token-level updates.
- **OPSD / RGSD** (*arXiv:2601.18734*; *arXiv:2606.12507*): Supplies verified solution hints or evaluation rubrics in the teacher prompt while training the unconditioned student to match the resulting token distribution.

### Empirical Caveats (Late-2026 Re-evaluations)

Controlled evaluations across mathematical, scientific, and code benchmarks (*Does Self-Distillation Improve Reasoning?*, *arXiv:2610.18613*; *From Self-Distillation to Self-Practice*, *arXiv:2609.29051*) identify three structural limitations of privileged-context self-distillation:

1. **Gradient misalignment and OOD fragility.** Minimizing divergence toward a hint-conditioned self-teacher does not, in general, align with the policy gradient of expected task reward; observed gains frequently reflect in-distribution style transfer rather than out-of-distribution generalization.
2. **Suppression of epistemic uncertainty and backtracking.** Because a teacher conditioned on a gold solution or rubric already possesses the answer path, its token distribution assigns low probability to exploratory hesitation and self-correction markers (e.g., re-verifying intermediate assumptions). Distilling directly from this distribution reduces the student's capacity to recover when its initial hypothesis on an unseen test instance is incorrect.
3. **Multi-turn instability.** In multi-turn agent loops, privileged self-distillation often destabilizes exploration. Incorporating contrastive negative teachers (*On Repulsive and Attractive Teachers*, 2026) or using hints strictly to generate exploratory rollouts subsequently optimized via standard **GRPO** ("Self-Practice", *arXiv:2609.29051*) yields more robust generalization.

---

## 4. Consolidation of External Memory into Model Weights

In enterprise deployments where agents accumulate domain knowledge across sessions, continual pretraining or repeated off-policy SFT faces a plasticity–stability trade-off: small updates fail to retain new facts reliably, whereas aggressive updates degrade general reasoning.

A two-timescale architecture—exemplified by parameter-efficient self-study (*Engram × Harvey, 2026*) and memory-mediated RL—separates acquisition from consolidation:
1. **Inference-time state (fast timescale):** Store corrections, precedents, and environment feedback in structured external memory; train the policy via RL to decide *when* to write and retrieve memory entries.
2. **Parametric consolidation (slow timescale):** Periodically distill high-frequency, verified trajectories into compact LoRA adapters via cross-model OPD or SDFT, reducing runtime context length while preserving core reasoning on held-out retention suites.

---

## 5. Controlled Case Analysis: Cross-Family Off-Policy Distillation (Together AI, 2026)

Although On-Policy Distillation (Section 2) offers superior compute efficiency when student and teacher share a vocabulary, industrial deployments frequently pair a strong teacher from one model family with a compact student from another. A controlled November 2026 study by Together AI ([Post-Training Cookbook](https://github.com/togethercomputer/post-training-cookbook/tree/main/post_training_cookbook/distillation)) demonstrates that text-only **off-policy LoRA distillation** from `Kimi-K3.1-Pro` into `Qwen3.8-27B`—two models with incompatible tokenizers—can close narrow capability gaps ("jagged intelligence") at minimal cost when paired with targeted retention mixing and data-scaling controls.

### Problem Formulation and Baseline Diagnosis

On the full 1,012-sentence FLORES-200 English-to-Lao `devtest` benchmark, base `Qwen3.8-27B` scored **5.5 chrF++** (`11%` Lao script), whereas `Kimi-K3.1-Pro` scored **47.5 chrF++** (`100%` Lao script). Diagnostic inspection revealed that the base student answered in Thai—Lao's closest genealogical relative—on 45 of 50 screened sentences. Round-trip adequacy (back-translating outputs to English via `Kimi-K3.1-Pro`) confirmed that the base student's Thai outputs already preserved source semantics (`64.6`, vs. `64.0` for human Lao references); the failure was language and script identity rather than comprehension.

Because `Kimi-K3.1-Pro` and `Qwen3.8-27B` do not share a tokenizer, token-level log-probability OPD was inapplicable. Teacher trajectories were instead generated via standard serverless chat completions (`temperature=0.0`, thinking disabled) at USD 2/M input and USD 10/M output tokens—costing **USD 7.46** for 4,000 Lao translations—and distilled into a `Qwen3.8-27B` LoRA adapter (`rank=64`, `alpha=128`, peak LR `1e-4` with 5% warmup and cosine decay to `0.1×` peak, batch size 16, assistant-only loss masking). Total experimental spend across all ablations on B200 GPUs was **USD 260**; the best single run completed in 46 minutes (33.7 minutes of training across 602 steps / 1.11M assistant tokens, plus 7.1 minutes for 30 in-loop evaluations).

### Experimental Results

| Training Run | Supervision Mixture | Lao chrF++ (1,012) | Lao Script | Thai chrF++ (300) |
| --- | --- | --- | --- | --- |
| Base student (`Qwen3.8-27B`) | None | 5.5 | 11% | 46.7 |
| Human-reference SFT (control) | 945 human Lao (FLORES `dev`) | 44.7 | 100% | **5.3** |
| Off-policy distill, Lao only | 965 `Kimi-K3.1-Pro` Lao | 41.8 | 100% | 44.3 |
| Off-policy distill, Lao + Thai | 965 Lao + 989 Thai (`Kimi-K3.1-Pro`) | 41.9 | 100% | 47.4 |
| Off-policy distill, 4× Lao + Thai | 3,834 Lao + 989 Thai (`Kimi-K3.1-Pro`) | **44.3** | 100% | **47.8** |
| Teacher (`Kimi-K3.1-Pro`) | — | 47.5 | 100% | 49.9 |

The 4× mixed distilled student reached **93% of teacher chrF++** (44.3 vs. 47.5), closed **92% of the base-to-teacher gap** (`(44.3 − 5.5) / (47.5 − 5.5) = 0.92`), achieved 65.7 round-trip adequacy with 100% Lao script, and improved Thai translation above the base checkpoint (`46.7 → 47.8`).

### Six Generalizable Engineering Lessons

1. **Monitor adjacent-skill interference and co-train retention slices.** SFT on 945 human Lao references raised Lao to 44.7 chrF++ within 25 steps but collapsed Thai from **46.7 to 5.3 chrF++** (`0%` Thai script): the adapter learned an unconditional "output Lao on translation prompts" rule. Lao-only teacher distillation slowed the degradation (holding for two epochs before slipping to 44.3 in epoch 3, with 17/300 Thai answers emitted in Lao). Mixing ~1,000 (`989`) teacher Thai translations eliminated the regression entirely (`47.8` chrF++). Evaluating only the target slice would have selected the Thai-destroying control run as optimal.
2. **Fresh teacher data dominates additional training epochs.** Across the four Lao runs, cross-entropy dropped by more than 50% at each epoch boundary as the model memorized seen rows, whereas held-out 300-sentence chrF++ moved by only `−1` to `+3` points. Expanding the Lao set 4× via 3,000 English Wikipedia sentences reached 43.2 chrF++ after a **single epoch**, outperforming three epochs on the smaller Lao + Thai mixture (41.3).
3. **Single-teacher trajectories exhibit lower target variance than multi-translator human references.** On identical FLORES `dev` prompts, student assistant-token cross-entropy started at **0.36 nats/token** on `Kimi-K3.1-Pro` outputs versus **0.54 nats/token** on human references (finishing at `0.06` vs. `0.16`), reflecting the stylistic consistency of a single teacher distribution relative to a heterogeneous pool of human translators.
4. **Disable teacher reasoning tokens on non-reasoning tasks.** Enabling `Kimi-K3.1-Pro`'s thinking mode *degraded* 300-sentence Lao translation quality (`43.5` vs. `47.3` chrF++) while consuming roughly `8×` more output tokens (compared to ~175 output tokens per sentence with thinking disabled).
5. **Apply deterministic pre-filtering before SFT.** Dropping teacher outputs whose characters were `<70%` target script or echoed the English source removed **4%** of raw `Kimi-K3.1-Pro` Lao generations prior to training at negligible cost.
6. **Audit per-slice failure modes when consolidating multiple skills.** Training a single `r = 64` adapter on 8,871 teacher translations spanning five languages (Lao, Northern Sotho, Yoruba, Zulu, plus Thai retention; 831 steps, 1.5 epochs, 1.04M assistant tokens) closed **87%** (Lao), **85%** (Northern Sotho: `32.7 → 48.0` vs. `50.7`), and **71%** (Yoruba: `20.7 → 25.7` vs. `27.7`) of the teacher gap while improving Thai (`46.7 → 48.0`), yet closed only **12%** on Zulu (`37.7 → 39.2` vs. `50.3`) due to `1%–2%` repetition loops—demonstrating that aggregate multi-task gains can mask localized decoding regressions.

:::insight
**Methodological rule.** Before launching distillation, screen on a small diagnostic slice (e.g., 50 examples per capability) and distinguish semantic deficits from formatting or routing errors. When cross-family tokenizer mismatches preclude OPD, text-only off-policy distillation remains highly effective provided the training mixture explicitly pairs scalable fresh teacher data with retention data for the closest confusable skills.
:::
