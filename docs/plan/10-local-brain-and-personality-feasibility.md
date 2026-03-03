# Deliverable 10: Local Brain and Personality Feasibility

**Deliverable ID:** `10-local-brain-and-personality-feasibility`  
**Status:** `done`  
**Owner:** `Mic + Codex`  
**Last Updated:** `2026-03-03`  
**Depends On:** `08-test-and-acceptance-matrix`  
**Blocks:** `Future post-v1 planning only`  
**Verification Gate:** `Research options, tradeoffs, and ADR recommendation are documented well enough to decide whether local-brain or structured-trait work should become a new implementation track`

## Objective
Evaluate future local-brain and offline-personality options without committing them to the v1 implementation path.

## In Scope
- Decision matrix for future local intelligence direction:
  - external OpenClaw with a local model provider
  - bundled OpenClaw service
  - embedded local model path
  - no local model, structured traits/rules only
- Evaluation of whether structured traits should become canonical.
- Evaluation of how structured traits would sync with:
  - `SOUL.md`
  - `IDENTITY.md`
  - memory pipeline outputs
- Comparison of Ollama-style local-provider options against the current external OpenClaw baseline.
- Cost, complexity, risk, and operator-experience analysis.

## Out of Scope
- Runtime bundling work.
- Local-model integration work.
- Rewriting D05 memory ownership.
- Retroactive expansion of v1 scope.

## Decisions Locked
- External OpenClaw remains the current product baseline until a separate post-v1 deliverable is approved.
- This deliverable is research-only and non-blocking to v1 completion.
- Any future local-brain implementation must preserve the current local-authority model unless a later deliverable explicitly reopens that architecture.

## Current Baseline Constraints
- Main-process state authority, motion authority, and render authority remain local.
- OpenClaw is advisory only; it can suggest text or structured guidance, but it does not own pet state.
- The shipped v1 offline loop is intentionally minimal and deterministic:
  - local Q/A
  - visible state changes
  - bounded proactive announcements
  - prop interactions
  - bubble/talk feedback
- Memory governance is already Markdown-first (`SOUL.md`, `IDENTITY.md`, and memory artifacts remain inspectable operator-facing documents).
- D10 cannot retroactively expand v1 scope; it can only recommend future work.

## Decision Matrix
| Option | Summary | Offline Depth | Operator Burden | Engineering Risk | Architecture Fit | Recommendation |
| --- | --- | --- | --- | --- | --- | --- |
| Current baseline: external OpenClaw | Keep the shipped boundary exactly as-is. OpenClaw may be remote or separately managed, and the pet falls back to deterministic offline behavior when unavailable. | Low to medium | Medium | Low | Excellent | Keep as current baseline |
| A. External OpenClaw plus local provider | Preserve today's bridge and let OpenClaw target a local provider such as an Ollama-style runtime. The app still talks only to OpenClaw. | Medium to high | Medium | Low to medium | Excellent | Best first post-v1 path |
| B. Bundled OpenClaw companion | Ship or install a managed local OpenClaw service with supported provider presets and tighter app setup guidance. | High | Low to medium for operator; high for team | High | Good | Consider only after Option A proves value |
| C. Embedded model runtime in app | Run inference directly inside the Electron app or a tightly coupled native sidecar owned by the app itself. | High | Low for operator | Very high | Poor | Do not pursue in the next roadmap branch |
| D. Rules and traits only, no model | Expand deterministic persona/state rules and trait scoring without any local or remote generative model. | Medium for continuity; low for open-ended dialogue | Low | Medium | Excellent | Useful companion layer, not a full replacement |

## Option Analysis
### Current baseline: external OpenClaw
- Strengths:
  - Already shipped and manually verified through D04-D08.
  - Preserves a clear trust boundary between deterministic pet authority and advisory intelligence.
  - Existing degraded-mode behavior already covers timeout/offline states cleanly.
- Limits:
  - Deeper offline personality remains intentionally shallow.
  - Operator setup can still be rough when external paths, WSL, or OpenClaw runtime health drift.

