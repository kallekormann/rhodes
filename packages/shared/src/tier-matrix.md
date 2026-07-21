# Rhodes tier matrix

Human-readable source of truth for subscription tiers. Code limits live in [`tiers.ts`](./tiers.ts). Billing integration is Phase 11.

## Tiers

| Tier | Audience |
|------|----------|
| `free` | Individual getting started |
| `basic` | Individual power user (between free and pro) |
| `pro` | Advanced individual / solo professional |
| `team` | Collaboration with shared team scopes |

## Limits

| Limit | free | basic | pro | team |
|-------|------|-------|-----|------|
| Personal scopes | 1 | 5 | Unlimited | Unlimited |
| Team scopes | 0 | 0 | 3 | Unlimited |
| Library storage | 100 MB | 1 GB | 5 GB | 50 GB |
| Max file size | 2 MB | 5 MB | 10 MB | 30 MB |
| Allowed file types | txt, md, docx | + pdf, docx, epub | + pdf, docx, ppt, epub | + pdf, docx, ppt, epub |
| Templates create | No | Yes | Yes | Yes |
| Properties manage | No | Yes | Yes | Yes |
| Ask messages / day | 20 | 100 | Unlimited | Unlimited |
| Insight debounce | 10000 ms | 5000 ms | 3000 ms | 3000 ms |
| Version history retention | 10 / doc | 25 / doc | 50 / doc | 100 / doc |
| **Additional scope views** (per scope) | 1 | 3 | 5 | 5 |

## Gated app views (header nav)

**Essential views (all tiers, always on):** `documents`, `editor`, `templates`, `library`, `settings`. These do not count toward additional scope view limits.

**Additional scope views** (Gantt, Calendar, Kanban, etc.) are built in a future session. The catalog and per-view tier gates live in [`scope-views.ts`](./scope-views.ts) when defined. Until then, only the per-tier **count limit** below is enforced at scope create/edit time.

| Tier | Max additional scope views per scope |
|------|--------------------------------------|
| free | 1 |
| basic | 3 |
| pro | 5 |
| team | 5 |

When the full catalog exists, each additional view may also have its own `minTier` (e.g. Dashboard → team). The count limit and per-view gate both apply.

## Feature flags (code)

| Feature key | free | basic | pro | team |
|-------------|------|-------|-----|------|
| `personal_scopes.create` | 1 max | 5 max | Unlimited | Unlimited |
| `team_scopes.create` | No | No | Yes | Yes |
| `library.upload` | Yes | Yes | Yes | Yes |
| `templates.create` | No | Yes | Yes | Yes |
| `properties.manage` | No | Yes | Yes | Yes |
| `ask.chat` | 20/day | 100/day | Unlimited | Unlimited |
| `scope_views.additional` | 1 max | 3 max | 5 max | 5 max |

## Dev override

`NEXT_PUBLIC_MOCK_TIER=free|basic|pro|team` in `apps/web/.env.local` (see `.env.example`). Defaults to `free` after Wave 4 enforcement audit.

### Library quota env overrides (server)

Optional MB overrides (unset = table above):

```bash
RHODES_LIBRARY_STORAGE_MB_FREE=100
RHODES_LIBRARY_STORAGE_MB_BASIC=1024
RHODES_LIBRARY_STORAGE_MB_PRO=5120
RHODES_LIBRARY_STORAGE_MB_TEAM=51200
RHODES_LIBRARY_MAX_FILE_MB_FREE=2
RHODES_LIBRARY_MAX_FILE_MB_BASIC=5
RHODES_LIBRARY_MAX_FILE_MB_PRO=10
RHODES_LIBRARY_MAX_FILE_MB_TEAM=30
```

Storage quota is **account-owner** scoped: sum of library file bytes across all workspaces the account owns (personal + team). Invited members uploading into a team spend the **owner’s** quota. UI meter lives in User settings.

Chunk/embedding cost is not shown; packing + per-file chunk caps keep indexed expansion bounded. See [docs/27-library-file-storage-vps.md](../../docs/27-library-file-storage-vps.md) for VPS object-storage / BYO.

## Notes

- **Team role gates** (viewer read-only, invite permissions) are separate from tier — see [`team-roles.ts`](./team-roles.ts).
- **Version pruning** cron is Phase 11+; retention numbers define max rows kept per document.
- **basic** exists to support a future mid-tier SKU without giving away pro/team collaboration features.
- **Additional scope views** catalog is deferred to a dedicated product session; Phase 8 only wires `enabled_views` storage, wizard UI shell, and count enforcement from limits above.
