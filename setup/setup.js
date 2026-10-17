#!/usr/bin/env node
// job-radar Setup-Skript
//
// Legt die vier Notion-Datenbanken (Einstellungen, Profil, Plattformen, Treffer) unter einer
// gegebenen Notion-Seite an, patcht die Workflow-Vorlagen in ../workflows/*.json mit den neuen
// Data-Source-IDs und importiert beide Workflows in eine n8n-Instanz via REST API.
//
// Benoetigt Node.js >= 18 (nutzt das eingebaute fetch). Keine externen Abhaengigkeiten.
//
// Nutzung:
//   cp setup/.env.example setup/.env   # ausfuellen
//   node setup/setup.js

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnv(file) {
  const env = {};
  if (!existsSync(file)) return env;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

const env = { ...loadEnv(path.join(__dirname, '.env')), ...process.env };

const NOTION_TOKEN = env.NOTION_TOKEN;
const NOTION_PARENT_PAGE_ID = env.NOTION_PARENT_PAGE_ID;
const N8N_BASE_URL = (env.N8N_BASE_URL || '').replace(/\/$/, '');
const N8N_API_KEY = env.N8N_API_KEY;

if (!NOTION_TOKEN || !NOTION_PARENT_PAGE_ID) {
  console.error('Fehlt: NOTION_TOKEN und/oder NOTION_PARENT_PAGE_ID in setup/.env. Siehe setup/.env.example.');
  process.exit(1);
}

const NOTION_API = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

async function notion(pathSuffix, options = {}) {
  const res = await fetch(`${NOTION_API}${pathSuffix}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${NOTION_TOKEN}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(`Notion API ${pathSuffix} -> ${res.status}: ${JSON.stringify(body)}`);
  }
  return body;
}

async function createDatabase(title, properties) {
  const db = await notion('/databases', {
    method: 'POST',
    body: JSON.stringify({
      parent: { type: 'page_id', page_id: NOTION_PARENT_PAGE_ID },
      title: [{ type: 'text', text: { content: title } }],
      properties
    })
  });
  console.log(`  -> "${title}" angelegt: ${db.id}`);
  return db.id;
}

async function main() {
  console.log('1/4 Lege Notion-Datenbanken an ...');

  const einstellungenId = await createDatabase('Einstellungen', {
    Key: { title: {} },
    Value: { rich_text: {} },
    Beschreibung: { rich_text: {} }
  });

  const profilId = await createDatabase('Profil', {
    Feld: { title: {} },
    Wert: { rich_text: {} },
    Hinweis: { rich_text: {} }
  });

  const plattformenId = await createDatabase('Plattformen', {
    Name: { title: {} },
    'Such-Query oder Feed-URL': { rich_text: {} },
    Strategie: { select: { options: [{ name: 'API' }, { name: 'RSS-native' }, { name: 'RSS-Bridge' }, { name: 'Scraping' }] } },
    'Legal-Status': { select: { options: [{ name: 'Offiziell (API)' }, { name: 'RSS inoffiziell' }, { name: 'RSS-Bridge (inoffiziell)' }, { name: 'Scraping-riskant' }] } },
    Aktiv: { checkbox: {} },
    'Letzter Lauf': { date: {} },
    Notizen: { rich_text: {} }
  });

  const trefferId = await createDatabase('Treffer', {
    Titel: { title: {} },
    Firma: { rich_text: {} },
    Link: { url: {} },
    Plattform: { relation: { database_id: plattformenId, single_property: {} } },
    'Gefunden am': { date: {} },
    'Fit-Score': { number: {} },
    Begruendung: { rich_text: {} },
    Status: { status: {} },
    'Dedup-Hash': { rich_text: {} },
    Bewerbungstext: { rich_text: {} }
  });

  try {
    await notion(`/databases/${trefferId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        properties: {
          Status: { status: { options: [{ name: 'Neu' }, { name: 'Interessant' }, { name: 'Auto-beworben' }, { name: 'Beworben' }, { name: 'Verworfen' }] } }
        }
      })
    });
  } catch (err) {
    console.warn('  Hinweis: Status-Optionen konnten nicht automatisch gesetzt werden, bitte in Notion manuell anpassen (Neu/Interessant/Auto-beworben/Beworben/Verworfen).', err.message);
  }

  console.log('\n2/4 Befuelle Einstellungen mit Default-Werten ...');
  const defaults = [
    ['fit_score_threshold', '70', 'Mindest-Fit-Score (%), ab dem automatisch die volle Bewerbung erstellt wird.'],
    ['model_scoring', 'claude-haiku', 'LLM-Modell fuer den Fit-Score-Schritt (laeuft bei jedem Treffer).'],
    ['model_bewerbung', 'claude-sonnet', 'LLM-Modell fuer die volle Bewerbungserstellung (laeuft nur ab Threshold).']
  ];
  for (const [key, value, beschreibung] of defaults) {
    await notion('/pages', {
      method: 'POST',
      body: JSON.stringify({
        parent: { database_id: einstellungenId },
        properties: {
          Key: { title: [{ text: { content: key } }] },
          Value: { rich_text: [{ text: { content: value } }] },
          Beschreibung: { rich_text: [{ text: { content: beschreibung } }] }
        }
      })
    });
  }

  console.log('\n3/4 Patche Workflow-Vorlagen mit den neuen Data-Source-IDs ...');
  const workflowsDir = path.join(__dirname, '..', 'workflows');
  const replacements = {
    REPLACE_ME_PROFIL_DATA_SOURCE_ID: profilId,
    REPLACE_ME_EINSTELLUNGEN_DATA_SOURCE_ID: einstellungenId,
    REPLACE_ME_PLATTFORMEN_DATA_SOURCE_ID: plattformenId,
    REPLACE_ME_TREFFER_DATA_SOURCE_ID: trefferId
  };

  function patch(jsonText) {
    let out = jsonText;
    for (const [placeholder, value] of Object.entries(replacements)) {
      out = out.split(placeholder).join(value);
    }
    return out;
  }

  const fitScoreRaw = patch(readFileSync(path.join(workflowsDir, 'fit-score-auto-apply.json'), 'utf8'));
  writeFileSync(path.join(workflowsDir, 'fit-score-auto-apply.local.json'), fitScoreRaw);

  let fitScoreWorkflowId = null;
  let collectorImported = false;

  if (N8N_BASE_URL && N8N_API_KEY) {
    console.log('\n4/4 Importiere Workflows in n8n ...');

    async function n8n(pathSuffix, options = {}) {
      const res = await fetch(`${N8N_BASE_URL}/api/v1${pathSuffix}`, {
        ...options,
        headers: { 'X-N8N-API-KEY': N8N_API_KEY, 'Content-Type': 'application/json', ...(options.headers || {}) }
      });
      const body = await res.json();
      if (!res.ok) throw new Error(`n8n API ${pathSuffix} -> ${res.status}: ${JSON.stringify(body)}`);
      return body;
    }

    const fitScoreWorkflow = JSON.parse(fitScoreRaw);
    const createdFitScore = await n8n('/workflows', { method: 'POST', body: JSON.stringify(fitScoreWorkflow) });
    fitScoreWorkflowId = createdFitScore.id;
    console.log(`  -> "${fitScoreWorkflow.name}" importiert: ${fitScoreWorkflowId}`);

    const collectorRaw = patch(readFileSync(path.join(workflowsDir, 'collector.json'), 'utf8'))
      .split('REPLACE_ME_FIT_SCORE_WORKFLOW_ID').join(fitScoreWorkflowId);
    writeFileSync(path.join(workflowsDir, 'collector.local.json'), collectorRaw);
    const collectorWorkflow = JSON.parse(collectorRaw);
    const createdCollector = await n8n('/workflows', { method: 'POST', body: JSON.stringify(collectorWorkflow) });
    collectorImported = true;
    console.log(`  -> "${collectorWorkflow.name}" importiert: ${createdCollector.id}`);
  } else {
    console.log('\n4/4 N8N_BASE_URL/N8N_API_KEY nicht gesetzt - Workflows wurden nur lokal gepatcht');
    console.log(`  (workflows/fit-score-auto-apply.local.json), bitte manuell in n8n importieren.`);
    console.log('  Danach collector.json manuell patchen: REPLACE_ME_FIT_SCORE_WORKFLOW_ID = ID des importierten Fit-Score-Workflows.');
  }

  console.log('\nFertig. Noch zu erledigen (manuell):');
  console.log(`  1. In Notion: die Seite/Datenbanken mit deiner n8n-Notion-Integration verbinden`);
  console.log(`     ("..." -> Connections -> Integration hinzufuegen), sonst 404 bei Notion-Nodes.`);
  console.log('  2. In n8n: In allen Notion- und Anthropic-Nodes beider Workflows deine eigenen');
  console.log('     Credentials auswaehlen (Platzhalter "REPLACE_ME" in den Node-Credentials).');
  console.log(`  3. Profil-Datenbank (${profilId}) in Notion ausfuellen.`);
  console.log(`  4. Plattformen-Datenbank (${plattformenId}) mit echten Quellen befuellen (Aktiv = true).`);
  console.log('  5. Collector-Workflow in n8n aktivieren (Schedule Trigger).');
}

main().catch((err) => {
  console.error('\nFehler:', err.message);
  process.exit(1);
});
