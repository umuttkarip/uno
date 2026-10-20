"""Deterministic atlas packing/downsampling. Run from app/, requires Pillow.

Creative source PNGs and exact generation prompts remain in .local/card-art-source/.
Only the optimized WebP atlases/covers are runtime assets.
"""
from pathlib import Path
import json
import shutil
import argparse
from PIL import Image, ImageChops, ImageFilter

HERE = Path(__file__).resolve().parent.parent
SOURCES = HERE / '.local/card-art-source'
OUTPUT = HERE / 'public/assets/cards'
CELL = 144

def isolated_cell(tile):
    """Exclude small edge fragments belonging to an adjacent generated atlas cell."""
    alpha = tile.getchannel('A')
    width, height = tile.size
    pending = bytearray(alpha.point(lambda value: 255 if value > 48 else 0).tobytes())
    components = []
    for offset in range(len(pending)):
        if not pending[offset]:
            continue
        pending[offset] = 0
        pixels, cursor = [offset], 0
        bounds = [width, height, 0, 0]
        while cursor < len(pixels):
            pixel = pixels[cursor]
            cursor += 1
            x, y = pixel % width, pixel // width
            bounds = [min(bounds[0], x), min(bounds[1], y), max(bounds[2], x), max(bounds[3], y)]
            for neighbour in ([pixel-1] if x else []) + ([pixel+1] if x < width-1 else []) + ([pixel-width] if y else []) + ([pixel+width] if y < height-1 else []):
                if pending[neighbour]:
                    pending[neighbour] = 0
                    pixels.append(neighbour)
        components.append((pixels, bounds))
    largest = max((len(pixels) for pixels, _ in components), default=1)
    kept = bytearray(width * height)
    for pixels, bounds in components:
        margin = max(8, round(width * .055))
        edge = bounds[0] < margin or bounds[1] < margin or bounds[2] >= width-margin or bounds[3] >= height-margin
        if edge and len(pixels) < largest * .12:
            continue
        for pixel in pixels:
            kept[pixel] = 255
    mask = Image.frombytes('L', tile.size, bytes(kept)).filter(ImageFilter.MaxFilter(5))
    tile.putalpha(ImageChops.multiply(alpha, mask))
    return tile

def pack(original, cell_size=CELL):
    image = Image.open(original).convert('RGBA')
    sheet = Image.new('RGBA', (cell_size * 4, cell_size * 4))
    cells = []
    for index in range(16):
        x, y = index % 4, index // 4
        tile = image.crop((round(x * image.width / 4), round(y * image.height / 4),
                           round((x + 1) * image.width / 4), round((y + 1) * image.height / 4)))
        # Separate background-extracted edits retain both original atlas scenes.
        override_name = {8:'cats-stop.png',9:'cats-blocked.png'}.get(index) if original.stem == 'cats-b' else None
        override = SOURCES / override_name if override_name else None
        if override is not None and override.exists():
            tile = Image.open(override).convert('RGBA')
        else:
            tile = isolated_cell(tile)
        bounds = tile.getchannel('A').getbbox()
        if bounds:
            tile = tile.crop(bounds)
        tile.thumbnail((cell_size - 12, cell_size - 12), Image.Resampling.LANCZOS)
        cell = Image.new('RGBA', (cell_size, cell_size))
        cell.alpha_composite(tile, ((cell_size - tile.width) // 2, (cell_size - tile.height) // 2))
        sheet.alpha_composite(cell, (x * cell_size, y * cell_size))
        cells.append(cell)
    return sheet, cells

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--generated-dir', type=Path, help='Optional built-in imagegen output folder for the first source copy')
    args = parser.parse_args()
    OUTPUT.mkdir(parents=True, exist_ok=True)
    entries = json.loads((SOURCES / 'prompts.json').read_text(encoding='utf-8'))
    sizes = {}
    for name, entry in entries.items():
        source = SOURCES / (name + '.png')
        if not source.exists():
            if args.generated_dir is None:
                raise FileNotFoundError(f'{source}: supply the original PNG or --generated-dir')
            shutil.copyfile(args.generated_dir / entry['file'], source)
        atlas, cells = pack(source, cell_size=112 if name == 'kuromi-c' else CELL)
        # Sixteen alpha levels preserve soft edges without storing imperceptible grain.
        atlas.putalpha(atlas.getchannel('A').point(lambda value: round(value / 17) * 17))
        atlas.save(OUTPUT / (name + '.webp'), 'WEBP', quality=44 if name == 'kuromi-c' else 61, method=6)
        sizes[name] = (OUTPUT / (name + '.webp')).stat().st_size
        if name.endswith('-b'):
            cover = cells[15].resize((112, 112), Image.Resampling.LANCZOS)
            cover.save(OUTPUT / (name[:-2] + '-cover.webp'), 'WEBP', quality=67, method=6)
    print(json.dumps(sizes))
    for theme in ('cats', 'seal', 'kuromi', 'adventure'):
        print(theme, sum(p.stat().st_size for p in OUTPUT.glob(theme + '-*.webp')), 'bytes')

if __name__ == '__main__':
    main()
