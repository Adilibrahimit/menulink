# 04 - RzRz POS Workflow Plan

## 1. Definition

This plan is specific to RzRz POS integration. It is not the global branch/driver/table plan for all tenants.

## 2. Current Status

```text
RzRz Bridge App = working successfully
Delivery invoices can enter RzRz POS
They enter as pending/held invoices
```

The current problem is not proving the Bridge App works. The current problem is defining the correct POS workflow for delivery-type invoices and table-dining-type invoices.

## 3. Plan Boundary

### MenuLink Global Core Owns

Branches, drivers, tables, business day, order numbers, cancellation reasons, operational reports, and customer/admin bilingual UI.

### RzRz POS Workflow Owns

How invoices enter RzRz POS, POS status transitions, opening POS tables, adding items to POS tables, driver handoff behavior in POS if supported, cash settlement behavior in POS if supported, and cancellation/return behavior inside POS.

## 4. Delivery-Type Invoice Workflow

```text
MenuLink Delivery Order
↓
Bridge App
↓
RzRz Pending Delivery Invoice
↓
Confirm / Prepare
↓
Hand off to driver
↓
Driver delivers or returns
↓
Cash settlement or failure reason
↓
Close invoice
```

### Audit Questions

| Question | Needed decision |
|---|---|
| How is the pending delivery invoice currently inserted? | Identify table, stored procedure, or service call |
| Does RzRz support confirmed/preparing states? | Define status mapping |
| Does POS have drivers table? | Map MenuLink driver to POS driver |
| Does POS support driver handoff? | Use POS workflow or keep in MenuLink |
| Where should cash collection be recorded? | POS, MenuLink, or both |
| If driver returns with order, should invoice be cancelled or marked failed? | Accounting decision |
| Does POS have cancellation reasons? | Sync or retain in MenuLink |
| Who owns invoice number? | POS or MenuLink mapping |

## 5. Table-Dining Type Invoice Workflow

```text
Customer scans table QR
↓
MenuLink knows branch_id and table_id
↓
Customer submits dine-in order
↓
Bridge App opens table or finds existing open table
↓
Bridge App adds items to the table
↓
POS triggers kitchen print if supported
↓
Cashier closes table/payment from POS
```

### Audit Questions

| Question | Needed decision |
|---|---|
| How does RzRz open a table? | Table insert or stored procedure |
| Does POS table have an internal ID? | QR-to-POS mapping |
| Can items be added to an already open table? | Core requirement |
| If table is open, should new MenuLink order append or block? | Workflow decision |
| Does adding items trigger kitchen print? | Critical for operations |
| Should table close/payment remain in POS only? | Ownership decision |
| Does MenuLink need reverse sync of table status? | Reporting/follow-up decision |

## 6. Source of Truth

```text
MenuLink = operational truth
POS = execution/accounting target
```

A POS sync failure must not delete or lose the MenuLink order. Successful POS sync must create a sync event.

## 7. POS Sync Events

Every POS sync attempt should be logged in `pos_sync_events` with restaurant, branch, order, provider, operation type, status, request/response summary, external invoice ID, error code, error message, and timestamp.

## 8. POS Operations

| operation_type | Description |
|---|---|
| create_delivery_invoice | Create delivery invoice in POS |
| update_delivery_status | Update delivery status |
| assign_driver | Assign driver if POS supports it |
| settle_driver_cash | Record driver cash settlement |
| cancel_delivery_invoice | Cancel or fail delivery invoice |
| open_table | Open dining table |
| add_table_items | Add items to table invoice |
| close_table_sync | Sync table close if supported |
