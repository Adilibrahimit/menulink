# 01 - MenuLink Global Operations Core Plan

## 1. Definition

This plan applies globally to all MenuLink restaurants:

- Current tenants.
- Future tenants.
- Single-branch restaurants.
- Multi-branch restaurants.
- WhatsApp-only restaurants.
- Restaurants with future POS integration.

This is not a RzRz-specific feature set.

## 2. Core Rule

```text
Each restaurant = one tenant
Each location = one branch under the same tenant
Each operational order should carry branch_id when branch features are enabled
```

## 3. What Global Operations Core Includes

| Capability | Description | Global for all tenants |
|---|---|---|
| Multi-Branch | More than one branch under one restaurant tenant | Yes |
| Branch Admin | Admin users scoped to one or more branches | Yes |
| Branch Accounting | Branch-level and consolidated accounting | Yes |
| Business Day | Operational day based on restaurant working hours | Yes |
| Order Numbering | Permanent invoice sequence and daily order number | Yes |
| Delivery Routing | Choose branch based on customer location | Yes |
| Pickup Branch Selection | Customer selects pickup branch | Yes |
| Tables / QR | Branch-linked table QR ordering | Yes |
| Drivers | Branch-level driver list | Yes |
| Driver Handoff | Assign order to driver and close accountability | Yes |
| Cancellation Reasons | Structured failure and cancellation reasons | Yes |
| Reports | Branch, driver, cancellation, and sales reporting | Yes |
| Bilingual UI | Arabic and English across customer and admin surfaces | Yes |

## 4. Branch Model

```text
Restaurant / Tenant
├── Branch 1
├── Branch 2
└── Branch N
```

### RzRz Example

```text
RzRz Bukhari
├── Aziziyah Branch
└── Malaz Branch
```

Each branch should have Arabic and English names, WhatsApp number, phone number, address, coordinates, business day start/end time, delivery service area, tables, drivers, activation status, and supported order types.

## 5. Order Type Behavior

### Delivery

```text
Customer chooses delivery
↓
Customer selects location
↓
MenuLink determines the nearest branch that covers the address
↓
Order is linked to branch_id
↓
Order is routed to the correct branch WhatsApp or POS integration
```

### Pickup

```text
Customer chooses pickup
↓
Available branches are shown
↓
Customer selects the branch
↓
Order is linked to selected branch_id
```

### Dine-in / Tables

```text
Customer scans table QR
↓
QR identifies branch_id and table_id
↓
Order type becomes dine_in
↓
Branch and table are automatically fixed
```

## 6. Business Day

MenuLink must not calculate operational reports by midnight only.

Example:

```text
Open: 10:00 AM
Close: 04:00 AM next day
```

| Actual time | business_date |
|---|---|
| May 24, 10:00 AM | 2026-05-24 |
| May 24, 11:30 PM | 2026-05-24 |
| May 25, 02:30 AM | 2026-05-24 |
| May 25, 10:00 AM | 2026-05-25 |

## 7. Invoice and Order Numbers

### invoice_sequence

A permanent audit/accounting number. It never resets, never duplicates, continues forever, and is used for accounting and POS mapping.

### daily_order_number

A customer and cashier-facing operational number. It resets by business_date, not midnight. If it reaches 1000, it can cycle back and requires an internal `order_number_cycle` to avoid ambiguity.

## 8. Drivers

Driver accountability starts when the branch hands the order to a driver, not only at final delivery.

```text
Order ready for driver
↓
Cashier selects driver
↓
Order is assigned to driver
↓
Driver leaves for delivery
↓
Driver delivers or returns with order
↓
Cash settlement or failure reason is recorded
```

## 9. Cancellation and Failure Reasons

Any cancellation or failed delivery must capture who cancelled, when it happened, at which stage, the reason, branch, driver if applicable, whether the order returned, whether cash was collected, and notes.

## 10. Reports

Reports must support all branches, a specific branch, business date, order type, driver, payment method, cancellation reason, and order status.

## 11. Summary

```text
Global Operations Core is built once inside MenuLink and reused by every current and future tenant.
RzRz is only the first POS workflow pilot.
```
