// Consolida la exploración en tree-arbol-decision.json + genera diagrama Mermaid + tree-arbol-decision.md.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = '/Users/matiasgonzalocalvo/.paperclip/instances/default/projects/5f4a6c8a-cec3-48de-bf5c-5bb8a96f9b2c/529fd29c-0df0-4556-8944-56ce675b7f4f/_default';
const GRAPH = JSON.parse(readFileSync(join(ROOT, 'design/simulador-carrera/_graph-final.json'), 'utf8'));
const PARTIALS_DIR = join(ROOT, 'design/simulador-carrera/evidence/partials');

// Helpers
function classifyScreen(text, buttons) {
  const t = (text || '').slice(0, 600);
  const btnTxt = buttons.map((b) => (b.text || '').toLowerCase()).join('|');
  if (/Construí tu carrera futbol[ií]stica/.test(t) && /Intensa|Normal|Expr[eé]s/.test(t)) return 'SPLASH';
  if (/Nacionalidad/.test(t) && /Alemania|Argentina|B[eé]lgica/.test(t)) return 'NATIONALITY';
  if (/Identidad/.test(t) && /APELLIDO/.test(t)) return 'IDENTITY';
  if (/Posici[oó]n/.test(t) && /\b(EI|DC|ED|MI|MCO|MD|LI|MC|LD|MCD|DFC|POR)\b/.test(t)) return 'POSITION';
  if (/Oferta de cantera/.test(t)) return 'OFFER_YOUTH';
  if (/Salida a pr[eé]stamo/.test(t)) return 'LOAN_OFFER';
  if (/Regreso a tu club/.test(t)) return 'RETURN_PARENT';
  if (/OVR.*Edad.*VALOR|VALOR.*Edad.*CLUB/.test(t)) return 'DASHBOARD';
  if (/Resumen de carrera|logros finales|Retiro/.test(t)) return 'CAREER_END';
  return 'UNKNOWN';
}

// Build node catalog
const catalog = GRAPH.nodes.map((n) => {
  const btns = (n.buttons || []).map((b) => b.text).filter(Boolean);
  const imgs = (n.images || []).map((i) => i.src || i.alt).filter(Boolean);
  return {
    id: n.id,
    label: n.label,
    type: classifyScreen(n.text || '', n.buttons || []),
    occurrences: n.occurrences,
    url: n.url,
    firstSeen: n.firstSeen,
    textSnippet: (n.text || '').slice(0, 400),
    buttons: btns,
    images: imgs,
  };
});

// Aggregate by type
const byType = {};
catalog.forEach((n) => {
  if (!byType[n.type]) byType[n.type] = [];
  byType[n.type].push(n);
});

// Extract all unique countries, positions, clubs, events
const countries = new Set();
const positions = new Set();
const clubs = new Set();
const eventTypes = new Set();
const ages = new Set();

catalog.forEach((n) => {
  const t = n.textSnippet;
  // countries — extract after "Eligiendo club"
  const countryMatch = t.match(/\b(Argentina|Brasil|España|Francia|Italia|Inglaterra|Alemania|México|Portugal|Países Bajos|Colombia|Chile|Uruguay|Estados Unidos|Bélgica|Bolivia|Canadá|Croacia|Ecuador|Paraguay|Perú|Rusia|Turquía|Venezuela)\b/g);
  countryMatch?.forEach((c) => countries.add(c));
  // positions
  const posMatch = t.match(/\b(EI|DC|ED|MI|MCO|MD|LI|MC|LD|MCD|DFC|POR)\b/g);
  posMatch?.forEach((p) => positions.add(p));
  // clubs seen in buttons
  n.buttons.forEach((b) => {
    const m = (b || '').match(/Fichar por\s+([\wÀ-ÿ\s]+?)\s*\n/);
    if (m) clubs.add(m[1].trim());
  });
  // ages from dashboard
  const ageMatch = t.match(/\b(1[6-9]|2[0-9]|3[0-9])\b/g);
  ageMatch?.forEach((a) => ages.add(a));
  // event types
  if (n.type === 'OFFER_YOUTH') eventTypes.add('Oferta de cantera');
  if (n.type === 'LOAN_OFFER') eventTypes.add('Salida a préstamo');
  if (n.type === 'RETURN_PARENT') eventTypes.add('Regreso a tu club');
});

