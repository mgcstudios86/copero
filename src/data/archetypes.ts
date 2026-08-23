/**
 * 27 arquetipos de DT para el Ideología Futbolística (Tactical Compass).
 *
 * Cada arquetipo tiene coordenadas (x, y) en el rango [-100, +100] del compass.
 * La bio es **copy propia**: no se reutilizan textos ni fotos del bundle original.
 *
 * Coordenadas:
 *   x: -100 = Posesión extrema, +100 = Verticalidad extrema
 *   y: -100 = Pragmatismo puro,    +100 = Dogmatismo ideológico
 */

export type ArchetypeId = string;

export type Archetype = {
  readonly id: ArchetypeId;
  readonly name: string;
  /** Coordenada X (Posesión ↔ Vertical), rango [-100, 100]. */
  readonly x: number;
  /** Coordenada Y (Pragmático ↔ Dogmático), rango [-100, 100]. */
  readonly y: number;
  /** Color acento en hex (sin el `#`) — se usa en la card de resultado y en la silueta SVG. */
  readonly color: string;
  /** Tag de tres letras que aparece en el share card. */
  readonly tag: string;
  /** Bio original (1-2 oraciones). Copy propia, no derivada del bundle original. */
  readonly bio: string;
  /** Slug del archivo de silueta en `assets/archetypes/`. */
  readonly silhouette: string;
};

