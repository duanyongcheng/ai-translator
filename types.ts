export interface Language {
  code: string;
  name: string;
}

export interface LoopSettings {
  enabled: boolean;
  count: number;
  interval: number;
}

export type ProviderType = 'gemini' | 'openai';

export interface AIServiceConfig {
  provider: ProviderType;
  apiKey: string;
  baseUrl: string;
  model: string;
}

export interface AppSettings {
  translation: AIServiceConfig;
  tts: AIServiceConfig;
}

export interface TranslationState {
  inputText: string;
  translatedText: string;
  isTranslating: boolean;
  isSpeakingInput: boolean;
  isSpeakingOutput: boolean;
  error: string | null;
  loopSettings: LoopSettings;
}

export enum TTSVoice {
  Puck = 'Puck',
  Charon = 'Charon',
  Kore = 'Kore',
  Fenrir = 'Fenrir',
  Zephyr = 'Zephyr'
}
