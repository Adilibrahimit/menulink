# LAB-1: Test Tenant Verification

**Date:** 2026-05-26
**Phase:** 0

## Test Tenant Details

| Field | Value |
|-------|-------|
| restaurant_id | `c13aa2bf-df82-4c30-810d-f9ea833ed3cc` |
| slug | `rzrz-bukhari-test` |
| name | `RzRz Bukhari TEST` |
| tagline | `⚠️ نسخة تجريبية — الطلبات لا تُرسل للمطعم` |
| WhatsApp phone | `966504744517` (different from live RzRz `966535329510`) |
| is_published | `true` |
| is_active | `true` |
| URL | `/m/rzrz-bukhari-test` |

## Safety Checks

- [x] Test tenant exists in database
- [x] Clearly marked TEST in name ("RzRz Bukhari TEST")
- [x] Tagline warns this is a test copy
- [x] WhatsApp number differs from live RzRz (test orders won't reach real restaurant)
- [x] Separate restaurant_id from live RzRz (`ef60381c-...`)

## Flag: POS sync enabled

`pos_bridge` addon is currently **enabled** on the test tenant. The plan specified it should be disabled by default. This may have been enabled manually after initial creation. **Needs user decision** before F4/F5 work begins — disable POS sync on test tenant to avoid accidental order forwarding?

## Production Safety

- KO-KO tenant: NOT modified
- Live RzRz tenant: NOT modified
- No data was written or changed during this verification
