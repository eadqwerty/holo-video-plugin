# Topic finder: choose the next episode's topic yourself

Use this when the user gives no topic (`/holo`, `/holo next`, `/holo auto`, "pick one yourself", "surprise me").
Don't ask the user to choose. Pick, say in one line what you picked and why, and go on with the episode. The user
can veto at the delivery step.

## A. What has been done
1. `docs/EPISODE_LOG.md`: one row per finished episode (episode, topic, anchor, sub-niche, date). This is the
   source of truth. Also list `films/ep*/` in case an episode is missing from the log.
2. `docs/TOPIC_BACKLOG.md`: entries whose heading carries `✅ made as EPxxx` are done. The "Exclusions applied"
   rule under Method lists topics that are never used (they belong to the reference videos' subjects).
3. Note the **last episode's sub-niche**. The next one must be in a different sub-niche. Avoid the last three if
   possible.

## B. Pick from the backlog first
Go through the backlog in its listed order and take the first topic that:
- is not made, not excluded and not under "Rejected / not usable";
- is in a sub-niche different from the last episode's;
- is ROBUST, or SOLID-LIMITED with a clear hedge. Take a CONTESTED one only if nothing else fits, and then follow
  its hedging note exactly;
- can be shown with the prop kit (android, ghost hologram, doors and walls, desks and tables, cubes, cards, calendar,
  film strip, clocks, bulb, brain, phone, headphones, bed, hourglass, cabinet, rings, boundary planes) or with one
  new simple prop.

Then **re-verify it**, as for any topic: web search the primary source (paper, DOI, archive, primary text),
confirm the names, year, procedure and every number you will say, and note any newer replication news. If
verification fails, mark the entry in the backlog (move it to "Rejected / not usable" with the reason) and take the
next one.

## C. When the backlog is used up (or the user asks for something new): research new topics
1. **Generate 8-10 candidates** across the sub-niches that were used least recently:
   - classic experiments;
   - memory, attention and perception;
   - habits and behaviour change;
   - social influence;
   - decision-making and bias;
   - history and origin stories of real people;
   - declassified or government research;
   - philosophy with sourced quotes;
   - neuroscience of imagination, sleep and emotion.

   Each candidate needs:
   - a dated, named anchor (a person, an institution, a year);
   - one vivid procedural detail;
   - a plain number or a mystery object;
   - a second-person lesson.

   Search the web for lesser-known material ("little-known psychology experiment", journal archives, declassified
   reading rooms, primary philosophical texts) rather than the most viral claims. Skip anything already in the log,
   the backlog or the exclusions, and anything about a living private individual.
2. **Verify each candidate** in at least one primary or publisher record (DOI, PubMed, journal page, university
   copy of the paper, official archive). A number counts only if it is in the paper or in two consistent
   independent sources. Drop candidates that fail. Popular figures that cannot be confirmed go to "Rejected / not
   usable" with the reason.
3. **Score the survivors** (1-5 each) and take the highest total:
   | Criterion | 5 means |
   |---|---|
   | Hook | a paradox, a shock number or an impossible act a stranger would stop scrolling for |
   | Evidence | ROBUST, read in the primary source |
   | Lesson | a concrete, everyday second-person takeaway with one small action |
   | Visual | every beat maps to a literal prop-kit noun; at most one new prop |
   | Freshness | a different sub-niche from the last 3 episodes and not a well-worn viral topic |
4. **Add every verified candidate** to `docs/TOPIC_BACKLOG.md` as a new numbered entry in the existing format:
   - Anchor, Source (with URL), Finding (with numbers), Status tag, Lesson, Hook, Close and Visuals.
   - Keep the sub-niche counts table current.

   The unused candidates refill the backlog for later episodes.

## D. Then make the episode
Mark the chosen backlog heading `· ✅ made as EPxxx` when the episode is delivered, and append a row to
`docs/EPISODE_LOG.md`. Follow the normal workflow: facts.md first, script, voice, film, stills, render, QA, deliver.

## Never
- Never invent or "round up" a finding to make a better hook. A weaker true hook beats a strong false one.
- Never pick a topic only because it is viral. Trending claims are the ones most often wrong.
- Never reuse the subject of a reference video or of another creator's well-known video script.
