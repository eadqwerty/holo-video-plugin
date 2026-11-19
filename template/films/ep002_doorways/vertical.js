// EP002 vertical (9:16) re-framing. Used only by engine/web_vertical (render_vertical.mjs); the 16:9 film ignores it.
// Defaults (engine/web_vertical): lens x1.5, camera pulled back x1.2; `dist` here multiplies that.
// shots: each entry picks the shot playing at time `at` and adjusts its camera (see engine/web_vertical/src/runtime.js).
// titles: moves a title inside the UI-safe area ([0,0] top-left .. [1,1] bottom-right) where it would sit on the figure.
import { loadNarration } from 'holo/sync.js';

export default async function () {
  const N = await loadNarration('/films/ep002_doorways/audio');
  const w = N.w, cut = N.cut;
  return {
    shots: [
      { at: cut('l05') + 0.2, dist: 1.3 },                                // doorway path vs open path: both walkers
      { at: w('distance') - 0.3, dist: 1.25 },                            // same distance: path B's walker back in frame
      { at: cut('l07') + 0.2, dist: 1.15 },                               // the row of screens
      { at: w('file') + 0.1, aim: [-3.8, 1.8, -2.0] },                   // filing the old scene: dolly stays on the shelves
      { at: cut('l12') + 0.2, follow: 0, followY: 1.15 },                 // carrying the box across the line
      { at: cut('l13') + 0.2, follow: 0, followY: 0.95 },                 // at the desk, tonight
      { at: w('end') - 0.3, dist: 1.35 },                                 // walk out: figure and door
    ],
    titles: [
      { str: 'Let the scene end', pos: [0.5, 0.0] },
      { str: 'One question', pos: [0.5, 0.0] },                           // top, where 'Every room' was (it has gone by then)
    ],
  };
}
