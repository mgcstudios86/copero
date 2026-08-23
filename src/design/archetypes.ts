/**
 * Paleta de arquetipos — Copero (MGC-322).
 *
 * 13 colores categoricos. 27 arquetipos mapean a estos 13 colores.
 * Sin contenido con copyright del original.
 *
 * Cada color expone escala (50..900) para usos sutiles (chips, badges,
 * fondos suaves) y un valor `solid` para la silueta principal del SVG.
 */

export type ArchetypeColorName =
  | 'red'
  | 'rose'
  | 'purple'
  | 'violet'
  | 'orange'
  | 'zinc'
  | 'blue'
  | 'yellow'
  | 'lime'
  | 'teal'
  | 'cyan'
  | 'emerald'
  | 'indigo';

export type ArchetypeColorScale = {
  50: string;
  100: string;
  200: string;
  300: string;
  400: string;
  500: string;
  600: string;
  700: string;
  800: string;
  900: string;
  solid: string;
  onSolid: string;
};

export type ArchetypePalette = Record<ArchetypeColorName, ArchetypeColorScale>;

const scale = (
  stops: [number, string][],
  solid: string,
  onSolid = '#FFFFFF',
): ArchetypeColorScale => {
  const out = {} as ArchetypeColorScale;
  for (const [k, v] of stops) {
    (out as Record<number, string>)[k] = v;
  }
  out.solid = solid;
  out.onSolid = onSolid;
  return out;
};

export const archetypePalette: ArchetypePalette = {
  red: scale(
    [
      [50, '#FEF2F2'], [100, '#FEE2E2'], [200, '#FECACA'], [300, '#FCA5A5'],
      [400, '#F87171'], [500, '#EF4444'], [600, '#DC2626'], [700, '#B91C1C'],
      [800, '#991B1B'], [900, '#7F1D1D'],
    ],
    '#DC2626',
  ),
  rose: scale(
    [
      [50, '#FFF1F2'], [100, '#FFE4E6'], [200, '#FECDD3'], [300, '#FDA4AF'],
      [400, '#FB7185'], [500, '#F43F5E'], [600, '#E11D48'], [700, '#BE123C'],
      [800, '#9F1239'], [900, '#881337'],
    ],
    '#E11D48',
  ),
  purple: scale(
    [
      [50, '#FAF5FF'], [100, '#F3E8FF'], [200, '#E9D5FF'], [300, '#D8B4FE'],
      [400, '#C084FC'], [500, '#A855F7'], [600, '#9333EA'], [700, '#7E22CE'],
      [800, '#6B21A8'], [900, '#581C87'],
    ],
    '#9333EA',
  ),
  violet: scale(
    [
      [50, '#F5F3FF'], [100, '#EDE9FE'], [200, '#DDD6FE'], [300, '#C4B5FD'],
      [400, '#A78BFA'], [500, '#8B5CF6'], [600, '#7C3AED'], [700, '#6D28D9'],
      [800, '#5B21B6'], [900, '#4C1D95'],
    ],
    '#7C3AED',
  ),
  orange: scale(
    [
      [50, '#FFF7ED'], [100, '#FFEDD5'], [200, '#FED7AA'], [300, '#FDBA74'],
      [400, '#FB923C'], [500, '#F97316'], [600, '#EA580C'], [700, '#C2410C'],
      [800, '#9A3412'], [900, '#7C2D12'],
    ],
    '#EA580C',
  ),
  zinc: scale(
    [
      [50, '#FAFAFA'], [100, '#F4F4F5'], [200, '#E4E4E7'], [300, '#D4D4D8'],
      [400, '#A1A1AA'], [500, '#71717A'], [600, '#52525B'], [700, '#3F3F46'],
      [800, '#27272A'], [900, '#18181B'],
    ],
    '#52525B',
  ),
  blue: scale(
    [
      [50, '#EFF6FF'], [100, '#DBEAFE'], [200, '#BFDBFE'], [300, '#93C5FD'],
      [400, '#60A5FA'], [500, '#3B82F6'], [600, '#2563EB'], [700, '#1D4ED8'],
      [800, '#1E40AF'], [900, '#1E3A8A'],
    ],
    '#2563EB',
  ),
  yellow: scale(
    [
      [50, '#FEFCE8'], [100, '#FEF9C3'], [200, '#FEF08A'], [300, '#FDE047'],
      [400, '#FACC15'], [500, '#EAB308'], [600, '#CA8A04'], [700, '#A16207'],
      [800, '#854D0E'], [900, '#713F12'],
    ],
    '#CA8A04',
    '#1F1500',
  ),
  lime: scale(
    [
      [50, '#F7FEE7'], [100, '#ECFCCB'], [200, '#D9F99D'], [300, '#BEF264'],
      [400, '#A3E635'], [500, '#84CC16'], [600, '#65A30D'], [700, '#4D7C0F'],
      [800, '#3F6212'], [900, '#365314'],
    ],
    '#65A30D',
  ),
  teal: scale(
    [
      [50, '#F0FDFA'], [100, '#CCFBF1'], [200, '#99F6E4'], [300, '#5EEAD4'],
      [400, '#2DD4BF'], [500, '#14B8A6'], [600, '#0D9488'], [700, '#0F766E'],
      [800, '#115E59'], [900, '#134E4A'],
    ],
    '#0D9488',
  ),
  cyan: scale(
    [
      [50, '#ECFEFF'], [100, '#CFFAFE'], [200, '#A5F3FC'], [300, '#67E8F9'],
      [400, '#22D3EE'], [500, '#06B6D4'], [600, '#0891B2'], [700, '#0E7490'],
      [800, '#155E75'], [900, '#164E63'],
    ],
    '#0891B2',
  ),
  emerald: scale(
    [
      [50, '#ECFDF5'], [100, '#D1FAE5'], [200, '#A7F3D0'], [300, '#6EE7B7'],
      [400, '#34D399'], [500, '#10B981'], [600, '#059669'], [700, '#047857'],
      [800, '#065F46'], [900, '#064E3B'],
    ],
    '#059669',
  ),
  indigo: scale(
    [
      [50, '#EEF2FF'], [100, '#E0E7FF'], [200, '#C7D2FE'], [300, '#A5B4FC'],
      [400, '#818CF8'], [500, '#6366F1'], [600, '#4F46E5'], [700, '#4338CA'],
      [800, '#3730A3'], [900, '#312E81'],
    ],
    '#4F46E5',
  ),
};

