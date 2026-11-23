# Supervised Fine-Tuning (SFT) & Iterative SFT

Supervised Fine-Tuning (SFT) remains the **fastest, cheapest, and most predictable workhorse** for industrial small and midsize models (3B–35B)—when used for the right job. In 2025–2026 production systems, SFT is no longer treated as a magic bullet for open-ended reasoning, but rather as (1) a **high-ROI direct solution** for bounded classification, extraction, formatting, and tool-schema compliance, and (2) an essential **cold-start and iterative repair stage** alongside RL and distillation.

---

## 1. Where SFT Delivers Real Business Value (and Where It Plateaus)

The well-known empirical rule **"SFT memorizes, RL generalizes"** (*Chu et al., 2025*) is directionally true—but modern industry practice adds two critical nuances:

1. **For bounded, high-volume tasks, SFT is often all you need.** Checkr fine-tuned `Llama-3-8B` on background-check taxonomies to match GPT-4 at **30× speed and 5× lower cost**. Financial and retail teams fine-tuning 3.8B–8B models routinely beat zero-shot GPT-4o (~96% vs. ~80%) on strict internal schemas because frontier models over-think or drift from rigid taxonomies.
2. **Distribution-matched SFT generalizes far better than naive SFT.** Recent work (*Finetuning with Sampling*, 2026) and Baseten's **Iterative SFT (iSFT)** prove that much of SFT's weakness comes from training on *off-distribution* teacher prose rather than *repaired on-distribution* student outputs.

:::insight
**Rule of Thumb:** If your task is single-turn or tightly structured (JSON extraction, routing, tagging, clinical note templates, boilerplate synthesis) and you can produce 1,000–25,000 verified gold outputs, **start with LoRA SFT or iSFT before touching RL**.
:::

---

## 2. Iterative SFT (iSFT): The Highest-Leverage 2026 SFT Recipe

