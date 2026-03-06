---
name: virtual-pet-lane
description: Build versioned Virtual Pet lane actions and return them as proposed actions.
---

# Virtual Pet Lane

Use this skill when you need to ask the Virtual Pet desktop app for:
- bounded status reads
- guarded signed command requests
- memory sync intents

Tool: `virtual_pet_lane`

## Contract
- `contractVersion`: `vp-plugin-lane-v1`
- action type/route: `virtual_pet_lane_call`
- calls:
  - `virtual_pet.status.read`
  - `virtual_pet.command.request`
  - `virtual_pet.memory.sync_intent`

## Usage Pattern
1. Build one lane call with `virtual_pet_lane`.
2. Return the built action in `proposedActions`.
3. Keep payloads bounded to the selected call contract.

## Examples

Status read:

```json
{
  "call": "virtual_pet.status.read",
  "correlationId": "corr-status-1",
  "payload": {
    "scope": "bridge_summary"
  }
}
```

Command request:

```json
{
  "call": "virtual_pet.command.request",
  "correlationId": "corr-command-1",
  "payload": {
    "envelope": {
      "type": "pet_command_request",
      "requestId": "req-1",
      "actionId": "dialog.injectAnnouncement",
      "args": {
        "text": "Hello from OpenClaw."
      },
      "issuedAtMs": 0,
      "expiresAtMs": 0,
      "source": {
        "skillId": "virtual-pet-lane",
        "agentId": "main",
        "sessionId": "demo"
      },
      "auth": {
        "scheme": "vp-hmac-v1",
        "keyId": "local-default",
        "nonce": "nonce-1",
        "signature": "..."
      }
    }
  }
}
```

Memory sync intent:

```json
{
  "call": "virtual_pet.memory.sync_intent",
  "correlationId": "corr-memory-1",
  "payload": {
    "intentId": "intent-1",
    "intentType": "memory_reflection_request",
    "summary": "Capture this highlight for memory reflection.",
    "context": {
      "source": "openclaw"
    }
  }
}
```
