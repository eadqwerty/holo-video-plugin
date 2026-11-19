// EP001 vertical (9:16) re-framing. Used only by engine/web_vertical (render_vertical.mjs); the 16:9 film ignores it.
// Defaults (engine/web_vertical): lens x1.5, camera pulled back x1.2; `dist` here multiplies that.
// shots: each entry picks the shot playing at time `at` and adjusts its camera (see engine/web_vertical/src/runtime.js).
// titles: moves a title inside the UI-safe area ([0,0] top-left .. [1,1] bottom-right) where it would sit on the figure.
import { loadNarration } from 'holo/sync.js';

export default async function () {
  const N = await loadNarration('/films/ep001_open_loops/audio');
  const w = N.w, cut = N.cut;
  return {
    shots: [
      { at: w('perfectly') + 0.05, dist: 1.35 },                          // "perfectly": room for the title above the card
      { at: cut('l12') + 0.2, dist: 1.6 },                                // "nobody tells you": whole head and shoulders
      { at: cut('l13') + 0.2, dist: 1.25 },                               // pedestal: the whole ring in frame
      { at: cut('l14') + 0.2, dist: 1.45 },                               // figure + plan board both in frame
    ],
    titles: [
      { str: 'A waiter', pos: [0.5, 0.06] },                              // above the head, not across the chest
      { str: 'Perfectly', pos: [0.5, 0.0] },
      { str: 'Nobody tells you', pos: [0.5, 0.0] },
      { str: 'In the background', pos: [0.5, 0.0] },                   // above the head ring, not across the hips
    ],
  };
}
