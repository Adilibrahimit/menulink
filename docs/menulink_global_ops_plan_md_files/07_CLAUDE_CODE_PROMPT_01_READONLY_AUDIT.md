# 07 - Claude Code Prompt 01: Read-Only Audit

Copy the following prompt into Claude Code.

```text
You are Claude Code working on the MenuLink repository.

Project root:
D:\menulink

Mode:
READ-ONLY AUDIT ONLY.

Do not edit files.
Do not create migrations.
Do not deploy.
Do not rotate secrets.
Do not print secrets.
Do not push to Git.
Do not change environment variables.
Do not run destructive commands.
Do not implement anything yet.

Important strategic correction:
There are two separate tracks.

Track A:
MenuLink Global Operations Core.
This is for all current and future tenants, not only RzRz.
It includes:
- multi-branch support
- branch-scoped admins
- branch accounting
- business day based order numbering
- delivery routing
- pickup branch selection
- tables and QR
- drivers
- driver handoff and cash settlement
- cancellation and failure reasons
- reports
- bilingual Arabic/English language service with correct RTL/LTR behavior

Track B:
RzRz POS Workflow.
This is only for RzRz POS integration.
The RzRz Bridge App compatibility is already working and delivery invoices can already enter the RzRz POS as pending.
The remaining RzRz-specific problem is NOT whether Bridge App works.
The remaining problem is defining and implementing the correct POS workflow for:
1. delivery-type invoices
2. table-dining-type invoices

Also important:
The project has an OPS surface where platform admin can control services per restaurant.
Adding branches must be treated as a paid add-on service, not a free default feature.
The audit must inspect the existing OPS/addon/payment model before recommending implementation.

New bilingual requirement:
The full program must support Arabic and English across Customer PWA, Tenant Admin, and Platform OPS.
This must not be handled by random hardcoded translations.
Audit whether the project has a proper language/i18n service.
The future solution must support high-quality native Arabic copy, professional English copy, RTL for Arabic, LTR for English, dir="rtl" for Arabic, dir="ltr" for English, Arabic-Indic numeral formatting where appropriate, correct SAR/currency display in both directions, and no broken bidi layout.

Start by reading:
- memory.md
- README.md
- CLAUDE.md
- HANDOFF.md
- HANDOFF_SESSION_2026_05_24.md
- DESIGN.md
- PRICING.md
- ROADMAP.md
- vercel.json
- apps/web/package.json
- apps/web/app/ops/*
- apps/web/app/admin/*
- apps/web/app/m/[slug]/*
- apps/web/lib/*
- apps/web/supabase/migrations/*
- docs/proof if present
- any Bridge App / POS integration files if present
- any RzRz specific docs, code, or integration references

Audit goals:

1. Current project status
Report current surfaces, tenant model, OPS service model, payment/subscription model, order model, table/QR model if implemented, driver/cancellation support if any, language/i18n/RTL support if any, and RzRz status from repo evidence.

2. OPS add-on audit
Inspect how OPS controls tenant services, existing addon framework, payments/subscriptions, tenant detail page, how to add paid Multi-Branch, whether services are feature flags or hardcoded.

3. Bilingual language service audit
Inspect whether user-facing text is hardcoded, whether Arabic and English are supported, whether RTL is global or manual, whether an i18n framework exists, whether DB content supports name_ar/name_en and description_ar/description_en, whether admin/customer can switch language, whether price/SAR/numbers are direction-safe, whether Arabic text is native and not broken, and whether English UI can be supported without layout breakage.

4. Global Operations Core gap audit
Inspect what exists and what is missing for branches, branch_id on orders, branch WhatsApp, branch service types, branch admin permissions, branch accounting, business_date, invoice_sequence, daily_order_number, order_number_cycle, branch_order_counters, delivery routing, branch service areas, drivers, order_driver_assignments, cancellation reasons, order_events, and reports.

5. Customer flow audit
Audit current order types, delivery, pickup branch selection, dine-in QR, branch_id introduction risk, single-branch compatibility, and bilingual customer UI path.

6. Admin flow audit
Audit orders page, dashboard/accounting, owners model, branch filters, Owner all-branch access, Branch Admin access, Accountant handling, and bilingual admin UI path.

7. Business day and numbering audit
Inspect current order numbering, created_at usage, Riyadh date handling, helper utilities, todayRiyadhISO or similar, support for 10:00 AM to 04:00 AM business day, and safe number generation.

Important: number generation must be server-side or database transaction. Never recommend client-side "last number + 1".

8. Driver workflow audit
Inspect whether anything exists for drivers, driver assignment, order status transitions, cash settlement, cancellation reasons, returned orders, customer cancellation, and audit trail.

9. RzRz POS workflow audit
Find evidence of current RzRz Bridge App integration, delivery invoice insertion, table/stored procedure/endpoint used, pending status, POS invoice id storage, error handling, sync events, table workflow, and driver handoff workflow.

10. Risk register
Include risks for mixing global and RzRz-only code, free-by-accident branches, breaking single-branch tenants, client-side numbering, wrong midnight cutoff, branch admin leakage, cancellation without reason, POS sync failure losing order, table QR not tied to branch, duplicate daily numbers without cycle, no audit trail, hardcoded Arabic/English, broken RTL, and no language service.

Output format:
Write the final report in English using this structure:

# MenuLink Global Operations Core and RzRz POS Workflow Audit Report

## 1. Executive Summary
## 2. Correct Separation Between Global Core and RzRz POS
## 3. Current Status Based on Files
## 4. OPS and Paid Add-ons
## 5. Bilingual Language Service and RTL/LTR Gap Analysis
## 6. Global Plan Gap Analysis
## 7. Branches and Permissions Gap Analysis
## 8. Business Day and Numbering Gap Analysis
## 9. Drivers and Cancellation Gap Analysis
## 10. Tables and QR Gap Analysis
## 11. RzRz Delivery-Type POS Workflow
## 12. RzRz Table-Dining POS Workflow
## 13. Risk Register
## 14. Recommendations
## 15. Recommended First Implementation Phase After Approval
## 16. Questions That Need Answers Before Implementation

At the end write:
"This is a read-only report. I did not modify files, deploy, or change configuration."
```
