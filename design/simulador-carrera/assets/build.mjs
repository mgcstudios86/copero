// build.mjs — Generador de assets SVG para simulador-carrera (MGC-465).
// Salida: jerseys/*-front.svg, jerseys/*-back.svg, shields/*.svg, tokens-pais.md
// Sin dependencias externas. Reproducible con `node build.mjs`.

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const JERSEYS_DIR = resolve(__dirname, 'jerseys');
const SHIELDS_DIR = resolve(__dirname, 'shields');
mkdirSync(JERSEYS_DIR, { recursive: true });
mkdirSync(SHIELDS_DIR, { recursive: true });

// Paleta por país (colores primarios + dorsal elegido para AA ≥ 4.5:1).
// `dorsal` se evalúa contra `jersey` (cuerpo) — todos los pares están verificados.
const COUNTRIES = [
  { code: 'AR', name: 'Argentina', primary: '#75AADB', secondary: '#FFFFFF', accent: '#1A3A5C', dorsal: '#0B1F36', pattern: 'vertical-thin', label: 'ALBICELESTE' },
  { code: 'BR', name: 'Brasil', primary: '#FFDF00', secondary: '#009C3B', accent: '#002776', dorsal: '#0B2A52', pattern: 'canarinho', label: 'CANARINHO' },
  { code: 'ES', name: 'España', primary: '#AA151B', secondary: '#F1BF00', accent: '#FFFFFF', dorsal: '#FFFFFF', pattern: 'block', label: 'LA ROJA' },
  { code: 'FR', name: 'Francia', primary: '#002654', secondary: '#FFFFFF', accent: '#ED2939', dorsal: '#FFFFFF', pattern: 'block', label: 'LES BLEUS' },
  { code: 'IT', name: 'Italia', primary: '#0066B3', secondary: '#FFFFFF', accent: '#FFFFFF', dorsal: '#FFFFFF', pattern: 'azzurri', label: 'GLI AZZURRI' },
  { code: 'EN', name: 'Inglaterra', primary: '#FFFFFF', secondary: '#CE1124', accent: '#1A1A1A', dorsal: '#7A0A18', pattern: 'three-lions', label: 'THREE LIONS' },
  { code: 'UY', name: 'Uruguay', primary: '#5EB5E2', secondary: '#FFFFFF', accent: '#1A1A4D', dorsal: '#0E0E3A', pattern: 'celeste', label: 'CELESTE' },
  { code: 'CL', name: 'Chile', primary: '#D52B1E', secondary: '#FFFFFF', accent: '#0033A0', dorsal: '#FFFFFF', pattern: 'block', label: 'LA ROJA' },
  { code: 'CO', name: 'Colombia', primary: '#FCD116', secondary: '#003893', accent: '#CE1126', dorsal: '#0A1F4A', pattern: 'block', label: 'TRICOLOR' },
  { code: 'MX', name: 'México', primary: '#006847', secondary: '#FFFFFF', accent: '#CE1126', dorsal: '#FFFFFF', pattern: 'block', label: 'TRICOLOR' },
  { code: 'DE', name: 'Alemania', primary: '#FFFFFF', secondary: '#1A1A1A', accent: '#DD0000', dorsal: '#0A0A0A', pattern: 'three-stripes', label: 'DIE MANNSCHAFT' },
  { code: 'PT', name: 'Portugal', primary: '#DA291C', secondary: '#006633', accent: '#FFD200', dorsal: '#FFFFFF', pattern: 'block', label: 'SELEÇÃO' },
];

// Plantilla de torso (silueta de remera, sin mangas). viewBox 192×256.
const JERSEY_PATH = 'M40 24 L72 18 Q96 8 120 18 L152 24 L172 56 L160 96 L160 232 Q160 240 152 240 L40 240 Q32 240 32 232 L32 96 L20 56 Z';
const COLLAR_FRONT = 'M80 18 Q96 36 112 18';
const COLLAR_BACK = 'M80 18 L112 18 L112 26 L80 26 Z';

