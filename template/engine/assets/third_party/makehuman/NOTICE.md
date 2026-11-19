# MakeHuman assets (third party, CC0 1.0)

Downloaded 2026-11-19 from https://github.com/makehumancommunity/makehuman (branch master):
- `base.obj` (hm08 base mesh) from `makehuman/data/3dobjs/`
- `targets/*.target` from `makehuman/data/targets/macrodetails/` (race, universal muscle/weight, ideal proportions; male, young)

Licence: the repository's `LICENSE.md` (copied here) states the base mesh, proxies, targets and modifiers
"have been released under CC0 1.0 Universal"; every downloaded file carries the CC0 header
("This asset was explicitly released as CC0 in september 2020"). AGPL covers only MakeHuman's source code,
which is not used here. MakeHuman "makes no claim whatsoever over output". Free for commercial use; no attribution required.

Used by `engine/blender/mh_body.py` -> `build_android.py` with `HOLO_BASE=mh`.
