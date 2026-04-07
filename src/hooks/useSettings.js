import { useState, useEffect } from 'react';

const SETTINGS_KEY = 'alyx_settings';

const defaults = {
  darkMode: false,
  accentColor: 'violet', // violet | blue | rose | emerald | amber | sky
};

export function useSettings() {
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_KEY);
      return saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
    } catch {
      return defaults;
    }
  });

  // Apply theme to document root whenever settings change
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', settings.darkMode ? 'dark' : 'light');
    root.setAttribute('data-accent', settings.accentColor);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  const updateSettings = (patch) => {
    setSettings(prev => ({ ...prev, ...patch }));
  };

  return { settings, updateSettings };
}
