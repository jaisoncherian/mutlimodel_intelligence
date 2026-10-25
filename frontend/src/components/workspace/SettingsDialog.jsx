import React, { useEffect, useRef } from 'react';
import { useTheme } from '../../theme/ThemeContext.jsx';

/**
 * @param {Object} props
 * @param {boolean} props.isOpen
 * @param {() => void} props.onClose
 */
export default function SettingsDialog({ isOpen, onClose }) {
  const { theme, setTheme } = useTheme();
  const dialogRef = useRef(null);
  const previouslyFocusedElementRef = useRef(null);

  // Store previously focused element and restore on close
  useEffect(() => {
    if (isOpen) {
      previouslyFocusedElementRef.current = document.activeElement;
      // Focus the dialog or the first interactive element
      const focusable = dialogRef.current?.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable && focusable.length > 0) {
        focusable[0].focus();
      }
    } else if (previouslyFocusedElementRef.current) {
      previouslyFocusedElementRef.current.focus?.();
    }
  }, [isOpen]);

  // Handle Escape key and focus trap
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === 'Tab') {
        const focusable = dialogRef.current?.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusable || focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const themeOptions = [
    {
      id: 'light',
      label: 'Light',
      description: 'Clean, high-contrast light theme',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
    },
    {
      id: 'dark',
      label: 'Dark',
      description: 'Low-glare dark theme for low-light environments',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      ),
    },
    {
      id: 'system',
      label: 'System',
      description: 'Automatically follows your operating system setting',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        className="w-full max-w-md bg-surface text-textPrimary rounded-2xl border border-bordercol shadow-2xl overflow-hidden animate-scaleIn transition-colors"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-bordercol bg-surfaceSecondary">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-brandLight text-brand flex items-center justify-center border border-brandBorder">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h2 id="settings-title" className="text-base font-semibold text-textPrimary">
              Settings
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings dialog"
            className="p-1.5 rounded-lg text-textSecondary hover:text-textPrimary hover:bg-surfaceSubtle focus:outline-none focus:ring-2 focus:ring-brand transition-colors cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-textSecondary block mb-1">
              Appearance
            </label>
            <p className="text-xs text-textSecondary mb-3">
              Choose how DocuLens AI looks to you.
            </p>

            <div
              role="radiogroup"
              aria-label="Theme selection"
              className="space-y-2.5"
            >
              {themeOptions.map((opt) => {
                const isSelected = theme === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => setTheme(opt.id)}
                    className={`w-full flex items-center justify-between p-3.5 rounded-xl border text-left transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand ${
                      isSelected
                        ? 'border-brand bg-brandLight text-textPrimary shadow-xs'
                        : 'border-bordercol bg-surface hover:bg-surfaceSubtle text-textPrimary'
                    }`}
                  >
                    <div className="flex items-center space-x-3 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                          isSelected
                            ? 'bg-brand text-white'
                            : 'bg-surfaceSubtle text-textSecondary'
                        }`}
                      >
                        {opt.icon}
                      </div>
                      <div className="truncate">
                        <div className="text-sm font-semibold text-textPrimary">
                          {opt.label}
                        </div>
                        <div className="text-xs text-textSecondary truncate">
                          {opt.description}
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 ml-3">
                      <div
                        className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                          isSelected
                            ? 'border-brand bg-brand'
                            : 'border-borderSubtle bg-transparent'
                        }`}
                      >
                        {isSelected && (
                          <div className="w-2 h-2 rounded-full bg-white" />
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-3.5 border-t border-bordercol bg-surfaceSecondary">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium bg-brand hover:bg-brandHover text-white rounded-lg shadow-xs transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
