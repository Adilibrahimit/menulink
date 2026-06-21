# Claude Code Master Prompt · Phase DS-1

Copy this into Claude Code after placing this planning pack in the repository.

---

## Prompt

You are working on the MenuLink repository.

Before making changes, read these files in order:

1. `memory.md`
2. `CLAUDE.md`
3. `DESIGN.md`
4. `GRAPH_REPORT.md`
5. `docs/design-print-studio/00_README.md`
6. `docs/design-print-studio/01_PRODUCT_BRIEF.md`
7. `docs/design-print-studio/02_ARCHITECTURE.md`
8. `docs/design-print-studio/03_DATABASE_SCHEMA.md`
9. `docs/design-print-studio/04_TEMPLATE_TAXONOMY.md`
10. `docs/design-print-studio/05_QR_DESIGN_SYSTEM.md`
11. `docs/design-print-studio/09_IMPLEMENTATION_PHASES.md`
12. `docs/design-print-studio/11_ACCEPTANCE_QA_CHECKLIST.md`
13. `docs/design-print-studio/12_SEED_TEMPLATES.md`

Your task is **Phase DS-1 only: Design & Print Studio Foundation**.

### Objective

Add the database and TypeScript foundation for:

- Brand identity templates
- Menu page templates
- Print templates
- QR design templates
- Restaurant design profiles
- Restaurant print profiles
- Restaurant QR profiles
- QR links
- QR exports
- Print exports
- Promotions
- Promotion items
- QR scan events

### Hard constraints

- Do not redesign `/m/[slug]`.
- Do not implement PDF generation.
- Do not install Remotion.
- Do not change POS integration.
- Do not break KO-KO.
- Do not break RzRz.
- Do not remove existing design form.
- Do not use hardcoded tenant IDs except if existing seed convention requires KO-KO test data.
- Do not print secrets.
- Do not modify unrelated files.
- Keep changes additive.

### Expected implementation

1. Create one new Supabase migration with all required tables, indexes, and RLS policies.
2. Seed starter templates idempotently.
3. Add TypeScript helper files under `apps/web/lib/design/`.
4. Add or update DB types only if the project uses manual types.
5. Add minimal validation and hashing utilities.
6. Add a proof document under `docs/proofs/`.
7. Run build.
8. Run available tests or type checks.
9. Report exact changed files.

### Starter template keys

Use these:

```text
koko-bold-v1
rzrz-navy-v1
velora-premium-v1
standard-clean-v1
cafe-minimal-v1

fast-food-grid-v1
premium-lounge-grid-v1

a3-full-menu-bold-v1
a4-full-menu-clean-v1

qr-standard-a4-poster-v1
qr-standard-table-tent-v1
qr-koko-bold-poster-v1
qr-rzrz-navy-table-v1
qr-velora-premium-card-v1
```

### Proof file

Create:

```text
docs/proofs/DS-1-design-print-studio-foundation.md
```

It must include:

- Goal
- Files changed
- Migration name
- Tables created
- RLS summary
- Seeds created
- Commands run
- Results
- Guardrails verified
- Known limitations
- Next recommended phase

### Final response format

Return:

```text
DS-1 RESULT
Status: PASS / PARTIAL / FAIL

Files changed:
...

Migration:
...

Verification:
...

Guardrails:
...

Next:
...
```

Stop after DS-1. Do not continue into DS-2.
