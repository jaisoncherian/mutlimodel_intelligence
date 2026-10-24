import React, { useState } from 'react';
import LandingPage from './components/LandingPage.jsx';
import Workspace from './components/Workspace.jsx';

export default function App() {
  const [currentView, setCurrentView] = useState('landing');

  if (currentView === 'workspace') {
    return <Workspace onReturnToLanding={() => setCurrentView('landing')} />;
  }

  return <LandingPage onOpenWorkspace={() => setCurrentView('workspace')} />;
}
