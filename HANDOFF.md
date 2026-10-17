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

## Entscheidungen (2026-10-17) — vorherige offene Fragen geklärt

1. **Plattformen:** erweiterbar via Config-Tabelle (Notion-DB), kein Hardcoding im Workflow.
   Neue Plattformen (jobs.ch, Arbeitsagentur, Greenhouse/Lever-Boards, ...) werden als Zeile
   ergänzt, nicht als Workflow-Änderung.
2. **Datenquellen-Transparenz:** jede Plattform in der Config-Tabelle bekommt ein Feld
   **Legal-Status** (z.B. API/offiziell, RSS-inoffiziell, Scraping-riskant). README warnt
   zusätzlich explizit vor ToS-Risiken bei riskanten Quellen.
3. **HITL-Freigabe → erweiterter Scope:** job-radar bewertet jeden Treffer mit einem
   **Fit-Score** gegen das Nutzerprofil. Ab einem konfigurierbaren **Threshold (Default 70%)**
   läuft automatisch die volle Bewerbungserstellung (Motivationsschreiben etc.); darunter
   bleibt der Treffer in der Treffer-DB mit Status "Neu" zur manuellen Entscheidung. Der
   Threshold liegt in der Config, nicht im Workflow-Code.
4. **Setup für Fremdnutzer:** zusätzliches Setup-Skript (neben README + Notion-Template-Link),
   das Teile des Setups automatisiert (z.B. Notion-DB-Anlage via API, Workflow-Import).
5. **Generizität der Bewerbungslogik:** von Anfang an generisch gebaut — Bewerbungstexte
   werden ausschließlich aus den Notion-Profildaten des jeweiligen Nutzers erzeugt
   (Skills, Ziele, Ton, Ausschlusskriterien), kein Hardcoding auf eine bestimmte Person.
6. **LLM-Anbindung:** n8n-native LangChain-Nodes (Chat-Model-Credential austauschbar, nicht
   fest auf einen Provider verdrahtet). Zweistufig wegen unterschiedlicher Laufhäufigkeit:
   - **Fit-Score** (läuft bei jedem Treffer): günstiges/schnelles Modell, Default-Empfehlung
     Claude Haiku.
   - **Volle Bewerbungserstellung** (läuft nur ab Threshold, selten): stärkeres Modell,
     Default-Empfehlung Claude Sonnet.
   Beide Modelle sind in der Config hinterlegt und pro Nutzer austauschbar.
7. **RSS-Erzeugung für Quellen ohne eigenen Feed:** job-radar integriert **RSS-Bridge**
   (Open-Source, PHP, self-hosted) als Lösung für Plattformen ohne offizielle API/RSS (löst
   insbesondere das LinkedIn-Problem aus der Plattform-Strategie oben — statt riskantem
   Scraping nutzt man eine RSS-Bridge-"Bridge" für die Seite, falls eine existiert, oder baut
   eine eigene).
   - Wird als **docker-compose.yml mitgeliefert**, nicht nur dokumentiert — Setup-Skript
     bringt RSS-Bridge gleich mit hoch.
   - In der Plattformen-DB wird "RSS-Bridge" eine eigene Strategie-Option (neben
     API/RSS-native/Scraping), mit der generierten Feed-URL als Such-Query.
   - **Einrichtungs-Agent** zum Konfigurieren neuer Quellen/Bridges, **primär als n8n Agent**
     (first-class, via n8n-mcp): führt den Nutzer konversationell durchs Hinzufügen einer
     Plattform — prüft ob offizielle API/RSS existiert, hilft sonst eine passende
     RSS-Bridge-Bridge zu finden/konfigurieren, trägt das Ergebnis in die Plattformen-DB ein.
     Zusätzlich eine **Doku/Skill-Anleitung** als Fallback für Nutzer ohne n8n-Agent-Setup.

## Gebaut (2026-10-17) — erste funktionierende Version

**Notion-Struktur** (Workspace "Lavanchy Automation" → 🔧 Projekte & Anforderungen → job-radar,
`https://app.notion.com/p/3fc2b5467b8281eca273da688dfd5f1f`): Einstellungen, Profil, Plattformen,
Treffer als vier Datenbanken angelegt, Einstellungen mit Defaults befüllt (`fit_score_threshold=70`,
`model_scoring=claude-haiku`, `model_bewerbung=claude-sonnet`), Plattformen mit drei Beispielzeilen
(jobs.ch, LinkedIn via RSS-Bridge, Greenhouse). Zusätzlich Eintrag im Lavanchy-Anforderungs-Register
angelegt (Projekt-Tag "Sonstiges").

