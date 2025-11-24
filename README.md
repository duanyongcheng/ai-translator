# AI Translator

Modern web translator that uses Gemini (default) or OpenAI for text translation and text-to-speech, with configurable models and playback controls.

## Features
- Automatic or manual source language selection with swap control.
- Translation output with copy, audio playback, and loop controls (count + interval).
- Settings modal to switch providers (Gemini/OpenAI), models, base URLs, and API keys; settings persist in local storage.
- Debounced translation, error messaging, and minimal UI built with React 19 + Vite + TypeScript.

## Quickstart
```bash
npm install
echo "GEMINI_API_KEY=<your_key>" > .env.local   # create env file
npm run dev        # http://localhost:3000
```

### Scripts
- `npm run dev` — start Vite dev server on port 3000 (host `0.0.0.0`).
- `npm run build` — production bundle to `dist/`.
- `npm run preview` — preview the production build locally.

## Configuration
- Env: `.env.local` (git-ignored) should contain `GEMINI_API_KEY=<your_key>`; Vite exposes it to `process.env.API_KEY`.
- Runtime: Use the Settings modal to override provider (`gemini` or `openai`), API key, base URL, and model for translation and TTS independently. Leaving API key empty tries the env default.
- Audio: Gemini returns PCM decoded in-browser; OpenAI uses built-in audio decode. Playback uses Web Audio API.

## Project Structure
- `index.tsx` — React entry mounting `App`.
- `App.tsx` — main layout, translation flow, language swapping, playback orchestration, settings persistence.
- `components/` — UI parts (`LanguageSelector`, `TranslationBox`, `SettingsModal`).
- `services/aiService.ts` — translation + TTS logic for Gemini/OpenAI, audio caching/playback helpers.
- `services/audioUtils.ts` — PCM decoding helpers.
- `constants.ts` — supported language lists.
- `types.ts` — shared types and enums.
- `vite.config.ts` — env loading, aliases, dev server settings.

## Usage Notes
- Ensure browser has permission for audio output; stop/play controls are per-pane.
- Loop playback applies to translated output; adjust count/interval in the output panel.
- Errors surface as inline banner; check API key/model/base URL when requests fail.

## Contributing
- Follow Conventional Commits (e.g., `feat(scope): summary`, `fix(scope): …`).
- Include clear PR descriptions with screenshots for UI changes and note any env/config impacts.
- Manual test checklist: translate in both directions, swap languages, play/stop TTS, loop playback, tweak settings, refresh to confirm persistence. Add Vitest + React Testing Library if you introduce automated tests.
