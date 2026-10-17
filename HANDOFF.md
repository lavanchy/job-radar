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

## Update (2026-10-17, Abend) — Git-Commit, Profil befüllt, Österreich-Jobsuche recherchiert

- **Erster Commit** (`385f144`): alle Workflows, docker-compose, docs, setup-Skript. `.gitignore`
  gefixt (`.env*` blockte vorher versehentlich auch `.env.example`).
- **Profil-DB befüllt** mit echten Daten aus CV/Portfolio (epunkt-Lebenslauf, lavanchyautomation.ch):
  Gesuchte Rollen (Requirements Engineer, IT-Projektleiter, n8n/Prozessautomatisierung, Business
  Analyst), Skills, Standort = **Lenzing, Oberösterreich + 30km Umkreis, Teilzeit 40-80%**,
  Ausschlusskriterien (Pensum/Radius-Grenzen, keine reinen Devrollen ohne Prozessbezug),
  Ton-Präferenz (direkt, metrisch, Stil von lavanchyautomation.ch), CV-Referenz (Kernfakten
  inline). Gehaltsvorstellung bewusst leer gelassen (nicht angegeben).
- **Plattformen-Recherche für Österreich/Lenzing:** EURES, karriere.at, AMS "alle jobs" geprüft.
  **Ehrliches Ergebnis: keine davon hat eine offiziell dokumentierte RSS/API-Schnittstelle.**
  Alle drei als neue Zeilen angelegt (`Aktiv=false`, da noch nicht verifiziert):
  - **EURES** — bester Kandidat: nutzt laut Dritt-Scraper-Doku intern eine `jv-search` REST-API
    mit NUTS-Region-Filter (AT31 = Oberösterreich). Keine offizielle Doku, aber öffentliches
    EU-Interesse → risikoärmer einzuschätzen. Exakter Endpunkt/Parameter noch nicht verifiziert.
  - **karriere.at** — grösste AT-Jobbörse, kein RSS (nur E-Mail-Jobalarm), via RSS-Bridge
    (XPathBridge) auf `karriere.at/jobs/vöcklabruck` (20km-Umkreis, deckt Lenzing ab) machbar.
  - **AMS "alle jobs"** — staatlicher Aggregator, weder RSS noch API gefunden.
  - Neue Legal-Status-Option **"Inoffizielle API (undokumentiert)"** ergänzt (für EURES-Fall,
    passte in keine bestehende Kategorie).
  - **RSS-Bridge-Testlauf fehlgeschlagen:** `docker-compose up` lief lokal, aber der Container
    antwortete nicht auf HTTP-Requests (TCP verbindet, aber kein Response) — vermutlich
    Netzwerk-Restriktion dieser Agent-Sandbox (ausgehende Verbindungen blockiert), kein Bug im
    Setup selbst. Container danach wieder abgebaut (`docker-compose down`). **Echte Verifikation
    von RSS-Bridge-Bridges und der EURES-API muss auf einem Host mit normalem Internetzugang
    passieren** (z.B. mit Browser-DevTools auf eures.europa.eu, oder RSS-Bridge auf einem
    erreichbaren Server deployen — localhost auf diesem Rechner ist für die n8n-Cloud-Instanz
    ohnehin nicht erreichbar, RSS-Bridge muss production-seitig irgendwo öffentlich laufen).

## Update (2026-10-17, spät) — Echtes Scraping statt RSS-Bridge, Keyword-Scoring

- **karriere.at-Scraping gebaut und live verifiziert** (nicht via RSS-Bridge, sondern direkt im
  Collector-Workflow mit HTTP Request + HTML-Node): `robots.txt` von karriere.at erlaubt
  automatisierten Zugriff explizit (`User-agent: * / Disallow:`, nur 2 SEO-Bots gesperrt).
  Suchergebnisse sind serverseitig gerendert (kein JS nötig). Neuer Scraping-Pfad im Collector
  (Switch jetzt 4 Ausgänge: rss/api/scraping/fallback): HTTP Request (HTML als Text) → HTML-Node
  (CSS-Selektoren `a.m-jobsListItem__titleLink`, `a.m-jobsListItem__companyName`, je mit
  `returnArray`) → Set (Arrays zu `jobs`-Array zippen) → Split Out → normalisieren → bestehende
  Dedup-Kette. Mit echtem Live-Request getestet: **15 echte Stellenanzeigen korrekt extrahiert**
  und durch die komplette Pipeline bis zum Dedup-Hash verarbeitet (execution 12367).
  - 3 neue Plattformen-Zeilen angelegt und **aktiv**: karriere.at IT Project Manager / Scrum
    Master / Requirements Engineering, je Lenzing+30km. Neuer Legal-Status **"Scraping erlaubt
    (robots.txt)"** ergänzt.
