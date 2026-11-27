## What the chart measures

We fine-tuned Qwen2.5-7B-Instruct to produce tool calls on [ToolAlpaca](https://arxiv.org/abs/2306.05301). The horizontal axis shows accuracy on the released questions, which were held out from training. The vertical axis shows average accuracy on five general benchmarks we use to measure how much of the model’s prior capability it retains. Each filled marker is one run. The open diamond marks unadapted Instruct.

## What MiCA changes

[MiCA](https://arxiv.org/abs/2604.01694) stands for Minor Component Adaptation. A weight matrix amplifies some directions more strongly than others. Singular value decomposition identifies those directions and tells us how strongly the matrix acts along each one. MiCA confines its updates to directions associated with small singular values, where the pretrained matrix has less effect. The idea is that these less-used directions can support new behavior while leaving the model’s dominant transformations intact. That gives us a plausible reason why MiCA can learn a new task while retaining more of what it already does well.

Standard MiCA applies this constraint on the output side. Paired MiCA constrains both the input and output sides and trains a small matrix between the two subspaces. It shares the two-sided protection idea with [Subspace Tuning (SST)](https://arxiv.org/abs/2610.22293).

**What “direct” means.** Direct MiCA starts from the Instruct checkpoint. In the original paper, we trained on the base model and applied the learned update to Instruct. The two approaches gave similar results in our eight-seed ToolAlpaca comparison.

## What we found

Across eight seeds, paired MiCA matched LoRA at **68.43% ToolAlpaca accuracy** while losing **about half as much** on the general benchmarks. Standard MiCA came close to LoRA on the new task and also retained more. In a separate matched-seed comparison, a smaller MiCA adapter matched full fine-tuning on ToolAlpaca and kept retention closer to the unadapted model.

## How rank affects the trade-off

Larger markers show higher adapter ranks. In one MiCA comparison at a fixed learning rate, increasing rank improved tool accuracy and slightly reduced retention. Rank gives us a way to explore the trade-off, and the learning rate matters too. Engram also found that LoRA’s capacity grows with rank, using likelihood to estimate learning and forgetting. [Predicting LoRA size for any dataset](https://engram.com/blog/lora-size)

A setting sits on the Pareto frontier when no other tested setting for that method improves one outcome while matching or improving the other. The shared grid is still in progress. Replicating promising settings across seeds will help show which retention gains hold up.
