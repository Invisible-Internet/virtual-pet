# Deliverable 01: Gap Analysis - Expansion Doc vs Current Repo

**Deliverable ID:** `01-gap-analysis-expansion-vs-current`  
**Status:** `in_progress`  
**Owner:** `Mic + Codex`  
**Last Updated:** `2026-02-26`  
**Depends On:** `00-master-roadmap`, `09-decisions-log`  
**Blocks:** `02-architecture-capability-registry`, `02b-extension-framework-and-pack-sdk`  
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
- Include explicit mapping for:
  - Extension pack model (hybrid manifest + optional hooks) and discovery paths.
  - Prop world window model (desktop anchors, placement flow, multi-monitor behavior).
  - Core-authoritative behavior arbitration expectations for extension-origin actions.
  - Extension trust/permission/compatibility policy (author-trusted warning model + best-effort compatibility).
  - Desktop roaming modes (full desktop vs user-defined roam zone).
  - Baseline states and priority policy (`Idle`, `Roam`, `MusicChill`, `MusicDance`, `WatchMode`, `Sleep`).
  - State extension patterns for simple and complex state packs (example: Reading, Pool).
  - Taskbar/tray settings and wardrobe UX surface.
  - Sensor model (including Windows GSMTC media source assumptions).
  - Proactive pet-to-user communication triggers and output channels.
  - Memory domains/tiers and identity-promotion governance.
  - Core workspace and Obsidian vault file/folder layout expectations.
  - Introspection behavior modes.
  - Conversation pathways (voice + text) including offline fallback UX.
  - OpenClaw read-only state awareness requirements (`currentState` + state context payload).
  - Speech presentation (bubble/balloon) and lip-sync approximation behavior.
  - Hobby stream and scoring model.
  - Music mode initial feature focus (`MEDIA.playing` trigger, props, rating flow).

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
- Renderer migration proposals (DOM/CSS or Pixi) are out of scope for this roadmap and treated as future-only unless ADR-0001 is superseded.

## Implementation Breakdown
1. Inventory expansion doc themes (states, memory, OpenClaw, integrations, architecture posture).
2. Inventory current repo capabilities.
3. Build a mapping table: `Theme -> Current State -> Decision -> Rationale -> Target Deliverable`.
4. Resolve conflicts with locked decisions.
5. Publish prioritized gap list for D02, D02b, and D03-D06.
6. Add a "visible verification checklist" for each mapped theme so acceptance can be observed unambiguously.

## Verification Gate
Pass when all are true:
1. Mapping table covers all major expansion themes.
2. No theme is left without a decision state (`Adopt/Adapt/Defer`).
3. All `Adopt/Adapt` items point to a downstream deliverable.
4. Locked decisions in D09 are respected.
5. All requested feature targets (roam modes, states, tray/settings/wardrobe, memory/introspection/hobby, conversation/speech/lip-sync, proactive pet messaging, music-mode focus, state-pack extensibility, OpenClaw state awareness) are present in the mapping table.
6. Extension framework targets (pack model, prop world model, arbitration model, trust/permission model, compatibility policy) are present with downstream ownership.

## Tangible Acceptance Test (Doc-Level)
1. Reviewer can point to one row per requested feature target in the mapping table.
2. Each row has `Adopt/Adapt/Defer`, rationale, and downstream deliverable reference.
3. Renderer strategy row explicitly confirms `Adopt current Canvas baseline` with no migration work in current roadmap scope.
4. Extension framework rows explicitly map to D02b and related contract deliverables (D03/D04/D07/D08).

## Open Questions
- None at bootstrap; to be filled during active work.

## Change Log
- `2026-02-26`: File created and seeded.
