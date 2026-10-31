import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import LandingPage from '../components/LandingPage.jsx';
import { Parallax, Reveal } from '../components/landing/Motion.jsx';
import { LEGACY_THEME_STORAGE_KEY, THEME_STORAGE_KEY, ThemeProvider } from '../theme/ThemeContext.jsx';

const sources = import.meta.glob(['../**/*.{js,jsx}', '!../test/**'], {
  query: '?raw',
  import: 'default',
  eager: true,
});

function stubMatchMedia({ reduced = false, wide = true } = {}) {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: query.includes('reduced-motion') ? reduced : query.includes('min-width') ? wide : false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

describe('The DeepCite name', () => {
  it('is shown on the landing page and in the page title', () => {
    render(<LandingPage onOpenWorkspace={() => {}} />);
    expect(screen.getAllByText('DeepCite').length).toBeGreaterThan(0);
    expect(readFileSync(resolve(process.cwd(), 'index.html'), 'utf-8')).toContain('<title>DeepCite');
  });

  it('has replaced the old name in the source, apart from the saved theme key', () => {
    const offenders = Object.keys(sources).filter((path) => {
      const withoutLegacyKey = sources[path].replace("'doculens_theme'", '');
      return /docu\s?lens/i.test(withoutLegacyKey);
    });
    expect(offenders).toEqual([]);
  });
});

describe('Landing page content', () => {
  it('opens the workspace from every primary button', () => {
    const onOpenWorkspace = vi.fn();
    render(<LandingPage onOpenWorkspace={onOpenWorkspace} />);
    const buttons = screen.getAllByRole('button', { name: 'Open workspace' });
    expect(buttons.length).toBeGreaterThanOrEqual(3);
    buttons.forEach((button) => fireEvent.click(button));
    expect(onOpenWorkspace).toHaveBeenCalledTimes(buttons.length);
  });

  it('labels the product pictures as illustrations', () => {
    render(<LandingPage onOpenWorkspace={() => {}} />);
    expect(screen.getAllByText(/Not a live response/).length).toBe(2);
  });

  it('carries over nothing invented from the design template', () => {
    const { container } = render(<LandingPage onOpenWorkspace={() => {}} />);
    const text = container.textContent;
    ['Romer', 'Mara Chen', 'Ivo Patel', '99.999', 'ISO_27001', 'free trial', 'Contact sales'].forEach((phrase) => {
      expect(text).not.toContain(phrase);
    });
  });

  it('switches the theme from the header and saves the choice', () => {
    stubMatchMedia();
    window.localStorage.clear();
    document.documentElement.classList.remove('dark');
    render(
      <ThemeProvider>
        <LandingPage onOpenWorkspace={() => {}} />
      </ThemeProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Switch to dark theme' }));

    expect(document.documentElement).toHaveClass('dark');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(screen.getByRole('button', { name: 'Switch to light theme' })).toBeInTheDocument();
    document.documentElement.classList.remove('dark');
    window.localStorage.clear();
  });

  it('keeps a theme saved under the old name', () => {
    stubMatchMedia();
    window.localStorage.clear();
    window.localStorage.setItem(LEGACY_THEME_STORAGE_KEY, 'dark');
    render(
      <ThemeProvider>
        <div />
      </ThemeProvider>
    );
    expect(document.documentElement).toHaveClass('dark');
    document.documentElement.classList.remove('dark');
    window.localStorage.clear();
  });
});

describe('Scroll reveal', () => {
  let observers;

  beforeEach(() => {
    observers = [];
    stubMatchMedia();
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(callback) {
          this.callback = callback;
          this.observe = vi.fn();
          this.disconnect = vi.fn();
          observers.push(this);
        }
      }
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('stays hidden until the element enters the screen, then stays visible', () => {
    render(<Reveal data-testid="target">Content</Reveal>);
    const target = screen.getByTestId('target');
    expect(target).not.toHaveClass('is-visible');
    expect(observers[0].observe).toHaveBeenCalledWith(target);

    act(() => observers[0].callback([{ isIntersecting: false }]));
    expect(target).not.toHaveClass('is-visible');

    act(() => observers[0].callback([{ isIntersecting: true }]));
    expect(target).toHaveClass('is-visible');
    expect(observers[0].disconnect).toHaveBeenCalled();
  });

  it('shows the content at once when reduced motion is requested', () => {
    stubMatchMedia({ reduced: true });
    render(<Reveal data-testid="target">Content</Reveal>);
    expect(screen.getByTestId('target')).toHaveClass('is-visible');
    expect(observers).toHaveLength(0);
  });

  it('shows the content when the browser has no IntersectionObserver', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    render(<Reveal data-testid="target">Content</Reveal>);
    expect(screen.getByTestId('target')).toHaveClass('is-visible');
  });

  it('passes the stagger delay to the stylesheet and applies the variant', () => {
    render(
      <Reveal data-testid="target" variant="zoom" delay={120}>
        Content
      </Reveal>
    );
    const target = screen.getByTestId('target');
    expect(target).toHaveClass('reveal-zoom');
    expect(target.style.getPropertyValue('--reveal-delay')).toBe('120ms');
  });
});

describe('Parallax', () => {
  it('moves the element on a wide screen', () => {
    stubMatchMedia();
    render(
      <Parallax speed={0.5} data-testid="target">
        Content
      </Parallax>
    );
    expect(screen.getByTestId('target').style.transform).toContain('translate3d');
  });

  it.each([
    ['reduced motion is requested', { reduced: true }],
    ['the screen is small', { wide: false }],
  ])('stays still when %s', (_name, media) => {
    stubMatchMedia(media);
    render(
      <Parallax speed={0.5} data-testid="target">
        Content
      </Parallax>
    );
    expect(screen.getByTestId('target').style.transform).toBe('');
  });
});
