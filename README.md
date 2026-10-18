# Tab-Sperre für Panels (RemNote-Plugin)

Wenn du einen Tab mit **Rechtsklick → «Lock Tab»** sperrst, bleiben seine Panels so, wie sie sind:

| Aktion im gesperrten Tab | Was passiert |
|---|---|
| Panel schliessen | ✕-Knöpfe sind ausgeblendet. Wird trotzdem ein Panel geschlossen (z. B. per Tastenkürzel), holt dich das Plugin sofort in den gesperrten Tab zurück. |
| Neues Panel öffnen («Open in Another Pane») | Wird blockiert, du bleibst im gesperrten Tab. |
| Dokument im Panel wechseln (Link anklicken) | Das Panel behält sein Dokument. Der Link öffnet sich wie in RemNote üblich im temporären Tab (Uhr-Symbol). |
| Grösse oder Anordnung der Panels ändern | Erlaubt. |

Zum Ändern des Layouts entsperrst du den Tab kurz (Rechtsklick → «Unlock»).

## Installieren

RemNote → Einstellungen → **Plugins** → Reiter **Build** → **Develop from localhost** → diese Adresse eingeben:

```
https://joenupower.github.io/remnote-tab-sperre/
```

Falls RemNote fragt, ob das Plugin im **nativen Modus** laufen darf: erlauben. Ohne nativen Modus kann das Plugin gesperrte Tabs nicht erkennen.

Die Plugin-Dateien liegen auf GitHub Pages (Branch `gh-pages`). Ein lokaler Server ist dafür nicht nötig.

## Einstellungen und Fehlersuche

Unter Einstellungen → Plugins → «Tab-Sperre für Panels»:

- **✕-Knöpfe der Panels in gesperrten Tabs ausblenden** (Standard: an)
- **Hinweis anzeigen, wenn eine Änderung blockiert wurde** (Standard: an)
- **Fehlersuche: Details in die Konsole schreiben** (Standard: aus)

Der Befehl **«Tab-Sperre: Status anzeigen»** (Suche mit Strg+K) zeigt, ob der aktuelle Tab als gesperrt erkannt wird und wie viele Panels er hat.

## Wichtig zu wissen

- Die Plugin-Schnittstelle von RemNote kennt keine Tabs. Das Plugin liest deshalb RemNotes interne Tab-Liste (Browser-Speicher «tabs») und die Tab-Leiste. Ein RemNote-Update kann das ändern. Wenn die Sperre plötzlich nicht mehr greift, zuerst den Status-Befehl ausprobieren.
- Getestet mit der RemNote-Webversion im Oktober 2026.

## Entwickeln

- `src/widgets/index.tsx`: Steuerung (Ereignisse, CSS, Zurückspringen, Wiederherstellen)
- `src/lib/tabsperre.ts`: reine Logik (Adresse lesen, Tab-Liste lesen, Layouts vergleichen)
- `public/manifest.json`: Plugin-Beschreibung (`requestNative: true`)

Befehle:

- `npm install`: Abhängigkeiten installieren
- `npm run dev`: Entwicklungsserver auf `http://localhost:8080` (`plugin-starten.bat` unter Windows). Achtung: Die RemNote-Desktop-App blockiert den Zugriff auf `localhost`. Der lokale Server funktioniert nur mit RemNote im Browser, und der Browser muss den Zugriff aufs lokale Netzwerk erlauben.
- `npm run check-types`: TypeScript-Prüfung
- Veröffentlichen: `NODE_ENV=production npx webpack` baut nach `dist/`. Den Inhalt von `dist/` (plus eine leere Datei `.nojekyll`) in den Branch `gh-pages` legen.
