# Adapter Pattern · Adding A New POS Type

> Read when integrating a POS that's not RzRz or Foodics.

## The Universal Contract

Every POS integration in MenuLink implements this TypeScript interface:

```typescript
interface POSAdapter {
  /** Unique slug for this POS type — e.g. "rzrz", "foodics", "marn" */
  readonly name: string;
  
  /** Verify the customer's credentials work */
  testConnection(config: POSConfig): Promise<{ ok: boolean; error?: string }>;
  
  /** Read the customer's menu from their POS */
  importMenu(config: POSConfig): Promise<POSMenuItem[]>;
  
  /** Push a MenuLink order to their POS */
  pushOrder(order: MenuLinkOrder, config: POSConfig): Promise<POSPushResult>;
  
  /** (Optional) Subscribe to status updates from POS */
  subscribeToStatus?(config: POSConfig, onUpdate: (update: POSStatusUpdate) => void): Unsubscribe;
}

interface POSConfig {
  // Whatever the specific adapter needs:
  // - API tokens for Foodics
  // - DB connection string for RzRz
  // - Webhook URL for others
  [key: string]: any;
}

interface POSPushResult {
  success: boolean;
  pos_order_id?: string;  // The ID the POS assigned to this order
  error?: { code: string; message: string };
}
```

## When To Build A New Adapter

✋ **Stop before you start.** Building an adapter is 1-2 weeks of work. Before saying yes:

1. Does this customer have a POS in our existing tiers (Foodics, Marn, RzRz, Loyverse, Square)? Use those.
2. Has the customer demanded integration, or are they fine with WhatsApp-only?
3. Will more than 3 future customers use this same POS? If not, skip — Tier 0 is fine.
4. Does the POS have a public API or documented integration option?

If all answers point to "yes, build it" — proceed.

## Build Order For A New Adapter

### Phase 1: Discovery (1 day)
- Read the POS's API documentation cover-to-cover
- Test their sandbox if available
- Document their data model (how do they call orders, items, customers?)
- Note their auth mechanism (API key? OAuth? Signed requests?)

### Phase 2: Adapter Skeleton (1 day)
- Create `src/pos-adapters/<pos-name>/`
- Add `index.ts` exporting a class that implements `POSAdapter`
- Implement `testConnection` first — this is the simplest method
- Add config schema to `pos_adapters` table in Supabase

### Phase 3: Menu Import (1-2 days)
- Implement `importMenu`
- Test with real customer credentials
- Handle pagination if they return >100 items at a time
- Normalize their data shape into our `POSMenuItem` interface

### Phase 4: Order Push (2-3 days)
- Implement `pushOrder`
- Map MenuLink order shape → their order shape
- Handle their error codes
- Test with cheap fake orders

### Phase 5: Status Sync (Optional, 1-2 days)
- Implement `subscribeToStatus` if their API supports webhooks/polling
- Send status updates back to the MenuLink customer's phone

### Phase 6: Registration & Onboarding (1 day)
- Add the new adapter to the registry in `src/pos-adapters/index.ts`
- Add the option to the customer-facing setup wizard
- Update `onboarding-playbook.md` with the new tier
- Add to `learnings.md` what you discovered building this

**Total: 1-2 weeks for a competent integration.**

## Existing Adapters (Reference Implementations)

| Adapter | Tier | Status | Reference |
|---------|------|--------|-----------|
| `rzrz` | 1 | In design | `references/rzrz-deep-dive.md` + `references/sql-patterns.md` |
| `foodics` | 2 | Not built | (planned — see HANDOFF.md phase 4) |
| `whatsapp` | 0 | Built in v6 | This is the default fallback |

## Patterns To Steal

### Idempotency (always)
Every `pushOrder` must be safe to call twice with the same order_id. Use:
- An idempotency key in the request (UUID = order.id)
- Check before insert (or use upsert)
- Return the same result on duplicate calls

### Retry with backoff (always)
Wrap `pushOrder` calls in retry logic. 3 attempts max with 1s, 2s, 4s spacing.

### Circuit breaker (when POS goes down)
If 5 consecutive `pushOrder` calls fail, mark the customer's integration as "degraded" and send them a WhatsApp alert. Stop trying for 5 minutes, then retry.

### Two-way audit log
Every `pushOrder` writes to `pos_sync_log` table:
- request_payload
- response_payload  
- timestamp
- duration_ms
- success boolean

This is gold for debugging customer issues 3 weeks after the fact.

## Things To NEVER Do

❌ Hardcode credentials in the adapter code  
❌ Log the full request/response (might contain PII)  
❌ Block the order save if POS push fails — order still goes via WhatsApp  
❌ Promise the customer real-time sync if the POS only supports webhooks  
❌ Skip the test order step during onboarding  

## What Belongs In The Adapter vs. Outside

| In the adapter | Outside the adapter |
|----------------|---------------------|
| API/SQL calls | Order validation |
| Format mapping | Database persistence |
| Retry logic | Customer notifications |
| POS-specific quirks | Pricing calculations |

Keep adapters laser-focused on "talk to this POS". Everything else lives in the main MenuLink logic.

## When To Update This File

Add to this playbook whenever:
- A pattern from one adapter could help future adapters
- You hit a class of bug that affects multiple adapters
- The contract interface needs to evolve (e.g., we add a new optional method)

The goal: adapter #5 should be faster to build than adapter #1.