**n8n-Workflows** (Instanz `https://n8n.srv1259734.hstgr.cloud`, beide als Draft/inaktiv):
- `job-radar: Collector` (`agdANx8DSgzTAtfr`) — Schedule alle 6h, Plattformen-Loop, Strategie-Routing
  (RSS-native/RSS-Bridge → RSS Feed Read; API/Scraping → HTTP Request), Normalisierung, Dedup-Hash,
  Dedup-Check, Create-Treffer, startet pro neuem Treffer den Fit-Score-Workflow (fire-and-forget).
- `job-radar: Fit-Score & Auto-Apply` (`PuG9xKs9Wqj9a0Z6`) — holt Treffer+Profil+Einstellungen,
  Claude Haiku ermittelt Fit-Score+Begründung (structured output), ab Threshold erstellt Claude
  Sonnet automatisch ein Motivationsschreiben → Status "Auto-beworben", sonst Status "Neu".
- Beide mit `test_workflow`/echten Testläufen validiert: echter RSS-Feed (Hacker News) erfolgreich
  durchlaufen, echter Anthropic-Aufruf lieferte plausiblen Fit-Score (92) und ein gutes,
  metrisch fundiertes Motivationsschreiben.
- Exportierte Vorlagen (mit `REPLACE_ME`-Platzhaltern für Credentials/Data-Source-IDs) liegen in
  `workflows/collector.json` und `workflows/fit-score-auto-apply.json`.

**RSS-Bridge-Integration:** `docker-compose.yml` (Image `rssbridge/rss-bridge:latest`) +
`docs/rss-bridge.md`. Erkenntnis aus der Recherche: dedizierte Job-Bridges (Indeed, Glassdoor)
decken keine Stellensuche ab — realistische Lösung sind `XPathBridge`/`CssSelectorFeedExpanderBridge`
pro Zielseite; Greenhouse/Lever brauchen gar keine Bridge (offene JSON-Endpunkte, Strategie "API").

**Einrichtungs-Agent:** n8n Agent `job-radar: Plattform-Einrichtung` (`Lb0Jnai3So7rRq5E`) angelegt,
validiert und getestet (`call_agent`) — reagiert bei jobs.ch korrekt vorsichtig (kein offizieller
Feed bekannt, ToS-Risiko erkannt, fragt nach fehlenden Angaben statt zu raten). **Noch nicht
veröffentlicht** (Draft) — Veröffentlichung braucht explizite Freigabe.

**Setup-Skript:** `setup/setup.js` (Node ≥18, keine Dependencies) legt die vier Notion-DBs per API
an, befüllt Einstellungen, patcht die Workflow-Vorlagen mit den neuen IDs und importiert beide
Workflows in eine n8n-Instanz via REST API. `.env`-Vorlage: `setup/.env.example`.

## Bekannter Blocker — noch zu klären

