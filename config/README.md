# Runtime Settings

## Files
- `config/settings.json`: tracked defaults and team-safe baseline.
- `config/settings.local.json`: local machine overrides (gitignored).
- `%APPDATA%/virtual-pet/settings.json`: packaged app runtime overrides.

## Resolution Order
1. Base defaults from `config/settings.json` (or bundled defaults in packaged app).
2. Local override file:
   - dev: `config/settings.local.json`
   - packaged: `%APPDATA%/virtual-pet/settings.json`
3. Environment variable overrides (highest precedence).

## Security
- Keep API tokens in environment variables or local override files only.
- Do not commit auth tokens to tracked settings files.

## Manual Commands
- Connectivity and prerequisite check:
  - `node scripts/check-workspace-connectivity.js`
- Bootstrap OpenClaw workspace files (`SOUL.md`, `IDENTITY.md`, `USER.md`, `MEMORY.md`):
  - `node scripts/check-workspace-connectivity.js --bootstrap-openclaw`
- Bootstrap Obsidian vault folders:
  - `node scripts/check-workspace-connectivity.js --bootstrap-obsidian`
