# 13c Windows Notification Research Notes

Date: `2026-03-08`  
Status: `research_only`  
Related deliverable: `13c-persona-aware-offline-dialog-and-proactive-behavior`

## Goal
Document a practical, bounded path for future Windows notification-aware pet commentary without shipping notification-driven behavior in this `13c` iteration.

## Findings
- No current runtime lane ingests Windows notification content.
- Existing OS integration pattern (`windows-media-sensor.js` + PowerShell WinRT probe) is a workable model for a future notification probe lane.
- Notification capture introduces privacy/consent risk well above current local media metadata usage.
- A deterministic parser and bounded redaction layer are required before notification text can be safely surfaced to dialog/proactive systems.

## Recommended Future Implementation Path
1. Add a dedicated notification probe module and optional scheduled poll lane.
2. Gate notification access behind an explicit settings field with clear status provenance.
3. Keep first slice metadata-only:
   - app/source label
   - category/type
   - timestamp
   - no raw message body by default
4. Add a bounded allowlist parser for safe summary snippets before any dialog use.
5. Surface notification integration health and last-seen metadata in `Status -> Memory Runtime`.

## Policy Target Captured For Future Slice
- Default setting target requested by operator: notification integration enabled by default, with a visible on/off toggle in Settings.
- This policy is documented for future implementation only; no notification commentary path is shipped in this `13c` patch.

