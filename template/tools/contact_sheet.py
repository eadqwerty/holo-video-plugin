import sys, glob, os
from PIL import Image, ImageDraw
# usage: contact_sheet.py frames_dir out.jpg cols tile_w start_sec step_sec [start_idx end_idx]
d, out, cols, tw = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
t0, step = float(sys.argv[5]), float(sys.argv[6])
files = sorted(glob.glob(os.path.join(d, '*.jpg')))
if len(sys.argv) > 8: files = files[int(sys.argv[7]):int(sys.argv[8])]; t0 += int(sys.argv[7])*step
ims = [Image.open(f) for f in files]
w, h = ims[0].size; th = int(h * tw / w)
rows = (len(ims) + cols - 1) // cols
sheet = Image.new('RGB', (cols*tw, rows*th), (40, 40, 40))
dr = ImageDraw.Draw(sheet)
for i, im in enumerate(ims):
    x, y = (i % cols)*tw, (i//cols)*th
    sheet.paste(im.resize((tw, th)), (x, y))
    t = t0 + i*step
    dr.rectangle([x, y, x+44, y+14], fill=(0, 0, 0)); dr.text((x+2, y+1), f"{int(t//60)}:{t%60:04.1f}", fill=(255, 255, 0))
sheet.save(out, quality=88)
print(out, sheet.size)
