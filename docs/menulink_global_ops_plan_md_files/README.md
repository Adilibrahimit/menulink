# MenuLink Global Operations Core Plan

## Purpose

This documentation package defines the next strategic architecture for MenuLink in English.

It separates two tracks clearly:

1. **MenuLink Global Operations Core**
   - A platform-wide capability for all current and future restaurant tenants.
   - Includes multi-branch operations, branch-scoped admins, branch accounting, business-day order numbering, delivery routing, tables, drivers, cancellation reasons, reporting, and bilingual language support.

2. **RzRz POS Workflow**
   - A RzRz-specific POS workflow plan.
   - RzRz Bridge App compatibility is already working.
   - The remaining RzRz-specific issue is defining and implementing the correct workflow for delivery-type invoices and table-dining-type invoices.

## Files

| File | Purpose |
|---|---|
| `01_GLOBAL_OPERATIONS_CORE_PLAN.md` | Global platform plan for all tenants |
| `02_OPS_ADDONS_AND_BILLING_PLAN.md` | OPS-controlled paid add-ons and billing logic |
| `03_DATA_MODEL_SECURITY_AND_PERMISSIONS.md` | Data model, permissions, and security requirements |
| `04_RZRZ_POS_WORKFLOW_PLAN.md` | RzRz-specific POS workflow plan |
| `05_BILINGUAL_LANGUAGE_SERVICE_PLAN.md` | Arabic/English i18n and RTL/LTR language service plan |
| `06_PHASE_ROADMAP.md` | Recommended implementation phases |
| `07_CLAUDE_CODE_PROMPT_01_READONLY_AUDIT.md` | First Claude Code prompt for read-only audit |
| `08_CLAUDE_CODE_PROMPT_02_OPS_ADDON_GATES.md` | Claude Code prompt for Phase 1 implementation |

## Core Decision

```text
MenuLink Global Operations Core = for every tenant
RzRz POS Workflow = RzRz-only POS workflow pilot
OPS Add-ons = commercial control layer for paid tenant services
Language Service = bilingual Arabic/English platform capability
```

## Commercial Rule

Multi-branch support is not a free feature.

It must be controlled from the OPS surface as a paid add-on service.

## Bilingual Rule

The full app should support Arabic and English across Customer PWA, Tenant Admin, and Platform OPS.

This must be implemented through a proper language/i18n service, not random hardcoded translations. Arabic must enforce RTL correctly. English must enforce LTR correctly.
