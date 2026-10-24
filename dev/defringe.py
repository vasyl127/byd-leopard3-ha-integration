"""Remove the light 1-px halo left around the car drawings by the original cut-out (run from the repo root, needs Pillow + numpy)."""
import numpy as np
from PIL import Image

SRC = "custom_components/byd_leopard3/www/images/"


def boundary(op):
    pad = np.pad(op, 1, constant_values=False)
    inner = pad[:-2, 1:-1] & pad[2:, 1:-1] & pad[1:-1, :-2] & pad[1:-1, 2:]
    return op & ~inner


def defringe(path, passes=3, light=60, soft=190):
    im = np.array(Image.open(path).convert("RGBA"))
    lum = im[..., :3].astype(int).mean(-1)
    for _ in range(passes):
        edge = boundary(im[..., 3] > 0)
        halo = edge & (lum > light)
        if not halo.any():
            break
        im[..., 3][halo] = 0
    # Soften the new outline a little so it does not look jagged on any background.
    im[..., 3][boundary(im[..., 3] > 0)] = soft
    Image.fromarray(im).save(path, optimize=True)


if __name__ == "__main__":
    for view in ("side", "top"):
        defringe(f"{SRC}leopard3_{view}.png")
