# job-radar

Open-Source n8n-Workflow-Paket für die persönliche Jobsuche. Jeder, der es selbst betreibt,
legt seine eigenen Kandidaten-Infos und Ziel-Plattformen in Notion ab; job-radar durchsucht diese
Plattformen (API/RSS/Scraping je nach Verfügbarkeit) und trägt passende Treffer strukturiert
in Notion ein.

**Status:** Planung — noch kein Workflow gebaut.

## Idee

- **Notion** als Datenspeicher: eigenes Profil (Skills, gesuchte Rollen, Standort/Remote, Ausschlusskriterien) +
  Liste der Ziel-Plattformen (z.B. LinkedIn, Indeed) + Ergebnis-Datenbank für gefundene Stellen.
- **n8n** holt pro Plattform neue Stellenanzeigen (Strategie je Plattform unterschiedlich: offizielle API,
  RSS-Feed oder Scraping als letztes Mittel) und schreibt Treffer in die Notion-Ergebnis-DB.
- Ziel: von jeder Person selbst hostbar, ohne Kundendaten oder fest verdrahtete Zugänge.

Architektur und Plattform-Strategie werden noch gemeinsam ausgearbeitet (siehe Issues/Notizen,
sobald vorhanden).

## Workflows (n8n)

Noch keine gebaut.

## Setup

Noch offen — folgt, sobald der Plan steht.
