"""Pack three axolotl scenes and the new back without touching existing atlases."""
from io import BytesIO
from pathlib import Path
import importlib.util
import json
from PIL import Image, ImageChops, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / 'public/assets/cards'
SOURCE = ROOT / '.local/card-art-source/minecraft-axolotls-back.png'
spec = importlib.util.spec_from_file_location('card_art', ROOT / 'scripts/prepare-card-art.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def encode(image, quality):
    buffer = BytesIO()
    image.save(buffer, 'WEBP', quality=quality, method=6)
    return buffer.getvalue()


def main():
    image = Image.open(SOURCE).convert('RGBA')
    tiles = []
    for index in range(4):
        x, y = index % 2, index // 2
        tile = image.crop((round(x*image.width/2), round(y*image.height/2), round((x+1)*image.width/2), round((y+1)*image.height/2)))
        alpha = tile.getchannel('A')
        solid = tile.copy()
        solid.putalpha(alpha.point(lambda value: 255 if value >= 144 else 0))
        solid = module.isolated_cell(solid)
        tile.putalpha(ImageChops.multiply(alpha, solid.getchannel('A').filter(ImageFilter.MaxFilter(5))))
        bounds = tile.getchannel('A').point(lambda value: 255 if value >= 80 else 0).getbbox()
        if not bounds:
            raise ValueError(f'Empty illustration {index}')
        tiles.append(tile.crop(bounds))
    # The four established atlases keep their exact original bytes.
    fixed = sum((OUTPUT / f'minecraft-art-{sheet}.webp').stat().st_size for sheet in 'abcd')
    for cell in (128, 112):
        atlas = Image.new('RGBA', (cell*2, cell*2))
        cover = None
        for index, original in enumerate(tiles):
            tile = original.copy()
            tile.thumbnail((cell-10, cell-10), Image.Resampling.LANCZOS)
            canvas = Image.new('RGBA', (cell, cell))
            canvas.alpha_composite(tile, ((cell-tile.width)//2, (cell-tile.height)//2))
            atlas.alpha_composite(canvas, ((index%2)*cell, (index//2)*cell))
            if index == 3:
                cover = canvas.resize((112, 112), Image.Resampling.LANCZOS)
        atlas.putalpha(atlas.getchannel('A').point(lambda value: round(value/17)*17))
        cover_data = encode(cover, 67)
        for quality in (68, 62, 56, 50, 44):
            data = encode(atlas, quality)
            total = fixed + len(data) + len(cover_data)
            if total < 240000:
                (OUTPUT / 'minecraft-art-e.webp').write_bytes(data)
                (OUTPUT / 'minecraft-back-cover.webp').write_bytes(cover_data)
                print(json.dumps({'cell':cell,'quality':quality,'atlas':len(data),'cover':len(cover_data),'bytes':total}))
                return
    raise ValueError('Minecraft artwork exceeds 240 KB')


if __name__ == '__main__':
    main()