Die n8n-Notion-Credential "Notion account" (Integration "n8n Social Media") hat **keinen Zugriff**
auf die neu angelegten job-radar-Notion-Seiten (die wurden über eine andere Integration erstellt).
Ein Testlauf von "Fit-Score & Auto-Apply" schlug deshalb beim Notion-Update mit 404
("Could not find page ... Make sure the relevant pages and databases are shared with your
integration") fehl. **Fix:** in Notion die job-radar-Seite öffnen → "..." → "Connections" →
die Integration hinzufügen, die zur n8n-Credential "Notion account" gehört. Danach den Testlauf
wiederholen (Treffer-Seite `3fc2b546-7b82-81fc-a327-f6446a0fcad9`, Titel "TEST: Data Engineer
(n8n)", ist noch als Status "Neu" unverändert — kann als Test-Fixture bleiben oder gelöscht werden).

## Update (2026-10-17, später) — Blocker gefixt, Code-Review, Härtung

- **Notion-Integration-Zugriff gefixt** (siehe Blocker oben): Testlauf mit echtem Notion-Write
  erfolgreich (`execution 12344`) — Treffer-Seite korrekt aktualisiert (Fit-Score=0, da Profil
  damals noch leer war — Begründung des LLM war korrekt: "Profil ist leer, kein Fit bestimmbar").
- **Code-Review durchgeführt** (`/code-review`, Effort medium) auf den Diff. Fand einen
  **kritischen Bug**: "Batch abschliessen" (Collector) nutzte `mode: combine, combineBy: combineAll`
  (= Kreuzprodukt) statt `append` für den Heartbeat-Merge. Bei 0 neuen Treffern (der Normalfall
  nach dem ersten Lauf!) ergibt 0×1=0 Items → die SplitInBatches-Schleife bekommt keinen Puls und
  bleibt stehen, sobald eine Plattform in einem Durchlauf nichts Neues findet.
  **Gefixt:** `mode: append`. Mit `test_workflow` verifiziert (zwei Plattformen, RSS-Feed-Node auf
  `[]` gepinnt → Schleife läuft jetzt trotzdem bis "Alle Plattformen verarbeitet" durch).
- **Zweiter Fund** (aus eigener Analyse beim Testen, nicht vom Review-Tool): weder
  `RSS/RSS-Bridge Feed lesen` noch `API/Scraping-Quelle abfragen` hatten Error-Handling — ein
  einzelner toter Feed/API-Endpunkt hätte den **gesamten** Collector-Lauf abgebrochen (alle
  anderen Plattformen in diesem Durchlauf übersprungen). **Gefixt:** `onError:
  continueErrorOutput` + Retry (2 Versuche) auf beiden Nodes, Fehler-Pfad führt über neue NoOp-
  Nodes ("RSS-Fehler - ueberspringen" / "HTTP-Fehler - ueberspringen") zurück in die Schleife.
  Mit echter kaputter Domain verifiziert (`execution 12348`) — Lauf bricht nicht mehr ab.
- **Dritter Fund** (Fit-Score-Workflow, eigene Analyse): wenn Profil- oder Einstellungen-DB leer
  wäre (z.B. direkt nach DB-Anlage, bevor Defaults geschrieben sind), hätte `Kontext
  zusammenfuehren` (combineByPosition) 0 Items geliefert und die ganze Bewertung wäre lautlos
  ausgefallen. **Gefixt:** `alwaysOutputData: true` auf `Get Profil Raw` / `Get Einstellungen Raw`.
  Mit leeren DBs verifiziert (`execution 12351`) — Workflow liefert jetzt sauberen Fallback
  (Threshold=70, Score=0 mit nachvollziehbarer Begründung) statt zu verschwinden.
- Eine vierte Review-Meldung (Format Profil/Format Einstellungen würden wegen `$input.all()` pro
  Input-Item dupliziert emittieren) wurde durch echte Ausführungsdaten **widerlegt** — `executeOnce:
  true` kollabiert korrekt auf genau 1 Output-Item (in `execution 12335` empirisch bestätigt).
- Zusätzlich verifiziert: Duplikat-Erkennung überspringt korrekt ohne neuen Treffer anzulegen
  (`execution 12349`), unbekannte Strategie routet korrekt in den Fallback (`execution 12350`),
  Create+Sub-Workflow-Trigger-Pfad funktioniert nach dem Merge-Fix weiterhin (`execution 12352`).
- `workflows/collector.json` und `workflows/fit-score-auto-apply.json` mit allen Fixes
  resynchronisiert.
- **Notion-README** als Unterseite unter der job-radar-Seite angelegt
  (`https://app.notion.com/p/3fc2b5467b82812094e6f24a34bb4931`) — Kurzanleitung für jeden, der
  diese Notion-Vorlage öffnet oder dupliziert (Setup-Checkliste, was in welche DB gehört).

## Nächste Schritte

1. Beide Workflows in n8n aktivieren/publishen, sobald du bereit bist (aktuell bewusst inaktiv).
2. Entscheiden ob der Einrichtungs-Agent veröffentlicht werden soll.
3. Plattformen-DB mit echten, für Loïc relevanten Quellen befüllen (aktuell nur Beispielzeilen).
4. Profil-DB mit echten Angaben ausfüllen (aktuell nur Platzhalter/Hinweise) — wichtig, sonst
   bleibt der Fit-Score bei 0 (siehe Testlauf oben).
5. Optional: HTTP/API-Normalisierung pro echter Plattform verfeinern (aktuell generische
   Best-Guess-Feldnamen, siehe README "Bekannte Grenzen").
6. Testdaten aufräumen: Treffer-Seite "TEST: Data Engineer (n8n)"
   (`3fc2b546-7b82-81fc-a327-f6446a0fcad9`) kann gelöscht werden, sobald nicht mehr als
   Test-Fixture gebraucht.
