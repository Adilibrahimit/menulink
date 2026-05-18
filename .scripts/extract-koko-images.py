"""One-shot: decode v6's inline base64 image dictionary into real PNG/JPEG files,
then regenerate apps/web/lib/koko-images.ts with URL paths instead of base64."""
import re, base64, os
from pathlib import Path

html = Path("D:/menulink/current-state/pwa-starter/koko-menu-v6.html").read_text(encoding="utf-8")

m = re.search(r"const IMG = \{(.*?)\};", html, re.DOTALL)
if not m:
    raise SystemExit("Could not find IMG dict")

body = m.group(1)
entries = re.findall(r'["\']?(\w+)["\']?\s*:\s*["\']data:image/(\w+);base64,([^"\']+)["\']', body)

out_dir = Path("D:/menulink/apps/web/public/menu/koko")
out_dir.mkdir(parents=True, exist_ok=True)

mapping = {}
for name, ext, b64 in entries:
    out_dir.joinpath(f"{name}.{ext}").write_bytes(base64.b64decode(b64))
    mapping[name] = f"/menu/koko/{name}.{ext}"

print(f"Extracted {len(mapping)} images")
total_bytes = sum((out_dir / f).stat().st_size for f in os.listdir(out_dir))
print(f"Total image bytes: {total_bytes:,}")

slug_to_img = [
    ("br-reg",    "broasted_spicy"),    ("br-hot",    "broasted_regular"),
    ("br-jal",    "broasted_jalapeno"), ("br-nash",   "broasted_nashville"),
    ("tn-reg",    "tender_regular"),    ("tn-hot",    "tender_spicy"),
    ("tn-jal",    "tender_jalapeno"),   ("tn-nash",   "tender_nashville"),
    ("bg-crispy", "burger_crispy"),     ("bg-maple",  "burger_maple"),
    ("bg-nash",   "burger_nash"),       ("tw-reg",    "twister_regular"),
    ("tw-hot",    "twister_spicy"),     ("tw-maple",  "twister_maple"),
    ("sd-cf",     "side_chicken_fries"),("sd-chf",    "side_cheese_fries"),
    ("sd-fries",  "side_fries"),        ("sd-cb",     "side_chicken_bites"),
    ("sd-slaw",   "side_coleslaw"),
    ("sc-koko",   "sauce_koko"),        ("sc-ched",   "sauce_cheese"),
    ("sc-spec",   "sauce_generic"),     ("sc-bbq",    "sauce_bbq"),
    ("sc-ranch",  "sauce_ranch"),       ("sc-jal",    "sauce_jal"),
    ("sc-garlic", "sauce_ranch"),       ("sc-hummus", "sauce_bbq"),
    ("dr-cola-s", "drink_cola"),        ("dr-cola-l", "drink_cola"),
    ("dr-oj-s",   "drink_oj"),          ("dr-oj-l",   "drink_oj"),
    ("dr-water",  "drink_water"),
]

lines = [
    "/**",
    " * KO-KO Chicky Licky · food-photo URL map.",
    " *",
    " * Images decoded from v6 base64 to apps/web/public/menu/koko/.",
    " * Browser caches them as static assets, no bundle bloat.",
    " *",
    " * SLUG_TO_IMG maps menu_items.slug to the URL the customer PWA renders.",
    " * When menu_items.image_url is set in the DB, use that instead.",
    " */",
    "",
    "export const IMG: Record<string, string> = {",
]
for k in sorted(mapping.keys()):
    lines.append(f"  {k}: '{mapping[k]}',")
lines.append("};")
lines.append("")
lines.append("export const SLUG_TO_IMG: Record<string, string> = {")
for slug, key in slug_to_img:
    lines.append(f"  '{slug}': IMG.{key},")
lines.append("};")
lines.append("")

Path("D:/menulink/apps/web/lib/koko-images.ts").write_text("\n".join(lines), encoding="utf-8")
print(f"koko-images.ts now {Path('D:/menulink/apps/web/lib/koko-images.ts').stat().st_size} bytes")
