# Architecture Diagrams

Supporting diagrams for [`../deployment-plan.md`](../deployment-plan.md). Rendered with Mermaid (GitHub-native).

## 1. System architecture — model serving inside RTPI

```mermaid
flowchart TB
    subgraph Operator["Operator / Air-gapped node"]
        UI["Open WebUI<br/>(human chat)"]
        APP["RTPI App Layer<br/>(Express + auth + RBAC)"]
        subgraph Agents["RTPI Agents & Services"]
            ORCH["agent-workflow-orchestrator"]
            WH["web-hacker-ai"]
            RG["report-generator"]
            TC["agent-tool-connector<br/>(tool-call trust boundary)"]
        end
        subgraph Inference["Inference layer (OpenAI/Ollama-compatible)"]
            ROUTER{"RTPI_INFERENCE_PROVIDER<br/>auto-walk"}
            OLLAMA["Ollama (Tier B)<br/>qwen14b-code-trainer-v6<br/>GGUF Q4_K_M"]
            VLLM["vLLM (Tier C)<br/>batched serving"]
            RK["RKLLama (Tier A)<br/>RK3588 NPU"]
            CPU["Ollama CPU (Tier D)"]
        end
        GPU[("NVIDIA GPU / NPU")]
    end
    CLOUD["Cloud API<br/>(fallback only, opt-in)"]:::fallback

    UI --> APP
    APP --> Agents
    ORCH --> ROUTER
    WH --> ROUTER
    RG --> ROUTER
    ROUTER -->|"1st choice"| VLLM
    ROUTER -->|"default"| OLLAMA
    ROUTER -->|"portable"| RK
    ROUTER -->|"no GPU"| CPU
    ROUTER -.->|"disabled in air-gap"| CLOUD
    OLLAMA --> GPU
    VLLM --> GPU
    TC -->|"validated tool calls only"| Agents

    classDef fallback stroke-dasharray: 5 5,color:#999;
```

## 2. Request flow — a single agent tool-use turn

```mermaid
sequenceDiagram
    participant A as RTPI Agent
    participant R as Inference Router
    participant M as qwen14b-code-trainer-v6
    participant V as agent-tool-connector
    participant T as Security Tool (MCP)

    A->>R: chat/completions (prompt + tool schema)
    R->>M: route to local backend (Ollama/vLLM)
    M-->>R: tool call (e.g. run_nuclei{...})
    R-->>A: parsed tool call
    A->>V: request tool execution
    V->>V: validate against allow-listed schema + scope
    alt valid & in-scope
        V->>T: execute
        T-->>V: result
        V-->>A: result
    else invalid / out-of-scope
        V-->>A: rejected (trust boundary)
    end
    Note over M,V: Model only *suggests*; connector *authorizes*. (plan §6.4)
```

## 3. Monitoring & self-healing topology

```mermaid
flowchart LR
    subgraph Serving
        OLLAMA["Ollama / vLLM"]
        GPU[("GPU")]
    end
    subgraph Observability["--profile monitoring"]
        DCGM["DCGM exporter<br/>(GPU metrics)"]
        PROM["Prometheus<br/>(15s scrape)"]
        GRAF["Grafana<br/>(dashboards)"]
    end
    subgraph Liveness["Built into RTPI"]
        HC["35 healthchecks"]
        HEAL["container-healer<br/>(systemd timer)"]
        VERIFY["deploy-verify.sh<br/>(rollout gate)"]
    end

    OLLAMA -->|/metrics| PROM
    GPU --> DCGM --> PROM
    PROM --> GRAF
    PROM -->|alerts| OPS["Operator runbooks<br/>(deploy/README.md)"]
    HC --> HEAL
    HEAL -->|restart on crash loop| OLLAMA
    VERIFY -->|gate after up -d| OLLAMA
```

## 4. Deployment tiers (decision view)

```mermaid
flowchart TD
    START{"What hardware?"} 
    START -->|"RK3588 NPU<br/>(Orange Pi)"| A["Tier A: RKLLama<br/>air-gap, on-site"]
    START -->|"1 GPU ≥12GB"| B["Tier B: Ollama + GGUF<br/>DEFAULT"]
    START -->|"rack, many agents"| C["Tier C: vLLM<br/>batched, multi-GPU"]
    START -->|"no GPU/NPU"| D["Tier D: Ollama CPU<br/>fallback"]
    A & B & C & D --> CONTRACT["Same OpenAI/Ollama API contract<br/>(:11434 / /v1) — zero app changes"]
```
