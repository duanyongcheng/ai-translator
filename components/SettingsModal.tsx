import React, { useState, useEffect } from 'react';
import { X, Save, Server, Key, Globe, Mic } from 'lucide-react';
import { AppSettings, AIServiceConfig, ProviderType } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSave: (settings: AppSettings) => void;
}

interface ConfigFormProps {
  type: 'translation' | 'tts';
  config: AIServiceConfig;
  onChange: (type: 'translation' | 'tts', key: keyof AIServiceConfig, value: string) => void;
}

const ConfigForm: React.FC<ConfigFormProps> = ({ type, config, onChange }) => {
  const isGemini = config.provider === 'gemini';

  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Provider</label>
        <div className="flex gap-2">
          {(['gemini', 'openai'] as ProviderType[]).map((p) => (
            <button
              key={p}
              onClick={() => onChange(type, 'provider', p)}
              className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-colors capitalize ${
                config.provider === p
                  ? 'bg-blue-50 border-blue-200 text-blue-700'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
          <Key size={14} />
          API Key
        </label>
        <input
          type="password"
          value={config.apiKey}
          onChange={(e) => onChange(type, 'apiKey', e.target.value)}
          placeholder={isGemini ? "Use default (Env) or enter key" : "sk-..."}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
        />
        <p className="mt-1 text-xs text-gray-400">
          Leave empty to use default environment variable if available.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
          <Globe size={14} />
          Base URL (Optional)
        </label>
        <input
          type="text"
          value={config.baseUrl}
          onChange={(e) => onChange(type, 'baseUrl', e.target.value)}
          placeholder={isGemini ? "Default" : "https://api.openai.com/v1"}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm font-mono"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
          <Server size={14} />
          Model Name
        </label>
        <input
          type="text"
          value={config.model}
          onChange={(e) => onChange(type, 'model', e.target.value)}
          placeholder={type === 'translation' ? (isGemini ? 'gemini-2.5-flash' : 'gpt-3.5-turbo') : (isGemini ? 'gemini-2.5-flash-preview-tts' : 'tts-1')}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm font-mono"
        />
      </div>
    </div>
  );
};

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSave,
}) => {
  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);
  const [activeTab, setActiveTab] = useState<'translation' | 'tts'>('translation');

  useEffect(() => {
    if (isOpen) {
      setLocalSettings(settings);
    }
  }, [isOpen, settings]);

  if (!isOpen) return null;

  const handleConfigChange = (
    type: 'translation' | 'tts',
    key: keyof AIServiceConfig,
    value: string
  ) => {
    setLocalSettings((prev) => ({
      ...prev,
      [type]: {
        ...prev[type],
        [key]: value,
      },
    }));
  };

  const handleSave = () => {
    onSave(localSettings);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <h2 className="text-lg font-semibold text-gray-800">AI Settings</h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200 text-gray-500 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100">
          <button
            onClick={() => setActiveTab('translation')}
            className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors relative ${
              activeTab === 'translation' ? 'text-blue-600' : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <Globe size={16} />
            Translation
            {activeTab === 'translation' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t-full" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('tts')}
            className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors relative ${
              activeTab === 'tts' ? 'text-blue-600' : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <Mic size={16} />
            Text-to-Speech
            {activeTab === 'tts' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t-full" />
            )}
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto flex-1">
          <ConfigForm
            type={activeTab}
            config={localSettings[activeTab]}
            onChange={handleConfigChange}
          />
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 bg-gray-50/30 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 shadow-sm shadow-blue-200 flex items-center gap-2 transition-colors"
          >
            <Save size={16} />
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};
