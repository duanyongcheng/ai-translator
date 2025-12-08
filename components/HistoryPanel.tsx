import React from "react";
import { X, Trash2, Clock, ChevronLeft } from "lucide-react";
import { HistoryItem } from "../types";
import { SUPPORTED_LANGUAGES } from "../constants";

interface HistoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  history: HistoryItem[];
  onSelect: (item: HistoryItem) => void;
  onClear: () => void;
  onDelete: (id: string) => void;
}

const getLanguageName = (code: string) => {
  const lang = SUPPORTED_LANGUAGES.find(
    (l) => l.code === code || l.code === code.split("-")[0]
  );
  return lang?.name || code;
};

const formatTime = (timestamp: number) => {
  const date = new Date(timestamp);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  if (isToday) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
};

export const HistoryPanel: React.FC<HistoryPanelProps> = ({
  isOpen,
  onClose,
  history,
  onSelect,
  onClear,
  onDelete,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-white shadow-xl flex flex-col animate-slide-in-right h-full">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-2 -ml-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            >
              <ChevronLeft size={24} />
            </button>
            <h2 className="text-lg font-semibold text-gray-800">历史记录</h2>
            <span className="text-sm text-gray-400">({history.length})</span>
          </div>
          <div className="flex items-center gap-1">
            {history.length > 0 && (
              <button
                onClick={onClear}
                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                title="清空历史"
              >
                <Trash2 size={18} />
              </button>
            )}
          </div>
        </div>

        {/* History List */}
        <div className="flex-1 overflow-y-auto">
          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 p-8">
              <Clock size={48} className="mb-4 opacity-50" />
              <p>暂无历史记录</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {history.map((item) => (
                <div
                  key={item.id}
                  className="p-4 hover:bg-gray-50 active:bg-gray-100 cursor-pointer transition-colors group"
                  onClick={() => onSelect(item)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-400 truncate flex-1">
                      {getLanguageName(item.sourceLang)} →{" "}
                      {getLanguageName(item.targetLang)}
                    </span>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-gray-400">
                        {formatTime(item.timestamp)}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(item.id);
                        }}
                        className="p-1.5 text-gray-400 hover:text-red-500 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 line-clamp-2 mb-1 break-all">
                    {item.sourceText}
                  </p>
                  <p className="text-sm text-blue-600 line-clamp-2 break-all">
                    {item.translatedText}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
