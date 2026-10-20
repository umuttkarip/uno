"""Package approved raster stickers without creatively redrawing them."""
from pathlib import Path
import argparse
import importlib.util
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('card_pack', ROOT / 'scripts/prepare-card-art.py')
packing = importlib.util.module_from_spec(spec)
spec.loader.exec_module(packing)

def encode(image, name, isolate=False):
    image = image.convert('RGBA')
    if isolate:
        image = packing.isolated_cell(image)
    bounds = image.getchannel('A').point(lambda v: 255 if v > 24 else 0).getbbox()
    if not bounds:
        raise ValueError('Empty approved sticker')
    image = image.crop(bounds)
    target = ROOT / 'public/assets/expressions' / (name + '.webp')
    for width in (224, 208, 192, 176, 160):
        resized = image.copy()
        resized.thumbnail((width, round(width * .846)), Image.Resampling.LANCZOS)
        resized.putalpha(resized.getchannel('A').point(lambda value: round(value / 17) * 17))
        for quality in (68, 62, 56):
            resized.save(target, 'WEBP', quality=quality, method=6)
            if target.stat().st_size < 5500:
                print(name, target.stat().st_size, 'bytes')
                return
    raise ValueError(name + ' exceeds the 5.5 KB budget')

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--kiss-source', type=Path)
args = parser.parse_args()
sheet = Image.open(ROOT / '.local/generated-stickers/approved-v2-sheet.png')
encode(sheet.crop((0, 512, 534, 1024)), 'seal-sulk', isolate=True)
encode(sheet.crop((534, 512, 1030, 1024)), 'seal-smug', isolate=True)
if args.kiss_source:
    encode(Image.open(args.kiss_source), 'seal-kiss')