// Build tree-arbol-decision.json
const treeJson = {
  meta: {
    source: 'https://copero.com.ar/juegos/simulador-carrera',
    capturedBy: 'qa-agent',
    runs: ['G-AR-DC-CALVO', 'H-BR-POR-NEYMAR', 'I-ES-MCO-LAMINE', 'J-IT-ED-TOTTI', 'K-FR-MC-MBAPPE', 'L-EN-LI-BECKHAM'],
    totalRuns: 6,
    viewport: 'mobile 375x812',
    locale: 'es-AR',
    capturedAt: new Date().toISOString(),
  },
  summary: {
    nodes: catalog.length,
    edges: GRAPH.edges.length,
    assets: GRAPH.assets.length,
    screenshots: readdirSync(join(ROOT, 'design/simulador-carrera/evidence/original')).length,
    screenTypes: Object.fromEntries(Object.entries(byType).map(([k, v]) => [k, v.length])),
    countries: Array.from(countries).sort(),
    positions: Array.from(positions).sort(),
    clubsObserved: Array.from(clubs).sort(),
    eventTypes: Array.from(eventTypes),
    agesObserved: Array.from(ages).sort((a, b) => +a - +b),
  },
  nodes: catalog,
  edges: GRAPH.edges,
  assets: GRAPH.assets,
  flow: {
    SPLASH: {
      description: 'Pantalla inicial con 3 modos (Intensa/Normal/Exprés) y CTA "Comenzar carrera".',
      options: [
        { id: 'Intensa', effect: '1 decisión por temporada, inmersión profunda.' },
        { id: 'Normal', effect: 'Decisiones cada 2 temporadas, una experiencia equilibrada.' },
        { id: 'Exprés', effect: 'Decisiones cada 3 temporadas para disfrutarlo rápido.' },
      ],
    },
    NATIONALITY: {
      description: 'Selector de país de origen. 24+ países visibles + "VER MÁS" para expandir.',
      options: Array.from(countries).sort(),
    },
    IDENTITY: {
      description: 'Pantalla de identidad con APELLIDO (texto), NÚMERO (default 10), PIERNA HÁBIL (Izquierda/Derecha).',
      fields: [
        { name: 'Apellido', type: 'text', placeholder: 'Apellido' },
        { name: 'Número', type: 'number', default: 10 },
        { name: 'Pierna hábil', type: 'choice', options: ['Izquierda', 'Derecha'] },
      ],
    },
    POSITION: {
      description: 'Selector de posición. 12 roles en grid 4×3 o lista.',
      options: Array.from(positions).sort(),
    },
    DASHBOARD: {
      description: 'Pantalla principal con stats del jugador: OVR, Edad, Valor, Club, historial de carrera, eventos pendientes.',
      variables: ['OVR', 'Edad', 'Valor (€)', 'Club', 'PJ', 'GLS', 'AST', 'GR', 'VI', 'Posición', 'País', 'Número camiseta'],
    },
    OFFER_YOUTH: {
      description: 'Evento de oferta de cantera: 3 clubes quieren ficharte.',
      choices: ['Fichar por [Club A] [Liga]', 'Fichar por [Club B] [Liga]', 'Fichar por [Club C] [Liga]'],
    },
    LOAN_OFFER: {
      description: 'Evento de salida a préstamo: tu club actual te manda a un destino para sumar minutos.',
      choices: ['Préstamo en [Club A] [Liga]', 'Préstamo en [Club B] [Liga]', 'Préstamo en [Club C] [Liga]'],
    },
    RETURN_PARENT: {
      description: 'Regreso al club propietario tras préstamo: elegí tu próximo destino.',
      choices: ['Préstamo en [Club A] [Liga]', 'Préstamo en [Club B] [Liga]', 'Fichar por [Club C] [Liga]'],
    },
    CAREER_END: {
      description: 'Fin de carrera (no observado aún en las 6 corridas; pendiente verificar con corridas más largas hasta edad 35+).',
      hypothesized: true,
    },
  },
};

writeFileSync(join(ROOT, 'design/simulador-carrera/tree-arbol-decision.json'), JSON.stringify(treeJson, null, 2));

// Generar Mermaid
const mermaid = [
  '```mermaid',
  'flowchart TD',
  '  classDef screen fill:#FAF7F2,stroke:#1F6F4A,stroke-width:2px,color:#16201A',
  '  classDef event fill:#C73E2A22,stroke:#C73E2A,color:#16201A',
  '  classDef decision fill:#1F6F4A22,stroke:#1F6F4A,color:#16201A',
  '  classDef endNode fill:#1F6F4A,stroke:#1F6F4A,color:#FFFFFF',
  '  S[SPLASH: Construí tu carrera futbolística<br/>Modos: Intensa / Normal / Exprés]:::screen',
  '  N[NATIONALITY: Seleccionar país de origen<br/>~24 países visibles + VER MÁS]:::screen',
  '  I[IDENTITY: Apellido + Número + Pierna hábil<br/>Default #10, opciones Izq/Der]:::screen',
  '  P[POSITION: Elegir posición<br/>12 roles: EI DC ED MI MCO MD LI MC LD MCD DFC POR]:::screen',
  '  D1[DASHBOARD inicial<br/>OVR=50 Edad=16 Valor=€100K Club=Libre]:::screen',
  '  EY{EVENTO: Oferta de cantera<br/>3 clubes quieren ficharte}:::event',
  '  LO{EVENTO: Salida a préstamo<br/>3 destinos para sumar minutos}:::event',
  '  RP{EVENTO: Regreso a tu club<br/>Elegí próximo destino}:::event',
  '  D2[DASHBOARD con carrera activa<br/>stats crecen cada temporada]:::screen',
  '  CE([FIN DE CARRERA / RETIRO<br/>OVR final + logros]):::endNode',
  '  S -->|Continuar| N',
  '  N -->|Continuar| I',
  '  I -->|Continuar| P',
  '  P -->|Confirmar identidad| D1',
  '  D1 --> EY',
  '  EY -->|Fichar por Club A| D2',
  '  EY -->|Fichar por Club B| D2',
  '  EY -->|Fichar por Club C| D2',
  '  D2 -->|cada 2 temporadas (Normal)| LO',
  '  LO -->|Préstamo Club A| D2',
  '  LO -->|Préstamo Club B| D2',
  '  LO -->|Préstamo Club C| D2',
  '  D2 -->|fin del préstamo| RP',
  '  RP -->|Préstamo Club A| D2',
  '  RP -->|Préstamo Club B| D2',
  '  RP -->|Fichar Club C| D2',
  '  D2 -->|edad 35-39| CE',
  '```',
].join('\n');

writeFileSync(join(ROOT, 'design/simulador-carrera/_mermaid.txt'), mermaid);

console.log(`NODES=${catalog.length} TYPES=${Object.keys(byType).length} COUNTRIES=${countries.size} POSITIONS=${positions.size} CLUBS=${clubs.size}`);
console.log('TYPES:', JSON.stringify(Object.fromEntries(Object.entries(byType).map(([k,v])=>[k,v.length]))));
console.log('CLUBS:', Array.from(clubs).slice(0, 30).join(' | '));
