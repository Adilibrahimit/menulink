"use client";

import { createContext, useContext } from "react";
import type { OrderType } from "./types";

export type DeliveryContext = {
  lat: number;
  lng: number;
  branchId: string;
  branchNameAr: string;
  deliveryFee: number;
  minOrder: number;
  estimatedMinutes: number | null;
  distanceKm: number;
  address: string;
};

type OrderContextValue = {
  orderType: OrderType | null;
  setOrderType: (type: OrderType) => void;
  delivery: DeliveryContext | null;
  setDelivery: (d: DeliveryContext | null) => void;
};

const OrderContext = createContext<OrderContextValue>({
  orderType: null,
  setOrderType: () => {},
  delivery: null,
  setDelivery: () => {},
});

export function OrderTypeProvider({
  orderType,
  setOrderType,
  delivery,
  setDelivery,
  children,
}: OrderContextValue & { children: React.ReactNode }) {
  return (
    <OrderContext.Provider value={{ orderType, setOrderType, delivery, setDelivery }}>
      {children}
    </OrderContext.Provider>
  );
}

export function useOrderContext(): OrderContextValue {
  return useContext(OrderContext);
}

export function usePreselectedOrderType(): OrderType | null {
  return useContext(OrderContext).orderType;
}
