interface OnboardingProps {
  onComplete: () => void;
}

// Icons for onboarding items
function TerminalIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  );
}

function KeyboardIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" ry="2" />
      <line x1="6" y1="8" x2="6" y2="8" />
      <line x1="10" y1="8" x2="10" y2="8" />
      <line x1="14" y1="8" x2="14" y2="8" />
      <line x1="18" y1="8" x2="18" y2="8" />
      <line x1="6" y1="12" x2="6" y2="12" />
      <line x1="18" y1="12" x2="18" y2="12" />
      <line x1="8" y1="16" x2="16" y2="16" />
    </svg>
  );
}

function EscapeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 9l6 6" />
      <path d="M15 9l-6 6" />
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

export default function Onboarding({ onComplete }: OnboardingProps) {
  return (
    <div className="onboarding-overlay" onClick={onComplete}>
      <div className="onboarding-panel" onClick={(e) => e.stopPropagation()}>
        <div className="onboarding-header">
          <h2 className="onboarding-title">Welcome to µTerm</h2>
          <p className="onboarding-subtitle">A lightweight menubar terminal</p>
        </div>

        <div className="onboarding-content">
          <div className="onboarding-item">
            <div className="onboarding-icon">
              <TerminalIcon />
            </div>
            <div className="onboarding-text">
              <h4>Quick Access</h4>
              <p>Click the menubar icon to toggle the terminal window.</p>
            </div>
          </div>

          <div className="onboarding-item">
            <div className="onboarding-icon">
              <KeyboardIcon />
            </div>
            <div className="onboarding-text">
              <h4>Global Shortcut</h4>
              <p>Press <kbd className="onboarding-kbd">⌘⇧T</kbd> anywhere to toggle the terminal.</p>
            </div>
          </div>

          <div className="onboarding-item">
            <div className="onboarding-icon">
              <EscapeIcon />
            </div>
            <div className="onboarding-text">
              <h4>Hide Window</h4>
              <p>Double-tap <kbd className="onboarding-kbd">ESC</kbd> to quickly hide the window.</p>
            </div>
          </div>

          <div className="onboarding-item">
            <div className="onboarding-icon">
              <GearIcon />
            </div>
            <div className="onboarding-text">
              <h4>Customize</h4>
              <p>Click the gear icon to adjust opacity, font size, and shortcuts.</p>
            </div>
          </div>
        </div>

        <div className="onboarding-footer">
          <button className="onboarding-button" onClick={onComplete}>
            Get Started
          </button>
        </div>
      </div>
    </div>
  );
}
