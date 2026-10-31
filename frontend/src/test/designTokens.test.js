import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Read from disk: Vitest replaces imported CSS with an empty string.
const css = readFileSync(resolve(process.cwd(), 'src/App.css'), 'utf-8');
const indexHtml = readFileSync(resolve(process.cwd(), 'index.html'), 'utf-8');

const sources = import.meta.glob(['../**/*.{js,jsx}', '!../test/**'], {
  query: '?raw',
  import: 'default',
  eager: true,
});

const PALETTE =
  'red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone';
const FORBIDDEN = [
  { label: 'hex color', pattern: /#[0-9a-fA-F]{3,8}\b/ },
  { label: 'bg-white or bg-black', pattern: /\bbg-(white|black)\b/ },
  { label: 'text-white or text-black', pattern: /\btext-(white|black)\b/ },
  {
    label: 'Tailwind palette color',
    pattern: new RegExp(`\\b(bg|text|border|ring|divide|from|to|via|fill|stroke|placeholder)-(${PALETTE})(-\\d+)?\\b`),
  },
  { label: 'arbitrary color class', pattern: /-\[(#|rgb|hsl)/ },
];

function findHardcodedColors(source) {
  return FORBIDDEN.filter(({ pattern }) => pattern.test(source)).map(({ label }) => label);
}

describe('No hardcoded colors outside the token files', () => {
  it('scans the real source files', () => {
    const paths = Object.keys(sources);
    expect(paths.some((p) => p.endsWith('components/Workspace.jsx'))).toBe(true);
    expect(paths.some((p) => p.endsWith('workspace/AnswerCard.jsx'))).toBe(true);
    expect(paths.some((p) => p.endsWith('components/LandingPage.jsx'))).toBe(true);
    expect(paths.length).toBeGreaterThan(20);
  });

  it.each(Object.keys(sources))('%s uses only tokens', (path) => {
    expect(findHardcodedColors(sources[path])).toEqual([]);
  });

  it.each([
    ['a hex color', 'style={{ color: "#fff" }}'],
    ['bg-white', 'className="bg-white"'],
    ['bg-black', 'className="bg-black/50"'],
    ['bg-gray', 'className="bg-gray-100"'],
    ['text-slate', 'className="text-slate-400"'],
    ['an arbitrary class', 'className="bg-[#0f1422]"'],
  ])('the check catches %s', (_name, source) => {
    expect(findHardcodedColors(source).length).toBeGreaterThan(0);
  });
});

function readTheme(block) {
  const body = css.match(new RegExp(`${block} \\{([^}]*)\\}`))[1];
  return Object.fromEntries([...body.matchAll(/--([\w-]+):\s*(#[0-9A-Fa-f]{6})/g)].map((m) => [m[1], m[2]]));
}

const luminance = (hex) => {
  const channel = (i) => {
    const value = parseInt(hex.slice(i, i + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
};

const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const TEXT_ON = [
  ['text', 'bg'], ['text', 'surface'], ['text', 'surface-2'], ['text', 'accent-soft'], ['text', 'chip-neutral-bg'],
  ['muted', 'bg'], ['muted', 'surface'], ['muted', 'surface-2'],
  ['on-accent', 'accent'], ['on-accent', 'accent-hover'],
  ['accent-text', 'surface'], ['accent-text', 'surface-2'], ['accent-text', 'accent-soft'], ['accent-text', 'bg'],
  ['chip-ready-text', 'chip-ready-bg'], ['chip-processing-text', 'chip-processing-bg'],
  ['chip-caution-text', 'chip-caution-bg'], ['chip-neutral-text', 'chip-neutral-bg'],
  ['chip-failed-text', 'chip-failed-bg'],
  // Text colors used directly on surfaces in the check details and the composer counter.
  ['chip-ready-text', 'surface-2'], ['chip-caution-text', 'surface-2'], ['chip-failed-text', 'surface-2'],
  // The landing page's primary button and its two colored panels.
  ['bg', 'text'], ['block-a-text', 'block-a-bg'], ['block-b-text', 'block-b-bg'],
];

const NON_TEXT_ON = [
  ['control', 'surface'], ['control', 'surface-2'],
  ['accent', 'surface'], ['accent-text', 'surface'], ['accent-text', 'surface-2'],
];

describe.each([
  ['light', ':root'],
  ['dark', '\\.dark'],
])('AA contrast in the %s theme', (_name, block) => {
  const theme = readTheme(block);

  it.each(TEXT_ON)('%s on %s is at least 4.5:1', (foreground, background) => {
    expect(contrast(theme[foreground], theme[background])).toBeGreaterThanOrEqual(4.5);
  });

  it.each(NON_TEXT_ON)('%s on %s is at least 3:1', (foreground, background) => {
    expect(contrast(theme[foreground], theme[background])).toBeGreaterThanOrEqual(3);
  });

  it('defines the four specified surface levels', () => {
    ['bg', 'surface', 'surface-2', 'border'].forEach((name) => expect(theme[name]).toBeDefined());
  });
});

describe('Dark theme is black with green text', () => {
  const dark = readTheme('\\.dark');
  const isGreen = (hex) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    return g > r && g > b;
  };

  it('uses a pure black page background', () => {
    expect(dark.bg).toBe('#000000');
  });

  it.each(['text', 'muted', 'accent', 'accent-text'])('--%s is green', (name) => {
    expect(isGreen(dark[name])).toBe(true);
  });
});

describe('Theme loads without a flash', () => {
  it('paints the same page colors as the tokens, before the CSS loads', () => {
    expect(indexHtml).toContain(`html { background-color: ${readTheme(':root').bg}`);
    expect(indexHtml).toContain(`html.dark { background-color: ${readTheme('\\.dark').bg}`);
  });

  it('sets the theme class before the app script', () => {
    expect(indexHtml.indexOf("classList.toggle('dark'")).toBeGreaterThan(-1);
    expect(indexHtml.indexOf("classList.toggle('dark'")).toBeLessThan(indexHtml.indexOf('/src/main.jsx'));
  });

  it('no longer loads a second icon font', () => {
    expect(indexHtml).not.toContain('Material+Symbols');
  });
});
