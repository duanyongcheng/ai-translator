import React from 'react';
import { Language } from '../types';

interface LanguageSelectorProps {
  label: string;
  languages: Language[];
  selectedCode: string;
  onSelect: (code: string) => void;
  disabled?: boolean;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  label,
  languages,
  selectedCode,
  onSelect,
  disabled = false,
}) => {
  return (
    <div className="flex flex-col w-full">
      {/* Label is hidden on mobile for compactness, but kept in structure for desktop if needed, 
          though here we simplify to just the dropdown for modern look */}
      <div className="relative group">
        <select
          value={selectedCode}
          onChange={(e) => onSelect(e.target.value)}
          disabled={disabled}
          className={`
            appearance-none w-full bg-gray-50 md:bg-white border border-transparent md:border-gray-200 text-blue-600 md:text-gray-700 font-medium py-2 pl-3 pr-8 rounded-lg md:rounded-lg text-sm md:text-base leading-tight focus:outline-none focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-100 md:hover:border-gray-300'}
            truncate
          `}
        >
          {languages.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.name}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500 md:text-gray-400">
          <svg className="fill-current h-3 w-3 md:h-4 md:w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
            <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
          </svg>
        </div>
      </div>
    </div>
  );
};