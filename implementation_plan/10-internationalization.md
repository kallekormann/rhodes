# Phase 10 — Internationalization

**Status:** planned  
**Depends on:** Phase 08  
**Blocks:** Phase 13  
**Estimated duration:** 3–5 days  
**Can parallel with:** Phases 09, 11, 12

---

## Objectives

1. Support **5 UI locales**: EN (primary), ES, DE, FR, IT.
2. Wire language preference from user profile / Settings.
3. Ensure **LLM responses** respect user and document language.
4. Ship **spellcheck dictionary packs** for all 5 locales (engine may land earlier with EN-only; Phase 10 completes ES/DE/FR/IT).
5. Meet NFR DoD #5.

---

## Prerequisites

- Phase 08 exit criteria met (Settings Preferences section with language dropdown).
- All UI strings identifiable in codebase.

---

## Canonical spec references

- [21-i18n.md](../docs/21-i18n.md)
- [18-non-functional-requirements.md](../docs/18-non-functional-requirements.md) — DoD #5
- [23-user-settings-and-spaces.md](../docs/23-user-settings-and-spaces.md) — language setting
- Ask / Writing Coach spellcheck plan — client `nspell` + locale dicts (EN first in product hardening; remaining locales here)

---

## Docker services touched

None.

---

## File checklist

```
apps/web/
├── messages/
│   ├── en.json
│   ├── es.json
│   ├── de.json
│   ├── fr.json
│   └── it.json
├── src/i18n/
│   ├── config.ts                   # Locales list, default
│   ├── request.ts                  # next-intl request config
│   └── routing.ts                  # Locale prefix strategy
├── middleware.ts                   # Extend with locale detection
└── src/app/[locale]/               # Optional locale segment
    └── (app)/...
```

---

## Locale strategy

| Locale | Code | Notes |
|--------|------|-------|
| English | `en` | Default, fallback |
| Spanish | `es` | |
| German | `de` | |
| French | `fr` | |
| Italian | `it` | |

**No RTL** in V1.

**URL strategy (recommended):** No locale prefix in URL for V1 — locale from user profile cookie/header. Simpler for editor URLs. Add `/en/...` prefix in V2 if needed for SEO.

---

## Step-by-step tasks

### 1. Install and configure next-intl

```bash
pnpm add next-intl --filter web
```

**`i18n/config.ts`:**
```typescript
export const locales = ['en', 'es', 'de', 'fr', 'it'] as const;
export const defaultLocale = 'en';
```

### 2. Extract UI strings

Audit all user-visible strings in:
- App shell (header, Cmd+K, toasts)
- Auth pages
- Editor (placeholder, bubble menu labels)
- Documents, Library, Settings
- Right Panel tabs
- Error messages

Replace with `useTranslations()` / `t('key')` calls.

**`messages/en.json` structure:**
```json
{
  "common": { "save": "Save", "cancel": "Cancel", ... },
  "header": { "documents": "Documents", "library": "Library", ... },
  "editor": { "placeholder": "Start writing…", ... },
  "settings": { "profile": "Profile", ... },
  "insights": { "whyRelevant": "Why relevant?", ... }
}
```

### 3. Translate message files

- `es.json`, `de.json`, `fr.json`, `it.json` — professional translation or high-quality MT + review
- Keep keys identical across files
- CI check: all locales have same keys as `en.json`

### 4. User locale preference

- Store in `auth.users.locale` or `profiles.locale`
- Settings → Preferences → Language dropdown
- On change: `updateUser` / PATCH profile + set `NEXT_LOCALE` cookie
- `next-intl` reads cookie on each request

### 5. Date and number formatting

Use `Intl.DateTimeFormat` with active locale:
- Document "Updated 8m ago" → use `next-intl` `useFormatter()` or `date-fns` with locale
- Comment timestamps, version history dates

### 6. LLM language

**`packages/ai/src/prompts.ts`:**
```typescript
export function systemPrompt(locale: string, docLanguage?: string) {
  const lang = docLanguage || locale;
  return `Respond in ${langName(lang)}. ...`;
}
```

Pass `profiles.locale` and `documents.detected_language` to Ask and "Why relevant?" calls.

**Document language detection:** Simple heuristic on save (franc library or first-500-char langdetect) → `documents.detected_language`.

### 7. Auth pages i18n

Login, register, forgot password — all strings translated.

### 8. Spellcheck dictionaries (ES / DE / FR / IT)

Depends on the client spellcheck engine (`nspell` + Hunspell-compatible dicts) landing with **EN** earlier (Editor underlines + Writing Coach `check_spelling` tool).

**This phase:**

1. Add dictionary assets for `es`, `de`, `fr`, `it` (lazy-load by locale — do not bundle all five into first paint).
2. Wire active locale from profile / editor `lang` → `check_spelling({ text, locale })` and TipTap spell decorations.
3. Settings: language change reloads the matching dict; keep a small personal ignore list per locale (local only).
4. Verify Coach + optional Ask proofread use the same locale as UI/doc.
5. Document size/licensing of dict packs in README or `docs/21-i18n.md`.

**Exit for spellcheck:** switching Settings language to ES/DE/FR/IT underlines and Coach suggestions use that locale’s dictionary (not EN-only).

### 9. CI validation

```bash
# Script: compare keys across locale files
node scripts/validate-i18n.js
```

Fail CI if any locale missing keys.

---

## Environment variables

| Variable | Purpose |
|----------|---------|
| `DEFAULT_LOCALE` | `en` (optional override) |

---

## Testing checklist

- [ ] Switch language in Settings → UI updates without reload (or on reload)
- [ ] All 5 locales render without missing key errors
- [ ] Auth pages translated
- [ ] Cmd+K commands translated
- [ ] Toast messages translated
- [ ] Date formatting respects locale
- [ ] Ask chat responds in user's locale when question is in that language
- [ ] Spellcheck: ES/DE/FR/IT dicts load with locale; Editor marks + Writing Coach `check_spelling` respect locale
- [ ] `validate-i18n.js` passes in CI
- [ ] Fallback to EN for missing translation key

---

## Exit criteria

1. UI renders in EN, ES, DE, FR, IT.
2. Language preference persists in profile.
3. LLM prompts include locale/language instruction.
4. Spellcheck dictionaries available for all 5 locales (EN may ship earlier; Phase 10 completes the set).
5. NFR DoD #5 satisfied.

---

## Risks and mitigations

| Risk | Mitigation |
|------|------------|
| Missing translations at ship | CI key parity check; fallback to EN |
| TipTap placeholder i18n | Set via extension config on locale change |
| Spellcheck dict bundle size | Lazy-load per locale; EN in core chunk |
| Legal pages (privacy) not translated | V1: EN only for legal; note in settings |

---

## Deliverables

- next-intl setup
- 5 message JSON files
- All UI strings extracted
- Language preference wired
- LLM locale-aware prompts
- Spellcheck dictionary packs for `en` / `es` / `de` / `fr` / `it` (lazy-loaded)
- CI i18n validation script

**Merge:** PR `feature/phase-10-i18n` → `dev` → `main` when exit criteria met.
