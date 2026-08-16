import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import TrackClient from "./track-client";

export const dynamic = "force-dynamic";

/**
 * Shareable order-tracking page: /m/<slug>/track/<orderId>
 *
 * Reachable by a guest — get_order_status (0082) is an anon SECURITY DEFINER
 * read keyed on the unguessable order id and returns no personal data. The link
 * can be forwarded to whoever is collecting the order.
 */
export default async function TrackPage({
  params,
}: {
  params: { slug: string; orderId: string };
}) {
  const sb = createClient();
  const { data } = await sb.rpc("get_order_status", { p_order_id: params.orderId });
  if (!data) notFound();

  const snap = data as { restaurant_slug: string };
  // Someone pasted a real order id under the wrong restaurant's slug.
  if (snap.restaurant_slug !== params.slug) notFound();

  return <TrackClient slug={params.slug} orderId={params.orderId} initial={data} />;
}
