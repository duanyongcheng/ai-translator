import React, { useState, useEffect, useRef } from 'react';
import { ArrowRightLeft, Sparkles, Languages, Settings } from 'lucide-react';
import { SUPPORTED_LANGUAGES, TARGET_LANGUAGES } from './constants';
import { LanguageSelector } from './components/LanguageSelector';
import { TranslationBox } from './components/TranslationBox';
import { SettingsModal } from './components/SettingsModal';
import { translateText, generateTTS, playAudioBuffer, DEFAULT_SETTINGS } from './services/aiService';
import { TranslationState, LoopSettings, AppSettings } from './types';

function App() {
  const [sourceLang, setSourceLang] = useState('auto');
  const [targetLang, setTargetLang] = useState('zh-CN');
  
  // Settings State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [appSettings, setAppSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  const [state, setState] = useState<TranslationState>({
    inputText: '',
    translatedText: '',
    isTranslating: false,
    isSpeakingInput: false,
    isSpeakingOutput: false,
    error: null,
    loopSettings: {
      enabled: true,
      count: 1,
      interval: 1.0,
    }
  });

  // Load settings from local storage on mount
  useEffect(() => {
    const saved = localStorage.getItem('gemini-translator-settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setAppSettings({ ...DEFAULT_SETTINGS, ...parsed });
      } catch (e) {
        console.error("Failed to parse settings", e);
      }
    }
  }, []);

  const saveSettings = (newSettings: AppSettings) => {
    setAppSettings(newSettings);
    localStorage.setItem('gemini-translator-settings', JSON.stringify(newSettings));
  };

  // Refs to control playback cancellation
  const stopPlaybackRef = useRef<(() => void) | null>(null);
  const isCancelledRef = useRef<boolean>(false);

  // Cache for TTS Audio Buffers to avoid re-fetching on loop or replay
  const audioCacheRef = useRef<{ text: string; buffer: AudioBuffer } | null>(null);

  // Debounce translation
  useEffect(() => {
    const timer = setTimeout(() => {
      if (state.inputText.trim()) {
        handleTranslate();
      } else {
        setState(prev => ({ ...prev, translatedText: '' }));
      }
    }, 1000); // 1 second debounce

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.inputText, sourceLang, targetLang, appSettings.translation]); // Re-translate if settings change

  const handleTranslate = async () => {
    if (!state.inputText.trim()) return;

    setState(prev => ({ ...prev, isTranslating: true, error: null }));

    try {
      const result = await translateText(
        state.inputText, 
        sourceLang, 
        targetLang.split('-')[0],
        appSettings // Pass settings
      ); 
      
      // Clear audio cache when new translation arrives
      audioCacheRef.current = null;
      
      setState(prev => ({ ...prev, translatedText: result, isTranslating: false }));
    } catch (err: any) {
      setState(prev => ({ 
        ...prev, 
        error: err.message || "Failed to translate. Check your API settings.", 
        isTranslating: false 
      }));
    }
  };

  const handleSwapLanguages = () => {
    if (sourceLang === 'auto') {
        setSourceLang(targetLang);
        setTargetLang('en');
    } else {
        setSourceLang(targetLang);
        setTargetLang(sourceLang);
    }
    
    audioCacheRef.current = null;
    
    setState(prev => ({
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
    setState(prev => ({
      ...prev,
      isSpeakingInput: false,
      isSpeakingOutput: false
    }));
  };

  const handleSpeak = async (text: string, isInput: boolean) => {
    if (!text) return;
    
    stopAudio();
    isCancelledRef.current = false;

    setState(prev => ({
      ...prev,
      isSpeakingInput: isInput,
      isSpeakingOutput: !isInput
    }));

    try {
      const loops = !isInput ? Math.max(1, state.loopSettings.count) : 1;
      const intervalMs = state.loopSettings.interval * 1000;

      let buffer: AudioBuffer;

      // Simple cache check: matches text AND current provider config (implicitly by invalidating on settings change if we wanted, but text match is usually enough)
      // Note: If user changes voice model, cache might be stale. For simplicity, we assume text is key.
      if (audioCacheRef.current?.text === text) {
        buffer = audioCacheRef.current.buffer;
      } else {
        buffer = await generateTTS(text, appSettings);
        audioCacheRef.current = { text, buffer };
      }

      for (let i = 0; i < loops; i++) {
        if (isCancelledRef.current) break;

        const audioControl = playAudioBuffer(buffer);
        stopPlaybackRef.current = audioControl.stop;
        
        await audioControl.promise;

        if (i < loops - 1 && !isCancelledRef.current) {
          await new Promise<void>(resolve => {
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
        alert(`Audio Error: ${e.message || 'Could not play audio'}`);
      }
    } finally {
      if (!isCancelledRef.current) {
         setState(prev => ({
          ...prev,
          isSpeakingInput: false,
          isSpeakingOutput: false
        }));
      }
      stopPlaybackRef.current = null;
    }
  };

  const updateLoopSettings = (newSettings: LoopSettings) => {
    setState(prev => ({ ...prev, loopSettings: newSettings }));
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
      <main className="flex-1 w-full max-w-7xl mx-auto md:px-6 lg:px-8 py-0 md:py-8 flex flex-col">
        
        {state.error && (
          <div className="mx-4 mt-4 md:mx-0 mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2 text-sm animate-fade-in" role="alert">
            <span className="block sm:inline">{state.error}</span>
          </div>
        )}

        <div className="bg-white md:rounded-3xl md:shadow-xl md:shadow-gray-200/50 md:border border-gray-100 overflow-hidden flex flex-col md:block flex-1 md:flex-none">
          
          <div className="sticky top-16 md:static z-40 bg-white/95 backdrop-blur-sm border-b border-gray-100 p-2 md:p-4 shadow-sm md:shadow-none">
            <div className="flex items-center justify-between gap-2 md:gap-4">
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
                className="p-2 md:p-3 rounded-full bg-gray-50 md:bg-transparent hover:bg-gray-100 text-gray-500 hover:text-blue-600 transition-all active:scale-95 border border-gray-200 md:border-transparent"
              >
                <ArrowRightLeft size={16} className="md:w-5 md:h-5" />
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

          <div className="flex flex-col md:grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-100 flex-1">
            
            {/* Input */}
            <div className="min-h-[40vh] md:min-h-[500px] md:h-[calc(100vh-280px)]">
              <TranslationBox
                value={state.inputText}
                onChange={(val) => setState(prev => ({ ...prev, inputText: val }))}
                onClear={() => setState(prev => ({ ...prev, inputText: '', translatedText: '' }))}
                placeholder="Enter text..."
                onPlayAudio={() => handleSpeak(state.inputText, true)}
                onStopAudio={stopAudio}
                isPlaying={state.isSpeakingInput}
                headerContent={
                    <span className="text-xs md:text-sm font-medium text-gray-500 uppercase tracking-wide">Source</span>
                }
              />
            </div>

            {/* Output */}
            <div className="min-h-[40vh] md:min-h-[500px] md:h-[calc(100vh-280px)] bg-gray-50/30">
              <TranslationBox
                value={state.translatedText}
                readOnly
                placeholder={state.isTranslating ? "Translating..." : "Translation"}
                onPlayAudio={() => handleSpeak(state.translatedText, false)}
                onStopAudio={stopAudio}
                isPlaying={state.isSpeakingOutput}
                loopSettings={state.loopSettings}
                onLoopSettingsChange={updateLoopSettings}
                headerContent={
                    <div className="flex items-center gap-2">
                        <span className="text-xs md:text-sm font-medium text-blue-600 uppercase tracking-wide">Result</span>
                        {state.isTranslating && (
                            <div className="flex items-center gap-1 text-[10px] md:text-xs text-blue-400">
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

      <footer className="py-6 text-center text-xs text-gray-400 bg-gray-50">
        <p>AI Translation Tool</p>
      </footer>
    </div>
  );
}

export default App;
