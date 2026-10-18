/**
 * Texte auf Deutsch und Englisch. Die Sprache folgt der Systemsprache (navigator.language):
 * beginnt sie mit «de», erscheint alles auf Deutsch, sonst auf Englisch.
 */

export type Lang = 'de' | 'en';

export function detectLang(language?: string): Lang {
  const l = (language ?? (typeof navigator !== 'undefined' ? navigator.language : '') ?? '').toLowerCase();
  return l.startsWith('de') ? 'de' : 'en';
}

const TEXTS = {
  settingHide: {
    de: '✕-Knöpfe und Panel-Menüeinträge in gesperrten Tabs ausblenden',
    en: 'Hide pane close buttons and pane menu items in locked tabs',
  },
  settingJump: {
    de: 'Bei geschlossenem oder neuem Panel in den gesperrten Tab zurückspringen',
    en: 'Jump back to the locked tab if a pane is closed or added anyway',
  },
  settingToast: {
    de: 'Hinweis anzeigen, wenn eine Änderung blockiert wurde',
    en: 'Show a notice when a change was blocked',
  },
  settingDebug: {
    de: 'Fehlersuche: Details in die Konsole schreiben',
    en: 'Debugging: log details to the console',
  },
  commandStatus: {
    de: 'Locked Tab Panes: Status anzeigen',
    en: 'Locked Tab Panes: show status',
  },
  toastClosed: {
    de: 'Tab ist gesperrt – das Panel bleibt offen.',
    en: 'This tab is locked – the pane stays open.',
  },
  toastAdded: {
    de: 'Tab ist gesperrt – hier kommen keine Panels dazu.',
    en: 'This tab is locked – no panes can be added.',
  },
  unlockHint: {
    de: '(Entsperren: Rechtsklick auf den Tab)',
    en: '(To unlock: right-click the tab)',
  },
  statusActive: { de: 'Locked Tab Panes aktiv', en: 'Locked Tab Panes active' },
  kindTab: { de: 'normaler Tab', en: 'regular tab' },
  kindTemp: { de: 'temporärer Tab', en: 'temporary tab' },
  kindOther: { de: 'andere Seite', en: 'other page' },
  panes: { de: 'Panel(s)', en: 'pane(s)' },
  hideOn: {
    de: '✕-Knöpfe in gesperrten Tabs ausgeblendet',
    en: 'close buttons hidden in locked tabs',
  },
  hideOff: {
    de: '✕-Knöpfe in gesperrten Tabs sichtbar',
    en: 'close buttons visible in locked tabs',
  },
} as const;

export type TextKey = keyof typeof TEXTS;

export function t(key: TextKey, lang: Lang = detectLang()): string {
  return TEXTS[key][lang];
}
