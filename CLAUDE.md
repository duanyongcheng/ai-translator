# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI Translator is a React web application providing real-time text translation and text-to-speech using Google Gemini (default) or OpenAI APIs. Built with React 19, TypeScript, Vite, and Tailwind CSS v4 (via Vite plugin).

## Development Commands

```bash
npm install          # Install dependencies (pnpm under the hood)
npm run dev          # Dev server at http://localhost:3000
npm run build        # Production build to dist/
npm run preview      # Preview production build
```

No automated tests or linting configured yet.

## Architecture

**Flat File Structure:** Source files live at root level (no `src/` directory). The `@/` path alias maps to the project root.

**State Management:** Centralized in `App.tsx` using React hooks. Settings persisted to localStorage (key: `gemini-translator-settings`).

**Data Flow:**
1. User input → debounced (1s) → `handleTranslate()` → `aiService.translateText()`
2. Speaker click → `generateTTS()` → audio cache check → `playAudioBuffer()` via Web Audio API
3. Ref-based playback control (`stopPlaybackRef`, `isCancelledRef`) for cancellation performance

**Dual-Provider Pattern:** `services/aiService.ts` abstracts Gemini and OpenAI behind unified interfaces for both translation and TTS. Provider selection determined by settings; fallback chain for API keys: `appSettings.apiKey` → `process.env.GEMINI_API_KEY` → `process.env.API_KEY`.

**Audio Caching:** Two-layer system for TTS audio:
- Memory cache (`audioCacheRef` in App.tsx) for instant replay
- IndexedDB persistent cache (`services/audioCache.ts`) survives page refresh, max 50 entries with LRU eviction

**Audio Processing:**
- Gemini returns base64-encoded PCM (decoded via `audioUtils.ts`)
- OpenAI returns MP3/WAV (browser native decode)
- Shared AudioContext at 24kHz sample rate

## Key Files

| File | Purpose |
|------|---------|
| `App.tsx` | Main state hub, translation/playback orchestration, history management |
| `services/aiService.ts` | Translation + TTS logic for both providers |
| `services/audioCache.ts` | IndexedDB persistent audio cache |
| `services/audioUtils.ts` | PCM decoding helpers |
| `components/SettingsModal.tsx` | Provider/model/API key configuration |
| `components/TranslationBox.tsx` | Text areas with audio/loop controls |
| `components/HistoryPanel.tsx` | Translation history sidebar |
| `components/LanguageSelector.tsx` | Language dropdowns |
| `types.ts` | Shared TypeScript interfaces |
| `constants.ts` | Supported languages list |
| `vite.config.ts` | Dev server (port 3000), env loading, path alias `@/` |

## Conventions

- **Components:** PascalCase, presentational only (no direct API calls)
- **Functions/variables:** camelCase
- **Constants:** SCREAMING_SNAKE_CASE
- **Styling:** Tailwind utility classes inline
- **Commits:** Conventional Commits with scope (`feat(scope): summary`)

## localStorage Keys

- `gemini-translator-settings` — App settings (provider, API keys, models)
- `gemini-translator-history` — Translation history (max 50 items)

## Environment

Create `.env.local` (git-ignored):
```
GEMINI_API_KEY=your-api-key
```

Users can also set API keys at runtime via the Settings modal.
