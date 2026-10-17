# RSS-Bridge in job-radar

## Was ist RSS-Bridge und warum nutzt job-radar es?

[RSS-Bridge](https://github.com/RSS-Bridge/rss-bridge) ist ein Open-Source-PHP-Projekt
(self-hosted), das für Webseiten ohne eigenen RSS/Atom-Feed einen Feed generiert. Es bringt
eine große Sammlung fertiger "Bridges" (eine Bridge = Adapter für eine bestimmte Webseite)
mit und läuft komplett unter eigener Kontrolle (Docker-Container).

Für job-radar ist das relevant, weil viele Jobbörsen **keine offizielle API und keinen
RSS-Feed** anbieten (siehe `HANDOFF.md`, Abschnitt "Plattform-Strategie"). Die naheliegende
Alternative — eigenes Scraping direkt im n8n-Workflow — hat zwei Probleme:

- **ToS-/Account-Risiko**: Scraping von Seiten wie LinkedIn verstößt oft gegen die Nutzungs-
  bedingungen und kann zu Account-Sperrungen führen.
- **Wartungsaufwand**: Ändert sich das HTML einer Seite, muss der Scraping-Code im eigenen
  Workflow angepasst werden.

RSS-Bridge löst das nicht grundsätzlich, verschiebt es aber an eine sinnvollere Stelle:
Statt dass job-radar selbst scrapt, übernimmt eine **community-gepflegte, zentrale
Bridge-Sammlung** das Scraping, und n8n liest am Ende nur noch einen stinknormalen RSS-Feed.
Das heißt konkret:

- **Wartung zentralisiert**: Wenn sich eine Zielseite ändert, wird i. d. R. die Bridge im
  RSS-Bridge-Projekt von der Community aktualisiert — nicht der n8n-Workflow.
- **Austauschbar**: Für jede Plattform in der job-radar-Plattformen-DB lässt sich die
  Strategie unabhängig wählen (offizielle API, offizieller RSS-Feed, RSS-Bridge, oder als
  letzte Instanz eigenes Scraping).
- **Eine Instanz für alle Plattformen**: Ein einziger RSS-Bridge-Container deckt potenziell
  mehrere Jobbörsen gleichzeitig ab.

**Wichtig — Risiko bleibt bestehen, nur verschoben:** RSS-Bridge entfernt das
Scraping-Risiko nicht vollständig. Im Hintergrund ruft die jeweilige Bridge weiterhin die
Zielseite auf und parst deren HTML/JSON — das ist technisch dasselbe Scraping, nur von
RSS-Bridge statt von job-radar selbst ausgeführt. Prüfe pro Plattform trotzdem selbst die
ToS, bevor du eine Bridge dafür produktiv einsetzt. Für Plattformen mit explizitem
Scraping-Verbot (z. B. LinkedIn) ist RSS-Bridge kein Freibrief, sondern bestenfalls eine
pragmatischere, besser gewartete Variante desselben Risikos.

## Setup

### 1. RSS-Bridge starten

Im Repo-Root liegt `docker-compose.yml`, die ausschließlich den RSS-Bridge-Service startet
(n8n läuft separat, siehe Kommentar in der Datei):

```bash
docker compose up -d
```

Der Container ist danach unter `http://localhost:3000` erreichbar. Konfiguration
(`config.ini.php`) und aktivierte Bridges (`whitelist.txt`) werden im Host-Verzeichnis
`./rss-bridge-config` persistiert (Volume-Mapping auf `/config` im Container) — sie
überleben also Container-Updates und -Neustarts.

### 2. UI öffnen und Bridge aktivieren

1. Browser öffnen: `http://localhost:3000`
2. Die gewünschte Bridge in der Liste suchen (z. B. per Suchfeld), z. B. `XPathBridge`.
3. Standardmäßig ist RSS-Bridge im "Whitelist"-Modus: Nur explizit freigeschaltete Bridges
   sind aktiv/sichtbar. Beim ersten Start wird i. d. R. eine `whitelist.txt` mit einer
   Beispiel-Auswahl angelegt (liegt nach dem Start in `./rss-bridge-config/whitelist.txt`).
   Trage dort die Namen der benötigten Bridges ein (eine pro Zeile, `*` aktiviert alle —
   nicht empfohlen, da das unnötig viele selten genutzte Scraper exponiert).
4. Container neu starten oder die Whitelist-Datei direkt bearbeiten, danach Seite neu laden.
5. Bridge in der UI mit den passenden Parametern (Suchbegriff, Ort, Firma, …) konfigurieren
   und auf "Generate feed" / das RSS-Icon klicken → RSS-Bridge zeigt die generierte
   Feed-URL an (Format, Atom oder JSON wählbar).

### 3. Feed-URL in die job-radar Plattformen-DB eintragen

In der Notion-Plattformen-DB (siehe `HANDOFF.md`) für die jeweilige Plattform:

| Feld             | Wert                                                        |
|------------------|--------------------------------------------------------------|
| Name             | z. B. "LinkedIn (via RSS-Bridge)"                            |
| Strategie        | `RSS-Bridge`                                                  |
| URL/Such-Query    | die generierte Feed-URL aus RSS-Bridge (z. B. `http://<host>:3000/?action=display&bridge=XPathBridge&...&format=Atom`) |
| Legal-Status     | `RSS-inoffiziell (via RSS-Bridge)`                            |
| Aktiv-Flag       | an                                                             |

Der n8n-Workflow liest diese Feed-URL dann mit einem ganz normalen RSS-/Atom-Feed-Read-Node
ein — aus Workflow-Sicht ist eine RSS-Bridge-Feed-URL nicht anders zu behandeln als ein
offizieller RSS-Feed.

## Bereits existierende Bridges für Jobbörsen (Stand dieser Recherche)

Kurzrecherche im offiziellen Bridge-Katalog
(`https://github.com/RSS-Bridge/rss-bridge/tree/master/bridges`, ~550 Bridges insgesamt):

- **`IndeedBridge`** — existiert, liefert aber laut eigener Beschreibung **Firmen-Reviews/
  Kommentare**, nicht Stellenanzeigen. Für die eigentliche Jobsuche auf Indeed also nicht
  direkt brauchbar.
- **`GlassdoorBridge`** — existiert ebenfalls, deckt aber **Blogs und Firmen-Reviews** ab
  (z. B. "Companies Hiring"-Blogposts, Interview-Erfahrungen), keine strukturierte
  Stellensuche.
- **LinkedIn, StepStone, Xing, jobs.ch, Greenhouse, Lever, We Work Remotely**: Keine
  dedizierte Bridge im offiziellen Katalog gefunden.

Für diese Plattformen (und ähnliche) bietet RSS-Bridge aber generische Bridges, mit denen
sich ohne eigenen PHP-Code ein Feed aus einer beliebigen Webseite bauen lässt:

- **`XPathBridge`** — konfigurierbar per XPath-Selektoren auf das HTML der Zielseite
  (Titel, Link, Datum, Beschreibung je ein Selektor). Für viele Jobbörsen mit stabilem
  Such-Ergebnis-HTML eine praktikable Lösung, ohne eine eigene Bridge programmieren zu
  müssen.
- **`CssSelectorFeedExpanderBridge`** — ähnlich, nutzt CSS-Selektoren statt XPath, teils
  einfacher zu konfigurieren.

Hinweis: Für Greenhouse- und Lever-Firmenboards gibt es häufig **offene, unauthentifizierte
JSON-Endpunkte** (siehe `HANDOFF.md`) — dort ist RSS-Bridge in der Regel unnötig; diese
Plattformen sollten eher über eine eigene "API/offiziell"- oder "JSON"-Strategie direkt in
n8n abgefragt werden statt über RSS-Bridge.

Wird später eine bessere/dedizierte Bridge für eine konkrete Jobbörse bekannt oder selbst
geschrieben, bitte diese Liste aktualisieren.
