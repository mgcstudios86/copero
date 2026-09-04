import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GAME_LOCALES, gameT } from '@/i18n/game-copy';

/**
 * Regresión MGC-222 / MGC-232.
 *
 * MGC-222: el header decía "TRES CAMINOS" con 4 clubes en el catálogo.
 * MGC-232: el fix inicial hardcodeó "CUATRO", que vuelve a mentir en el
 * próximo cambio de catálogo. Estos tests verifican la *lógica* (el count
 * entra por parámetro), no el literal renderizado.
 */
describe('club screen — copy de origen', () => {
  const clubScreen = readFileSync(resolve(__dirname, 'club.tsx'), 'utf8');
  // MGC-249: el catálogo de clubes vive en `features/career/clubs.ts`
  // (`clubsForPosition(group)`), no inline en club.tsx. El test cuenta
  // entradas desde el archivo canónico.
  const clubsCatalog = readFileSync(
    resolve(__dirname, '../../career/clubs.ts'),
    'utf8',
  );
  const clubCount = Array.from(clubsCatalog.matchAll(/^\s*id:\s*'([^']+)'/gm)).length;

  it('declara 5 clubes en la lista', () => {
    // MGC-1648 — WF2 team-select obligatorio exige un top-5 visible en
    // el alta. Se agregó River Plate al catálogo canónico en
    // `clubs.ts`; los tests de regresión contra el tamaño del catálogo
    // se actualizan en consecuencia. Si volvés a cambiar la cantidad,
    // actualizá también la aserción de «título renderizado» debajo.
    expect(clubCount).toBe(5);
  });

  it('no tiene el título del header hardcodeado', () => {
    expect(clubScreen).not.toContain('ELEGÍ ENTRE');
  });

  it('pasa el largo real del catálogo al componente de origen', () => {
    // MGC-249: el catálogo ahora se deriva de `clubsForPosition(group)` y se
    // memoiza en `clubOptions`. Aceptamos cualquier `*.length` dinámico.
    expect(clubScreen).toMatch(/<OriginPhase\s+count=\{[A-Za-z_]+\.length\}\s*\/>/);
  });

  // MGC-490 — guard contra auto-assign con Boca Juniors (regresión
  // MGC-486). Si entramos a /club con stage='season' y profile.club ya
  // seteado, el snapshot está stale y el selector no aplica: el guard
  // debe redirigir a /temporada en lugar de mostrar las 4 tarjetas con
  // un loop ya cerrado. Si no hay card/draft tampoco aplica el selector.
  it('declara guard que redirige a /temporada cuando stage=season y hay club', () => {
    expect(clubScreen).toMatch(/stage\s*===\s*['"]season['"]/);
    expect(clubScreen).toMatch(/router\.replace\(['"]\/simulador-carrera\/temporada['"]\)/);
  });

  it('declara guard que redirige a /tu-jugador cuando no hay card o draft', () => {
    expect(clubScreen).toMatch(/router\.replace\(['"]\/simulador-carrera\/tu-jugador['"]\)/);
  });

  it('el título renderizado coincide con la cantidad de clubes del catálogo', () => {
    // MGC-1648 — top-5 popular. El título debe coincidir con el count del
    // catálogo (`CINCO` para 5 clubes). La tabla de números en `game-copy`
    // ya cubre 5 (ver test «sigue al catálogo cuando cambia la cantidad»
    // abajo).
    expect(gameT('origin.title', { count: clubCount })).toBe('ELEGÍ ENTRE CINCO CAMINOS');
  });
});

describe('gameT — interpolación de {{count}}', () => {
  it('sigue al catálogo cuando cambia la cantidad de clubes', () => {
    expect(gameT('origin.title', { count: 3 })).toBe('ELEGÍ ENTRE TRES CAMINOS');
    expect(gameT('origin.title', { count: 4 })).toBe('ELEGÍ ENTRE CUATRO CAMINOS');
    expect(gameT('origin.title', { count: 5 })).toBe('ELEGÍ ENTRE CINCO CAMINOS');
  });

  it('cae al dígito cuando el count sale de la tabla de números', () => {
    expect(gameT('origin.title', { count: 12 })).toBe('ELEGÍ ENTRE 12 CAMINOS');
  });

  it('define origin.title en los 7 locales soportados, sin dejar el placeholder', () => {
    expect(GAME_LOCALES).toHaveLength(7);
    for (const locale of GAME_LOCALES) {
      const title = gameT('origin.title', { count: 4 }, locale);
      expect(title).not.toContain('{{count}}');
      expect(title).not.toBe('origin.title');
      expect(title.length).toBeGreaterThan(0);
    }
  });

  it('traduce el título por locale', () => {
    expect(gameT('origin.title', { count: 4 }, 'en')).toBe('CHOOSE BETWEEN FOUR PATHS');
    expect(gameT('origin.title', { count: 4 }, 'pt-BR')).toBe('ESCOLHA ENTRE QUATRO CAMINHOS');
    expect(gameT('origin.title', { count: 4 }, 'de')).toBe('WÄHLE AUS VIER WEGEN');
  });

  it('cae a es cuando el locale no existe', () => {
    expect(gameT('origin.title', { count: 4 }, 'xx' as never)).toBe('ELEGÍ ENTRE CUATRO CAMINOS');
  });

  it('devuelve el path cuando la clave no existe, para que el typo sea visible', () => {
    expect(gameT('origin.noExiste')).toBe('origin.noExiste');
  });

  it('define eyebrow y body en los 7 locales', () => {
    for (const locale of GAME_LOCALES) {
      expect(gameT('origin.eyebrow', undefined, locale)).not.toBe('origin.eyebrow');
      expect(gameT('origin.body', undefined, locale)).not.toBe('origin.body');
    }
  });
});
