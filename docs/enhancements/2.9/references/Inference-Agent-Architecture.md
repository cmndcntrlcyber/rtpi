# Qwen3.5-9B dominates the local Claude replacement landscape on RTX 5060 Ti

**Qwen3.5-9B, released March 2, 2026, is the clear winner for a single-GPU local Claude replacement.** Its hybrid Gated DeltaNet architecture slashes KV cache memory by ~75% compared to standard transformers, enabling **262K native context** on just 16GB of VRAM. It outperforms models 3× its size (Qwen3-30B) on agentic benchmarks, scores **66.1 on BFCL-V4** for tool calling, and runs at ~50+ tokens/sec on RTX 5060 Ti at Q4_K_M. The user's preference for smaller models at higher quantization is well-founded: Qwen3.5-9B at **Q6_K (7.46GB)** delivers near-lossless quality with massive context headroom, beating any 14B model forced to Q4. For intensive code generation in compiled languages, a hot-swap to **Qwen2.5-Coder-14B-Instruct at Q4_K_M** remains the strongest option. Deploy via **vLLM nightly** with Qwen-Agent for MCP integration — avoid Ollama for tool calling due to known template bugs.

---

## Ranked model recommendations with deployment configurations

### Tier 1: Primary recommendation

**Qwen3.5-9B at Q6_K** is the optimal single-model configuration. Its hybrid architecture — 24 linear attention layers (Gated DeltaNet) plus 8 full attention layers — means only **25% of layers maintain growing KV cache**. The linear layers use fixed-size recurrent state (~12MB total), while traditional KV cache grows only for 8 layers instead of 32. This architectural innovation makes the 9B model behave like a ~3B model for memory scaling at long contexts.

| Config | Weights | Available VRAM | Est. Context (FP16 KV) | Est. Context (FP8 KV) |
|--------|---------|---------------|----------------------|---------------------|
| **Q6_K (recommended)** | **7.46 GB** | **~7.5 GB** | **~80K tokens** | **~160K+ tokens** |
| Q8_0 (max quality) | 9.53 GB | ~5.5 GB | ~55K tokens | ~110K+ tokens |
| Q5_K_M (balanced) | 6.58 GB | ~8.4 GB | ~90K+ tokens | ~180K+ tokens |
| Q4_K_M (max context) | 5.68 GB | ~9.3 GB | ~100K+ tokens | ~200K+ tokens |

Context estimates assume ~1GB system/CUDA overhead and account for the reduced KV cache footprint of the hybrid architecture (only 8 layers with growing KV cache vs 32 for a standard 9B model). The effective KV cache cost per token is roughly **0.035 MB** at FP16 — about **4× more efficient** than a standard transformer of equal size.

### Tier 2: Specialized coding model (hot-swap)

**Qwen2.5-Coder-14B-Instruct at Q4_K_M (8.99GB)** remains the strongest option for pure code generation, especially for compiled languages like Rust, C++, and Go. Trained on **5.5 trillion tokens** with a 70% code ratio across **92 programming languages**, it surpasses CodeStral-22B and DeepSeek-Coder-33B on most coding benchmarks. At Q4_K_M, it leaves ~6GB for KV cache, enabling roughly **16K-32K context** with quantized KV cache — sufficient for most code generation tasks.

### Tier 3: Niche specialists (swap on demand)

**Strand-Rust-Coder-14B-v1** deserves consideration only if Rust development dominates the workload. Built on Qwen2.5-Coder-14B with LoRA fine-tuning on **191,008 verified Rust examples** from 2,383 crates, it shows +19% improvement on Rust hold-out benchmarks. Task-specific gains are dramatic: test generation jumps from 0% to 51%, API usage prediction from 27% to 71%. The caveat: benchmarks are self-reported, and the model explicitly trades off multi-language performance.

### Models eliminated from consideration

