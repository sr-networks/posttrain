# Production Post-Training Playbook & Field Learnings

This playbook distills the recurring operational lessons from audited 2025–2026 production teams (**Coinbase, Cursor, Harvey, Baseten, Intercom, Cognition, Mercor/SkyRL, Thinking Machines, Databricks**) combined with hard-won hands-on experimental field notes from real multi-turn RL and LoRA/MiCA runs.

---

## The 10 Non-Negotiable Rules of Industrial Post-Training

### 1. Prove Value with a Frontier API & Optimize the Harness First
Never start a project by spinning up GPUs. First validate the business KPI in production using a frontier API (as **Coinbase** did with its online A/B fraud test). Next, optimize your code, tool definitions, and harness architecture before touching model weights:
- **Harness-1** proved that offloading deterministic bookkeeping (deduplication, candidate pools, context compaction) into code lets a 20B model beat GPT-5.4.
- Fix broken tool schemas, prompt ambiguity, and noisy tool payloads first—post-training cannot compensate for a broken tool harness.

### 2. "Look at the Effing Data!"
Before scaling any SFT, iSFT, or RL run, manually inspect at least **20–50 raw rollouts**, including system prompts, exact tool responses, rubric verdicts, and failure modes.
- Build a lightweight **Case / Rollout Reader** (or inspect W&B rollout tables split cleanly by system prompt, trajectory, final answer, and judge rationale).
- Half of all "flat RL curves" are instantly diagnosed within 10 minutes of reading actual transcripts (e.g., malformed tool JSON, truncated answers, `<|endoftext|>` firing mid-turn, or a judge misreading the prompt).

### 3. Build, Audit, and Freeze Your Eval & Grader Before Training
Your evaluation pipeline is your steering wheel. Bad evals produce illusory "gains" that collapse in production:
- **Never reuse an eval split for checkpoint selection**—keep a strict, untouched final holdout alongside your validation split.
- **Check for train/eval leakage & overlap** automatically (even 2 overlapping cases in a 100-case eval skew small-sample deltas).
- **Measure judge noise & inter-run agreement:** Run your LLM judge multiple times on a calibration set; compute **paired standard errors** ($\pm\text{SE}$) on every benchmark delta. If your gain is `+2.0 ± 1.1` while response length doubled, you may have only trained verbosity!
- **Distrust LLM-generated deterministic rewards:** Auto-generated regex/keyword scripts silently mis-score valid paraphrases or reward gaming—audit every deterministic rule on real failures.

### 4. Start Small and Prove Learning on an Overfit Job First
Always debug your entire training stack on a **small model (1.5B–9B)** before paying for 27B–35B+ compute. Before launching a full dataset run, execute Mercor/SkyRL's golden **3-step smoke test**:
1. **Verify exact token capture** (rollout token IDs match trainer input IDs 1-to-1).
2. **Verify sampler-vs-trainer logprob alignment** (step-0 KL gap near zero).
3. **Run an overfit job on 8–16 tasks** repeated over multiple updates. Reward **must** climb cleanly within minutes/hours. If it does not overfit on 16 cases, your reward signal, masking, or gradient wiring is broken—raising compute or data size will only burn money.

:::field
**Field Learning — Step Dose vs. Compute Allocation:** If an update takes 10+ minutes on your cluster and you only get 15–20 updates per allocation, an overly timid LR (e.g. `1e-6`) won't move the policy enough to diagnose learning. Verify weight-norm delta per step and prove learning on the small overfit job first!
:::

### 5. No Vibe-Coded RL Trainers — Use Battle-Tested Frameworks
Custom ad-hoc RL loops routinely harbor silent, catastrophic bugs (wrong advantage masking on prompt/tool tokens, mismatched logprob alignment, unclipped importance ratios, missing KV cache invalidation).
- Use established, actively maintained stacks: **`verl`**, **`SkyRL`**, **`PrimeRL + Verifiers`**, **`OpenPipe ART`**, **`Unsloth`**, **`Hugging Face TRL`**, or **`Tinker`**.
- Configure every hyperparameter explicitly and log every run's exact config, seed, base checkpoint, and git SHA.

