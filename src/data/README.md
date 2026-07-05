# Gaming words data folder

Drop this `src/data` folder into your app.

- `phrases.ts` is a thin loader that rebuilds the existing `phrases` export from JSON files.
- `phrases/meta.json` stores the shared phrase metadata and display order.
- `phrases/en.json`, `phrases/ar.json`, and the other language files store translations keyed by phrase id.
- Contains 560 curated gaming phrases/words ordered from most common to more situational.
- Also contains 42 moderation-oriented word-bank concepts that `phrases.ts` appends as toxic/cursing phrases at runtime.
- Every static phrase includes: `en`, `fr`, `es`, `de`, `ar`, `it`, `pt`, `hi`, `nl`, `pl`, `tr`, `ru`, `ja`, `ko`, `zh`.

Enhancement pass notes:

- Existing file names and existing phrase IDs/object keys were preserved.
- English-only abbreviation display values such as GG, GGWP, GLHF, AFK, BRB, DC, FPS, PvP, PvE, MMR, K/D, KDA, MVP, RNG, XP, DPS, AOE, and CC were localized in every non-English phrase file.
- Network/performance terms were changed from glossary nouns to real in-match phrases where useful, for example `Lag` -> `I'm lagging` / `عندي تقطيع`.
- Hindi, Arabic, Japanese, Korean, Russian, and Chinese text values were cleaned to avoid raw English leftovers in display phrases except where a localized gaming loanword is written in the target script.
- Added practical real-case phrases for ping, crashes, frozen game, no audio, voice issues, utility timing, overtime, third-party warnings, draft/pick disputes, bomb/plant rotations, post-plant discipline, tactical utility, toxic recognition, and anti-toxic play.

Native-speaker QA is still recommended before a high-stakes public localization release, especially for regional slang preferences and profanity policy.
