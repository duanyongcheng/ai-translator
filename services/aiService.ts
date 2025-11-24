import { GoogleGenAI, Modality } from "@google/genai";
import { decode, decodeAudioData } from "./audioUtils";
import { AppSettings, AIServiceConfig } from "../types";

// Default configuration values
export const DEFAULT_SETTINGS: AppSettings = {
  translation: {
    provider: 'gemini',
    apiKey: '', // Will default to process.env.API_KEY if empty in logic
    baseUrl: '', // Default for Gemini SDK is automatic
    model: 'gemini-2.5-flash',
  },
  tts: {
    provider: 'gemini',
    apiKey: '',
    baseUrl: '',
    model: 'gemini-2.5-flash-preview-tts',
  }
};

let sharedAudioContext: AudioContext | null = null;

const getAudioContext = () => {
  if (!sharedAudioContext) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    sharedAudioContext = new AudioContextClass({ sampleRate: 24000 });
  }
  if (sharedAudioContext.state === 'suspended') {
    sharedAudioContext.resume();
  }
  return sharedAudioContext;
};

// --- Helper: Get Valid API Key ---
const getKey = (config: AIServiceConfig) => {
  return config.apiKey || process.env.API_KEY || '';
};

// --- Translation Logic ---

export const translateText = async (
  text: string,
  fromLang: string,
  toLang: string,
  settings: AppSettings
): Promise<string> => {
  const config = settings.translation;
  const apiKey = getKey(config);
  
  if (!apiKey && config.provider === 'gemini') {
    // If no key provided for Gemini, we might rely on the built-in env if not overridden
    // But generally we need a key.
  }

  const fromLangName = fromLang === 'auto' ? "Detect Language" : fromLang;

  const systemPrompt = `You are a professional translator. Translate from ${fromLangName} to ${toLang} (Language Code: ${toLang}). Return ONLY the translated text.`;

  if (config.provider === 'openai') {
    return translateWithOpenAI(text, systemPrompt, config);
  } else {
    return translateWithGemini(text, systemPrompt, config);
  }
};

const translateWithGemini = async (text: string, systemPrompt: string, config: AIServiceConfig) => {
  const ai = new GoogleGenAI({ apiKey: getKey(config) });
  // Note: @google/genai SDK doesn't easily support custom baseUrl in the constructor 
  // without digging deep, but usually not needed for official Gemini.
  // If user really wants custom URL for "Gemini", they usually mean an OpenAI-compatible endpoint serving Gemini models.
  
  try {
    const response = await ai.models.generateContent({
      model: config.model || 'gemini-2.5-flash',
      contents: [
        { role: 'user', parts: [{ text: `${systemPrompt}\n\n"${text}"` }] }
      ],
    });
    return response.text?.trim() || "";
  } catch (error) {
    console.error("Gemini Translation error:", error);
    throw error;
  }
};

const translateWithOpenAI = async (text: string, systemPrompt: string, config: AIServiceConfig) => {
  const baseUrl = config.baseUrl || 'https://api.openai.com/v1';
  const url = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
  const apiKey = getKey(config);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: config.model || 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text }
        ]
      })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || 'OpenAI API Error');
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || "";
  } catch (error) {
    console.error("OpenAI Translation error:", error);
    throw error;
  }
};

// --- TTS Logic ---

export interface AudioControl {
  promise: Promise<void>;
  stop: () => void;
}

export const generateTTS = async (
  text: string,
  settings: AppSettings,
  voiceName: string = 'alloy' // Default for OpenAI, Gemini uses 'Kore' by default logic below
): Promise<AudioBuffer> => {
  const config = settings.tts;
  
  if (config.provider === 'openai') {
    return generateTTSOpenAI(text, config, voiceName);
  } else {
    // For Gemini, we map 'alloy' etc to a default if it's passed from state default
    const geminiVoice = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'].includes(voiceName) ? voiceName : 'Kore';
    return generateTTSGemini(text, config, geminiVoice);
  }
};

const generateTTSGemini = async (text: string, config: AIServiceConfig, voiceName: string) => {
  const ai = new GoogleGenAI({ apiKey: getKey(config) });
  
  try {
    const response = await ai.models.generateContent({
      model: config.model || 'gemini-2.5-flash-preview-tts',
      contents: [{ parts: [{ text: text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voiceName },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error("No audio data from Gemini");

    const audioContext = getAudioContext();
    return await decodeAudioData(decode(base64Audio), audioContext, 24000, 1);
  } catch (error) {
    console.error("Gemini TTS error:", error);
    throw error;
  }
};

const generateTTSOpenAI = async (text: string, config: AIServiceConfig, voiceName: string) => {
  const baseUrl = config.baseUrl || 'https://api.openai.com/v1';
  const url = `${baseUrl.replace(/\/+$/, '')}/audio/speech`;
  const apiKey = getKey(config);

  // OpenAI voices: alloy, echo, fable, onyx, nova, shimmer
  // Ensure we have a valid openai voice, fallback to alloy
  const validVoices = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];
  const openaiVoice = validVoices.includes(voiceName.toLowerCase()) ? voiceName.toLowerCase() : 'alloy';

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: config.model || 'tts-1',
        input: text,
        voice: openaiVoice,
      })
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI TTS Error: ${err}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const audioContext = getAudioContext();
    
    // Standard decodeAudioData handles MP3/WAV automatically
    return await audioContext.decodeAudioData(arrayBuffer);
  } catch (error) {
    console.error("OpenAI TTS error:", error);
    throw error;
  }
};

export const playAudioBuffer = (audioBuffer: AudioBuffer): AudioControl => {
  const audioContext = getAudioContext();
  const source = audioContext.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(audioContext.destination);
  source.start();

  let isStopped = false;

  const stop = () => {
    if (!isStopped) {
      try { source.stop(); } catch (e) {}
      isStopped = true;
    }
  };

  const promise = new Promise<void>((resolve) => {
    source.onended = () => resolve();
  });

  return { promise, stop };
};
