"""Pack only the Adventure Time expansion; never recompress the original art."""
from io import BytesIO
from pathlib import Path
import importlib.util
import json
from PIL import Image, ImageChops, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SOURCES = ROOT / '.local/card-art-source'
OUTPUT = ROOT / 'public/assets/cards'
spec = importlib.util.spec_from_file_location('card_art', ROOT / 'scripts/prepare-card-art.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def cells_from_source(path):
    image = Image.open(path).convert('RGBA')
    alpha = image.getchannel('A')
    cells = []
    for column in range(4):
        left, right = round((column + .08) * image.width / 4), round((column + .92) * image.width / 4)
        boundaries = [0]
        for boundary in range(1, 4):
            nominal = round(boundary * image.height / 4)
            candidates = range(nominal-round(image.height*.045), nominal+round(image.height*.045)+1)
            boundaries.append(min(candidates, key=lambda y: (sum(value >= 144 for value in alpha.crop((left, y, right, y+1)).getdata()), abs(y-nominal))))
        boundaries.append(image.height)
        for row in range(4):
            tile = image.crop((round(column*image.width/4), boundaries[row], round((column+1)*image.width/4), boundaries[row+1]))
            original_alpha = tile.getchannel('A')
            solid = tile.copy()
            solid.putalpha(original_alpha.point(lambda value: 255 if value >= 144 else 0))
            solid = module.isolated_cell(solid)
            tile.putalpha(ImageChops.multiply(original_alpha, solid.getchannel('A').filter(ImageFilter.MaxFilter(5))))
            tile.putalpha(tile.getchannel('A').point(lambda value: 0 if value < 48 else round(value/17)*17))
            bounds = tile.getchannel('A').point(lambda value: 255 if value >= 80 else 0).getbbox()
            if not bounds:
                raise ValueError(f'Empty illustration {path.name}/{column}/{row}')
            cells.append((row*4+column, tile.crop(bounds)))
    return [tile for _, tile in sorted(cells)]


def main():
    originals = {sheet: cells_from_source(SOURCES / f'adventure-{sheet}.png') for sheet in 'cd'}
    fixed = sum((OUTPUT / f'adventure-{sheet}.webp').stat().st_size for sheet in ['a', 'b', 'cover'])
    # Flat cel artwork compresses better with a bounded palette and lossless WebP.
    # Keep the full 112 px cell instead of blurring it with aggressive lossy encoding.
    for cell, colors in [(112, 128), (104, 128)]:
        encoded = {}
        for sheet, tiles in originals.items():
            atlas = Image.new('RGBA', (cell*4, cell*4))
            for index, original in enumerate(tiles):
                tile = original.copy()
                tile.thumbnail((cell-10, cell-10), Image.Resampling.LANCZOS)
                atlas.alpha_composite(tile, ((index%4)*cell+(cell-tile.width)//2, (index//4)*cell+(cell-tile.height)//2))
            atlas.putalpha(atlas.getchannel('A').point(lambda value: round(value/17)*17))
            atlas = atlas.quantize(colors=colors, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE).convert('RGBA')
            buffer = BytesIO()
            atlas.save(buffer, 'WEBP', lossless=True, quality=100, method=6)
            encoded[sheet] = buffer.getvalue()
        total = fixed + sum(map(len, encoded.values()))
        if total < 220000:
            for sheet, data in encoded.items():
                (OUTPUT / f'adventure-{sheet}.webp').write_bytes(data)
            print(json.dumps({'cell': cell, 'palette': colors, 'encoding': 'lossless WebP', 'bytes': total, 'files': {sheet: len(data) for sheet, data in encoded.items()}}))
            return
    raise ValueError('Adventure Time expansion exceeds 220 KB')


if __name__ == '__main__':
    main()
