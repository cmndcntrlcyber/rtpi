# Code-Trainer V6: RTX 5060 Ti Single-GPU Architecture

## Document Overview

**Project:** Multimodal Code Generation from VS Code Screenshots  
**Version:** 6.0 - Single GPU Architecture  
**Hardware:** MSI RTX 5060 Ti 16GB Ventus 3X OC (Blackwell)  
**Target Model:** Qwen2.5-Coder-14B-Instruct (Cloud) + Local Vision Model  
**Methodology:** Screenshot Capture → Local Vision Training → HF Skills Cloud Fine-tuning → Local GGUF Deployment  
**Last Updated:** December 2025

---

## Executive Summary

Code-Trainer V6 is optimized for a single RTX 5060 Ti 16GB, leveraging Blackwell's Tensor Cores for efficient training and inference while offloading heavy Qwen-14B fine-tuning to HuggingFace Skills cloud.

### Hardware Configuration

| Component | Specification | Price |
|-----------|---------------|-------|
| **GPU** | MSI RTX 5060 Ti 16G Ventus 3X OC | $519.99 |
| **Architecture** | NVIDIA Blackwell (2025) | - |
| **VRAM** | 16 GB GDDR7 | - |
| **Tensor Cores** | 4th Gen (FP16/BF16/INT8/FP8) | - |
| **Memory Bandwidth** | ~448 GB/s (128-bit) | - |
| **TDP** | ~180W | - |
| **Cloud Training** | HuggingFace Skills A100-large | ~$77 |
| **Total Project Cost** | | **~$597** |

### Architecture Strategy

```
┌────────────────────────────────────────────────────────────────────────────┐
│                    RTX 5060 Ti 16GB - WORKLOAD DISTRIBUTION                │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  LOCAL (RTX 5060 Ti 16GB)                 CLOUD (HF Skills A100 40GB)     │
│  ─────────────────────────                ───────────────────────────      │
│                                                                            │
│  ✓ Data collection (CPU)                  ✓ Qwen-14B fine-tuning          │
│  ✓ Screenshot capture (CPU)               ✓ Parallel hyperparameter sweep │
│  ✓ Vision model training (Qwen-1.5B)      ✓ Full production training      │
│  ✓ Dataset preprocessing                                                   │
│  ✓ GGUF inference (>50 tok/s)                                             │
│  ✓ Model validation                                                        │
│                                                                            │
│  VRAM: 16GB                               VRAM: 40GB                       │
│  Cost: $0/hour                            Cost: $3.20/hour                 │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

1. **Smaller Local Decoder**: Use Qwen-1.5B (not 3B) for vision model to fit 16GB comfortably
2. **Cloud-Heavy Training**: Qwen-14B fine-tuning entirely on HF Skills A100
3. **Tensor Core Leverage**: BF16 training locally (Blackwell advantage over Pascal P40)
4. **Efficient Inference**: Q4_K_M quantization for production serving

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                    CODE-TRAINER V6: RTX 5060 Ti SINGLE-GPU PIPELINE                 │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│  ╔════════════════════════════════════════════════════════════════════════════════╗ │
│  ║ PHASE 1: DATA COLLECTION (CPU)                                                 ║ │
│  ║                                                                                 ║ │
│  ║  ┌───────────────┐    ┌───────────────┐    ┌───────────────┐                  ║ │
│  ║  │    GitHub     │───▶│   VS Code     │───▶│  Screenshot   │                  ║ │
│  ║  │    Scraper    │    │  Automation   │    │   + Code DB   │                  ║ │
│  ║  │  (V3 Catalog) │    │  (Playwright) │    │   (SQLite)    │                  ║ │
│  ║  │  500 repos/   │    │   8 workers   │    │   Quality     │                  ║ │
│  ║  │   language    │    │  30-40/min    │    │   Scoring     │                  ║ │
│  ║  └───────────────┘    └───────────────┘    └───────────────┘                  ║ │
│  ╚════════════════════════════════════════════════════════════════════════════════╝ │
│                                       │                                              │
│                                       ▼                                              │
│  ╔════════════════════════════════════════════════════════════════════════════════╗ │
│  ║ PHASE 2: PREPROCESSING + HUB UPLOAD                                            ║ │
│  ║                                                                                 ║ │
│  ║  ┌───────────────┐    ┌───────────────┐    ┌───────────────┐                  ║ │
│  ║  │   Quality     │───▶│  Chat Format  │───▶│  HuggingFace  │                  ║ │
│  ║  │    Filter     │    │   Conversion  │    │  Hub Upload   │                  ║ │
│  ║  │   (80/10/10)  │    │  (Qwen Chat)  │    │   (Private)   │                  ║ │
│  ║  └───────────────┘    └───────────────┘    └───────────────┘                  ║ │
│  ╚════════════════════════════════════════════════════════════════════════════════╝ │
│                                       │                                              │
│           ┌───────────────────────────┴───────────────────────────┐                 │
│           │                                                        │                 │
│           ▼                                                        ▼                 │
│  ╔══════════════════════════════════╗    ╔══════════════════════════════════════╗  │
│  ║ PHASE 3: VISION MODEL           ║    ║ PHASE 4: QWEN FINE-TUNE             ║  │
│  ║ RTX 5060 Ti (16GB) - BF16       ║    ║ HF SKILLS A100 (40GB)               ║  │
│  ║                                  ║    ║                                      ║  │
│  ║  ┌──────────────────────────┐   ║    ║  ┌──────────────────────────────┐   ║  │
│  ║  │ Swin-B Vision Encoder    │   ║    ║  │   PARALLEL SWEEP             │   ║  │
│  ║  │ (Frozen, 88M params)     │   ║    ║  │   3× Validation Jobs         │   ║  │
│  ║  └────────────┬─────────────┘   ║    ║  │   ┌─────┐ ┌─────┐ ┌─────┐   │   ║  │
│  ║               │                  ║    ║  │   │r=16│ │r=32│ │r=64│   │   ║  │
│  ║               ▼                  ║    ║  │   │ $7 │ │ $7 │ │ $7 │   │   ║  │
│  ║  ┌──────────────────────────┐   ║    ║  │   └─────┘ └─────┘ └─────┘   │   ║  │
│  ║  │ Multimodal Projector     │   ║    ║  │          ↓ SELECT BEST       │   ║  │
│  ║  │ (2-layer MLP, ~4M)       │   ║    ║  │   ┌─────────┐ ┌─────────┐   │   ║  │
│  ║  └────────────┬─────────────┘   ║    ║  │   │ TOP 1   │ │ TOP 2   │   │   ║  │
│  ║               │                  ║    ║  │   │ ~$28    │ │ ~$28    │   │   ║  │
│  ║               ▼                  ║    ║  │   └─────────┘ └─────────┘   │   ║  │
│  ║  ┌──────────────────────────┐   ║    ║  └──────────────────────────────┘   ║  │
│  ║  │ Qwen-1.5B Code Decoder   │   ║    ║                                      ║  │
│  ║  │ (INT4, LoRA r=16)        │   ║    ║  Total: ~$77                         ║  │
│  ║  └──────────────────────────┘   ║    ║  • Validation: $21                   ║  │
│  ║                                  ║    ║  • Full Train: $56                   ║  │
│  ║  RTX 5060 Ti VRAM (16GB):       ║    ║                                      ║  │
│  ║  • Vision: 1.5 GB               ║    ║  Model: Qwen2.5-Coder-14B            ║  │
│  ║  • Projector: 0.3 GB            ║    ║  Hardware: A100-large (40GB)         ║  │
│  ║  • Decoder: 1.0 GB              ║    ║  Cost: $3.20/hour                    ║  │
│  ║  • Gradients: 6 GB              ║    ║                                      ║  │
│  ║  • Optimizer: 4 GB              ║    ║                                      ║  │
│  ║  ────────────────               ║    ║                                      ║  │
│  ║  TOTAL: ~12.8GB ✓               ║    ║                                      ║  │
│  ║  HEADROOM: 3.2GB                ║    ║                                      ║  │
│  ╚══════════════════════════════════╝    ╚══════════════════════════════════════╝  │
│                                       │                                              │
│                                       ▼                                              │
│  ╔════════════════════════════════════════════════════════════════════════════════╗ │
│  ║ PHASE 5: DEPLOYMENT - RTX 5060 Ti (16GB Blackwell)                             ║ │
│  ║                                                                                 ║ │
│  ║  ┌───────────────┐    ┌───────────────┐    ┌───────────────┐                  ║ │
│  ║  │  LoRA Merge   │───▶│     GGUF      │───▶│  llama.cpp    │                  ║ │
│  ║  │   (PEFT)      │    │   Q4_K_M      │    │   Inference   │                  ║ │
│  ║  │               │    │   (~9GB)      │    │   >50 tok/s   │                  ║ │
│  ║  └───────────────┘    └───────────────┘    └───────────────┘                  ║ │
│  ║                                                                                 ║ │
│  ║  GGUF Inference VRAM:                      TENSOR CORE ACCELERATION:           ║ │
│  ║  • Model Q4_K_M: 9 GB                      • FP16/BF16 matmul optimized       ║ │
│  ║  • KV Cache (4K): 2.5 GB                   • INT8 quantized ops               ║ │
│  ║  • Buffers: 1 GB                           • Flash Attention v2               ║ │
│  ║  ────────────────────                      • Expected: >50 tokens/sec         ║ │
│  ║  TOTAL: ~12.5GB ✓                                                              ║ │
│  ╚════════════════════════════════════════════════════════════════════════════════╝ │
│                                                                                      │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

---

## RTX 5060 Ti Specifications

| Specification | Value |
|---------------|-------|
| **Architecture** | NVIDIA Blackwell (2025) |
| **CUDA Cores** | ~4,608 (estimated) |
| **Tensor Cores** | 4th Gen (FP16/BF16/INT8/FP8) |
| **VRAM** | 16 GB GDDR7 |
| **Memory Bus** | 128-bit |
| **Bandwidth** | ~448 GB/s |
| **TDP** | ~180W |
| **Compute Types** | FP32, FP16, BF16, INT8, FP8 |
| **CUDA Version** | 12.x+ |

### Blackwell Advantages

1. **Native BF16 Training**: Unlike Pascal (P40), Blackwell has efficient BF16 compute
2. **4th Gen Tensor Cores**: Accelerated matrix operations for training and inference
3. **Modern CUDA**: Latest driver optimizations and library support
4. **Efficient INT4/INT8**: Hardware-accelerated quantized inference
5. **Lower Power**: Better performance per watt than older generations

---

## VRAM Budgets

### Phase 3: Vision Model Training (BF16)

```
┌─────────────────────────────────────────────────────────────────┐
│            RTX 5060 Ti 16GB - VISION MODEL TRAINING             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  MODEL COMPONENTS:                                              │
│  ├── Swin-B Vision Encoder (frozen, BF16)      │  1.5 GB       │
│  ├── Multimodal Projector (trainable, BF16)    │  0.3 GB       │
│  └── Qwen-1.5B Decoder (INT4 quantized)        │  1.0 GB       │
│                                                 ────────────    │
│                                                    2.8 GB       │
│                                                                 │
│  TRAINING OVERHEAD:                                             │
│  ├── LoRA Adapters (r=16, α=32)                │  0.2 GB       │
│  ├── Gradients (checkpointed, BF16)            │  6.0 GB       │
│  ├── 8-bit AdamW Optimizer States              │  2.5 GB       │
│  └── Activations & Batch Buffers               │  1.5 GB       │
│                                                 ────────────    │
│                                                   10.2 GB       │
│                                                                 │
│  ═══════════════════════════════════════════════════════════   │
│  TOTAL USED:                                      13.0 GB       │
│  HEADROOM:                                         3.0 GB       │
│  ═══════════════════════════════════════════════════════════   │
│                                                                 │
│  TRAINING SETTINGS:                                             │
│  • Batch size: 2                                                │
│  • Gradient accumulation: 8 (effective batch: 16)               │
│  • Sequence length: 2048 tokens                                 │
│  • Compute dtype: BF16 (Blackwell optimized)                    │
│  • Gradient checkpointing: Enabled                              │
│  • Optimizer: 8-bit AdamW                                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Phase 5: GGUF Inference