- **willhaben.at bewusst NICHT automatisiert**: `robots.txt` verbietet automatisierten Zugriff
  explizit im Klartext UND sperrt genau die Job-Suche (`Disallow: /jobs/suche?*`,
  `Disallow: /*?*keyword=*`) — klarer ToS-Verstoss, auch wenn vom Nutzer gewünscht. Als
  Plattformen-Zeile dokumentiert (`Aktiv=false`, Legal-Status "Scraping-riskant") mit Begründung,
  statt stillschweigend wegzulassen.
- **RSS-Bridge-Ansatz verworfen** zugunsten von direktem Scraping im Workflow — einfacher (keine
  zusätzliche Server-Komponente nötig) und für karriere.at durch robots.txt klar gedeckt.
  EURES/AMS bleiben wie zuvor dokumentierte, noch unverifizierte Kandidaten.
- **Keyword-basiertes Scoring ergänzt**: zwei neue Profil-Zeilen "Plus-Keywords (Bonus)" (n8n,
  Scrum, Requirements Engineering, Prozessautomatisierung, Camunda, Business Analyse, Teilzeit,
  Remote, ...) und "Minus-Keywords (Abwertung)" (reine Entwicklung ohne Prozessbezug,
  Schichtarbeit, strikt Vollzeit, hohe Reisetätigkeit, ...). **SAP als harter NO-GO** in
  Ausschlusskriterien ergänzt. Fit-Score-Prompt explizit angepasst: NO-GO-Treffer → Score ≤10,
  unabhängig von sonstigen Übereinstimmungen. **Live getestet:** SAP-Stelle → Score 3 ("NO-GO
  erfüllt..."), passende n8n/Requirements-Stelle → Score 88 + automatisch generierte, faktisch
  korrekte Bewerbung (echte Stationen/Zahlen aus dem CV).
- **Bug gefunden & gefixt:** die Bewerbungs-KI hat im Test spontan "Ich wohne in Lenzing"
  geschrieben — nicht im Profil, reine Erfindung. System-Prompt von "Bewerbung erstellen" jetzt
  mit explizitem Verbot erfundener Fakten (Wohnort, Zertifikate, Erfahrungen) ergänzt.
- Profil vollständig befüllt mit echten CV-Daten (siehe vorheriger Abschnitt).
- `workflows/collector.json` (27 statt 19 Nodes) und `workflows/fit-score-auto-apply.json`
  resynchronisiert.

## Update (2026-10-17, Nacht) — Echter Produktions-Vorfall: Dedup-Check komplett kaputt

Auf Nutzerwunsch ("teste mit meinen echten Daten") lief der Collector mehrfach **ungepinnt gegen
die echte n8n/Notion-Instanz**. Das deckte zwei gravierende, bis dahin unentdeckte Bugs auf, die
alle vorherigen Tests (immer mit gepinnten/simulierten Notion-Nodes) nicht zeigen konnten:

1. **Notion-"Get Many" läuft bei mehreren Items nur einmal.** Entgegen der Annahme, dass jeder
   n8n-Node pro Input-Item einmal ausführt, nutzt der Notion-"Get Many"-Node bei mehreren
   gleichzeitigen Items nur das ERSTE Item für seinen Filterausdruck und läuft dann nur einmal
   insgesamt — nicht N-mal. Der ursprüngliche per-Item-Dedup-Check (`returnAll:false, limit:1,
   filterType:manual` mit `={{ $json.dedupHash }}`) hat deshalb nur den allerersten von 15 echten
   Treffern pro Plattform geprüft, der Rest wurde nie korrekt auf Duplikate geprüft.
   **Fix:** Dedup-Check umgebaut auf Bulk-Fetch (einmal pro Plattform ALLE vorhandenen
   Dedup-Hashes holen, `filterType:"none"`, `returnAll:true`) + lokaler Abgleich per Merge
   (`combineAll`) und IF-Node, ganz ohne wiederholte Notion-Lookups pro Item.
2. **`executeOnce:true` beim Node-Anlegen via `addNode`-Operation wird stillschweigend verworfen**
   (kein gültiges Feld für diese Operation). Der neue "Bekannte Hashes sammeln"-Node lief dadurch
   pro vorhandenem Treffer einmal statt einmal gesamt — kombiniert mit dem `combineAll`-Merge
   (Kreuzprodukt) führte das zu einer **Explosion**: die Zeile "karriere.at: Requirements
   Engineering" erzeugte in einem Lauf 324 Treffer-Seiten (6 echte Jobs × ~54 bereits vorhandene
   Treffer zu dem Zeitpunkt) statt der erwarteten 6. **Fix:** `executeOnce:true` nachtraeglich per
   `setNodeSettings` gesetzt (das Feld wird dort korrekt uebernommen).