### 6. Preserve Raw Token IDs (Token-In, Token-Out) & Thinking Consistency
One of the most common multi-turn RL bugs is re-applying `tokenizer.apply_chat_template()` to the entire conversation history on each turn.
- Round-tripping text through parsers and chat templates subtly alters whitespace tokens, tool-call tags, or `<think>` blocks—breaking alignment between the rollout engine's stored logprobs and the trainer's forward pass.
- **Best Practice:** Store and train on the **exact token IDs** emitted by the rollout engine (and mask out user/tool observation tokens from the loss).
- **Thinking Blocks in Multi-Turn RL:** You do *not* have to turn thinking off. On models like `Qwen3.8`, use `enable_thinking` and `preserve_thinking` (or separate per-turn histories as in `ART`) consistently across rollouts, training, and eval—and verify whether you intend to apply gradients to thinking tokens or final answer tokens.

### 7. Control Rollout Sampling, Caps, and Loss Normalization
- **Sampling Constraints:** Pure unconstrained sampling (`top_p=1.0, top_k=-1`) can induce multilingual drift (stray CJK tokens / word salad) during RL on Qwen-family models. Use clean model-recommended decoding bounds (e.g., `top_p=0.95, top_k=20`) while tracking policy entropy.
- **Length & Turn Caps:** Artificial caps that truncate legitimate multi-turn reasoning inject noisy zero rewards. If you must cap context (e.g., `32K` packing), ensure 95%+ of valid trajectories complete comfortably inside the cap, and explicitly handle premature `<|endoftext|>` turns cleanly without crashing the batch.
- **Token-Sum vs. Rollout-Normalized Loss:** Summing loss across all tokens rewards longer responses disproportionately. Prefer token-level normalization (DAPO-style) or explicit length penalties (Harvey Tenet) so your model gets *smarter and tighter*, not bloated.

### 8. Balance Multi-Component Rewards & Watch FP8 Sampler–Trainer Drift
- **Decouple Multi-Rewards:** Never blindly add per-turn shaping rewards (e.g., search hits) to sparse outcome rewards without checking their variance ratio. Use **GDPO** (decoupled per-component group normalization) or scale shaping weights down so outcome correctness remains the primary driver.
- **Watch FP8 / vLLM Kernel Gaps:** FP8 matmuls via vLLM kernels deliver huge speedups (e.g., ~1.8× faster at 57K context with ~0.9995 LoRA gradient cosine similarity to BF16), *but* always verify that the sampler-vs-trainer KL gap isn't silently widening; keep a BF16 control run whenever stability looks suspicious.
- **CUDA Graph Warm-Up Optimization:** Warm up compilation/CUDA graphs at the single longest sequence length instead of sweeping a dozen intermediate buckets—easily saving 25–30 minutes per job start.

### 9. Engineer for Retention, Abstention & Enterprise Compliance
A post-trained small model that gains +8% on your domain benchmark while losing 15% on general instruction following or hallucinating on unanswerable edge cases will fail production rollout.
- Always run a **5-benchmark retention suite** alongside your vertical eval.
- Include explicit **abstention / escalation / disambiguation** examples in both training and eval (the Intercom Fin Apex & regulated-AI lesson).
- For multi-task fleets, prefer **separate task LoRAs + SLERP merging** or **dynamic multi-LoRA serving on vLLM** over cramming unrelated business units into one monolithic fine-tune.

### 10. Choose the Simplest Method That Clears the Business Bar
Never use RL when SFT clears the bar; never use SFT when prompt + harness clears the bar.

| Starting State | Recommended First Move | Upgrade Path If It Plateaus |
| --- | --- | --- |
| Prototype / <100k calls/mo / changing specs | **Frontier API + Strong Harness + Evals** | Collect production logs & build ground-truth eval |
| Bounded high-volume task (classification, tagging, extraction, routing) | **Teacher Distillation + LoRA SFT (4B–8B)** | Add Medusa speculative decoding & multi-LoRA vLLM |
| Long-context structured generation (clinical notes, legal memos) | **Iterative SFT / iSFT (14B–32B)** with frontier rubric repair | Add Rubric RL (GRPO/GSPO) + Rubric Dropout |
| Multi-turn tool/search agent with verifiable outcomes (fraud, SQL, code, email) | **Multi-Turn GRPO / DAPO / SkyRL (8B–35B-A3B)** | Add RL → Distill → RL (SWE-grep pattern) |
| You have a strong open-weight teacher (235B+) and want a cheap fast student (8B–32B) | **Cross-Model On-Policy Distillation (OPD)** | Follow with short targeted RL on edge cases |
| Millions of daily live accept/reject product interactions | **Online Policy-Gradient RL** (Cursor Tab pattern) | Automate shadow evals & hourly/daily promotion |
