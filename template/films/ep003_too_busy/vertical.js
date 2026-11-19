// EP003 vertical (9:16) re-framing. Used only by engine/web_vertical (render_vertical.mjs); the 16:9 film ignores it.
// Defaults (engine/web_vertical): lens x1.5, camera pulled back x1.2; `dist` here multiplies that.
// Each entry picks the shot playing at time `at` and adjusts its camera (see engine/web_vertical/src/runtime.js).
import { loadNarration } from 'holo/sync.js';

export default async function () {
  const N = await loadNarration('/films/ep003_too_busy/audio');
  const w = N.w, cut = N.cut;
  return {
    shots: [
      { at: cut('l04') + 0.3, dist: 1.15 },                                // four seminarians: pull back so more of the row shows
      { at: cut('l05') + 0.3, follow: 0, followY: 1.1, dist: 0.9 },       // walking the route: keep the walker centred
      { at: cut('l07') + 0.2, follow: 0, followY: 1.55 },                 // "had time": the calm figure (left)
      { at: w('late') + 0.05, follow: 1, followY: 1.5 },                  // "you're late": the hurried figure (right)
      { at: cut('l10') + 0.2, follow: 1, followY: 1.0 },                  // 10%: travel with the hurried walker past the man
      { at: cut('l11') + 0.2, dist: 1.5 },                                // two talk cards: both fully in frame
    ],
  };
}
