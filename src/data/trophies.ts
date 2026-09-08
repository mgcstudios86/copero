import catalog from './catalog.json'
import { getCompetition, getTeam } from './catalog'

export type TrophyKind = 'league' | 'domestic_cup' | 'continental' | 'national' | 'award'

export type TrophyWin = {
  id: string
  kind: TrophyKind
  name: string
  assetPath: string
}

const GENERIC_LEAGUE = '/media/trophies/football/generic-league.svg'
const GENERIC_CUP = '/media/trophies/football/generic-cup.svg'

/** competition_id → local trophy asset */
const LEAGUE_TROPHY: Record<string, string> = {
  'liga-profesional': '/media/trophies/football/national/ARG/liga-profesional.png',
  'primera-nacional': '/media/trophies/football/national/ARG/primera-nacional.png',
  'liga-mx': '/media/trophies/football/national/MEX/liga-mx.png',
  brasileirao: '/media/trophies/football/national/BRA/brasileirao.png',
  bundesliga: '/media/trophies/football/national/GER/bundesliga.png',
  '2-bundesliga': '/media/trophies/football/national/GER/2-bundesliga.png',
  'premier-league': '/media/trophies/football/national/ENG/premier-league.png',
  championship: '/media/trophies/football/national/ENG/championship.webp',
  'la-liga': '/media/trophies/football/national/ESP/la-liga.png',
  'la-liga-2': '/media/trophies/football/national/ESP/la-liga-2.png',
  'ligue-1': '/media/trophies/football/national/FRA/ligue-1.png',
  'ligue-2': '/media/trophies/football/national/FRA/ligue-2.png',
  'serie-a': '/media/trophies/football/national/ITA/serie-a.png',
  'serie-b': '/media/trophies/football/national/ITA/serie-b.webp',
  'liga-de-primera': '/media/trophies/football/national/CHI/liga-de-primera.png',
  'liga-dimayor': '/media/trophies/football/national/COL/liga-dimayor.png',
  'copa-de-primera': '/media/trophies/football/national/PAR/copa-de-primera.png',
  'liga-uruguaya': '/media/trophies/football/national/URU/liga-uruguaya.png',
  'liga-futve': '/media/trophies/football/national/VEN/liga-futve.png',
  'liga-1': '/media/trophies/football/national/PER/liga-1.svg',
  mls: '/media/trophies/football/national/USA/mls.png',
  'primeira-liga': '/media/trophies/football/national/POR/primeira-liga.svg',
  eredivisie: '/media/trophies/football/national/NED/eredivisie.png',
  'turkey-league': '/media/trophies/football/national/TUR/turkey-league.png',
  'russian-premier-league': '/media/trophies/football/national/RUS/russian-premier-league.png',
}

const CONTINENTAL: Record<string, { name: string; path: string }> = {
  UEFA: {
    name: 'UEFA Champions League',
    path: '/media/trophies/football/international/UEFA/champions-league.png',
  },
  CONMEBOL: {
    name: 'Copa Libertadores',
    path: '/media/trophies/football/international/CONMEBOL/libertadores.png',
  },
  CONCACAF: {
    name: 'Concacaf Champions Cup',
    path: '/media/trophies/football/international/CONCACAF/concachampions.svg',
  },
  CAF: {
    name: 'CAF Champions League',
    path: '/media/trophies/football/international/CAF/afcon.svg',
  },
  AFC: {
    name: 'AFC Champions League',
    path: '/media/trophies/football/international/AFC/asian-cup.svg',
  },
  OFC: {
    name: 'OFC Champions League',
    path: '/media/trophies/football/international/OFC/nations-cup.png',
  },
}

type CupEntry = { name: string; country_fifa_code: string; trophy_url: string }

const domesticCups = Object.values(
  (catalog as { domestic_cups?: Record<string, CupEntry> }).domestic_cups ?? {},
)

function cupForCountry(fifa: string): CupEntry | undefined {
  return domesticCups.find((c) => c.country_fifa_code === fifa)
}

export function resolveLeagueTrophy(teamId: string, competitionId?: string): TrophyWin {
  const team = getTeam(teamId)
  const compId = competitionId ?? team?.competition_id
  const comp = compId ? getCompetition(compId) : undefined
  const mapped = comp ? LEAGUE_TROPHY[comp.id] : undefined
  return {
    id: `league-${comp?.id ?? teamId}`,
    kind: 'league',
    name: comp?.name ?? 'Liga',
    assetPath: mapped ?? GENERIC_LEAGUE,
  }
}

