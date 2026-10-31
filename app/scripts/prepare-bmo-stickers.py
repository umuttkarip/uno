"""Resize/crop the generated transparent 3x2 BMO sheet for the chat picker."""
from pathlib import Path
from PIL import Image
import argparse

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('source',type=Path)
args=parser.parse_args()
root=Path(__file__).resolve().parent.parent
sheet=Image.open(args.source).convert('RGBA')
names=['laugh','okay','shock','cry','smug','cheer']
for i,name in enumerate(names):
    x,y=i%3,i//3
    image=sheet.crop((x*sheet.width//3,y*sheet.height//2,(x+1)*sheet.width//3,(y+1)*sheet.height//2))
    bounds=image.getchannel('A').point(lambda value:255 if value>16 else 0).getbbox()
    if not bounds:raise ValueError('Empty BMO sticker: '+name)
    image=image.crop(bounds)
    image.thumbnail((176,160),Image.Resampling.LANCZOS)
    target=root/'public/assets/expressions'/('bmo-'+name+'.webp')
    image.save(target,'WEBP',quality=84,method=6)
    print(target.name,target.stat().st_size)