Several models from the user's list proved unsuitable. **Kimi-VL-A3B-Thinking** has 16B total parameters despite only 2.8B active, requiring ~24GB VRAM minimum — and it's a vision-language model with no code generation benchmarks. **DeepSeek-Coder-V2-Lite** suffers the same MoE problem: 16B total params make GGUF files 10-17GB regardless of sparse activation. **Phi-4-reasoning-vision-15B** has strong mathematical reasoning (approaching DeepSeek-R1 on AIME) but a crippling **16K context limit** and zero tool-calling support — fatal for agentic workflows. The **TeichAI Qwen3-14B-Claude-distill** is a community finetune trained on just $52 worth of data (~2M tokens) with no published benchmarks and mixed community feedback.

---

## Why Qwen3.5-9B beats 14B models at Q4 quantization

The user's intuition about smaller models at higher quantization is validated by the data. Quantization quality degrades non-linearly: Q4_K_M introduces measurable perplexity loss, while **Q6_K is near-lossless** for most tasks. A Qwen3.5-9B at Q6_K (7.46GB) delivers better effective quality than a 14B model at Q4_K_M (8.99GB), while using **1.5GB less VRAM**.

The Qwen3 technical report confirms that **Qwen3-8B-Base outperforms Qwen2.5-14B-Base on 9 of 15 benchmarks**, with particularly strong advantages in STEM and coding (EvalPlus: 67.65 vs 60.70, MATH: 60.80 vs 55.64, GPQA: 44.44 vs 32.83). Qwen3.5-9B extends this further — scoring **81.7 on GPQA Diamond** and **82.5 on MMLU-Pro**, beating even GPT-OSS-120B. The generational architecture improvements (hybrid attention, 36T training tokens for Qwen3, 201 languages for Qwen3.5) compound with the quantization advantage.

One important exception: **pure code generation in compiled languages** still favors the 14B specialist. Qwen2.5-Coder-14B's dedicated training on 5.5T code tokens with 92-language coverage gives it an edge that generational improvements in general models haven't fully closed. For Rust/C++/Go heavy lifting, the 14B coder at Q4_K_M remains superior to the 9B generalist at Q6_K.

---

## Throughput estimates on RTX 5060 Ti 16GB

The RTX 5060 Ti delivers **448 GB/s memory bandwidth** from GDDR7 on a 128-bit bus — a 56% increase over the RTX 4060 Ti's 288 GB/s. Hardware Corner benchmarks (llama-bench, CUDA 12.8) provide concrete numbers for this exact GPU:

| Model | Quant | 16K ctx | 32K ctx | Notes |
|-------|-------|---------|---------|-------|
| Qwen3-8B | Q4_K | **51.4 t/s** | **38.9 t/s** | Measured on RTX 5060 Ti |
| Qwen3-14B | Q4_K | **32.9 t/s** | **25.9 t/s** | Measured on RTX 5060 Ti |
| gpt-oss-20B (MoE) | Q4_K | **82.4 t/s** | **73.2 t/s** | MoE advantage |

Qwen3.5-9B throughput is harder to pin down since it wasn't in those benchmarks, but three factors suggest it will **match or exceed** Qwen3-8B speeds. Multi-Token Prediction (MTP) enables speculative decoding natively, yielding **3-5× decoding speedup** in favorable conditions. The Gated DeltaNet linear attention layers are computationally cheaper than full attention. Artificial Analysis reports **90.1 t/s median** across cloud providers for Qwen3.5-9B.

Expected performance for Qwen3.5-9B on RTX 5060 Ti:

| Quantization | Est. Generation Speed | Est. Prefill Speed | Context Range |
|---|---|---|---|
| Q4_K_M | ~50-65 t/s (with MTP) | ~500-1500 t/s | Up to 200K+ |
| Q5_K_M | ~45-55 t/s | ~400-1200 t/s | Up to 180K+ |
| Q6_K | ~40-50 t/s | ~350-1000 t/s | Up to 160K+ |
| Q8_0 | ~30-40 t/s | ~300-800 t/s | Up to 110K+ |

The RTX 5060 Ti offers the **best price-to-performance ratio** at $8.36 per token/sec — cheaper than the RTX 5070 Ti ($8.56) and far better than the RTX 4060 Ti ($11.92). The 128-bit bus remains the bottleneck; memory bandwidth is the dominant constraint for autoregressive decoding.

