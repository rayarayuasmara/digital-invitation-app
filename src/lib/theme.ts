/** Theme preference: follow the OS, or pin light/dark. Persisted locally. */
export type ThemeMode = 'system' | 'light' | 'dark'

const STORAGE_KEY = 'rr_theme'
const STORAGE_EVENT = 'rr_theme_change'
const darkQuery = () => window.matchMedia('(prefers-color-scheme: dark)')

export function readThemeMode(): ThemeMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored === 'light' || stored === 'dark' ? stored : 'system'
  } catch {
    return 'system'
  }
}

/** Writes the resolved theme onto <html>, which is what tokens and Arc styles key off. */
export function applyThemeMode(mode: ThemeMode) {
  const resolved = mode === 'dark' || (mode === 'system' && darkQuery().matches) ? 'dark' : 'light'
  const root = document.documentElement
  root.dataset.theme = resolved
  root.style.colorScheme = resolved
}

export function setThemeMode(mode: ThemeMode) {
  try {
    localStorage.setItem(STORAGE_KEY, mode)
  } catch {
    // Private mode: the theme still applies for this session.
  }
  applyThemeMode(mode)
  window.dispatchEvent(new CustomEvent(STORAGE_EVENT, { detail: mode }))
}

/** Applies the stored preference and keeps "system" in sync with the OS. Call once at startup. */
export function initTheme() {
  applyThemeMode(readThemeMode())
  const query = darkQuery()
  const sync = () => {
    if (readThemeMode() === 'system') applyThemeMode('system')
  }
  query.addEventListener('change', sync)
  return () => query.removeEventListener('change', sync)
}

/** Re-renders the caller whenever the preference changes anywhere in the app. */
export function subscribeThemeMode(listener: () => void) {
  window.addEventListener(STORAGE_EVENT, listener)
  return () => window.removeEventListener(STORAGE_EVENT, listener)
}
