// src/utils/theme.js — shared theme helpers used by App.jsx and LoginPage.jsx
// so the chosen theme survives login/logout and page reloads.

export const THEMES = [
  { key: "light", icon: "☀️", label: "LIGHT" },
  { key: "dark",  icon: "🌙", label: "DARK"  },
];

const STORAGE_KEY = "kk-theme";

// Resolve the theme to use on first load: saved choice > OS preference > light.
export function getStoredThemeKey() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && THEMES.some(t => t.key === saved)) return saved;
  } catch { /* localStorage unavailable — ignore */ }

  if (typeof window !== "undefined" && window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }
  return "light";
}

// Apply a theme to the document and persist it.
export function applyTheme(key) {
  document.documentElement.setAttribute("data-theme", key);
  try { localStorage.setItem(STORAGE_KEY, key); } catch { /* ignore */ }
}