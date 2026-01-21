================================================================================
                          rust-nexus Agent Bundle
================================================================================

Agent Name:     agent-mkocnqhn
Platform:       windows
Architecture:   x64
Implant Type:   general
Generated:      2026-01-21T18:29:28.453Z

================================================================================
                              Quick Start
================================================================================

1. Extract all files to a directory on the target system

2. Ensure all files are present:
   - nexus-agent.exe       (agent binary)
   - ca.crt              (CA certificate)
   - client.crt          (client certificate)
   - client.key          (client private key)
   - config.toml         (configuration)

3. Run the agent:

   Windows:
   > .\nexus-agent.exe --config config.toml

   Or install as service:
   > .\nexus-agent.exe --install --config config.toml


================================================================================
                              Security Notice
================================================================================

This bundle contains sensitive cryptographic material:
- client.key: Private key for mTLS authentication

KEEP THESE FILES SECURE. Do not share or expose them publicly.

================================================================================
                              Support
================================================================================

Controller URL: http://192.168.1.112:5000
Documentation:  https://docs.rtpi.local/agents

================================================================================