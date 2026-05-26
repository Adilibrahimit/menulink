"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import type { ThemeConfig } from "@/lib/themes";
import LoginGate from "./login-gate";
import OrderTypeGate from "./order-type-gate";
import { OrderTypeProvider } from "./order-context";
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

export default function CustomerShell({
  menu,
  tableParam,
  theme,
  children,
}: {
  menu: PublicMenu;
  tableParam: string | null;
  theme: ThemeConfig;
  children: React.ReactNode;
}) {
  const [auth, setAuth] = useState<AuthState>({ kind: "loading" });
  const [orderType, setOrderType] = useState<OrderType | null>(null);
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

  function handleGuest(phone: string, name: string) {
    localStorage.setItem(GUEST_KEY, JSON.stringify({ phone, name }));
    setAuth({ kind: "guest", phone, name });
  }

  function handleOrderType(type: OrderType) {
    setOrderType(type);
    try {
      localStorage.setItem(orderTypeKey(menu.restaurant.id), type);
    } catch {}
  }

  if (auth.kind === "loading") {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center" style={{ background: "var(--bg)" }}>
        <div className="w-8 h-8 border-3 border-neutral-200 border-t-neutral-500 rounded-full animate-spin" />
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
      />
    );
  }

  if (googleFirst && !orderType && !tableParam) {
    return (
      <OrderTypeGate
        restaurantName={menu.restaurant.name}
        logoUrl={menu.restaurant.logo_url}
        onSelect={handleOrderType}
      />
    );
  }

  return (
    <OrderTypeProvider orderType={orderType}>
      <div className="pb-16">{children}</div>
      <BottomNav slug={menu.restaurant.slug} navItems={theme.bottomNavItems} />
    </OrderTypeProvider>
  );
}