---

## Framework and deployment stack recommendation

### vLLM nightly is the recommended inference engine

For agentic workloads requiring tool calling and structured output, **vLLM nightly** is the correct choice despite requiring a source build for RTX 5060 Ti (sm_120 Blackwell compute capability). The deployment command:

```bash
vllm serve Qwen/Qwen3.5-9B \
  --port 8000 \
  --tensor-parallel-size 1 \
  --max-model-len 131072 \
  --reasoning-parser qwen3 \
  --enable-auto-tool-choice \
  --tool-call-parser qwen3_coder \
  --language-model-only \
  --speculative-config '{"method":"qwen3_next_mtp","num_speculative_tokens":2}'
```

Key flags: `--language-model-only` skips the vision encoder to save ~1GB VRAM (add it back when vision is needed for website debugging). `--reasoning-parser qwen3` handles thinking/non-thinking mode. `--tool-call-parser qwen3_coder` uses the correct XML-format tool calling that Qwen3.5 was trained on. MTP speculative decoding improves single-request latency.

For GGUF quantized models specifically, **use vLLM with official GPTQ-Int4** rather than GGUF — vLLM's GGUF support remains experimental. Alternatively, use llama.cpp/Ollama for GGUF models with the understanding that **Ollama's tool calling for Qwen3.5 is currently broken** (template mismatch bug in Ollama issue #14493).

### Qwen-Agent provides the MCP bridge

**Qwen-Agent** is the recommended agent framework. It natively supports MCP protocol, connects to any OpenAI-compatible API (vLLM endpoint), and handles tool-calling template parsing internally. Configuration is straightforward:

```python
from qwen_agent.agents import Assistant

llm_cfg = {
    'model': 'Qwen/Qwen3.5-9B',
    'model_server': 'http://localhost:8000/v1',
    'api_key': 'EMPTY',
}

tools = [
    {'mcpServers': {
        'filesystem': {'command': 'npx', 'args': ['-y', '@modelcontextprotocol/server-filesystem', '/workspace']},
        'fetch': {'command': 'uvx', 'args': ['mcp-server-fetch']},
    }},
    'code_interpreter',
]

agent = Assistant(llm=llm_cfg, function_list=tools)
```

When using Qwen-Agent with vLLM, **do not** add `--enable-auto-tool-choice` — Qwen-Agent handles tool parsing internally. Only use vLLM's built-in parser for direct API access without Qwen-Agent.

### Alternative: llama.cpp for maximum simplicity

If tool calling isn't the primary concern, **Ollama (llama.cpp)** offers zero-config deployment: `ollama run qwen3.5:9b`. Measured at **51.4 t/s for Qwen3-8B Q4_K on RTX 5060 Ti**, it's the simplest path to fast inference. Use this for interactive coding assistance where you manually copy-paste results rather than relying on automated tool calling.

---

## Single-model versus multi-model pipeline analysis

**A single Qwen3.5-9B handles 85-90% of the target use cases adequately.** Its native tool calling covers operations management and task orchestration. Its **65.6 LiveCodeBench** score handles most code generation. The 262K context window enables large codebase analysis. Native multimodal support enables website debugging with screenshots.

The remaining 10-15% — complex multi-file Rust/C++/Go code generation — benefits from hot-swapping to **Qwen2.5-Coder-14B-Instruct at Q4_K_M**. Model swapping on a single GPU takes **3-10 seconds** depending on storage speed (NVMe recommended). With Ollama's keep-alive management or vLLM model routing, this is practical for non-latency-critical coding tasks.

A concurrent dual-model setup is marginally feasible: Qwen3.5-9B at Q4_K_M (5.68GB) + Qwen2.5-Coder-7B at Q4_K_M (4.68GB) = **10.36GB**, leaving ~4.6GB for KV cache. This limits context to roughly 8-16K tokens per model — tight but workable for short coding tasks alongside orchestration. However, the complexity overhead of routing requests to the right model rarely justifies the reduced context window. **The single-model approach with occasional hot-swapping is the pragmatic choice.**

---

## VRAM budget breakdown for all viable configurations

| Configuration | Weights | KV Cache Budget | Max Context | Throughput | Best For |
|---|---|---|---|---|---|
| **Qwen3.5-9B Q6_K** ★ | 7.46 GB | 7.5 GB | ~160K (FP8 KV) | ~40-50 t/s | Primary all-purpose |
| Qwen3.5-9B Q8_0 | 9.53 GB | 5.5 GB | ~110K (FP8 KV) | ~30-40 t/s | Maximum quality |
| Qwen3.5-9B Q5_K_M | 6.58 GB | 8.4 GB | ~180K (FP8 KV) | ~45-55 t/s | Quality + context balance |
| Qwen3.5-9B Q4_K_M | 5.68 GB | 9.3 GB | ~200K+ (FP8 KV) | ~50-65 t/s | Maximum context/speed |
| **Qwen2.5-Coder-14B Q4_K_M** ★ | 8.99 GB | 6.0 GB | ~32K (Q8 KV) | ~33 t/s | Compiled-language coding |
| Qwen2.5-Coder-14B Q5_K_M | 10.5 GB | 4.5 GB | ~16K (Q8 KV) | ~28 t/s | Higher-quality coding |
| Qwen3-8B Q8_0 | 8.71 GB | 6.3 GB | ~45K (FP16 KV) | ~40 t/s | Stable fallback |
| Strand-Rust-Coder-14B Q4_K_M | 8.99 GB | 6.0 GB | ~32K (Q8 KV) | ~33 t/s | Rust-only workloads |

★ = Recommended configurations

---

## Benchmark comparison across all target use cases

The following table maps each use case to the best model and supporting benchmark evidence:

| Use Case | Best Model | Key Benchmark | Score | Runner-Up |
|---|---|---|---|---|
| **Operations/orchestration** | Qwen3.5-9B | BFCL-V4 | 66.1 | Qwen3-8B (~60 est.) |
| **Tool use / MCP** | Qwen3.5-9B | TAU2-Bench | 79.1 | Qwen3-8B (native FC) |
| **Code gen (Python/JS)** | Qwen3.5-9B | LiveCodeBench v6 | 65.6 | Qwen2.5-Coder-14B |
| **Code gen (Rust/C++/Go)** | Qwen2.5-Coder-14B | MultiPL-E | SOTA at 14B | Strand-Rust-14B (Rust only) |
| **Structured output** | Qwen3.5-9B | IFEval | 91.5 | Qwen3-8B |
| **Website debugging** | Qwen3.5-9B | ScreenSpot Pro | 65.2 | Phi-4-reasoning-vision |
| **Long-context analysis** | Qwen3.5-9B | LongBench v2 | 55.2 | Qwen2.5-14B-1M (not practical) |
| **Mathematical reasoning** | Qwen3.5-9B | GPQA Diamond | 81.7 | Phi-4-reasoning (but 16K limit) |

Qwen3.5-9B wins or ties on 6 of 8 categories. The only clear exception is compiled-language code generation, where specialized training data matters more than architecture improvements. For Rust specifically, Strand-Rust-Coder's 48% on its hold-out set versus the base model's 29% is compelling — but remember these are self-reported benchmarks on a proprietary evaluation suite.

---

## What this setup cannot replace about Claude

Even the best local 9B model has meaningful limitations against frontier models. **SWE-bench Verified** scores illustrate the gap: frontier models achieve 65-80% while no published 7-14B model has competitive results. Complex multi-file refactoring, nuanced architectural decisions, and unfamiliar API integration remain areas where a 9B model will produce noticeably inferior output. The practical mitigation is using thinking mode for complex tasks (trading latency for quality) and maintaining a cloud API fallback for the hardest 5-10% of tasks. The local model handles the high-volume routine work — drafting functions, running tool calls, managing workflows, parsing outputs — while reserving cloud calls for genuinely difficult reasoning that exceeds local model capacity.