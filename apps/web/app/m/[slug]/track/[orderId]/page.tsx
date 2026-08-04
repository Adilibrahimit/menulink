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
  // Anything that isn't a uuid can't be an order id — answer before hitting the
  // database (a malformed id would otherwise surface as a 500, not a 404).
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.orderId)) {
    notFound();
  }

  const sb = createClient();
  const { data, error } = await sb.rpc("get_order_status", { p_order_id: params.orderId });
  // Only a successful "no such order" is a 404. A transient RPC/network failure
  // must not tell someone holding a valid tracking link that their order does
  // not exist — throw so Next renders the (retryable) error boundary instead.
  if (error) throw new Error(`get_order_status failed: ${error.message}`);
  if (!data) notFound();

  const snap = data as { restaurant_slug: string };
  // Someone pasted a real order id under the wrong restaurant's slug.
  if (snap.restaurant_slug !== params.slug) notFound();

  return <TrackClient slug={params.slug} orderId={params.orderId} initial={data} />;
}
