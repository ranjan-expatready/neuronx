# Factory Configuration Directory

Factory configuration lives here. Do not add competing rules; canonical governance is established in:

- `/AGENTS.md` – agent operating rules and evidence requirements
- `/docs/SSOT/index.md` – Single Source of Truth documentation hub

The SessionStart hook that loads canonical context on every Factory/Droid session is defined in:

- `.factory/hooks/neuronx_session_start.sh`
- Registered in `.factory/settings.json`

These hooks ensure no drift from SSOT and enforce the mandatory bootstrap ritual automatically.

All changes to this directory must respect the No-Drift Policy and reference canonical sources rather than duplicating them.
