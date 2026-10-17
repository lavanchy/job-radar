# job-radar

Open-Source n8n-Workflow-Paket für die persönliche Jobsuche. Jeder, der es selbst betreibt,
legt sein eigenes Profil und seine Ziel-Plattformen in Notion ab; job-radar durchsucht diese
Plattformen (API / RSS / RSS-Bridge / Scraping je nach Verfügbarkeit), bewertet jeden Treffer
mit einem LLM-Fit-Score gegen das Profil und erstellt ab einem konfigurierbaren Threshold
automatisch die volle Bewerbung (Motivationsschreiben etc.).

**Status:** Erste funktionierende Version gebaut und getestet (Notion-Struktur, zwei n8n-Workflows,
RSS-Bridge-Integration, Einrichtungs-Agent). Siehe [HANDOFF.md](HANDOFF.md) für den vollen Verlauf.

## Architektur

- **Notion** als Datenspeicher und Konfigurationsoberfläche: vier Datenbanken —
  **Einstellungen** (Fit-Score-Threshold, Modelle), **Profil** (Rollen, Skills, Präferenzen,
  Ausschlusskriterien), **Plattformen** (Config-Tabelle der Quellen, mit Legal-Status-Kennzeichnung)
  und **Treffer** (gefundene Stellen inkl. Fit-Score, Begründung, Status, generierter Bewerbungstext).
- **n8n** mit zwei Workflows (siehe unten) + optional **RSS-Bridge** (self-hosted, Docker) für
  Plattformen ohne eigenen Feed.
- **LLM (Anthropic Claude, austauschbar)**: günstiges Modell für den Fit-Score (läuft bei jedem
  Treffer), stärkeres Modell nur für die volle Bewerbungserstellung (läuft selten, ab Threshold).
- Ziel: von jeder Person selbst hostbar, ohne Kundendaten oder fest verdrahtete Zugänge auf eine
  bestimmte Person. Die Bewerbungslogik liest ausschließlich aus den eigenen Notion-Profildaten.

## Workflows (n8n)

Vorlagen liegen in [workflows/](workflows/) als importierbare JSON-Dateien:

- **`collector.json`** — "job-radar: Collector". Läuft alle 6 Stunden, holt aktive Plattformen aus
  Notion, routet pro Plattform auf RSS/RSS-Bridge-Feed-Lesen oder generischen HTTP-Request (API/
  Scraping), normalisiert die Treffer, dedupt gegen die Treffer-DB (Hash aus Plattform + Link) und
  legt neue Treffer an. Pro neuem Treffer wird der Fit-Score-Workflow angestoßen (fire-and-forget).
- **`fit-score-auto-apply.json`** — "job-radar: Fit-Score & Auto-Apply". Holt Treffer + Profil +
  Einstellungen, lässt ein günstiges Modell (Default: Claude Haiku) einen Fit-Score (0-100) mit
  Begründung ermitteln. Ab dem konfigurierten Threshold erstellt ein stärkeres Modell (Default:
  Claude Sonnet) automatisch ein Motivationsschreiben und setzt den Treffer-Status auf
  "Auto-beworben"; darunter bleibt der Status "Neu" zur manuellen Sichtung.

Beide Workflows wurden mit echten Testläufen validiert (u.a. ein echter RSS-Feed und ein echter
LLM-Aufruf, der ein plausibles Motivationsschreiben erzeugt hat).

### Bekannte Grenzen (bewusst für v1)

- Die generische HTTP/API-Normalisierung (`API/Scraping normalisieren`) rät gängige Feldnamen
  (title/name/company/url/...) — bei den meisten echten APIs musst du dieses Set-Node-Mapping pro
  Plattform anpassen, da JSON-Strukturen stark variieren.
- `RSS-Bridge`-Bridges mit verschachtelten/JS-gerenderten Seiten liefern ggf. kein brauchbares
  HTML für `XPathBridge`/`CssSelectorFeedExpanderBridge` — siehe [docs/rss-bridge.md](docs/rss-bridge.md).

## RSS-Bridge (für Plattformen ohne eigenen Feed)

Für Quellen ohne offizielle API/RSS (klassisches Beispiel: LinkedIn) liefert dieses Repo eine
`docker-compose.yml` für [RSS-Bridge](https://github.com/RSS-Bridge/rss-bridge). Details, Setup und
welche Bridges sich für Jobbörsen anbieten: [docs/rss-bridge.md](docs/rss-bridge.md).

```bash
docker compose up -d
# UI unter http://localhost:3000 — Bridge whitelisten, Feed-URL generieren,
# dann als Plattform mit Strategie "RSS-Bridge" in Notion eintragen.
```

## Einrichtungs-Agent (n8n Agent)

Ein n8n Agent **"job-radar: Plattform-Einrichtung"** hilft konversationell beim Hinzufügen neuer
Plattformen: er schätzt ein, ob eine offizielle API/RSS existiert, schlägt sonst eine RSS-Bridge-
Konfiguration vor oder markiert die Quelle explizit als rechtlich riskant, und legt die Zeile in
der Plattformen-Datenbank an. Aktuell als Draft in der n8n-Instanz angelegt (noch nicht
veröffentlicht). Alternativ: die Plattformen-Zeilen direkt in Notion von Hand anlegen.

## Setup für Fremdnutzer

1. **Notion-Struktur duplizieren** (oder mit [`setup/setup.js`](setup/setup.js) automatisiert
   neu anlegen — Node.js ≥ 18, keine Dependencies):
   ```bash
   cp setup/.env.example setup/.env   # NOTION_TOKEN, NOTION_PARENT_PAGE_ID, N8N_BASE_URL, N8N_API_KEY eintragen
   node setup/setup.js
   ```
   Das Skript legt die vier Datenbanken an, befüllt Einstellungen mit Defaults, patcht die
   Workflow-Vorlagen mit den neuen Data-Source-IDs und importiert beide Workflows in n8n (falls
   `N8N_BASE_URL`/`N8N_API_KEY` gesetzt sind).
2. **Notion-Integration verbinden:** die neue Seite/Datenbanken in Notion mit deiner Integration
   verbinden ("..." → Connections → Integration hinzufügen) — sonst schlagen alle Notion-Node-
   Aufrufe in n8n mit 404 fehl.
3. **Credentials in n8n setzen:** in allen Notion- und Anthropic-Nodes beider Workflows deine
   eigenen Credentials auswählen (Platzhalter `REPLACE_ME`).
4. **Profil ausfüllen** (Rollen, Skills, Präferenzen, Ausschlusskriterien, CV-Referenz).
5. **Plattformen eintragen** (manuell oder über den Einrichtungs-Agent), `Aktiv` setzen.
6. **Collector-Workflow aktivieren** (Schedule Trigger in n8n).
7. Optional: **RSS-Bridge** per `docker-compose.yml` hochfahren für Quellen ohne eigenen Feed.

## Lizenz

MIT, siehe [LICENSE](LICENSE).