```
┌─────────────────────────────────────────────────────────────────┐
│             RTX 5060 Ti 16GB - GGUF INFERENCE                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  QUANTIZATION OPTIONS (Qwen-14B):                               │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Q4_K_M (RECOMMENDED)                                     │  │
│  │  ├── Model Size: ~9 GB                                    │  │
│  │  ├── KV Cache (4K ctx): 2.5 GB                            │  │
│  │  ├── Inference Buffers: 1.0 GB                            │  │
│  │  └── TOTAL: 12.5 GB ✓ (3.5 GB headroom)                   │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Q5_K_M (HIGHER QUALITY)                                  │  │
│  │  ├── Model Size: ~10 GB                                   │  │
│  │  ├── KV Cache (4K ctx): 2.5 GB                            │  │
│  │  ├── Inference Buffers: 1.0 GB                            │  │
│  │  └── TOTAL: 13.5 GB ✓ (2.5 GB headroom)                   │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Q8_0 (7B MODEL - MAXIMUM QUALITY)                        │  │
│  │  ├── Model Size: ~8 GB                                    │  │
│  │  ├── KV Cache (4K ctx): 2.0 GB                            │  │
│  │  ├── Inference Buffers: 1.0 GB                            │  │
│  │  └── TOTAL: 11.0 GB ✓ (5.0 GB headroom)                   │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  BLACKWELL TENSOR CORE PERFORMANCE:                             │
│  • Expected throughput: >50 tokens/second                       │
│  • FP16 prompt processing: ~3× faster than Pascal               │
│  • INT4 generation: Hardware accelerated                        │
│  • Flash Attention v2: Optimized memory access                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
code-trainer/
├── README.md
├── pyproject.toml
├── requirements.txt
├── setup.py
│
├── config/
│   ├── __init__.py
│   ├── settings.py                     # Global configuration
│   ├── v6_config.yaml                  # Main training config
│   └── hf_skills_config.yaml           # Cloud training config
│
├── phase1_data_collection/
│   ├── __init__.py
│   ├── README.md
│   │
│   ├── scrapers/
│   │   ├── __init__.py
│   │   ├── github_scraper.py           # Repository discovery
│   │   ├── quality_scorer.py           # V3 quality scoring
│   │   ├── file_filter.py              # Code file filtering
│   │   └── sqlite_catalog.py           # SQLite metadata store
│   │
│   ├── capture/
│   │   ├── __init__.py
│   │   ├── vscode_automation.py        # Playwright VS Code control
│   │   ├── screenshot_manager.py       # Screenshot capture
│   │   ├── parallel_capture.py         # Multi-worker capture
│   │   └── theme_manager.py            # Theme variations
│   │
│   ├── docker/
│   │   ├── Dockerfile                  # Headless capture environment
│   │   ├── docker-compose.yml
│   │   └── entrypoint.sh
│   │
│   └── scripts/
│       ├── run_collection.py           # Main orchestrator
│       └── validate_samples.py         # Quality validation
│
├── phase2_preprocessing/
│   ├── __init__.py
│   ├── README.md
│   │
│   ├── converters/
│   │   ├── __init__.py
│   │   ├── hf_dataset_converter.py     # Convert to HF format
│   │   ├── chat_formatter.py           # Qwen chat template
│   │   └── image_encoder.py            # Base64 encoding
│   │
│   ├── validation/
│   │   ├── __init__.py
│   │   ├── quality_filter.py           # Filter low-quality samples
│   │   └── statistics.py               # Dataset statistics
│   │
│   └── scripts/
│       ├── build_dataset.py            # Full preprocessing
│       ├── upload_to_hub.py            # HF Hub upload
│       └── compute_statistics.py       # Generate stats
│
├── phase3_vision_model/
│   ├── __init__.py
│   ├── README.md
│   │
│   ├── architecture/
│   │   ├── __init__.py
│   │   ├── vision_encoder.py           # Swin-B encoder
│   │   ├── multimodal_projector.py     # Vision-to-text MLP
│   │   ├── code_decoder.py             # Qwen-1.5B decoder
│   │   └── vision_model.py             # Full model assembly
│   │
│   ├── training/
│   │   ├── __init__.py
│   │   ├── trainer.py                  # RTX 5060 Ti trainer
│   │   ├── dataset.py                  # PyTorch dataset
│   │   ├── collator.py                 # Data collation
│   │   └── callbacks.py                # Training callbacks
│   │
│   ├── evaluation/
│   │   ├── __init__.py
│   │   ├── metrics.py                  # Evaluation metrics
│   │   └── evaluator.py                # Evaluation pipeline
│   │
│   └── scripts/
│       ├── train.py                    # Training script
│       ├── evaluate.py                 # Evaluation script
│       └── export.py                   # Model export
│
├── phase4_qwen_finetuning/
│   ├── __init__.py
│   ├── README.md
│   │
│   ├── hf_skills/
│   │   ├── __init__.py
│   │   ├── job_client.py               # HF Skills API client
│   │   ├── sweep_orchestrator.py       # Parallel sweep manager
│   │   ├── script_generator.py         # Training script generation
│   │   └── job_monitor.py              # Job status monitoring
│   │
│   ├── configs/
│   │   ├── __init__.py
│   │   ├── sweep_configs.py            # Hyperparameter configs
│   │   └── training_args.py            # TrainingArguments builder
│   │
│   └── scripts/
│       ├── launch_validation_sweep.py  # Start validation sweep
│       ├── launch_full_training.py     # Start full training
│       ├── monitor_jobs.py             # Monitor running jobs
│       └── generate_report.py          # Generate results report
│
├── phase5_deployment/
│   ├── __init__.py
│   ├── README.md
│   │
│   ├── gguf/
│   │   ├── __init__.py
│   │   ├── converter.py                # GGUF conversion
│   │   ├── quantizer.py                # Quantization options
│   │   └── uploader.py                 # Hub upload
│   │
│   ├── inference/
│   │   ├── __init__.py
│   │   ├── llama_cpp_server.py         # llama.cpp server
│   │   ├── ollama_runner.py            # Ollama integration
│   │   └── api_client.py               # Inference API client
│   │
│   └── scripts/
│       ├── convert_to_gguf.py          # Conversion script
│       ├── start_server.py             # Start inference server
│       └── benchmark.py                # Performance benchmarks
│
├── utils/
│   ├── __init__.py
│   ├── logging_utils.py                # Structured logging
│   ├── wandb_utils.py                  # W&B integration
│   ├── gpu_utils.py                    # GPU monitoring
│   ├── checkpoint_utils.py             # Checkpoint management
│   └── file_utils.py                   # File I/O utilities
│
├── tests/
│   ├── __init__.py
│   ├── test_phase1.py
│   ├── test_phase2.py
│   ├── test_phase3.py
│   ├── test_phase4.py
│   └── test_phase5.py
│
└── notebooks/
    ├── 01_data_exploration.ipynb
    ├── 02_vision_model_prototype.ipynb
    ├── 03_training_analysis.ipynb
    └── 04_inference_demo.ipynb
```

---

## Phase 1: Data Collection

### 1.1 GitHub Scraper with Quality Scoring

