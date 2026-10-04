# Verbindliche Sicherheitsregeln

## Regel 1 – Zugangsdaten ausschließlich serverseitig

Zugangsdaten, Secrets, OAuth-Tokens, Refresh-Tokens, API-Schlüssel, private Schlüssel und vergleichbare Authentifizierungsdaten dürfen ausschließlich in dafür vorgesehenem serverseitigem Secret-/Credential-Speicher verarbeitet und gespeichert werden.

Sie dürfen niemals:

- im iPhone-Browser, Web Storage, IndexedDB, Service Worker Cache oder sonstigem clientseitigem Speicher abgelegt werden;
- in das Git-Repository, Commits, Branches, Issues, Pull Requests oder andere versionierte Dateien geschrieben werden;
- in Logs, Fehlermeldungen, Debug-Ausgaben oder an den Client ausgelieferte API-Antworten gelangen;
- als Behelfslösung in Quellcode, Konfigurationsdateien oder öffentliche Umgebungen eingebettet werden.

## Regel 2 – Niemals umgehen

Diese Sicherheitsregel darf für Entwicklung, Tests, Fehlersuche, Zeitersparnis oder zur Umgehung technischer Einschränkungen niemals abgeschwächt oder umgangen werden.

Wenn eine Funktion ohne Verletzung dieser Regel nicht implementiert oder ausgeführt werden kann, muss die Funktion stoppen bzw. fehlschlagen. Es darf kein unsicherer Fallback verwendet werden.

## Regel 3 – Gilt für die gesamte Kommandozentrale

Diese Regeln gelten für alle heutigen und zukünftigen Komponenten der Kommandozentrale, insbesondere ChatGPT/OpenAI, Codex, Claude, Supabase, Cloudflare R2, Hosting, OAuth und weitere spätere Integrationen.

Neue Implementierungen müssen nach dem Fail-Closed-Prinzip arbeiten: Fehlt ein sicherer serverseitiger Credential-Pfad, findet keine authentifizierte Ausführung statt.
