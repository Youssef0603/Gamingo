# Gaming words data folder

Drop this `src/data` folder into your app.

- `phrases.ts` is now a thin loader that rebuilds the existing `phrases` export from JSON files.
- `phrases/meta.json` stores the shared phrase metadata and display order.
- `phrases/en.json`, `phrases/ar.json`, and the other language files store translations keyed by phrase id.
- Contains 418 gaming phrases/words ordered from most common to more situational.
- Every phrase includes: `en`, `fr`, `es`, `de`, `ar`, `it`, `pt`, `hi`, `nl`, `pl`, `tr`, `ru`, `ja`, `ko`, `zh`.

Note: This pack was cleaned carefully for structure and obvious translation defects; native-speaker QA is still recommended before a high-stakes public localization release.
