import type { PlayerAttributes } from '../engine/types'

export type LegendCard = {
  id: string
  name: string
  country: string
  era: string
  positions: string[]
  attributes: PlayerAttributes
}

const a = (
  pace: number,
  shooting: number,
  passing: number,
  dribbling: number,
  defending: number,
  physical: number,
  skillMoves: number,
  weakFoot: number,
): PlayerAttributes => ({ pace, shooting, passing, dribbling, defending, physical, skillMoves, weakFoot })

/**
 * Curated MVP ratings for the draft game. They are original gameplay values,
 * not copied from a commercial football database. Player photography is
 * intentionally excluded from the MVP.
 */
export const LEGENDS: LegendCard[] = [
  { id: 'pele', name: 'Pelé', country: 'BRA', era: '1956–1977', positions: ['ST', 'CAM'], attributes: a(95, 96, 91, 96, 53, 78, 5, 5) },
  { id: 'maradona', name: 'Diego Maradona', country: 'ARG', era: '1976–1997', positions: ['CAM', 'ST'], attributes: a(91, 94, 95, 98, 42, 76, 5, 4) },
  { id: 'cruyff', name: 'Johan Cruyff', country: 'NED', era: '1964–1984', positions: ['CAM', 'ST'], attributes: a(93, 91, 94, 96, 48, 73, 5, 5) },
  { id: 'ronaldo', name: 'Ronaldo Nazário', country: 'BRA', era: '1993–2011', positions: ['ST'], attributes: a(97, 96, 82, 96, 38, 83, 5, 5) },
  { id: 'zidane', name: 'Zinedine Zidane', country: 'FRA', era: '1989–2006', positions: ['CAM', 'CM'], attributes: a(82, 90, 97, 96, 66, 82, 5, 5) },
  { id: 'beckenbauer', name: 'Franz Beckenbauer', country: 'GER', era: '1964–1983', positions: ['CB', 'CDM'], attributes: a(84, 78, 94, 88, 97, 88, 4, 5) },
  { id: 'maldini', name: 'Paolo Maldini', country: 'ITA', era: '1985–2009', positions: ['CB', 'LB'], attributes: a(86, 66, 88, 82, 98, 90, 3, 4) },
  { id: 'ronaldinho', name: 'Ronaldinho', country: 'BRA', era: '1998–2015', positions: ['LW', 'CAM'], attributes: a(91, 91, 95, 98, 45, 79, 5, 5) },
  { id: 'henry', name: 'Thierry Henry', country: 'FRA', era: '1994–2014', positions: ['ST', 'LW'], attributes: a(97, 94, 86, 94, 44, 82, 5, 4) },
  { id: 'xavi', name: 'Xavi Hernández', country: 'ESP', era: '1998–2019', positions: ['CM', 'CAM'], attributes: a(75, 80, 98, 94, 72, 74, 4, 4) },
  { id: 'iniesta', name: 'Andrés Iniesta', country: 'ESP', era: '2002–2024', positions: ['CM', 'CAM'], attributes: a(82, 82, 96, 97, 68, 70, 5, 4) },
  { id: 'pirlo', name: 'Andrea Pirlo', country: 'ITA', era: '1995–2017', positions: ['CM', 'CDM'], attributes: a(68, 86, 99, 91, 70, 72, 4, 5) },
  { id: 'gullit', name: 'Ruud Gullit', country: 'NED', era: '1979–1998', positions: ['CAM', 'CM', 'ST'], attributes: a(91, 91, 91, 90, 82, 96, 4, 5) },
  { id: 'matthaus', name: 'Lothar Matthäus', country: 'GER', era: '1979–2000', positions: ['CM', 'CDM'], attributes: a(90, 89, 93, 87, 94, 93, 4, 5) },
  { id: 'baggio', name: 'Roberto Baggio', country: 'ITA', era: '1982–2004', positions: ['CAM', 'ST'], attributes: a(87, 94, 92, 96, 41, 70, 5, 5) },
  { id: 'eusebio', name: 'Eusébio', country: 'POR', era: '1957–1979', positions: ['ST'], attributes: a(96, 97, 84, 92, 43, 88, 4, 5) },
  { id: 'puskas', name: 'Ferenc Puskás', country: 'HUN', era: '1943–1966', positions: ['ST', 'CAM'], attributes: a(88, 99, 92, 94, 40, 84, 4, 4) },
  { id: 'garrincha', name: 'Garrincha', country: 'BRA', era: '1953–1972', positions: ['RW'], attributes: a(96, 88, 91, 99, 42, 73, 5, 3) },
  { id: 'best', name: 'George Best', country: 'NIR', era: '1963–1984', positions: ['LW', 'RW'], attributes: a(95, 91, 88, 98, 45, 76, 5, 4) },
  { id: 'van-basten', name: 'Marco van Basten', country: 'NED', era: '1981–1995', positions: ['ST'], attributes: a(88, 98, 88, 92, 42, 84, 4, 5) },
  { id: 'baresi', name: 'Franco Baresi', country: 'ITA', era: '1977–1997', positions: ['CB'], attributes: a(80, 58, 91, 80, 99, 88, 3, 4) },
  { id: 'cafu', name: 'Cafu', country: 'BRA', era: '1989–2008', positions: ['RB'], attributes: a(96, 73, 90, 89, 93, 92, 4, 4) },
  { id: 'carlos', name: 'Roberto Carlos', country: 'BRA', era: '1991–2015', positions: ['LB'], attributes: a(98, 91, 88, 88, 88, 94, 4, 4) },
  { id: 'cannavaro', name: 'Fabio Cannavaro', country: 'ITA', era: '1992–2011', positions: ['CB'], attributes: a(83, 52, 78, 72, 98, 94, 2, 4) },
  { id: 'nesta', name: 'Alessandro Nesta', country: 'ITA', era: '1993–2014', positions: ['CB'], attributes: a(79, 51, 84, 79, 98, 90, 3, 4) },
  { id: 'vieira', name: 'Patrick Vieira', country: 'FRA', era: '1994–2011', positions: ['CM', 'CDM'], attributes: a(86, 81, 90, 87, 94, 97, 4, 4) },
  { id: 'makelele', name: 'Claude Makélélé', country: 'FRA', era: '1991–2011', positions: ['CDM'], attributes: a(79, 63, 89, 84, 97, 94, 3, 4) },
  { id: 'lampard', name: 'Frank Lampard', country: 'ENG', era: '1995–2016', positions: ['CM', 'CAM'], attributes: a(78, 94, 93, 84, 76, 88, 3, 5) },
  { id: 'gerrard', name: 'Steven Gerrard', country: 'ENG', era: '1998–2016', positions: ['CM', 'CAM'], attributes: a(84, 94, 94, 86, 83, 93, 4, 5) },
  { id: 'scholes', name: 'Paul Scholes', country: 'ENG', era: '1993–2013', positions: ['CM'], attributes: a(72, 89, 97, 88, 76, 80, 3, 5) },
  { id: 'raul', name: 'Raúl', country: 'ESP', era: '1994–2015', positions: ['ST', 'CAM'], attributes: a(86, 94, 87, 91, 49, 79, 4, 4) },
  { id: 'del-piero', name: 'Alessandro Del Piero', country: 'ITA', era: '1991–2014', positions: ['ST', 'CAM'], attributes: a(85, 94, 92, 95, 42, 72, 5, 5) },
  { id: 'shevchenko', name: 'Andriy Shevchenko', country: 'UKR', era: '1994–2012', positions: ['ST'], attributes: a(94, 95, 82, 89, 44, 86, 4, 4) },
  { id: 'drogba', name: 'Didier Drogba', country: 'CIV', era: '1998–2018', positions: ['ST'], attributes: a(88, 95, 82, 84, 55, 99, 4, 4) },
  { id: 'eto', name: "Samuel Eto'o", country: 'CMR', era: '1997–2019', positions: ['ST'], attributes: a(96, 95, 82, 91, 47, 84, 4, 4) },
  { id: 'figo', name: 'Luís Figo', country: 'POR', era: '1989–2009', positions: ['RW', 'CAM'], attributes: a(89, 88, 96, 96, 55, 78, 5, 5) },
  { id: 'rivaldo', name: 'Rivaldo', country: 'BRA', era: '1991–2015', positions: ['CAM', 'LW'], attributes: a(88, 96, 92, 95, 46, 78, 5, 4) },
  { id: 'kaka', name: 'Kaká', country: 'BRA', era: '2001–2017', positions: ['CAM'], attributes: a(94, 91, 93, 94, 55, 81, 5, 5) },
  { id: 'nedved', name: 'Pavel Nedvěd', country: 'CZE', era: '1991–2009', positions: ['LM', 'CM'], attributes: a(87, 91, 91, 89, 75, 92, 4, 5) },
  { id: 'desailly', name: 'Marcel Desailly', country: 'FRA', era: '1986–2006', positions: ['CB', 'CDM'], attributes: a(84, 61, 83, 76, 97, 97, 3, 4) },
]

export function legendById(id: string): LegendCard | undefined {
  return LEGENDS.find((legend) => legend.id === id)
}