export const ARCHETYPES: readonly Archetype[] = [
  {
    id: 'ancelotti',
    name: 'Ancelotti',
    x: 8,
    y: -55,
    color: '#3b82f6',
    tag: 'CAR',
    bio: 'Sala de estar con vista al trofeo. Elige el ambiente y deja que los cracks resuelvan, sin pelearse con el calendario ni con el ego de nadie.',
    silhouette: 'ancelotti.svg',
  },
  {
    id: 'bianchi',
    name: 'Bianchi',
    x: -68,
    y: 60,
    color: '#0ea5e9',
    tag: 'CAR',
    bio: 'Catilina contemporánea. Marcas al hombre en cada rincón del campo y líneas que se mueven como un acordeón bien afinado.',
    silhouette: 'bianchi.svg',
  },
  {
    id: 'bielsa',
    name: 'Bielsa',
    x: -82,
    y: 88,
    color: '#10b981',
    tag: 'Loco',
    bio: 'Le pide al jugador lo que el jugador no sabe que puede dar. La pelota se recupera en seis segundos; lo demás, es geometría.',
    silhouette: 'bielsa.svg',
  },
  {
    id: 'bilardo',
    name: 'Bilardo',
    x: 28,
    y: 70,
    color: '#22c55e',
    tag: 'Náufrago',
    bio: 'El resultado se cocina a fuego lento. Líneas juntas, transiciones rápidas y un nueve que pelea con los centrales como si fueran hermanos.',
    silhouette: 'bilardo.svg',
  },
  {
    id: 'capello',
    name: 'Capello',
    x: 35,
    y: -25,
    color: '#f59e0b',
    tag: 'Il Campione',
    bio: 'Cuatro centrocampistas, dos puntas y la disciplina de un cuartel. Cuando el equipo entiende, el equipo gana.',
    silhouette: 'capello.svg',
  },
  {
    id: 'conte',
    name: 'Conte',
    x: 60,
    y: 65,
    color: '#e11d48',
    tag: 'Box',
    bio: 'Tres atrás, dos carrileros hasta la línea de cal y hambre de área. La banda es el camino, el área es la oficina.',
    silhouette: 'conte.svg',
  },
  {
    id: 'cruyff',
    name: 'Cruyff',
    x: -90,
    y: 78,
    color: '#a855f7',
    tag: 'Totaal',
    bio: 'El espacio se ocupa, no se gana. Cada jugador piensa como un mediocampista; la presión empieza en el nueve.',
    silhouette: 'cruyff.svg',
  },
  {
    id: 'del-bosque',
    name: 'Del Bosque',
    x: -22,
    y: -68,
    color: '#fde047',
    tag: 'Don Vicente',
    bio: 'No se nota y por eso funciona. Gestiona egos, deja que la pelota hable y gana finales sin que el equipo se entere.',
    silhouette: 'del-bosque.svg',
  },
  {
    id: 'deschamps',
    name: 'Deschamps',
    x: 18,
    y: -38,
    color: '#1d4ed8',
    tag: 'DD',
    bio: 'Bloque bajo, transiciones limpias y un mediocampista que hace de todo sin que se note. Francia como sinónimo de orden.',
    silhouette: 'deschamps.svg',
  },
  {
    id: 'emery',
    name: 'Emery',
    x: 22,
    y: -10,
    color: '#dc2626',
    tag: 'Peinado',
    bio: 'Estudia al rival como quien prepara un examen. Set pieces, pressing medio y rotaciones que parecen teletransporte.',
    silhouette: 'emery.svg',
  },
  {
    id: 'ferguson',
    name: 'Ferguson',
    x: 45,
    y: -30,
    color: '#7f1d1d',
    tag: 'Sir Alex',
    bio: 'Dos puntas que se complementan, bandas que suben y bajan, y la autoridad de un manager que firma hasta los pantalones.',
    silhouette: 'ferguson.svg',
  },
  {
    id: 'flick',
    name: 'Flick',
    x: 32,
    y: 48,
    color: '#ef4444',
    tag: 'Hans-i',
    bio: 'Líneas adelantadas al borde del área chica, presión tras pérdida y laterales que parecen extremos. Fútbol de academia.',
    silhouette: 'flick.svg',
  },
  {
    id: 'gallardo',
    name: 'Gallardo',
    x: -45,
    y: 35,
    color: '#dc2626',
    tag: 'Muñeco',
    bio: 'El diez juega de cinco y el nueve corre hasta el minuto 90. Apuesta por el jugador que pisa la pelota sin pensarlo.',
    silhouette: 'gallardo.svg',
  },
  {
    id: 'guardiola',
    name: 'Guardiola',
    x: -95,
    y: 72,
    color: '#06b6d4',
    tag: 'Pep',
    bio: 'El equipo es un sistema, no una suma de cracks. La pelota se mueve y el rival persigue; el arquero juega como un líbero moderno.',
    silhouette: 'guardiola.svg',
  },
  {
    id: 'klopp',
    name: 'Klopp',
    x: 78,
    y: 42,
    color: '#dc2626',
    tag: 'Heavy Metal',
    bio: 'Contraataque como filosofía, pressing como liturgia y banda sonora de heavy metal. Tres delanteros y cero excusas.',
    silhouette: 'klopp.svg',
  },
  {
    id: 'lopetegui',
    name: 'Lopetegui',
    x: -18,
    y: 30,
    color: '#0f766e',
    tag: 'Julen',
    bio: 'Salida prolija desde el fondo, laterales invertidos y un mediocampista organizador. Fútbol de academia con resultados de selección.',
    silhouette: 'lopetegui.svg',
  },
  {
    id: 'luis-enrique',
    name: 'Luis Enrique',
    x: 50,
    y: 18,
    color: '#fb923c',
    tag: 'Lucho',
    bio: 'Carrileros que son extremos, extremos que son puntas y un nueve que hace de todo menos lo obvio. La MSN era esto.',
    silhouette: 'luis-enrique.svg',
  },
  {
    id: 'menotti',
    name: 'Menotti',
    x: -78,
    y: 85,
    color: '#84cc16',
    tag: 'El Flaco',
    bio: 'Ganar está bien, pero importa más cómo. La pelota se mueve como una declaración de principios y el resultado es una consecuencia.',
    silhouette: 'menotti.svg',
  },
  {
    id: 'mourinho',
    name: 'Mourinho',
    x: 55,
    y: 72,
    color: '#1e3a8a',
    tag: 'The Special One',
    bio: 'El autobús es una formación táctica. Transiciones veloces, contragolpe letal y declaraciones que valen más que un gol.',
    silhouette: 'mourinho.svg',
  },
  {
    id: 'ramon-diaz',
    name: 'Ramón Díaz',
    x: 38,
    y: -48,
    color: '#f97316',
    tag: 'Pelusa',
    bio: 'Dos nueves que se turnan, laterales que pisan el área y un mediocampista que tira la media distancia como si fuera un penal.',
    silhouette: 'ramon-diaz.svg',
  },
  {
    id: 'sacchi',
    name: 'Sacchi',
    x: -75,
    y: 80,
    color: '#7c3aed',
    tag: 'Arrigo',
    bio: 'Pressing colectivo en zona y líneas que se mueven juntas. El fútbol se entiende como geometría y se ejecuta como ballet.',
    silhouette: 'sacchi.svg',
  },
  {
    id: 'sampaoli',
    name: 'Sampaoli',
    x: -55,
    y: 82,
    color: '#0ea5e9',
    tag: 'Locura',
    bio: 'Presión alta que no negocia, laterales que son extremos y un equipo que ataca con siete. La pelota se recupera en el área rival.',
    silhouette: 'sampaoli.svg',
  },
  {
    id: 'scaloni',
    name: 'Scaloni',
    x: 5,
    y: -30,
    color: '#60a5fa',
    tag: 'Lionel',
    bio: 'No inventa nada y por eso todo funciona. Líneas parejas, mediocampistas que corren y extremos que defienden. Campeón del mundo sin hacer ruido.',
    silhouette: 'scaloni.svg',
  },
  {
    id: 'simeone',
    name: 'Simeone',
    x: 68,
    y: 80,
    color: '#dc2626',
    tag: 'Cholo',
    bio: 'Defensa como religión, contraataque como misa. El equipo es un muro con piernas y un nueve que corre hasta el minuto 90.',
    silhouette: 'simeone.svg',
  },
  {
    id: 'tuchel',
    name: 'Tuchel',
    x: -10,
    y: 55,
    color: '#0891b2',
    tag: 'Thomas',
    bio: 'Tres centrales que se alternan, carrileros que se proyectan y pressing selectivo. El sistema se adapta al rival antes del entretiempo.',
    silhouette: 'tuchel.svg',
  },
  {
    id: 'wenger',
    name: 'Wenger',
    x: -58,
    y: 50,
    color: '#ef4444',
    tag: 'Le Prof',
    bio: 'Fútbol bonito, dieta estricta y juveniles que juegan como si tuvieran treinta años. El Emirates tenía identidad antes de tener títulos.',
    silhouette: 'wenger.svg',
  },
  {
    id: 'zidane',
    name: 'Zidane',
    x: -8,
    y: -20,
    color: '#0f172a',
    tag: 'Zizou',
    bio: 'Cuatro centrocampistas con clase y un nueve que define. Cuando funciona, parece fácil; cuando no funciona, parece inexplicable.',
    silhouette: 'zidane.svg',
  },
] as const;

/**
 * Lookup indexado por id para acceso O(1). Lanzamos si el id no existe
 * (ayuda a detectar typos durante el desarrollo).
 */
const BY_ID = new Map(ARCHETYPES.map((a) => [a.id, a]));

export function getArchetype(id: ArchetypeId): Archetype {
  const a = BY_ID.get(id);
  if (!a) {
    throw new Error(`[archetypes] id desconocido: ${id}`);
  }
  return a;
}