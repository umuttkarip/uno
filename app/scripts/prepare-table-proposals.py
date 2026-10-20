"""Mechanically resize generated review sources; never changes their artwork."""
from pathlib import Path
from PIL import Image, ImageOps
ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / '.local/table-art-proposals'
OUTPUT = ROOT / 'design-proposals/backgrounds'
OUTPUT.mkdir(parents=True, exist_ok=True)
for theme in ('cats', 'seal', 'kuromi', 'adventure', 'minecraft'):
    image = Image.open(SOURCE / f'{theme}.png').convert('RGB')
    ImageOps.fit(image, (1600, 900), method=Image.Resampling.LANCZOS).save(OUTPUT / f'{theme}.webp', 'WEBP', quality=80, method=6)
    print(f'{theme}: {(OUTPUT / (theme + ".webp")).stat().st_size} bytes')
