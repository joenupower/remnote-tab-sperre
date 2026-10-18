import { AppEvents, declareIndexPlugin, type ReactRNPlugin } from '@remnote/plugin-sdk';
import {
  classifyChange,
  leavesFromTree,
  leavesFromWindowString,
  parseRemNoteUrl,
  type LayoutChange,
  type PaneNode,
  type TabKind,
} from '../lib/tabsperre';
import { detectLang, t } from '../lib/i18n';

/*
 * Locked Tab Panes (Tab-Sperre für Panels)
 * ----------------------------------------
 * RemNote führt alle Plugins abgeschottet (Sandbox) aus. Das Plugin arbeitet deshalb nur
 * mit offiziellen Schnittstellen:
 *
 *  1. CSS (registerCSS): Ist der aktive Tab mit «Lock Tab» gesperrt, werden die ✕-Knöpfe
 *     der Panels und alle Menüeinträge rund um Panels («Open in Another Pane» usw.)
 *     ausgeblendet. Die Erkennung läuft rein über CSS (:has), RemNote markiert den aktiven,
 *     gesperrten Tab-Knopf mit «rn-tabs-tab-button--locked» + «rn-clr-background-primary».
 *
 *  2. Zurückspringen (getURL/setURL): Wird in einem gesperrten Tab trotzdem ein Panel
 *     geschlossen oder hinzugefügt (z. B. per Tastenkürzel), leitet RemNote die Änderung in
 *     einen temporären Tab um (Adresse /w/…). Das Plugin erkennt diesen Wechsel
 *     (vorher /t/<kb>/<tab>/…, nachher /w/… mit genau einem Panel mehr oder weniger) und
 *     springt per setURL in den gesperrten Tab zurück. Der temporäre Tab verschwindet dabei.
 *
 * Grösse und Anordnung der Panels bleiben frei veränderbar; Links öffnen wie gewohnt im
 * temporären Tab.
 */

const CSS_ID = 'tabsperre-panels';
const LOCKED = 'body:has(.rn-tabs-tab-button--locked.rn-clr-background-primary)';
const LOCK_CSS = `
/* Tab-Sperre: im gesperrten Tab Panel-Schliessknöpfe und Panel-Menüeinträge ausblenden */
/* ✕ bei Dokumenten */
${LOCKED} .rn-pane__close-btn,
${LOCKED} [data-test="Close Pane Button"],
/* ✕ bei geöffneten Dateien (PDF, Word, Video …) */
${LOCKED} [data-test="Learning Page Close Button"],
/* ✕ bei weiteren Panel-Arten (z. B. Graph-Ansicht) */
${LOCKED} [data-test="Panel Close Button"],
${LOCKED} .multiple-windows__close-pane__container,
/* Menüeinträge wie «Open in Another Pane» */
${LOCKED} [data-test^="Menu Label:"][data-test*="Pane"] {
  display: none !important;
}
`;

const SETTING_HIDE = 'hide-close-buttons';
const SETTING_JUMP = 'jump-back';
const SETTING_TOAST = 'show-toast';
const SETTING_DEBUG = 'debug-log';

const POLL_MS = 800; // Ersatz, falls ein Ereignis ausbleibt
const DEBOUNCE_MS = 150; // kurz warten, bis RemNote fertig umgeschaltet hat
const SETTLE_MS = 1500; // nach einem Zurückspringen kurz nichts mehr korrigieren

const JUMP_BACK_ON: LayoutChange[] = ['pane-closed', 'pane-added'];

interface Snapshot {
  path: string; // roher Pfad, wie ihn RemNote liefert (für setURL)
  kind: TabKind;
  tabId?: string;
  windowString?: string;
  leaves: string[];
}

class TabSperre {
  private last: Snapshot | null = null;
  private lastTempWindowString: string | undefined;
  private lastPath = '';
  private running = false;
  private rerun = false;
  private debounceTimer: number | undefined;
  private pollTimer: number | undefined;
  private suppressUntil = 0;

  constructor(private plugin: ReactRNPlugin) {}

  async start() {
    await this.applyCss();
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
    void this.applyCss();
  };

