# job-radar — Handoff

Diese Datei ist der Einstiegspunkt für die nächste Session in diesem Projekt. Einfach in
Claude Code öffnen und weitermachen.

## Was ist job-radar?

Open-Source n8n-Workflow-Paket für die persönliche Jobsuche. Jeder, der es selbst betreibt,
legt sein eigenes Profil und seine Ziel-Plattformen in Notion ab; job-radar durchsucht diese
Plattformen (API/RSS/Scraping je nach Verfügbarkeit) und trägt passende Treffer strukturiert
in eine Notion-Ergebnis-DB ein.

Analog zum Dawood-Pilot (Notion + n8n, Bundesagentur-Suche für einen Kunden), aber generalisiert:
kein Kundenprojekt, sondern für Dritte zum Selbst-Hosten gedacht.

## Stand (2026-10-17)

- Projekt angelegt: `~/projects/job-radar/`, lokales Git-Repo (`main`, kein Remote), MIT-Lizenz,
  `.gitignore`, `workflows/` (leer).
- Entscheidung: technischer Unterbau = **reines n8n-Workflow-Paket** (nicht Standalone-Skript/CLI,
  nicht Hybrid) — reuse von bestehendem n8n+Notion-Know-how, auch wenn das für Fremdnutzer eine
  eigene n8n-Instanz voraussetzt.
- Noch kein einziger Workflow gebaut. User-Wunsch: **erst den Plan ausarbeiten, dann bauen.**

## Vorschlag Notion-Struktur (noch nicht final)

- **Profil** (1 Seite): Skills, gesuchte Rollen, Standort/Remote-Präferenz, Ausschlusskriterien,
  Gehaltsvorstellung
- **Plattformen** (DB): Name, URL/Such-Query, Strategie (API/RSS/Scraping), Aktiv-Flag, letzter Lauf
- **Treffer** (DB): Titel, Firma, Link, Plattform, gefunden am, Status (Neu/Interessant/Verworfen/
  Beworben), Dedup-Hash

## Plattform-Strategie — der heikle Teil

- **LinkedIn**: keine offene Such-API (Talent-API nur für Partner), Scraping verstößt gegen die
  ToS → Account-Sperrrisiko. Realistische Optionen: Google-Alerts/RSS-Umweg über
  `site:linkedin.com/jobs`, oder bewusst auslassen.
- **Indeed**: offizielle Publisher-API ist seit Jahren für Neuanmeldungen geschlossen; inoffizielle
  RSS-Feeds für Suchanfragen haben in der Vergangenheit funktioniert, Verlässlichkeit müsste
  aktuell erst geprüft werden.
- Robustere, ToS-saubere Alternativen je nach Zielregion: Arbeitsagentur-API (wie bei Dawood, aber
  DE-spezifisch), jobs.ch-API (CH), RSS-Feeds genereller Jobbörsen, Greenhouse/Lever-Boards
  einzelner Firmen (haben oft offene JSON-Endpunkte).

## Offene Fragen — hier weitermachen

1. **Plattformen:** Nur LinkedIn/Indeed wie ursprünglich genannt, oder gleich erweiterbar bauen
   (Config-Tabelle statt Hardcoding, damit später mehr Plattformen dazukommen)?
2. **Datenquellen-Transparenz:** Pro Plattform sauber dokumentieren was (noch) legal/stabil geht,
   und unsichere Quellen (z.B. Scraping) explizit kennzeichnen statt stillschweigend einzubauen?
   Für ein Open-Source-Tool für Dritte wegen Haftung/Nutzer-Risiko wichtig.
3. **HITL-Freigabe:** Wie bei Dawood einen Freigabeschritt einbauen (z.B. Telegram/Notion-Status
   vor Weiterverarbeitung), oder reicht reines Sammeln in der Treffer-DB?
4. **Setup für Fremdnutzer:** Reicht eine gute README + Notion-Template-Duplizierungslink +
   `.env.example`, oder soll es ein Setup-Skript geben?

Sobald diese vier Punkte geklärt sind, kann der erste Workflow gebaut werden.
