#!/usr/bin/env python3
"""Generate optimized founder portrait variants."""
from PIL import Image
from pathlib import Path

src = Path("/home/z/my-project/upload/pasted_image_1786389281563.png")
public = Path("/home/z/my-project/public")

img = Image.open(src).convert("RGBA")
print(f"Source: {img.size}, mode={img.mode}")

# 1. aziz-portrait.png — 128x128 (for the popup avatar)
avatar_128 = img.resize((128, 128), Image.LANCZOS)
avatar_128.save(public / "aziz-portrait.png", optimize=True)
print(f"aziz-portrait.png: 128x128, {Path(public / 'aziz-portrait.png').stat().st_size // 1024}KB")

# 2. aziz-avatar.png — 48x48 (for the small bubble trigger)
avatar_48 = img.resize((48, 48), Image.LANCZOS)
avatar_48.save(public / "aziz-avatar.png", optimize=True)
print(f"aziz-avatar.png: 48x48, {Path(public / 'aziz-avatar.png').stat().st_size}B")

print("\nDone.")
