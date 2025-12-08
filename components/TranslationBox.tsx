import React, { useRef, useState } from "react";
import {
  Copy,
  Volume2,
  X,
  RefreshCw,
  StopCircle,
  Repeat,
  Clock,
  Settings2,
} from "lucide-react";
import { LoopSettings } from "../types";

interface TranslationBoxProps {
  value: string;
  placeholder?: string;
  readOnly?: boolean;
  onChange?: (val: string) => void;
  onClear?: () => void;
  onPlayAudio?: () => void;
  onStopAudio?: () => void;
  isPlaying?: boolean;
  headerContent?: React.ReactNode;
  maxLength?: number;
  // Loop props
  loopSettings?: LoopSettings;
  onLoopSettingsChange?: (settings: LoopSettings) => void;
}

export const TranslationBox: React.FC<TranslationBoxProps> = ({
  value,
  placeholder,
  readOnly,
  onChange,
  onClear,
  onPlayAudio,
  onStopAudio,
  isPlaying,
  headerContent,
  maxLength = 5000,
  loopSettings,
  onLoopSettingsChange,
}) => {
  const [copied, setCopied] = React.useState(false);
  const [showLoopSettings, setShowLoopSettings] = useState(false);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  const handleCopy = async () => {
    if (value) {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleLoopChange = (key: keyof LoopSettings, val: number | boolean) => {
    if (onLoopSettingsChange && loopSettings) {
      onLoopSettingsChange({
        ...loopSettings,
        [key]: val,
      });
    }
  };

  return (
    <div className="flex flex-col h-full bg-transparent md:bg-white md:rounded-2xl transition-shadow focus-within:ring-0 md:focus-within:ring-2 focus-within:ring-blue-500/20">
      {/* Header Toolbar */}
      <div className="flex items-center justify-between px-3 md:px-4 py-2 md:py-3 border-b border-gray-100 bg-gray-50/30 md:bg-gray-50/50">
        <div className="flex-1 flex items-center">{headerContent}</div>
        {value && !readOnly && onClear && (
          <button
            onClick={onClear}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-200/50 rounded-full transition-colors"
            title="Clear text"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Text Area */}
      <div className="relative flex-1 flex flex-col">
        <textarea
          ref={textAreaRef}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          readOnly={readOnly}
          placeholder={placeholder}
          maxLength={maxLength}
          className="w-full flex-1 p-3 md:p-4 resize-none outline-none text-base md:text-lg text-gray-800 bg-transparent placeholder-gray-400 font-light leading-relaxed min-h-[100px] md:min-h-[200px]"
        />
        {!readOnly && (
          <div className="px-3 pb-2 text-right text-[10px] text-gray-300">
            {value.length} / {maxLength}
          </div>
        )}
      </div>

      {/* Loop Settings Panel (Conditional) */}
      {showLoopSettings && loopSettings && value && (
        <div className="bg-blue-50/50 border-t border-blue-100 px-3 py-2 md:px-4 flex flex-wrap items-center gap-3 md:gap-4 text-xs md:text-sm animate-fade-in">
          <div className="flex items-center gap-1.5 md:gap-2">
            <Repeat size={14} className="text-blue-600" />
            <span className="text-gray-600 font-medium">Count:</span>
            <input
              type="number"
              min="1"
              max="99"
              value={loopSettings.count}
              onChange={(e) =>
                handleLoopChange("count", parseInt(e.target.value) || 1)
              }
              className="w-10 md:w-12 px-1 py-0.5 rounded border border-gray-300 text-center text-gray-700 focus:ring-1 focus:ring-blue-500 outline-none"
            />
          </div>
          <div className="flex items-center gap-1.5 md:gap-2">
            <Clock size={14} className="text-blue-600" />
            <span className="text-gray-600 font-medium">Gap:</span>
            <input
              type="number"
              min="0"
              max="10"
              step="0.5"
              value={loopSettings.interval}
              onChange={(e) =>
                handleLoopChange("interval", parseFloat(e.target.value) || 0)
              }
              className="w-10 md:w-12 px-1 py-0.5 rounded border border-gray-300 text-center text-gray-700 focus:ring-1 focus:ring-blue-500 outline-none"
            />
            <span className="text-gray-500">s</span>
          </div>
        </div>
      )}

      {/* Footer Toolbar */}
      <div className="flex items-center justify-between px-3 md:px-4 py-2 border-t border-gray-100/50 md:border-gray-50">
        <div className="flex items-center space-x-2">
          {value && (
            <>
              {isPlaying ? (
                <button
                  onClick={onStopAudio}
                  className="p-1.5 md:p-2 rounded-full transition-all duration-200 flex items-center gap-2 text-red-500 bg-red-50 hover:bg-red-100"
                  title="Stop"
                >
                  <StopCircle size={18} className="md:w-5 md:h-5" />
                  <span className="text-xs font-medium">Stop</span>
                </button>
              ) : (
                <button
                  onClick={onPlayAudio}
                  className="p-1.5 md:p-2 rounded-full transition-all duration-200 flex items-center gap-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50"
                  title="Listen"
                >
                  <Volume2 size={18} className="md:w-5 md:h-5" />
                </button>
              )}

              {/* Loop Settings Toggle - Only show for output or if loopSettings provided */}
              {loopSettings && (
                <button
                  onClick={() => setShowLoopSettings(!showLoopSettings)}
                  className={`p-1.5 md:p-2 rounded-full transition-colors ${
                    showLoopSettings || loopSettings.count > 1
                      ? "text-blue-600 bg-blue-50"
                      : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                  }`}
                  title="Playback Settings"
                >
                  <Settings2 size={16} className="md:w-[18px] md:h-[18px]" />
                </button>
              )}
            </>
          )}
        </div>

        <div className="flex items-center space-x-1">
          {value && (
            <button
              onClick={handleCopy}
              className="p-1.5 md:p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors relative"
              title="Copy translation"
            >
              <Copy size={18} className="md:w-5 md:h-5" />
              {copied && (
                <span className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-black/80 text-white text-[10px] py-1 px-2 rounded shadow-lg animate-fade-in-down whitespace-nowrap">
                  Copied
                </span>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