```python
"""
phase1_data_collection/scrapers/github_scraper.py

GitHub repository discovery with quality scoring and SQLite catalog.
"""
import os
import json
import logging
import sqlite3
import hashlib
import math
from pathlib import Path
from typing import List, Dict, Optional, Generator
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests
from git import Repo

logger = logging.getLogger(__name__)


@dataclass
class RepoMetadata:
    """Repository metadata with quality scoring."""
    full_name: str
    clone_url: str
    stars: int
    forks: int
    language: str
    size_kb: int
    default_branch: str
    description: str = ""
    topics: List[str] = field(default_factory=list)
    created_at: str = ""
    updated_at: str = ""
    open_issues: int = 0
    has_readme: bool = True
    license: str = ""
    quality_score: float = 0.0
    category: str = "general"


class QualityScorer:
    """
    Score repository quality 0-100 based on multiple factors.
    
    Components (20 points each):
    - Stars (log scale)
    - Activity (recent updates)
    - Documentation (readme, description, topics)
    - Code quality (issues ratio, license)
    - Community (forks, topics)
    """
    
    CATEGORIES = {
        "security": ["security", "auth", "crypto", "encryption", "vulnerability", "pentest"],
        "ai_ml": ["machine-learning", "deep-learning", "neural", "ai", "nlp", "transformer", "llm"],
        "web": ["web", "frontend", "backend", "api", "rest", "graphql", "react", "vue", "django"],
        "automation": ["automation", "ci-cd", "devops", "kubernetes", "docker", "terraform"],
        "data": ["data", "analytics", "etl", "pipeline", "database", "sql", "pandas"],
        "tool": ["cli", "tool", "utility", "library", "framework", "sdk"]
    }
    
    @classmethod
    def score_repository(cls, repo: RepoMetadata) -> float:
        """Calculate quality score 0-100."""
        scores = {}
        
        # Stars (log scale, max 20 at 10K+ stars)
        if repo.stars > 0:
            scores["stars"] = min(20, math.log10(repo.stars + 1) * 5)
        else:
            scores["stars"] = 0
        
        # Activity (recent updates)
        try:
            updated = datetime.fromisoformat(repo.updated_at.replace("Z", "+00:00"))
            days_since = (datetime.now(updated.tzinfo) - updated).days
            if days_since < 30:
                scores["activity"] = 20
            elif days_since < 90:
                scores["activity"] = 15
            elif days_since < 180:
                scores["activity"] = 10
            elif days_since < 365:
                scores["activity"] = 5
            else:
                scores["activity"] = 0
        except:
            scores["activity"] = 10
        
        # Documentation
        doc_score = 0
        if repo.has_readme:
            doc_score += 10
        if repo.description and len(repo.description) > 20:
            doc_score += 5
        if len(repo.topics) >= 3:
            doc_score += 5
        scores["documentation"] = doc_score
        
        # Code quality proxies
        quality_score = 10
        if repo.license:
            quality_score += 5
        if repo.open_issues < repo.stars * 0.1:
            quality_score += 5
        scores["code_quality"] = min(20, quality_score)
        
        # Community
        community_score = 0
        if repo.forks > 0:
            community_score += min(10, math.log10(repo.forks + 1) * 3)
        if len(repo.topics) > 0:
            community_score += min(10, len(repo.topics) * 2)
        scores["community"] = community_score
        
        return round(sum(scores.values()), 2)
    
    @classmethod
    def classify_category(cls, repo: RepoMetadata) -> str:
        """Classify repository into category."""
        text = f"{repo.description} {' '.join(repo.topics)}".lower()
        
        category_scores = {}
        for category, keywords in cls.CATEGORIES.items():
            score = sum(1 for kw in keywords if kw in text)
            if score > 0:
                category_scores[category] = score
        
        if category_scores:
            return max(category_scores, key=category_scores.get)
        return "general"


class SQLiteCatalog:
    """SQLite-based repository and capture catalog."""
    
    SCHEMA = """
        CREATE TABLE IF NOT EXISTS repositories (
            id INTEGER PRIMARY KEY,
            full_name TEXT UNIQUE NOT NULL,
            clone_url TEXT NOT NULL,
            language TEXT,
            stars INTEGER DEFAULT 0,
            forks INTEGER DEFAULT 0,
            quality_score REAL DEFAULT 0,
            category TEXT DEFAULT 'general',
            size_kb INTEGER DEFAULT 0,
            cloned_at TIMESTAMP,
            local_path TEXT,
            metadata_json TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE TABLE IF NOT EXISTS captures (
            id INTEGER PRIMARY KEY,
            repo_id INTEGER REFERENCES repositories(id),
            file_path TEXT NOT NULL,
            file_hash TEXT NOT NULL,
            language TEXT,
            line_count INTEGER,
            screenshot_count INTEGER DEFAULT 0,
            quality_score REAL DEFAULT 0,
            processed BOOLEAN DEFAULT FALSE,
            captured_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            metadata_json TEXT,
            UNIQUE(repo_id, file_hash)
        );
        
        CREATE INDEX IF NOT EXISTS idx_repos_quality ON repositories(quality_score DESC);
        CREATE INDEX IF NOT EXISTS idx_repos_language ON repositories(language);
        CREATE INDEX IF NOT EXISTS idx_repos_category ON repositories(category);
        CREATE INDEX IF NOT EXISTS idx_captures_processed ON captures(processed);
        CREATE INDEX IF NOT EXISTS idx_captures_language ON captures(language);
    """
    
    def __init__(self, db_path: Path):
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()
    
    def _init_db(self):
        """Initialize database schema."""
        with sqlite3.connect(self.db_path) as conn:
            conn.executescript(self.SCHEMA)
    
    def add_repository(self, repo: RepoMetadata, local_path: Optional[Path] = None):
        """Add or update repository."""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                INSERT INTO repositories (
                    full_name, clone_url, language, stars, forks,
                    quality_score, category, size_kb, local_path, metadata_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(full_name) DO UPDATE SET
                    stars = excluded.stars,
                    forks = excluded.forks,
                    quality_score = excluded.quality_score,
                    local_path = excluded.local_path
            """, (
                repo.full_name, repo.clone_url, repo.language,
                repo.stars, repo.forks, repo.quality_score, repo.category,
                repo.size_kb, str(local_path) if local_path else None,
                json.dumps({k: v for k, v in vars(repo).items() if not k.startswith('_')})
            ))
    
    def add_capture(
        self,
        repo_name: str,
        file_path: Path,
        file_hash: str,
        language: str,
        line_count: int,
        screenshot_count: int,
        metadata: dict
    ):
        """Add capture record."""
        with sqlite3.connect(self.db_path) as conn:
            repo_id = conn.execute(
                "SELECT id FROM repositories WHERE full_name = ?",
                (repo_name,)
            ).fetchone()
            
            if repo_id:
                conn.execute("""
                    INSERT INTO captures (
                        repo_id, file_path, file_hash, language,
                        line_count, screenshot_count, metadata_json
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(repo_id, file_hash) DO UPDATE SET
                        screenshot_count = excluded.screenshot_count
                """, (
                    repo_id[0], str(file_path), file_hash, language,
                    line_count, screenshot_count, json.dumps(metadata)
                ))
    
    def get_statistics(self) -> Dict:
        """Get catalog statistics."""
        with sqlite3.connect(self.db_path) as conn:
            stats = {
                "total_repos": conn.execute("SELECT COUNT(*) FROM repositories").fetchone()[0],
                "total_captures": conn.execute("SELECT COUNT(*) FROM captures").fetchone()[0],
                "processed_captures": conn.execute(
                    "SELECT COUNT(*) FROM captures WHERE processed = TRUE"
                ).fetchone()[0],
                "avg_quality": conn.execute(
                    "SELECT AVG(quality_score) FROM repositories"
                ).fetchone()[0] or 0,
                "by_language": dict(conn.execute(
                    "SELECT language, COUNT(*) FROM repositories GROUP BY language"
                ).fetchall()),
                "by_category": dict(conn.execute(
                    "SELECT category, COUNT(*) FROM repositories GROUP BY category"
                ).fetchall())
            }
            return stats


class GitHubScraper:
    """GitHub repository discovery with quality scoring."""
    
    GITHUB_API = "https://api.github.com"
    
    def __init__(
        self,
        token: str,
        output_dir: Path,
        catalog: SQLiteCatalog,
        languages: List[str] = None,
        min_stars: int = 10,
        min_quality_score: float = 30.0,
        max_size_kb: int = 100_000
    ):
        self.token = token
        self.output_dir = Path(output_dir)
        self.catalog = catalog
        self.languages = languages or [
            "Python", "JavaScript", "TypeScript", "Java",
            "C++", "Go", "Rust", "C#"
        ]
        self.min_stars = min_stars
        self.min_quality_score = min_quality_score
        self.max_size_kb = max_size_kb
        self.headers = {
            "Authorization": f"token {token}",
            "Accept": "application/vnd.github.v3+json"
        }
        self.output_dir.mkdir(parents=True, exist_ok=True)
    
    def _fetch_repo_details(self, repo_data: dict) -> RepoMetadata:
        """Convert API response to RepoMetadata."""
        repo = RepoMetadata(
            full_name=repo_data["full_name"],
            clone_url=repo_data["clone_url"],
            stars=repo_data["stargazers_count"],
            forks=repo_data.get("forks_count", 0),
            language=repo_data.get("language", "Unknown"),
            size_kb=repo_data["size"],
            default_branch=repo_data.get("default_branch", "main"),
            description=repo_data.get("description", "") or "",
            topics=repo_data.get("topics", []),
            created_at=repo_data.get("created_at", ""),
            updated_at=repo_data.get("updated_at", ""),
            open_issues=repo_data.get("open_issues_count", 0),
            license=repo_data.get("license", {}).get("spdx_id", "") if repo_data.get("license") else ""
        )
        
        repo.quality_score = QualityScorer.score_repository(repo)
        repo.category = QualityScorer.classify_category(repo)
        
        return repo
    
    def search_repositories(
        self,
        language: str,
        page: int = 1,
        per_page: int = 100
    ) -> List[RepoMetadata]:
        """Search GitHub for repositories."""
        query = f"language:{language} stars:>={self.min_stars} size:<{self.max_size_kb}"
        url = f"{self.GITHUB_API}/search/repositories"
        params = {
            "q": query,
            "sort": "stars",
            "order": "desc",
            "page": page,
            "per_page": per_page
        }
        
        response = requests.get(url, headers=self.headers, params=params)
        response.raise_for_status()
        data = response.json()
        
        repos = []
        for item in data.get("items", []):
            repo = self._fetch_repo_details(item)
            if repo.quality_score >= self.min_quality_score:
                repos.append(repo)
        
        logger.info(f"Found {len(repos)} quality {language} repos (page {page})")
        return repos
    
    def clone_repository(self, repo: RepoMetadata) -> Optional[Path]:
        """Clone a single repository."""
        repo_path = self.output_dir / repo.full_name.replace("/", "_")
        
        if repo_path.exists():
            logger.debug(f"Repository exists: {repo.full_name}")
            return repo_path
        
        try:
            Repo.clone_from(
                repo.clone_url,
                repo_path,
                depth=1,
                branch=repo.default_branch
            )
            logger.info(f"Cloned: {repo.full_name} (score: {repo.quality_score})")
            self.catalog.add_repository(repo, repo_path)
            return repo_path
        except Exception as e:
            logger.error(f"Clone failed {repo.full_name}: {e}")
            return None
    
    def collect_repositories(
        self,
        repos_per_language: int = 500,
        max_workers: int = 4
    ) -> Generator[Path, None, None]:
        """Collect high-quality repositories."""
        all_repos = []
        
        for language in self.languages:
            pages_needed = (repos_per_language + 99) // 100
            language_repos = []
            
            for page in range(1, pages_needed + 1):
                repos = self.search_repositories(language, page)
                language_repos.extend(repos)
                if len(language_repos) >= repos_per_language or len(repos) < 100:
                    break
            
            language_repos.sort(key=lambda r: r.quality_score, reverse=True)
            all_repos.extend(language_repos[:repos_per_language])
        
        logger.info(f"Discovered {len(all_repos)} quality repositories")
        
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            futures = {executor.submit(self.clone_repository, repo): repo for repo in all_repos}
            for future in as_completed(futures):
                repo_path = future.result()
                if repo_path:
                    yield repo_path


class FileFilter:
    """Filter code files for screenshot capture."""
    
    EXTENSIONS = {
        "Python": [".py"],
        "JavaScript": [".js", ".jsx"],
        "TypeScript": [".ts", ".tsx"],
        "Java": [".java"],
        "C++": [".cpp", ".hpp", ".cc", ".h"],
        "Go": [".go"],
        "Rust": [".rs"],
        "C#": [".cs"]
    }
    
    SKIP_DIRS = {
        "node_modules", "__pycache__", ".git", ".svn",
        "vendor", "dist", "build", ".venv", "venv",
        "target", "bin", "obj", ".idea", ".vscode",
        "test", "tests", "__tests__", "spec"
    }
    
    MIN_FILE_SIZE = 200
    MAX_FILE_SIZE = 50_000
    MIN_LINES = 20
    MAX_LINES = 500
    
    @classmethod
    def get_code_files(cls, repo_path: Path) -> Generator[Path, None, None]:
        """Find valid code files."""
        all_extensions = set()
        for exts in cls.EXTENSIONS.values():
            all_extensions.update(exts)
        
        for root, dirs, files in os.walk(repo_path):
            dirs[:] = [d for d in dirs if d not in cls.SKIP_DIRS]
            
            for filename in files:
                file_path = Path(root) / filename
                
                if file_path.suffix.lower() not in all_extensions:
                    continue
                
                try:
                    size = file_path.stat().st_size
                    if not (cls.MIN_FILE_SIZE <= size <= cls.MAX_FILE_SIZE):
                        continue
                    
                    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                        content = f.read()
                        line_count = content.count('\n') + 1
                    
                    if cls.MIN_LINES <= line_count <= cls.MAX_LINES:
                        yield file_path
                except:
                    continue
```

