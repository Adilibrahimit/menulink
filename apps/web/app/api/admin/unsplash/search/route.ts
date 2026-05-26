import { NextRequest, NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth";

const UNSPLASH_KEY = process.env.UNSPLASH_ACCESS_KEY || "";

export async function GET(req: NextRequest) {
  const user = await requireOwner();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!UNSPLASH_KEY) {
    return NextResponse.json({ error: "unsplash not configured" }, { status: 500 });
  }

  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q) {
    return NextResponse.json({ error: "missing q" }, { status: 400 });
  }

  const url = new URL("https://api.unsplash.com/search/photos");
  url.searchParams.set("query", q);
  url.searchParams.set("per_page", "12");
  url.searchParams.set("orientation", "squarish");

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Client-ID ${UNSPLASH_KEY}` },
  });

  if (!res.ok) {
    return NextResponse.json({ error: "unsplash error" }, { status: res.status });
  }

  const data = await res.json();
  const results = (data.results ?? []).map(
    (p: {
      id: string;
      urls: { small: string; regular: string };
      alt_description: string | null;
      user: { name: string; links: { html: string } };
    }) => ({
      id: p.id,
      thumb: p.urls.small,
      full: p.urls.regular,
      alt: p.alt_description || "",
      photographer: p.user.name,
      profileUrl: p.user.links.html + "?utm_source=menulink&utm_medium=referral",
    }),
  );

  return NextResponse.json({ results });
}
