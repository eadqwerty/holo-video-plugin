# HOLO style specification (the house style for every episode)

This document is binding. Every episode uses this visual system unless the user explicitly asks for a change. Values are measured from the seven references (see `REFERENCE_ANALYSIS.md`). The "engine" column names where each value lives.

## 1. Format
| | Value | Engine |
|---|---|---|
| Aspect / master | **Default delivery: vertical 9:16, 1080×1920 @ 30 fps** (user's choice, 2026-11-19), using `engine/web_vertical`: same look; glyph cells, titles and HUD scale by the short side; text stays in the UI-safe area x 0.05–0.80, y 0.10–0.66; framing is lens ×1.5 with the camera pulled back ×1.2, plus per-episode `vertical.js` re-framing. The 16:9 master below stays available on request. 16:9: **1920×1080 @ 30 fps** (refs are 1024×576 delivery copies of a 1080p master: glyph pitch 3.2×5.33 px = 6×10 px × 0.533) | `render.mjs --size 1920x1080 --fps 30` |
| Length | 50–82 s (target 60–70 s) | film `duration` |
| Delivery encode | H.264 CRF 18, yuv420p, bt709, AAC 256k, −14 LUFS | `render.mjs` + `sound.py` |

## 2. Palette and tone
| Token | Value | Engine |
|---|---|---|
| Paper white | (0.937, 0.941, 0.922) = (239,240,235). Never pure 255. | `post.js GRADE paper` |
| Black floor | 0.008 (≈2/255) | `blackPt` |
| Accent red | core **#E41B26** / scene red (0.89, 0.10, 0.16); on white it reads ≈ (185,83,92) | `GRADE redc`, `INKS.red`, `MATCAPS.red` |
| Dark-ink text | #2B2B2B · light text #D9D9D9 | `INKS` |
| Saturation | 0 everywhere except red (hue-selective keep) | `GRADE red retention` |
| Dark-scene haze | +0.08 radial lift behind the subject (refs' dark p50 ≈ 3–9/255, p75 ≈ 14–58/255) | `haze` |
| Contrast | gentle S (0.35) over hard-lit materials; dark-scene exposure 1.04 | `contrast`, `exposure` |

## 3. The glyph matte (the signature)
- **Cell:** 6×10 px at 1080p (3.2×5.33 at 1024), so the grid is 320×108.
- **Glyph source:** the digits of π, laid out like wrapped lines of text with rare blanks. Each cell's digit is fixed in screen space, so the matte does not swim with motion. A zoom-through scales the finished image, so the glyphs scale up (ref7 8.5 s).
- **Tone:** each cell takes its average colour (3×3 samples) mixed 35% with per-pixel detail.
- **Polarity:** dark scenes draw light digits on a darkened cell (×(1−0.62A) background, ×(1+1.05A) strokes). White scenes draw ink digits on a lightened cell.
- **Envelope A(L):** 0 at pure black. On white scenes it fades to 0 at paper white (0.83–0.915), so paper stays clean. On dark scenes highlights keep about 45% texture.
- **Cell gaps:** a 1 px column + 1 px row darkened by 50% × A.
- Text is composited before the matte (titles carry the texture). HUD is composited after (crisp).

## 4. Post chain (order matters)
1. Scene render, MSAA ×4, no colour management.
2. GRADE:
   - normal-oriented SSAO (0.6 × 0.35 m)
   - 1.4 px optical soften
   - chroma-preserving red retention (key: red − max(g,b), 0.012–0.09; crimson lean)
   - haze, tone curve, title layer
   - map to the black…paper range
3. CELL average, then GLYPH matte.
4. BLOOM at quarter resolution (red and highlights): 0.6 dark scenes / 0.3 white.
5. FINAL:
   - zoom-through + radial blur, whip directional blur
   - **radial chroma 0.0042** (blue zoomed out, so a yellow rim shows on white frames)
   - band glitch + RGB split
   - red blob flash
   - **streak interference:** random 2 px rows, 6% density, ±2 px tear
   - frame echo (feedback)
   - white / black / red flashes
   - vignette 0.38 dark / 0.06 white
   - HUD layer
   - grain 0.07 dark / 0.045 white plus chroma speckle

## 5. Transitions (measured at 10 fps; `runtime.js TRANSITIONS`)
| Name | Use | Recipe |
|---|---|---|
| **smear** (default, any black↔white cut) | most cuts | last 0.17 s: echo 0.55→0.9, horizontal smear, scene dims. Last 2 frames: **red blurred blob**. Cut frame: **flat paper/black frame**. Next 0.2 s: incoming fades from overexposed, matte at 60%. |
| **zoom** | into detail / new chapter | out: zoom 1→3.4 with radial blur (inCubic, 0.3 s). In: from 2.6× back to 1 (outCubic, 0.32 s). 1 frame 35% white. |
| **whip** | lateral energy, chapter turn | 0.14 s directional blur ±0.09 frame widths, 1 flash frame. |
| **glitch** | emphasis, same-polarity cut | 3 frames: band displacement, RGB split, streaks ×4. |
| **cut** | rare | hard cut + 1 frame of streaks. |

Glitch accents (3–4 per film) go on emphasis words; each lasts 0.07–0.12 s.

## 6. Characters
- **Android** (`engine/blender/build_android.py` → `engine/assets/android.glb`):
  - **Body (default since 2026-11-19, user's choice):** CC0 MakeHuman anatomy, 1.98 m, Rigify rig fitted to its joints, with a sculpted mannequin mask head (ref4-style) and dark ear pods with red dots. 291,768 tris.
  - Alternatives kept: `HOLO_HEAD=helmet` (same body, visor helmet → `android_mhh.glb`); `HOLO_BASE=metaball` (the v1–v4 procedural body, saved as `android_v4_metaball.glb`).
  - Armour plates cut from the body surface with clean plane cuts: helmet + visor + faceplate, chest/back plates, 4 abdominal bands, belt, shoulders, upper arms, gauntlets, gloves, thighs, knees, shins, boots.
  - Red accents: chest core, shoulder caps, knee/elbow/hip dots, wrist bands, boot tabs, visor dot.
  - Materials by role: `PLATE` chrome matcap (switches to `plateLight` on white scenes), `SUIT` near-black rubber, `RED`, `VISOR`.
- **Modes:** `chrome` (default); `ghost` (body only, matte, as in ref7's translucent anatomical figure); `xray` (additive fresnel + scanlines).
- **Posing** (`android.js`): bones are aimed by direction in character space, so poses are rig-convention-proof.
  - Library: `stand`, `armsUp`, `handsOpen`, `reach`, `sit`, `lie`, `thinker`, and the procedural `walkPose(phase)`.
  - `extend(base, patch)` adds variants; `mixPose` blends; `withIdle` adds breathing and head drift.

## 7. Environments and props (`env.js`, `props.js`)
- **Floor grid:** 1.2–1.3 px lines, 2–2.6 m spacing, slightly broken segments, fogged to the background (white 6→42 m, dark 4→32 m).
- **Red trace** (seismograph line drawing on), red concentric **rings**, **arcs** that draw/close, **particles** (1–3 px specks; dust, red aura, red core), wire **spheres**, **lattices**.
- Props: doors, pillars, desks, chairs, round tables, cubes (setRed), cards, calendars (light a cell), floating panels/tabs, bars.
- Props are grey matcap solids with thin ink (white scenes) or light (dark scenes) edges.
- **Hero props** (`heroProp(name)`): brain, bulb, headphones, phone, cabinet (`open(i,k)`), bed, clock (`setTime(h,m)`), hourglass. Built by `engine/blender/build_props.py`.
- **Doorways:** prefer free-standing frames (`wall({frame:true})`) over full walls; big grey walls flatten dark shots.
- **Red usage:** about half the shots. Alternate red and grey titles; the android's own red accents already put red in most figure shots.

## 8. Typography (`text.js`)
| Role | Font | Notes |
|---|---|---|
| Titles (default) | **Michroma** (open stand-in for Eurostile Extended), caps, tracking −0.035 em, 2% stroke | sizes 44–96 px @1080 (hero numbers up to 150). Red, dark #2B2B2B on white, light #D9D9D9 on black. |
| Heavy | Archivo Black | numbers and stats ("2X"); ref1-style punches |
| Blackletter | UnifrakturCook | single mythic words only (ref1 vocabulary) |
| HUD | IBM Plex Mono 19 px @1080 | "LABEL: VALUE" + "x 0000 y. 0000" + red underline, target ring r 12–20 px, leader 60 px, type-on 0.4 s, numbers re-roll for 0.35 s |

- **Title motion:** appear 0.10 s before the spoken word. A fine noise cloud condenses over 0.16 s, the word resolves through block dither, then holds with ~2.5% slow growth. Exit is a 0.12 s row-tear smear.
- **Placement:** top-centre (y 0.12–0.16) by default, bottom (y 0.86), or in clear space beside the subject. One or two words; at most 4 words.

## 9. Camera
- Always moving. Slow dolly/orbit through each shot, eased inOutSine. Handheld FBM drift (±3.5 cm).
- 30–36 mm-equivalent FOV (30–34° vertical). Low 3/4 angles for figures, top-down tilts for objects, 1–2 extreme close-ups per film.
- Shot length 1–3.5 s (average 2–3 s). Cuts land on sentence boundaries, plus **angle cuts on emphasis words** inside a sentence: `{t0, reuse:true, camera}` hard-cuts to a new camera on the same scene. House pace: **~28 shots per minute** (locked 2026-11-19).

## 10. Sound (`engine/audio/sound.py`)
- **Narration:** male, deep (target F0 100–130 Hz), 165–176 WPM (house pace **~174**), close-mic, light room. Default Kokoro voice `am_michael` at speed ~1.08 (tune 1.06–1.10 to hit ~174) (alternative: `am_onyx`). **Never a clone of the reference narrator.**
- **Bed:** sub drone on the root (D) + dark minor pad + quiet glassy partials (×8, ×10, ×13.6, ×20, ×32 of the root) + airy noise. Sits ~4 dB under the voice in gaps and ducks under speech.
- **SFX:**
  - smear cut: whoosh + sub boom + crunch click
  - zoom: whoosh + soft boom
  - whip: swish in/out
  - glitch: click bursts
  - title-in: data chirp
  - HUD: tick bursts
  - logo: click
- **Master:** −14 LUFS integrated, −1 dBTP.

## 11. Things the style never does
- No saturated colour other than red.
- No pure-white (255) frames or flat untextured fills. The matte is always on.
- No serif or body-text paragraphs. No subtitles track. Titles are keywords only.
- No stock footage, no real people's likeness, no reference channel logo, no cloned voice.
- No camera that holds perfectly still. No shot longer than ~4 s.
