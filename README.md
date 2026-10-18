# Tab-Sperre für Panels (RemNote-Plugin)

Wenn du einen Tab mit **Rechtsklick → «Lock Tab»** sperrst, bleiben seine Panels so, wie sie sind:

| Aktion im gesperrten Tab | Was passiert |
|---|---|
| Panel schliessen | ✕-Knöpfe sind ausgeblendet. Wird trotzdem ein Panel geschlossen (z. B. per Tastenkürzel), holt dich das Plugin sofort in den gesperrten Tab zurück. |
| Neues Panel öffnen («Open in Another Pane») | Wird blockiert, du bleibst im gesperrten Tab. |
| Dokument im Panel wechseln (Link anklicken) | Das Panel behält sein Dokument. Der Link öffnet sich wie in RemNote üblich im temporären Tab (Uhr-Symbol). |
| Grösse oder Anordnung der Panels ändern | Erlaubt. |

Zum Ändern des Layouts entsperrst du den Tab kurz (Rechtsklick → «Unlock»).

## Einrichten

1. **Node.js installieren** (einmalig): auf <https://nodejs.org> die Version «LTS».
2. **`plugin-starten.bat` doppelklicken.** Beim ersten Start werden die Abhängigkeiten installiert (1–2 Minuten). Danach läuft das Plugin auf `http://localhost:8080`. Das Fenster offen lassen, solange das Plugin laufen soll.
3. **In RemNote laden:** Einstellungen → **Plugins** → Reiter **Build** → **Develop from localhost** → `http://localhost:8080` → «Develop». Falls RemNote fragt, ob das Plugin im **nativen Modus** laufen darf: erlauben. Ohne nativen Modus kann das Plugin gesperrte Tabs nicht erkennen.

RemNote lädt selbst gebaute Plugins nur von `http://localhost`. Ohne Marketplace-Freigabe braucht es deshalb den lokalen Server.

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
- `npm run dev`: Entwicklungsserver auf `http://localhost:8080` (unter Windows: `plugin-starten.bat`)
- `npm run check-types`: TypeScript-Prüfung
- `npm run build`: prüft das Manifest und baut `PluginZip.zip` (für eine allfällige Einreichung im RemNote-Marketplace)

Hinweis: `repoUrl` im Manifest muss eine gültige Adresse sein, sonst lehnt RemNote das Plugin beim Laden ab.