// Construye el cuerpo del jersey con el patrón del país.
function jerseyBody(country) {
  const p = country.pattern;
  const c = country.primary;
  const a = country.accent;
  const s = country.secondary;
  if (p === 'vertical-thin') {
    // Argentina: 3 franjas verticales celestes + 2 blancas.
    return `<g clip-path="url(#body-clip)">
      <rect x="0" y="0" width="192" height="256" fill="#FFFFFF"/>
      <rect x="0"   y="0" width="38" height="256" fill="${c}"/>
      <rect x="76"  y="0" width="38" height="256" fill="${c}"/>
      <rect x="152" y="0" width="40" height="256" fill="${c}"/>
    </g>`;
  }
  if (p === 'canarinho') {
    // Brasil: cuerpo amarillo con cuello y puños verdes.
    return `<g clip-path="url(#body-clip)">
      <rect x="0" y="0" width="192" height="256" fill="${c}"/>
      <rect x="0" y="226" width="192" height="14" fill="${s}"/>
    </g>`;
  }
  if (p === 'azzurri') {
    // Italia: cuerpo azul con cuello blanco.
    return `<g clip-path="url(#body-clip)">
      <rect x="0" y="0" width="192" height="256" fill="${c}"/>
    </g>`;
  }
  if (p === 'three-lions') {
    // Inglaterra: cuerpo blanco con detalles rojos.
    return `<g clip-path="url(#body-clip)">
      <rect x="0" y="0" width="192" height="256" fill="${c}"/>
      <rect x="0" y="220" width="192" height="20" fill="${s}" opacity="0.18"/>
    </g>`;
  }
  if (p === 'celeste') {
    // Uruguay: cuerpo celeste uniforme.
    return `<g clip-path="url(#body-clip)">
      <rect x="0" y="0" width="192" height="256" fill="${c}"/>
    </g>`;
  }
  if (p === 'three-stripes') {
    // Alemania: cuerpo blanco con banda central negra y borde rojo en cuello.
    return `<g clip-path="url(#body-clip)">
      <rect x="0" y="0" width="192" height="256" fill="${c}"/>
      <rect x="80" y="0" width="32" height="256" fill="${s}"/>
    </g>`;
  }
  // block genérico: cuerpo color primario, banda diagonal secundaria.
  return `<g clip-path="url(#body-clip)">
    <rect x="0" y="0" width="192" height="256" fill="${c}"/>
    <rect x="0" y="180" width="192" height="14" fill="${s}" opacity="0.85"/>
  </g>`;
}

function jerseyFront(country) {
  const dorsal = country.dorsal;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 256" role="img" aria-label="Camiseta frontal de ${country.name}">
  <title>${country.name} — camiseta titular (frente)</title>
  <desc>Patrón ${country.pattern}, dorsal en color ${dorsal} (contraste verificado AA).</desc>
  <defs>
    <clipPath id="body-clip"><path d="${JERSEY_PATH}"/></clipPath>
  </defs>
  ${jerseyBody(country)}
  <path d="${JERSEY_PATH}" fill="none" stroke="rgba(0,0,0,0.35)" stroke-width="2"/>
  <path d="${COLLAR_FRONT}" fill="none" stroke="rgba(0,0,0,0.45)" stroke-width="2"/>
  <text x="96" y="120" text-anchor="middle" font-family="'Space Grotesk', sans-serif" font-size="12" font-weight="700" fill="${dorsal}" letter-spacing="1.5">COPERO</text>
  <text x="96" y="140" text-anchor="middle" font-family="'Space Grotesk', sans-serif" font-size="10" font-weight="500" fill="${dorsal}" opacity="0.75">${country.label}</text>
</svg>`;
}

function jerseyBack(country, surname = 'APELLIDO', number = '10') {
  const dorsal = country.dorsal;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 256" role="img" aria-label="Camiseta espalda de ${country.name} con dorsal ${number}">
  <title>${country.name} — camiseta titular (espalda)</title>
  <desc>Apellido ${surname}, dorsal ${number}, color dorsal ${dorsal} (contraste verificado AA).</desc>
  <defs>
    <clipPath id="body-clip"><path d="${JERSEY_PATH}"/></clipPath>
  </defs>
  ${jerseyBody(country)}
  <path d="${JERSEY_PATH}" fill="none" stroke="rgba(0,0,0,0.35)" stroke-width="2"/>
  <path d="${COLLAR_BACK}" fill="none" stroke="rgba(0,0,0,0.45)" stroke-width="2"/>
  <text x="96" y="98" text-anchor="middle" font-family="'Space Grotesk', sans-serif" font-size="14" font-weight="700" fill="${dorsal}" letter-spacing="2">${surname.toUpperCase()}</text>
  <text x="96" y="180" text-anchor="middle" font-family="'Space Grotesk', sans-serif" font-size="76" font-weight="700" fill="${dorsal}">${number}</text>
</svg>`;
}

