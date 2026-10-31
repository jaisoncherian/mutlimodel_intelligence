/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}', '!./src/test/**'],
  theme: {
    extend: {
      // Every color comes from a CSS variable in src/App.css.
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        'surface-2': 'var(--surface-2)',
        border: 'var(--border)',
        control: 'var(--control)',
        text: 'var(--text)',
        muted: 'var(--muted)',
        accent: 'var(--accent)',
        'accent-hover': 'var(--accent-hover)',
        'accent-soft': 'var(--accent-soft)',
        'accent-line': 'var(--accent-line)',
        'accent-text': 'var(--accent-text)',
        'on-accent': 'var(--on-accent)',
        'chip-ready-bg': 'var(--chip-ready-bg)',
        'chip-ready-text': 'var(--chip-ready-text)',
        'chip-processing-bg': 'var(--chip-processing-bg)',
        'chip-processing-text': 'var(--chip-processing-text)',
        'chip-caution-bg': 'var(--chip-caution-bg)',
        'chip-caution-text': 'var(--chip-caution-text)',
        'chip-neutral-bg': 'var(--chip-neutral-bg)',
        'chip-neutral-text': 'var(--chip-neutral-text)',
        'chip-failed-bg': 'var(--chip-failed-bg)',
        'chip-failed-text': 'var(--chip-failed-text)',
        scrim: 'var(--scrim)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        // The type scale: text-xs, text-sm, text-base, text-xl, text-2xl.
        xs: ['12px', { lineHeight: '16px' }],
        sm: ['14px', { lineHeight: '20px' }],
        base: ['16px', { lineHeight: '24px' }],
        xl: ['20px', { lineHeight: '28px' }],
        '2xl': ['24px', { lineHeight: '32px' }],
        // Landing page headline only.
        display: ['40px', { lineHeight: '48px', letterSpacing: '-0.02em' }],
      },
    },
  },
  plugins: [],
};
