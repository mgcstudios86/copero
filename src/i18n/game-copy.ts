/**
 * i18n — copy de las pantallas de juego (MGC-232).
 *
 * Módulo hermano de `copy.ts` (que cubre solo el SiteHeader). Acá viven
 * los strings de las fases del simulador de carrera, que sí necesitan
 * interpolación de variables: el header de la fase de origen tiene que
 * reflejar la cantidad real de clubes del catálogo, no un literal fijo.
 *
 * Bug original (MGC-222 / MGC-232): `club.tsx` decía "ELEGÍ ENTRE CUATRO
 * CAMINOS" hardcodeado. Si el catálogo pasa a 3 o a 5 clubes, el header
 * miente hasta el próximo deploy. Acá el count entra por parámetro.
 *
 * Sin dependencias nativas (mismo criterio que `copy.ts`): es un módulo
 * plano de TS, importable tanto desde la app Expo como desde `copero-web`
 * (alias `@shared-i18n` en su `vite.config.ts`).
 *
 * Locales soportados: `es` (default), `en`, `pt-BR`, `it`, `de`, `zh-CN`, `ko`.
 */

export type GameLocale = 'es' | 'en' | 'pt-BR' | 'it' | 'de' | 'zh-CN' | 'ko';

export const GAME_LOCALES: GameLocale[] = ['es', 'en', 'pt-BR', 'it', 'de', 'zh-CN', 'ko'];

export const DEFAULT_GAME_LOCALE: GameLocale = 'es';

/**
 * El copy original deletrea el número ("CUATRO CAMINOS"), no lo escribe
 * en dígitos. Mantenemos ese registro con una tabla por locale para los
 * counts plausibles del catálogo; fuera de rango caemos al dígito, que
 * es correcto aunque menos idiomático.
 */
const NUMBER_WORDS: Record<GameLocale, Record<number, string>> = {
  es: { 1: 'UN', 2: 'DOS', 3: 'TRES', 4: 'CUATRO', 5: 'CINCO', 6: 'SEIS', 7: 'SIETE', 8: 'OCHO' },
  en: { 1: 'ONE', 2: 'TWO', 3: 'THREE', 4: 'FOUR', 5: 'FIVE', 6: 'SIX', 7: 'SEVEN', 8: 'EIGHT' },
  'pt-BR': { 1: 'UM', 2: 'DOIS', 3: 'TRÊS', 4: 'QUATRO', 5: 'CINCO', 6: 'SEIS', 7: 'SETE', 8: 'OITO' },
  it: { 1: 'UNA', 2: 'DUE', 3: 'TRE', 4: 'QUATTRO', 5: 'CINQUE', 6: 'SEI', 7: 'SETTE', 8: 'OTTO' },
  de: { 1: 'EINEN', 2: 'ZWEI', 3: 'DREI', 4: 'VIER', 5: 'FÜNF', 6: 'SECHS', 7: 'SIEBEN', 8: 'ACHT' },
  'zh-CN': { 1: '一', 2: '两', 3: '三', 4: '四', 5: '五', 6: '六', 7: '七', 8: '八' },
  ko: { 1: '한', 2: '두', 3: '세', 4: '네', 5: '다섯', 6: '여섯', 7: '일곱', 8: '여덟' },
};

export type GameCopy = {
  origin: {
    eyebrow: string;
    title: string;
    body: string;
  };
};

export const GAME_COPY: Record<GameLocale, GameCopy> = {
  es: {
    origin: {
      eyebrow: 'PRIMERA DECISIÓN PROFESIONAL',
      title: 'ELEGÍ ENTRE {{count}} CAMINOS',
      body: 'Las opciones dependen de tu nacionalidad y del potencial obtenido en el draft. Un club chico ofrece minutos; uno más fuerte ofrece exposición y títulos, pero también más banco.',
    },
  },
  en: {
    origin: {
      eyebrow: 'FIRST PROFESSIONAL DECISION',
      title: 'CHOOSE BETWEEN {{count}} PATHS',
      body: 'Your options depend on your nationality and the potential you got in the draft. A small club offers minutes; a stronger one offers exposure and titles, but also more bench time.',
    },
  },
  'pt-BR': {
    origin: {
      eyebrow: 'PRIMEIRA DECISÃO PROFISSIONAL',
      title: 'ESCOLHA ENTRE {{count}} CAMINHOS',
      body: 'As opções dependem da sua nacionalidade e do potencial obtido no draft. Um clube pequeno oferece minutos; um mais forte oferece exposição e títulos, mas também mais banco.',
    },
  },
  it: {
    origin: {
      eyebrow: 'PRIMA DECISIONE PROFESSIONALE',
      title: 'SCEGLI TRA {{count}} STRADE',
      body: 'Le opzioni dipendono dalla tua nazionalità e dal potenziale ottenuto al draft. Un club piccolo offre minuti; uno più forte offre visibilità e titoli, ma anche più panchina.',
    },
  },
  de: {
    origin: {
      eyebrow: 'ERSTE PROFI-ENTSCHEIDUNG',
      title: 'WÄHLE AUS {{count}} WEGEN',
      body: 'Die Optionen hängen von deiner Nationalität und dem im Draft erreichten Potenzial ab. Ein kleiner Klub bietet Spielzeit; ein stärkerer bietet Sichtbarkeit und Titel, aber auch mehr Bank.',
    },
  },
  'zh-CN': {
    origin: {
      eyebrow: '第一个职业决定',
      title: '在{{count}}条道路中选择',
      body: '可选项取决于你的国籍以及选秀中获得的潜力。小俱乐部提供出场时间；更强的俱乐部提供曝光和奖杯，但也意味着更多替补时间。',
    },
  },
  ko: {
    origin: {
      eyebrow: '첫 프로 결정',
      title: '{{count}} 갈래 길 중에서 선택하세요',
      body: '선택지는 국적과 드래프트에서 얻은 잠재력에 따라 달라집니다. 작은 클럽은 출전 시간을 주고, 강한 클럽은 노출과 우승을 주지만 벤치 시간도 늘어납니다.',
    },
  },
};

function lookup(copy: GameCopy | undefined, path: string): string | undefined {
  if (!copy) return undefined;
  let cur: unknown = copy;
  for (const part of path.split('.')) {
    if (cur && typeof cur === 'object' && part in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return typeof cur === 'string' ? cur : undefined;
}

export type GameVars = Record<string, string | number>;

/**
 * Formatea el valor de una variable. `count` se deletrea con la tabla del
 * locale (fallback: el dígito); el resto se interpola tal cual.
 */
function formatVar(locale: GameLocale, key: string, value: string | number): string {
  if (key === 'count' && typeof value === 'number') {
    return NUMBER_WORDS[locale]?.[value] ?? String(value);
  }
  return String(value);
}

export function interpolate(template: string, locale: GameLocale, vars?: GameVars): string {
  if (!vars) return template;
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) =>
    key in vars ? formatVar(locale, key, vars[key]) : match,
  );
}

/**
 * `gameT('origin.title', { count: choices.length })`.
 *
 * Fallback en cascada: locale pedido → `es` → el propio path (para que un
 * typo sea visible en pantalla en vez de renderizar vacío).
 */
export function gameT(path: string, vars?: GameVars, locale: GameLocale = DEFAULT_GAME_LOCALE): string {
  const active = GAME_LOCALES.includes(locale) ? locale : DEFAULT_GAME_LOCALE;
  const template = lookup(GAME_COPY[active], path) ?? lookup(GAME_COPY[DEFAULT_GAME_LOCALE], path);
  if (template === undefined) return path;
  return interpolate(template, active, vars);
}
