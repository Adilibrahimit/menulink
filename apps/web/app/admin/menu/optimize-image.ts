export async function optimizeImage(input: File | Blob): Promise<File> {
  const form = new FormData();
  form.append("file", input);

  const res = await fetch("/api/admin/image/optimize", {
    method: "POST",
    body: form,
  });

  if (!res.ok) throw new Error("optimize failed");

  const blob = await res.blob();
  return new File([blob], "optimized.webp", { type: "image/webp" });
}

export async function fetchAndOptimize(url: string): Promise<File> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("fetch failed");
  const blob = await res.blob();
  return optimizeImage(blob);
}
