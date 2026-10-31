import React, { useEffect, useRef } from 'react';
import Icon from '../Icon.jsx';
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
      description: 'High-contrast light theme',
      icon: (
        <Icon name="sun" size={20} />
      ),
    },
    {
      id: 'dark',
      label: 'Dark',
      description: 'Low-glare theme for dim rooms',
      icon: (
        <Icon name="moon" size={20} />
      ),
    },
    {
      id: 'system',
      label: 'System',
      description: 'Follows your operating system',
      icon: (
        <Icon name="monitor" size={20} />
      ),
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-scrim"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        className="w-full max-w-md bg-surface text-text rounded-xl border border-border shadow-2xl overflow-hidden transition-colors"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface-2">
          <h2 id="settings-title" className="text-base font-semibold text-text">
              Settings
            </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings dialog"
            className="w-9 h-9 flex items-center justify-center rounded-lg text-muted hover:text-text hover:bg-surface-2 transition-colors cursor-pointer"
          >
            <Icon name="close" size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div>
            <p className="text-sm font-semibold text-text mb-1">
              Appearance
            </p>
            <p className="text-xs text-muted mb-4">
              Choose how DocuLens AI looks to you.
            </p>

            <div
              role="radiogroup"
              aria-label="Theme selection"
              className="space-y-2"
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
                    className={`w-full flex items-center justify-between p-4 rounded-xl border text-left transition-colors cursor-pointer ${
                      isSelected
                        ? 'border-accent bg-accent-soft text-text'
                        : 'border-border bg-surface hover:bg-surface-2 text-text'
                    }`}
                  >
                    <div className="flex items-center space-x-4 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                          isSelected
                            ? 'bg-accent text-on-accent'
                            : 'bg-surface-2 text-muted'
                        }`}
                      >
                        {opt.icon}
                      </div>
                      <div className="truncate">
                        <div className="text-sm font-semibold text-text">
                          {opt.label}
                        </div>
                        <div className="text-xs text-muted truncate">
                          {opt.description}
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 ml-4">
                      <div
                        className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                          isSelected
                            ? 'border-accent bg-accent'
                            : 'border-control bg-transparent'
                        }`}
                      >
                        {isSelected && (
                          <div className="w-2 h-2 rounded-full bg-on-accent" />
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
        <div className="flex items-center justify-end px-6 py-4 border-t border-border bg-surface-2">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 text-sm font-medium bg-accent hover:bg-accent-hover text-on-accent rounded-lg transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
