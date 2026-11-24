# Industrial Post-Training Sequence (Notes after Shwartz Ziv, 2026)

A structured operational sequence for planning and executing model adaptation within an organization, synthesized from [Ravid Shwartz Ziv's November 19, 2026 thread](https://x.com/ziv_ravid/status/2123537747348791582).

> *"In the end most of the time goes to evaluation and data, and the training itself is the easy part."* — Ravid Shwartz Ziv (2026)

---

## 1. Seven-Stage Decision Sequence

| Stage | Core Question | Operational Criterion |
| --- | --- | --- |
| **1. Justification** | Why not route requests to a frontier API? | Require at least one concrete constraint: **lower unit cost**, **lower latency**, **on-premise data residency**, or **task accuracy gains from proprietary data**. |
| **2. Evaluation** | What metric defines task success? | Allocate primary engineering effort to evaluation design; reserve a held-out **regression subset** to detect capability degradation. |
| **3. Data Collection** | Which data sources reflect deployment conditions? | Collect **several hundred real production tasks** (user sessions, agent trajectories, tool logs) and inspect them manually; sparse or absent step labels are acceptable. |
| **4. In-Context Signal Test** | Does the trace corpus contain learnable signal? | Extract candidate **skills or heuristics** from traces, supply them *in-context* to an existing model, and re-evaluate. Improvement indicates learnable domain signal. |
| **5. Data-Centric Iteration** | How should errors be addressed post-training? | Train $\to$ inspect evaluation failures $\to$ identify missing or noisy trace slices $\to$ clean data $\to$ repeat. Data curation typically outweighs hyperparameter tuning. |
| **6. Architecture Selection** | What model class matches the problem structure? | Use **encoders + classifiers** for classification; **specialized compact models** for bounded agentic/vision tasks; **~30B LLMs with LoRA** (single GPU) when generative breadth is required. |
| **7. Method Escalation** | Which training and serving methods apply in order? | Progress from **in-context skill distillation** $\to$ **SFT** $\to$ **model distillation** $\to$ **RL**, complemented by quantization, routing, pruning, and caching. |

---

## 2. Methodological Analysis

### 2.1 Pre-Training Signal Verification via In-Context Skill Extraction
:::insight
**Zero-training diagnostic (Posts 7–8).** Before running gradient updates, summarize recurring patterns or corrective rules from production traces—either manually or via an LLM—and inject those rules into the prompt context of an off-the-shelf model.
- **Positive delta on evaluation:** Demonstrates that the trace dataset contains task-relevant information absent from the base model's prior, justifying parametric training.
- **Null delta on evaluation:** Suggests either insufficient signal in the collected traces or misalignment between the data and the evaluation metric, warranting data/eval revision prior to GPU expenditure.
:::

### 2.2 Trace Properties and Error-Driven Curation
- **Operational traces over synthetic prompts.** Logged user sessions, multi-step agent runs, and tool invocations capture true input distributions. Dense per-step annotations are unnecessary; unlabeled inputs or sparse terminal outcomes frequently suffice (cf. *Databricks TAO*, *Cursor Tab*).
- **Regression protection.** A dedicated holdout slice must remain untouched to verify that domain adaptation does not degrade baseline behaviors.
- **Iterative error analysis.** Post-training improvements follow an empirical loop: inspect failed evaluation instances, trace failures back to underrepresented or corrupted training slices, clean the corpus, and retrain.

### 2.3 Model Sizing and Non-Generative Alternatives
- **Task-matched architectures.** Classification workloads rarely require autoregressive decoding; combining text encoders with lightweight classification heads lowers latency and serving cost by orders of magnitude.
- **Bounded agentic specialists.** Compact models purpose-trained for restricted tool sets or visual subtasks can replace general-purpose frontier calls inside modular pipelines.
- **Single-GPU generative baseline (~30B).** When open-ended generative reasoning is required, models in the ~30B parameter class (e.g., `Qwen3-32B`, `Qwen3.5-27B`, `Qwen3.6-35B-A3B`) fit on a single high-memory GPU for inference and LoRA fine-tuning, offering a practical starting point before exploring multi-GPU training or extreme compression.

---

## 3. Correspondence with Documented Case Studies

| Principle (Shwartz Ziv, 2026) | Empirical Counterpart in This Compendium |
| --- | --- |
| Economic, latency, privacy, or domain-accuracy justification | [Coinbase Fraud Agent (`Qwen3.5-9B`)](../case-studies/coinbase-fraud-agent/) (+9.6% $F_1$, $-55\%$ latency) and [Intercom Fin Apex](../case-studies/intercom-fin-apex/) |
| Unlabeled or sparsely labeled operational traces | [Databricks TAO](../case-studies/databricks-tao/) (unlabeled SQL/DocQA logs) and [Cursor Tab Online RL](../case-studies/cursor-tab-online-rl/) |
| Single-GPU ~30B LoRA starting point | [Baseten Clinical Scribes (`Qwen3-32B` iSFT)](../case-studies/baseten-medical-scribes-isft/) and [Harvey Legal Agents (`27B` / `35B-A3B`)](../case-studies/harvey-legal-agent-suite/) |
| Specialized small models for bounded agentic subtasks | [Cognition `SWE-grep`](../case-studies/cognition-swe-grep/) and [NVIDIA `Nemotron-Orchestrator-8B`](../case-studies/nvidia-toolorchestra/) |
| Data cleaning and repair over hyperparameter sweeps | [Baseten iSFT](../case-studies/baseten-medical-scribes-isft/) (+14–22 pts from draft repair) and [Mercor APEX-Agents](../case-studies/mercor-apex-and-nova-forge/) |

---

## 4. Source Thread Index (Nov 19, 2026)

1. Scope: sequence for industrial post-training — motivation, measurement, data, and model selection ([Post 1](https://x.com/ziv_ravid/status/2123537747348791582)).
2. Definition: behavioral adaptation via fine-tuning, distillation, and RL ([Post 2](https://x.com/ziv_ravid/status/2123537749731049581)).
3. Four rationales over frontier APIs: cost, latency, data residency, and task performance ([Post 3](https://x.com/ziv_ravid/status/2123537751815680195)).
4. Centrality of evaluation design prior to modeling ([Post 4](https://x.com/ziv_ravid/status/2123537753396674729)).
5. Manual inspection of several hundred real production tasks ([Post 5](https://x.com/ziv_ravid/status/2123537754843738405)).
6. Utility of unlabeled or sparsely labeled operational traces plus a regression holdout ([Post 6](https://x.com/ziv_ravid/status/2123537756206850407)).
7. Pre-training check via in-context skill extraction from traces ([Post 7](https://x.com/ziv_ravid/status/2123537758430118362)).
8. Interpreting positive vs. null deltas from the in-context skill check ([Post 8](https://x.com/ziv_ravid/status/2123537760019509586)).
9. Iterative failure analysis and data cleaning over hyperparameter tuning ([Post 9](https://x.com/ziv_ravid/status/2123537761332326767)).
10. Selecting encoders/classifiers over generative LLMs for classification ([Post 10](https://x.com/ziv_ravid/status/2123537763379384688)).
11. Compact task-specialized models for bounded agentic and vision workflows ([Post 11](https://x.com/ziv_ravid/status/2123537765795320215)).
12. ~30B parameter single-GPU LoRA baseline for general LLM tasks ([Post 12](https://x.com/ziv_ravid/status/2123537767258902993)).
13. Method hierarchy (skill distillation $\to$ SFT $\to$ model distillation $\to$ RL) and inference optimizations ([Post 13](https://x.com/ziv_ravid/status/2123537768915550580)).
14. Summary: evaluation and data dominate engineering effort ([Post 14](https://x.com/ziv_ravid/status/2123537771008806920)).
