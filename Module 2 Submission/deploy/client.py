#!/usr/bin/env python3
"""Client for the deployed qwen14b-code-trainer-v6 model.

Demonstrates the four canonical RTPI request types (deployment-plan.md §1.3) with
example prompts, expected-output notes, error handling, and basic latency timing.

Works against either backend (they share an OpenAI-compatible contract):
  - Ollama   : http://localhost:11434/v1   (default)
  - vLLM     : http://localhost:18000/v1

Usage:
    python client.py                       # run all example prompts
    python client.py --prompt "Write a Go function that reverses a UTF-8 string."
    BASE_URL=http://localhost:18000/v1 python client.py

No third-party deps required (uses stdlib urllib); see requirements.txt for the
optional `openai`/`requests` path.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request

BASE_URL = os.environ.get("BASE_URL", "http://localhost:11434/v1")
MODEL = os.environ.get("MODEL", "qwen2.5-coder:14b")
API_KEY = os.environ.get("API_KEY", "ollama")  # Ollama ignores it; vLLM accepts any
TIMEOUT_S = int(os.environ.get("TIMEOUT_S", "120"))

# (label, system, user, what-to-expect)
EXAMPLES = [
    (
        "code-generation",
        "You are the RTPI code model. Output only code.",
        "Write a Go function that reverses a UTF-8 string.",
        "Idiomatic Go using []rune; compiles.",
    ),
    (
        "nuclei-template",
        "You generate valid Nuclei YAML templates for authorized testing.",
        "Write a Nuclei template that detects a login panel at /api/login returning 200 with a 'csrf_token' cookie. Severity info.",
        "Valid YAML with id, info.severity, requests/http matchers.",
    ),
    (
        "triage",
        "You triage recon output into a concise risk list.",
        'Given subdomains ["admin.acme.test","blog.acme.test","vpn.acme.test"], '
        "list which likely expose admin panels with a one-line risk note each.",
        "Deterministic structured list, one risk note per item.",
    ),
    (
        "tool-call",
        "You call tools. Only emit a JSON tool call.",
        'Tool: run_nuclei(target:str, template:str). Call it to scan '
        '"https://acme.test" with template "exposed-panels".',
        "A single well-formed tool/function call (JSON).",
    ),
]


def chat(system: str, user: str) -> tuple[str, float]:
    """Send one chat completion. Returns (content, elapsed_seconds).

    Raises RuntimeError with a clear message on transport/HTTP/parse failure.
    """
    payload = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "temperature": 0.2,
        "max_tokens": 1024,
        "stream": False,
    }
    req = urllib.request.Request(
        f"{BASE_URL}/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {API_KEY}",
        },
        method="POST",
    )
    start = time.monotonic()
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT_S) as resp:
            body = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", "replace")[:500]
        raise RuntimeError(f"HTTP {e.code} from {BASE_URL}: {detail}") from e
    except urllib.error.URLError as e:
        raise RuntimeError(
            f"Cannot reach {BASE_URL} ({e.reason}). Is the backend up? "
            f"Try: ./test_inference.sh"
        ) from e
    except (TimeoutError, ConnectionError) as e:
        raise RuntimeError(f"Request timed out after {TIMEOUT_S}s: {e}") from e

    elapsed = time.monotonic() - start
    try:
        return body["choices"][0]["message"]["content"], elapsed
    except (KeyError, IndexError, TypeError) as e:
        raise RuntimeError(f"Unexpected response shape: {json.dumps(body)[:500]}") from e


def run_one(label: str, system: str, user: str, expect: str) -> bool:
    print(f"\n=== {label} ===")
    print(f"prompt : {user}")
    print(f"expect : {expect}")
    try:
        content, elapsed = chat(system, user)
    except RuntimeError as e:
        print(f"FAILED : {e}", file=sys.stderr)
        return False
    print(f"latency: {elapsed:.2f}s")
    print("output :")
    print(content.strip())
    return True


def main() -> int:
    ap = argparse.ArgumentParser(description="RTPI fine-tuned model client")
    ap.add_argument("--prompt", help="Run a single ad-hoc prompt instead of the examples")
    args = ap.parse_args()

    print(f"backend: {BASE_URL}  model: {MODEL}")

    if args.prompt:
        ok = run_one("ad-hoc", "You are the RTPI code model.", args.prompt, "n/a")
        return 0 if ok else 1

    results = [run_one(*ex) for ex in EXAMPLES]
    passed = sum(results)
    print(f"\n{passed}/{len(results)} example prompts succeeded.")
    return 0 if passed == len(results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
