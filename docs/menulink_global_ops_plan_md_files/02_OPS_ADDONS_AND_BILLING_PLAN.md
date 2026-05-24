# 02 - OPS Add-ons and Billing Plan

## 1. Concept

MenuLink has a Platform OPS surface where platform administrators manage tenant services.

Multi-branch support must be treated as a paid add-on, not a free default capability.

## 2. Commercial Decision

```text
Multi-Branch = Paid add-on
Branch Admin = related paid operational capability
Branch Accounting = paid operational reporting capability
Driver Workflow = paid operational capability
Tables / QR = paid dine-in capability
POS Integration = special paid integration capability
Bilingual Language Service = platform-wide requirement, not optional per tenant
```

## 3. Proposed Service Catalog

| Service | Type | Paid | Notes |
|---|---|---:|---|
| Basic Menu | Core | No | Base digital menu for one branch |
| WhatsApp Orders | Core | Included or base plan | Basic order submission |
| Multi-Branch | Add-on | Yes | More than one branch |
| Branch Admins | Add-on | Yes | Branch-scoped managers and cashiers |
| Branch Accounting | Add-on | Yes | Branch-level and consolidated accounting |
| Tables / QR | Add-on | Yes | Dine-in table ordering |
| Driver Workflow | Add-on | Yes | Driver assignment and settlement |
| Delivery Zones | Add-on | Yes | Delivery by location/service area |
| POS Integration | Add-on | Yes | Bridge App or API integration |
| Advanced Reports | Add-on | Yes | Deeper operational analytics |
| Bilingual Language Service | Platform core | No | Required quality baseline for all surfaces |

## 4. OPS Responsibilities

From the OPS tenant detail page, platform admin should be able to enable/disable multi-branch support, set max branches, enable branch admins, branch accounting, table QR, drivers, delivery zones, POS integration, assign service plan, register payment, and view subscription/billing status.

## 5. Example Feature Flags

```text
addons.multi_branch.enabled = true
addons.multi_branch.max_branches = 2
addons.branch_admins.enabled = true
addons.branch_accounting.enabled = true
addons.tables_qr.enabled = true
addons.tables_qr.max_tables = 50
addons.drivers.enabled = true
addons.drivers.max_drivers = 10
addons.delivery_zones.enabled = true
addons.pos_integration.enabled = true
addons.pos_integration.provider = rzrz_bridge
```

## 6. Behavior When Add-ons Are Disabled

When Multi-Branch is disabled, the restaurant operates as a single-branch tenant, branch management UI does not appear, branch filters do not appear, tenant admin cannot add branches, and orders continue through the existing single-branch flow.

When Multi-Branch is enabled, branch management UI becomes available, branch filters become available, branch-scoped permissions become available, orders carry branch context, and WhatsApp routing can become branch-specific.

## 7. Initial Pricing Concept

| Service | Monthly | Yearly |
|---|---:|---:|
| Multi-Branch Basic | 39 SAR | 399 SAR |
| Branch Accounting | 29 SAR | 299 SAR |
| Tables / QR | 39 SAR | 399 SAR |
| Driver Workflow | 49 SAR | 499 SAR |
| Delivery Zones | 39 SAR | 399 SAR |
| POS Integration | Custom | Custom |

## 8. Proposed Packs

- Standard: menu, WhatsApp orders, basic dashboard, one branch.
- Operations Pack: multi-branch, branch admins, branch accounting, drivers, cancellation reasons.
- Dine-in Pack: tables, QR, dine-in reports.
- POS Pack: Bridge App, POS workflow, sync monitoring, special support.

## 9. Important Rule

```text
Do not build paid capabilities as free UI features.
Every paid capability must have a service/add-on gate controlled from OPS.
```
