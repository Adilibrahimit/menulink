# 06 - Phase Roadmap

## 1. Execution Rule

Do not start by implementing branches directly.

The first implementation phase must protect commercial control through OPS add-on gates.

## 2. Phase 0 - Read-Only Audit

Understand the current codebase without changing anything. Scope: app, OPS add-ons, subscriptions/payments, customer/admin order flow, tables/QR, driver/cancellation logic if any, i18n/bilingual/RTL support, RzRz Bridge App, and how pending delivery invoice insert currently works.

## 3. Phase 1 - OPS Add-on Gates Foundation

Add or normalize paid service gates before building features.

Add-on keys:

- multi_branch
- branch_admins
- branch_accounting
- business_day_numbering
- tables_qr
- drivers
- delivery_zones
- advanced_reports
- pos_integration

## 4. Phase 2 - Language Service Foundation

Introduce a proper bilingual Arabic/English language service: translation keys, Arabic/English dictionaries, RTL/LTR helpers, number/currency/date formatting helpers. Do not perform a full app translation in one massive change.

## 5. Phase 3 - Global Branch Foundation

Implement restaurant_branches, branch_id in orders, branch WhatsApp, branch service types, single-branch backward compatibility, and OPS gate enforcement.

## 6. Phase 4 - Global Business Day + Numbering

Implement business_date, invoice_sequence, daily_order_number, order_number_cycle, branch_order_counters, and safe RPC/transaction-based generation.

## 7. Phase 5 - Global Branch Admin + Accounting

Owner sees all branches. Branch Admin sees assigned branches only. Accountant permissions, branch accounting, and consolidated accounting.

## 8. Phase 6 - Global Delivery Routing

Customer location, nearest branch selection, out-of-zone blocking, and branch/zone delivery fee.

## 9. Phase 7 - Global Driver Workflow

Drivers per branch, assign driver, handoff, out for delivery, delivered, returned with order, cash settlement, failure reason.

## 10. Phase 8 - Global Tables / QR

Tables per branch, QR for each table, dine_in order linked to branch and table.

## 11. Phase 9 - Global Cancellation Intelligence

Customer cancellation reasons, restaurant cancellation reasons, driver failure reasons, order_events, and reports.

## 12. Phase 10 - RzRz Delivery POS Workflow

Map MenuLink delivery order to RzRz pending delivery invoice, define delivery invoice lifecycle, driver handoff sync if POS supports it, cash settlement sync if POS supports it, failure/cancellation sync policy.

## 13. Phase 11 - RzRz Table POS Workflow

Open table, add items to table, kitchen print behavior, POS close/payment behavior, proof with real POS machine.

## 14. Guardrails

No deployment unless explicitly requested, no secrets printed, no RzRz-only branch system, no POS workflow before audit, no free paid features by accident, every major change needs a proof file, Arabic and English labels must be added through the language service and not hardcoded.