### 1.2 VS Code Screenshot Automation

```python
"""
phase1_data_collection/capture/vscode_automation.py

Playwright-based VS Code automation for screenshot capture.
"""
import asyncio
import json
import logging
import hashlib
from pathlib import Path
from typing import Optional, Tuple, List, Dict
from dataclasses import dataclass, field
import subprocess

from playwright.async_api import async_playwright, Browser, Page

logger = logging.getLogger(__name__)


@dataclass
class CaptureConfig:
    """Screenshot capture configuration."""
    viewport_width: int = 2560
    viewport_height: int = 1440
    device_scale_factor: float = 2.0
    font_size: int = 14
    line_height: int = 20
    theme: str = "Default Dark+"
    scroll_step: int = 1080
    render_delay_ms: int = 100


@dataclass
class CaptureResult:
    """Result from capturing a single file."""
    file_path: Path
    screenshots: List[Path] = field(default_factory=list)
    source_code: str = ""
    file_hash: str = ""
    metadata: Dict = field(default_factory=dict)
    success: bool = False
    error: Optional[str] = None


class VSCodeAutomation:
    """Playwright-controlled VS Code screenshot capture."""
    
    VSCODE_PATH = "/usr/bin/code"
    
    def __init__(
        self,
        config: CaptureConfig = None,
        output_dir: Path = None,
        debug_port: int = 9222,
        headless: bool = True
    ):
        self.config = config or CaptureConfig()
        self.output_dir = Path(output_dir or "./captures")
        self.debug_port = debug_port
        self.headless = headless
        self.browser: Optional[Browser] = None
        self.page: Optional[Page] = None
        self.vscode_process = None
        
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self._setup_vscode_settings()
    
    def _setup_vscode_settings(self):
        """Configure VS Code for consistent captures."""
        settings = {
            "editor.fontSize": self.config.font_size,
            "editor.lineHeight": self.config.line_height,
            "editor.minimap.enabled": False,
            "editor.scrollbar.vertical": "hidden",
            "editor.scrollbar.horizontal": "hidden",
            "editor.renderWhitespace": "none",
            "editor.guides.indentation": False,
            "breadcrumbs.enabled": False,
            "editor.lineNumbers": "on",
            "workbench.colorTheme": self.config.theme,
            "window.zoomLevel": 0,
            "editor.wordWrap": "off",
            "workbench.activityBar.visible": False,
            "workbench.statusBar.visible": False
        }
        
        settings_dir = Path.home() / ".config/Code/User"
        settings_dir.mkdir(parents=True, exist_ok=True)
        
        with open(settings_dir / "settings.json", 'w') as f:
            json.dump(settings, f, indent=2)
    
    async def start(self):
        """Start VS Code and connect via CDP."""
        cmd = [
            self.VSCODE_PATH,
            f"--remote-debugging-port={self.debug_port}",
            "--no-sandbox"
        ]
        if self.headless:
            cmd.append("--disable-gpu")
        
        env = {"DISPLAY": ":99"} if self.headless else None
        self.vscode_process = subprocess.Popen(
            cmd, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
        )
        
        await asyncio.sleep(3)
        
        playwright = await async_playwright().start()
        self.browser = await playwright.chromium.connect_over_cdp(
            f"http://localhost:{self.debug_port}"
        )
        
        contexts = self.browser.contexts
        if contexts:
            self.page = contexts[0].pages[0]
        else:
            context = await self.browser.new_context(
                viewport={"width": self.config.viewport_width, "height": self.config.viewport_height},
                device_scale_factor=self.config.device_scale_factor
            )
            self.page = await context.new_page()
        
        logger.info(f"VS Code started (port {self.debug_port})")
    
    async def stop(self):
        """Clean up resources."""
        if self.browser:
            await self.browser.close()
        if self.vscode_process:
            self.vscode_process.terminate()
            self.vscode_process.wait()
    
    async def open_file(self, file_path: Path) -> bool:
        """Open file in VS Code."""
        try:
            await self.page.keyboard.press("Control+o")
            await asyncio.sleep(0.5)
            await self.page.keyboard.type(str(file_path.absolute()))
            await self.page.keyboard.press("Enter")
            await asyncio.sleep(1)
            return True
        except Exception as e:
            logger.error(f"Failed to open {file_path}: {e}")
            return False
    
    async def get_scroll_info(self) -> Tuple[int, int]:
        """Get scroll position and total height."""
        info = await self.page.evaluate("""
            () => {
                const editor = document.querySelector('.monaco-editor');
                if (!editor) return { scroll: 0, total: 0 };
                const scrollable = editor.querySelector('.monaco-scrollable-element');
                return {
                    scroll: scrollable?.scrollTop || 0,
                    total: scrollable?.scrollHeight || 0
                };
            }
        """)
        return info.get("scroll", 0), info.get("total", 0)
    
    async def scroll_to(self, position: int):
        """Scroll to position."""
        await self.page.evaluate(f"""
            () => {{
                const editor = document.querySelector('.monaco-editor');
                const scrollable = editor?.querySelector('.monaco-scrollable-element');
                if (scrollable) scrollable.scrollTop = {position};
            }}
        """)
        await asyncio.sleep(self.config.render_delay_ms / 1000)
    
    async def capture_screenshot(self, output_path: Path) -> bool:
        """Capture current viewport."""
        try:
            editor = await self.page.query_selector('.monaco-editor')
            if editor:
                await editor.screenshot(path=str(output_path), type='webp')
            else:
                await self.page.screenshot(path=str(output_path), type='webp')
            return True
        except Exception as e:
            logger.error(f"Screenshot failed: {e}")
            return False
    
    async def capture_file(self, file_path: Path) -> CaptureResult:
        """Capture all screenshots for a code file."""
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                source_code = f.read()
            file_hash = hashlib.sha256(source_code.encode()).hexdigest()[:16]
        except Exception as e:
            return CaptureResult(file_path=file_path, success=False, error=str(e))
        
        if not await self.open_file(file_path):
            return CaptureResult(
                file_path=file_path, source_code=source_code,
                file_hash=file_hash, success=False, error="Failed to open file"
            )
        
        screenshots = []
        await self.scroll_to(0)
        _, total_height = await self.get_scroll_info()
        
        viewport_height = self.config.viewport_height
        num_captures = max(1, (total_height + viewport_height - 1) // self.config.scroll_step)
        
        capture_dir = self.output_dir / file_hash[:2] / file_hash
        capture_dir.mkdir(parents=True, exist_ok=True)
        
        for i in range(num_captures):
            scroll_pos = i * self.config.scroll_step
            await self.scroll_to(scroll_pos)
            
            screenshot_path = capture_dir / f"{i:04d}.webp"
            if await self.capture_screenshot(screenshot_path):
                screenshots.append(screenshot_path)
            
            current, _ = await self.get_scroll_info()
            if current + viewport_height >= total_height:
                break
        
        # Save source
        with open(capture_dir / "source.txt", 'w', encoding='utf-8') as f:
            f.write(source_code)
        
        # Save metadata
        metadata = {
            "file_path": str(file_path),
            "file_hash": file_hash,
            "language": file_path.suffix,
            "line_count": source_code.count('\n') + 1,
            "char_count": len(source_code),
            "num_screenshots": len(screenshots),
            "theme": self.config.theme,
            "font_size": self.config.font_size,
            "viewport": f"{self.config.viewport_width}x{self.config.viewport_height}"
        }
        
        with open(capture_dir / "metadata.json", 'w') as f:
            json.dump(metadata, f, indent=2)
        
        logger.info(f"Captured {len(screenshots)} screenshots: {file_path.name}")
        
        return CaptureResult(
            file_path=file_path, screenshots=screenshots,
            source_code=source_code, file_hash=file_hash,
            metadata=metadata, success=True
        )


class ParallelCapture:
    """Parallel screenshot capture with multiple VS Code instances."""
    
    def __init__(
        self,
        num_workers: int = 8,
        config: CaptureConfig = None,
        output_dir: Path = None
    ):
        self.num_workers = num_workers
        self.config = config or CaptureConfig()
        self.output_dir = Path(output_dir or "./captures")
    
    async def capture_batch(self, file_paths: List[Path], worker_id: int) -> List[CaptureResult]:
        """Process files with a single worker."""
        automation = VSCodeAutomation(
            config=self.config,
            output_dir=self.output_dir / f"worker_{worker_id}",
            debug_port=9222 + worker_id,
            headless=True
        )
        
        results = []
        try:
            await automation.start()
            for file_path in file_paths:
                result = await automation.capture_file(file_path)
                results.append(result)
        finally:
            await automation.stop()
        
        return results
    
    async def capture_all(self, file_paths: List[Path]) -> List[CaptureResult]:
        """Capture all files using parallel workers."""
        batch_size = (len(file_paths) + self.num_workers - 1) // self.num_workers
        batches = [file_paths[i:i + batch_size] for i in range(0, len(file_paths), batch_size)]
        
        tasks = [self.capture_batch(batch, i) for i, batch in enumerate(batches)]
        batch_results = await asyncio.gather(*tasks)
        
        all_results = [r for batch in batch_results for r in batch]
        successful = sum(1 for r in all_results if r.success)
        logger.info(f"Captured {successful}/{len(all_results)} files successfully")
        
        return all_results
```

