"use client";

import { useState, useEffect, useCallback } from "react";
import {
  loadSettings,
  saveSettings,
  clampOpacity,
  MIN_OPACITY,
  MAX_OPACITY,
  type Settings,
} from "@/lib/settings";

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsChange: (settings: Settings) => void;
}

export default function SettingsPanel({
  isOpen,
  onClose,
  onSettingsChange,
}: SettingsPanelProps) {
  const [opacity, setOpacity] = useState(0.9);

  useEffect(() => {
    const settings = loadSettings();
    setOpacity(settings.opacity);
  }, []);

  const handleOpacityChange = useCallback(
    (value: number) => {
      const clamped = clampOpacity(value);
      setOpacity(clamped);
      const newSettings = { opacity: clamped };
      saveSettings(newSettings);
      onSettingsChange(newSettings);
    },
    [onSettingsChange]
  );

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleOpacityChange(parseFloat(e.target.value));
  };

  if (!isOpen) return null;

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <span className="settings-title">Settings</span>
          <button className="settings-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="settings-content">
          <div className="settings-item">
            <label className="settings-label">
              Background Opacity
              <span className="settings-value">{Math.round(opacity * 100)}%</span>
            </label>
            <input
              type="range"
              min={MIN_OPACITY}
              max={MAX_OPACITY}
              step={0.05}
              value={opacity}
              onChange={handleSliderChange}
              className="settings-slider"
            />
            <div className="settings-hint">
              Adjust the terminal background transparency
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
