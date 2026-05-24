"use client";

import { createContext, useContext } from "react";
import type { OrderType } from "./types";

const OrderContext = createContext<OrderType | null>(null);

export function OrderTypeProvider({
  orderType,
  children,
}: {
  orderType: OrderType | null;
  children: React.ReactNode;
}) {
  return <OrderContext.Provider value={orderType}>{children}</OrderContext.Provider>;
}

export function usePreselectedOrderType(): OrderType | null {
  return useContext(OrderContext);
}
