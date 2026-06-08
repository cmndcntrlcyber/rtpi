# Rollback record — P0-1 Option A (remove Metasploit from agent enabledTools)

**Applied:** 2026-06-02. **Reason:** generic tool path cannot correctly drive
Metasploit (command tokenizer splits on spaces, breaking `-x "…"`); real MSF use
flows through `metasploitExecutor.execute()` on the attack-tree path
(`agent-workflow-orchestrator.ts:2894`). See `2026-06-02-p0-stop-fabrication.md`.

## Tool UUIDs removed
- `b7469e5f-1a32-4ef1-a3b6-fbfe8e80e9ca` → tool_registry `metasploit`
- `61360bf0-e984-43e0-b5ec-4642c75b3abf` → tool_registry `msfconsole`

## Pre-change state (authoritative for restore)

### Operations Manager — `eca81d54-94ea-4118-b9fb-8970b16c90c3`
`config.enabledTools` BEFORE:
```json
["b7469e5f-1a32-4ef1-a3b6-fbfe8e80e9ca"]
```
AFTER: `[]`

### Azure-AD Agent — `ea5edcde-f306-49e2-930e-5d6007de66bb`
`config.enabledTools` BEFORE:
```json
["3660589e-858d-43e4-a872-954b46eca777","0d323c07-c0c6-44e7-8ecd-219cf2f44034","b7a42d42-6a8f-4106-b369-d42bf64f667f","99582763-7a1e-4aef-92d5-def1d8df45e9","ebab200e-5ef1-4132-ab87-e2c95708ae16","99fb8f5b-5823-4eb7-9a39-a990333f0b4b","2e00d596-749f-4aa9-8fc7-7b5bf1824122","1054190e-a408-4c63-be7e-50b3e595719a","61f764a0-d69b-4383-9ad9-994925039c96","c6d9150e-fefe-41cd-abfb-64d8a864fe45","61360bf0-e984-43e0-b5ec-4642c75b3abf","06917037-561b-4f12-a01f-92331b799bd5","8f90ca75-ba63-4a9e-9c97-113b1b4487fa","6ff22e74-662c-4961-93cc-5db8057779a4","38230788-4d2c-4c62-8144-3eb60be86297","bedc9cdf-220d-4b4f-a9e3-f63278730285","3b52b5fe-24d3-48d9-a7e2-76eb93ad0dd1","08c87350-3041-4df9-82e7-79285232cab6","8de3009b-c382-4153-8453-9b9799171bd3","979dc95a-c46a-4ce8-a4dc-bcd7e5b3982c","fdcae5ce-0537-475c-b98f-f4912fa8df22","b7469e5f-1a32-4ef1-a3b6-fbfe8e80e9ca","17971171-ccc3-4fc7-822b-e6718e822bcf","85a2a92f-1f13-4211-b8ca-d43e4651081e"]
```
AFTER: the same list with `61360bf0…` and `b7469e5f…` removed (22 tools).

## To restore
Re-add the two UUIDs to each agent's `config.enabledTools` (paste the BEFORE
arrays above back into `agents.config`), e.g. via the same node approach used to
apply, or Drizzle Studio. No schema change was made — only the `enabledTools`
array inside the `agents.config` JSON.
