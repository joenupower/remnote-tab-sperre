# Tab-Sperre für Panels (RemNote-Plugin)

Wenn du einen Tab mit **Rechtsklick → «Lock Tab»** sperrst, bleiben seine Panels so, wie sie sind:

| Aktion im gesperrten Tab | Was passiert |
|---|---|
| Panel schliessen | ✕-Knöpfe sind ausgeblendet. Wird trotzdem ein Panel geschlossen (z. B. per Tastenkürzel), holt dich das Plugin sofort in den gesperrten Tab zurück. |
| Neues Panel öffnen | Menüeinträge wie «Open in Another Pane» sind ausgeblendet. Kommt trotzdem ein Panel dazu, springt das Plugin zurück in den gesperrten Tab. |
| Dokument im Panel wechseln (Link anklicken) | Das Panel behält sein Dokument. Der Link öffnet sich wie in RemNote üblich im temporären Tab (Uhr-Symbol). |
| Grösse oder Anordnung der Panels ändern | Erlaubt. |

Zum Ändern des Layouts entsperrst du den Tab kurz (Rechtsklick → «Unlock»).

## Einrichten

1. **Node.js installieren** (einmalig): auf <https://nodejs.org> die Version «LTS».
2. **`plugin-starten.bat` doppelklicken.** Beim ersten Start werden die Abhängigkeiten installiert (1–2 Minuten). Danach läuft das Plugin auf `http://localhost:8080`. Das Fenster offen lassen, solange das Plugin laufen soll.
3. **In RemNote laden:** Einstellungen → **Plugins** → Reiter **Build** → **Develop from localhost** → `http://localhost:8080` → «Develop».

RemNote lädt selbst gebaute Plugins nur von `http://localhost`. Ohne Marketplace-Freigabe braucht es deshalb den lokalen Server.

## Einstellungen und Fehlersuche

Unter Einstellungen → Plugins → «Tab-Sperre für Panels»:

- **✕-Knöpfe und Panel-Menüeinträge in gesperrten Tabs ausblenden** (Standard: an)
- **Bei geschlossenem oder neuem Panel in den gesperrten Tab zurückspringen** (Standard: an)
- **Hinweis anzeigen, wenn eine Änderung blockiert wurde** (Standard: an)
- **Fehlersuche: Details in die Konsole schreiben** (Standard: aus)

Der Befehl **«Tab-Sperre: Status anzeigen»** (Suche mit Strg+K) zeigt, ob das Plugin läuft, ob du in einem normalen oder temporären Tab bist und wie viele Panels er hat.

## Wichtig zu wissen

- RemNote führt alle Plugins abgeschottet aus (kein «nativer Modus»). Das Plugin nutzt deshalb nur offizielle Schnittstellen: CSS (`registerCSS`) und die Adresse (`getURL`/`setURL`).
- Gesperrte Tabs erkennt das CSS an RemNotes Klassen `rn-tabs-tab-button--locked` und `rn-clr-background-primary`. Ein RemNote-Update kann diese Namen ändern. Wenn die ✕-Knöpfe in gesperrten Tabs plötzlich wieder sichtbar sind, liegt es wahrscheinlich daran.
- RemNote schützt das Layout eines gesperrten Tabs von sich aus, leitet Änderungen aber in einen temporären Tab um. Das Plugin verhindert diese Umleitungen und holt dich zurück.
- Getestet mit RemNote 1.28 (Webversion) im Oktober 2026.

## Entwickeln

- `src/widgets/index.tsx`: Steuerung (CSS, Ereignisse, Zurückspringen)
- `src/lib/tabsperre.ts`: reine Logik (Adresse lesen, Layouts vergleichen)
- `public/manifest.json`: Plugin-Beschreibung

Befehle:

- `npm install`: Abhängigkeiten installieren
- `npm run dev`: Entwicklungsserver auf `http://localhost:8080` (unter Windows: `plugin-starten.bat`)
- `npm run check-types`: TypeScript-Prüfung
- `npm run build`: prüft das Manifest und baut `PluginZip.zip` (für eine allfällige Einreichung im RemNote-Marketplace)

Hinweis: `repoUrl` im Manifest muss eine gültige Adresse sein, sonst lehnt RemNote das Plugin beim Laden ab.
