# Repository Guidelines

## Project Structure & Module Organization
- Vite + React 19 + TypeScript entry at `index.tsx` mounting `App.tsx`.
- `App.tsx` drives translation state, language swap, speech playback, and settings persistence (localStorage key `gemini-translator-settings`).
- `components/` holds UI pieces: `LanguageSelector` (dropdowns), `TranslationBox` (text areas with audio/loop controls), and `SettingsModal` (provider + model configuration).
- `services/aiService.ts` centralizes translation and TTS for Gemini/OpenAI, plus audio caching/playback; `services/audioUtils.ts` decodes PCM returned by Gemini; `constants.ts` lists supported languages; `types.ts` contains shared interfaces; `vite.config.ts` injects env keys.
- Static shell in `index.html`; compiler settings live in `tsconfig.json`; `.env.local` (git-ignored) supplies secrets.

## Build, Test, and Development Commands
- Install: `npm install`
- Dev server: `npm run dev` (default http://localhost:5173). Set `GEMINI_API_KEY` in `.env.local` for the default Gemini path; custom keys/base URLs can also be set in the Settings modal.
- Production build: `npm run build` → outputs to `dist/`
- Preview built app: `npm run preview`
- No automated test script yet; see Testing Guidelines.

## Coding Style & Naming Conventions
- TypeScript with functional React components; use PascalCase for component/file names and camelCase for functions/variables. Keep shared types in `types.ts`.
- Prefer 2-space indentation, semicolons, and descriptive handler names (`handleTranslate`, `handleSpeak`, etc.).
- Keep business logic in `services/` and pass results via props; components should stay presentational and declarative.
- When adding configuration options, expose them in `SettingsModal` and persist alongside `DEFAULT_SETTINGS` in `aiService`.

## Testing Guidelines
- Current state: manual verification. Exercise translation requests, language swap, TTS playback start/stop, loop count/interval controls, error banner on API failure, and settings persistence after refresh.
- If adding automation, favor Vitest + React Testing Library; mock Gemini/OpenAI requests and Web Audio APIs to avoid external calls and flakiness.

## Commit & Pull Request Guidelines
- Follow Conventional Commits (`feat(scope): summary`, `fix`, `chore`, etc.); align with the existing `feat(initial-setup): …` style.
- PRs should cover: purpose/approach, UI impact (screenshots or short clips for visual changes), config/env changes (`.env.local` keys, provider defaults), and manual test notes.
- Keep secrets out of version control (`.env.local` is ignored) and trim debug logging before review.
