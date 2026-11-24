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
