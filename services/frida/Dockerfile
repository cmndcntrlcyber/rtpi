FROM python:3.12-slim

# Frida dynamic instrumentation toolkit
# Used by the RE agent node for runtime analysis

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential curl \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir \
    frida-tools \
    frida

WORKDIR /workspace

ENTRYPOINT ["tail", "-f", "/dev/null"]
