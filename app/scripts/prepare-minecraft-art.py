"""Pack background-extracted Minecraft illustrations, preserving transparent silhouettes."""
from io import BytesIO
from pathlib import Path
import importlib.util
import json
from PIL import Image, ImageChops, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SOURCES = ROOT / '.local/card-art-source/minecraft-cutouts'
OUTPUT = ROOT / 'public/assets/cards'
OUTPUT.mkdir(parents=True, exist_ok=True)
spec = importlib.util.spec_from_file_location('card_art', ROOT / 'scripts/prepare-card-art.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

# Partial preparation is useful during visual review; the final build requires all four.
originals = {sheet: Image.open(SOURCES / (sheet + '.png')).convert('RGBA') for sheet in 'abcd' if (SOURCES / (sheet + '.png')).exists()}
for cell in (144, 128, 112):
    atlases, cover = {}, None
    for sheet, image in originals.items():
        atlas = Image.new('RGBA', (cell * 4, cell * 4))
        # Find the empty gutter near each nominal row boundary, per column.
        # Generated silhouettes sometimes extend a few pixels beyond the nominal grid.
        rows = {}
        alpha = image.getchannel('A')
        for column in range(4):
            left, right = round((column+.06)*image.width/4), round((column+.94)*image.width/4)
            boundaries = [0]
            for boundary in range(1,4):
                nominal = round(boundary*image.height/4)
                candidates = range(nominal-round(image.height*.035), nominal+round(image.height*.035)+1)
                boundaries.append(min(candidates,key=lambda y:(sum(value>=144 for value in alpha.crop((left,y,right,y+1)).getdata()),abs(y-nominal))))
            rows[column] = boundaries+[image.height]
        for index in range(16):
            x, y = index % 4, index // 4
            tile = image.crop((round(x * image.width / 4), rows[x][y], round((x + 1) * image.width / 4), rows[x][y+1]))
            original_alpha = tile.getchannel('A')
            solid = tile.copy()
            solid.putalpha(original_alpha.point(lambda value: 255 if value>=144 else 0))
            solid = module.isolated_cell(solid)
            tile.putalpha(ImageChops.multiply(original_alpha,solid.getchannel('A').filter(ImageFilter.MaxFilter(5))))
            tile.putalpha(tile.getchannel('A').point(lambda value: 0 if value < 48 else round(value / 17) * 17))
            bounds = tile.getchannel('A').point(lambda value: 255 if value >= 80 else 0).getbbox()
            if not bounds:
                raise ValueError(f'{sheet}/{index}: empty illustration')
            tile = tile.crop(bounds)
            tile.thumbnail((cell - 10, cell - 10), Image.Resampling.LANCZOS)
            canvas = Image.new('RGBA', (cell, cell))
            canvas.alpha_composite(tile, ((cell - tile.width) // 2, (cell - tile.height) // 2))
            atlas.alpha_composite(canvas, (x * cell, y * cell))
            if sheet == 'd' and index == 12:
                cover = canvas.resize((112,112), Image.Resampling.LANCZOS)
        atlas.putalpha(atlas.getchannel('A').point(lambda value: round(value / 17) * 17))
        atlases[sheet] = atlas
    for quality in (68, 62, 56, 50, 44, 38):
        encoded = {}
        for sheet, image in atlases.items():
            buf = BytesIO(); image.save(buf, 'WEBP', quality=quality, method=6)
            encoded[sheet] = buf.getvalue()
        if cover:
            buf = BytesIO(); cover.save(buf,'WEBP',quality=67,method=6)
            encoded['cover'] = buf.getvalue()
        # Keep the same 220KB total budget, including any not-yet-regenerated sheets.
        total = sum(map(len, encoded.values())) + sum((OUTPUT / f'minecraft-{sheet}.webp').stat().st_size for sheet in ['a','b','c','d','cover'] if sheet not in encoded)
        if total < 220000:
            for sheet, data in encoded.items():
                (OUTPUT / f'minecraft-{sheet}.webp').write_bytes(data)
            print(json.dumps({'cell':cell,'quality':quality,'bytes':total,'sheets':list(originals),'files':{sheet:len(data) for sheet,data in encoded.items()}}))
            raise SystemExit(0)
raise ValueError('Minecraft illustrations exceed the220KB budget')