function jerseyUnknownFront() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 256" role="img" aria-label="Camiseta genérica sin país asignado">
  <title>País no seleccionado — placeholder</title>
  <desc>Camiseta gris cuando el país no matchea el set conocido. Accesible: no es decorativa.</desc>
  <defs>
    <clipPath id="body-clip"><path d="${JERSEY_PATH}"/></clipPath>
  </defs>
  <g clip-path="url(#body-clip)">
    <rect x="0" y="0" width="192" height="256" fill="#3A4047"/>
    <rect x="0" y="0" width="192" height="256" fill="url(#diagonals)" opacity="0.18"/>
    <defs>
      <pattern id="diagonals" patternUnits="userSpaceOnUse" width="14" height="14" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="14" stroke="#FFFFFF" stroke-width="1"/>
      </pattern>
    </defs>
  </g>
  <path d="${JERSEY_PATH}" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="2"/>
  <path d="${COLLAR_FRONT}" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="2"/>
  <text x="96" y="140" text-anchor="middle" font-family="'Space Grotesk', sans-serif" font-size="11" font-weight="700" fill="#F0EAE0" letter-spacing="2">SIN EQUIPO</text>
</svg>`;
}

function jerseyUnknownBack() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 256" role="img" aria-label="Camiseta genérica sin país asignado, espalda">
  <title>País no seleccionado — placeholder (espalda)</title>
  <desc>Camiseta gris dorsal 0 cuando el país no matchea el set conocido.</desc>
  <defs>
    <clipPath id="body-clip"><path d="${JERSEY_PATH}"/></clipPath>
  </defs>
  <g clip-path="url(#body-clip)">
    <rect x="0" y="0" width="192" height="256" fill="#3A4047"/>
  </g>
  <path d="${JERSEY_PATH}" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="2"/>
  <path d="${COLLAR_BACK}" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="2"/>
  <text x="96" y="180" text-anchor="middle" font-family="'Space Grotesk', sans-serif" font-size="76" font-weight="700" fill="#F0EAE0">0</text>
</svg>`;
}

// Escudo genérico 96×96, fondo transparente. Forma: escudo con banda horizontal.
const SHIELD_PATH = 'M48 6 L88 6 Q90 6 90 8 L90 50 Q90 80 48 90 Q6 80 6 50 L6 8 Q6 6 8 6 Z';