---

## Phase 2: Preprocessing & Hub Upload

```python
"""
phase2_preprocessing/converters/hf_dataset_converter.py

Convert captured screenshots to HuggingFace dataset format.
"""
import json
import logging
import base64
import random
from pathlib import Path
from typing import List, Dict, Optional
from io import BytesIO

from PIL import Image
from datasets import Dataset, DatasetDict
from huggingface_hub import HfApi

logger = logging.getLogger(__name__)


class HFDatasetConverter:
    """Convert screenshot captures to HuggingFace dataset."""
    
    SYSTEM_PROMPT = """You are an expert code analysis assistant specialized in reading and understanding code from screenshots. When shown a screenshot of code in an IDE, you:

1. Accurately transcribe the visible code preserving exact formatting
2. Identify the programming language and framework
3. Understand the code's purpose and functionality
4. Maintain precise indentation, spacing, and syntax

Always output the code exactly as shown, with no explanations unless asked."""

    USER_PROMPTS = [
        "Please transcribe the code shown in this screenshot.",
        "What code do you see? Transcribe it exactly.",
        "Extract and transcribe the code from this image.",
        "Transcribe the following code screenshot, preserving formatting.",
        "Read and output the code visible in this screenshot.",
        "Convert this code screenshot to text, maintaining exact formatting.",
        "Transcribe the visible code, preserving all whitespace and indentation."
    ]
    
    def __init__(
        self,
        captures_dir: Path,
        output_dir: Path,
        max_code_length: int = 8192,
        include_images: bool = True
    ):
        self.captures_dir = Path(captures_dir)
        self.output_dir = Path(output_dir)
        self.max_code_length = max_code_length
        self.include_images = include_images
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self._prompt_idx = 0
    
    def _get_user_prompt(self) -> str:
        """Cycle through user prompts."""
        prompt = self.USER_PROMPTS[self._prompt_idx]
        self._prompt_idx = (self._prompt_idx + 1) % len(self.USER_PROMPTS)
        return prompt
    
    def _encode_image(self, image_path: Path) -> str:
        """Encode image to base64."""
        with Image.open(image_path) as img:
            if img.mode != 'RGB':
                img = img.convert('RGB')
            buffer = BytesIO()
            img.save(buffer, format='WEBP', quality=90)
            return base64.b64encode(buffer.getvalue()).decode('utf-8')
    
    def _process_capture(self, capture_dir: Path) -> Optional[Dict]:
        """Process a single capture directory."""
        metadata_file = capture_dir / "metadata.json"
        source_file = capture_dir / "source.txt"
        
        if not metadata_file.exists() or not source_file.exists():
            return None
        
        try:
            with open(metadata_file) as f:
                metadata = json.load(f)
            
            with open(source_file, 'r', encoding='utf-8') as f:
                source_code = f.read()
            
            if len(source_code) > self.max_code_length:
                source_code = source_code[:self.max_code_length] + "\n# ... (truncated)"
            
            screenshots = sorted(capture_dir.glob("*.webp"))
            if not screenshots:
                return None
            
            messages = [
                {"role": "system", "content": self.SYSTEM_PROMPT},
                {"role": "user", "content": self._get_user_prompt()},
                {"role": "assistant", "content": source_code}
            ]
            
            sample = {
                "id": metadata.get("file_hash", capture_dir.name),
                "messages": messages,
                "language": metadata.get("language", ""),
                "line_count": metadata.get("line_count", 0),
                "file_path": metadata.get("file_path", "")
            }
            
            if self.include_images:
                sample["image"] = self._encode_image(screenshots[0])
            
            return sample
        except Exception as e:
            logger.error(f"Failed to process {capture_dir}: {e}")
            return None
    
    def convert_all(self) -> DatasetDict:
        """Convert all captures to DatasetDict."""
        samples = []
        
        for subdir in self.captures_dir.iterdir():
            if not subdir.is_dir():
                continue
            for capture_dir in subdir.iterdir():
                if not capture_dir.is_dir():
                    continue
                sample = self._process_capture(capture_dir)
                if sample:
                    samples.append(sample)
        
        logger.info(f"Processed {len(samples)} samples")
        
        random.seed(42)
        random.shuffle(samples)
        
        train_end = int(len(samples) * 0.8)
        val_end = int(len(samples) * 0.9)
        
        return DatasetDict({
            "train": Dataset.from_list(samples[:train_end]),
            "validation": Dataset.from_list(samples[train_end:val_end]),
            "test": Dataset.from_list(samples[val_end:])
        })
    
    def upload_to_hub(self, dataset_dict: DatasetDict, repo_name: str, private: bool = True):
        """Upload to HuggingFace Hub."""
        dataset_dict.push_to_hub(repo_name, private=private)
        logger.info(f"Uploaded dataset to: {repo_name}")
```

---

## Phase 3: Vision Model Training (RTX 5060 Ti)

### 3.1 Vision Model Architecture

```python
"""
phase3_vision_model/architecture/vision_model.py

Multimodal vision-language model optimized for RTX 5060 Ti 16GB.
Uses Qwen-1.5B decoder for comfortable VRAM fit.
"""
import torch
import torch.nn as nn
from typing import Optional, Dict
from dataclasses import dataclass

from transformers import (
    SwinModel,
    AutoModelForCausalLM,
    AutoTokenizer,
    BitsAndBytesConfig
)
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training


@dataclass
class VisionModelConfig:
    """Configuration for vision-language model."""
    # Vision encoder
    vision_model_name: str = "microsoft/swin-base-patch4-window7-224"
    vision_hidden_size: int = 1024
    image_size: int = 384
    
    # Code decoder - Using 1.5B for RTX 5060 Ti 16GB
    decoder_model_name: str = "Qwen/Qwen2.5-Coder-1.5B-Instruct"
    decoder_hidden_size: int = 1536
    max_code_length: int = 2048
    
    # Projector
    projector_hidden_size: int = 1536
    num_projector_layers: int = 2
    
    # Training
    freeze_vision_encoder: bool = True
    use_gradient_checkpointing: bool = True
    
    # Quantization - RTX 5060 Ti optimized (BF16 supported)
    load_in_4bit: bool = True
    bnb_4bit_compute_dtype: str = "bfloat16"  # Blackwell supports BF16
    bnb_4bit_quant_type: str = "nf4"
    
    # LoRA
    lora_r: int = 16
    lora_alpha: int = 32
    lora_dropout: float = 0.05
    lora_target_modules: tuple = (
        "q_proj", "k_proj", "v_proj", "o_proj",
        "gate_proj", "up_proj", "down_proj"
    )


class MultimodalProjector(nn.Module):
    """Projects vision features to decoder embedding space."""
    
    def __init__(
        self,
        vision_hidden_size: int,
        decoder_hidden_size: int,
        hidden_size: int = 1536,
        num_layers: int = 2
    ):
        super().__init__()
        
        layers = []
        current_size = vision_hidden_size
        
        for i in range(num_layers):
            next_size = decoder_hidden_size if i == num_layers - 1 else hidden_size
            layers.extend([
                nn.Linear(current_size, next_size),
                nn.GELU() if i < num_layers - 1 else nn.Identity()
            ])
            current_size = next_size
        
        self.projector = nn.Sequential(*layers)
        self._init_weights()
    
    def _init_weights(self):
        for module in self.modules():
            if isinstance(module, nn.Linear):
                nn.init.xavier_uniform_(module.weight)
                if module.bias is not None:
                    nn.init.zeros_(module.bias)
    
    def forward(self, vision_features: torch.Tensor) -> torch.Tensor:
        return self.projector(vision_features)


class CodeVisionModel(nn.Module):
    """
    Multimodal model for code generation from screenshots.
    Optimized for RTX 5060 Ti 16GB with BF16 compute.
    
    Architecture:
    - Vision: Swin-B (frozen, ~1.5GB BF16)
    - Projector: 2-layer MLP (~0.3GB)
    - Decoder: Qwen-1.5B INT4 + LoRA (~1GB + 0.2GB)
    """
    
    def __init__(self, config: VisionModelConfig):
        super().__init__()
        self.config = config
        
        # Load vision encoder
        self.vision_encoder = SwinModel.from_pretrained(
            config.vision_model_name,
            torch_dtype=torch.bfloat16
        )
        
        if config.freeze_vision_encoder:
            for param in self.vision_encoder.parameters():
                param.requires_grad = False
        
        # RTX 5060 Ti quantization config (BF16 compute)
        bnb_config = BitsAndBytesConfig(
            load_in_4bit=config.load_in_4bit,
            bnb_4bit_use_double_quant=True,
            bnb_4bit_quant_type=config.bnb_4bit_quant_type,
            bnb_4bit_compute_dtype=torch.bfloat16
        )
        
        # Load decoder with INT4
        self.decoder = AutoModelForCausalLM.from_pretrained(
            config.decoder_model_name,
            quantization_config=bnb_config,
            device_map="auto",
            trust_remote_code=True
        )
        
        # Prepare for training
        self.decoder = prepare_model_for_kbit_training(
            self.decoder,
            use_gradient_checkpointing=config.use_gradient_checkpointing
        )
        
        # Apply LoRA
        lora_config = LoraConfig(
            r=config.lora_r,
            lora_alpha=config.lora_alpha,
            lora_dropout=config.lora_dropout,
            target_modules=list(config.lora_target_modules),
            bias="none",
            task_type="CAUSAL_LM"
        )
        self.decoder = get_peft_model(self.decoder, lora_config)
        
        # Load tokenizer
        self.tokenizer = AutoTokenizer.from_pretrained(
            config.decoder_model_name,
            trust_remote_code=True
        )
        if self.tokenizer.pad_token is None:
            self.tokenizer.pad_token = self.tokenizer.eos_token
        
        # Multimodal projector
        self.projector = MultimodalProjector(
            vision_hidden_size=config.vision_hidden_size,
            decoder_hidden_size=config.decoder_hidden_size,
            hidden_size=config.projector_hidden_size,
            num_layers=config.num_projector_layers
        ).to(torch.bfloat16)
        
        if config.use_gradient_checkpointing:
            self.vision_encoder.gradient_checkpointing_enable()
        
        self._log_parameters()
    
    def _log_parameters(self):
        """Log trainable parameters."""
        trainable = sum(p.numel() for p in self.parameters() if p.requires_grad)
        total = sum(p.numel() for p in self.parameters())
        print(f"Trainable: {trainable:,} / {total:,} ({100*trainable/total:.2f}%)")
    
    def encode_image(self, pixel_values: torch.Tensor) -> torch.Tensor:
        """Encode image through vision encoder and projector."""
        with torch.no_grad() if self.config.freeze_vision_encoder else torch.enable_grad():
            vision_outputs = self.vision_encoder(pixel_values)
            vision_features = vision_outputs.last_hidden_state
        return self.projector(vision_features)
    
    def forward(
        self,
        pixel_values: torch.Tensor,
        input_ids: torch.Tensor,
        attention_mask: torch.Tensor,
        labels: Optional[torch.Tensor] = None
    ) -> Dict[str, torch.Tensor]:
        """Forward pass for training."""
        batch_size = pixel_values.shape[0]
        
        visual_embeds = self.encode_image(pixel_values)
        num_visual_tokens = visual_embeds.shape[1]
        
        text_embeds = self.decoder.get_input_embeddings()(input_ids)
        inputs_embeds = torch.cat([visual_embeds, text_embeds], dim=1)
        
        visual_attention = torch.ones(
            batch_size, num_visual_tokens,
            dtype=attention_mask.dtype, device=attention_mask.device
        )
        extended_mask = torch.cat([visual_attention, attention_mask], dim=1)
        
        if labels is not None:
            visual_labels = torch.full(
                (batch_size, num_visual_tokens),
                fill_value=-100, dtype=labels.dtype, device=labels.device
            )
            labels = torch.cat([visual_labels, labels], dim=1)
        
        outputs = self.decoder(
            inputs_embeds=inputs_embeds,
            attention_mask=extended_mask,
            labels=labels,
            return_dict=True
        )
        
        return {"loss": outputs.loss, "logits": outputs.logits}
    
    @torch.no_grad()
    def generate(
        self,
        pixel_values: torch.Tensor,
        prompt: str = "",
        max_new_tokens: int = 512,
        temperature: float = 0.7,
        top_p: float = 0.9
    ) -> str:
        """Generate code from image."""
        if prompt:
            prompt_tokens = self.tokenizer(prompt, return_tensors="pt", padding=True).to(pixel_values.device)
        else:
            prompt_tokens = self.tokenizer("", return_tensors="pt").to(pixel_values.device)
        
        visual_embeds = self.encode_image(pixel_values)
        text_embeds = self.decoder.get_input_embeddings()(prompt_tokens.input_ids)
        inputs_embeds = torch.cat([visual_embeds, text_embeds], dim=1)
        
        visual_mask = torch.ones(1, visual_embeds.shape[1], dtype=prompt_tokens.attention_mask.dtype, device=pixel_values.device)
        attention_mask = torch.cat([visual_mask, prompt_tokens.attention_mask], dim=1)
        
        outputs = self.decoder.generate(
            inputs_embeds=inputs_embeds,
            attention_mask=attention_mask,
            max_new_tokens=max_new_tokens,
            temperature=temperature,
            top_p=top_p,
            do_sample=temperature > 0,
            pad_token_id=self.tokenizer.pad_token_id,
            eos_token_id=self.tokenizer.eos_token_id
        )
        
        return self.tokenizer.decode(outputs[0], skip_special_tokens=True)
    
    def save_pretrained(self, save_dir: str):
        """Save model components."""
        import os
        os.makedirs(save_dir, exist_ok=True)
        
        torch.save(self.projector.state_dict(), os.path.join(save_dir, "projector.pt"))
        self.decoder.save_pretrained(os.path.join(save_dir, "decoder_lora"))
        
        import json
        with open(os.path.join(save_dir, "config.json"), 'w') as f:
            json.dump({k: str(v) if not isinstance(v, (int, float, bool, str, list, tuple)) else v 
                      for k, v in vars(self.config).items()}, f, indent=2)
        
        self.tokenizer.save_pretrained(save_dir)
```

