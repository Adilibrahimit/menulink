# 08 - Claude Code Prompt 02: OPS Add-on Gates Foundation

Copy the following prompt into Claude Code after the read-only audit is reviewed and approved.

```text
You are Claude Code working on the MenuLink repository.

Project root:
D:\menulink

Phase:
Phase 1 - OPS Add-on Gates Foundation

Important:
Do not implement branches, drivers, business day numbering, delivery routing, tables, or RzRz POS workflows in this phase.

This phase only prepares paid OPS-controlled add-on gates so later implementation does not ship as a free feature by accident.

Strategic rules:
1. Multi-Branch, Branch Admin, Branch Accounting, Drivers, Delivery Zones, Tables/QR, Business Day Numbering, Advanced Reports, and POS Integration are Global MenuLink capabilities for all current and future tenants.
2. These are NOT RzRz-only features.
3. RzRz POS work is separate and deferred.
4. RzRz Bridge App already works for pending delivery invoice insert.
5. The app must eventually support Arabic and English across Customer PWA, Tenant Admin, and OPS through a proper language service, not hardcoded strings.
6. Arabic UI must be RTL. English UI must be LTR.

Start by reading:
- memory.md
- CLAUDE.md
- docs/menulink_global_ops_plan_english/01_GLOBAL_OPERATIONS_CORE_PLAN.md
- docs/menulink_global_ops_plan_english/02_OPS_ADDONS_AND_BILLING_PLAN.md
- docs/menulink_global_ops_plan_english/03_DATA_MODEL_SECURITY_AND_PERMISSIONS.md
- docs/menulink_global_ops_plan_english/05_BILINGUAL_LANGUAGE_SERVICE_PLAN.md
- docs/menulink_global_ops_plan_english/06_PHASE_ROADMAP.md
- latest audit report if available
- apps/web/app/ops/*
- apps/web/lib/*
- apps/web/supabase/migrations/*
- current addon/service/payment implementation

Goal:
Implement the OPS-controlled add-on catalog foundation for the future Global Operations Core.

Required add-on keys:
- multi_branch
- branch_admins
- branch_accounting
- business_day_numbering
- tables_qr
- drivers
- delivery_zones
- advanced_reports
- pos_integration, only if current catalog needs normalization or it already exists in another form

Bilingual label requirement:
Any new user-facing labels must be available in both Arabic and English. Do not add new hardcoded Arabic-only labels if the existing architecture has or can cleanly support translation keys. If no language service exists yet, keep the implementation minimal and document the gap in the proof file instead of building a full i18n refactor in this phase.

Suggested labels:
- multi_branch: Arabic "الفروع المتعددة", English "Multi-Branch"
- branch_admins: Arabic "مدراء الفروع", English "Branch Admins"
- branch_accounting: Arabic "حسابات الفروع", English "Branch Accounting"
- business_day_numbering: Arabic "أرقام الطلبات حسب يوم التشغيل", English "Business-Day Order Numbering"
- tables_qr: Arabic "الطاولات و QR", English "Tables and QR"
- drivers: Arabic "السائقين", English "Drivers"
- delivery_zones: Arabic "نطاقات التوصيل", English "Delivery Zones"
- advanced_reports: Arabic "التقارير المتقدمة", English "Advanced Reports"
- pos_integration: Arabic "تكامل نقاط البيع", English "POS Integration"

Scope:
1. Inspect the existing addon framework.
2. Reuse existing addon/service model if present.
3. Add missing catalog entries using the existing pattern.
4. Make sure OPS can view and toggle these services per tenant if the current OPS design supports toggles.
5. Add limits/config fields only if the current model already supports JSON config or similar.
6. Do not create a separate new addon framework if one already exists.
7. Preserve backward compatibility for all existing tenants.

Expected behavior after this phase:
- Existing tenants continue working exactly as before.
- OPS can see the new paid services.
- Services are disabled by default unless explicitly enabled.
- No customer-facing branch UI appears yet.
- No admin branch UI appears yet.
- No order schema behavior changes yet.
- No RzRz POS workflow changes yet.

If migrations are needed:
- Add a migration using the next sequence number.
- Seed the new add-on catalog entries idempotently.
- Do not modify production data destructively.
- Do not enable the new services for all tenants automatically.

Testing:
Run safe checks: npm run build, plus lint/typecheck/test if available.

Proof:
Create docs/proof/MENULINK_PHASE1_OPS_ADDON_GATES_PROOF.md with files changed, migration added if any, add-on keys, Arabic and English labels, default state, OPS UI behavior, build result, regression notes, confirmation that no branch/order/driver/POS workflow was implemented, and any language service gap discovered.

Guardrails:
- Do not deploy.
- Do not print secrets.
- Do not rotate secrets.
- Do not implement branches.
- Do not add branch_id to orders yet.
- Do not implement drivers.
- Do not implement business day numbering yet.
- Do not implement RzRz POS delivery workflow.
- Do not implement RzRz table workflow.
- Do not change customer PWA behavior.
- Do not make paid features free by default.

Final response:
Write a concise Arabic summary with what changed, what was not changed, build/test result, and proof file path.
```