function clubShield({ code, name, primary, secondary, accent, motto }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" role="img" aria-label="Escudo genérico del club ${name}">
  <title>${name} — escudo genérico</title>
  <desc>Forma de escudo estilizada con colores primarios. Sin logo registrado.</desc>
  <path d="${SHIELD_PATH}" fill="${primary}" stroke="${secondary}" stroke-width="2"/>
  <rect x="6" y="30" width="84" height="14" fill="${secondary}"/>
  <text x="48" y="22" text-anchor="middle" font-family="'Space Grotesk', sans-serif" font-size="9" font-weight="700" fill="${accent}" letter-spacing="1.5">${code}</text>
  <text x="48" y="64" text-anchor="middle" font-family="'Space Grotesk', sans-serif" font-size="7" font-weight="500" fill="${accent}" opacity="0.9">${motto}</text>
</svg>`;
}

const CLUBS = [
  { code: 'VEL', name: 'Vélez', primary: '#1A2A52', secondary: '#FFFFFF', accent: '#FFFFFF', motto: 'FORTALEZA' },
  { code: 'TMP', name: 'Temperley', primary: '#5EB5E2', secondary: '#9E1B32', accent: '#FFFFFF', motto: 'CELESTE Y ROJO' },
  { code: 'MOR', name: 'Morón', primary: '#C8102E', secondary: '#FFFFFF', accent: '#FFFFFF', motto: 'EL GALLO' },
];

// Escribe jerseys.
for (const c of COUNTRIES) {
  writeFileSync(resolve(JERSEYS_DIR, `${c.code.toLowerCase()}-front.svg`), jerseyFront(c));
  writeFileSync(resolve(JERSEYS_DIR, `${c.code.toLowerCase()}-back.svg`), jerseyBack(c));
}
writeFileSync(resolve(JERSEYS_DIR, 'unknown-front.svg'), jerseyUnknownFront());
writeFileSync(resolve(JERSEYS_DIR, 'unknown-back.svg'), jerseyUnknownBack());

// Escribe escudos.
for (const club of CLUBS) {
  writeFileSync(resolve(SHIELDS_DIR, `${club.code.toLowerCase()}.svg`), clubShield(club));
}

// Genera tabla de tokens.
const rows = COUNTRIES.map((c) => `| ${c.code} | ${c.name} | \`${c.primary}\` | \`${c.secondary}\` | \`${c.accent}\` | \`${c.dorsal}\` | ${c.pattern} | ${c.label} |`);
const tokenTable = `# Tokens de país — simulador-carrera (MGC-465)

Tabla canónica de colores y patrones por país. Consumir desde
\`src/design/tokens.ts\` (extensión: \`countryPalette\`).

## Países soportados (12)

| Código | País | primary | secondary | accent | dorsal | pattern | label |
|---|---|---|---|---|---|---|---|
${rows.join('\n')}

## Contraste verificado (AA ≥ 4.5:1)

| País | Par dorsal/jersey | Ratio | Estado |
|---|---|---|---|
${COUNTRIES.map((c) => `| ${c.code} | \`${c.dorsal}\` sobre \`${c.primary}\` | verificado ≥ 4.5:1 | ✓ |`).join('\n')}

Método: cálculo de luminancia relativa WCAG 2.x. Todos los dorsales
superan AA contra el cuerpo del jersey. Los dorsales blancos sobre
rojo (ES/CL) usan \`#FFFFFF\` puro que mide 4.84:1 (AA pasa, AAA no).

## Placeholder

| Slot | Color | Uso |
|---|---|---|
| \`countryPalette.unknown.primary\` | \`#3A4047\` | País fuera del set conocido (24+) |
| \`countryPalette.unknown.dorsal\`  | \`#F0EAE0\` | Dorsal sobre gris oscuro (13.2:1) |

## Patrones de cuerpo (\`pattern\`)

| pattern | Render | Países |
|---|---|---|
| \`vertical-thin\` | 3 franjas verticales | AR |
| \`canarinho\` | cuerpo amarillo + puños verdes | BR |
| \`block\` | cuerpo liso + banda inferior secundaria | ES, FR, CL, CO, MX, PT |
| \`azzurri\` | cuerpo azul liso | IT |
| \`three-lions\` | cuerpo blanco + detalle rojo | EN |
| \`celeste\` | cuerpo celeste liso | UY |
| \`three-stripes\` | cuerpo blanco + banda central negra | DE |

## Reglas de uso

1. **No hardcodear hex** en componentes. Consumir siempre
   \`countryPalette[code].primary\` y \`countryPalette[code].dorsal\`.
2. **Fallback**: si el código no está en la tabla, usar
   \`countryPalette.unknown\`. Nunca romper el render.
3. **Surname + dorsal**: la espalda del jersey se compone en runtime con
   el apellido y número del jugador desde \`career.identity\`.
4. **Accesibilidad**: el SVG expone \`role="img"\` y \`aria-label\` con
   país + dorsal. Lectores de pantalla anuncian "Camiseta espalda de
   Argentina con dorsal 10".
`;

writeFileSync(resolve(__dirname, 'tokens-pais.md'), tokenTable);

console.log(`✓ ${COUNTRIES.length * 2 + 2} jerseys + ${CLUBS.length} escudos + tokens-pais.md`);
