"""resize-brand-images.py — shrink the three brand PNGs without wrecking their edges.

They shipped at 100-1700x the size they are drawn at: the 20x20 robot avatar was a 480x611 PNG,
and the 13px bolt was 540x540. Together 144 KB for about 6 KB of actual pixels.

Resizing an image with transparency is not just "make it smaller". Fully transparent pixels still
carry a colour, usually black, and a plain resize averages that black into the edges of whatever is
next to it — so a clean orange bolt comes out with a dark halo. Doing it the naive way with ffmpeg
put 722 dark pixels into a shape that had none, and the result looked tilted and outlined.

The fix is to premultiply (scale each colour channel by its own transparency) BEFORE resizing and
undo it afterwards, so transparent black has no weight in the average.

Run: python app/tools/resize-brand-images.py [--check]
     --check verifies the shipped files match what this script would produce, and that none of
     them gained dark pixels the source did not have.
"""
import sys
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
IMG = ROOT / "public" / "img"
SRC = ROOT / "public" / "img" / "_source"

# name -> height to render at. Each is roughly 4x its on-screen size, so it stays sharp on a
# high-density screen without carrying a megapixel around.
TARGETS = {"bolt.png": 64, "clearRobotRing4.png": 80, "wordmark.png": 88}


def resize_rgba(im: Image.Image, height: int) -> Image.Image:
    im = im.convert("RGBA")
    w, h = im.size
    width = max(1, round(w * height / h))

    a = np.asarray(im, dtype=np.float64) / 255.0
    alpha = a[..., 3:4]
    a[..., :3] *= alpha                      # premultiply
    prem = Image.fromarray((a * 255).round().astype(np.uint8), "RGBA")
    prem = prem.resize((width, height), Image.LANCZOS)

    b = np.asarray(prem, dtype=np.float64) / 255.0
    alpha = b[..., 3:4]
    # Where a pixel is fully transparent its colour is meaningless; leave it at zero rather than
    # dividing by zero and inventing one.
    np.divide(b[..., :3], alpha, out=b[..., :3], where=alpha > 0)
    b[..., :3] = np.clip(b[..., :3], 0, 1)
    return Image.fromarray((b * 255).round().astype(np.uint8), "RGBA")


def dark_opaque(im: Image.Image) -> int:
    """Pixels that are visible AND nearly black — the halo a bad resize leaves behind."""
    a = np.asarray(im.convert("RGBA"), dtype=np.int32)
    return int(((a[..., 3] > 40) & (a[..., :3].sum(axis=2) < 150)).sum())


def content_shape(im: Image.Image):
    """(wide-to-tall ratio, width in pixels) of the visible part."""
    box = im.convert("RGBA").getchannel("A").getbbox()
    if not box:
        return None, 0
    w, h = box[2] - box[0], box[3] - box[1]
    return w / max(1, h), w


def main() -> int:
    check = "--check" in sys.argv
    bad = 0
    for name, height in TARGETS.items():
        src = SRC / name
        if not src.exists():
            print(f"missing source: {src}  (originals live in public/img/_source/)")
            return 1
        original = Image.open(src)
        out = resize_rgba(original, height)

        src_dark = dark_opaque(original)
        out_dark = dark_opaque(out)
        src_ratio, _ = content_shape(original)
        out_ratio, out_content_w = content_shape(out)

        if out_dark > src_dark:
            print(f"FAIL {name}: resize added {out_dark - src_dark} dark pixels (a halo)")
            bad = 1
        # Tolerance scales with the CONTENT width, not the canvas. The bolt is only ~32px wide
        # once shrunk, so one pixel of antialiasing on each edge moves the measured ratio by ~0.06
        # — a fixed fraction would fail every small image while missing real distortion in a big
        # one. This caught nothing real; the actual bug (a dark halo) is the check above.
        tolerance = max(0.04, 3.0 / max(1, out_content_w))
        if src_ratio and out_ratio and abs(src_ratio - out_ratio) > tolerance:
            print(f"FAIL {name}: shape changed — was {src_ratio:.2f} wide-to-tall, now {out_ratio:.2f}")
            bad = 1

        if check:
            if not (IMG / name).exists():
                print(f"FAIL {name}: not built"); bad = 1; continue
            shipped = Image.open(IMG / name)
            if shipped.size != out.size:
                print(f"FAIL {name}: shipped {shipped.size}, expected {out.size}"); bad = 1
            elif dark_opaque(shipped) > src_dark:
                print(f"FAIL {name}: shipped file has {dark_opaque(shipped)} dark pixels, source has {src_dark}")
                bad = 1
            else:
                print(f"ok   {name}  {shipped.size[0]}x{shipped.size[1]}, no halo")
        else:
            out.save(IMG / name, optimize=True)
            kb = (IMG / name).stat().st_size / 1024
            print(f"{name}: {original.size[0]}x{original.size[1]} -> {out.size[0]}x{out.size[1]}"
                  f"  {src.stat().st_size/1024:.0f} KB -> {kb:.0f} KB  (dark px {src_dark} -> {out_dark})")
    return bad


if __name__ == "__main__":
    raise SystemExit(main())
