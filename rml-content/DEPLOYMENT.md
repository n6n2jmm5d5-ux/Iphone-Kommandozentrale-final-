# RML Filmproduktion: Betrieb und Grenzen

## Voraussetzungen
Node 22, FFmpeg/ffprobe, erreichbare Wikimedia-Commons-API, dauerhafter Schreibspeicher.
Keine kostenpflichtige API erforderlich. Hosting selbst kann Kosten verursachen.

## Start
Aus dem Repository: `node rml-content/server.mjs`. Die Oberfläche läuft auf
http://127.0.0.1:4177 und ist absichtlich nur lokal erreichbar.
`RML_DATA_DIR` auf ein dauerhaftes Verzeichnis setzen.
Mit Docker: `docker compose -f rml-content/compose.yaml up --build -d`.

## Öffentlicher Zugriff / iPhone
NICHT einfach Port 4177 ins Internet freigeben: Die Demo hat keine Anmeldung!
Vor öffentlichem Deployment Authentifizierung (z.B. Cloudflare Access),
TLS, Rate Limits und CSRF-Schutz vorschalten; Jobdaten sind redaktionell vertraulich.
Danach DNS und HTTPS konfigurieren und den Aufruf vom iPhone real testen.
Ein GitHub-Commit ist kein Deployment.

## API
POST /api/film {"topic":"..."} startet einen Auftrag.
GET /api/film/{id} zeigt den Zustand.
GET /api/film/{id}/video liefert den MP4-Entwurf.
GET /api/film/{id}/sources liefert Lizenzdaten.
GET /api/films listet Aufträge.
Aufträge bleiben über Neustarts auf Disk erhalten; laufende Jobs werden nach Neustart
als 'unterbrochen' markiert und müssen neu gestartet werden.

## Grenzen
Wikimedia Commons bietet keine garantierte Verfügbarkeit oder redaktionelle Eignung.
Automatische Bildinhaltsbewertung fehlt; Lizenzangaben und CC BY-SA Pflichten
vor Veröffentlichung prüfen. Kein automatisches Posting.
Original-Logo wird nicht verändert oder ohne verifizierte Datei ergänzt.