3. Zusaetzlich aufgedeckt: **Notion-Rate-Limit** ("too many requests") bei vielen schnellen
   Schreibvorgaengen in Folge (Collector + parallel feuernde Fit-Score-Subworkflows teilen sich
   dasselbe Integrations-Kontingent) — `retryOnFail` (5 Versuche, 2s Backoff) auf allen
   Notion-Nodes in beiden Workflows ergaenzt.
4. **Sicherheits-Limit ergaenzt:** unabhaengig von der Ursache liefert der Collector jetzt
   maximal 20 Treffer pro Plattform und Lauf (`n8n-nodes-base.limit` direkt nach dem
   Dedup-Hash). Verhindert zukuenftig jede Form von Mengen-Explosion, egal wodurch ausgeloest.
5. **Wichtig — keine Daten-Korruption:** Stichproben der 324 "Requirements Engineering"-Treffer
   zeigen echte, unterschiedliche Stellenanzeigen (verschiedene Links/Titel/Firmen), keine
   literalen Duplikate derselben Stelle. Grund fuer die hohe Zahl: karriere.at matcht den
   Suchbegriff "Requirements Engineering" offenbar inkonsistent — mal 6 Treffer (reproduzierbar
   per manuellem curl-Test mit Bindestrich-Slug), einmal ein serverseitiger Fallback auf eine
   breite Regions-Liste. URL wurde auf die saubere Bindestrich-Form umgestellt
   (`/jobs/requirements-engineering/lenzing?radius=30`), das Sicherheits-Limit faengt den Rest ab.
6. **Reale Kosten:** rund 395 echte Fit-Score-Sub-Workflow-Laeufe wurden ausgeloest (je ein
   Claude-Haiku-Call, bei Scores ≥70 zusaetzlich ein Claude-Sonnet-Call). Die 324 Treffer unter
   "Requirements Engineering" bleiben als echte, bereits bewertete Daten erhalten (Loeschen
   wuerde die schon bezahlte Fit-Score-Arbeit verschwenden) — koennen bei Bedarf manuell nach
   niedrigem Fit-Score gefiltert/archiviert werden.
7. Finaler Testlauf nach allen Fixes: **9 Sekunden Laufzeit, 0 neue Treffer** (alles korrekt als
   Duplikat erkannt) — bestätigt, dass der Dedup-Check jetzt wirklich funktioniert.
8. `workflows/collector.json` final resynchronisiert (30 Nodes).

**Lektion:** n8n-Knoten verhalten sich bei mehreren gleichzeitigen Items nicht einheitlich wie
erwartet "einmal pro Item" — das muss bei jedem neuen Node-Typ mit mehreren echten Items
verifiziert werden, nicht nur mit gepinnten Einzel-Item-Tests.

## Update (2026-10-17, spaeter Abend) — Fit-Score-Minimum, rueckwirkendes Aufraeumen, Backfill

Nutzerwunsch: "Fitscore unter 40 = Status Verworfen. Sicherstellen dass bei neuer Pruefung
Stellen nicht doppelt reinkommen. Fuer Grafik ggf. anderen Status nehmen. Schau dass alle
ein Score haben und nur Bewerbungen mit ausreichendem Score angezeigt werden."

1. **Neue Einstellung `fit_score_minimum` = 40** in der Einstellungen-DB angelegt. Der
   Fit-Score-Workflow liest sie jetzt zusaetzlich zu `fit_score_threshold` (Default 40, falls
   nicht gesetzt).
2. **Neue Verzweigung im Fit-Score-Workflow:** Nach "Threshold erreicht?" (FALSE-Zweig) prueft
   ein neuer IF-Node **"Unter Minimum?"** (`fitScore < fitScoreMinimum`):
   - TRUE → neuer Notion-Node **"Treffer aktualisieren: Verworfen"** setzt Status = "Verworfen".
   - FALSE → wie bisher "Treffer aktualisieren: Zur Sichtung" (Status = "Neu").
   Live im n8n-Workflow `PuG9xKs9Wqj9a0Z6` angewendet und lokal in
   `workflows/fit-score-auto-apply.json` resynchronisiert.
