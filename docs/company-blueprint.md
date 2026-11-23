# Inside-a-Company Post-Training Blueprint (Ravid Shwartz Ziv)

A practical, step-by-step sequence for deciding **whether, when, and how to post-train models inside a company**, distilled from [Ravid Shwartz Ziv's (@ziv_ravid) November 19, 2026 thread](https://x.com/ziv_ravid/status/2123537747348791582).

> **Core Thesis:** *"In the end most of the time goes to evaluation and data, and the training itself is the easy part. Good luck, and don't let the model fool you!"*

---

## 1. The 7-Stage Inside-a-Company Sequence

| Stage | Key Question | Concrete Action |
| --- | --- | --- |
| **1. Business Case** | Why not just send everything to OpenAI? | Proceed only if at least one holds: **cheaper**, **faster**, **data must stay in-house**, or **proprietary data beats generic models** on your task. |
| **2. Evaluation First** | What do we care about and how do we measure it? | Spend most of your upfront time here. Keep a small **regression/holdout set** aside to verify you didn't break existing behavior. |
| **3. Real Production Traces** | What data actually matters? | Start with a **few hundred real production tasks** (user sessions, agent runs, tool calls). Inspect them **manually** to build intuition; unlabeled or sparse outcome labels are enough. |
| **4. Zero-Training Signal Check** | Is there learnable signal in our data at all? | **Distill traces into in-context skills** (manually or automatically), give them to an existing model, and rerun eval. If eval improves → green light to train weights. |
| **5. Error-Driven Iteration** | How do we improve after the first run? | Train → inspect eval failures → find missing or noisy traces → clean & fix → repeat. **Cleaning data usually beats tuning hyperparameters.** |
| **6. Right-Size the Model** | Do we even need a giant general LLM? | Use a **classifier + text encoder** for classification; use **small specialized agentic/vision models** for narrow workflows. If you need a general LLM, **start around ~30B** (runs on a single GPU with LoRA). |
| **7. Method Escalation Ladder** | Which post-training technique first? | Climb from simplest to hardest: **Skill Distillation (in-context)** → **SFT** → **Model Distillation** → **RL** — then layer serving optimizations (**quantization, routing, pruning, caching**). |

---

## 2. Deep Dive on the Highest-Leverage Ideas

### Why Bother at All? (The Four Valid Enterprise Triggers)
Post-training encompasses everything done to adapt a model's behavior (fine-tuning, distillation, RL). Before writing any training script, validate that your project actually solves one of four concrete business problems rather than chasing hype:
1. **Cost:** Frontier API bills break unit economics at scale.
2. **Latency:** Real-time product UX demands faster execution.
3. **Data Residency / Privacy:** Sensitive data cannot leave your VPC or on-prem infrastructure.
4. **Domain Superiority:** Your proprietary production traces contain patterns that let a specialized model outperform general-purpose APIs.

### The Zero-Training Pre-Check: Distillation into Skills
:::insight
**High-Value Pre-Training Gate (Posts 7–8):** Before spinning up GPUs, extract a set of concise **skills / rules / playbooks** from your real production traces (manually or with an LLM), put them into an existing model's prompt context, and re-run your evaluation.
- **If the score jumps:** That proves your traces contain concrete domain knowledge the model is missing — a strong green light to bake that signal into model weights.
- **If the score stays flat:** Pause and re-audit your data or eval before burning training budget.
:::

This directly echoes our site's **"Harness & Memory First, Weights Second"** rule (see [Field Playbook](../best-practices/) and [Harness-1](../case-studies/harness-1-search-agent/)): prove signal in context before paying for gradient updates.

### Data Strategy: Real Traces Beat Synthetic Guesswork
- **Start small and manual:** A **few hundred real production tasks** inspected by hand teach you far more than tens of thousands of uninspected synthetic rows.
- **Prefer live operational traces:** User sessions, agent runs, and tool-call logs capture real edge cases—even when **unlabeled** or carrying only **sparse end-of-session labels** (no per-step labels required).
- **Protect a regression set:** Keep a small, untouched holdout dataset aside strictly to confirm that post-training did not break core capabilities.
- **Iterate on data before hyperparameters:** After training, inspect *where* the model fails on eval, diagnose which trace categories are missing or noisy, clean the dataset, and retrain.

### Model Choice: Avoid Over-Buying Parameters
- **Classification ≠ LLM:** If your workload is fundamentally classification or routing, a dedicated **classification model** or a **classifier paired with a text encoder** is often faster, cheaper, and more reliable than a generative LLM.
- **Task-Specialized Small Models:** Dedicated small models for **agentic tool-use** and **vision** are improving rapidly and excel when an agent has a bounded tool/task scope.
- **The ~30B Starting Anchor for LLMs:** When you genuinely need a generative LLM, starting around **30B parameters** (e.g., `Qwen3-32B`, `Qwen3.5-27B`, or `Qwen3.6-35B-A3B`) hits a pragmatic sweet spot—it still runs on a **single high-VRAM GPU** and supports **LoRA** efficiently.

### The Method Escalation Ladder
Climb only as far up the complexity ladder as your evaluation demands:
1. **Skill Distillation (In-Context):** Simplest & zero GPU training — also doubles as your data-signal test.
2. **Supervised Fine-Tuning (SFT / LoRA):** Next step once skill distillation proves signal and you need lower latency, cheaper tokens, or stronger compliance.
3. **Model Distillation (Off-Policy KD / On-Policy Distillation):** Compress stronger teacher behavior into a compact student model.
4. **Reinforcement Learning (RL):** Highest flexibility for multi-turn agentic optimization, efficiency, and surpassing teacher ceilings.
5. **Serving Stack Multipliers:** Layer **quantization**, **routing**, **pruning**, and **caching** on top once weights hit target quality.

---

## 3. How This Connects to Our Audited Case Studies

| Ravid Shwartz Ziv Principle | Validated Production Case Study on This Hub |
| --- | --- |
| *"Why not OpenAI: cheaper, faster, privacy, better on your data"* | [Coinbase Fraud Agent (9B)](../case-studies/coinbase-fraud-agent/) (+9.6% F1 vs. Opus 4.5, −55% latency) & [Intercom Fin Apex](../case-studies/intercom-fin-apex/) |
| *"Traces with sparse or no labels are enough"* | [Databricks TAO](../case-studies/databricks-tao/) (unlabeled enterprise SQL/DocQA logs) & [Cursor Tab Online RL](../case-studies/cursor-tab-online-rl/) |
| *"Start around 30B — runs on 1 GPU with LoRA"* | [Baseten Medical Scribes (Qwen3-32B LoRA iSFT)](../case-studies/baseten-medical-scribes-isft/) & [Harvey Legal Suite (27B / 35B-A3B)](../case-studies/harvey-legal-agent-suite/) |
| *"Small specialized agentic models for bounded tasks"* | [Cognition SWE-grep](../case-studies/cognition-swe-grep/) (>2,800 tok/s) & [NVIDIA ToolOrchestra (8B)](../case-studies/nvidia-toolorchestra/) |
| *"Cleaning data beats hyperparameter tuning"* | [Baseten iSFT](../case-studies/baseten-medical-scribes-isft/) (+14–22 pts from repaired data) & [Mercor APEX-Agents](../case-studies/mercor-apex-and-nova-forge/) (<1,000–2,000 expert tasks) |

---

## 4. Original 14-Post Thread Index (Nov 19, 2026)

1. **Intro & Scope** — Structuring inside-a-company post-training in order: why bother, how to measure, which data, which model. ([Post 1](https://x.com/ziv_ravid/status/2123537747348791582))
2. **Definition** — Post-training is everything you do to adapt a model's behavior (fine-tuning, distillation, RL, etc.). ([Post 2](https://x.com/ziv_ravid/status/2123537749731049581))
3. **Why Not Just OpenAI?** — Four valid triggers: cheaper, faster, data must stay with you, or your data yields better task performance. ([Post 3](https://x.com/ziv_ravid/status/2123537751815680195))
4. **Evaluation Is #1** — Decide what to measure and how; spend most of your time here. ([Post 4](https://x.com/ziv_ravid/status/2123537753396674729))
5. **Start With Real Production Tasks** — Collect a few hundred real production tasks and inspect them manually to build intuition for good vs. bad outcomes. ([Post 5](https://x.com/ziv_ravid/status/2123537754843738405))
6. **Production Traces & Regression Holdout** — Real user sessions, agent runs, and tool calls work even unlabeled or with sparse labels; always keep a small regression set aside. ([Post 6](https://x.com/ziv_ravid/status/2123537756206850407))
7. **Zero-Training Signal Test (Skill Distillation)** — Extract skills from traces, inject them in-context into an existing model, and re-run eval. ([Post 7](https://x.com/ziv_ravid/status/2123537758430118362))
8. **Go / No-Go Decision** — If in-context skills improve eval, your data contains learnable signal worth training on; if not, be skeptical before training. ([Post 8](https://x.com/ziv_ravid/status/2123537760019509586))
9. **Error-Driven Data Iteration** — Train → analyze eval failures → identify missing or noisy traces → fix → repeat; data cleaning usually beats hyperparameter tuning. ([Post 9](https://x.com/ziv_ravid/status/2123537761332326767))
10. **Non-LLM Alternatives** — Don't default to a general LLM; for classification, consider dedicated classifiers or text encoders + classifiers. ([Post 10](https://x.com/ziv_ravid/status/2123537763379384688))
11. **Small Specialized Agentic & Vision Models** — Bounded agentic workflows can be handed to fast, specialized small models. ([Post 11](https://x.com/ziv_ravid/status/2123537765795320215))
12. **LLM Starting Size (~30B)** — If you need a general LLM, start around 30B: runs on a single GPU and works cleanly with LoRA. ([Post 12](https://x.com/ziv_ravid/status/2123537767258902993))
13. **Complexity Ladder & Inference Stack** — Skill distillation (simplest) → SFT → Model Distillation → RL, plus quantization, routing, pruning, and caching. ([Post 13](https://x.com/ziv_ravid/status/2123537768915550580))
14. **Closing Takeaway** — Most effort belongs in evaluation and data; training itself is the easy part — don't let the model fool you. ([Post 14](https://x.com/ziv_ravid/status/2123537771008806920))
