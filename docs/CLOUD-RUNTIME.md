# Cloud Runtime – Kommandozentrale

## Verbindliches Ziel

Die Kommandozentrale wird vom iPhone bedient und muss bei ausgeschaltetem PC reale Aufträge ausführen, Ergebnisse dauerhaft speichern und auf dem iPhone wieder anzeigen. Der PC ist kein Bestandteil des normalen Runtime-Pfads.

## Ausgangspunkt

Branch `cloud-runtime` basiert auf dem funktionierenden Stand von `main` (Ausbaublock 2). Der bestehende lokale `codex exec`-Pfad bleibt auf `main` unangetastet, bis der Cloud-Pfad Ende-zu-Ende bewiesen ist.

## Vorgesehener Cloud-Pfad

1. iPhone/PWA sendet Auftrag an den gehosteten Backend-Dienst.
2. Nutzer autorisiert einmalig `Continue with ChatGPT` mit ChatGPT-Plan-Nutzung.
3. Backend hält OAuth-/Refresh-Credentials ausschließlich serverseitig und gibt sie niemals an die PWA aus.
4. Backend führt die AI-Arbeit über einen unterstützten ChatGPT-Plan-Pfad aus. Für Codex-Werkzeugausführung wird `codex app-server` mit dem autorisierten Access Token verwendet.
5. Auftrag, Status und Ergebnis werden in persistentem Cloud-Speicher abgelegt.
6. PWA liest Status und fertiges Ergebnis über die bestehende Auftrags-/Ablage-Oberfläche.

## Sicherheits- und Funktionsregeln

- Keine OpenAI-API-Keys vom Nutzer verlangen.
- Keine simulierten Ergebnisse oder Erfolgsmeldungen.
- Ein Auftrag ist nur `done`, wenn ein reales Ergebnis vorliegt und gespeichert wurde.
- OAuth-Tokens niemals in Repository, Logs oder Browser-Storage schreiben.
- Schreibende Werkzeugaktionen behalten das bestehende Freigabeprinzip.
- Lokale Dateien eines ausgeschalteten PCs sind nicht verfügbar; benötigte Eingaben müssen zuvor cloudseitig vorliegen.
- `main` erst umstellen, wenn iPhone -> Cloud -> reales Ergebnis -> persistente Ablage getestet wurde.

## Aktuell zu implementieren

- SIWC/OAuth-Start + Callback + Refresh serverseitig.
- Cloud-Ausführungsadapter statt lokaler Benutzeranmeldung.
- Persistenter Task-/Result-Store statt Render-Dateisystem.
- Ergebnisabruf über bestehende `/api/tasks`-Schnittstelle.
- Ende-zu-Ende-Test ohne lokale PC-Komponenten.
