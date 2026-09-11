---
feature: "overview-product-flow"
project: "copero"
author: "flow-architect"
status: "approved"
created: "2026-09-11"
updated: "2026-09-11"
---

# Copero — Overview / Product Flow

> **Tipo de spec**: este `flow.md` es **macro** (overview end-to-end del
> producto). Cada feature concreta que se aparte debe abrir su propio
> `features/<feature-id>/flow.md` con el detalle.
>
> **Status**: `approved` (es un sketch inicial para que `designer`
> tenga contexto del producto antes de trabajar features individuales).

## Trigger
Primera apertura de la app (cold start). El usuario llega por link de
descarga (App Store / Play Store) o por tap en el icono.

## Actor
Un solo jugador (no es multiplayer). Toda la lógica corre en el
cliente; no hay servidor.

## Diagrama

\`\`\`mermaid
flowchart TD
  A[Cold start] --> B{¿Tiene save local?}
  B -- "no" --> C[Onboarding: elegir nombre de equipo + liga]
  C --> D[Tutorial: 1 partido guiado]
  D --> E[Temporada: hub con fixtures]
  B -- "sí" --> F[Cargar save]
  F --> E
  E --> G{¿Fecha activa?}
  G -- "no" --> H[Simular fecha: entrenar / descanso]
  G -- "sí" --> I[Partido: preparación + 90 min jugada por jugada]
  I --> J{¿Ganó?}
  J -- "sí" --> K[+puntos, morale+, exp del equipo]
  J -- "no" --> L[moral-, revisar táctica]
  K --> H
  L --> H
  H --> M{¿Temporada terminó?}
  M -- "no" --> H
  M -- "sí" --> N[Tabla + playoffs opcional]
\`\`\`

## Steps

### Step 1: Onboarding
- **Pantalla / Componente**: `OnboardingStack.WelcomeScreen`
- **Acción del usuario**: elegir nombre del club, liga inicial
- **Acción del sistema**: crea save local AsyncStorage; seed con equipo default
- **Resultado esperado**: el usuario aterriza en la hub de temporada
- **Caminos alternativos**:
  - cancelar onboarding → mantiene save default con "Equipo Local"
  - error de storage → mostrar mensaje y reintentar

### Step 2: Tutorial guiado (1 partido)
- **Pantalla / Componente**: `MatchStack.TutorialMatchScreen`
- **Acción del usuario**: tap "play" / tap "pause" / selecciona táctica
- **Acción del sistema**: corre simulación simplificada, sin toda la lógica
- **Resultado esperado**: score final, mensaje "¡Listo, ahora es tu temporada!"
- **Caminos alternativos**: skip → continúa a hub sin tutorial

### Step 3: Hub de temporada
- **Pantalla / Componente**: `SeasonStack.SeasonHubScreen`
- **Acción del usuario**: navegar a secciones (plantel, próximas fechas, tabla)
- **Acción del sistema**: lee save, calcula próximas fechas
- **Resultado esperado**: vista principal con próximas N fechas + acciones rápidas
- **Caminos alternativos**:
  - sin fecha activa → CTA grande "Entrenar"
  - temporada terminada → CTA grande "Siguiente temporada"

### Step 4: Simular / entrenar entre fechas
- **Pantalla / Componente**: `SeasonStack.TrainingScreen`
- **Acción del usuario**: elige plan de entrenamiento o descanso
- **Acción del sistema**: aplica cambios de stats a jugadores + avanza fecha
- **Resultado esperado**: notificación "Fecha N completada, próxima: <fecha>"
- **Caminos alternativos**: lesión durante entrenamiento → modal con información

### Step 5: Partido
- **Pantalla / Componente**: `MatchStack.MatchScreen`
- **Acción del usuario**: tap "play / pause / substituciones / táctica"
- **Acción del sistema**: simula 90 min con eventos (goles, lesiones, expulsiones)
- **Resultado esperado**: resultado final (goles, possession, MVP)
- **Caminos alternativos**:
  - timeout / crash → reload partido desde el minuto guardado
  - lesiones graves → modal "jugador baja N fechas"

## Edge cases

| # | Caso | Comportamiento esperado |
|---|------|--------------------------|
| 1 | Storage lleno / corrupto | Ofrecer "Nuevo equipo" o "Restaurar backup iCloud" |
| 2 | Usuario no juega una temporada entera | Las fechas se simulan automáticamente al abrir la app |
| 3 | Empate deptable (descenso) | Playoff por la permanencia |
| 4 | Crash mid-match | Persistir el minuto exacto + estado del partido, ofrecer re-start |
| 5 | Cambios de App Store (nueva versión con datos incompatibles) | Migración automática al abrir; si falla, ofrecer reset |

## Pre-condiciones
- App instalada y arrancada al menos una vez
- Storage local disponible

## Post-condiciones
- Save local persistido en AsyncStorage tras cada acción
- Estado del torneo consistente entre sesiones

## Validación
- Maestro E2E: `maestro/flows/copero/new-game.yaml` cubriendo Steps 1-3
- Snapshot test de la hub inicial
- Crash recovery test (storage corrupto)

## Dependencias externas
- AsyncStorage (RN local)
- Sin APIs externas (cliente-only, sin tracking)

## Out of scope
- ❌ Multiplayer online
- ❌ Mercado de pases entre managers (no existe esa feature aún)
- ❌ Tienda in-app real (todo es free-to-play local)
- ❌ Notificaciones push (no persistente ni scheduling remoto)
- ❌ Sync cloud del save (solo local)