### Option A: external OpenClaw plus local provider
- What changes:
  - The app contract stays the same.
  - OpenClaw is pointed at a local model provider instead of, or in addition to, a remote one.
- Why it fits best:
  - Lowest app-side disruption.
  - Reuses current bridge fallback semantics, diagnostics, and governance boundaries.
  - Lets operator hardware determine whether deeper local intelligence is worthwhile before the team commits to packaging it.
- Main costs:
  - Local model installation, disk footprint, and GPU/CPU suitability are still the operator's problem.
  - Support burden moves into documentation, presets, and health diagnostics rather than pure app code.
- Degraded behavior:
  - If the local provider is absent or unhealthy, the app still degrades through the already-shipped OpenClaw timeout/offline paths.

### Option B: bundled OpenClaw companion
- What changes:
  - The product starts owning service install, updates, and lifecycle for a local OpenClaw runtime.
- Why it is plausible:
  - Better operator experience than a fully manual local-provider path.
  - Maintains the same advisory boundary if the pet still talks only to OpenClaw.
- Why it is not the first move:
  - Packaging, updates, firewall prompts, platform support, and trust messaging all become product responsibilities.
  - Release complexity jumps before there is evidence that local execution meaningfully improves retention or delight.
- Degraded behavior:
  - Better default availability than Option A if installation succeeds, but failure modes become more product-owned and harder to support.

### Option C: embedded model runtime in app
- What changes:
  - The app owns inference, model lifecycle, and local hardware compatibility directly.
- Why it is not recommended:
  - Highest risk to responsiveness in the same process family that already owns animation, multi-window coordination, and desktop behavior.
  - Blurs the boundary between deterministic control and advisory intelligence.
  - Increases binary size, installation time, GPU/driver variability, and test matrix size sharply.
- Degraded behavior:
  - Potentially best offline depth on paper, but also the most failure-prone and least debuggable option in practice.

### Option D: rules and traits only, no model
- What changes:
  - The pet becomes more consistent and characterful through deterministic rule expansion, trait scoring, and authored response templates.
- Why it matters:
  - It is the safest way to improve continuity when fully offline.
  - It complements the existing minimal offline loop without creating packaging or latency risk.
- Why it is not enough alone:
  - Open-ended questions, novelty, and broad topic coverage remain narrow.
  - Authoring burden shifts from infrastructure to content/system design.
- Degraded behavior:
  - Very strong. This is the cleanest fallback layer, but not a substitute for a richer assistant path.

## Evaluation Questions Resolved
1. What does the pet become when OpenClaw is fully offline?
   - For v1, it remains a deterministic desktop companion, not a full local mind.
   - Post-v1, the safest expansion is a stronger persona continuity layer plus optional local-provider-backed advisory intelligence.
2. Is the committed v1 minimal offline embodiment loop sufficient without deeper personality work?
   - Yes for v1 closeout. It already satisfies resilience and delight goals without expanding the critical path.
3. Would a structured-trait canon simplify or complicate future memory and identity governance?
   - It would simplify fast runtime reads but complicate authorship, auditability, and sync if made canonical.
4. Does a local model provider improve operator experience enough to justify added complexity?
   - Potentially yes, but only if kept behind the existing OpenClaw boundary first.
5. Would bundling OpenClaw or embedding a local model threaten responsiveness, trust boundaries, or maintainability?
   - Bundling raises release/ops cost materially; embedding raises architectural and runtime risk too much for the next branch.

## Structured Traits vs Markdown-First Canon
| Criterion | Markdown-First Canon | Structured-Trait Canon |
| --- | --- | --- |
| Human inspectability | Strong. Matches current Obsidian/OpenClaw workflow. | Weaker unless duplicated into prose for humans. |
| Schema evolution | Flexible and tolerant of partial data. | Faster machine reads, but schema drift becomes a product problem. |
| Runtime access | Requires derivation/parsing step. | Fast and direct. |
| Governance and auditing | Strong. Easier to review mutations and intent in prose. | Harder to explain nuanced identity changes with only fields. |
| Risk of split-brain state | Low if documents stay canonical. | High if traits and Markdown both become editable sources. |
| Fit with current architecture | Strong. Aligns with ADR-0012. | Conflicts with current memory/document ownership unless heavily constrained. |

