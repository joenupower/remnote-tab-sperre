/**
 * Reine Logik der Tab-Sperre (ohne RemNote-API), damit sie sich testen lässt.
 *
 * Hintergrund (getestet mit RemNote 1.28, Oktober 2026):
 * - Die Adresse eines normalen Tabs lautet  /t/<kbId>/<tabId>/<windowString>
 * - Ein temporärer Tab (Uhr-Symbol) hat die Adresse  /w/<kbId>/<windowString>
 * - plugin.window.getURL() liefert genau diesen Pfad (window.location.pathname),
 *   plugin.window.setURL(pfad) navigiert dorthin und wechselt dabei den Tab.
 */

export type TabKind = 'tab' | 'temp' | 'other';

export interface ActiveTabInfo {
  kind: TabKind;
  kbId?: string;
  tabId?: string;
  windowString?: string;
}

/** Liest Tab-Art, Tab-ID und Layout-String aus einer RemNote-Adresse. */
export function parseRemNoteUrl(url: string | undefined | null): ActiveTabInfo {
  if (!url) return { kind: 'other' };
  let pathname = url;
  try {
    pathname = new URL(url, 'https://www.remnote.com').pathname;
  } catch {
    // url ist bereits ein Pfad
  }
  const parts = pathname.split('/').filter((p) => p.length > 0);
  const dec = (s: string | undefined) => {
    if (s === undefined) return undefined;
    try {
      return decodeURIComponent(s);
    } catch {
      return s;
    }
  };
  if (parts[0] === 't' && parts.length >= 3) {
    return {
      kind: 'tab',
      kbId: dec(parts[1]),
      tabId: dec(parts[2]),
      windowString: dec(parts.slice(3).join('/')) || undefined,
    };
  }
  if (parts[0] === 'w' && parts.length >= 2) {
    return {
      kind: 'temp',
      kbId: dec(parts[1]),
      windowString: dec(parts.slice(2).join('/')) || undefined,
    };
  }
  return { kind: 'other' };
}

/* ------------------------------------------------------------------ */
/* Panel-Layouts                                                       */
/* ------------------------------------------------------------------ */

/** Minimaler Ausschnitt der SDK-Typen (MosaicNode), damit diese Datei ohne SDK läuft. */
export interface PaneLeaf {
  remId?: string;
  paneId?: string;
}
export interface PaneParent {
  direction: 'row' | 'column';
  first: PaneNode;
  second: PaneNode;
  splitPercentage?: number;
}
export type PaneNode = PaneLeaf | PaneParent;

export function isParent(node: PaneNode): node is PaneParent {
  return !!node && typeof node === 'object' && 'first' in node && 'second' in node;
}

const EMPTY_PANE = '(leer)';

/** Dokument-IDs aller Panels, von links oben nach rechts unten. */
export function leavesFromTree(node: PaneNode | undefined | null): string[] {
  if (!node) return [];
  if (isParent(node)) return [...leavesFromTree(node.first), ...leavesFromTree(node.second)];
  return [node.remId || EMPTY_PANE];
}

/**
 * Ersatzweg, falls die API kein Layout liefert: Dokument-IDs aus dem Layout-String der
 * Adresse lesen. Ein Blatt sieht so aus: «Doc-A-7ZQyzCvFpM1v3RWXA» (Titel + 17-stellige ID)
 * oder nur «7ZQyzCvFpM1v3RWXA»; Spezialseiten enden auf «~» (z. B. «empty~»).
 */
export function leavesFromWindowString(ws: string | undefined | null): string[] {
  if (!ws) return [];
  // Beispiel mit drei Panels: «((Doc-B-<id>)-(Doc-A-<id>)-50)_(Doc-A-<id>)_50».
  // Nach dem Aufteilen an Klammern und «_» bleiben Blätter, «-» und Prozentzahlen übrig.
  const leaves: string[] = [];
  const re = /(?:^|-)([A-Za-z0-9]{17})$/;
  for (const raw of ws.split(/[()_]+/)) {
    const t = raw.trim();
    if (!t || /^-?\d+$/.test(t) || t === '-') continue;
    if (t.endsWith('~')) {
      leaves.push(EMPTY_PANE);
      continue;
    }
    const m = t.match(re);
    if (m) leaves.push(m[1]);
  }
  return leaves;
}

export type LayoutChange =
  | 'unchanged' // gleiche Dokumente (evtl. andere Grösse/Anordnung)
  | 'pane-closed' // genau ein Panel weniger, Rest gleich
  | 'pane-added' // genau ein Panel mehr, Rest gleich
  | 'doc-changed' // gleiche Anzahl Panels, mindestens ein anderes Dokument
  | 'unrelated'; // hat mit dem vorherigen Layout nichts zu tun

function countMap(list: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const x of list) m.set(x, (m.get(x) ?? 0) + 1);
  return m;
}

/** true, wenn jede Dokument-ID aus `small` mindestens so oft in `big` vorkommt. */
function isSubMultiset(small: string[], big: string[]): boolean {
  const b = countMap(big);
  for (const [k, n] of countMap(small)) {
    if ((b.get(k) ?? 0) < n) return false;
  }
  return true;
}

/** Vergleicht zwei Layouts anhand der Dokumente in den Panels. */
export function classifyChange(before: string[], after: string[]): LayoutChange {
  if (before.length === after.length && isSubMultiset(before, after)) return 'unchanged';
  if (after.length === before.length - 1 && isSubMultiset(after, before)) return 'pane-closed';
  if (after.length === before.length + 1 && isSubMultiset(before, after)) return 'pane-added';
  if (after.length === before.length && after.length > 0) {
    // gleich viele Panels, aber andere Dokumente: nur «doc-changed», wenn die Layouts
    // sich überschneiden (sonst ist es ein ganz anderes Layout).
    const b = new Set(before);
    if (after.length === 1 || after.some((x) => b.has(x))) return 'doc-changed';
  }
  return 'unrelated';
}
