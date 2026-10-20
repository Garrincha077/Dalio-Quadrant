"""Deterministic code-native quadrant icon; Pillow is an authoring tool only."""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "icons"
OUT.mkdir(exist_ok=True)
PANELS = [(112,112,250,250,"#303047"),(262,112,400,250,"#34312d"),(112,262,250,400,"#202d42"),(262,262,400,400,"#193638")]
DOTS = [(194,326,7,"#625c47"),(227,291,11,"#938049"),(269,249,16,"#b89b4e"),(316,205,23,"#e2b752")]
svg = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">','<rect width="512" height="512" fill="#131b28"/>']
for x1,y1,x2,y2,color in PANELS:
    svg.append(f'<rect x="{x1}" y="{y1}" width="{x2-x1}" height="{y2-y1}" rx="16" fill="{color}"/>')
svg += ['<path d="M256 112V400M112 256H400" stroke="#8392a7" stroke-width="3"/>','<path d="M194 326L227 291L269 249L316 205" fill="none" stroke="#e2b752" stroke-width="4"/>']
for x,y,r,color in DOTS:
    svg.append(f'<circle cx="{x}" cy="{y}" r="{r}" fill="{color}"/>')
svg += ['<circle cx="316" cy="205" r="30" fill="none" stroke="#e2b752" stroke-width="3"/>','</svg>']
(OUT / "icon.svg").write_text("\n".join(svg)+"\n",encoding="utf-8")
scale = 4
image = Image.new("RGB",(512*scale,512*scale),"#131b28")
draw = ImageDraw.Draw(image)
for x1,y1,x2,y2,color in PANELS:
    draw.rounded_rectangle(tuple(v*scale for v in [x1,y1,x2,y2]),radius=16*scale,fill=color)
for line in [(256,112,256,400),(112,256,400,256)]:
    draw.line(tuple(v*scale for v in line),fill="#8392a7",width=3*scale)
draw.line([(x*scale,y*scale) for x,y,_,_ in DOTS],fill="#e2b752",width=4*scale)
for x,y,r,color in DOTS:
    draw.ellipse(((x-r)*scale,(y-r)*scale,(x+r)*scale,(y+r)*scale),fill=color)
draw.ellipse((286*scale,175*scale,346*scale,235*scale),outline="#e2b752",width=3*scale)
for name,size in [("icon-192.png",192),("icon-512.png",512),("maskable-512.png",512),("apple-touch-icon.png",180)]:
    image.resize((size,size),Image.Resampling.LANCZOS).save(OUT/name,optimize=True)
print("Generated SVG and 192/512/maskable/180 PNG icons.")