Standard SFT distilled from frontier outputs hits a hard ceiling (e.g., **52%–56%** normalized accuracy on Baseten's 25,000-token clinical scribe transcripts) because even frontier generators make subtle omissions and formatting errors on long domain inputs.

**Iterative SFT (iSFT)**—proven in production by **Baseten (Medical Scribes, Qwen3-32B)** and **Harvey (Compaction Agent, Qwen3.5-27B)**—inverts the role of the frontier model:

1. **Generate:** Run the student model (e.g., 27B–32B) on real enterprise inputs.
2. **Grade with Dense Rubrics:** Score each draft using a strong frontier model (e.g., Gemini-2.5-Pro or Claude with clinician/lawyer-crafted rubrics) rather than asking the frontier model to write from scratch.
3. **Repair Until 100% Passing:** Feed the rubric failure reasons back into a repair pass (typically **1–2 repair rounds**) until the draft passes every rubric item cleanly.
4. **Train on Clean Targets:** Run SFT strictly on the repaired, passing pairs $(x \to y^*)$.

| Metric | Standard Distilled SFT (25k examples) | Iterative SFT / iSFT (25k examples) |
| --- | --- | --- |
| Normalized Clinical Note Accuracy (Qwen3-32B) | 52% – 56% (plateau) | **66% – 78%** |
| Compute Cost vs. Full Online RL | Lowest | **Much cheaper & more stable than RL** |
| Primary Bottleneck | Teacher generation noise | **Grader / rubric reliability** |

:::field
**Why iSFT Works So Well:** Frontier models are significantly more reliable as *rubric verifiers and targeted editors* than as one-shot gold generators. Repairing the student's own drafts keeps training targets close to the student's output distribution while eliminating bad habits before gradient updates.
:::

---

## 3. Parameter-Efficient Fine-Tuning: LoRA, QLoRA, and Base+Merge

For small and midsize models (4B–35B), **LoRA is the default industry choice**—not merely to save VRAM, but to curb catastrophic forgetting (*LoRA Learns Less and Forgets Less*, 2024).

### Practical Hyperparameter Findings (2025–2026)

- **Apply LoRA to all linear layers, not just `q_proj`/`v_proj`.** John Schulman's *LoRA Without Regret* (Thinking Machines, 2025) showed that MLP + attention LoRA adapters match full fine-tuning across RL and small-to-medium SFT regimes, while attention-only LoRA underperforms.
- **Sweep the learning rate before trying exotic PEFT variants.** *Learning Rate Matters: Vanilla LoRA May Suffice* (2026) showed that many novel PEFT variants only beat vanilla LoRA because the baseline LR was under-tuned. Typical LoRA LRs are **5×–10× higher** than full-FT LRs (`5e-5` to `3e-4`, sometimes up to `5e-4` for narrow SFT).
- **Match LoRA rank to task complexity:**
  - Narrow classification / routing / RL policy updates: `r = 16–64` is usually plenty (policy gradients carry fewer bits per episode than SFT).
  - Long-context structured generation (e.g., Baseten Medical Scribes 25k context): higher rank (`r = 128–256`, `alpha = 32` or `alpha = r`, `dropout = 0`) prevents underfitting.
- **Shadow-FT & Base+Merge Restoration:** Fine-tuning the **Base** model and grafting the original Instruct delta back (`Base + task_adapter + (Instruct - Base)`)—explored in *Shadow-FT* (2025) and practical MiCA/LoRA experiments—can substantially outperform direct Instruct fine-tuning on tool-use benchmarks while preserving general retention benchmarks.
- **Modular Multi-Expert LoRA + SLERP Merging:** When an enterprise needs conflicting skills (e.g., strict JSON tool calling + open-ended summarization + domain compliance), train separate specialist LoRA adapters and merge them via **two-stage SLERP** rather than mixing all objectives into one fragile run.

---

## 4. Avoiding SFT's Biggest Enterprise Failure Modes

### The Hallucination Tax of Injecting New Facts via SFT
Research (*Does Fine-Tuning LLMs on New Knowledge Encourage Hallucinations?*, 2024; *Unfamiliar Finetuning Examples Control How Language Models Hallucinate*, 2024) proves a critical enterprise trap: **naive SFT on facts the base model did not already know teaches the model to guess confidently rather than retrieve or abstain.**

- **Use RAG / Search / Harness State** for volatile facts, live policies, and document-level provenance.
- **Use SFT** to teach *skills, style, schemas, tool protocols, compaction, and calibrated abstention*.
- **Use Mid-Training / Continual Pre-Training Blending** (e.g., Amazon Nova Forge style) or **Contextual Self-Distillation** (MixSD / Engram self-study) if you genuinely need deep static corpus internalization without destroying general capabilities.

### Disambiguation & Abstention Supervision
In enterprise tool calling and regulated verticals (Intercom Fin Apex, banking, healthcare), the costliest error is acting on an ambiguous prompt or guessing when evidence is missing.

- **Disambiguation-Centric Fine-Tuning** (*arXiv:2507.03336*): Explicitly include ambiguous enterprise requests paired with concise clarifying questions in your SFT mix.
- **Explicit Abstention Training:** Pair answerable examples with unanswerable/missing-context examples whose target output is a clean refusal or escalation—and always measure both **True Positive Rate** (answers when evidence exists) and **False Positive Rate** (guesses when evidence is absent), not just accuracy on answerable splits.

:::warning
**Rejection-Sampling SFT Caution:** Filtering a model's own rollouts for SFT (Rejection Sampling / RFT) only works if the base model already solves a healthy fraction of tasks cleanly and your filter is high-precision. In noisy legal/rubric settings, naive rejection-sampling SFT frequently produces **zero measurable gain** on held-out sets—switch to iSFT (with explicit repair) or online GRPO/GSPO instead.
:::

---

## 5. Production SFT Checklist

1. **Audit data diversity & decontamination first** — check for train/eval overlap before running a single step.
2. **Start with 500–2,000 ultra-clean expert or iSFT-repaired traces** rather than 50,000 noisy scraped examples.
3. **Include 5%–15% general instruction/retention replay** (or use LoRA + SLERP / Shadow-FT) and evaluate on a retention suite alongside your domain metric.
4. **Verify your exact chat template and special tokens** (`<|endoftext|>`, tool schemas, thinking delimiters) match production vLLM/SGLang serving byte-for-byte.
5. **Respect 2026 Teacher Licensing & ToS** — major closed API providers strictly police distillation extraction; prefer open-weight teachers (`Qwen3`, `GLM-5`, `Llama-3`) or human-in-the-loop iSFT repair pipelines for commercial weights.
