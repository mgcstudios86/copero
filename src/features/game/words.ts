import type { Category, Word } from '@/types/game';

/**
 * Banco de palabras embebido (no scrapeado).
 * 5 categorías × 20 palabras — suficiente para un copero de ~10 rondas
 * sin repetir dentro de la misma partida.
 */
export const WORDS: Record<Category, readonly Word[]> = {
  futbol: [
    { text: 'pelota', hint: 'Esférica, se patea' },
    { text: 'arco', hint: 'Dos postes y un travesaño' },
    { text: 'tarjeta', hint: 'Amarilla o roja' },
    { text: 'técnico', hint: 'Director técnico' },
    { text: 'gol', hint: 'Lo que todos quieren hacer' },
    { text: 'fuera de juego', hint: 'Offside' },
    { text: 'penal', hint: 'Tiro desde los 12 pasos' },
    { text: 'corner', hint: 'Tiro de esquina' },
    { text: 'arquero', hint: 'El del guante grande' },
    { text: 'mediapunta', hint: 'El "10" clásico' },
    { text: 'cabezazo', hint: 'Remate con la cabeza' },
    { text: 'táctica', hint: 'Dibujo del equipo' },
    { text: 'contragolpe', hint: 'Salida rápida tras defender' },
    { text: 'banquillo', hint: 'Suplentes' },
    { text: 'hincha', hint: 'Seguidor del equipo' },
    { text: 'clásico', hint: 'Partido entre rivales' },
    { text: 'vestuario', hint: 'Camerino' },
    { text: 'cambio', hint: 'Sustitución de jugador' },
    { text: 'lesión', hint: 'Se sale de la cancha' },
    { text: 'champions', hint: 'Copa de Europa' },
  ],
  musica: [
    { text: 'guitarra', hint: 'Tiene 6 cuerdas' },
    { text: 'batería', hint: 'Set de percusión' },
    { text: 'micrófono', hint: 'Captura la voz' },
    { text: 'bajo', hint: 'Cuatro cuerdas graves' },
    { text: 'piano', hint: 'Teclas blancas y negras' },
    { text: 'vinilo', hint: 'Disco de antes' },
    { text: 'concierto', hint: 'Show en vivo' },
    { text: 'melodía', hint: 'Línea musical' },
    { text: 'ritmo', hint: 'Patrón rítmico' },
    { text: 'compás', hint: 'Unidad de medida musical' },
    { text: 'coro', hint: 'Voces juntas' },
    { text: 'solista', hint: 'Toca solo' },
    { text: 'orquesta', hint: 'Muchos instrumentos juntos' },
    { text: 'tango', hint: 'Género rioplatense' },
    { text: 'rock', hint: 'Guitarras eléctricas y batería' },
    { text: 'cuarteto', hint: 'Género popular cordobés' },
    { text: 'folklore', hint: 'Música tradicional' },
    { text: 'letra', hint: 'Lo que se canta' },
    { text: 'acorde', hint: 'Varias notas juntas' },
    { text: 'estribillo', hint: 'Parte que se repite' },
  ],
  geografia: [
    { text: 'Amazonas', hint: 'Río más caudaloso del mundo' },
    { text: 'Patagonia', hint: 'Sur de Argentina y Chile' },
    { text: 'Andes', hint: 'Cordillera sudamericana' },
    { text: 'Buenos Aires', hint: 'Capital argentina' },
    { text: 'Córdoba', hint: 'Capital de la provincia homónima' },
    { text: 'Mendoza', hint: 'Tierra del vino' },
    { text: 'Tierra del Fuego', hint: 'Fin del continente' },
    { text: 'Salta', hint: 'Noroeste argentino' },
    { text: 'Mar del Plata', hint: 'Ciudad balnearia' },
    { text: 'Bariloche', hint: 'Lagos y montañas' },
    { text: 'Ushuaia', hint: 'La más austral' },
    { text: 'Río de Janeiro', hint: 'Ciudad del Cristo Redentor' },
    { text: 'Madrid', hint: 'Capital de España' },
    { text: 'París', hint: 'Ciudad de la luz' },
    { text: 'Tokio', hint: 'Capital de Japón' },
    { text: 'Sahara', hint: 'Desierto enorme de África' },
    { text: 'Everest', hint: 'La montaña más alta' },
    { text: 'Mediterráneo', hint: 'Mar entre Europa y África' },
    { text: 'Caribe', hint: 'Mar tropical' },
    { text: 'Polo Norte', hint: 'Helado y con osos' },
  ],
  comida: [
    { text: 'asado', hint: 'Carne a la parrilla' },
    { text: 'empanada', hint: 'Masa rellena horneada o frita' },
    { text: 'pizza', hint: 'Masa con queso y salsa' },
    { text: 'milanesa', hint: 'Carne empanada y frita' },
    { text: 'choripán', hint: 'Chorizo en pan' },
    { text: 'mate', hint: 'Infusión compartida' },
    { text: 'dulce de leche', hint: 'Crema dulce argentina' },
    { text: 'helado', hint: 'Postre congelado' },
    { text: 'facturas', hint: 'Para el desayuno' },
    { text: 'ñoquis', hint: 'Pasta del 29' },
    { text: 'locro', hint: 'Guiso del 25 de mayo' },
    { text: 'fideos', hint: 'Pasta larga o corta' },
    { text: 'ensalada', hint: 'Mezcla de verduras crudas' },
    { text: 'sushi', hint: 'Arrollado de arroz y pescado' },
    { text: 'hamburguesa', hint: 'Pan con medallón de carne' },
    { text: 'tacos', hint: 'Tortilla mexicana doblada' },
    { text: 'ceviche', hint: 'Pescado crudo marinado' },
    { text: 'queso', hint: 'Lácteo fermentado' },
    { text: 'vino', hint: 'Bebida de uva fermentada' },
    { text: 'cerveza', hint: 'Bebida de cebada' },
  ],
  animales: [
    { text: 'perro', hint: 'El mejor amigo' },
    { text: 'gato', hint: 'Felino doméstico' },
    { text: 'caballo', hint: 'Se monta y trota' },
    { text: 'vaca', hint: 'Da leche' },
    { text: 'gallina', hint: 'Pone huevos' },
    { text: 'loro', hint: 'Repite lo que decís' },
    { text: 'tigre', hint: 'Felino naranja con rayas' },
    { text: 'león', hint: 'Rey de la selva' },
    { text: 'elefante', hint: 'El más grande en tierra' },
    { text: 'jirafa', hint: 'Cuello larguísimo' },
    { text: 'pingüino', hint: 'Ave que no vuela' },
    { text: 'delfín', hint: 'Mamífero marino inteligente' },
    { text: 'águila', hint: 'Ave rapaz' },
    { text: 'serpiente', hint: 'Reptil sin patas' },
    { text: 'tortuga', hint: 'Caparazón y lento andar' },
    { text: 'mono', hint: 'Trepa árboles' },
    { text: 'zorro', hint: 'Astuto y rojizo' },
    { text: 'lobo', hint: 'Antepasado del perro' },
    { text: 'oso', hint: 'Hiberna en invierno' },
    { text: 'ballena', hint: 'Gigante del océano' },
  ],
};

/** Total de palabras disponibles por categoría. */
export const countWords = (category: Category): number => WORDS[category].length;

/**
 * Devuelve N palabras aleatorias no repetidas de una categoría.
 * Si N excede el total, devuelve todas sin repetir.
 */
export const pickRandomWords = (
  category: Category,
  n: number,
  rng: () => number = Math.random,
): Word[] => {
  const pool = [...WORDS[category]];
  const k = Math.min(n, pool.length);
  const picked: Word[] = [];
  for (let i = 0; i < k; i++) {
    const idx = Math.floor(rng() * pool.length);
    const [w] = pool.splice(idx, 1);
    if (w) picked.push(w);
  }
  return picked;
};
