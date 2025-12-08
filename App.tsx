import React, { useState, useEffect, useRef } from "react";
import {
  ArrowRightLeft,
  Sparkles,
  Languages,
  Settings,
  Clock,
  Volume2,
  X,
  Copy,
  Repeat,
  StopCircle,
} from "lucide-react";
import { SUPPORTED_LANGUAGES, TARGET_LANGUAGES } from "./constants";
import { LanguageSelector } from "./components/LanguageSelector";
import { TranslationBox } from "./components/TranslationBox";
import { SettingsModal } from "./components/SettingsModal";
import {
  translateText,
  generateTTSRaw,
  decodeRawAudio,
  playAudioBuffer,
  DEFAULT_SETTINGS,
} from "./services/aiService";
import {
  TranslationState,
  LoopSettings,
  AppSettings,
  HistoryItem,
} from "./types";
import { HistoryPanel } from "./components/HistoryPanel";
import { getCachedAudio, setCachedAudio } from "./services/audioCache";

const HISTORY_KEY = "gemini-translator-history";
const MAX_HISTORY = 50;

function App() {
  const [sourceLang, setSourceLang] = useState("auto");
  const [targetLang, setTargetLang] = useState("en");

  // Settings State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [appSettings, setAppSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  // History State
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const [state, setState] = useState<TranslationState>({
    inputText: "",
    translatedText: "",
    isTranslating: false,
    isSpeakingInput: false,
    isSpeakingOutput: false,
    error: null,
    loopSettings: {
      enabled: true,
      count: 1,
      interval: 1.0,
    },
  });

  // Load settings from local storage on mount
  useEffect(() => {
    const saved = localStorage.getItem("gemini-translator-settings");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setAppSettings({ ...DEFAULT_SETTINGS, ...parsed });
      } catch (e) {
        console.error("Failed to parse settings", e);
      }
    }
  }, []);

  // Load history from local storage on mount
  useEffect(() => {
    const saved = localStorage.getItem(HISTORY_KEY);
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }
  }, []);

  const saveSettings = (newSettings: AppSettings) => {
    setAppSettings(newSettings);
    localStorage.setItem(
      "gemini-translator-settings",
      JSON.stringify(newSettings)
    );
  };

  // History helpers
  const addToHistory = (sourceText: string, translatedText: string) => {
    const newItem: HistoryItem = {
      id: Date.now().toString(),
      sourceText,
      translatedText,
      sourceLang,
      targetLang,
      timestamp: Date.now(),
    };

    setHistory((prev) => {
      // 去重：相同源文本+语言对不重复存
      const filtered = prev.filter(
        (item) =>
          !(
            item.sourceText === sourceText &&
            item.sourceLang === sourceLang &&
            item.targetLang === targetLang
          )
      );
      const updated = [newItem, ...filtered].slice(0, MAX_HISTORY);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem(HISTORY_KEY);
  };

  const deleteHistoryItem = (id: string) => {
    setHistory((prev) => {
      const updated = prev.filter((item) => item.id !== id);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  const selectHistoryItem = (item: HistoryItem) => {
    skipTranslateRef.current = true; // 标记跳过翻译
    setSourceLang(item.sourceLang);
    setTargetLang(item.targetLang);
    setState((prev) => ({
      ...prev,
      inputText: item.sourceText,
      translatedText: item.translatedText,
    }));
    setIsHistoryOpen(false);
  };

  // Refs to control playback cancellation
  const stopPlaybackRef = useRef<(() => void) | null>(null);
  const isCancelledRef = useRef<boolean>(false);

  // Cache for TTS Audio Buffers to avoid re-fetching on loop or replay
  const audioCacheRef = useRef<{ text: string; buffer: AudioBuffer } | null>(
    null
  );

  // 跳过翻译标记（从历史记录选择时使用）
  const skipTranslateRef = useRef(false);

  // Debounce translation
  useEffect(() => {
    // 如果是从历史记录选择的，跳过翻译
    if (skipTranslateRef.current) {
      skipTranslateRef.current = false;
      return;
    }

    const timer = setTimeout(() => {
      if (state.inputText.trim()) {
        handleTranslate();
      } else {
        setState((prev) => ({ ...prev, translatedText: "" }));
      }
    }, 1000); // 1 second debounce

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.inputText, sourceLang, targetLang, appSettings.translation]); // Re-translate if settings change

  const handleTranslate = async () => {
    if (!state.inputText.trim()) return;

    setState((prev) => ({ ...prev, isTranslating: true, error: null }));

    try {
      const result = await translateText(
        state.inputText,
        sourceLang,
        targetLang.split("-")[0],
        appSettings // Pass settings
      );

      // Clear audio cache when new translation arrives
      audioCacheRef.current = null;

      setState((prev) => ({
        ...prev,
        translatedText: result,
        isTranslating: false,
      }));

      // Add to history
      addToHistory(state.inputText, result);
    } catch (err: any) {
      setState((prev) => ({
        ...prev,
        error: err.message || "Failed to translate. Check your API settings.",
        isTranslating: false,
      }));
    }
  };

  const handleSwapLanguages = () => {
    if (sourceLang === "auto") {
      setSourceLang(targetLang);
      setTargetLang("en");
    } else {
      setSourceLang(targetLang);
      setTargetLang(sourceLang);
    }

    audioCacheRef.current = null;

    setState((prev) => ({
      ...prev,
      inputText: prev.translatedText,
      translatedText: prev.inputText,
    }));
  };

  const stopAudio = () => {
    isCancelledRef.current = true;
    if (stopPlaybackRef.current) {
      stopPlaybackRef.current();
    }
    setState((prev) => ({
      ...prev,
      isSpeakingInput: false,
      isSpeakingOutput: false,
    }));
  };

  const handleSpeak = async (text: string, isInput: boolean) => {
    if (!text) return;

    stopAudio();
    isCancelledRef.current = false;

    setState((prev) => ({
      ...prev,
      isSpeakingInput: isInput,
      isSpeakingOutput: !isInput,
    }));

    try {
      const loops = !isInput ? Math.max(1, state.loopSettings.count) : 1;
      const intervalMs = state.loopSettings.interval * 1000;

      let buffer: AudioBuffer;

      // 先检查内存缓存
      if (audioCacheRef.current?.text === text) {
        buffer = audioCacheRef.current.buffer;
      } else {
        // 再检查 IndexedDB 持久化缓存
        const cached = await getCachedAudio(text);
        if (cached) {
          // 从缓存解码，使用保存的格式
          buffer = await decodeRawAudio(cached.data, cached.format);
        } else {
          // 请求新的 TTS
          const { data, format } = await generateTTSRaw(text, appSettings);
          buffer = await decodeRawAudio(data, format);
          // 存入持久化缓存（包含格式信息）
          await setCachedAudio(text, data, format);
        }
        // 更新内存缓存
        audioCacheRef.current = { text, buffer };
      }

      for (let i = 0; i < loops; i++) {
        if (isCancelledRef.current) break;

        const audioControl = playAudioBuffer(buffer);
        stopPlaybackRef.current = audioControl.stop;

        await audioControl.promise;

        if (i < loops - 1 && !isCancelledRef.current) {
          await new Promise<void>((resolve) => {
            const timeoutId = setTimeout(resolve, intervalMs);
            stopPlaybackRef.current = () => {
              clearTimeout(timeoutId);
              resolve();
            };
          });
        }
      }
    } catch (e: any) {
      console.error(e);
      if (!isCancelledRef.current) {
        alert(`Audio Error: ${e.message || "Could not play audio"}`);
      }
    } finally {
      if (!isCancelledRef.current) {
        setState((prev) => ({
          ...prev,
          isSpeakingInput: false,
          isSpeakingOutput: false,
        }));
      }
      stopPlaybackRef.current = null;
    }
  };

  const updateLoopSettings = (newSettings: LoopSettings) => {
    setState((prev) => ({ ...prev, loopSettings: newSettings }));
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 font-sans selection:bg-blue-200 flex flex-col">
      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={appSettings}
        onSave={saveSettings}
      />

      {/* History Panel */}
      <HistoryPanel
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        history={history}
        onSelect={selectHistoryItem}
        onClear={clearHistory}
        onDelete={deleteHistoryItem}
      />

      {/* Navbar */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50 h-16 flex-none">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full">
          <div className="flex items-center justify-between h-full">
            <div className="flex items-center gap-2">
              <div className="bg-gradient-to-br from-blue-600 to-indigo-600 p-1.5 md:p-2 rounded-lg text-white shadow-lg shadow-blue-500/30">
                <Languages size={20} className="md:w-6 md:h-6" />
              </div>
              <span className="text-lg md:text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-indigo-700">
                AI Translate
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsHistoryOpen(true)}
                className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                title="历史记录"
              >
                <Clock size={22} />
              </button>
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                title="Settings"
              >
                <Settings size={22} />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-7xl mx-auto md:px-6 lg:px-8 flex flex-col md:py-8">
        {state.error && (
          <div
            className="mx-4 mt-2 md:mx-0 md:mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg flex items-center gap-2 text-sm animate-fade-in"
            role="alert"
          >
            <span className="block sm:inline">{state.error}</span>
          </div>
        )}

        {/* Mobile Layout */}
        <div className="flex-1 flex flex-col md:hidden">
          <div className="flex-1 bg-white m-3 rounded-2xl shadow-sm overflow-hidden flex flex-col">
            {/* Source Section */}
            <div className="flex-1 flex flex-col p-4 min-h-0">
              <LanguageSelector
                label=""
                languages={SUPPORTED_LANGUAGES}
                selectedCode={sourceLang}
                onSelect={setSourceLang}
              />
              <textarea
                value={state.inputText}
                onChange={(e) =>
                  setState((prev) => ({ ...prev, inputText: e.target.value }))
                }
                placeholder="输入文本"
                className="flex-1 w-full resize-none outline-none text-lg text-gray-800 placeholder-gray-300 mt-2 min-h-[80px]"
              />
            </div>

            {/* Swap Button */}
            <div className="flex justify-center py-2 border-y border-gray-100">
              <button
                onClick={handleSwapLanguages}
                className="p-2 rounded-full text-blue-500 hover:bg-blue-50 active:scale-95 transition-all"
              >
                <ArrowRightLeft size={20} className="rotate-90" />
              </button>
            </div>

            {/* Target Section */}
            <div className="flex-1 flex flex-col p-4 bg-gray-50/50 min-h-0">
              <LanguageSelector
                label=""
                languages={TARGET_LANGUAGES}
                selectedCode={targetLang}
                onSelect={setTargetLang}
              />
              <div className="flex-1 mt-2 min-h-[80px]">
                {state.isTranslating ? (
                  <div className="flex items-center gap-2 text-blue-400">
                    <Sparkles size={16} className="animate-pulse" />
                    <span>翻译中...</span>
                  </div>
                ) : (
                  <p
                    className={`text-lg ${
                      state.translatedText ? "text-gray-800" : "text-gray-300"
                    }`}
                  >
                    {state.translatedText || "翻译结果"}
                  </p>
                )}
              </div>
            </div>

            {/* Mobile Footer Actions */}
            {(state.inputText || state.translatedText) && (
              <div className="border-t border-gray-100 bg-white">
                {/* Loop Settings Row */}
                {state.translatedText && (
                  <div className="flex items-center justify-center gap-4 px-4 py-2 bg-gray-50 text-sm">
                    <div className="flex items-center gap-2">
                      <Repeat size={14} className="text-blue-500" />
                      <span className="text-gray-500">次数</span>
                      <input
                        type="number"
                        min="1"
                        max="99"
                        value={state.loopSettings.count}
                        onChange={(e) =>
                          updateLoopSettings({
                            ...state.loopSettings,
                            count: parseInt(e.target.value) || 1,
                          })
                        }
                        className="w-12 px-2 py-1 rounded border border-gray-200 text-center text-gray-700"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock size={14} className="text-blue-500" />
                      <span className="text-gray-500">间隔</span>
                      <input
                        type="number"
                        min="0"
                        max="10"
                        step="0.5"
                        value={state.loopSettings.interval}
                        onChange={(e) =>
                          updateLoopSettings({
                            ...state.loopSettings,
                            interval: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="w-12 px-2 py-1 rounded border border-gray-200 text-center text-gray-700"
                      />
                      <span className="text-gray-400">秒</span>
                    </div>
                  </div>
                )}
                {/* Action Buttons */}
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-2">
                    {state.translatedText &&
                      (state.isSpeakingOutput ? (
                        <button
                          onClick={stopAudio}
                          className="p-2 rounded-full text-red-500 bg-red-50"
                        >
                          <StopCircle size={20} />
                        </button>
                      ) : (
                        <button
                          onClick={() =>
                            handleSpeak(state.translatedText, false)
                          }
                          className="p-2 rounded-full text-gray-500 hover:bg-gray-100"
                        >
                          <Volume2 size={20} />
                        </button>
                      ))}
                  </div>
                  <div className="flex items-center gap-2">
                    {state.inputText && (
                      <button
                        onClick={() =>
                          setState((prev) => ({
                            ...prev,
                            inputText: "",
                            translatedText: "",
                          }))
                        }
                        className="p-2 text-gray-400 hover:text-gray-600 rounded-full"
                      >
                        <X size={20} />
                      </button>
                    )}
                    {state.translatedText && (
                      <button
                        onClick={async () => {
                          await navigator.clipboard.writeText(
                            state.translatedText
                          );
                        }}
                        className="p-2 text-gray-500 hover:bg-gray-100 rounded-full"
                      >
                        <Copy size={20} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Desktop Layout */}
        <div className="hidden md:block bg-white md:rounded-3xl md:shadow-xl md:shadow-gray-200/50 md:border border-gray-100 overflow-hidden flex-1">
          <div className="z-40 bg-white/95 backdrop-blur-sm border-b border-gray-100 p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <LanguageSelector
                  label="From"
                  languages={SUPPORTED_LANGUAGES}
                  selectedCode={sourceLang}
                  onSelect={setSourceLang}
                />
              </div>
              <button
                onClick={handleSwapLanguages}
                className="p-3 rounded-full hover:bg-gray-100 text-gray-500 hover:text-blue-600 transition-all active:scale-95"
              >
                <ArrowRightLeft size={20} />
              </button>
              <div className="flex-1 min-w-0">
                <LanguageSelector
                  label="To"
                  languages={TARGET_LANGUAGES}
                  selectedCode={targetLang}
                  onSelect={setTargetLang}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 divide-x divide-gray-100">
            {/* Input */}
            <div className="min-h-[500px] h-[calc(100vh-280px)]">
              <TranslationBox
                value={state.inputText}
                onChange={(val) =>
                  setState((prev) => ({ ...prev, inputText: val }))
                }
                onClear={() =>
                  setState((prev) => ({
                    ...prev,
                    inputText: "",
                    translatedText: "",
                  }))
                }
                placeholder="Enter text..."
                onPlayAudio={() => handleSpeak(state.inputText, true)}
                onStopAudio={stopAudio}
                isPlaying={state.isSpeakingInput}
                headerContent={
                  <span className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                    Source
                  </span>
                }
              />
            </div>

            {/* Output */}
            <div className="min-h-[500px] h-[calc(100vh-280px)] bg-gray-50/30">
              <TranslationBox
                value={state.translatedText}
                readOnly
                placeholder={
                  state.isTranslating ? "Translating..." : "Translation"
                }
                onPlayAudio={() => handleSpeak(state.translatedText, false)}
                onStopAudio={stopAudio}
                isPlaying={state.isSpeakingOutput}
                loopSettings={state.loopSettings}
                onLoopSettingsChange={updateLoopSettings}
                headerContent={
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-blue-600 uppercase tracking-wide">
                      Result
                    </span>
                    {state.isTranslating && (
                      <div className="flex items-center gap-1 text-xs text-blue-400">
                        <Sparkles size={10} className="animate-pulse" />
                        <span>Processing...</span>
                      </div>
                    )}
                  </div>
                }
              />
            </div>
          </div>
        </div>
      </main>

      <footer className="hidden md:block py-6 text-center text-xs text-gray-400 bg-gray-50">
        <p>AI Translation Tool</p>
      </footer>
    </div>
  );
}

export default App;
