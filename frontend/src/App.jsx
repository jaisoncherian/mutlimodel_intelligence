import React, { useState } from 'react';
import LandingPage from './components/LandingPage.jsx';
import Workspace from './components/Workspace.jsx';
import { ThemeProvider } from './theme/ThemeContext.jsx';

export default function App() {
  const [currentView, setCurrentView] = useState('landing');

  return (
    <ThemeProvider>
      {currentView === 'workspace' ? (
        <Workspace onReturnToLanding={() => setCurrentView('landing')} />
      ) : (
        <LandingPage onOpenWorkspace={() => setCurrentView('workspace')} />
      )}
    </ThemeProvider>
  );
}
