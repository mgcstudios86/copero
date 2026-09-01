import type { League } from '@/types/career';

/**
 * Lista curada de ligas para el selector de identidad (MGC-955).
 * Mismo patrón que `nationalities.ts`: 30+ entradas con `code` estable
 * (clave para el store), `name` legible en UI y `countryCode` ISO alpha-2
 * del país rector para filtrar por nacionalidad cuando aplique.
 *
 * Cobertura intencional: Américas + Europa top tier + ligas con jugadores
 * históricos que el briefing MGC-11 cita explícitamente. Si la lista
 * queda corta para una región, agregar entrada aquí; el selector ya
 * scrollea con nestedScrollEnabled.
 */
export const LEAGUES: League[] = [
  { code: 'ARG_LPF', name: 'Liga Profesional Argentina', countryCode: 'AR' },
  { code: 'ARG_BN', name: 'Primera B Nacional', countryCode: 'AR' },
  { code: 'BRA_SA', name: 'Brasileirão Serie A', countryCode: 'BR' },
  { code: 'BRA_SB', name: 'Brasileirão Serie B', countryCode: 'BR' },
  { code: 'URU_PL', name: 'Primera División Uruguay', countryCode: 'UY' },
  { code: 'CHI_PL', name: 'Primera División Chile', countryCode: 'CL' },
  { code: 'COL_PL', name: 'Liga BetPlay Colombia', countryCode: 'CO' },
  { code: 'PER_PL', name: 'Liga 1 Perú', countryCode: 'PE' },
  { code: 'PAR_PL', name: 'División Profesional Paraguay', countryCode: 'PY' },
  { code: 'ECU_PL', name: 'LigaPro Ecuador', countryCode: 'EC' },
  { code: 'MEX_LM', name: 'Liga MX', countryCode: 'MX' },
  { code: 'USA_MLS', name: 'MLS', countryCode: 'US' },
  { code: 'ESP_LL', name: 'LaLiga España', countryCode: 'ES' },
  { code: 'ESP_SD', name: 'Segunda División España', countryCode: 'ES' },
  { code: 'ENG_PL', name: 'Premier League', countryCode: 'GB' },
  { code: 'ENG_CH', name: 'EFL Championship', countryCode: 'GB' },
  { code: 'ITA_SA', name: 'Serie A Italia', countryCode: 'IT' },
  { code: 'GER_BL', name: 'Bundesliga Alemania', countryCode: 'DE' },
  { code: 'GER_B2', name: '2. Bundesliga', countryCode: 'DE' },
  { code: 'FRA_L1', name: 'Ligue 1 Francia', countryCode: 'FR' },
  { code: 'POR_PL', name: 'Primeira Liga Portugal', countryCode: 'PT' },
  { code: 'NED_ED', name: 'Eredivisie Países Bajos', countryCode: 'NL' },
  { code: 'BEL_PL', name: 'Jupiler Pro League Bélgica', countryCode: 'BE' },
  { code: 'CRO_PL', name: 'HNL Croacia', countryCode: 'HR' },
  { code: 'TUR_SL', name: 'Süper Lig Turquía', countryCode: 'TR' },
  { code: 'JPN_J1', name: 'J1 League Japón', countryCode: 'JP' },
  { code: 'KOR_K1', name: 'K League 1 Corea del Sur', countryCode: 'KR' },
  { code: 'AUS_AL', name: 'A-League Australia', countryCode: 'AU' },
  { code: 'KSA_PL', name: 'Saudi Pro League', countryCode: 'SA' },
  { code: 'UAE_PL', name: 'UAE Pro League', countryCode: 'AE' },
  { code: 'INT_LIB', name: 'Copa Libertadores', countryCode: 'CONMEBOL' },
  { code: 'INT_SUD', name: 'Copa Sudamericana', countryCode: 'CONMEBOL' },
];

/** Resolver legible por código. Devuelve `null` si el código no existe (defensa). */
export function leagueNameByCode(code: string | null | undefined): string | null {
  if (!code) return null;
  const hit = LEAGUES.find((l) => l.code === code);
  return hit ? hit.name : null;
}
