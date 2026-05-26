import { NextRequest, NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth";
import sharp from "sharp";

export async function POST(req: NextRequest) {
  const user = await requireOwner();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "no file" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  const optimized = await sharp(buffer)
    .resize({ width: 800, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();

  return new NextResponse(new Uint8Array(optimized), {
    headers: {
      "Content-Type": "image/webp",
      "Content-Length": String(optimized.length),
    },
  });
}
