# Kostenlose KI-Anbindung

Ziel: keine separat kostenpflichtige OpenAI- oder Anthropic-API verwenden.

## ChatGPT / Arbeitsmaschine

Der vorgesehene offizielle Weg ist **Sign in with ChatGPT** mit ChatGPT-Plan-Nutzung. Open-Source-Anwendungen können damit berechtigte Anfragen über das vorhandene ChatGPT-Kontingent ausführen, ohne einen eigenen API-Schlüssel zu hinterlegen.

Für die Kommandozentrale gilt:
- keine API-Schlüssel im Repository
- keine Tokens in localStorage
- `store: false` und `stream: true` bei späteren Responses-Anfragen
- Zugangsdaten nur in geschütztem Runtime-Speicher
- keine automatische Umstellung auf kostenpflichtige API-Nutzung

Die aktuelle Render-Instanz ist ein entfernter Host. Der Open-Source-OAuth-Ablauf verwendet für die Erstanmeldung einen lokalen Loopback-Callback (`127.0.0.1`). Für eine Remote-VM sieht OpenAI vor, OAuth lokal abzuschließen und die geschützten Zugangsdaten anschließend sicher auf die VM zu übertragen. Da dieses Projekt iPhone-only betrieben wird und keine lokale CLI/SSH-Umgebung voraussetzen soll, wird dieser Schritt nicht durch einen unsicheren Browser-Token-Workaround ersetzt.

## Claude / einfache Aufgaben

Ein kostenloses Claude-Webkonto ist kein kostenloser Claude-Code/API-Zugang. Claude Code unterstützt laut Anthropic Claude-App-Anmeldung mit Pro/Max oder Console-Zugang mit aktiver Abrechnung. Deshalb wird für den kostenlosen Claude-Account keine Server-API vorgetäuscht.

## Aktueller Sicherheitszustand

`/api/ai-status` meldet transparent, welcher KI-Pfad tatsächlich verbunden ist. Solange ChatGPT OAuth nicht sicher eingerichtet ist, bleibt `connected: false`. Die Kommandozentrale kann weiterhin ihre kostenlosen lokalen Werkzeuge (Node/Python/Git/FFmpeg, soweit auf dem Host vorhanden) nutzen.
