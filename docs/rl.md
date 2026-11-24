# Reinforcement Learning for Small and Midsize Models

Reinforcement learning (RL) optimizes a language model policy $\pi_\theta$ directly over trajectories sampled from the model itself. Unlike supervised fine-tuning—which conditions exclusively on expert prefixes—on-policy RL exposes the model to its own intermediate states, supports non-differentiable task objectives (latency, tool-call count, execution correctness), and exhibits lower catastrophic forgetting due to implicit proximity to the base distribution (*RL's Razor*, *arXiv:2509.04259*).

---

## 1. Policy-Optimization Algorithms (2024–2026)

For models up to 35B parameters, critic-free group-relative estimators have largely replaced Proximal Policy Optimization (PPO) in industrial practice by eliminating the memory and value-fitting overhead of a separate critic network.

| Algorithm | Estimator & Clipping Mechanism | Primary Domain Suitability | Known Failure Modes |
| --- | --- | --- | --- |
| **GRPO** (*Shao et al., 2024*) | Samples $G$ rollouts per prompt; standardizes rewards within the group as baseline. | General 7B–32B single- and multi-turn RLVR on 1–8 GPUs. | Length bias under sequence-averaged loss; zero gradient when all $G$ rollouts tie; entropy collapse under symmetric clipping. |
| **DAPO** (*Yu et al., 2025*) | Asymmetric upper clipping (`Clip-Higher`), dynamic filtering of zero-variance groups, token-level loss normalization, overlong reward shaping. | Multi-step code, search, and long-chain reasoning. | Additional rollout overhead when many prompts yield 0% or 100% pass rates. |
| **GSPO** (*Zheng et al., 2025*) | Computes and clips importance ratios at the whole-sequence level rather than per token. | Mixture-of-Experts (MoE) architectures (e.g., 35B-A3B) and long multi-turn trajectories. | Coarser credit assignment if trajectory variance is concentrated in single turns. |
| **CISPO** (*2025–2026*) | Clips importance-sampling weights directly within the policy-gradient objective. | Asynchronous and mildly off-policy training pipelines. | Sensitive to systematic log-probability drift between sampler and trainer. |
| **GDPO** (*Liu et al., 2026*) | Normalizes each reward component independently across the group prior to weighted summation. | Multi-objective enterprise RL combining accuracy, schema compliance, and cost penalties. | Requires sufficient group size $G$ for stable per-component variance estimates. |
| **PPO** (*Schulman et al., 2017*) | Clipped surrogate objective with learned value network and Generalized Advantage Estimation (GAE). | Long-horizon tasks with dense per-turn reward signals where value estimation is well-conditioned. | Roughly $2\times$ memory footprint; critic miscalibration early in training. |
| **DPO / SimPO** (*2023–2024*) | Offline contrastive objective over static `(chosen, rejected)` pairs. | Single-turn stylistic alignment, tone control, and safety refusals. | Off-policy distribution shift limits effectiveness on multi-turn tool use and reasoning. |

---

## 2. Reward Specification Across Verifiability Regimes

Empirical evaluations consistently show that reward signal-to-noise ratio governs RL performance more strongly than choice of policy-gradient variant.

### 2.1 Programmatically Verifiable Rewards (RLVR)
Where task correctness reduces to deterministic checks, RLVR provides unbiased, zero-variance supervision:
- **Execution checks:** Containerized unit tests (`DeepSWE`), SQL result-set equivalence (`Databricks TAO`), JSON schema and AST validation.
- **Information retrieval:** File- and line-level $F_1$ against ground-truth spans (`Cognition SWE-grep`), curated document recall (`Harness-1`).
- **Operational outcomes:** Confirmed chargeback/fraud labels (`Coinbase`, `Qwen3.5-9B`) and live user accept/dismiss telemetry (`Cursor Tab`).

### 2.2 Hybrid Deterministic and Semantic Rewards
For semi-structured enterprise extraction (e.g., `Harvey` review tables on `Qwen3.6-35B-A3B`), combining deterministic checks (schema validity, exact date/number formatting, verbatim substring presence of cited sentences) with an LLM judge (evaluating semantic support) reduces reward hacking compared to an unconstrained judge alone.

### 2.3 Non-Verifiable Domains and Reference-Guided Rubrics
In domains such as legal analysis, clinical documentation, and financial memos, correctness cannot be reduced to string matching even when an expert reference solution exists. Recent literature identifies four primary sources of degradation in rubric-based RL and corresponding mitigations:

1. **Judge stochasticity and implicit-inference bias.** Running an LLM judge with non-zero sampling temperature introduces noise often comparable in magnitude to within-group advantages ($\pm 0.10$). Furthermore, weak judges frequently credit implicit conclusions as explicit analytical steps (*arXiv:2605.12474*). Mitigations include greedy decoding (`temperature = 0`), log-probability scoring over binary tokens, and structured JSON schemas that enforce **verbatim evidence extraction** and gap analysis *prior* to emitting the final verdict token.
2. **Pointwise calibration drift vs. relative ranking.** Independent scalar scoring across rollouts suffers from scale saturation. Group-wise relative ranking (**OpenPipe RULER**, **Tournament-GRPO**, *arXiv:2605.26958*) compares candidate rollouts directly against one another (with randomized ordering to cancel positional bias), aligning supervision with GRPO's group-standardized objective.
3. **Additive compensation and verbosity hacking.** Under linear weighted sums, models learn to compensate for missing core prerequisites by generating exhaustive text that captures secondary checklist points. **ProRubric** (*arXiv:2609.38847*) replaces pure additive sums with conjunctive (`AND`) protocol gates and explicit negative pitfall penalties. **Rubric Dropout** (*arXiv:2608.11669*) randomly omits subsets of criteria during training steps to prevent surface-pattern memorization.
4. **Criterion saturation.** Static human weights allocate gradient signal inefficiently once easy criteria saturate at 100%. Policy-aware reweighting (**POW3R**, *arXiv:2605.20164*) weights criteria in proportion to empirical rollout contrast, accelerating convergence by $2.5\times$–$4\times$.

:::warning
**Multi-reward variance dominance.** When combining an auxiliary shaping term (e.g., per-turn search hit rate) with a sparse terminal outcome reward, differences in scale and variance can cause the auxiliary term (e.g., $-0.27$) to dominate the terminal advantage ($\pm 0.10$). Component magnitudes should be logged separately and normalized independently via **GDPO** (*arXiv:2601.05242*).
:::

---

## 3. Numerical and Systems Stability in Multi-Turn RL

### 3.1 Sampler–Trainer Numerical Divergence
Inference engines (`vLLM`, `SGLang`, FP8 kernels) and distributed training backends (`FSDP2`, `Megatron`, BF16) do not guarantee bitwise-identical log-probabilities (*When Speed Kills Stability*, 2025; *Microsoft AI Rocket*, 2026). Unchecked divergence destabilizes importance ratios over long runs.
- **Diagnostics and mitigations:** Log the step-0 KL divergence between rollout log-probabilities and trainer forward-pass log-probabilities; retain ratio clipping; apply off-policy **Score Centering** (*arXiv:2609.20807*); and validate FP8 pipelines against BF16 or FP16 baselines.

### 3.2 Token-ID Preservation Across Turns
Re-applying `apply_chat_template()` to decoded text histories at each turn of a multi-turn trajectory can alter boundary whitespace tokens or strip reasoning delimiters (`<think>...</think>`), invalidating stored rollout log-probabilities.
- **Token-in, token-out invariant:** Rollout workers should pass exact token-ID sequences and loss masks directly to the trainer. On hybrid-reasoning models (e.g., `Qwen3.8`), thinking blocks need not be disabled, provided `enable_thinking` and `preserve_thinking` flags match identically across rollout generation, gradient computation, and evaluation.

### 3.3 Decoding Bounds and Loss Normalization
- **Rollout sampling bounds:** Unconstrained sampling (`top_p = 1.0, top_k = -1`) on multilingual open-weight bases can trigger out-of-language token drift during early exploration. Moderately bounded sampling (e.g., `top_p = 0.95, top_k = 20`) preserves coherence while maintaining sufficient exploration entropy on high-entropy branching tokens (*arXiv:2506.01939*).
- **Sequence-length bias:** Summing token losses within a rollout weights longer completions more heavily, systematically inflating output length. Token-mean normalization (DAPO) or explicit within-group brevity bonuses counteract length inflation.
