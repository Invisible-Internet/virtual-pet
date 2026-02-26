# Deliverable 01: Gap Analysis - Expansion Doc vs Current Repo

**Deliverable ID:** `01-gap-analysis-expansion-vs-current`  
**Status:** `in_progress`  
**Owner:** `Mic + Codex`  
**Last Updated:** `2026-02-26`  
**Depends On:** `00-master-roadmap`, `09-decisions-log`  
**Blocks:** `02-architecture-capability-registry`  
**Verification Gate:** `All major expansion ideas are mapped to repo status as Adopt/Adapt/Defer with rationale and no unresolved structural conflicts`

## Objective
Map ideas from the expansion conversation to current repository reality and lock what is included now vs deferred.

## In Scope
- Compare current code architecture to expansion proposal.
- Mark each major idea as:
  - `Adopt`
  - `Adapt`
  - `Defer`
- Document technical reasons and dependency implications.

## Out of Scope
- Implementing feature code.
- Changing runtime behavior.

## Dependencies
- Current repo state (`main.js`, `renderer.js`, `preload.js`, `assets/characters/girl/manifest.json`).
- Decisions in [`09-decisions-log.md`](./09-decisions-log.md).

## Decisions Locked
- Canvas runtime baseline is retained.
- OpenClaw is advisory/orchestration, not render-loop authority.
- Capability registry model is v1 plugin strategy.

## Implementation Breakdown
1. Inventory expansion doc themes (states, memory, OpenClaw, integrations, architecture posture).
2. Inventory current repo capabilities.
3. Build a mapping table: `Theme -> Current State -> Decision -> Rationale -> Target Deliverable`.
4. Resolve conflicts with locked decisions.
5. Publish prioritized gap list for D02-D06.

## Verification Gate
Pass when all are true:
1. Mapping table covers all major expansion themes.
2. No theme is left without a decision state (`Adopt/Adapt/Defer`).
3. All `Adopt/Adapt` items point to a downstream deliverable.
4. Locked decisions in D09 are respected.

## Open Questions
- None at bootstrap; to be filled during active work.

## Change Log
- `2026-02-26`: File created and seeded.