  /** Ersatz für verpasste Ereignisse: nur die Adresse vergleichen (ein einziger API-Aufruf). */
  private poll = async () => {
    try {
      const path = await this.plugin.window.getURL();
      if (path !== this.lastPath) this.schedule();
    } catch {
      // egal
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
    if (await this.setting(SETTING_DEBUG, false)) console.log('[Locked Tab Panes]', ...args);
  }

  private async applyCss() {
    const hide = await this.setting(SETTING_HIDE, true);
    try {
      await this.plugin.app.registerCSS(CSS_ID, hide ? LOCK_CSS : '');
    } catch (e) {
      console.warn('[Locked Tab Panes] could not register CSS', e);
    }
  }

  async readSnapshot(): Promise<Snapshot> {
    let path = '';
    try {
      path = (await this.plugin.window.getURL()) ?? '';
    } catch {
      path = '';
    }
    const info = parseRemNoteUrl(path);

    let tree: PaneNode | undefined;
    try {
      tree = (await this.plugin.window.getCurrentWindowTree()) as unknown as PaneNode;
    } catch {
      tree = undefined;
    }
    const leaves = tree ? leavesFromTree(tree) : leavesFromWindowString(info.windowString);
    return { path, kind: info.kind, tabId: info.tabId, windowString: info.windowString, leaves };
  }

  private async notify(change: LayoutChange) {
    if (!(await this.setting(SETTING_TOAST, true))) return;
    const text = change === 'pane-closed' ? t('toastClosed', LANG) : t('toastAdded', LANG);
    try {
      await this.plugin.app.toast(`🔒 ${text} ${t('unlockHint', LANG)}`);
    } catch {
      // egal
    }
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
      console.warn('[Locked Tab Panes] error', e);
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
    this.lastPath = cur.path;
    const prev = this.last;
    await this.debug('Zustand', { prev, cur });

    // Direkt nach dem Zurückspringen: Zwischenstände ignorieren.
    if (Date.now() < this.suppressUntil) {
      if (cur.kind !== 'temp') this.last = cur;
      return;
    }

    // Eine Panel-Änderung in einem gesperrten Tab landet in einem neuen temporären Tab.
    // In einem nicht gesperrten Tab passiert sie direkt im Tab, dieser Fall tritt also nur
    // bei gesperrten Tabs auf.
    if (
      prev &&
      prev.kind === 'tab' &&
      prev.path &&
      cur.kind === 'temp' &&
      cur.windowString !== this.lastTempWindowString &&
      (await this.setting(SETTING_JUMP, true))
    ) {
      const change = classifyChange(prev.leaves, cur.leaves);
      if (JUMP_BACK_ON.includes(change)) {
        await this.debug('Panel-Änderung aus gesperrtem Tab umgeleitet, springe zurück:', change);
        this.suppressUntil = Date.now() + SETTLE_MS;
        try {
          await this.plugin.window.setURL(prev.path);
          this.lastTempWindowString = undefined;
          await this.notify(change);
          return; // this.last bleibt der gesperrte Tab
        } catch (e) {
          this.suppressUntil = 0;
          console.warn('[Locked Tab Panes] jumping back failed', e);
        }
      }
    }

    if (cur.kind === 'temp') this.lastTempWindowString = cur.windowString;
    this.last = cur;
  }

  async statusText(): Promise<string> {
    const s = await this.readSnapshot();
    const kind =
      s.kind === 'tab' ? t('kindTab', LANG) : s.kind === 'temp' ? t('kindTemp', LANG) : t('kindOther', LANG);
    const hide = await this.setting(SETTING_HIDE, true);
    return [
      t('statusActive', LANG),
      kind,
      `${s.leaves.length} ${t('panes', LANG)}`,
      hide ? t('hideOn', LANG) : t('hideOff', LANG),
    ].join(' · ');
  }
}

const LANG = detectLang();

let sperre: TabSperre | null = null;

async function onActivate(plugin: ReactRNPlugin) {
  await plugin.settings.registerBooleanSetting({
    id: SETTING_HIDE,
    title: t('settingHide', LANG),
    defaultValue: true,
  });
  await plugin.settings.registerBooleanSetting({
    id: SETTING_JUMP,
    title: t('settingJump', LANG),
    defaultValue: true,
  });
  await plugin.settings.registerBooleanSetting({
    id: SETTING_TOAST,
    title: t('settingToast', LANG),
    defaultValue: true,
  });
  await plugin.settings.registerBooleanSetting({
    id: SETTING_DEBUG,
    title: t('settingDebug', LANG),
    defaultValue: false,
  });

  sperre = new TabSperre(plugin);

  await plugin.app.registerCommand({
    id: 'tabsperre-status',
    name: t('commandStatus', LANG),
    action: async () => {
      if (sperre) await plugin.app.toast(await sperre.statusText());
    },
  });

  await sperre.start();
}

async function onDeactivate(_: ReactRNPlugin) {
  if (sperre) await sperre.stop();
  sperre = null;
}

declareIndexPlugin(onActivate, onDeactivate);
