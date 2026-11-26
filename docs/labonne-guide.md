# Modern Post-Training Pipeline Guide (after Maxime Labonne, 2026)

A practical technical synthesis distilled from *Post-Training Is Where Models Are Made Now* ([YouTube](https://www.youtube.com/watch?v=tZQIE-oY2s0), [Spotify](https://open.spotify.com/episode/0a71unrDXYJhWowxijviWN), [Apple Podcasts](https://podcasts.apple.com/in/podcast/post-training-is-where-models-are-made-now-maxime-labonne/id1834616211?i=1000802388007&l=pa); *The Information Bottleneck*, Nov 16, 2026, hosted by Ravid Shwartz Ziv and Allen Roush), featuring **Maxime Labonne** (Head of Post-Training at Liquid AI and author of the open-source *LLM Course*), complemented by Liquid AI's documented `LFM2` post-training recipe ([arXiv:2511.23404](https://arxiv.org/abs/2511.23404)).

> **Central thesis.** Pre-training establishes raw statistical world knowledge, but post-training determines whether a model is reliable, controllable, and deployable. In modern pipelines, **SFT and distillation expand `pass@k` coverage, whereas reinforcement learning sharpens that distribution into `pass@1` reliability**.

---

## 1. The `pass@k` vs. `pass@1` Mental Model

A recurring mistake in industrial post-training is applying reinforcement learning to a base model whose solution probability on the target task is near zero, or expecting supervised fine-tuning alone to deliver reliable single-shot execution.

| Stage | Primary Distributional Effect | Information per Sequence | Operational Role |
| --- | --- | --- | --- |
| **SFT & Distillation** | Raises **`pass@k`** (expands support so valid solution paths exist in the model's sampling distribution) | High ($\mathcal{O}(1)$ bits per token) | Establishes chat/tool formatting, injects domain reasoning paths, and seeds new skills |
| **Preference Optimization** | Re-ranks stylistic and behavioral modes; suppresses verbosity | Moderate (sequence-pair contrast) | Aligns conciseness, formatting discipline, and refusal boundaries |
| **Reinforcement Learning (RLVR)** | Sharpens **`pass@k` $\to$ `pass@1`** (concentrates probability mass on winning trajectories) | Low (~1 bit per long rollout) | Converts latent capability into consistent first-attempt accuracy and tool efficiency |
| **Multi-Domain OPD (MOPD) / Merging** | Consolidates multiple specialist policies into one unified student without interference | High (per-token reverse KL or weight interpolation) | Combines code, math, instruction, and agent experts into a single deployable checkpoint |

Even when a long RL rollout provides roughly a single binary bit of terminal outcome feedback, RL succeeds *provided* the earlier SFT/distillation stages have already placed valid reasoning trajectories within the policy's reachable sampling distribution.

---

## 2. The Four-Stage Post-Training Sequence

Stage ordering is not interchangeable. Skipping foundational stages or collapsing multi-domain RL into a single monolithic run causes exploration failure, reward hacking, or cross-domain interference.

### Stage 1: Supervised Fine-Tuning (Why SFT Cannot Be Skipped)
- **Formatting and interface compliance:** SFT remains mandatory to lock in conversation templates, structured JSON/tool-call syntax, and baseline instruction following before running rollouts.
- **Data quality over volume:** Curate demonstrations for accuracy, task diversity, and reasoning depth rather than raw token count.
- **Role in small models:** On compact 350M–8B checkpoints (such as Liquid AI's hybrid convolution + grouped-query attention `LFM2` family), SFT supplies the structural scaffolding that small capacities struggle to discover purely through random RL exploration.

### Stage 2: Length-Normalized Preference Optimization
- **Why standard preference tuning drifts:** Unnormalized preference losses (such as vanilla DPO) accumulate log-probability sums across sequence length, inadvertently rewarding verbose padding.
- **Practical safeguard (`LFM2` recipe):** Apply **length-normalized preference optimization** over mixed student-generated and teacher-guided rollouts to align helpfulness and adherence without inflating output token counts—a critical constraint for latency-sensitive edge and local models.

### Stage 3: Reinforcement Learning Inside the Target Harness
- **Train inside the real harness:** Rather than training small models on disembodied static prompts and wrapping them in tools afterward, execute RL rollouts **directly inside the agent's production harness** (exact tool definitions, parsers, error messages, and context limits).
- **Verifiable rewards first:** Use deterministic execution rewards (unit tests, compilers, schema checks, database state diffs) wherever available to suppress repetitive "doom loops" and teach multi-turn error recovery.
- **Sharpening to `pass@1`:** RL turns a model that occasionally solves a multi-step agent task in 8 attempts into one that solves it cleanly on the first attempt with fewer wasted tool calls.

### Stage 4: Multi-Domain Consolidation (MOPD vs. Model Merging)
Training a single model simultaneously via joint RL across competing domains (mathematics, software engineering, general chat, tool execution) routinely triggers negative interference. Modern post-training decouples **capability creation** from **capability integration**:

1. **Train parallel domain specialists:** Optimize separate domain teachers (e.g., a code specialist, a math specialist, an agentic tool specialist) independently from a shared base checkpoint.
2. **Consolidate via Multi-Domain On-Policy Distillation (MOPD):** Sample on-policy rollouts from a single unified student model $\pi_\theta$, route each prompt to its domain-matched teacher $\pi_T$, and apply dense token-level reverse-KL updates ($\log \pi_T(y_t) - \log \pi_\theta(y_t)$).
3. **Compute-constrained alternative (Iterative Model Merging):** When online multi-teacher distillation exceeds GPU budgets, iterative parameter-space merging (`Model Soup`, `Task Arithmetic`, `TIES`, `DARE`, `DELLA` via `mergekit`) compounds gains across specialized checkpoints at near-zero training compute.

:::warning
**MOPD caveats (late-2026 literature).** While MOPD preserves specialist capabilities more faithfully than joint multi-task RL, it requires substantially more GPU-hours than training-free merging and can suffer from cross-domain gradient imbalance unless teacher advantages are normalized per domain (*DN-MOPD*).
:::

---

## 3. Small Models and Local Agentic Execution

A central theme of Labonne's work at Liquid AI is shifting routine workloads from metered cloud frontier APIs to **compact, locally executed models** (ranging from sub-1 GB / 350M–1.2B edge models up to ~8B workstation models):

- **Architectural efficiency:** Hybrid backbones combining gated short convolutions with grouped-query attention (`LFM2`) reduce KV-cache and prefill overhead on memory-bound local hardware compared to pure Transformers.
- **Harness-native specialization:** Small models succeed as enterprise and local agents when post-trained inside narrow, deterministic harnesses—matching the empirical pattern documented across this compendium ([Airbnb 2B](../case-studies/airbnb-2b-policy-classifier/), [Shopify Sidekick](../case-studies/shopify-sidekick-task-experts/), [Cisco Antares 1B–3B](../case-studies/cisco-antares-security-slms/), and [Coinbase 9B](../case-studies/coinbase-fraud-agent/)).

---

## 4. Failure Modes and Ecosystem Observations

- **Why heavily post-trained models write worse prose:** Aggressive alignment, rubric optimization, and RLHF/RLVR sharpening narrow output entropy. While improving benchmark `pass@1` and safety compliance, over-alignment collapses stylistic diversity into repetitive, formulaic phrasing. Preserving natural writing quality requires deliberate stylistic diversity in SFT/preference mixtures and avoiding overly rigid reward templates.
- **Skepticism toward standalone "RL environment" vendors:** Generic third-party RL environments often fail to capture the messy schemas, telemetry, and edge cases of real production deployments. Owning proprietary operational traces and internal evaluation harnesses creates far stronger defensibility than buying generic synthetic gyms.
- **Where smaller teams can compete with frontier labs:** Competing on general-purpose pre-training is capital-prohibitive, but nimble teams can outperform large labs in **bounded vertical niches** by combining open-weight base checkpoints, high-signal domain traces, harness-native RL/OPD, and iterative merging.

---

## 5. Episode Chapter Map (Nov 16, 2026)

| Timestamp | Segment |
| --- | --- |
| `0:00` – `3:44` | Introduction and why post-training accounts for an increasing share of model quality |
| `3:44` – `7:20` | Historical progression: SFT $\to$ RLHF/DPO $\to$ RLVR $\to$ On-Policy Distillation |
| `7:20` – `19:41` | Modern pipeline mechanics: non-skippable SFT, stage ordering, `pass@k` vs. `pass@1`, and MOPD |
| `19:41` – `27:15` | Training small models inside agent harnesses, open-source RL stacks, and local vs. cloud inference |
| `27:15` – `38:26` | Prose degradation in over-aligned models, safety incentives, and regulatory dynamics |
| `38:26` – `49:16` | Open-weight ecosystem, Chinese open models, recursive self-improvement, and startups vs. hyperscalers |
| `49:16` – `1:02:23` | Overrated trends (generic RL environment companies), world models, European AI, and closing remarks |