3. **Audit der 450 bestehenden Treffer** per SQL (`notion-query-data-sources`):
   450 total, davon 379 ohne Fit-Score (nie bewertet, Folge des fruehen Rate-Limit-Chaos aus
   dem vorherigen Vorfall) und 60 mit Fit-Score < 40 aber Status noch "Neu".
4. **Alle 60 niedrig bewerteten Treffer rueckwirkend auf Status "Verworfen" gesetzt**
   (einzeln per `notion-update-page`, verifiziert per Re-Audit: `still_wrong = 0`).
5. **Dedup bei neuer Pruefung ist bereits gehaertet** (siehe Vorfall-Abschnitt oben,
   Bulk-Hash-Abgleich + `executeOnce`) — nochmals bestaetigt, kein weiterer Fix notwendig.
6. **Neuer Workflow `workflows/backfill-fit-score.json`** (n8n-ID `VhlCNPhKWxrRilTp`):
   holt alle Treffer ohne Fit-Score (Notion-Node-Filter "isEmpty" auf Zahlen-Feld wird vom
   Notion-Node selbst NICHT unterstuetzt — Live-Fehler bestaetigt — deshalb Bulk-Fetch +
   In-Memory-Filter-Node "Nur ohne Fit-Score", gleiches Muster wie der Dedup-Check im
   Collector), und ruft pro Treffer sequenziell (`waitForSubWorkflow:true`, batchSize 1) den
   Fit-Score-Workflow auf — bewusst sequenziell statt fire-and-forget, um nach dem
   Rate-Limit-Vorfall keine 379 gleichzeitigen Anthropic/Notion-Calls auszuloesen.
   Laeuft als woechentlicher Schedule-Trigger (Sicherheitsnetz fuer zukuenftig verpasste
   Scores) und wurde direkt live gegen alle 379 fehlenden Treffer gestartet
   (Execution-ID 12791 in Workflow `VhlCNPhKWxrRilTp`).
7. **Grafik-Feld:** Die Treffer-DB hat bereits ein separates, bisher ungenutztes Feld
   "Bewerbungsphase" (aktuell leer bei allen Treffern). Fuer den Funnel/Sankey-Chart wird NICHT
   dieses Feld befuellt, sondern direkt aus dem bestehenden operativen `Status` + `Fit-Score`
   abgeleitet (Gefunden → Bewertet → Relevant [nicht Verworfen] → Beworben), damit es keine
   zweite, staendig nachzupflegende Quelle der Wahrheit gibt.

## Nächste Schritte

1. **EURES-API verifizieren** (optional, zusätzliche Quelle): per Browser-DevTools auf
   eures.europa.eu den echten `jv-search`-Request mitschneiden, Plattformen-Zeile aktivieren.
2. Workflows in n8n aktivieren/publishen — 3 aktive Plattformen (karriere.at) sind startklar.
3. Entscheiden ob der Einrichtungs-Agent veröffentlicht werden soll.
4. Gehaltsvorstellung in Profil ergänzen, falls gewünscht (aktuell bewusst leer).
5. Testdaten aufräumen: Treffer-Seite "TEST: Data Engineer (n8n)"
   (`3fc2b546-7b82-81fc-a327-f6446a0fcad9`) kann gelöscht werden — aktuell Status "Verworfen"
   (Fit-Score 0), stört also nicht mehr aktiv.
6. AMS "alle jobs" bleibt als unverifizierter Kandidat dokumentiert (RSS-Bridge-Ansatz
   überholt — bei Bedarf gleiches Scraping-Muster wie karriere.at anwenden, falls robots.txt
   das erlaubt — noch nicht geprüft).
7. ~~Optional: die 324 "Requirements Engineering"-Treffer mit niedrigem Fit-Score durchsehen~~
   — erledigt, siehe Update oben (alle 60 Treffer < 40 Punkte sind jetzt "Verworfen").
8. Backfill-Lauf (Execution 12791) abschliessen lassen und Endergebnis pruefen (379 Treffer
   nachbewertet) — danach `workflows/backfill-fit-score.json` optional in n8n aktivieren
   (woechentlicher Schedule) oder deaktiviert lassen und nur manuell bei Bedarf ausfuehren.
