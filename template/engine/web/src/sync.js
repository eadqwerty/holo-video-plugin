// Narration sync: load words.json / lines.json produced by engine/tools/voice.py and query times by word.
//   const N = await loadNarration('/films/ep001/audio');
//   N.w('waiter')        -> t0 of first "waiter"     N.w('loop', 1) -> second occurrence
//   N.we('waiter')       -> t1 (end) of that word    N.line('l05') -> {t0,t1,text}
//   N.cut('l05')         -> shot start for a line (cuts land ~0.12 s before the sentence, as in the refs)
//   N.title('gone', opts)-> a text item that appears 0.1 s before the word and holds until the next cut
export async function loadNarration(base) {
  const words = await (await fetch(base + '/words.json')).json();
  const lines = await (await fetch(base + '/lines.json')).json();
  const key = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const find = (k, n = 0) => {
    const hits = words.filter(w => w.key === key(k));
    if (!hits[n]) throw new Error(`narration: word "${k}" #${n} not found`);
    return hits[n];
  };
  const L = id => lines.find(l => l.id === id);
  return {
    words, lines,
    w: (k, n = 0) => find(k, n).t0,
    we: (k, n = 0) => find(k, n).t1,
    line: L,
    cut: id => Math.max(0, L(id).t0 - 0.12),
    end: lines[lines.length - 1].t1,
  };
}
