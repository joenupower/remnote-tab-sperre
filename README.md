# Locked Tab Panes

Lock a tab in RemNote (**right-click the tab → Lock Tab**) and its panes stay exactly as they are.

| In a locked tab | What happens |
|---|---|
| Close a pane | The pane close buttons (✕) are hidden, for documents as well as for opened files (PDF, Word, video). If a pane gets closed anyway (e.g. with a keyboard shortcut), the plugin takes you straight back to the locked tab. |
| Add a pane | Menu items such as "Open in Another Pane" are hidden. If a pane gets added anyway, the plugin takes you back to the locked tab. |
| Click a link | The pane keeps its document. The link opens in RemNote's temporary tab, as usual. |
| Resize or rearrange panes | Allowed. |

To change the layout, unlock the tab for a moment (right-click → Unlock).

## How it works

- RemNote already protects locked tabs: a change to the layout of a locked tab is redirected into a temporary tab. This plugin hides the controls that cause these redirects. If a redirect happens anyway (pane closed or added), it returns you to the locked tab with `plugin.window.setURL`. The temporary tab is discarded.
- The plugin runs sandboxed and only uses official plugin APIs: `app.registerCSS`, `window.getURL`, `window.setURL`, `window.getCurrentWindowTree`, settings, commands, toasts and events.
- The active locked tab is detected in CSS only, via `:has()` on RemNote's tab button classes `rn-tabs-tab-button--locked` and `rn-clr-background-primary`. If a RemNote update renames these classes, the close buttons will simply show up again. Nothing breaks.

## Privacy

No data leaves RemNote. The plugin makes no network requests and uses no third-party services. The read permission is only used to read the pane layout of the current window.

## Settings

- **Hide pane close buttons and pane menu items in locked tabs** (default: on)
- **Jump back to the locked tab if a pane is closed or added anyway** (default: on)
- **Show a notice when a change was blocked** (default: on)
- **Debugging: log details to the console** (default: off)

The command **"Locked Tab Panes: show status"** shows whether the plugin is running, the current tab type and the number of panes.

The interface is in German when your system language is German, and in English otherwise.

## Development

- `src/widgets/index.tsx`: plugin logic (CSS, events, jumping back)
- `src/lib/tabsperre.ts`: pure helpers (parse the RemNote path, compare pane layouts)
- `src/lib/i18n.ts`: German and English texts
- `npm install`, then `npm run dev` serves the plugin on `http://localhost:8080` (Windows: `plugin-starten.bat`). In RemNote: Settings → Plugins → Build → Develop from localhost.
- `npm run build` validates the manifest and creates `PluginZip.zip` for upload.

Tested with RemNote 1.28 (October 2026).

## Deutsch

**Locked Tab Panes** schützt die Panels gesperrter Tabs (Rechtsklick auf den Tab → «Lock Tab»):

- Die ✕-Knöpfe der Panels sind ausgeblendet, auch bei geöffneten Dateien (PDF, Word usw.).
- Menüeinträge wie «Open in Another Pane» sind ausgeblendet.
- Wird trotzdem ein Panel geschlossen oder hinzugefügt, springt das Plugin zurück in den gesperrten Tab.
- Links öffnen wie gewohnt im temporären Tab. Grösse und Anordnung der Panels bleiben frei.

Es werden keine Daten aus RemNote hinausgeschickt. Die Oberfläche erscheint auf Deutsch, wenn die Systemsprache Deutsch ist.
