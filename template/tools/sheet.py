import sys
from PIL import Image
# sheet.py out.jpg cols tile_w img1 img2 ...
out, cols, tw = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]); fs = sys.argv[4:]
ims = [Image.open(f).convert('RGB') for f in fs]
th = int(ims[0].height * tw / ims[0].width); rows = (len(ims) + cols - 1) // cols
s = Image.new('RGB', (cols * tw, rows * th), (60, 60, 60))
for i, im in enumerate(ims): s.paste(im.resize((tw, th), Image.LANCZOS), ((i % cols) * tw, (i // cols) * th))
s.save(out, quality=90); print(out, s.size)