## Recommendation on Canonical Personality Source
Structured traits should not become the canonical personality source.

Recommended model:
1. Keep `SOUL.md`, `IDENTITY.md`, and approved memory artifacts as canonical.
2. Introduce a derived structured persona snapshot only if a future deliverable needs faster local reads.
3. Regenerate that snapshot from canonical documents plus accepted memory promotions; do not permit direct trait edits to bypass Markdown governance.

This preserves auditability and operator trust while still allowing deterministic runtime logic to consume concise fields such as:
- `tone`
- `energy_bias`
- `curiosity_bias`
- `social_openness`
- `favorite_topics`
- `avoid_topics`
- `conversation_style`
- `derived_from`
- `updated_at`

## Proposed Sync Contract for Future Trait Derivation
- `SOUL.md`
  - Holds stable values, voice guardrails, and non-negotiable behavioral boundaries.
- `IDENTITY.md`
  - Holds the current self-model, preferences, and durable narrative framing.
- Memory pipeline outputs
  - Continue to produce observations, promotion proposals, and mutation audit trails.
- Derived persona snapshot
  - Built from canonical Markdown plus accepted promotions only.
  - Carries provenance fields so runtime/debug surfaces can explain where each trait came from.
  - Is read-only at runtime and disposable/rebuildable if schema changes.

## Recommendation
Approve only a narrow, staged post-v1 local-brain track.

The recommended sequence is:
1. Keep the current external OpenClaw architecture as the product baseline.
2. If local intelligence becomes a priority, pursue Option A first:
   - local provider support behind the existing OpenClaw boundary
   - no change to app authority or bridge semantics
3. Add a small derived persona snapshot only to improve deterministic offline continuity and cheap local reads.
4. Revisit bundled OpenClaw only if operator setup friction becomes the primary adoption blocker.
5. Reject embedded in-app model runtime for the next roadmap branch.

## ADR Recommendation
This deliverable recommends recording two follow-on ADRs:
1. Future local-intelligence work, if approved, should start with bridge-compatible local-provider support rather than embedded inference.
2. Structured traits should remain derived, read-only runtime artifacts while Markdown stays canonical.

These recommendations are recorded in `09-decisions-log.md` as ADR-0020 and ADR-0021.

## Suggested Future Deliverable (Only If Approved)
`11-local-provider-compatibility-and-derived-persona-snapshot`

Suggested scope:
- Add provider-health diagnostics and configuration guidance for a local-provider-backed OpenClaw path.
- Define a derived persona snapshot format generated from canonical Markdown artifacts.
- Extend offline fallback replies and proactive prompts to consume the derived persona snapshot without granting it state authority.

Suggested non-goals:
- No embedded local model runtime in the app.
- No canonical structured-trait editor.
- No relaxation of local deterministic authority.

Suggested acceptance outcomes:
- Pet behavior remains responsive when local-provider health changes.
- Timeout/offline fallback behavior remains deterministic.
- Persona snapshot provenance is inspectable from debug output or diagnostics.

## Verification Gate
Pass when all are true:
1. At least three viable future architectures are compared against the current baseline.
2. Structured-trait canon vs Markdown-first canon is evaluated explicitly.
3. The recommendation preserves the current local-authority and advisory-AI architecture unless a strong case is made otherwise.
4. The output is decision-ready and can seed a future roadmap branch without reopening v1 scope.

## Gate Status
- `Research Gate`: `passed`
- `Overall`: `done`

## Change Log
- `2026-03-02`: File created as a post-v1 research deliverable for local-brain and offline-personality feasibility, intentionally outside the near-term implementation path.
- `2026-03-03`: Completed the D10 research pass with an architecture decision matrix, structured-traits recommendation, derived-persona sync contract, and a scoped post-v1 recommendation that preserves the current advisory-only architecture.
