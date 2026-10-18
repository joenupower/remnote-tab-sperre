import { AppEvents, declareIndexPlugin, type ReactRNPlugin } from '@remnote/plugin-sdk';
import {
  classifyChange,
  isTabLocked,
  leavesFromTree,
  leavesFromWindowString,
  parseRemNoteUrl,
  parseStoredTabs,
  tabButtonIndex,
  toRemIdTree,
  type LayoutChange,
  type PaneNode,
  type TabKind,
} from '../lib/tabsperre';

/*
 * Tab-Sperre für Panels
 * ---------------------
 * Ist der aktive Tab mit RemNotes «Lock Tab» gesperrt, dann
 *  1. werden die ✕-Knöpfe der Panels ausgeblendet,
 *  2. wird ein Panel, das trotzdem geschlossen oder hinzugefügt wird, sofort zurückgeholt:
 *     RemNote leitet solche Änderungen in einen temporären Tab um – das Plugin springt dann
 *     zurück in den gesperrten Tab (der temporäre Tab verschwindet dabei).
 *  3. Falls eine RemNote-Version das Layout des gesperrten Tabs direkt ändert, wird das
 *     vorherige Layout wiederhergestellt (auch bei einem Dokumentwechsel im Panel).
 * Grösse und Anordnung der Panels bleiben frei veränderbar.
 *
 * Das Plugin braucht den nativen Modus (manifest: requestNative), weil es RemNotes
 * Tab-Liste (localStorage «tabs») und die Tab-Leiste lesen muss.
 */

const CSS_ID = 'tabsperre-panels';
const HIDE_CLOSE_CSS = `
/* Tab-Sperre: Schliessknöpfe der Panels im gesperrten Tab ausblenden */
.rn-pane__close-btn,
[data-test="Close Pane Button"] {
  display: none !important;
}
`;

const SETTING_HIDE = 'hide-close-buttons';
const SETTING_TOAST = 'show-toast';
const SETTING_DEBUG = 'debug-log';

const POLL_MS = 500; // wie oft (billig) geprüft wird, ob sich Adresse oder Tab-Liste geändert haben
const DEBOUNCE_MS = 120; // kurz warten, bis RemNote fertig umgeschaltet hat
const SETTLE_MS = 1500; // nach einem Eingriff kurz nichts mehr korrigieren

const BLOCK_IN_PLACE: LayoutChange[] = ['pane-closed', 'pane-added', 'doc-changed'];
const BLOCK_FROM_TEMP: LayoutChange[] = ['pane-closed', 'pane-added'];

interface Snapshot {
  kind: TabKind;
  tabId?: string;
  kbId?: string;
  windowString?: string;
  locked: boolean;
  leaves: string[];
  tree?: PaneNode;
}

function readLocalStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Ersatzweg über die Tab-Leiste, falls der Tab nicht im localStorage steht. */
function domActiveTabLocked(): boolean {
  try {
    return !!document.querySelector('.rn-tabs-tab-button--locked.rn-clr-background-primary');
  } catch {
    return false;
  }
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

function clickLikeUser(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  const base = {
    bubbles: true,
    cancelable: true,
    clientX: r.x + r.width / 2,
    clientY: r.y + r.height / 2,
    button: 0,
  };
  const pointer = { ...base, pointerId: 1, pointerType: 'mouse', isPrimary: true };
  el.dispatchEvent(new PointerEvent('pointerdown', { ...pointer, buttons: 1 }));
  el.dispatchEvent(new MouseEvent('mousedown', { ...base, buttons: 1 }));
  el.dispatchEvent(new PointerEvent('pointerup', pointer));
  el.dispatchEvent(new MouseEvent('mouseup', base));
  el.dispatchEvent(new MouseEvent('click', base));
}

class TabSperre {
  private last: Snapshot | null = null;
  private lastTempWindowString: string | undefined;
  private running = false;
  private rerun = false;
  private debounceTimer: number | undefined;
  private pollTimer: number | undefined;
  private suppressUntil = 0;
  private cssActive: boolean | null = null;
  private signature = '';

  constructor(private plugin: ReactRNPlugin) {}

  start() {
    this.plugin.event.addListener(AppEvents.URLChange, undefined, this.schedule);
    this.plugin.event.addListener(AppEvents.CurrentWindowTreeChange, undefined, this.schedule);
    this.plugin.event.addListener(AppEvents.SettingChanged, undefined, this.onSettingChanged);
    this.pollTimer = window.setInterval(this.poll, POLL_MS);
    this.schedule();
  }

  async stop() {
    this.plugin.event.removeListener(AppEvents.URLChange, undefined, this.schedule);
    this.plugin.event.removeListener(AppEvents.CurrentWindowTreeChange, undefined, this.schedule);
    this.plugin.event.removeListener(AppEvents.SettingChanged, undefined, this.onSettingChanged);
    window.clearInterval(this.pollTimer);
    window.clearTimeout(this.debounceTimer);
    try {
      await this.plugin.app.registerCSS(CSS_ID, '');
    } catch {
      // egal
    }
  }

  schedule = () => {
    window.clearTimeout(this.debounceTimer);
    this.debounceTimer = window.setTimeout(() => void this.tick(), DEBOUNCE_MS);
  };

  private onSettingChanged = () => {
    this.cssActive = null; // CSS neu setzen
    this.schedule();
  };

  /** Billige Prüfung ohne API-Aufrufe: hat sich Adresse oder Tab-Liste geändert? */
  private poll = () => {
    const sig = window.location.href + '|' + (readLocalStorage('tabs') ?? '');
    if (sig !== this.signature) {
      this.signature = sig;
      this.schedule();
    }
  };

  private async setting<T>(id: string, fallback: T): Promise<T> {
    try {
      const v = await this.plugin.settings.getSetting<T>(id);
      return v === undefined || v === null ? fallback : v;
    } catch {
      return fallback;
    }
  }

  private async debug(...args: unknown[]) {
    if (await this.setting(SETTING_DEBUG, false)) console.log('[Tab-Sperre]', ...args);
  }

  async readSnapshot(): Promise<Snapshot> {
    let url: string | undefined;
    try {
      url = await this.plugin.window.getURL();
    } catch {
      url = undefined;
    }
    let info = parseRemNoteUrl(url ?? window.location.href);
    if (info.kind === 'other') info = parseRemNoteUrl(window.location.href);

    const tabs = parseStoredTabs(readLocalStorage('tabs'));
    let locked = false;
    if (info.kind === 'tab') locked = isTabLocked(tabs, info.tabId) ?? domActiveTabLocked();

    let tree: PaneNode | undefined;
    try {
      tree = (await this.plugin.window.getCurrentWindowTree()) as unknown as PaneNode;
    } catch {
      tree = undefined;
    }
    const leaves = tree ? leavesFromTree(tree) : leavesFromWindowString(info.windowString);

    return {
      kind: info.kind,
      tabId: info.tabId,
      kbId: info.kbId,
      windowString: info.windowString,
      locked,
      leaves,
      tree,
    };
  }

  private async applyCss(cur: Snapshot) {
    const hide = await this.setting(SETTING_HIDE, true);
    const want = cur.kind === 'tab' && cur.locked && hide;
    if (want === this.cssActive) return;
    this.cssActive = want;
    try {
      await this.plugin.app.registerCSS(CSS_ID, want ? HIDE_CLOSE_CSS : '');
    } catch (e) {
      this.cssActive = null;
      console.warn('[Tab-Sperre] CSS konnte nicht gesetzt werden', e);
    }
  }

  private async notify(change: LayoutChange) {
    if (!(await this.setting(SETTING_TOAST, true))) return;
    const text: Partial<Record<LayoutChange, string>> = {
      'pane-closed': 'Tab ist gesperrt – das Panel bleibt offen.',
      'pane-added': 'Tab ist gesperrt – hier kommen keine Panels dazu.',
      'doc-changed': 'Tab ist gesperrt – das Panel behält sein Dokument.',
    };
    try {
      await this.plugin.app.toast(`🔒 ${text[change] ?? 'Tab ist gesperrt.'} (Entsperren: Rechtsklick auf den Tab)`);
    } catch {
      // egal
    }
  }

  /** Springt in der Tab-Leiste zum gesperrten Tab zurück. */
  private async switchToTab(tabId: string): Promise<boolean> {
    for (let attempt = 0; attempt < 4; attempt++) {
      const tabs = parseStoredTabs(readLocalStorage('tabs'));
      const idx = tabButtonIndex(tabs, tabId);
      let btn: HTMLElement | null = null;
      if (idx >= 0) btn = document.querySelector<HTMLElement>(`[data-test="TopTab ${idx}"]`);
      if (!btn) {
        const title = idx >= 0 ? tabs[idx].cachedTitle : undefined;
        const lockedButtons = Array.from(
          document.querySelectorAll<HTMLElement>('.rn-tabs-tab-button--locked'),
        );
        btn =
          lockedButtons.find((b) => !!title && (b.textContent ?? '').trim() === title) ??
          (lockedButtons.length === 1 ? lockedButtons[0] : null);
      }
      if (btn) {
        clickLikeUser(btn);
        return true;
      }
      await sleep(150);
    }
    return false;
  }

  /** Stellt das gespeicherte Layout im (gesperrten) aktuellen Tab wieder her. */
  private async restoreInPlace(prev: Snapshot): Promise<boolean> {
    // Bevorzugt der dokumentierte Weg (Layout aus Dokument-IDs) …
    if (prev.tree) {
      const remTree = toRemIdTree(prev.tree);
      if (remTree !== null) {
        try {
          await this.plugin.window.setRemWindowTree(remTree as never);
          return true;
        } catch (e) {
          await this.debug('setRemWindowTree fehlgeschlagen', e);
        }
      }
    }
    // … sonst der Layout-String aus der Adresse (enthält auch Spezialseiten).
    if (prev.windowString) {
      try {
        await this.plugin.window.setCurrentWindowTreeFromString(prev.windowString);
        return true;
      } catch (e) {
        await this.debug('setCurrentWindowTreeFromString fehlgeschlagen', e);
      }
    }
    return false;
  }

  private async tick() {
    if (this.running) {
      this.rerun = true;
      return;
    }
    this.running = true;
    try {
      await this.evaluate();
    } catch (e) {
      console.warn('[Tab-Sperre] Fehler', e);
    } finally {
      this.running = false;
      if (this.rerun) {
        this.rerun = false;
        this.schedule();
      }
    }
  }

  private async evaluate() {
    const cur = await this.readSnapshot();
    await this.applyCss(cur);
    const prev = this.last;
    await this.debug('Zustand', { prev, cur });

    // Direkt nach einem eigenen Eingriff: nur Tabs übernehmen, temporäre Zwischenstände ignorieren.
    if (Date.now() < this.suppressUntil) {
      if (cur.kind !== 'temp') this.last = cur;
      return;
    }

    if (prev && prev.kind === 'tab' && prev.locked && prev.tabId) {
      // Fall 1: Der gesperrte Tab selbst wurde verändert.
      if (cur.kind === 'tab' && cur.tabId === prev.tabId && cur.locked) {
        const change = classifyChange(prev.leaves, cur.leaves);
        if (BLOCK_IN_PLACE.includes(change)) {
          await this.debug('Änderung im gesperrten Tab, stelle wieder her:', change);
          this.suppressUntil = Date.now() + SETTLE_MS;
          if (await this.restoreInPlace(prev)) {
            await this.notify(change);
            return; // this.last bleibt das gesperrte Layout
          }
          this.suppressUntil = 0;
        }
      }
      // Fall 2: RemNote hat die Änderung in einen (neuen) temporären Tab umgeleitet.
      else if (cur.kind === 'temp' && cur.windowString !== this.lastTempWindowString) {
        const change = classifyChange(prev.leaves, cur.leaves);
        if (BLOCK_FROM_TEMP.includes(change)) {
          await this.debug('Änderung in temporären Tab umgeleitet, springe zurück:', change);
          this.suppressUntil = Date.now() + SETTLE_MS;
          if (await this.switchToTab(prev.tabId)) {
            this.lastTempWindowString = undefined;
            await this.notify(change);
            return; // this.last bleibt das gesperrte Layout
          }
          this.suppressUntil = 0;
        }
      }
    }

    if (cur.kind === 'temp') this.lastTempWindowString = cur.windowString;
    this.last = cur;
  }

  async statusText(): Promise<string> {
    const s = await this.readSnapshot();
    const sandboxed = window.top !== window.self;
    const art = s.kind === 'tab' ? 'normaler Tab' : s.kind === 'temp' ? 'temporärer Tab' : 'unbekannt';
    return [
      `Tab-Sperre: ${art}`,
      s.kind === 'tab' ? (s.locked ? 'gesperrt 🔒' : 'nicht gesperrt') : '',
      `${s.leaves.length} Panel(s)`,
      sandboxed ? '⚠️ läuft NICHT im nativen Modus' : '',
    ]
      .filter(Boolean)
      .join(' · ');
  }
}

let sperre: TabSperre | null = null;

async function onActivate(plugin: ReactRNPlugin) {
  await plugin.settings.registerBooleanSetting({
    id: SETTING_HIDE,
    title: '✕-Knöpfe der Panels in gesperrten Tabs ausblenden',
    defaultValue: true,
  });
  await plugin.settings.registerBooleanSetting({
    id: SETTING_TOAST,
    title: 'Hinweis anzeigen, wenn eine Änderung blockiert wurde',
    defaultValue: true,
  });
  await plugin.settings.registerBooleanSetting({
    id: SETTING_DEBUG,
    title: 'Fehlersuche: Details in die Konsole schreiben',
    defaultValue: false,
  });

  sperre = new TabSperre(plugin);

  await plugin.app.registerCommand({
    id: 'tabsperre-status',
    name: 'Tab-Sperre: Status anzeigen',
    action: async () => {
      if (sperre) await plugin.app.toast(await sperre.statusText());
    },
  });

  if (window.top !== window.self) {
    await plugin.app.toast(
      'Tab-Sperre: Das Plugin läuft nicht im nativen Modus und kann gesperrte Tabs nicht erkennen.',
    );
  }

  sperre.start();
}

async function onDeactivate(_: ReactRNPlugin) {
  if (sperre) await sperre.stop();
  sperre = null;
}

declareIndexPlugin(onActivate, onDeactivate);
