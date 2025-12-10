import { GoogleGenAI, Modality } from "@google/genai";
import { decode, decodeAudioData } from "./audioUtils";
import { AppSettings, AIServiceConfig } from "../types";

// Default configuration values
export const DEFAULT_SETTINGS: AppSettings = {
  translation: {
    provider: "gemini",
    apiKey: "", // Will default to process.env.API_KEY if empty in logic
    baseUrl: "", // Default for Gemini SDK is automatic
    model: "gemini-2.5-flash",
  },
  tts: {
    provider: "gemini",
    apiKey: "",
    baseUrl: "",
    model: "gemini-2.5-flash-preview-tts",
  },
};

let sharedAudioContext: AudioContext | null = null;

const getAudioContext = () => {
  if (!sharedAudioContext) {
    const AudioContextClass =
      window.AudioContext || (window as any).webkitAudioContext;
    sharedAudioContext = new AudioContextClass({ sampleRate: 24000 });
  }
  if (sharedAudioContext.state === "suspended") {
    sharedAudioContext.resume();
  }
  return sharedAudioContext;
};

// --- Helper: Get Valid API Key ---
const getKey = (config: AIServiceConfig) => {
  const key =
    config.apiKey || process.env.GEMINI_API_KEY || process.env.API_KEY || "";
  // Guard against accidentally inlined "undefined"/"null" strings when env vars are missing.
  if (!key || key === "undefined" || key === "null") {
    return "";
  }
  return key;
};

const trimTrailingSlash = (url: string) => url.replace(/\/+$/, "");

// Normalize base URL and auto-append version path
const normalizeGeminiBaseUrl = (baseUrl: string) => {
  const base = trimTrailingSlash(baseUrl);
  // Remove trailing /v1beta or /v1 if user accidentally included it
  return base.replace(/\/(v1beta|v1)$/, "");
};

const normalizeOpenAIBaseUrl = (baseUrl: string) => {
  const base = trimTrailingSlash(baseUrl);
  // Remove trailing /v1 if user accidentally included it
  return base.replace(/\/v1$/, "");
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
  const normalizeGeminiModel = (model?: string) => {
    const lower = (model || "").toLowerCase();
    // TTS models only support audio responses; fall back to a text-capable model for translation.
    if (lower.includes("tts")) {
      console.warn(
        "TTS model selected for translation; falling back to gemini-2.5-flash for text output."
      );
      return "gemini-2.5-flash";
    }
    return model || "gemini-2.5-flash";
  };

  if (config.provider === "gemini" && !apiKey) {
    throw new Error(
      "Missing Gemini API key. Set GEMINI_API_KEY in .env.local or provide it in Settings."
    );
  }

  const fromLangName = fromLang === "auto" ? "Detect Language" : fromLang;

  const systemPrompt = `You are a professional translator. Translate from ${fromLangName} to ${toLang} (Language Code: ${toLang}). Return ONLY the translated text.`;

  if (config.provider === "openai") {
    return translateWithOpenAI(text, systemPrompt, config);
  } else {
    const model = normalizeGeminiModel(config.model);
    if (config.baseUrl) {
      return translateWithGeminiRest(text, systemPrompt, config, model);
    }
    return translateWithGemini(text, systemPrompt, config, model);
  }
};

const translateWithGemini = async (
  text: string,
  systemPrompt: string,
  config: AIServiceConfig,
  modelOverride?: string
) => {
  const ai = new GoogleGenAI({ apiKey: getKey(config) });
  // Note: @google/genai SDK doesn't easily support custom baseUrl in the constructor
  // without digging deep, but usually not needed for official Gemini.
  // If user really wants custom URL for "Gemini", they usually mean an OpenAI-compatible endpoint serving Gemini models.

  try {
    const response = await ai.models.generateContent({
      model: modelOverride || config.model || "gemini-2.5-flash",
      contents: [
        { role: "user", parts: [{ text: `${systemPrompt}\n\n"${text}"` }] },
      ],
    });
    return response.text?.trim() || "";
  } catch (error) {
    console.error("Gemini Translation error:", error);
    throw error;
  }
};

const translateWithGeminiRest = async (
  text: string,
  systemPrompt: string,
  config: AIServiceConfig,
  model: string
) => {
  const apiKey = getKey(config);
  if (!apiKey) {
    throw new Error(
      "Missing Gemini API key. Set GEMINI_API_KEY in .env.local or provide it in Settings."
    );
  }
  const base = normalizeGeminiBaseUrl(config.baseUrl || "");
  if (!base) {
    throw new Error(
      "Gemini base URL is empty. Clear it to use the official API or provide a valid self-hosted endpoint."
    );
  }

  const url = `${base}/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const body = {
    contents: [
      { role: "user", parts: [{ text: `${systemPrompt}\n\n"${text}"` }] },
    ],
    // Explicitly request text to avoid modality mismatches.
    responseModalities: ["TEXT"],
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini REST Translation error: ${res.status} ${errText}`);
  }

  const data = await res.json();
  const textPart = data?.candidates?.[0]?.content?.parts?.find(
    (p: any) => p.text
  )?.text;
  if (!textPart) {
    throw new Error("Gemini REST Translation error: empty response");
  }
  return String(textPart).trim();
};

