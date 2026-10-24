"""Rebuild the body masks used to recolour the car (run from the repo root, needs Pillow)."""
from PIL import Image, ImageDraw, ImageFilter
SRC="custom_components/byd_leopard3/www/images/"
SIDE_POLY=[(38,152),(60,138),(100,128),(150,122),(200,119),(262,117),(275,118),(330,123),(474,121),(520,113),(790,106),(868,100),(878,110),
  (881,120),(881,205),(870,210),(844,215),(834,190),(799,172),(754,167),(709,172),(664,190),(634,210),(624,235),(624,238),
  (474,240),(270,242),(265,250),(260,210),(245,185),(210,172),(165,167),(120,175),(85,192),(70,215),(68,200),(55,175),(40,160)]
TOP_POLYS=[
  [(48,30),(100,14),(300,14),(352,30),(362,100),(358,232),(42,232),(38,100)],          # hood
  [(36,236),(80,236),(80,830),(48,830),(34,700)],                                       # left side
  [(320,236),(364,236),(366,700),(352,830),(320,830)],                                  # right side
]
def mask_for(name):
    im=Image.open(SRC+name).convert("RGBA")
    m=Image.new("L",im.size,0); d=ImageDraw.Draw(m)
    if "side" in name: d.polygon(SIDE_POLY,fill=255)
    else:
        for p in TOP_POLYS: d.polygon(p,fill=255)
    m=m.filter(ImageFilter.GaussianBlur(1.5))
    # keep only opaque car pixels
    a=im.split()[3]
    from PIL import ImageChops
    return im, ImageChops.multiply(m,a)


if __name__ == "__main__":
    for view in ("side", "top"):
        _, m = mask_for(f"leopard3_{view}.png")
        m.save(f"{SRC}leopard3_{view}_mask.png", optimize=True)
