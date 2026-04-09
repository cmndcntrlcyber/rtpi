FROM eclipse-temurin:17-jre-jammy

# Ghidra headless analyzer for automated binary analysis
# Used by the RE agent node in the LangGraph orchestrator

ARG GHIDRA_VERSION=11.2.1
ARG GHIDRA_DATE=20241105

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl unzip python3 python3-pip \
    && rm -rf /var/lib/apt/lists/*

# Download and install Ghidra
RUN curl -fsSL "https://github.com/NationalSecurityAgency/ghidra/releases/download/Ghidra_${GHIDRA_VERSION}_build/ghidra_${GHIDRA_VERSION}_PUBLIC_${GHIDRA_DATE}.zip" \
    -o /tmp/ghidra.zip \
    && unzip /tmp/ghidra.zip -d /opt \
    && mv /opt/ghidra_${GHIDRA_VERSION}_PUBLIC /opt/ghidra \
    && rm /tmp/ghidra.zip

ENV GHIDRA_INSTALL_DIR=/opt/ghidra
ENV PATH="${GHIDRA_INSTALL_DIR}/support:${PATH}"

WORKDIR /workspace

# The orchestrator invokes analyzeHeadless via docker exec
ENTRYPOINT ["tail", "-f", "/dev/null"]