const translateWithOpenAI = async (
  text: string,
  systemPrompt: string,
  config: AIServiceConfig
) => {
  const base = normalizeOpenAIBaseUrl(config.baseUrl || "https://api.openai.com");
  const url = `${base}/v1/chat/completions`;
  const apiKey = getKey(config);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: config.model || "gpt-3.5-turbo",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || "OpenAI API Error");
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
  voiceName: string = "alloy" // Default for OpenAI, Gemini uses 'Kore' by default logic below
): Promise<AudioBuffer> => {
  const config = settings.tts;
  const apiKey = getKey(config);

  if ((config.provider === "gemini" || config.provider === "siliconflow") && !apiKey) {
    throw new Error(
      `Missing ${config.provider} API key. Provide it in Settings.`
    );
  }

  if (config.provider === "openai") {
    return generateTTSOpenAI(text, config, voiceName);
  } else if (config.provider === "siliconflow") {
    return generateTTSSiliconFlow(text, config, voiceName);
  } else {
    // For Gemini, we map 'alloy' etc to a default if it's passed from state default
    const geminiVoice = ["Puck", "Charon", "Kore", "Fenrir", "Zephyr"].includes(
      voiceName
    )
      ? voiceName
      : "Kore";
    if (config.baseUrl) {
      return generateTTSGeminiRest(text, config, geminiVoice);
    }
    return generateTTSGemini(text, config, geminiVoice);
  }
};

const generateTTSGemini = async (
  text: string,
  config: AIServiceConfig,
  voiceName: string
) => {
  const ai = new GoogleGenAI({ apiKey: getKey(config) });

  try {
    const response = await ai.models.generateContent({
      model: config.model || "gemini-2.5-flash-preview-tts",
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

    const base64Audio =
      response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error("No audio data from Gemini");

    const audioContext = getAudioContext();
    return await decodeAudioData(decode(base64Audio), audioContext, 24000, 1);
  } catch (error) {
    console.error("Gemini TTS error:", error);
    throw error;
  }
};

const generateTTSOpenAI = async (
  text: string,
  config: AIServiceConfig,
  voiceName: string
) => {
  const base = normalizeOpenAIBaseUrl(config.baseUrl || "https://api.openai.com");
  const url = `${base}/v1/audio/speech`;
  const apiKey = getKey(config);

  // OpenAI voices: alloy, echo, fable, onyx, nova, shimmer
  // Ensure we have a valid openai voice, fallback to alloy
  const validVoices = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"];
  const openaiVoice = validVoices.includes(voiceName.toLowerCase())
    ? voiceName.toLowerCase()
    : "alloy";

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: config.model || "tts-1",
        input: text,
        voice: openaiVoice,
      }),
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

const generateTTSSiliconFlow = async (
  text: string,
  config: AIServiceConfig,
  voiceName: string
) => {
  const apiKey = getKey(config);
  const url = "https://api.siliconflow.cn/v1/audio/speech";

  // SiliconFlow voices: alex, benjamin, charles, david, anna, bella, claire, diana
  const validVoices = ["alex", "benjamin", "charles", "david", "anna", "bella", "claire", "diana"];
  const sfVoice = validVoices.includes(voiceName.toLowerCase())
    ? voiceName.toLowerCase()
    : "anna";

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "FunAudioLLM/CosyVoice2-0.5B",
        input: text,
        voice: `fishaudio/fish-speech-1.4:${sfVoice}`,
        response_format: "mp3",
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`SiliconFlow TTS Error: ${err}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const audioContext = getAudioContext();
    return await audioContext.decodeAudioData(arrayBuffer);
  } catch (error) {
    console.error("SiliconFlow TTS error:", error);
    throw error;
  }
};

const generateTTSGeminiRest = async (
  text: string,
  config: AIServiceConfig,
  voiceName: string
) => {
  const apiKey = getKey(config);
  if (!apiKey) {
    throw new Error(
      "Missing Gemini API key. Set GEMINI_API_KEY in .env.local or provide it in Settings."
    );
  }
  const base = normalizeGeminiBaseUrl(config.baseUrl || "");
  if (!base) {
    throw new Error(
      "Gemini base URL is empty. Clear it to use the official API or provide a valid self-hosted endpoint."
    );
  }

  const url = `${base}/v1beta/models/${
    config.model || "gemini-2.5-flash-preview-tts"
  }:generateContent`;
  const body = {
    contents: [{ parts: [{ text }] }],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName },
        },
      },
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini REST TTS error: ${res.status} ${errText}`);
  }

  const data = await res.json();
  const base64Audio = data?.candidates?.[0]?.content?.parts?.find(
    (p: any) => p.inlineData
  )?.inlineData?.data;
  if (!base64Audio) {
    throw new Error("Gemini REST TTS error: empty audio response");
  }

  const audioContext = getAudioContext();
  return await decodeAudioData(decode(base64Audio), audioContext, 24000, 1);
};