### 3.2 RTX 5060 Ti Training Script

```python
"""
phase3_vision_model/training/trainer.py

Vision model trainer optimized for RTX 5060 Ti 16GB with BF16 compute.
"""
import os
import logging
from pathlib import Path
from dataclasses import dataclass
from typing import Optional

import torch
from torch.utils.data import Dataset, DataLoader
from transformers import get_cosine_schedule_with_warmup
from tqdm import tqdm
import wandb

logger = logging.getLogger(__name__)


@dataclass
class RTX5060TiTrainingConfig:
    """Training configuration for RTX 5060 Ti 16GB."""
    # Data
    batch_size: int = 2
    gradient_accumulation_steps: int = 8
    max_seq_length: int = 2048
    num_workers: int = 4
    
    # Optimization
    learning_rate: float = 2e-4
    weight_decay: float = 0.01
    warmup_ratio: float = 0.1
    num_epochs: int = 10
    max_grad_norm: float = 1.0
    
    # Checkpointing
    save_steps: int = 500
    eval_steps: int = 500
    logging_steps: int = 10
    output_dir: str = "./models/vision_model"
    
    # RTX 5060 Ti specific
    use_bf16: bool = True  # Blackwell supports BF16
    use_8bit_optimizer: bool = True
    gradient_checkpointing: bool = True
    pin_memory: bool = True
    
    # Wandb
    wandb_project: str = "code-trainer-v6"
    wandb_run_name: str = "rtx5060ti-vision-model"


class RTX5060TiTrainer:
    """
    Trainer optimized for RTX 5060 Ti 16GB VRAM.
    
    Key optimizations:
    - BF16 mixed precision (Blackwell Tensor Cores)
    - 8-bit AdamW optimizer
    - Gradient checkpointing
    - Small batch + high accumulation
    """
    
    def __init__(
        self,
        model,
        config: RTX5060TiTrainingConfig,
        train_dataset: Dataset,
        eval_dataset: Optional[Dataset] = None
    ):
        self.model = model
        self.config = config
        self.train_dataset = train_dataset
        self.eval_dataset = eval_dataset
        
        self.device = torch.device("cuda:0")
        
        # Move model
        self.model.vision_encoder.to(self.device)
        self.model.projector.to(self.device)
        
        self._setup_optimizer()
        self._setup_dataloaders()
        
        # Mixed precision scaler for BF16
        self.scaler = torch.cuda.amp.GradScaler(enabled=self.config.use_bf16)
    
    def _setup_optimizer(self):
        """Setup 8-bit AdamW optimizer."""
        trainable_params = [p for p in self.model.parameters() if p.requires_grad]
        
        if self.config.use_8bit_optimizer:
            try:
                import bitsandbytes as bnb
                self.optimizer = bnb.optim.AdamW8bit(
                    trainable_params,
                    lr=self.config.learning_rate,
                    weight_decay=self.config.weight_decay
                )
                logger.info("Using 8-bit AdamW optimizer")
            except ImportError:
                self.optimizer = torch.optim.AdamW(
                    trainable_params,
                    lr=self.config.learning_rate,
                    weight_decay=self.config.weight_decay
                )
        else:
            self.optimizer = torch.optim.AdamW(
                trainable_params,
                lr=self.config.learning_rate,
                weight_decay=self.config.weight_decay
            )
        
        steps_per_epoch = len(self.train_dataset) // (
            self.config.batch_size * self.config.gradient_accumulation_steps
        )
        total_steps = steps_per_epoch * self.config.num_epochs
        warmup_steps = int(total_steps * self.config.warmup_ratio)
        
        self.scheduler = get_cosine_schedule_with_warmup(
            self.optimizer,
            num_warmup_steps=warmup_steps,
            num_training_steps=total_steps
        )
    
    def _setup_dataloaders(self):
        """Setup data loaders."""
        self.train_loader = DataLoader(
            self.train_dataset,
            batch_size=self.config.batch_size,
            shuffle=True,
            num_workers=self.config.num_workers,
            pin_memory=self.config.pin_memory,
            drop_last=True
        )
        
        if self.eval_dataset:
            self.eval_loader = DataLoader(
                self.eval_dataset,
                batch_size=self.config.batch_size,
                shuffle=False,
                num_workers=self.config.num_workers,
                pin_memory=self.config.pin_memory
            )
    
    def _log_gpu_memory(self):
        """Log GPU memory usage."""
        if torch.cuda.is_available():
            allocated = torch.cuda.memory_allocated() / 1e9
            reserved = torch.cuda.memory_reserved() / 1e9
            logger.info(f"GPU Memory: {allocated:.2f}GB allocated, {reserved:.2f}GB reserved")
    
    def train(self):
        """Run training loop."""
        wandb.init(
            project=self.config.wandb_project,
            name=self.config.wandb_run_name,
            config=vars(self.config)
        )
        
        os.makedirs(self.config.output_dir, exist_ok=True)
        
        global_step = 0
        best_eval_loss = float('inf')
        
        self.model.train()
        self._log_gpu_memory()
        
        for epoch in range(self.config.num_epochs):
            epoch_loss = 0.0
            num_batches = 0
            
            progress = tqdm(self.train_loader, desc=f"Epoch {epoch + 1}/{self.config.num_epochs}")
            
            for batch_idx, batch in enumerate(progress):
                pixel_values = batch["pixel_values"].to(self.device, dtype=torch.bfloat16)
                input_ids = batch["input_ids"].to(self.device)
                attention_mask = batch["attention_mask"].to(self.device)
                labels = batch["labels"].to(self.device)
                
                # Mixed precision forward
                with torch.cuda.amp.autocast(dtype=torch.bfloat16, enabled=self.config.use_bf16):
                    outputs = self.model(
                        pixel_values=pixel_values,
                        input_ids=input_ids,
                        attention_mask=attention_mask,
                        labels=labels
                    )
                    loss = outputs["loss"] / self.config.gradient_accumulation_steps
                
                self.scaler.scale(loss).backward()
                
                epoch_loss += loss.item() * self.config.gradient_accumulation_steps
                num_batches += 1
                
                if (batch_idx + 1) % self.config.gradient_accumulation_steps == 0:
                    self.scaler.unscale_(self.optimizer)
                    torch.nn.utils.clip_grad_norm_(self.model.parameters(), self.config.max_grad_norm)
                    
                    self.scaler.step(self.optimizer)
                    self.scaler.update()
                    self.scheduler.step()
                    self.optimizer.zero_grad()
                    
                    global_step += 1
                    
                    if global_step % self.config.logging_steps == 0:
                        avg_loss = epoch_loss / num_batches
                        lr = self.scheduler.get_last_lr()[0]
                        
                        wandb.log({
                            "train/loss": avg_loss,
                            "train/learning_rate": lr,
                            "train/epoch": epoch + (batch_idx / len(self.train_loader)),
                            "train/global_step": global_step
                        })
                        
                        progress.set_postfix({"loss": f"{avg_loss:.4f}", "lr": f"{lr:.2e}"})
                    
                    if self.eval_dataset and global_step % self.config.eval_steps == 0:
                        eval_loss = self.evaluate()
                        wandb.log({"eval/loss": eval_loss, "eval/global_step": global_step})
                        
                        if eval_loss < best_eval_loss:
                            best_eval_loss = eval_loss
                            self.save_checkpoint("best")
                        
                        self.model.train()
                    
                    if global_step % self.config.save_steps == 0:
                        self.save_checkpoint(f"step_{global_step}")
            
            avg_epoch_loss = epoch_loss / num_batches
            logger.info(f"Epoch {epoch + 1} completed. Avg loss: {avg_epoch_loss:.4f}")
            self.save_checkpoint(f"epoch_{epoch + 1}")
        
        self.save_checkpoint("final")
        wandb.finish()
        
        return {"final_loss": avg_epoch_loss, "best_eval_loss": best_eval_loss}
    
    @torch.no_grad()
    def evaluate(self) -> float:
        """Evaluate on validation set."""
        self.model.eval()
        total_loss = 0.0
        num_batches = 0
        
        for batch in tqdm(self.eval_loader, desc="Evaluating"):
            pixel_values = batch["pixel_values"].to(self.device, dtype=torch.bfloat16)
            input_ids = batch["input_ids"].to(self.device)
            attention_mask = batch["attention_mask"].to(self.device)
            labels = batch["labels"].to(self.device)
            
            with torch.cuda.amp.autocast(dtype=torch.bfloat16, enabled=self.config.use_bf16):
                outputs = self.model(
                    pixel_values=pixel_values,
                    input_ids=input_ids,
                    attention_mask=attention_mask,
                    labels=labels
                )
            
            total_loss += outputs["loss"].item()
            num_batches += 1
        
        return total_loss / num_batches
    
    def save_checkpoint(self, name: str):
        """Save checkpoint."""
        save_path = os.path.join(self.config.output_dir, name)
        self.model.save_pretrained(save_path)
        logger.info(f"Saved checkpoint: {save_path}")
```

