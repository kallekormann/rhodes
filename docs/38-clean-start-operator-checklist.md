# Operator checklist — clean document start

After wiping documents for a test scope:

1. Run wipe (example):
   ```bash
   pnpm db:wipe:docs -- --workspace-id=<uuid> --reset-layouts
   # dry-run first:
   pnpm db:wipe:docs -- --workspace-id=<uuid> --dry-run
   ```
2. In the Rhodes app: **Settings → clear offline / synced cache** (or log out) so IndexedDB does not resurrect deleted docs.
3. Hard refresh the browser.
4. Ensure migration `00079_template_properties_ui_audit` is applied (`pnpm db:migrate`) so new template schemas match the audit.
5. Seed fixtures: `SEED_WORKSPACE_ID=<uuid> pnpm db:seed:views`

Does **not** wipe: library files, metadata schemas, view instance configs (only optional layout null for mindmap/wiki).
