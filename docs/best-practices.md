# Experimental Protocol and Engineering Guidelines

This section summarizes ten methodological practices derived from published industrial post-training studies (2025–2026) and controlled diagnostic experiments on multi-turn reinforcement learning and parameter-efficient fine-tuning.

---

## 1. Validate Task Utility and Optimize the Harness Prior to Weight Updates

Before allocating GPU compute, establish an operational baseline using a frontier model API (e.g., Coinbase's online A/B evaluation of transaction risk) and eliminate structural bottlenecks in the execution harness:
- **Externalize deterministic bookkeeping.** *Harness-1* (*arXiv:2606.02373*) demonstrated that moving document deduplication, candidate tracking, and budget-aware context rendering from model prompts into environment code allowed a 20B policy to exceed GPT-5.4 on multi-hop retrieval recall (0.730 vs. 0.709).
- **Pre-training signal verification.** Following Shwartz Ziv (2026), extract candidate rules or skills from production traces and evaluate them *in-context* first; measurable improvement in-context confirms that the trace corpus contains learnable task information prior to training.

## 2. Manual Trajectory Inspection

Quantitative metrics obscure failure mechanisms. Prior to scaling any SFT, iSFT, or RL experiment, inspect 20–50 raw rollouts end-to-end—including rendered system prompts, tool-call payloads, premature stop tokens (`<|endoftext|>`), and per-criterion judge rationales. Most flat learning curves originate from data or harness defects (malformed tool schemas, truncated contexts, or mis-specified rubric prompts) rather than optimizer hyperparameters.

## 3. Evaluation Hygiene and Judge Calibration

- **Strict split separation.** Maintain three disjoint sets: training, development (for hyperparameter and checkpoint selection), and an untouched final holdout. Reusing holdout pools for checkpoint selection introduces selection bias on small domain benchmarks.
- **Automated decontamination.** Run exact and near-duplicate overlap checks between training tasks and evaluation splits prior to training.
- **Uncertainty quantification.** Report **paired standard errors** ($\pm\mathrm{SE}$) on all benchmark deltas, and measure inter-run judge agreement on a fixed calibration subset. If a benchmark improves by $+2.0 \pm 1.1$ points while mean output length doubles, the policy may be exploiting judge verbosity bias rather than improving domain reasoning.
- **Audit deterministic reward rules.** Programmatic regex or citation matchers generated automatically by LLMs frequently mis-score valid formatting variants (e.g., grouped statute citations or case-sensitivity differences); validate every deterministic parser against real transcripts.

## 4. Small-Model Smoke Testing and Overfit Verification

Debug data pipelines and reward wiring on a compact model (1.5B–9B) before launching 27B–35B jobs. Following the diagnostic sequence documented by Mercor and SkyRL (2026), execute three checks before full-dataset training:
1. **Token-ID identity:** Verify that rollout token IDs match trainer input IDs exactly.
2. **Step-0 log-probability parity:** Confirm near-zero initial divergence between inference-engine and trainer log-probabilities.
3. **Small-batch memorization test:** Train repeatedly on 8–16 representative cases. Training reward should rise monotonically within a single short allocation; failure to overfit a tiny batch indicates a broken reward signal, loss mask, or learning-rate scale rather than insufficient data.

:::field
**Step size under wall-clock constraints.** When multi-turn rollouts require 10+ minutes per update and cluster allocations permit only 15–20 updates, excessively conservative learning rates (e.g., $10^{-6}$ on LoRA adapters) yield negligible weight movement. Track adapter weight-norm deltas per step alongside training reward.
:::

## 5. Rely on Validated Training Frameworks

Custom reinforcement-learning loops are prone to subtle implementation errors—including unmasked loss over prompt or tool-observation tokens, unclipped importance ratios, and stale KV-cache state. Prefer maintained, audited implementations (`verl`, `SkyRL`, `PrimeRL + Verifiers`, `OpenPipe ART`, `Unsloth`, `Hugging Face TRL`, or `Tinker`) with explicit, version-controlled configuration files.

## 6. Preserve Exact Token IDs Across Multi-Turn Histories

Re-tokenizing conversation transcripts via `apply_chat_template()` at intermediate turns can modify whitespace tokenization or alter `<think>...</think>` blocks, creating silent mismatches between stored rollout log-probabilities and trainer forward passes.
- Pass raw generated token IDs and explicit assistant-turn masks directly from the rollout engine to the trainer (*token-in, token-out*).
- Maintain identical thinking-mode flags (`enable_thinking`, `preserve_thinking`) across rollout sampling, training, and evaluation.

## 7. Decoding Constraints, Context Limits, and Loss Normalization

- **Bounded rollout sampling.** Purely unconstrained sampling (`temperature = 1.0, top_p = 1.0, top_k = -1`) can induce out-of-vocabulary or cross-lingual token drift on open-weight bases; apply moderate model-appropriate bounds (e.g., `top_p = 0.95, top_k = 20`) while monitoring policy entropy.
- **Context and turn ceilings.** Set sequence and turn limits wide enough that $>95\%$ of valid trajectories terminate naturally; map truncated or premature-EOS rollouts cleanly to zero reward without aborting the batch.
- **Token-level vs. sequence-level normalization.** Normalize policy-gradient loss carefully (e.g., DAPO token-level normalization) and monitor response length at every checkpoint to prevent length inflation.

## 8. Multi-Reward Balancing and Mixed-Precision Verification

- **Decoupled reward normalization.** When combining accuracy rubrics with auxiliary search or formatting terms, normalize components independently (`GDPO`, *arXiv:2601.05242*) so high-variance intermediate terms do not dominate terminal outcome advantages.
- **Precision parity.** FP8 inference kernels substantially increase rollout throughput at long contexts (e.g., $1.8\times$ speedup at 57K tokens), but sampler–trainer KL divergence must be monitored continuously; maintain a BF16 or FP16 reference run when diagnosing instability.
- **Compilation warm-up.** Pre-warming CUDA graphs only at the maximum configured sequence bucket rather than across all intermediate buckets eliminates 25–30 minutes of startup overhead per job.

## 9. Retention Suites and Calibrated Abstention

Evaluate every domain-adapted checkpoint on a general retention suite (instruction following, reasoning, and general QA) alongside the target domain benchmark. In regulated or customer-facing applications, explicitly include unanswerable and ambiguous test instances to verify calibrated abstention and escalation behavior.

## 10. Escalate Methodological Complexity Minimally

| Operational Regime | Primary Baseline Method | Escalation Path if Baseline Plateaus |
| --- | --- | --- |
| Low volume ($<10^5$ calls/month) or shifting task specification | Frontier model API + harness engineering + evaluation suite | Accumulate production traces and audit baseline failure modes |
| High-volume single-turn classification, tagging, or schema extraction | Teacher sequence distillation + LoRA SFT (4B–8B) | Speculative decoding (Medusa/EAGLE) and multi-LoRA serving |
| Long-context structured document synthesis (clinical, legal) | Iterative SFT (iSFT, 14B–32B) with frontier rubric repair | Rubric-based GRPO/GSPO with ProRubric gates and Rubric Dropout |
| Multi-turn search or tool workflows with verifiable outcomes | Multi-turn GRPO / DAPO / GSPO (8B–35B-A3B) | Two-stage RL → student distillation → efficiency RL (`SWE-grep` pattern) |
| Strong open-weight teacher available (100B+) for same-tokenizer student | Cross-model On-Policy Distillation (OPD, 4B–32B) | Short targeted RL stage on residual failure cases |
| Continuous high-frequency implicit user feedback ($>10^6$ events/day) | Online policy-gradient RL (`Cursor Tab` paradigm) | Automated shadow evaluation gates for continuous deployment |
