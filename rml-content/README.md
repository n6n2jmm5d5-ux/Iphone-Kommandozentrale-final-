# Restaurants mit Leidenschaft – Content-Zentrale

Status: isolierter Entwicklungszweig, keine produktiven Änderungen.

## Harte Grenzen
- Keine neuen Abonnements, Käufe oder kostenpflichtigen API-Aufrufe.
- Bestehende Kommandozentrale unverändert lassen.
- Externe KI-/Video-Credits nicht automatisch verbrauchen.
- Kein Auto-Posting ohne explizite redaktionelle Freigabe.
- Restaurantkritiken ausschließlich auf Grundlage dokumentierter echter Besuche.
- Original-Logo unverändert als Bilddatei einbinden, nicht neu generieren.
- Keine API-Schlüssel im Browser.

## MVP
1. Themenpool mit Status (Idee, Recherche, Entwurf, Prüfung, Freigabe, geplant, veröffentlicht).
2. Redaktionsvorlagen für Fachbeiträge und kontroverse Hooks.
3. 1080x1920 Standbild-Reels mit 15 Sekunden Dauer, optional stumm, aus HTML/CSS-Vorlage und FFmpeg.
4. Optional längere Videos aus rechtmäßig nutzbaren Bild-/Videoclips und Sprachspur.
5. Export als MP4 + Text/Hashtags + Freigabeprotokoll.
6. Metricool-Anbindung nur für bereits genehmigte Inhalte.
7. Analytik und Themenpriorisierung anhand verfügbarer Daten.

## Technische Richtung
- Vorhandenes Node-Projekt schrittweise erweitern, ohne bestehende Funktionen zu überschreiben.
- Rendering via lokalem FFmpeg (kein bezahlter Renderdienst).
- Optional kostenlose KI-Modelle nur innerhalb tatsächlich verfügbarer Quoten.
- Alle automatisierten Schritte mit Fehlerzustand, manueller Übersteuerung und Kosten-Sperre.
- Kein Versprechen unbegrenzter kostenloser KI-Filmsequenzen.

## Nächste Umsetzungsschritte
- Bestehende App- und Auth-Struktur prüfen.
- Datenmodell, UI und Renderer als eigenständiges Modul implementieren.
- Test mit Demo-Inhalt ohne Veröffentlichung.
- Deployment erst nach Prüfung der vorhandenen Hosting-Konfiguration.