export function resolveDomesticCupTrophy(teamId: string): TrophyWin {
  const team = getTeam(teamId)
  const cup = team ? cupForCountry(team.country_fifa_code) : undefined
  return {
    id: `cup-${team?.country_fifa_code ?? 'unk'}`,
    kind: 'domestic_cup',
    name: cup?.name ?? 'Copa nacional',
    assetPath: cup?.trophy_url || GENERIC_CUP,
  }
}

export function resolveContinentalTrophy(teamId: string): TrophyWin {
  const team = getTeam(teamId)
  const conf = team?.confederation ?? 'UEFA'
  const entry = CONTINENTAL[conf] ?? CONTINENTAL.UEFA
  return {
    id: `continental-${conf}`,
    kind: 'continental',
    name: entry.name,
    assetPath: entry.path,
  }
}

export function resolveAwardTrophy(award: string): TrophyWin | null {
  if (award === 'ballon_or_shortlist') {
    return {
      id: 'ballon-dor',
      kind: 'award',
      name: 'Balón de Oro (shortlist)',
      assetPath: '/media/trophies/football/international/FIFA/ballon-dor.png',
    }
  }
  return null
}

export function collectCareerTrophies(
  seasons: { trophies: TrophyWin[] | string[] }[],
  nationalTrophies: TrophyWin[] = [],
): TrophyWin[] {
  const out: TrophyWin[] = []
  for (const s of seasons) {
    for (const t of s.trophies) {
      if (typeof t === 'string') {
        // legacy saves
        out.push({
          id: t,
          kind: t as TrophyKind,
          name: t,
          assetPath: t === 'domestic_cup' ? GENERIC_CUP : GENERIC_LEAGUE,
        })
      } else {
        out.push(t)
      }
    }
  }
  out.push(...nationalTrophies)
  return out
}

export type AggregatedTrophy = TrophyWin & { count: number }

export function aggregateTrophies(trophies: TrophyWin[]): AggregatedTrophy[] {
  const map = new Map<string, AggregatedTrophy>()
  for (const tr of trophies) {
    const key = `${tr.id}|${tr.assetPath}`
    const prev = map.get(key)
    if (prev) prev.count += 1
    else map.set(key, { ...tr, count: 1 })
  }
  return [...map.values()]
}

const NT_TROPHIES: Record<string, { id: string; name: string; path: string }> = {
  CONMEBOL: {
    id: 'copa-america',
    name: 'Copa América',
    path: '/media/trophies/football/international/CONMEBOL/copa-america.png',
  },
  UEFA: {
    id: 'euro',
    name: 'Eurocopa',
    path: '/media/trophies/football/international/UEFA/euro.svg',
  },
  CONCACAF: {
    id: 'gold-cup',
    name: 'Gold Cup',
    path: '/media/trophies/football/international/CONCACAF/gold-cup.svg',
  },
  CAF: {
    id: 'afcon',
    name: 'Copa África',
    path: '/media/trophies/football/international/CAF/afcon.svg',
  },
  AFC: {
    id: 'asian-cup',
    name: 'Copa Asia',
    path: '/media/trophies/football/international/AFC/asian-cup.svg',
  },
  OFC: {
    id: 'ofc-nations',
    name: 'OFC Nations Cup',
    path: '/media/trophies/football/international/OFC/nations-cup.png',
  },
}

export function resolveNationalTeamTrophy(confederation: string): TrophyWin {
  const entry = NT_TROPHIES[confederation] ?? {
    id: 'confed-cup',
    name: 'Copa confederación',
    path: GENERIC_CUP,
  }
  return {
    id: `nt-${entry.id}`,
    kind: 'national',
    name: entry.name,
    assetPath: entry.path,
  }
}

export function nationalCupName(confederation: string | undefined): string {
  if (!confederation) return 'copa continental'
  return NT_TROPHIES[confederation]?.name ?? 'copa continental'
}

export function resolveWorldCupTrophy(): TrophyWin {
  return {
    id: 'nt-world-cup',
    kind: 'national',
    name: 'Copa del Mundo',
    assetPath: '/media/trophies/football/international/FIFA/world-cup.png',
  }
}
