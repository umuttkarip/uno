"""Package the six reviewed ImageGen v2 table illustrations without creative edits.

Original PNGs stay under .local/table-art-proposals-v2; earlier proposals are
untouched.  Portraits are separately generated compositions, never wide crops.
"""

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / ".local" / "table-art-proposals-v2"
DESTINATION = ROOT / "design-proposals" / "backgrounds"
ASSETS = {
    "seal-v2-wide": (1600, 900),
    "cats-v2-portrait": (720, 1280),
    "seal-v2-portrait": (720, 1280),
    "kuromi-v2-portrait": (720, 1280),
    "adventure-v2-portrait": (720, 1280),
    "minecraft-v2-portrait": (720, 1280),
}


def main():
    DESTINATION.mkdir(parents=True, exist_ok=True)
    for name, size in ASSETS.items():
        source = SOURCE / f"{name}.png"
        target = DESTINATION / f"{name}.webp"
        with Image.open(source) as original:
            ratio_difference = abs((original.width / original.height) / (size[0] / size[1]) - 1)
            if ratio_difference > 0.01:
                raise ValueError(f"{source}: expected matching composition, got {original.size}")
            # Only resample and encode. No cropping, tint, blur, compositing or repainting.
            image = original.convert("RGB").resize(size, Image.Resampling.LANCZOS)
            image.save(target, "WEBP", quality=86, method=6)
        print(f"{target.name}: {size[0]}x{size[1]}, {target.stat().st_size:,} bytes")


if __name__ == "__main__":
    main()
