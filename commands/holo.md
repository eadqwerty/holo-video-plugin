---
description: 'Make a HOLO-style video episode (e.g. /holo the Pygmalion effect, /holo next from the backlog, /holo setup)'
argument-hint: <topic | nothing (Claude picks) | "setup" | "re-render <episode>">
---

Use the `holo-video` skill for: $ARGUMENTS

- "setup" (or the project folder has no `engine/`): run the skill's setup step only and report what was installed or is missing.
- Nothing, "next", "auto" or "pick one": choose the topic yourself with the skill's `topic-finder.md`. It takes the
  backlog first, then researches and verifies new topics when the backlog is used up. State the pick in one line and
  make the episode; don't ask the user to choose.
- A topic or idea: make one episode about it, following the skill's workflow end to end.
- "re-render <episode>": re-run voice/render/sound for that episode at the house pace.
Make one episode at a time and show the user the result before starting another.
