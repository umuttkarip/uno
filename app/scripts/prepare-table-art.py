"""Resize generated table illustrations for runtime; no creative image edits."""
from io import BytesIO
from pathlib import Path
import json
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / '.local/table-art-source'
OUTPUT = ROOT / 'public/assets/tables'
OUTPUT.mkdir(parents=True, exist_ok=True)
sources = {name: Image.open(SOURCE / f'minecraft-{name}.png').convert('RGB') for name in ('wide', 'portrait')}
for quality in (62, 56, 50, 44):
    encoded = {}
    for name, size in {'wide': (960, 540), 'portrait': (432, 768)}.items():
        data = BytesIO()
        ImageOps.fit(sources[name], size, method=Image.Resampling.LANCZOS).save(data, 'WEBP', quality=quality, method=6)
        encoded[name] = data.getvalue()
    if sum(map(len, encoded.values())) < 65000:
        for name, data in encoded.items():
            (OUTPUT / f'minecraft-{name}.webp').write_bytes(data)
        print(json.dumps({'quality': quality, 'bytes': {name: len(data) for name, data in encoded.items()}}))
        break
else:
    raise ValueError('Table artwork exceeds its 65 KB budget')
