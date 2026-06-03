# MenuLink Bridge App

Tiny .NET 10 Windows Service that listens to a tenant's `pos_outbox` in Supabase and writes each row into the on-prem POS database. Today: RzRz / Punnelifosys ResApp. Tomorrow: more.

## What it does

1. Claims pending rows from `public.pos_outbox` for one restaurant.
2. For each row, deserializes the order payload, looks up POS-side item IDs via `pos_item_map`, builds the verified `InsertInvoice` XML, and calls the proc on the local SQL Server.
3. Marks the row `synced` with the resulting `InvoiceID` / `InvoiceNo` / `BillNo`, or `failed` with the error if anything went wrong.

Idempotency is enforced by the unique `(restaurant_id, order_id)` on `pos_outbox` plus the atomic claim RPC (`pos_outbox_claim`).

## Prerequisites

- Windows machine (server or cashier) on the restaurant's LAN, with `Microsoft.Data.SqlClient` able to reach the POS DB.
- .NET 10 SDK installed (https://dotnet.microsoft.com/download).
- Supabase service-role key with restaurant_id known (per branch).
- POS DB connection string (Integrated Security usually works on the POS host).
- The expected Windows printer name (e.g., `KETCHIN` for RzRz Bukhari) must already be registered locally.

## Configure

Edit `src/MenuLink.BridgeApp/appsettings.json` (or override per-branch via `appsettings.Almalaz.json` etc):

```json
{
  "BridgeApp": { "InstanceId": "almalaz-server", "PollingIntervalSeconds": 5, "BatchSize": 5, "MaxAttempts": 5 },
  "Supabase": {
    "Url": "https://dhmjrrsynfvomlzhggvu.supabase.co",
    "ServiceRoleKey": "<service-role-key>",
    "RestaurantId": "<tenant-uuid>"
  },
  "Pos": {
    "Kind": "rzrz",
    "BranchId": 2,
    "ConnectionString": "Server=.\\SQLEXPRESS;Database=client;Integrated Security=true;Encrypt=false;TrustServerCertificate=true;Connection Timeout=10",
    "OnlineCustomerId": 999,
    "CounterId": 1,
    "InvoiceType": 11,
    "DefaultUserId": 1
  }
}
```

You can keep secrets out of the JSON by setting environment variables with prefix `MENULINK_BRIDGE_`:

```powershell
$env:MENULINK_BRIDGE_Supabase__ServiceRoleKey = "sb_secret_..."
$env:MENULINK_BRIDGE_Supabase__RestaurantId   = "<tenant-uuid>"
```

## Run

```powershell
cd bridge-app
dotnet run --project src/MenuLink.BridgeApp
```

Logs go to `logs/bridge-<date>.log` (rolling daily) and stdout.

## Install as a Windows Service

```powershell
dotnet publish src/MenuLink.BridgeApp -c Release -o C:\MenuLinkBridge
sc.exe create "MenuLinkBridge" binPath= "C:\MenuLinkBridge\MenuLink.BridgeApp.exe" start= auto
sc.exe start "MenuLinkBridge"
```

The host is also Windows-Service-aware via `AddWindowsService` — it will detect SCM and behave correctly.

## Onboarding a tenant for POS sync (one-time)

1. In Supabase SQL editor, insert a `pos_settings` row for the restaurant:
   ```sql
   insert into public.pos_settings (restaurant_id, pos_kind, pos_branch_id, online_customer_id, counter_id, invoice_type, enabled)
   values ('<tenant-uuid>', 'rzrz', 2, 999, 1, 11, true);
   ```
2. Populate `pos_item_map` with every menu_item the tenant has, mapping to the RzRz `Items.ItemID`:
   ```sql
   insert into public.pos_item_map (restaurant_id, menu_item_id, pos_item_id)
   values ('<tenant-uuid>', '<menulink-item-uuid>', 1886);
   -- repeat per item ...
   ```
3. On the POS server, INSERT the MenuLink row into `OnlineCustomer` (one-time, manually):
   ```sql
   insert into OnlineCustomer (OnlineCustomerID, Name_E, Name_A, IsDeleted, CommissionPercent)
   values (999, 'MenuLink', N'مينيولينك', 0, 0);
   ```
4. Start the Bridge App on a Windows host with access to the POS DB.

Once enabled, every new MenuLink order will be enqueued by the trigger, claimed by the Bridge App, and inserted into the POS within seconds.

## Security model (post-0071)

Migration `0071_harden_tenant_isolation` tightened the surface this app uses. The
contract the Bridge App must honour:

- **`pos_outbox_claim` / `pos_outbox_mark_synced` / `pos_outbox_mark_failed` are
  `service_role`-only.** EXECUTE was revoked from `anon`/`authenticated` (previously any
  signed-in user could claim or mutate any tenant's queue). The bridge already uses the
  **service_role key**, so it is unaffected — but a future caller without that key cannot
  reach these RPCs. Keep the service-role key server-side; never ship it to a browser.
- **`bridge_heartbeats` insert is now owner-scoped.** The `/api/bridge/heartbeat` route
  runs under the caller's user session, so its insert must be for a restaurant that
  session owns (`owns_restaurant` / `is_platform_admin`). A bridge writing heartbeats
  directly via the service_role key bypasses RLS and is unaffected.

See `docs/auth-rls-bridge-trace.md` for the full trace and rationale.
