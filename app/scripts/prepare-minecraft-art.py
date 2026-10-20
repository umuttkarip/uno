"""Pack four generated portrait-scene atlases; artwork itself is never redrawn."""
from pathlib import Path
import json
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SOURCES = ROOT / '.local/card-art-source'
OUTPUT = ROOT / 'public/assets/cards'
OUTPUT.mkdir(parents=True, exist_ok=True)
originals = {sheet: Image.open(SOURCES / ('minecraft-' + sheet + '.png')).convert('RGB') for sheet in 'abcd'}
for cell_width in (112, 96):
    cell_height = cell_width * 3 // 2
    atlases = {}
    for sheet, image in originals.items():
        atlas = Image.new('RGB', (cell_width * 4, cell_height * 4))
        for index in range(16):
            x, y = index % 4, index // 4
            tile = image.crop((round(x * image.width / 4), round(y * image.height / 4), round((x + 1) * image.width / 4), round((y + 1) * image.height / 4)))
            tile = tile.resize((cell_width, cell_height), Image.Resampling.LANCZOS)
            atlas.paste(tile, (x * cell_width, y * cell_height))
            if sheet == 'd' and index == 12:
                tile.resize((80, 120), Image.Resampling.LANCZOS).save(OUTPUT / 'minecraft-cover.webp', 'WEBP', quality=65, method=6)
        atlases[sheet] = atlas
    for quality in (60, 54, 48, 42, 36, 30):
        for sheet, image in atlases.items():
            image.save(OUTPUT / ('minecraft-' + sheet + '.webp'), 'WEBP', quality=quality, method=6)
        files = list(OUTPUT.glob('minecraft-*.webp'))
        total = sum(p.stat().st_size for p in files)
        if total < 220000:
            print(json.dumps({'cell': [cell_width, cell_height], 'quality': quality, 'bytes': total, 'files': {p.name: p.stat().st_size for p in files}}))
            raise SystemExit(0)
raise ValueError('Minecraft deck exceeds its 220 KB budget')