const generateTTSGeminiRestRaw = async (
  text: string,
  config: AIServiceConfig,
  voiceName: string
): Promise<{ data: ArrayBuffer; format: "pcm" | "mp3" }> => {
  const apiKey = getKey(config);
  if (!apiKey) {
    throw new Error(
      "Missing Gemini API key. Set GEMINI_API_KEY in .env.local or provide it in Settings."
    );
  }
  const base = normalizeGeminiBaseUrl(config.baseUrl || "");
  if (!base) {
    throw new Error(
      "Gemini base URL is empty. Clear it to use the official API or provide a valid self-hosted endpoint."
    );
  }

  const url = `${base}/v1beta/models/${
    config.model || "gemini-2.5-flash-preview-tts"
  }:generateContent`;
  const body = {
    contents: [{ parts: [{ text }] }],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName },
        },
      },
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini REST TTS error: ${res.status} ${errText}`);
  }

  const data = await res.json();
  const base64Audio = data?.candidates?.[0]?.content?.parts?.find(
    (p: any) => p.inlineData
  )?.inlineData?.data;
  if (!base64Audio) {
    throw new Error("Gemini REST TTS error: empty audio response");
  }

  return { data: decode(base64Audio).buffer as ArrayBuffer, format: "pcm" };
};

// 获取原始音频数据（用于缓存）
export const generateTTSRaw = async (
  text: string,
  settings: AppSettings,
  voiceName: string = "alloy"
): Promise<{ data: ArrayBuffer; format: "pcm" | "mp3" }> => {
  const config = settings.tts;
  const apiKey = getKey(config);

  if ((config.provider === "gemini" || config.provider === "siliconflow") && !apiKey) {
    throw new Error(`Missing ${config.provider} API key.`);
  }

  if (config.provider === "openai") {
    // OpenAI 返回 MP3
    const base = normalizeOpenAIBaseUrl(config.baseUrl || "https://api.openai.com");
    const url = `${base}/v1/audio/speech`;
    const validVoices = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"];
    const openaiVoice = validVoices.includes(voiceName.toLowerCase())
      ? voiceName.toLowerCase()
      : "alloy";

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: config.model || "tts-1",
        input: text,
        voice: openaiVoice,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI TTS Error: ${err}`);
    }

    return { data: await response.arrayBuffer(), format: "mp3" };
  } else if (config.provider === "siliconflow") {
    // SiliconFlow 返回 MP3
    const url = "https://api.siliconflow.cn/v1/audio/speech";
    const validVoices = ["alex", "benjamin", "charles", "david", "anna", "bella", "claire", "diana"];
    const sfVoice = validVoices.includes(voiceName.toLowerCase())
      ? voiceName.toLowerCase()
      : "anna";

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "FunAudioLLM/CosyVoice2-0.5B",
        input: text,
        voice: `fishaudio/fish-speech-1.4:${sfVoice}`,
        response_format: "mp3",
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`SiliconFlow TTS Error: ${err}`);
    }

    return { data: await response.arrayBuffer(), format: "mp3" };
  } else {
    // Gemini 返回 PCM
    const geminiVoice = ["Puck", "Charon", "Kore", "Fenrir", "Zephyr"].includes(
      voiceName
    )
      ? voiceName
      : "Kore";

    if (config.baseUrl) {
      // Use REST API when custom baseUrl is set
      return generateTTSGeminiRestRaw(text, config, geminiVoice);
    }

    const ai = new GoogleGenAI({ apiKey: getKey(config) });

    const response = await ai.models.generateContent({
      model: config.model || "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: geminiVoice },
          },
        },
      },
    });

    const base64Audio =
      response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error("No audio data from Gemini");

    return { data: decode(base64Audio).buffer as ArrayBuffer, format: "pcm" };
  }
};

// 从原始数据解码为 AudioBuffer
export const decodeRawAudio = async (
  data: ArrayBuffer,
  format: "pcm" | "mp3"
): Promise<AudioBuffer> => {
  const audioContext = getAudioContext();
  if (format === "mp3") {
    return await audioContext.decodeAudioData(data.slice(0));
  } else {
    return await decodeAudioData(new Uint8Array(data), audioContext, 24000, 1);
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
      try {
        source.stop();
      } catch (e) {}
      isStopped = true;
    }
  };

  const promise = new Promise<void>((resolve) => {
    source.onended = () => resolve();
  });

  return { promise, stop };
};
