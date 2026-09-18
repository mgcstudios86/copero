# MGC-477 — Flow Modo Copero (Copa nacional 32 equipos)

## Objetivo
Sumar el modo copero al juego principal: copa nacional de 32 equipos,
bracket de eliminación directa, calendario propio, modal de celebración
y persistencia de campeón en AsyncStorage. Jugable de punta a punta
desde el home → "Jugar Copa" → fase final → restart limpio.

## Pantallas (5 nuevas)

1. **`/copero/bracket`** — Árbol 32 equipos, 5 rondas (R32, R16, QF, SF, F).
   - Render: 32 cards club (logo + nombre + atk/def).
   - Estado por partido: pendiente, en juego, finalizado.
   - CTA por partido pendiente: simular resultado (engine seeded).
   - Highlight del club del usuario en todo el árbol.

2. **`/copero/calendario`** — Calendario de la copa separado del
   calendario de temporada.
   - Lista de fechas (ida y vuelta en R32 = 2 partidos por cruce).
   - CTA "Avanzar ronda" si todos los partidos de la fecha están cerrados.

3. **`/copero/partido`** — Match detail efímero (reuse `MatchScreen` con
   prefijo de fase copero en el header).

4. **`/copero/post-match`** — Post-match con badge "Avanzaste de ronda".
   Reutiliza `PostMatchScreen` con banner superior.

5. **`/copero/campeon`** — Modal full-screen cuando el usuario gana la F.
   - Trofeo animado + nombre del club + campeón persistido en AsyncStorage.
   - CTA "Volver al home" + "Jugar otra copa" (reset del bracket).

## Modelo de datos

```ts
type CopaRonda = 'R32' | 'R16' | 'QF' | 'SF' | 'F';
type CopaEstado = 'pendiente' | 'en_juego' | 'finalizado';

interface CopaPartido {
  id: string;
  ronda: CopaRonda;
  clubLocalId: string;
  clubVisitanteId: string;
  golesLocal: number | null;
  golesVisitante: number | null;
  estado: CopaEstado;
  fecha: number; // week index global
}

interface CopaBracket {
  id: string;
  temporada: number;
  clubes: string[]; // 32 ids
  partidos: CopaPartido[];
  campeonClubId: string | null;
}
```

Store nuevo: `useCopaStore` (zustand) con persist via AsyncStorage
bajo clave `copero.copa.v1`.

## Engine de simulación

- Reutiliza `simularPartido(matchStore)` de MGC-212.
- Seed: `mulberry32(temporadaId * 1000 + partidoId)` para reproducibilidad
  (ver ADR-0016).
- Avance de ronda: si `golesLocal !== golesVisitante`, el ganador pasa a
  la siguiente ronda. Empates en eliminación directa → replay con seed
  desplazada (`+1`) hasta desempatar (cap 5 replays, después define
  por ranking de fase regular como tiebreaker).

## Acceptance Criteria

- [ ] Desde home el botón "Jugar Copa" navega a `/copero/bracket`.
- [ ] Bracket inicial muestra 32 clubes (los 28 de la liga + 4 ascendidos
      de la temporada anterior o clubes placeholder si no hay ascensos).
- [ ] Click en partido pendiente → simula y avanza el resultado al árbol.
- [ ] Al cerrar la última ronda (F) con el club del usuario como ganador,
      se muestra `/copero/campeon` con modal celebratorio.
- [ ] AsyncStorage persiste `campeonClubId` y se muestra en home como
      "Campeón vigente".
- [ ] Restart limpio (MGC-481) borra el bracket y deja `campeonClubId = null`.
- [ ] i18n es / en / pt-BR para todas las claves nuevas (`copero.copa.*`).

## Bloqueos / Dependencias

- **MGC-320 i18n selector**: listo (PR #652 merged).
- **MGC-386 matchStore hydration**: listo (PR #654 merged).
- **MGC-481 restart limpio**: bloqueado por MGC-215 listo (PR #647 merged).

## Archivos a tocar (futuro PR de implementación)

- `apps/expo/src/screens/copero/bracket.tsx`
- `apps/expo/src/screens/copero/calendario.tsx`
- `apps/expo/src/screens/copero/post-match.tsx`
- `apps/expo/src/screens/copero/campeon.tsx`
- `apps/expo/src/state/copa-store.ts`
- `apps/expo/src/state/copa-engine.ts`
- `apps/expo/src/i18n/copy.ts` (claves `copero.copa.*`)
- `apps/expo/src/routes/copero.ts` (deep-links)

Refs: MGC-477, MGC-210 §children. Implementación en PR siguiente.
