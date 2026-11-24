# Supervised Fine-Tuning and Iterative Refinement

Supervised fine-tuning (SFT) minimizes token-level cross-entropy loss over curated demonstration trajectories. For small and midsize open-weight models (3B–35B parameters), SFT serves two distinct roles in industrial pipelines: (i) direct task adaptation for bounded, single-turn tasks with well-defined output schemas, and (ii) cold-start initialization or iterative trajectory repair prior to reinforcement learning.

---

## 1. Generalization Properties and Task Scope

Comparative studies of post-training regimes indicate that off-policy SFT primarily anchors output formatting and in-distribution behavior, whereas on-policy reinforcement learning improves out-of-distribution (OOD) generalization (*Chu et al., 2025*). Two empirical qualifications refine this distinction in applied settings:

1. **Bounded classification and structured extraction.** When the target distribution is narrow and stationary—such as taxonomy classification, routing, or strict JSON argument generation—parameter-efficient SFT on 4B–8B models frequently matches or exceeds zero-shot frontier models at substantially lower latency and inference cost. General-purpose models often underperform on rigid corporate schemas due to prompt sensitivity rather than reasoning deficits.
2. **Distribution alignment of demonstrations.** Recent work (*Finetuning with Sampling*, 2026) and iterative repair protocols show that much of SFT's apparent generalization gap stems from training on *off-distribution* teacher prose rather than trajectories close to the student policy's own distribution.

:::insight
**Remark.** For single-turn tasks with deterministic output constraints (classification, entity extraction, clinical or legal template population) where $10^3$–$10^4$ verified reference outputs can be constructed, LoRA SFT or iterative SFT provides a lower-variance baseline than reinforcement learning.
:::

---

## 2. Iterative Supervised Fine-Tuning (iSFT)

Direct sequence distillation from a frontier model often plateaus on long-context domain tasks because zero-shot teacher generations still contain subtle omissions and schema violations. On 25,000-token clinical transcripts, Baseten reported that standard distilled SFT on `Qwen3-32B` plateaued at 52%–56% normalized rubric accuracy.

**Iterative SFT (iSFT)**—documented in clinical scribing (*Baseten, 2026*) and context-compaction agents (*Harvey, 2026*)—uses a frontier model as an evaluator and editor rather than as a zero-shot generator:

1. **Draft generation.** Sample a candidate output from the student model on a domain input $x$.
2. **Rubric evaluation.** Score the draft against domain-specific binary criteria using a frontier model.
3. **Targeted repair.** Condition a repair pass on the failed rubric items (typically 1–2 iterations) until all criteria are satisfied, producing a verified target $y^*$.
4. **Supervised update.** Fine-tune the student strictly on passing pairs $(x, y^*)$.

| Regime (Qwen3-32B, $N = 25{,}000$) | Normalized Accuracy | Primary Limiting Factor |
| --- | --- | --- |
| Standard teacher-distilled SFT | 52% – 56% | Zero-shot teacher omissions on long contexts |
| Iterative SFT (iSFT) | 66% – 78% | Specificity and consistency of the grading rubric |

:::field
**Empirical observation.** Frontier models exhibit lower error rates when verifying atomic criteria and editing localized defects than when generating long-form domain documents from scratch. Repairing student-generated drafts also keeps $(x, y^*)$ closer to the student's output distribution, reducing exposure shift.
:::

---

## 3. Parameter-Efficient Adaptation (LoRA and Model Merging)

Low-rank adaptation (LoRA) is standard for 4B–35B adaptation both to reduce memory overhead and to regularize against catastrophic forgetting (*Biderman et al., 2024*).

### Empirical Configuration Guidelines

- **Module coverage.** Applying LoRA across all linear layers (attention projections and MLP blocks) matches full-parameter fine-tuning in reinforcement learning and small-to-medium SFT regimes, whereas attention-only adapters (`q_proj`, `v_proj`) systematically underperform (*Schulman, 2025*).
- **Learning-rate scaling.** Controlled ablations (*arXiv:2602.04998*) demonstrate that many proposed LoRA variants outperform vanilla LoRA primarily when baseline learning rates are under-tuned. Optimal LoRA learning rates are typically $5\times$–$10\times$ larger than full fine-tuning rates ($5 \times 10^{-5}$ to $3 \times 10^{-4}$).
- **Rank selection.** Low ranks ($r \in [16, 64]$) generally suffice for narrow classification and policy-gradient updates. Dense, long-context structured generation benefits from higher capacity (e.g., $r = 256, \alpha = 32$, zero dropout in Baseten's 32B clinical runs).
- **Base-model adaptation and delta grafting.** Fine-tuning the pretrained *Base* checkpoint and subsequently adding back the instruction-tuning weight delta (`Shadow-FT`, *arXiv:2505.12716*) can improve downstream tool-use accuracy relative to direct `Instruct` fine-tuning while preserving general retention benchmarks.
- **Modular adapters and SLERP.** When multiple enterprise objectives conflict (e.g., strict JSON function calling alongside open-ended prose synthesis), training separate specialist LoRA modules and interpolating weights via two-stage spherical linear interpolation (SLERP) reduces cross-task interference.

---

## 4. Hallucination Amplification and Abstention

Supervised fine-tuning on factual assertions absent from the model's pretraining corpus increases confident confabulation on unfamiliar inputs (*Gekhman et al., 2024*; *Kang et al., 2024*). During gradient descent on unfamiliar targets, the model learns to emit plausible-sounding specificity independent of internal epistemic support.

- **Separation of knowledge and skill.** Volatile or document-specific facts should remain externalized via retrieval or harness state; SFT should target procedural structure, formatting, compaction, and tool protocols.
- **Corpus integration.** When static domain corpora must be internalized parametrically, mid-training data blending (e.g., Amazon Nova Forge) or contextual self-distillation (`MixSD`, *arXiv:2605.16865*) degrades general reasoning less than late-stage SFT.
- **Disambiguation and abstention supervision.** In high-stakes workflows, training sets should include unanswerable prompts (paired with explicit abstention or escalation) and underspecified tool requests (*arXiv:2507.03336*). Evaluation should report both true positive rate (answering when evidence is present) and false positive rate (answering when evidence is absent).

:::warning
**Limitation of rejection-sampling SFT.** Filtering unedited student rollouts for SFT (`RFT` / `STaR`) requires non-trivial base pass rates and a low-noise verifier. When base pass rates are low or rubric verification is noisy, rejection-sampling SFT often yields statistically indistinguishable held-out performance; explicit draft repair (iSFT) or on-policy RL is generally required.
:::
