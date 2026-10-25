import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import LandingPage from '../components/LandingPage.jsx';
import Workspace from '../components/Workspace.jsx';

describe('Requirement 4: Forbidden words scan', () => {
  const FORBIDDEN_WORDS = ['verified', 'proven', 'correct', 'guaranteed'];

  const createWrapper = () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    function QueryWrapper({ children }) {
      return (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );
    }
    return QueryWrapper;
  };

  it('ensures no forbidden words appear in rendered LandingPage', () => {
    const { container } = render(<LandingPage onOpenWorkspace={() => {}} />);
    const text = container.textContent || '';

    FORBIDDEN_WORDS.forEach((word) => {
      const regex = new RegExp(`\\b${word}\\b`, 'i');
      const matches = text.match(regex);
      expect(
        matches,
        `Forbidden word "${word}" found in rendered LandingPage: "${matches?.[0]}"`
      ).toBeNull();
    });
  });

  it('ensures no forbidden words appear in rendered Workspace', () => {
    const { container } = render(<Workspace onReturnToLanding={() => {}} />, {
      wrapper: createWrapper(),
    });
    const text = container.textContent || '';

    FORBIDDEN_WORDS.forEach((word) => {
      const regex = new RegExp(`\\b${word}\\b`, 'i');
      const matches = text.match(regex);
      expect(
        matches,
        `Forbidden word "${word}" found in rendered Workspace: "${matches?.[0]}"`
      ).toBeNull();
    });
  });
});