/**
 * 27 arquetipos del juego.
 * Cada uno mapea a uno de los 13 colores categoricos.
 * Nombres genericos (sin contenido con copyright).
 */
export type ArchetypeKey =
  | 'explorador' | 'sonador' | 'mistico' | 'visionario'
  | 'aventurero' | 'constructor' | 'estratega' | 'sabio'
  | 'naturalista' | 'sanador' | 'comunicador' | 'guardian'
  | 'filosofo' | 'artista' | 'erudito' | 'poeta'
  | 'bromista' | 'artesano' | 'navegante' | 'lider'
  | 'jardinero' | 'medico' | 'narrador' | 'protector'
  | 'pensador' | 'atleta' | 'anfitrion';

export const archetypes: Record<ArchetypeKey, { name: string; color: ArchetypeColorName; tagline: string }> = {
  explorador:   { name: 'Explorador',   color: 'red',      tagline: 'Avanza sin mapa' },
  sonador:      { name: 'Soñador',      color: 'rose',     tagline: 'Habita en imagenes' },
  mistico:      { name: 'Místico',      color: 'purple',   tagline: 'Lee lo invisible' },
  visionario:   { name: 'Visionario',   color: 'violet',   tagline: 'Dibuja el futuro' },
  aventurero:   { name: 'Aventurero',   color: 'orange',   tagline: 'Rompe la rutina' },
  constructor:  { name: 'Constructor',  color: 'zinc',     tagline: 'Levanta lo durable' },
  estratega:    { name: 'Estratega',    color: 'blue',     tagline: 'Piensa tres pasos' },
  sabio:        { name: 'Sabio',        color: 'yellow',   tagline: 'Recuerda lo justo' },
  naturalista:  { name: 'Naturalista',  color: 'lime',     tagline: 'Escucha el entorno' },
  sanador:      { name: 'Sanador',      color: 'teal',     tagline: 'Repara con calma' },
  comunicador:  { name: 'Comunicador',  color: 'cyan',     tagline: 'Conecta personas' },
  guardian:     { name: 'Guardián',     color: 'emerald',  tagline: 'Cuida lo comun' },
  filosofo:     { name: 'Filósofo',     color: 'indigo',   tagline: 'Pregunta el porqué' },
  artista:      { name: 'Artista',      color: 'rose',     tagline: 'Forma lo sensible' },
  erudito:      { name: 'Erudito',      color: 'purple',   tagline: 'Atesora el dato' },
  poeta:        { name: 'Poeta',        color: 'violet',   tagline: 'Pesa cada palabra' },
  bromista:     { name: 'Bromista',     color: 'orange',   tagline: 'Invierte el juego' },
  artesano:     { name: 'Artesano',     color: 'zinc',     tagline: 'Pule el detalle' },
  navegante:    { name: 'Navegante',    color: 'blue',     tagline: 'Traza la ruta' },
  lider:        { name: 'Líder',        color: 'yellow',   tagline: 'Mueve al grupo' },
  jardinero:    { name: 'Jardinero',    color: 'lime',     tagline: 'Hace crecer' },
  medico:       { name: 'Médico',       color: 'teal',     tagline: 'Alivia primero' },
  narrador:     { name: 'Narrador',     color: 'cyan',     tagline: 'Cuenta el mundo' },
  protector:    { name: 'Protector',    color: 'emerald',  tagline: 'Abre el camino' },
  pensador:     { name: 'Pensador',     color: 'indigo',   tagline: 'Pulsa lo abstracto' },
  atleta:       { name: 'Atleta',       color: 'red',      tagline: 'Entrena el cuerpo' },
  anfitrion:    { name: 'Anfitrión',    color: 'orange',   tagline: 'Reune a los suyos' },
};

export const archetypeKeys = Object.keys(archetypes) as ArchetypeKey[];

/** Helper: devuelve el color solido para usar como `fill` en la silueta SVG. */
export const archetypeFill = (key: ArchetypeKey): string =>
  archetypePalette[archetypes[key].color].solid;
