# 03 - Data Model, Security and Permissions

## 1. Goal

Define a global data model that supports branches, branch-scoped permissions, branch accounting, drivers, tables, business day, order numbering, cancellation reasons, audit trail, OPS-controlled paid add-ons, and bilingual labels.

## 2. Proposed Tables

### restaurant_branches

```text
restaurant_branches
├── id
├── restaurant_id
├── name_ar
├── name_en
├── slug
├── whatsapp
├── phone
├── address_ar
├── address_en
├── lat
├── lng
├── timezone
├── business_day_start
├── business_day_end
├── supports_delivery
├── supports_pickup
├── supports_dine_in
├── supports_car
├── is_active
├── sort_order
├── created_at
```

### branch_service_areas

```text
branch_service_areas
├── id
├── branch_id
├── area_type
├── radius_km
├── polygon_geojson
├── delivery_fee
├── min_order
├── estimated_minutes
├── is_active
```

### branch_order_counters

```text
branch_order_counters
├── id
├── branch_id
├── business_date
├── next_daily_order_number
├── daily_order_cycle
├── next_invoice_sequence
├── updated_at
```

### orders additions

```text
orders
├── branch_id
├── business_date
├── invoice_sequence
├── daily_order_number
├── order_number_cycle
├── customer_location_lat
├── customer_location_lng
├── customer_address_label
├── customer_address_details
├── payment_method
├── cancellation_reason_id
├── cancelled_by_actor_type
├── cancelled_at
```

### restaurant_tables

```text
restaurant_tables
├── id
├── restaurant_id
├── branch_id
├── table_number
├── display_name_ar
├── display_name_en
├── qr_token
├── is_active
├── sort_order
```

### drivers

```text
drivers
├── id
├── restaurant_id
├── branch_id
├── name
├── phone
├── driver_type
├── is_active
├── created_at
```

### order_driver_assignments

```text
order_driver_assignments
├── id
├── order_id
├── restaurant_id
├── branch_id
├── driver_id
├── assigned_by_admin_id
├── assigned_at
├── handed_to_driver_at
├── out_for_delivery_at
├── returned_at
├── delivery_result
├── failure_reason_id
├── driver_note
├── cash_expected
├── cash_collected
├── cash_settled
├── settlement_status
```

### order_reasons

```text
order_reasons
├── id
├── restaurant_id
├── reason_type
├── code
├── label_ar
├── label_en
├── is_active
├── sort_order
```

### order_events

```text
order_events
├── id
├── order_id
├── restaurant_id
├── branch_id
├── event_type
├── old_status
├── new_status
├── actor_type
├── actor_id
├── reason_id
├── note
├── created_at
```

### restaurant_admins and branch access

```text
restaurant_admins
├── id
├── user_id
├── restaurant_id
├── role
├── is_active
├── created_at

restaurant_admin_branch_access
├── id
├── admin_id
├── branch_id
```

### tenant_addons

```text
tenant_addons
├── id
├── restaurant_id
├── addon_key
├── is_enabled
├── plan_code
├── limit_json
├── billing_status
├── starts_at
├── ends_at
├── created_at
```

## 3. Roles

| Role | Permission scope |
|---|---|
| Owner | All branches, all accounting, all settings |
| Branch Manager | Assigned branches only |
| Cashier | Operational order handling for assigned branches |
| Accountant | Accounting only, scoped by access |
| Viewer | Read-only |
| Platform Ops | Platform-level service and billing control |

## 4. RLS and Permission Rules

Owner can view all restaurant data. Branch Manager can view only assigned branch orders. Cashier can operate assigned branch orders. Accountant can view accounting reports based on assigned branch scope. Platform Ops can manage tenant services, billing, and add-ons.

## 5. Required Unique Constraints

```text
unique(branch_id, invoice_sequence)
unique(branch_id, business_date, daily_order_number, order_number_cycle)
unique(branch_id, table_number)
unique(branch_id, qr_token)
```

## 6. Number Generation

Order numbers must be generated server-side or inside a database transaction. Never generate operational order numbers in the browser.

## 7. Audit Trail

Every important order state transition must be recorded in `order_events`.

## 8. Localization Data Rule

Any user-facing label stored in the database should support Arabic and English fields where it matters, such as `label_ar`, `label_en`, `name_ar`, `name_en`, `description_ar`, and `description_en`.