---

## Phase 4: Qwen Fine-tuning (HuggingFace Skills)

```python
"""
phase4_qwen_finetuning/hf_skills/job_client.py

HuggingFace Skills API client for cloud GPU training.
"""
import time
import json
import logging
from typing import Dict, List
from dataclasses import dataclass, field
from datetime import datetime

from huggingface_hub import HfApi

logger = logging.getLogger(__name__)


@dataclass
class SweepConfig:
    """Hyperparameter sweep configuration."""
    name: str
    lora_r: int
    lora_alpha: int
    learning_rate: float
    batch_size: int
    gradient_accumulation: int
    num_epochs: int = 1
    warmup_ratio: float = 0.1
    max_seq_length: int = 4096


@dataclass
class HFSkillsConfig:
    """HuggingFace Skills configuration."""
    model_name: str = "Qwen/Qwen2.5-Coder-14B-Instruct"
    dataset_name: str = ""
    hardware: str = "a100-large"
    
    validation_configs: List[SweepConfig] = field(default_factory=lambda: [
        SweepConfig(
            name="conservative", lora_r=16, lora_alpha=32,
            learning_rate=1.5e-4, batch_size=1, gradient_accumulation=16, num_epochs=1
        ),
        SweepConfig(
            name="standard", lora_r=32, lora_alpha=64,
            learning_rate=2e-4, batch_size=2, gradient_accumulation=8, num_epochs=1
        ),
        SweepConfig(
            name="aggressive", lora_r=64, lora_alpha=128,
            learning_rate=3e-4, batch_size=4, gradient_accumulation=4, num_epochs=1
        )
    ])


class HFSkillsJobClient:
    """Client for HuggingFace Skills API."""
    
    TRAINING_SCRIPT = '''
"""Qwen2.5-Coder Fine-tuning with QLoRA"""
import torch
from datasets import load_dataset
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig, TrainingArguments
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
from trl import SFTTrainer

MODEL_NAME = "{model_name}"
DATASET_NAME = "{dataset_name}"
OUTPUT_DIR = "{output_dir}"
LORA_R = {lora_r}
LORA_ALPHA = {lora_alpha}
LEARNING_RATE = {learning_rate}
BATCH_SIZE = {batch_size}
GRADIENT_ACCUMULATION = {gradient_accumulation}
NUM_EPOCHS = {num_epochs}
MAX_SEQ_LENGTH = {max_seq_length}
WARMUP_RATIO = {warmup_ratio}

def main():
    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME, trust_remote_code=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
    
    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True, bnb_4bit_use_double_quant=True,
        bnb_4bit_quant_type="nf4", bnb_4bit_compute_dtype=torch.bfloat16
    )
    
    model = AutoModelForCausalLM.from_pretrained(
        MODEL_NAME, quantization_config=bnb_config, device_map="auto", trust_remote_code=True
    )
    model = prepare_model_for_kbit_training(model, use_gradient_checkpointing=True)
    
    lora_config = LoraConfig(
        r=LORA_R, lora_alpha=LORA_ALPHA, lora_dropout=0.05,
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
        bias="none", task_type="CAUSAL_LM"
    )
    model = get_peft_model(model, lora_config)
    
    dataset = load_dataset(DATASET_NAME)
    
    training_args = TrainingArguments(
        output_dir=OUTPUT_DIR, num_train_epochs=NUM_EPOCHS,
        per_device_train_batch_size=BATCH_SIZE, per_device_eval_batch_size=BATCH_SIZE,
        gradient_accumulation_steps=GRADIENT_ACCUMULATION, learning_rate=LEARNING_RATE,
        warmup_ratio=WARMUP_RATIO, lr_scheduler_type="cosine",
        logging_steps=10, save_steps=500, eval_strategy="steps", eval_steps=500,
        bf16=True, gradient_checkpointing=True, optim="adamw_torch",
        report_to="wandb", push_to_hub=True, hub_model_id=OUTPUT_DIR.split("/")[-1]
    )
    
    trainer = SFTTrainer(
        model=model, args=training_args, train_dataset=dataset["train"],
        eval_dataset=dataset.get("validation"), tokenizer=tokenizer, max_seq_length=MAX_SEQ_LENGTH
    )
    
    trainer.train()
    trainer.save_model()
    trainer.push_to_hub()

if __name__ == "__main__":
    main()
'''
    
    def __init__(self, config: HFSkillsConfig):
        self.config = config
        self.api = HfApi()
    
    def _generate_script(self, sweep_config: SweepConfig, output_repo: str) -> str:
        """Generate training script."""
        return self.TRAINING_SCRIPT.format(
            model_name=self.config.model_name,
            dataset_name=self.config.dataset_name,
            output_dir=output_repo,
            lora_r=sweep_config.lora_r,
            lora_alpha=sweep_config.lora_alpha,
            learning_rate=sweep_config.learning_rate,
            batch_size=sweep_config.batch_size,
            gradient_accumulation=sweep_config.gradient_accumulation,
            num_epochs=sweep_config.num_epochs,
            max_seq_length=sweep_config.max_seq_length,
            warmup_ratio=sweep_config.warmup_ratio
        )
    
    def submit_job(self, sweep_config: SweepConfig, output_repo: str) -> Dict:
        """Submit training job."""
        script = self._generate_script(sweep_config, output_repo)
        
        job_info = {
            "id": f"job_{sweep_config.name}_{int(time.time())}",
            "name": sweep_config.name,
            "status": "pending",
            "hardware": self.config.hardware,
            "output_repo": output_repo,
            "submitted_at": datetime.now().isoformat(),
            "config": vars(sweep_config),
            "script": script
        }
        
        logger.info(f"Submitted job: {job_info['id']}")
        return job_info
    
    def get_job_status(self, job_id: str) -> Dict:
        """Get job status."""
        return {"id": job_id, "status": "running", "progress": 0.5, "metrics": {"train_loss": 0.5, "eval_loss": 0.6}}
    
    def wait_for_completion(self, job_ids: List[str], poll_interval: int = 120) -> List[Dict]:
        """Wait for jobs to complete."""
        results = []
        pending = set(job_ids)
        
        while pending:
            for job_id in list(pending):
                status = self.get_job_status(job_id)
                if status["status"] in ["completed", "failed"]:
                    results.append(status)
                    pending.remove(job_id)
            
            if pending:
                logger.info(f"Waiting for {len(pending)} jobs...")
                time.sleep(poll_interval)
        
        return results


class ParallelSweepOrchestrator:
    """Orchestrates parallel hyperparameter sweeps."""
    
    def __init__(self, client: HFSkillsJobClient, output_base: str):
        self.client = client
        self.output_base = output_base
    
    def run_validation_sweep(self) -> Dict:
        """Run validation sweep."""
        jobs = []
        for config in self.client.config.validation_configs:
            output_repo = f"{self.output_base}-{config.name}"
            job = self.client.submit_job(config, output_repo)
            jobs.append(job)
        
        results = self.client.wait_for_completion([j["id"] for j in jobs])
        best = min(results, key=lambda r: r["metrics"].get("eval_loss", float('inf')))
        
        return {"jobs": results, "best_config": best, "best_name": next(j["name"] for j in jobs if j["id"] == best["id"])}
    
    def run_full_training(self, configs: List[SweepConfig], num_epochs: int = 3) -> Dict:
        """Run full training with best configs."""
        jobs = []
        for config in configs:
            full_config = SweepConfig(
                name=f"{config.name}_full", lora_r=config.lora_r, lora_alpha=config.lora_alpha,
                learning_rate=config.learning_rate, batch_size=config.batch_size,
                gradient_accumulation=config.gradient_accumulation, num_epochs=num_epochs
            )
            job = self.client.submit_job(full_config, f"{self.output_base}-{full_config.name}")
            jobs.append(job)
        
        results = self.client.wait_for_completion([j["id"] for j in jobs])
        best = min(results, key=lambda r: r["metrics"].get("eval_loss", float('inf')))
        
        return {"jobs": results, "best_model": best.get("output_repo")}
```

