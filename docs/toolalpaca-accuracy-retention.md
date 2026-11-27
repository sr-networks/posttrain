## What the chart measures

We fine-tuned Qwen2.5-7B-Instruct to produce tool calls on [ToolAlpaca](https://arxiv.org/abs/2306.05301). The horizontal axis shows accuracy on the 97 released ToolAlpaca questions. The vertical axis shows mean accuracy on five general-capability benchmarks: HellaSwag, TruthfulQA-MC1, MMLU, IFEval, and WinoGrande. We use that average as a measure of retention relative to unadapted Instruct.

The chart includes direct [MiCA](https://arxiv.org/abs/2604.01694), direct LoRA, direct paired MiCA, and full fine-tuning. Standard MiCA constrains adapter updates along minor output directions. Paired MiCA constrains both the input and output sides and trains a small core between the two fixed subspaces. This shares the two-sided protection idea with [Subspace Tuning (SST)](https://arxiv.org/abs/2610.22293), which projects the full optimizer update and can refresh its protected basis during training.

Each filled marker is an individual run. Adapter marker sizes increase with rank. The open diamond marks unadapted Instruct.

## What the current results show

The strongest verified direct paired MiCA setting so far reached **68.43% released accuracy and 62.19% retention** across eight seeds. Direct LoRA reached the same observed mean accuracy, with **59.42% retention**. The best direct standard MiCA setting by released accuracy reached **68.17% accuracy and 61.44% retention**. Full fine-tuning reached **66.11% and 59.65%** at its current accuracy leader. Unadapted Instruct scored **41.24% and 65.24%**.

## Rank and the accuracy–retention frontier

Rank gives us one way to move along the accuracy–retention trade-off. Larger markers mean higher adapter ranks, so the scatter shows where that extra capacity helps. At learning rate `4e-4`, two epochs, alpha equal to rank, and seed 1001, increasing MiCA's rank from 32 to 128 raised ToolAlpaca accuracy from **65.98% to 70.10%** and lowered retention from **62.54% to 62.04%**. The direction and size of the change can depend on the learning rate.

The more interesting finding is how much MiCA can retain at the same task accuracy. On the same 3,932-example training split and seed 1001, direct MiCA at rank 32, alpha 32, and learning rate `2e-4` and full fine-tuning at `1e-5` both got **65 of 97 questions right (67.01%)** after two epochs. MiCA retained **63.39%**, compared with **59.48%** for full fine-tuning. Relative to the **65.24%** unadapted baseline, the measured retention loss was **1.85 percentage points** with MiCA and **5.76 points** with full fine-tuning. That is about **68% less measured forgetting at the same task accuracy** in this matched-seed comparison.

This point suggests that a smaller MiCA adapter can preserve most of the original benchmark performance while matching full fine-tuning on the target task. The full shared grid and additional seeds will help establish how consistently MiCA achieves this trade-off.

## How to read the trade-off

A setting is on a Pareto frontier if no other tested setting for that method scores at least as well on both axes and strictly better on one. The shared grid varies rank and learning rate at two epochs with alpha equal to rank, using the same training split and screening seed across the adapter methods. The grid was still in progress when this snapshot was published. Earlier points trained on a different split remain visible to show the range of observed outcomes.

The chart is exploratory. Replicating promising settings across seeds will show whether their retention advantages hold up. The current results describe this model, task, and evaluation setup.
