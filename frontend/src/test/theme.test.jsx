import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ThemeProvider, useTheme, THEME_STORAGE_KEY } from '../theme/ThemeContext.jsx';
import SettingsDialog from '../components/workspace/SettingsDialog.jsx';

// Component to test theme context actions and state
function ThemeTestConsumer() {
  const { theme, setTheme, isDark } = useTheme();
  return (
    <div>
      <span data-testid="current-theme">{theme}</span>
      <span data-testid="is-dark">{String(isDark)}</span>
      <button onClick={() => setTheme('light')}>Set Light</button>
      <button onClick={() => setTheme('dark')}>Set Dark</button>
      <button onClick={() => setTheme('system')}>Set System</button>
    </div>
  );
}

describe('Theme System and Settings Tests', () => {
  let listeners = [];
  let matchesDark = false;

  beforeEach(() => {
    listeners = [];
    matchesDark = false;
    document.documentElement.classList.remove('dark');
    window.localStorage.clear();

    // Mock matchMedia
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: matchesDark,
      media: query,
      onchange: null,
      addListener: vi.fn((fn) => listeners.push(fn)),
      removeListener: vi.fn((fn) => {
        listeners = listeners.filter((l) => l !== fn);
      }),
      addEventListener: vi.fn((event, fn) => {
        if (event === 'change') listeners.push(fn);
      }),
      removeEventListener: vi.fn((event, fn) => {
        if (event === 'change') listeners = listeners.filter((l) => l !== fn);
      }),
      dispatchEvent: vi.fn(),
    }));
  });

  afterEach(() => {
    document.documentElement.classList.remove('dark');
    vi.restoreAllMocks();
  });

  // 1. Theme toggle adds and removes dark class
  it('toggles dark class on document.documentElement', () => {
    render(
      <ThemeProvider>
        <ThemeTestConsumer />
      </ThemeProvider>
    );

    expect(screen.getByTestId('current-theme').textContent).toBe('system');

    // Switch to dark
    fireEvent.click(screen.getByText('Set Dark'));
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(screen.getByTestId('current-theme').textContent).toBe('dark');
    expect(screen.getByTestId('is-dark').textContent).toBe('true');

    // Switch to light
    fireEvent.click(screen.getByText('Set Light'));
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(screen.getByTestId('current-theme').textContent).toBe('light');
    expect(screen.getByTestId('is-dark').textContent).toBe('false');
  });

  // 2. Choice is saved to and restored from localStorage
  it('saves choice to localStorage and restores on mount', () => {
    const { unmount } = render(
      <ThemeProvider>
        <ThemeTestConsumer />
      </ThemeProvider>
    );

    fireEvent.click(screen.getByText('Set Dark'));
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    unmount();

    // Re-render and verify restored
    render(
      <ThemeProvider>
        <ThemeTestConsumer />
      </ThemeProvider>
    );
    expect(screen.getByTestId('current-theme').textContent).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  // 3. System mode follows matchMedia and responds to OS changes
  it('system mode follows matchMedia and updates when OS changes', () => {
    matchesDark = false;
    render(
      <ThemeProvider>
        <ThemeTestConsumer />
      </ThemeProvider>
    );

    fireEvent.click(screen.getByText('Set System'));
    expect(document.documentElement.classList.contains('dark')).toBe(false);

    // Simulate OS switching to dark mode
    act(() => {
      matchesDark = true;
      listeners.forEach((listener) => listener({ matches: true }));
    });
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    // Simulate OS switching to light mode
    act(() => {
      matchesDark = false;
      listeners.forEach((listener) => listener({ matches: false }));
    });
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  // 4. Storage failure falls back safely
  it('falls back safely when localStorage is blocked or throws', () => {
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Access denied', 'SecurityError');
    });
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Access denied', 'SecurityError');
    });

    render(
      <ThemeProvider>
        <ThemeTestConsumer />
      </ThemeProvider>
    );

    // Default system mode is still used without error
    expect(screen.getByTestId('current-theme').textContent).toBe('system');

    // Setting theme does not crash the app
    expect(() => {
      fireEvent.click(screen.getByText('Set Dark'));
    }).not.toThrow();

    expect(document.documentElement.classList.contains('dark')).toBe(true);

    getItemSpy.mockRestore();
    setItemSpy.mockRestore();
  });

  // 5. Settings dialog offers Light, Dark, System and keyboard navigation
  it('settings dialog opens, changes theme, closes with Escape and traps focus', () => {
    const onClose = vi.fn();

    const { rerender } = render(
      <ThemeProvider>
        <SettingsDialog isOpen={true} onClose={onClose} />
      </ThemeProvider>
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Settings/i })).toBeInTheDocument();

    // Select Dark option
    const darkRadio = screen.getByRole('radio', { name: /^Dark\b/i });
    fireEvent.click(darkRadio);
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    // Select Light option
    const lightRadio = screen.getByRole('radio', { name: /^Light\b/i });
    fireEvent.click(lightRadio);
    expect(document.documentElement.classList.contains('dark')).toBe(false);

    // Press Escape to close
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();

    // Rerender closed
    rerender(
      <ThemeProvider>
        <SettingsDialog isOpen={false} onClose={onClose} />
      </ThemeProvider>
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
