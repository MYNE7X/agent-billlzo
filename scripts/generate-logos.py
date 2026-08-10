#!/usr/bin/env python3
"""Generate optimized logo variants from the source image."""
from PIL import Image
from pathlib import Path

src = Path("/home/z/my-project/upload/image (1).png")
public = Path("/home/z/my-project/public")

# Open source
img = Image.open(src).convert("RGBA")
print(f"Source: {img.size}, mode={img.mode}")

# 1. logo.png — 256x256 for general UI use (sidebar, auth page)
logo_256 = img.resize((256, 256), Image.LANCZOS)
logo_256.save(public / "logo.png", optimize=True)
print(f"logo.png: 256x256, {Path(public / 'logo.png').stat().st_size // 1024}KB")

# 2. logo-mark.png — 128x128 for small brand marks (mobile top bar, sidebar)
logo_128 = img.resize((128, 128), Image.LANCZOS)
logo_128.save(public / "logo-mark.png", optimize=True)
print(f"logo-mark.png: 128x128, {Path(public / 'logo-mark.png').stat().st_size // 1024}KB")

# 3. favicon-32.png — 32x32 for favicon
fav_32 = img.resize((32, 32), Image.LANCZOS)
fav_32.save(public / "favicon-32.png", optimize=True)
print(f"favicon-32.png: 32x32, {Path(public / 'favicon-32.png').stat().st_size}B")

# 4. favicon-180.png — 180x180 for Apple touch icon
fav_180 = img.resize((180, 180), Image.LANCZOS)
fav_180.save(public / "apple-touch-icon.png", optimize=True)
print(f"apple-touch-icon.png: 180x180, {Path(public / 'apple-touch-icon.png').stat().st_size // 1024}KB")

# 5. favicon.png — 64x64 generic favicon
fav_64 = img.resize((64, 64), Image.LANCZOS)
fav_64.save(public / "favicon.png", optimize=True)
print(f"favicon.png: 64x64, {Path(public / 'favicon.png').stat().st_size}B")

# 6. logo-pdf.png — 512x512 for PDF (higher quality for print)
logo_pdf = img.resize((512, 512), Image.LANCZOS)
logo_pdf.save(public / "logo-pdf.png", optimize=True)
print(f"logo-pdf.png: 512x512, {Path(public / 'logo-pdf.png').stat().st_size // 1024}KB")

print("\nAll logo variants generated.")
