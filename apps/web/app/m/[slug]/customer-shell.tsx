"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import type { ThemeConfig } from "@/lib/themes";
import LoginGate from "./login-gate";
import OrderTypeGate from "./order-type-gate";
import { OrderTypeProvider, type DeliveryContext } from "./order-context";
import BottomNav from "./bottom-nav";
import type { PublicMenu, OrderType } from "./types";

type AuthState =
  | { kind: "loading" }
  | { kind: "gate" }
  | { kind: "guest"; phone: string; name: string }
  | { kind: "signed_in"; userId: string };

const GUEST_KEY = "menulink:guest";

function orderTypeKey(restaurantId: string) {
  return `menulink:orderType:${restaurantId}`;
}

function deliveryKey(restaurantId: string) {
  return `menulink:delivery:${restaurantId}`;
}

/** A resolved delivery zone older than this is discarded — the customer has
 *  probably moved, and a stale fee/address is worse than asking again. */
const DELIVERY_TTL_MS = 6 * 60 * 60 * 1000;

export default function CustomerShell({
  menu,
  tableParam,
  theme,
  notifCenterEnabled = false,
  children,
}: {
  menu: PublicMenu;
  tableParam: string | null;
  theme: ThemeConfig;
  notifCenterEnabled?: boolean;
  children: React.ReactNode;
}) {
  const [auth, setAuth] = useState<AuthState>({ kind: "loading" });
  const [orderType, setOrderType] = useState<OrderType | null>(null);
  const [delivery, setDelivery] = useState<DeliveryContext | null>(null);
  const googleFirst = theme.loginFlow === "google-first";

  useEffect(() => {
    const sb = createClient();
    sb.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setAuth({ kind: "signed_in", userId: session.user.id });
        return;
      }
      const stored = localStorage.getItem(GUEST_KEY);
      if (stored) {
        try {
          const { phone, name } = JSON.parse(stored);
          if (phone) {
            setAuth({ kind: "guest", phone, name: name || "" });
            return;
          }
        } catch { /* invalid JSON */ }
      }
      setAuth({ kind: "gate" });
    });

    const { data: { subscription } } = sb.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setAuth({ kind: "signed_in", userId: session.user.id });
      } else {
        setAuth({ kind: "gate" });
      }
    });
    return () => subscription.unsubscribe();
  }, [googleFirst]);

  useEffect(() => {
    if (!googleFirst) return;
    try {
      const stored = localStorage.getItem(orderTypeKey(menu.restaurant.id));
      if (stored) setOrderType(stored as OrderType);
    } catch {}
  }, [googleFirst, menu.restaurant.id]);

  // Restore the resolved delivery zone. Without this, orderType survived a
  // refresh but the delivery context did not — so the fee silently reverted to
  // 0 and the customer checked out without paying for delivery. Time-boxed so a
  // stale address from days ago is not reused.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(deliveryKey(menu.restaurant.id));
      if (!raw) return;
      const { at, ctx } = JSON.parse(raw) as { at: number; ctx: DeliveryContext };
      if (Date.now() - at > DELIVERY_TTL_MS) {
        localStorage.removeItem(deliveryKey(menu.restaurant.id));
        return;
      }
      setDelivery(ctx);
    } catch {}
  }, [menu.restaurant.id]);

  function handleDelivery(d: DeliveryContext | null) {
    setDelivery(d);
    try {
      const key = deliveryKey(menu.restaurant.id);
      if (d) localStorage.setItem(key, JSON.stringify({ at: Date.now(), ctx: d }));
      else localStorage.removeItem(key);
    } catch {}
  }

  function handleGuest(phone: string, name: string) {
    localStorage.setItem(GUEST_KEY, JSON.stringify({ phone, name }));
    setAuth({ kind: "guest", phone, name });
  }

  function handleOrderType(type: OrderType) {
    setOrderType(type);
    if (type !== "delivery") handleDelivery(null);
    try {
      localStorage.setItem(orderTypeKey(menu.restaurant.id), type);
    } catch {}
  }

  if (auth.kind === "loading") {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center" style={{ background: "var(--bg)" }}>
        <div
          className="w-8 h-8 border-3 border-neutral-200 border-t-neutral-500 rounded-full animate-spin"
          style={theme.menuLayout === "premium-epicurean" ? { borderColor: "rgba(230,195,131,0.2)", borderTopColor: "var(--accent-gold)" } : undefined}
        />
      </div>
    );
  }

  if (auth.kind === "gate") {
    return (
      <LoginGate
        restaurant={{
          id: menu.restaurant.id,
          name: menu.restaurant.name,
          slug: menu.restaurant.slug,
          logo_url: menu.restaurant.logo_url,
          primary_color: menu.restaurant.primary_color,
        }}
        tableParam={tableParam}
        onGuest={handleGuest}
        premium={theme.menuLayout === "premium-epicurean"}
      />
    );
  }

  if (googleFirst && !orderType && !tableParam) {
    return (
      <OrderTypeGate
        restaurantId={menu.restaurant.id}
        restaurantName={menu.restaurant.name}
        logoUrl={menu.restaurant.logo_url}
        onSelect={handleOrderType}
        onDeliveryConfirm={handleDelivery}
      />
    );
  }

  return (
    <OrderTypeProvider
      orderType={orderType}
      setOrderType={handleOrderType}
      delivery={delivery}
      setDelivery={handleDelivery}
    >
      <div className="pb-16">{children}</div>
      <BottomNav slug={menu.restaurant.slug} navItems={theme.bottomNavItems} notifCenterEnabled={notifCenterEnabled} variant={theme.menuLayout === "premium-epicurean" ? "premium" : "light"} />
    </OrderTypeProvider>
  );
}