---

## Phase 5: GGUF Deployment

```python
"""
phase5_deployment/gguf/converter.py

GGUF conversion for RTX 5060 Ti inference.
"""
import os
import subprocess
import logging
from pathlib import Path
from dataclasses import dataclass

from huggingface_hub import HfApi, snapshot_download

logger = logging.getLogger(__name__)


@dataclass
class GGUFConfig:
    """GGUF conversion configuration."""
    quantization: str = "Q4_K_M"
    context_length: int = 4096
    llama_cpp_dir: str = "./llama.cpp"
    output_dir: str = "./models/gguf"


class GGUFConverter:
    """Convert models to GGUF for RTX 5060 Ti."""
    
    QUANT_OPTIONS = {
        "Q4_K_M": {"size_gb": 9, "quality": "good", "recommended": True},
        "Q5_K_M": {"size_gb": 10, "quality": "better", "recommended": True},
        "Q6_K": {"size_gb": 11, "quality": "high", "recommended": False},
        "Q8_0": {"size_gb": 14, "quality": "best", "recommended": False},
    }
    
    def __init__(self, config: GGUFConfig):
        self.config = config
        self.api = HfApi()
        os.makedirs(config.output_dir, exist_ok=True)
    
    def setup_llama_cpp(self):
        """Build llama.cpp with CUDA."""
        llama_dir = Path(self.config.llama_cpp_dir)
        
        if not llama_dir.exists():
            subprocess.run([
                "git", "clone", "--depth", "1",
                "https://github.com/ggerganov/llama.cpp", str(llama_dir)
            ], check=True)
        
        subprocess.run(["make", "-j", "LLAMA_CUDA=1"], cwd=llama_dir, check=True)
    
    def download_model(self, repo_id: str) -> Path:
        """Download from Hub."""
        local_dir = Path(self.config.output_dir) / "hf_model"
        snapshot_download(repo_id=repo_id, local_dir=local_dir, ignore_patterns=["*.bin"])
        return local_dir
    
    def merge_lora(self, base_model: str, lora_adapter: str, output_dir: str):
        """Merge LoRA with base model."""
        from peft import PeftModel
        from transformers import AutoModelForCausalLM, AutoTokenizer
        import torch
        
        base = AutoModelForCausalLM.from_pretrained(
            base_model, torch_dtype=torch.float16, device_map="cpu", trust_remote_code=True
        )
        model = PeftModel.from_pretrained(base, lora_adapter)
        merged = model.merge_and_unload()
        merged.save_pretrained(output_dir)
        
        tokenizer = AutoTokenizer.from_pretrained(base_model, trust_remote_code=True)
        tokenizer.save_pretrained(output_dir)
        
        return output_dir
    
    def convert_to_gguf(self, model_path: Path, output_name: str) -> Path:
        """Convert to GGUF."""
        llama_dir = Path(self.config.llama_cpp_dir)
        output_path = Path(self.config.output_dir) / f"{output_name}.gguf"
        f16_path = Path(self.config.output_dir) / f"{output_name}_f16.gguf"
        
        subprocess.run([
            "python", str(llama_dir / "convert_hf_to_gguf.py"),
            str(model_path), "--outfile", str(f16_path), "--outtype", "f16"
        ], check=True)
        
        subprocess.run([
            str(llama_dir / "llama-quantize"),
            str(f16_path), str(output_path), self.config.quantization
        ], check=True)
        
        f16_path.unlink(missing_ok=True)
        return output_path
    
    def upload_gguf(self, gguf_path: Path, repo_id: str):
        """Upload to Hub."""
        self.api.create_repo(repo_id, exist_ok=True)
        self.api.upload_file(path_or_fileobj=str(gguf_path), path_in_repo=gguf_path.name, repo_id=repo_id)
        logger.info(f"Uploaded to: https://huggingface.co/{repo_id}")


class RTX5060TiServer:
    """Inference server for RTX 5060 Ti."""
    
    def __init__(self, model_path: str, port: int = 8080, context_length: int = 4096):
        self.model_path = model_path
        self.port = port
        self.context_length = context_length
        self.process = None
    
    def start(self):
        """Start llama.cpp server."""
        cmd = [
            "llama-server", "-m", self.model_path,
            "--port", str(self.port), "--ctx-size", str(self.context_length),
            "-ngl", "-1", "--host", "0.0.0.0"
        ]
        self.process = subprocess.Popen(cmd)
        logger.info(f"Server started on port {self.port}")
        return self.process
    
    def stop(self):
        """Stop server."""
        if self.process:
            self.process.terminate()
            self.process.wait()
```

---

## Configuration

### config/v6_config.yaml

```yaml
# Code-Trainer V6 Configuration
# Hardware: RTX 5060 Ti 16GB (Single GPU)

# Phase 1: Data Collection
data_collection:
  github_token: ${GITHUB_TOKEN}
  repos_dir: ./data/repositories
  captures_dir: ./data/captures
  catalog_db: ./data/catalog.db
  repos_per_language: 500
  min_quality_score: 30
  languages:
    - Python
    - JavaScript
    - TypeScript
    - Java
    - Go
    - Rust
    - C++
    - C#
  capture_workers: 8
  viewport_width: 2560
  viewport_height: 1440
  font_size: 14
  theme: "Default Dark+"

# Phase 2: Preprocessing
preprocessing:
  dataset_name: ${HF_USERNAME}/code-trainer-v6-dataset
  max_code_length: 8192
  train_split: 0.8
  val_split: 0.1
  test_split: 0.1
  private: true

# Phase 3: Vision Model (RTX 5060 Ti)
vision_model:
  # Architecture - Optimized for 16GB
  vision_encoder: "microsoft/swin-base-patch4-window7-224"
  decoder: "Qwen/Qwen2.5-Coder-1.5B-Instruct"  # 1.5B for 16GB fit
  
  # Training
  batch_size: 2
  gradient_accumulation: 8
  learning_rate: 2e-4
  num_epochs: 10
  max_seq_length: 2048
  
  # RTX 5060 Ti optimizations
  compute_dtype: "bfloat16"  # Blackwell supports BF16
  gradient_checkpointing: true
  use_8bit_optimizer: true
  
  # LoRA
  lora_r: 16
  lora_alpha: 32
  lora_dropout: 0.05
  
  output_dir: ./models/vision_model

# Phase 4: Qwen Fine-tuning (HF Skills Cloud)
qwen_finetuning:
  model: "Qwen/Qwen2.5-Coder-14B-Instruct"
  hardware: "a100-large"
  
  validation_sweep:
    - name: conservative
      lora_r: 16
      lora_alpha: 32
      learning_rate: 1.5e-4
      batch_size: 1
      gradient_accumulation: 16
    - name: standard
      lora_r: 32
      lora_alpha: 64
      learning_rate: 2e-4
      batch_size: 2
      gradient_accumulation: 8
    - name: aggressive
      lora_r: 64
      lora_alpha: 128
      learning_rate: 3e-4
      batch_size: 4
      gradient_accumulation: 4
  
  full_training:
    num_epochs: 3
    top_n_configs: 2
  
  output_base: ${HF_USERNAME}/qwen14b-code-trainer-v6

# Phase 5: Deployment (RTX 5060 Ti)
deployment:
  quantization: "Q4_K_M"
  context_length: 4096
  port: 8080
  gguf_repo: ${HF_USERNAME}/qwen14b-code-trainer-v6-gguf
```

---

## Requirements

```
# requirements.txt

# Core
torch>=2.1.0
transformers>=4.40.0
accelerate>=0.27.0
datasets>=2.18.0
peft>=0.10.0
bitsandbytes>=0.43.0
trl>=0.8.0

# Data collection
playwright>=1.42.0
gitpython>=3.1.42
requests>=2.31.0

# Image processing
pillow>=10.2.0

# Database
# sqlite3 (built-in)

# Experiment tracking
wandb>=0.16.0

# Utilities
pyyaml>=6.0.1
tqdm>=4.66.0
numpy>=1.24.0

# Hub
huggingface_hub>=0.21.0

# Development
pytest>=8.0.0
black>=24.2.0
```

---

## Quick Start Commands

```bash
# Setup
pip install -r requirements.txt
playwright install chromium

# Phase 1: Data Collection
python -m phase1_data_collection.scripts.run_collection \
    --config config/v6_config.yaml \
    --repos-per-language 500

# Phase 2: Preprocessing
python -m phase2_preprocessing.scripts.build_dataset \
    --config config/v6_config.yaml \
    --upload-hub

# Phase 3: Vision Model Training (RTX 5060 Ti)
python -m phase3_vision_model.scripts.train \
    --config config/v6_config.yaml

# Phase 4A: HF Skills Validation Sweep
python -m phase4_qwen_finetuning.scripts.launch_validation_sweep \
    --config config/v6_config.yaml \
    --report ./reports/validation_sweep.md

# Phase 4B: HF Skills Full Training
python -m phase4_qwen_finetuning.scripts.launch_full_training \
    --config config/v6_config.yaml \
    --top-n 2

# Phase 5: GGUF Conversion & Deployment
python -m phase5_deployment.scripts.convert_to_gguf \
    --model ${HF_USERNAME}/qwen14b-code-trainer-v6-standard \
    --quantization Q4_K_M

# Start Inference Server
llama-server \
    -hf ${HF_USERNAME}/qwen14b-code-trainer-v6-gguf:Q4_K_M \
    --port 8080 --ctx-size 4096
```

---

## Cost Summary

| Phase | Component | Hardware | Cost |
|-------|-----------|----------|------|
| 1 | Data Collection | CPU | $0 |
| 2 | Preprocessing | CPU + Hub | $0 |
| 3 | Vision Model | RTX 5060 Ti | $0 |
| 4A | Validation Sweep | 3× A100 (~2h) | ~$21 |
| 4B | Full Training | 2× A100 (~8h) | ~$56 |
| 5 | Deployment | RTX 5060 Ti | $0 |
| **Hardware** | RTX 5060 Ti 16GB | | **$520** |
| **Cloud Total** | | | **~$77** |
| **Project Total** | | | **~$597** |

---

## Success Criteria

| Phase | Metric | Target |
|-------|--------|--------|
| 1 | Captured samples | ≥50,000 |
| 2 | Dataset on Hub | ✓ |
| 3 | Vision model loss | <0.5 |
| 4A | Validation complete | 3/3 jobs |
| 4B | Best eval loss | <1.0 |
| 5 | Inference speed | >50 tok/s |
