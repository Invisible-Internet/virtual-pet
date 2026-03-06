# Deliverable XXx: Replace With Slice Title

<!-- Copy this file to docs/plan/11a-your-slice-name.md before starting a new post-v1 deliverable. -->
<!-- Replace all placeholder values. Keep the required sections and status/gate vocabulary intact. -->

**Deliverable ID:** `11a-example-slice`  
**Status:** `queued`  
**Owner:** `Mic + Codex`  
**Last Updated:** `YYYY-MM-DD`  
**Depends On:** `list dependencies or 'none'`  
**Blocks:** `list downstream dependency or 'none'`

## Objective
<!-- One short paragraph: what this slice is for and why it exists. -->

## In Scope
- <!-- bullet -->
- <!-- bullet -->

## Out of Scope
- <!-- bullet -->
- <!-- bullet -->

## Environment / Prerequisites
- <!-- required runtime modes, local services, settings, or platform assumptions -->

## Showcase Promise (Mandatory)
<!-- Describe the one visible operator outcome this slice exists to prove. -->

## Operator Demo Script (Mandatory)
1. <!-- exact starting state -->
2. <!-- exact user action -->
3. <!-- exact visible signal -->
4. <!-- exact visible signal -->
5. <!-- pass condition -->

## Failure / Recovery Script (Mandatory)
1. <!-- what fails or is disabled -->
2. <!-- what the user should still see -->
3. <!-- what recovery looks like, if applicable -->

## Quick Operator Test Card (Mandatory)
### Preflight (2 min max)
1. Run: `<!-- exact command, usually npm start -->`
2. Open: `<!-- exact tray/menu/tab path -->`
3. Confirm start signal: `<!-- exact visible text/chip/status -->`

### Happy Path (5 min max)
1. Action: `<!-- click/type action -->`
   - Expect: `<!-- exact visible signal -->`
2. Action: `<!-- click/type action -->`
   - Expect: `<!-- exact visible signal -->`
3. Action: `<!-- click/type action -->`
   - Expect: `<!-- exact visible signal -->`

### Failure + Recovery (5 min max)
1. Break it: `<!-- explicit break action -->`
   - Expect degraded signal: `<!-- exact visible degraded text/state -->`
2. Recover it: `<!-- explicit recovery action -->`
   - Expect recovered signal: `<!-- exact visible recovered text/state -->`

### Pass / Fail Checklist
- [ ] `<!-- happy-path signal #1 seen -->`
- [ ] `<!-- happy-path signal #2 seen -->`
- [ ] `<!-- degraded signal seen -->`
- [ ] `<!-- recovered signal seen -->`

## Acceptance Evidence Checklist (Mandatory)
- [ ] `<!-- status line text copied -->`
- [ ] `<!-- probe/check output copied -->`
- [ ] `<!-- screenshot path or note -->`
- [ ] `<!-- terminal command output line copied -->`

## Public Interfaces / Touchpoints
- <!-- files, settings keys, commands, controls, IPC paths, UI surfaces, or docs touched by this slice -->

## Acceptance Bar
- <!-- what counts as accepted -->
- <!-- what counts as incomplete / needs another pass -->

## Implementation Slice (Mandatory)
- <!-- smallest vertical slice built so far -->
- <!-- checks or scripts added/updated -->
- <!-- visible controls or entry points exposed -->

## Visible App Outcome
- <!-- what the operator can now see or do -->
- <!-- what changed from before -->

## Acceptance Notes
- <!-- operator pass/fail notes go here -->
- <!-- evidence references, if any -->

## Iteration Log
- `YYYY-MM-DD`: <!-- operator mismatch, refinement, or reopened detail -->

## Gate Status
- `Spec Gate`: `not_started`
- `Build Gate`: `not_started`
- `Acceptance Gate`: `not_started`
- `Overall`: `queued`

## Change Log
- `YYYY-MM-DD`: File created from the post-v1 deliverable template.

## Authoring Notes
<!-- Keep or delete these notes after the file is filled in. -->
- Start the file in `specifying`.
- Pass `Spec Gate` before implementation begins.
- Move to `implementing` only after the demo and failure scripts are stable.
- If operator feedback finds visible gaps, set status to `iterating`.
- Use `accepted` only after the operator demo and failure/recovery script both pass.
