# Content formula: script and storyboard system

## Niche
**Cinematic "hidden mechanism" mindset shorts.** Each video takes one little-known but real anchor (a dated experiment, a declassified document, a person's origin story, a mystic's or scientist's quote) and turns it into a second-person lesson about how *your* mind works. It ends on a question that puts the viewer in the frame.

- **Sub-niches seen:**
  - classic psychology experiments (ref2 bystander smoke study)
  - government/occult documents (ref3 CIA Gateway)
  - identity/self-perception (ref4)
  - manifestation and metaphysics (ref5 Walsch/Einstein, ref6 Goddard)
  - founder myth (ref1)
  - AI/free will (ref7)
- **Psychological appeal:**
  - forbidden or overlooked knowledge ("one page was missing")
  - a personal indictment that flatters the viewer as the exception ("Most people won't")
  - agency (one small action tonight or tomorrow)
  - identity ("who wrote yours?")
  - self-recognition ("You already do this")

## Script architecture (the beats, in order)
| # | Beat | Length | Pattern (from refs) |
|---|---|---|---|
| 1 | **Hook** | 1–2 sentences, ≤ 5 s | One of: "What if…" paradox (ref1, ref7) · direct provocation at the viewer (ref2) · date + institution + impossible act (ref3) · coined slogan (ref4) · absolute claim + correction (ref5) · instruction to the viewer + "Got it?" (ref6) |
| 2 | **Anchor** | 2–4 sentences | "In 19XX, …" with a named person or institution and one vivid procedural detail |
| 3 | **Result / reveal** | 1–3 sentences | numbers stated plainly (3 out of 4 / 9 out of 10 / 2 billion), or a mystery object (page 25) |
| 4 | **Mechanism** | 1–2 sentences | named concept ("Psychologists call it…", "a step called…") |
| 5 | **Mirror** | 3–5 short sentences | "That's most people right now" / "You already do this" / three concrete everyday examples in parallel fragments |
| 6 | **Turn** | 1 sentence | "But here's the part…" / "Bad news for them. Best news you'll ever get." |
| 7 | **Honesty or science caveat** (optional) | 1 sentence | "Nobody has proven it works." / "this isn't made up: your brain uses the same areas…" |
| 8 | **Action** | 2–3 fragments | one small, specific, time-boxed act: "Pick one. Do it tomorrow." / "Tonight. The last thing before you sleep." |
| 9 | **Close** | 1 question | turns the idea back on the viewer and echoes the hook's key noun |

## Language rules
- **Second person** throughout, except the anchor story. Present tense where possible.
- **Short sentences:** 5–8 words on average. Fragments are fine ("Out there. Far away."). Contrast pairs: "Not as a joke, as a job." / "Not on its way, here." / "Don't think of it. Think from it."
- **Lists of three** as parallel fragments.
- **Word count:** 180–210 words for a 60–70 s video at 165–176 WPM (ref7: 128 words for 50 s).
- **Facts must be checkable and stated with care.** Real dates, names and figures only, never invented. Hedge where the science is contested ("Researchers found…", "Nobody has proven…"). Keep a `facts.md` with sources for every episode.
- **No hashtags or CTA spoken.** The question is the CTA.

## Delivery
- Calm, low, close-mic male voice, slightly conspiratorial. Not shouty. **House pace (locked 2026-11-19, user's choice after the EP003 trial): ~174 WPM**, the top of the reference range. EP001/EP002 (~170) felt slow, and EP003 (179, 32 shots/min) was a little faster than the refs.
- Pauses: 0.12–0.18 s between sentences; ~0.28–0.34 s "beat" pauses before the turn, after a shock number and before the closing question.
- **Get in fast:** the hook drops straight into the story, and the anchor (date + name) lands by ~5 s. Keep lines short (about 20 lines for 190–205 words).
- Emphasis comes from sentence breaks rather than volume. Single-word sentences carry the punch ("Gone." "Perfectly." "Tonight.").
- `script.json` encodes this: one sentence or fragment group per line, plus `pause` after it.

## Storyboard rules (visual storytelling)
1. **One shot per sentence** (1–3.5 s). Very long sentences split on the key noun.
2. **Alternate white and black** roughly every shot. Use black for mystery, inner states, numbers that shock, and the final question. Use white for explanations, labs, plans and objects.
3. **Every shot has a literal visual noun** from the sentence (desk, door, cube, calendar, card, sphere, bed) made from the prop kit. Metaphors become objects: a loop is a red ring circling the head, a decision is the ring stopping, an unfinished task is a red cube.
4. **The android is "you"** and also plays the historical actors. The ghost/hologram mode is for the mind, the source or the inner world.
5. **One title per shot, on the key word**, 1–3 words, red for the punch word and dark/light grey for setup words. Hero numbers ("1920s", "2X") go big and in corners.
6. **HUD callouts** label the subject with a dry, clinical tag (TASK: OPEN, SUBJECT: WAITER, PLAN: SPECIFIC).
7. **Transitions:**
   - smear for polarity flips
   - zoom when going "inside" (into the head, into an object)
   - whip at chapter turns
   - glitch on the turn/emphasis lines
8. **Vertical-first framing (default delivery is 9:16):** keep the subject near the centre of frame. Prefer one figure per shot, or figures stacked in depth rather than side by side. Put side-by-side compositions in `vertical.js` (follow one figure, then cut to the other).
9. **Angle cuts:** hold a scene across a sentence but cut to a new camera on its emphasis word (**~28 shots per minute**, the house pace).
10. **Hero props** (brain, bulb, headphones, phone, cabinet, bed, clock, hourglass) for literal nouns; build new ones in `build_props.py` when an episode needs them.
11. **End** on the ghost figure with a red core in the dark, with the question title held to the end and the channel emblem flashing in the last half second.

## Topic bank (original; verify facts before writing)
| # | Anchor | Mechanism → lesson | Closing question |
|---|---|---|---|
| 1 | ✅ Lewin's waiter & Zeigarnik, 1920s (EP001) | open loops; a plan closes them | "Which one is still running?" |
| 2 | Rosenthal & Jacobson, 1968 ("Pygmalion in the Classroom") | expectations shape performance (note the replication debate) | "Who decided what you'd become?" |
| 3 | Zajonc, 1968, mere-exposure effect | you like what you see often | "What have you been staring at?" |
| 4 | Festinger's 1954 cult study ("When Prophecy Fails") | belief doubles down after disproof | "What are you still defending?" |
| 5 | Langer's 1978 "Xerox" study ("because…") | reasons, even empty ones, get compliance | "Whose 'because' runs your day?" |
| 6 | Seligman, 1967, learned helplessness | stopping trying after the cage opens | "Is your door already open?" |
| 7 | Mischel follow-ups / delay of gratification (contested) | environment beats willpower | "What's on your table?" |
| 8 | 1971 Stanford Prison Experiment (contested; frame it carefully) | roles write behaviour | "Which uniform are you wearing?" |
| 9 | Ebbinghaus, 1885, forgetting curve | review beats rereading | "What did you already lose this week?" |
| 10 | Ivan Pavlov's bell, 1890s | cues you never chose | "What rings your bell?" |
| 11 | Benjamin Franklin effect (1868 autobiography anecdote) | asking a favour builds liking | "Who should you ask tonight?" |
| 12 | Doorway effect (Radvansky, 2011) | boundaries reset the mind | "What did you leave in the last room?" |

The full 90-topic backlog should be grown from these sub-niches: dated psychology studies, declassified documents, origin myths, mystics/philosophers, and AI/consciousness. Mix them so no two adjacent episodes share a sub-niche.
