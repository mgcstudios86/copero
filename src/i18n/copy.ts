/**
 * i18n — copy del SiteHeader (MGC-653) + home body (MGC-320).
 *
 * Fuente de verdad única para los strings del header global y los strings
 * del body de la home (MGC-320). Mantenido en un módulo plano (no
 * `i18next`) para evitar agregar dependencias nativas nuevas al bundle
 * (`expo-localization` requiere app.config.js plugin entry y un rebuild
 * nativo; el alcance de MGC-653 es solo el header + home body). Cuando el
 * resto de la app necesite localización, este módulo se migra a `i18next`
 * + `expo-localization` siguiendo el plan documentado en ADR-0014.
 *
 * Locales soportados: `es` (default), `en`, `zh-CN`, `pt-BR` (MGC-320).
 *
 * Patrón de lookup: `t('nav.simulator')` devuelve el string traducido del
 * locale activo, con fallback a `es` si falta la clave en el locale pedido.
 */

// MGC-320 / MGC-357 — `SUPPORTED_LOCALES` es la fuente de verdad única
// para los locales del simulador. Derivamos `Locale` con `(typeof
// SUPPORTED_LOCALES)[number]` para que cualquier alta/baja fluya
// automáticamente al tipo (y rompa en compile-time si alguien olvida
// poblar `COPY`, `LOCALE_LABEL`, etc.). Mantener este orden: `es`
// primero (default) y luego el resto en orden de aparición histórica.
export const SUPPORTED_LOCALES = ['es', 'en', 'zh-CN', 'pt-BR'] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const LOCALE_LABEL: Record<Locale, string> = {
  es: 'ES',
  en: 'EN',
  'zh-CN': '中文',
  'pt-BR': 'PT',
};

export type Copy = {
  brand: string;
  // MGC-320 — strings del body de la home (`app/index.tsx`).
  // Antes el body tenía los strings hardcoded en español (Bug B del
  // padre MGC-306): cambiar el chip del LanguageSwitcher sólo propagaba
  // al header + panel Ajustes, no al splashCopy ni al CTA "Jugar".
  // Estos keys los consume `useLocale().t('home.*')` y el componente
  // se re-renderiza al cambiar el locale porque el provider está en
  // el root layout (`_layout.native.tsx`).
  home: {
    eyebrow: string;
    title: string;
    body: string;
    play: string;
  };
  // MGC-479 / spec PR #655 onboarding-fresh-user step 1 — Welcome screen
  // fullscreen con CTA primario "Empezar" antes de WF1 (identity). Las
  // strings viven en este módulo para mantener la paridad con home.* y
  // permitir re-render al cambiar el locale desde el LanguageSwitcher.
  welcome: {
    eyebrow: string;
    title: string;
    body: string;
    cta: string;
    ctaHint: string;
  };
  nav: {
    simulator: string;
    buildCareer: string;
    fullCareer: string;
    quickCareer: string;
    howToPlay: string;
    mechanics: string;
    faq: string;
    play: string;
    primary: string;
    languageLabel: string;
    menuOpen: string;
    menuClose: string;
    settings: string;
  };
  settings: {
    title: string;
    version: string;
    build: string;
    language: string;
    resetCareer: string;
    howToPlay: string;
    feedback: string;
    feedbackSubject: string;
    close: string;
  };
  // MGC-491 + MGC-555 — namespace `onboarding.*` consumido por
  // `app/onboarding/language.tsx`. Antes del PR, las keys
  // `onboarding.languageTitle`, `onboarding.languageSubtitle`,
  // `onboarding.autoDetectTitle` y `onboarding.autoDetectBody` se
  // resolvían con `t(...) || 'fallback'` (español hardcoded) — el copy
  // nunca quedaba persistido en `en` / `zh-CN` / `pt-BR`. El gate
  // first-launch en `app/_layout*.tsx` redirige al usuario a esta
  // pantalla antes de la home, por lo que las claves tienen que existir
  // en los 4 locales soportados (`SUPPORTED_LOCALES`).
  onboarding: {
    languageTitle: string;
    languageSubtitle: string;
    autoDetectTitle: string;
    autoDetectBody: string;
  };
  // MGC-1534 — strings del form `identity`. El screen debe re-renderizar
  // al cambiar locale (subscribe via `useLocale`) y resolver cada etiqueta
  // visible vía `t()` para que el tap en EN/中文 deje TODAS las strings en
  // su idioma, no sólo el pill del LanguageSwitcher. Strings parametrizadas
  // usan placeholders `"{n}"` / `"{label}"` / `"{position}"` que `locale-context`
  // interpola con el segundo arg de `t()`.
  identity: {
    eyebrow: string;
    title: string;
    subtitle: string;
    stepIndicator: string;
    fieldName: string;
    namePlaceholder: string;
    // MGC-1628 / WF1 — apellido separado del nombre (wireframe §WF1).
    fieldLastName: string;
    lastNamePlaceholder: string;
    // MGC-1628 / WF1 — edad editable 16-35. `ageHelp` se muestra debajo
    // del input como hint estático; `ageA11y` lo lee el screen reader.
    fieldAge: string;
    agePlaceholder: string;
    ageHelp: string;
    ageA11y: string;
    nameA11y: string;
    lastNameA11y: string;
    fieldFoot: string;
    footLeft: string;
    footRight: string;
    footBoth: string;
    fieldNationality: string;
    nationalityPlaceholder: string;
    nationalityNoMatches: string;
    nationalityExpandLabel: string;
    nationalityCollapseLabel: string;
    nationalityCollapseA11y: string;
    nationalityExpandA11y: string;
    nationalityHint: string;
    nationalitySearchA11y: string;
    jerseyEyebrow: string;
    jerseyCaption: string;
    fieldLeague: string;
    leagueOpenHint: string;
    leaguePlaceholder: string;
    leagueSearchPlaceholder: string;
    leagueSearchA11y: string;
    leagueNoMatches: string;
    // MGC-1628 / WF1 — posición como chips horizontales (GK DEF MID FWD)
    // en lugar del field-map (soccer field). `positionChipsA11y` arma el
    // label de cada chip; `groupGk/Def/Mid/Fwd` son las etiquetas visibles.
    fieldPosition: string;
    positionA11y: string;
    positionChipsA11y: string;
    positionGroupGk: string;
    positionGroupDef: string;
    positionGroupMid: string;
    positionGroupFwd: string;
    fieldMapA11y: string;
    numberLabel: string;
    numberDecrement: string;
    numberIncrement: string;
    /** MGC-1647 (WF1): edad reemplaza al stepper de dorsal. */
    ageLabel: string;
    ageErrorLow: string;
    ageErrorHigh: string;
    nameErrorShort: string;
    nameErrorLong: string;
    continueHint: string;
    continue: string;
    continueA11yHint: string;
    nationalityOptionA11y: string;
  };
  // MGC-1648 — strings de la pantalla /team-select (WF2 del alta). Clubs
  // se muestran en español independientemente del locale del jugador (el
  // dominio del juego es fútbol argentino; los nombres propios de los
  // clubes NO se traducen). `cardA11y` se interpola con {name} {league}
  // {reputation} {maxReputation} para que el screen reader anuncie la
  // reputación completa al tabular entre cards.
  teamSelect: {
    eyebrow: string;
    title: string;
    subtitle: string;
    reputationLabel: string;
    reputationValue: string;
    cardA11y: string;
    selectedBadge: string;
    continueHint: string;
    continue: string;
    continueA11yHint: string;
  };
  // MGC-1649 — WF3 season hub + weekly decision placeholder.
  seasonHub: {
    eyebrow: string;
    heroName: string;
    position: string;
    age: string;
    club: string;
    freeAgent: string;
    week: string;
    fatigueEyebrow: string;
    fatigueValue: string;
    statsEyebrow: string;
    statsNote: string;
    statVision: string;
    statPass: string;
    statDribble: string;
    statStamina: string;
    nextMatchEyebrow: string;
    nextMatchVs: string;
    nextMatchJornada: string;
    nextMatchEmpty: string;
    ctaViewTable: string;
    ctaViewTableHint: string;
    ctaDecide: string;
    ctaDecideHint: string;
  };
  weekDecision: {
    eyebrow: string;
    title: string;
    subtitle: string;
    optDoubleShift: string;
    optDoubleShiftDesc: string;
    optSimpleShift: string;
    optSimpleShiftDesc: string;
    optRest: string;
    optRestDesc: string;
    optTraining: string;
    optTrainingDesc: string;
    backHint: string;
  };
  // MGC-1737 (UX1) — selector de rasgos (cap 2). Copy re-escrito:
  // cada rasgo expone nombre legible + descripción corta. El cap
  // ("elegí hasta 2") sale del heading para no chocar con el body.
  // Las claves dinámicas `temporada.traits.${rasgo}.name|desc`
  // resuelven contra `EstiloRasgo` (MGC-1505).
  temporada: {
    traits: {
      eyebrow: string;
      title: string;
      subtitle: string;
      capHint: string;
      itemA11y: string;
      a11ySelected: string;
      a11yNotSelected: string;
      'magneto-mediatico': {
        name: string;
        desc: string;
      };
      trotamundos: {
        name: string;
        desc: string;
      };
    };
  };
  // MGC-1632 (F3.2) — eventos post-partido (ADR-0017 §1/§2).
  postMatch: {
    eyebrow: string;
    title: string;
    ratingLabel: string;
    luckGatePassed: string;
    luckGateBlocked: string;
    continue: string;
    continueHint: string;
    evDescanso: string;
    evDescansoDesc: string;
    evFiesta: string;
    evFiestaDesc: string;
    evGambling: string;
    evGamblingDesc: string;
    evCompraLujosa: string;
    evCompraLujosaDesc: string;
    evPremiacion: string;
    evPremiacionDesc: string;
    sectionLabel: string;
    subtitle: string;
    ratingA11y: string;
    ratingOutstanding: string;
    ratingSolid: string;
    ratingRegular: string;
    ratingPoor: string;
    ratingBad: string;
    changesTitle: string;
    statMoral: string;
    statFisico: string;
    statConfianza: string;
    statGoals: string;
    reputationTitle: string;
    prensa: string;
    hinchada: string;
    vestuario: string;
    repPrensaEnsalzada: string;
    repPrensaNeutral: string;
    repPrensaCritica: string;
    repPrensaHostil: string;
    repHinchadaIdolo: string;
    repHinchadaAceptado: string;
    repHinchadaDiscutido: string;
    repHinchadaOdiado: string;
    repVestuarioCapitan: string;
    repVestuarioIntegrado: string;
    repVestuarioAislado: string;
    nextTitle: string;
    nextWeek: string;
    ctaNextWeek: string;
    ctaNextWeekHint: string;
    ctaBackToHub: string;
    ctaBackToHubHint: string;
    // MGC-246 — etiqueta MVP en pantalla post-match + tarjeta de lesionados.
    mvpBadge: string;
    mvpBadgeA11y: string;
    injuriesTitle: string;
    injuriesEmpty: string;
    injuryKindLeve: string;
    injuryKindMedia: string;
    injuryKindGrave: string;
    injuryRecoveryWeeks: string;
};
  // MGC-1632 (F3.2) — transfer system entre temporadas (ADR-0017 §4).
  transfers: {
    eyebrow: string;
    title: string;
    subtitle: string;
    verdictElite: string;
    verdictStrong: string;
    verdictHold: string;
    verdictHoldLow: string;
    verdictDescent: string;
    verdictRetirement: string;
    noOffers: string;
    forcedTransfer: string;
    deadline: string;
    offerRole: string;
    roleStarter: string;
    roleRotation: string;
    offerYears: string;
    offerWage: string;
    offerReputation: string;
    accept: string;
    acceptHint: string;
    decline: string;
    declineHint: string;
  };
  // MGC-1632 (F3.2) — árbol de decisión completo (ADR-0017 §3).
  decisionTree: {
    nodePretemporada: string;
    nodeEntrenamientoBase: string;
    nodeDobleSesion: string;
    nodeGimnasio: string;
    nodeVideoAnalisis: string;
    nodeCharlaTecnico: string;
    nodeVestuarioTension: string;
    nodePartidoLiga: string;
    nodePartidoCopa: string;
    nodeDerbi: string;
    nodeVisitanteHostil: string;
    nodeRuedaPrensa: string;
    nodeRedesSociales: string;
    nodeOfertaAgente: string;
    nodeConvocatoriaJuvenil: string;
    nodeAmistosoInternacional: string;
    nodeManejoMolestia: string;
    nodeRotacionBanco: string;
    nodeCierreMercado: string;
    nodeFinalTemporada: string;
    outBrillante: string;
    outSolido: string;
    outCorrecto: string;
    outIrregular: string;
    outFlojo: string;
    outDesastre: string;
  };
  // MGC-1650 (WF4 partido) — strings de la pantalla `/match`.
  match: {
    loading: string;
    loadError: string;
    ctaLoadErrorBack: string;
    weekLabel: string;
    title: string;
    subtitle: string;
    finalLabel: string;
    rival: string;
    cleanSheet: string;
    resultClosed: string;
    eventsTitle: string;
    noEvents: string;
    goalEvent: string;
    yourGameTitle: string;
    statGoals: string;
    statAst: string;
    statPassPct: string;
    statMinutes: string;
    ctaFinalize: string;
    ctaFinalizeHint: string;
  };

  /**
   * MGC-1736 (WF6) — fin de carrera / retiro. i18n paridad es/en/zh-CN.
   * El placeholder `{{initial}}`, `{{final}}` y `{{age}}` se sustituyen
   * con el OVR inicial/final y la edad de retiro.
   */
  retire: {
    eyebrow: string;
    title: string;
    subtitle: string;
    statRetirementAge: string;
    statFinalOvr: string;
    statApps: string;
    statGoalsAssists: string;
    attributesTitle: string;
    attributesA11y: string;
    trophyTitle: string;
    trophyEmpty: string;
    legadoTitle: string;
    ovrDelta: string;
    legadoLead: string;
    retiredAt: string;
    restart: string;
    restartA11y: string;
    backSeason: string;
    backSeasonA11y: string;
    notFinished: string;
    // MGC-215 — modal de confirmación destructiva antes de "Nueva partida".
    // El CTA es destructivo (limpia AsyncStorage + memoria + navega a
    // /identity) y no debe dispararse con un tap accidental.
    confirmTitle: string;
    confirmBody: string;
    confirmAccept: string;
    confirmCancel: string;
    confirmDismiss: string;
  };
  // MGC-497 — namespace `copa` para el Modo Copero (copa nacional).
  // Cubre el banner de slot disponible, modal de inscripción, etiquetas de
  // rondas (32/16/8/semis/final), fallback a 16 (gate #1 CTO) y modal de
  // celebración del campeón. Locales requeridos: es, en, zh-CN, pt-BR.
  copa: {
    bannerEyebrow: string;
    bannerTitle: string;
    bannerBody: string;
    bannerCta: string;
    inscriptionTitle: string;
    inscriptionBody: string;
    inscriptionAccept: string;
    inscriptionCancel: string;
    bracketTitle: string;
    bracketSubtitle: string;
    /** Etiquetas de ronda. round32/round16/round8/semifinal/final. */
    round32: string;
    round16: string;
    round8: string;
    semifinal: string;
    final: string;
    /** Aviso de fallback a 16 equipos (gate #1 wording CTO). */
    fallbackNoticeTitle: string;
    fallbackNoticeBody: string;
    /** Modal de celebración del campeón (Step 6 del flow). */
    championTitle: string;
    championBadge: string;
    championContinue: string;
    /** Modal de eliminación (Step 5 alternativa). */
    eliminatedTitle: string;
    eliminatedBody: string;
    eliminatedContinue: string;
    /** Slot state copy. */
    slotEmpty: string;
    slotActive: string;
  };
  // MGC-487.1 — namespace `playoff`. Cubre el CTA del calendario
  // ("Ir a playoffs") que se muestra tras la fecha 34 (semanas
  // 35–37, antes del cierre de temporada en 38) y navega a
  // /simulador-carrera/playoff. Las pantallas `playoff.tsx`
  // siguen con strings inline (F2) — esta migración es sólo el
  // disparador desde el calendario.
  playoff: {
    ctaOpenBracket: string;
    ctaOpenBracketHint: string;
  };

};

export const COPY: Record<Locale, Copy> = {
  es: {
    brand: 'Copero',
    // MGC-320 — body home en español (default).
    home: {
      eyebrow: 'COPERO · SIMULADOR DE CARRERA',
      title: 'Convertite en leyenda',
      body: 'Tomá decisiones, asumí consecuencias y construí tu carrera futbolística paso a paso.',
      play: 'Jugar',
    },
    // MGC-479 — Welcome screen (onboarding-fresh-user step 1).
    welcome: {
      eyebrow: 'COPERO · BIENVENIDO',
      title: 'Bienvenido a Copero',
      body: 'Tu carrera futbolística empieza acá. Creá tu jugador, elegí un club y empezá a competir semana a semana.',
      cta: 'Empezar',
      ctaHint: 'Abre el formulario de identidad para crear tu jugador',
    },
    nav: {
      simulator: 'Simulador de carrera',
      buildCareer: 'Crea tu carrera',
      fullCareer: 'Carrera completa',
      quickCareer: 'Carrera rápida',
      howToPlay: 'Cómo jugar',
      mechanics: 'Mecánicas',
      faq: 'FAQ',
      play: 'Jugar',
      primary: 'Navegación principal',
      languageLabel: 'Cambiar idioma',
      menuOpen: 'Abrir menú',
      menuClose: 'Cerrar menú',
      settings: 'Ajustes',
    },
    settings: {
      title: 'Ajustes',
      version: 'Versión',
      build: 'Build',
      language: 'Idioma',
      resetCareer: 'Resetear carrera',
      howToPlay: 'Cómo jugar',
      feedback: 'Enviar feedback',
      feedbackSubject: 'Feedback Copero',
      close: 'Cerrar',
    },
    // MGC-491 + MGC-555 — selector de idioma (es default).
    onboarding: {
      languageTitle: 'Elegí tu idioma',
      languageSubtitle:
        'Tu idioma define los textos y el formato regional (fechas, números, moneda). Podés cambiarlo cuando quieras desde Ajustes.',
      autoDetectTitle: 'Detectamos tu ubicación',
      autoDetectBody:
        'Si tu dispositivo está en otro idioma, podés mantener el actual o cambiar manualmente abajo.',
    },
    identity: {
      eyebrow: 'COPERO · NUEVA CARRERA',
      title: 'Creá tu jugador',
      subtitle: 'Paso 1 de 2 — Tu jugador',
      stepIndicator: 'Paso 1 de 2',
      fieldName: 'Nombre',
      namePlaceholder: 'Ej. Lionel',
      fieldLastName: 'Apellido',
      lastNamePlaceholder: 'Ej. Messi',
      fieldAge: 'Edad (16–35)',
      agePlaceholder: '19',
      ageHelp: 'Tu jugador arranca a esta edad y se retira a los 35.',
      ageA11y: 'Edad del jugador, entre 16 y 35 años',
      nameA11y: 'Nombre del jugador',
      lastNameA11y: 'Apellido del jugador',
      fieldFoot: 'Pierna hábil',
      footLeft: 'Izquierda',
      footRight: 'Derecha',
      footBoth: 'Ambas',
      fieldNationality: 'Nacionalidad',
      nationalityPlaceholder: 'Buscar país…',
      nationalityNoMatches: 'Sin coincidencias.',
      nationalityExpandLabel: 'Ver todas las {n}',
      nationalityCollapseLabel: 'Ver menos',
      nationalityCollapseA11y: 'Ver menos nacionalidades',
      nationalityExpandA11y: 'Ver todas las {n} nacionalidades',
      nationalityHint: 'Escribí para buscar entre las {n} nacionalidades.',
      nationalitySearchA11y: 'Seleccionar nacionalidad',
      jerseyEyebrow: 'VISTA PREVIA DE CAMISETA',
      jerseyCaption: '{position} · OVR 50',
      fieldLeague: 'Liga de origen',
      leagueOpenHint: 'Abre la lista de ligas',
      leaguePlaceholder: 'Seleccionar liga…',
      leagueSearchPlaceholder: 'Buscar liga…',
      leagueSearchA11y: 'Buscar liga',
      leagueNoMatches: 'Sin coincidencias.',
      fieldPosition: 'Posición',
      positionA11y: 'Posición {label}',
      positionChipsA11y: 'Posición: {label}',
      positionGroupGk: 'GK',
      positionGroupDef: 'DEF',
      positionGroupMid: 'MID',
      positionGroupFwd: 'FWD',
      fieldMapA11y: 'Mapa del campo con posiciones',
      numberLabel: 'NÚMERO (1–99)',
      numberDecrement: 'Restar número',
      numberIncrement: 'Sumar número',
      // MGC-1647 (WF1): edad reemplaza al stepper de dorsal.
      ageLabel: 'EDAD (16–35)',
      ageErrorLow: 'La edad mínima es 16 años.',
      ageErrorHigh: 'La edad máxima es 35 años.',
      nameErrorShort: 'El nombre debe tener al menos 2 caracteres.',
      nameErrorLong: 'El nombre no puede superar los 24 caracteres.',
      continueHint: 'Completá nombre y apellido para continuar.',
      continue: 'Continuar → Elegir equipo',
      continueA11yHint: 'Guarda la identidad y abre la selección de club',
      nationalityOptionA11y: 'Seleccionar nacionalidad {name}',
    },
    teamSelect: {
      eyebrow: 'ELEGÍ TU CLUB',
      title: '¿En qué club empezás tu carrera?',
      subtitle:
        'Tu primer club define el arranque. Después, entre temporadas, podés recibir ofertas de equipos con mejor reputación.',
      reputationLabel: 'REPUTACIÓN',
      reputationValue: '{n} / 5',
      cardA11y: '{name}, {league}, reputación {reputation} de {maxReputation}',
      selectedBadge: 'Seleccionado',
      continueHint: 'Tocá un club para seleccionarlo.',
      continue: 'Empezar carrera',
      continueA11yHint: 'Guarda el club elegido y abre el dashboard',
    },
    // MGC-1649 — WF3 hub de temporada + placeholder de decisión semanal.
    seasonHub: {
      eyebrow: 'HUB DE TEMPORADA',
      heroName: '{name}',
      position: '{position}',
      age: '{age} años',
      club: '{club}',
      freeAgent: 'Sin club',
      week: 'SEMANA {week}/38',
      fatigueEyebrow: 'FATIGA',
      fatigueValue: '{value}/100',
      statsEyebrow: 'STATS DE LA POSICIÓN',
      statsNote: 'Otras posiciones se suman en F2',
      statVision: 'Visión',
      statPass: 'Pase',
      statDribble: 'Dribling',
      statStamina: 'Resistencia',
      nextMatchEyebrow: 'PRÓXIMO PARTIDO',
      nextMatchVs: 'vs {rival}',
      nextMatchJornada: 'Jornada {week}',
      nextMatchEmpty: 'Aún sin rival',
      ctaViewTable: 'Ver tabla',
      ctaViewTableHint: 'Abre el timeline de temporadas',
      ctaDecide: 'Decidir semana →',
      ctaDecideHint: 'Abre la decisión semanal con las 4 opciones',
    },
    weekDecision: {
      eyebrow: 'DECISIÓN SEMANAL',
      title: '¿Qué hacés esta semana?',
      subtitle: 'Elegí una opción. F2 la reemplaza por el árbol posicional completo.',
      optDoubleShift: 'Doble turno',
      optDoubleShiftDesc: 'Alto riesgo · alta recompensa. Aumenta fatiga.',
      optSimpleShift: 'Turno simple',
      optSimpleShiftDesc: 'Balance · riesgo bajo · deltas moderados.',
      optRest: 'Descanso',
      optRestDesc: 'Recuperás fatiga · sin partido esta semana.',
      optTraining: 'Entrenamiento físico',
      optTrainingDesc: 'Mejora stat posicional concreta.',
      backHint: 'Volver al hub de temporada',
    },
    temporada: {
      traits: {
        eyebrow: 'RASGOS DEL JUGADOR',
        title: 'Cómo se comporta tu jugador',
        subtitle: 'Tocá uno o dos rasgos para definir tu estilo. Cada uno cambia cómo se desarrollan los eventos y las ofertas de club.',
        capHint: 'Máximo 2 rasgos',
        itemA11y: 'Rasgo {name}, {selected}',
        a11ySelected: 'seleccionado',
        a11yNotSelected: 'no seleccionado',
        'magneto-mediatico': {
          name: 'Magneto mediático',
          desc: 'Atrae sponsors y portadas. Más ofertas y eventos mediáticos, pero mayor exposición.',
        },
        trotamundos: {
          name: 'Trotamundos',
          desc: 'Se adapta rápido a ligas nuevas. Mejores transferencias internacionales y drift OVR en el exterior.',
        },
      },
    },
    postMatch: {
      eyebrow: 'DESPUÉS DEL PARTIDO',
      title: '¿Cómo cerrás la noche?',
      ratingLabel: 'Puntaje del partido',
      luckGatePassed: 'Tu nivel sostiene la racha: la suerte juega a favor esta semana.',
      luckGateBlocked: 'Sin nivel no hay suerte que alcance: pagás el desgaste sin premio.',
      continue: 'Seguir',
      continueHint: 'Cerrar el evento y avanzar a la semana siguiente',
      evDescanso: 'Descanso',
      evDescansoDesc: 'Te quedás en casa. Recuperás físico y cerrás la semana tranquilo.',
      evFiesta: 'Fiesta',
      evFiestaDesc: 'Salís a festejar con el plantel. Sube la moral, baja el físico.',
      evGambling: 'Timba',
      evGamblingDesc: 'La noche termina en la mesa de juego. Trasnoche, resaca y más riesgo de lesión.',
      evCompraLujosa: 'Compra de lujo',
      evCompraLujosaDesc: 'Te das un gusto caro. Moral por las nubes, cabeza menos en el entrenamiento.',
      evPremiacion: 'Premio individual',
      evPremiacionDesc: 'Te eligen figura de la fecha. Moral y confianza al máximo.',
      sectionLabel: 'RESUMEN DEL PARTIDO',
      subtitle: 'Tu calificación y los cambios que se aplicarán al confirmar.',
      ratingA11y: 'Calificación {rating} sobre 10',
      ratingOutstanding: ' actuación brillante',
      ratingSolid: ' actuación sólida',
      ratingRegular: ' partido correcto',
      ratingPoor: ' por debajo de lo esperado',
      ratingBad: ' noche difícil',
      changesTitle: 'CAMBIOS',
      statMoral: 'Moral',
      statFisico: 'Energía',
      statConfianza: 'Confianza',
      statGoals: 'Goles del partido',
      reputationTitle: 'REPUTACIÓN',
      prensa: 'Prensa: {value}',
      hinchada: 'Hinchada: {value}',
      vestuario: 'Vestuario: {value}',
      repPrensaEnsalzada: 'ensalzada',
      repPrensaNeutral: 'neutral',
      repPrensaCritica: 'crítica',
      repPrensaHostil: 'hostil',
      repHinchadaIdolo: 'ídolo',
      repHinchadaAceptado: 'aceptado',
      repHinchadaDiscutido: 'discutido',
      repHinchadaOdiado: 'odiado',
      repVestuarioCapitan: 'capitán moral',
      repVestuarioIntegrado: 'integrado',
      repVestuarioAislado: 'aislado',
      nextTitle: 'PRÓXIMO',
      nextWeek: 'Semana {week} / 38',
      ctaNextWeek: 'Siguiente semana →',
      ctaNextWeekHint: 'Aplica los cambios y avanza a la próxima fecha',
      ctaBackToHub: 'Volver al hub',
      ctaBackToHubHint: 'Descarta los cambios y vuelve al dashboard',
      // MGC-246 — etiqueta MVP + tarjeta de lesionados.
      mvpBadge: 'MVP',
      mvpBadgeA11y: 'Figura del partido',
      injuriesTitle: 'LESIONADOS',
      injuriesEmpty: 'Sin lesionados en este partido.',
      injuryKindLeve: 'Lesión leve',
      injuryKindMedia: 'Lesión media',
      injuryKindGrave: 'Lesión grave',
      injuryRecoveryWeeks: '{count} sem. de recuperación',
},
    transfers: {
      eyebrow: 'MERCADO DE PASES',
      title: 'Cierre de temporada',
      subtitle: 'Tu rendimiento define qué clubes te buscan.',
      verdictElite: 'Los grandes te quieren. Tres ofertas de elite sobre la mesa.',
      verdictStrong: 'Buena temporada. Dos clubes del medio te hacen propuesta.',
      verdictHold: 'Temporada correcta. Te quedás salvo que aparezca algo mejor.',
      verdictHoldLow: 'Temporada floja pero sin alarma. Seguís donde estás.',
      verdictDescent: 'Temporada mala. El club te empuja a salir.',
      verdictRetirement: 'Se termina el camino. Es hora de colgar los botines.',
      noOffers: 'No llegó ninguna oferta. Seguís en el club.',
      forcedTransfer: 'Salida forzada: el club no te quiere para la próxima.',
      deadline: 'Tenés hasta la semana {{week}} para decidir.',
      offerRole: 'Rol esperado',
      roleStarter: 'Titular',
      roleRotation: 'Rotación',
      offerYears: 'Contrato',
      offerWage: 'Sueldo',
      offerReputation: 'Reputación',
      accept: 'Aceptar',
      acceptHint: 'Fichar por este club',
      decline: 'Rechazar todo',
      declineHint: 'Quedarte en tu club actual',
    },
    decisionTree: {
      nodePretemporada: 'Pretemporada: el cuerpo técnico mide de cero.',
      nodeEntrenamientoBase: 'Entrenamiento de la semana con el plantel.',
      nodeDobleSesion: 'Doble sesión: mañana y tarde sin respiro.',
      nodeGimnasio: 'Trabajo de gimnasio y fuerza.',
      nodeVideoAnalisis: 'Sesión de video con el analista.',
      nodeCharlaTecnico: 'Charla mano a mano con el técnico.',
      nodeVestuarioTension: 'Tensión en el vestuario después del último resultado.',
      nodePartidoLiga: 'Partido de liga: fecha común.',
      nodePartidoCopa: 'Partido de copa: eliminación directa.',
      nodeDerbi: 'Clásico: el partido del año.',
      nodeVisitanteHostil: 'Visitante en cancha hostil.',
      nodeRuedaPrensa: 'Rueda de prensa con periodistas filosos.',
      nodeRedesSociales: 'Se te va la mano en redes sociales.',
      nodeOfertaAgente: 'Tu representante trae una propuesta.',
      nodeConvocatoriaJuvenil: 'Convocatoria al seleccionado juvenil.',
      nodeAmistosoInternacional: 'Amistoso internacional con viaje largo.',
      nodeManejoMolestia: 'Arrastrás una molestia: hay que manejarla.',
      nodeRotacionBanco: 'Rotación: arrancás en el banco.',
      nodeCierreMercado: 'Última semana del mercado de pases.',
      nodeFinalTemporada: 'Final de temporada: se define todo.',
      outBrillante: 'Brillante',
      outSolido: 'Sólido',
      outCorrecto: 'Correcto',
      outIrregular: 'Irregular',
      outFlojo: 'Flojo',
      outDesastre: 'Desastre',
    },
    // MGC-1650 (WF4) — pantalla /match.
    match: {
      loading: 'Cargando partido…',
      loadError: 'No pudimos cargar el partido. Volvé al hub e intentá de nuevo.',
      ctaLoadErrorBack: 'Volver al hub',
      weekLabel: 'SEMANA',
      title: 'Tu partido',
      subtitle: 'Resultado, eventos y tu rendimiento en la fecha.',
      finalLabel: 'FINAL',
      rival: 'Rival',
      cleanSheet: 'Valla invicta',
      resultClosed: 'Resultado cerrado',
      eventsTitle: 'EVENTOS',
      noEvents: 'Sin goles en este partido.',
      goalEvent: 'Gol. Definición letal.',
      yourGameTitle: 'TU PARTIDO',
      statGoals: 'Goles',
      statAst: 'Asist.',
      statPassPct: 'Pase %',
      statMinutes: 'Minutos',
      ctaFinalize: 'Finalizar partido',
      ctaFinalizeHint: 'Pasa a la pantalla de post-partido para confirmar',
    },
    // MGC-1736 (WF6) — fin de carrera / retiro.
    retire: {
      eyebrow: 'CARRERA COMPLETA',
      title: 'FIN DE CARRERA',
      subtitle: 'Cierre de la carrera. Resumen de tus mejores temporadas, vitrina y legado.',
      statRetirementAge: 'EDAD DE RETIRO',
      statFinalOvr: 'OVR FINAL',
      statApps: 'PARTIDOS',
      statGoalsAssists: 'GOLES + ASIST.',
      attributesTitle: 'ATRIBUTOS AL RETIRO',
      attributesA11y: 'Atributos al retiro',
      trophyTitle: 'VITRINA',
      trophyEmpty: 'Sin títulos en tu carrera.',
      legadoTitle: 'LEGADO',
      ovrDelta: 'OVR {{initial}} → {{final}}',
      legadoLead: 'Cresciste de rookie a referente.',
      retiredAt: 'Te retiraste a los {{age}} años.',
      restart: 'Empezar nueva carrera',
      restartA11y: 'Borra la carrera actual y vuelve al inicio',
      backSeason: 'Volver a la temporada',
      backSeasonA11y: 'Regresa al hub de temporada',
      notFinished: 'Tu carrera todavía no terminó. Volvé a la temporada para jugarla completa.',
      // MGC-215 — modal de confirmación antes del wipe.
      confirmTitle: '¿Empezar una nueva carrera?',
      confirmBody: 'Vas a borrar la partida guardada, el high score del juego y el progreso del quiz. La app queda como recién instalada.',
      confirmAccept: 'Sí, borrar todo',
      confirmCancel: 'Cancelar',
      confirmDismiss: 'Cerrar el diálogo sin borrar',
    },
    copa: {
      bannerEyebrow: 'MODO COPERO',
      bannerTitle: 'Copa nacional disponible',
      bannerBody: 'Inscribí tu equipo y disputá la copa nacional con bracket determinista de {size} equipos.',
      bannerCta: 'Iniciar Modo Copero',
      inscriptionTitle: '¿Inscribir tu equipo en la copa?',
      inscriptionBody: 'Se generará un bracket con {size} equipos usando una seed determinista. Tu posición en la siembra depende del ranking actual.',
      inscriptionAccept: 'Inscribir equipo',
      inscriptionCancel: 'Cancelar',
      bracketTitle: 'Copa nacional',
      bracketSubtitle: 'Ronda {round} de {total}',
      round32: 'Ronda de 32',
      round16: 'Octavos de final',
      round8: 'Cuartos de final',
      semifinal: 'Semifinal',
      final: 'Final',
      fallbackNoticeTitle: 'Copa con bracket reducido',
      fallbackNoticeBody: 'Hay {teams} equipos inscritos. El bracket se ajusta automáticamente a la potencia de 2 más cercana con byes.',
      championTitle: '¡Sos el campeón de la copa!',
      championBadge: 'Campeón de la Copa N',
      championContinue: 'Volver al inicio',
      eliminatedTitle: 'Eliminado de la copa',
      eliminatedBody: 'Tu equipo quedó fuera del bracket. El slot se libera y podés reinscribirte la próxima temporada.',
      eliminatedContinue: 'Volver a la temporada',
      slotEmpty: 'Sin copa activa',
      slotActive: 'Copa activa · Ronda {round}',
    },
    // MGC-487.1 — CTA de playoffs desde el calendario (es-AR).
    playoff: {
      ctaOpenBracket: 'Ir a playoffs',
      ctaOpenBracketHint: 'Resolver cuartos, semis y final',
    },
  },
  en: {
    brand: 'Copero',
    // MGC-320 — body home en inglés.
    home: {
      eyebrow: 'COPERO · CAREER SIMULATOR',
      title: 'Become a legend',
      body: 'Make decisions, face consequences and build your football career one step at a time.',
      play: 'Play',
    },
    // MGC-479 — Welcome screen (en).
    welcome: {
      eyebrow: 'COPERO · WELCOME',
      title: 'Welcome to Copero',
      body: 'Your football career starts here. Create your player, pick a club and start competing week by week.',
      cta: 'Start',
      ctaHint: 'Opens the identity form to create your player',
    },
    nav: {
      simulator: 'Career Simulator',
      buildCareer: 'Build your career',
      fullCareer: 'Full career',
      quickCareer: 'Quick career',
      howToPlay: 'How to play',
      mechanics: 'Mechanics',
      faq: 'FAQ',
      play: 'Play',
      primary: 'Primary navigation',
      languageLabel: 'Change language',
      menuOpen: 'Open menu',
      menuClose: 'Close menu',
      settings: 'Settings',
    },
    settings: {
      title: 'Settings',
      version: 'Version',
      build: 'Build',
      language: 'Language',
      resetCareer: 'Reset career',
      howToPlay: 'How to play',
      feedback: 'Send feedback',
      feedbackSubject: 'Copero feedback',
      close: 'Close',
    },
    // MGC-491 + MGC-555 — selector de idioma (en).
    onboarding: {
      languageTitle: 'Choose your language',
      languageSubtitle:
        'Your language defines the in-app text and regional format (dates, numbers, currency). You can change it anytime from Settings.',
      autoDetectTitle: 'We detected your location',
      autoDetectBody:
        'If your device is set to another language, you can keep it or switch manually below.',
    },
    identity: {
      eyebrow: 'COPERO · NEW CAREER',
      title: 'Create your player',
      subtitle: 'Step 1 of 2 — Your player',
      stepIndicator: 'Step 1 of 2',
      fieldName: 'Name',
      namePlaceholder: 'e.g. Lionel',
      fieldLastName: 'Last name',
      lastNamePlaceholder: 'e.g. Messi',
      fieldAge: 'Age (16–35)',
      agePlaceholder: '19',
      ageHelp: 'Your player starts at this age and retires at 35.',
      ageA11y: 'Player age, between 16 and 35',
      nameA11y: 'Player name',
      lastNameA11y: 'Player last name',
      fieldFoot: 'Preferred foot',
      footLeft: 'Left',
      footRight: 'Right',
      footBoth: 'Both',
      fieldNationality: 'Nationality',
      nationalityPlaceholder: 'Search country…',
      nationalityNoMatches: 'No matches.',
      nationalityExpandLabel: 'See all {n}',
      nationalityCollapseLabel: 'See less',
      nationalityCollapseA11y: 'See fewer nationalities',
      nationalityExpandA11y: 'See all {n} nationalities',
      nationalityHint: 'Type to search across the {n} nationalities.',
      nationalitySearchA11y: 'Select nationality',
      jerseyEyebrow: 'JERSEY PREVIEW',
      jerseyCaption: '{position} · OVR 50',
      fieldLeague: 'Home league',
      leagueOpenHint: 'Open the league list',
      leaguePlaceholder: 'Pick a league…',
      leagueSearchPlaceholder: 'Search league…',
      leagueSearchA11y: 'Search league',
      leagueNoMatches: 'No matches.',
      fieldPosition: 'Position',
      positionA11y: 'Position {label}',
      positionChipsA11y: 'Position: {label}',
      positionGroupGk: 'GK',
      positionGroupDef: 'DEF',
      positionGroupMid: 'MID',
      positionGroupFwd: 'FWD',
      fieldMapA11y: 'Pitch map with positions',
      numberLabel: 'NUMBER (1–99)',
      numberDecrement: 'Decrease number',
      numberIncrement: 'Increase number',
      // MGC-1647 (WF1): age replaces the jersey-number stepper.
      ageLabel: 'AGE (16–35)',
      ageErrorLow: 'Minimum age is 16.',
      ageErrorHigh: 'Maximum age is 35.',
      nameErrorShort: 'Name must be at least 2 characters.',
      nameErrorLong: 'Name cannot exceed 24 characters.',
      continueHint: 'Fill in first and last name to continue.',
      continue: 'Continue → Choose team',
      continueA11yHint: 'Saves your identity and opens club selection',
      nationalityOptionA11y: 'Select nationality {name}',
    },
    teamSelect: {
      eyebrow: 'PICK YOUR CLUB',
      title: 'Where do you start your career?',
      subtitle:
        'Your first club shapes the early game. Between seasons you may receive offers from higher-reputation teams.',
      reputationLabel: 'REPUTATION',
      reputationValue: '{n} / 5',
      cardA11y: '{name}, {league}, reputation {reputation} of {maxReputation}',
      selectedBadge: 'Selected',
      continueHint: 'Tap a club to select it.',
      continue: 'Start career',
      continueA11yHint: 'Saves your club and opens the dashboard',
    },
    // MGC-1649 — WF3 hub of season + weekly decision placeholder.
    seasonHub: {
      eyebrow: 'SEASON HUB',
      heroName: '{name}',
      position: '{position}',
      age: '{age} yo',
      club: '{club}',
      freeAgent: 'Free agent',
      week: 'WEEK {week}/38',
      fatigueEyebrow: 'FATIGUE',
      fatigueValue: '{value}/100',
      statsEyebrow: 'POSITION STATS',
      statsNote: 'Other positions added in F2',
      statVision: 'Vision',
      statPass: 'Pass',
      statDribble: 'Dribbling',
      statStamina: 'Stamina',
      nextMatchEyebrow: 'NEXT MATCH',
      nextMatchVs: 'vs {rival}',
      nextMatchJornada: 'Matchday {week}',
      nextMatchEmpty: 'No opponent yet',
      ctaViewTable: 'View table',
      ctaViewTableHint: 'Opens the season timeline',
      ctaDecide: 'Decide week →',
      ctaDecideHint: 'Opens the weekly decision with the 4 options',
    },
    weekDecision: {
      eyebrow: 'WEEKLY DECISION',
      title: 'What do you do this week?',
      subtitle: 'Pick one option. F2 replaces this with the full positional tree.',
      optDoubleShift: 'Double shift',
      optDoubleShiftDesc: 'High risk · high reward. Increases fatigue.',
      optSimpleShift: 'Simple shift',
      optSimpleShiftDesc: 'Balanced · low risk · moderate deltas.',
      optRest: 'Rest',
      optRestDesc: 'Recover fatigue · no match this week.',
      optTraining: 'Physical training',
      optTrainingDesc: 'Boosts a specific position stat.',
      backHint: 'Back to the season hub',
    },
    temporada: {
      traits: {
        eyebrow: 'PLAYER TRAITS',
        title: 'How your player behaves',
        subtitle: 'Tap one or two traits to define your style. Each one changes how events unfold and which clubs come calling.',
        capHint: 'Up to 2 traits',
        itemA11y: 'Trait {name}, {selected}',
        a11ySelected: 'selected',
        a11yNotSelected: 'not selected',
        'magneto-mediatico': {
          name: 'Media magnet',
          desc: 'Pulls sponsors and headlines. More offers and media events, but higher exposure.',
        },
        trotamundos: {
          name: 'Globetrotter',
          desc: 'Adapts quickly to new leagues. Better international transfers and OVR drift abroad.',
        },
      },
    },
    postMatch: {
      eyebrow: 'AFTER THE MATCH',
      title: 'How do you end the night?',
      ratingLabel: 'Match rating',
      luckGatePassed: 'Your level backs the run: luck works in your favour this week.',
      luckGateBlocked: 'No level, no luck: you pay the wear without the reward.',
      continue: 'Continue',
      continueHint: 'Close the event and move to next week',
      evDescanso: 'Rest',
      evDescansoDesc: 'You stay home. You recover fitness and close the week calmly.',
      evFiesta: 'Party',
      evFiestaDesc: 'You go out with the squad. Morale up, fitness down.',
      evGambling: 'Gambling',
      evGamblingDesc: 'The night ends at the table. Late hours, hangover and higher injury risk.',
      evCompraLujosa: 'Luxury purchase',
      evCompraLujosaDesc: 'You treat yourself. Morale soars, focus on training drops.',
      evPremiacion: 'Individual award',
      evPremiacionDesc: 'You are named player of the round. Morale and confidence at their peak.',
      sectionLabel: 'MATCH SUMMARY',
      subtitle: 'Your rating and the changes that will apply on confirm.',
      ratingA11y: 'Rating {rating} out of 10',
      ratingOutstanding: ' outstanding performance',
      ratingSolid: ' solid performance',
      ratingRegular: ' average performance',
      ratingPoor: ' below expectations',
      ratingBad: ' tough night',
      changesTitle: 'CHANGES',
      statMoral: 'Morale',
      statFisico: 'Energy',
      statConfianza: 'Confidence',
      statGoals: 'Match goals',
      reputationTitle: 'REPUTATION',
      prensa: 'Press: {value}',
      hinchada: 'Fans: {value}',
      vestuario: 'Locker room: {value}',
      repPrensaEnsalzada: 'praised',
      repPrensaNeutral: 'neutral',
      repPrensaCritica: 'critical',
      repPrensaHostil: 'hostile',
      repHinchadaIdolo: 'idol',
      repHinchadaAceptado: 'accepted',
      repHinchadaDiscutido: 'controversial',
      repHinchadaOdiado: 'vilified',
      repVestuarioCapitan: 'moral captain',
      repVestuarioIntegrado: 'integrated',
      repVestuarioAislado: 'isolated',
      nextTitle: 'NEXT',
      nextWeek: 'Week {week} / 38',
      ctaNextWeek: 'Next week →',
      ctaNextWeekHint: 'Apply the changes and advance to the next matchweek',
      ctaBackToHub: 'Back to hub',
      ctaBackToHubHint: 'Discard the changes and return to the dashboard',
      // MGC-246 — MVP badge + injuries card.
      mvpBadge: 'MVP',
      mvpBadgeA11y: 'Player of the match',
      injuriesTitle: 'INJURIES',
      injuriesEmpty: 'No injuries in this match.',
      injuryKindLeve: 'Minor injury',
      injuryKindMedia: 'Moderate injury',
      injuryKindGrave: 'Severe injury',
      injuryRecoveryWeeks: '{count} wk of recovery',
},
    transfers: {
      eyebrow: 'TRANSFER WINDOW',
      title: 'End of season',
      subtitle: 'Your performance decides which clubs come after you.',
      verdictElite: 'The big clubs want you. Three elite offers on the table.',
      verdictStrong: 'Good season. Two mid-table clubs make a bid.',
      verdictHold: 'Decent season. You stay unless something better shows up.',
      verdictHoldLow: 'Weak season, but no alarm. You stay where you are.',
      verdictDescent: 'Bad season. The club pushes you out.',
      verdictRetirement: 'The road ends here. Time to hang up the boots.',
      noOffers: 'No offers arrived. You stay at the club.',
      forcedTransfer: 'Forced exit: the club does not want you next season.',
      deadline: 'You have until week {{week}} to decide.',
      offerRole: 'Expected role',
      roleStarter: 'Starter',
      roleRotation: 'Rotation',
      offerYears: 'Contract',
      offerWage: 'Wage',
      offerReputation: 'Reputation',
      accept: 'Accept',
      acceptHint: 'Sign for this club',
      decline: 'Decline all',
      declineHint: 'Stay at your current club',
    },
    decisionTree: {
      nodePretemporada: 'Pre-season: the staff measures you from scratch.',
      nodeEntrenamientoBase: 'Regular week of training with the squad.',
      nodeDobleSesion: 'Double session: morning and afternoon, no rest.',
      nodeGimnasio: 'Gym and strength work.',
      nodeVideoAnalisis: 'Video session with the analyst.',
      nodeCharlaTecnico: 'One-on-one talk with the manager.',
      nodeVestuarioTension: 'Tension in the dressing room after the last result.',
      nodePartidoLiga: 'League match: regular round.',
      nodePartidoCopa: 'Cup match: knockout tie.',
      nodeDerbi: 'Derby: the match of the year.',
      nodeVisitanteHostil: 'Away at a hostile ground.',
      nodeRuedaPrensa: 'Press conference with sharp reporters.',
      nodeRedesSociales: 'You go too far on social media.',
      nodeOfertaAgente: 'Your agent brings a proposal.',
      nodeConvocatoriaJuvenil: 'Call-up to the youth national team.',
      nodeAmistosoInternacional: 'International friendly with a long trip.',
      nodeManejoMolestia: 'You are carrying a knock: it has to be managed.',
      nodeRotacionBanco: 'Rotation: you start on the bench.',
      nodeCierreMercado: 'Final week of the transfer window.',
      nodeFinalTemporada: 'Season finale: everything is on the line.',
      outBrillante: 'Brilliant',
      outSolido: 'Solid',
      outCorrecto: 'Decent',
      outIrregular: 'Patchy',
      outFlojo: 'Poor',
      outDesastre: 'Disaster',
    },
    // MGC-1650 (WF4) — /match screen.
    match: {
      loading: 'Loading match…',
      loadError: 'We could not load the match. Go back to the hub and try again.',
      ctaLoadErrorBack: 'Back to hub',
      weekLabel: 'WEEK',
      title: 'Your match',
      subtitle: 'Final score, events and your performance for the week.',
      finalLabel: 'FULL TIME',
      rival: 'Opponent',
      cleanSheet: 'Clean sheet',
      resultClosed: 'Result closed',
      eventsTitle: 'EVENTS',
      noEvents: 'No goals in this match.',
      goalEvent: 'Goal. Clinical finish.',
      yourGameTitle: 'YOUR GAME',
      statGoals: 'Goals',
      statAst: 'Assists',
      statPassPct: 'Pass %',
      statMinutes: 'Minutes',
      ctaFinalize: 'Finish match',
      ctaFinalizeHint: 'Open the post-match screen to confirm',
    },
    // MGC-1736 (WF6) — fin de carrera / retiro.
    retire: {
      eyebrow: 'CAREER COMPLETE',
      title: 'END OF CAREER',
      subtitle: 'Career closing. Summary of your best seasons, trophy room and legacy.',
      statRetirementAge: 'RETIREMENT AGE',
      statFinalOvr: 'FINAL OVR',
      statApps: 'MATCHES',
      statGoalsAssists: 'GOALS + ASSISTS',
      attributesTitle: 'ATTRIBUTES AT RETIREMENT',
      attributesA11y: 'Attributes at retirement',
      trophyTitle: 'TROPHY ROOM',
      trophyEmpty: 'No trophies in your career.',
      legadoTitle: 'LEGACY',
      ovrDelta: 'OVR {{initial}} → {{final}}',
      legadoLead: 'You grew from rookie to a reference.',
      retiredAt: 'You retired at age {{age}}.',
      restart: 'Start a new career',
      restartA11y: 'Erase the current career and return to the start',
      backSeason: 'Back to season',
      backSeasonA11y: 'Return to the season hub',
      notFinished: 'Your career has not finished yet. Go back to the season to play it fully.',
      // MGC-215 — destructive confirmation modal before wipe.
      confirmTitle: 'Start a new career?',
      confirmBody: 'You will erase the saved career, the game high score and the quiz progress. The app will look like a fresh install.',
      confirmAccept: 'Yes, erase everything',
      confirmCancel: 'Cancel',
      confirmDismiss: 'Close dialog without erasing',
    },
    copa: {
      bannerEyebrow: 'COPA MODE',
      bannerTitle: 'National cup available',
      bannerBody: 'Sign your team up and play the national cup with a deterministic bracket of {size} teams.',
      bannerCta: 'Start Copa Mode',
      inscriptionTitle: 'Enter your team in the cup?',
      inscriptionBody: 'A bracket with {size} teams will be generated using a deterministic seed. Your seed position depends on the current ranking.',
      inscriptionAccept: 'Enter team',
      inscriptionCancel: 'Cancel',
      bracketTitle: 'National cup',
      bracketSubtitle: 'Round {round} of {total}',
      round32: 'Round of 32',
      round16: 'Round of 16',
      round8: 'Quarterfinals',
      semifinal: 'Semifinal',
      final: 'Final',
      fallbackNoticeTitle: 'Reduced bracket',
      fallbackNoticeBody: 'Only {teams} teams signed up. The bracket auto-adjusts to the nearest power of 2 with byes.',
      championTitle: 'You are the cup champion!',
      championBadge: 'Cup N Champion',
      championContinue: 'Back to home',
      eliminatedTitle: 'Eliminated from the cup',
      eliminatedBody: 'Your team is out of the bracket. The slot is freed and you can sign up again next season.',
      eliminatedContinue: 'Back to season',
      slotEmpty: 'No active cup',
      slotActive: 'Cup active · Round {round}',
    },
    // MGC-487.1 — playoffs CTA from calendar.
    playoff: {
      ctaOpenBracket: 'Open playoffs',
      ctaOpenBracketHint: 'Resolve quarterfinals, semis and final',
    },
  },
  'zh-CN': {
    brand: 'Copero',
    // MGC-320 — body home en chino simplificado.
    home: {
      eyebrow: 'COPERO · 职业生涯模拟器',
      title: '成为传奇',
      body: '做出决定，承担后果，一步步打造你的足球生涯。',
      play: '开始游戏',
    },
    // MGC-479 — Welcome screen (zh-CN).
    welcome: {
      eyebrow: 'COPERO · 欢迎',
      title: '欢迎来到 Copero',
      body: '你的足球生涯从这里开始。创建你的球员，选择一家俱乐部，并开始一周一周地竞争。',
      cta: '开始',
      ctaHint: '打开身份表单创建你的球员',
    },
    nav: {
      simulator: '足球生涯模拟器',
      buildCareer: '创建你的足球生涯',
      fullCareer: '完整生涯',
      quickCareer: '快速生涯',
      howToPlay: '玩法',
      mechanics: '机制',
      faq: '常见问题',
      play: '开始游戏',
      primary: '主导航',
      languageLabel: '切换语言',
      menuOpen: '打开菜单',
      menuClose: '关闭菜单',
      settings: '设置',
    },
    settings: {
      title: '设置',
      version: '版本',
      build: '构建',
      language: '语言',
      resetCareer: '重置生涯',
      howToPlay: '玩法',
      feedback: '反馈',
      feedbackSubject: 'Copero 反馈',
      close: '关闭',
    },
    // MGC-491 + MGC-555 — selector de idioma (zh-CN).
    onboarding: {
      languageTitle: '选择你的语言',
      languageSubtitle:
        '你的语言决定了应用内文本和区域格式（日期、数字、货币）。你可以随时在设置中更改。',
      autoDetectTitle: '我们检测到你的所在地区',
      autoDetectBody:
        '如果你的设备设置为其他语言，你可以保留当前语言或在下方手动切换。',
    },
    identity: {
      eyebrow: 'COPERO · 新建生涯',
      title: '创建你的球员',
      subtitle: '第 1 步 / 共 2 步 — 你的球员',
      stepIndicator: '第 1 步 / 共 2 步',
      fieldName: '姓名',
      namePlaceholder: '例如 利昂内尔',
      fieldLastName: '姓氏',
      lastNamePlaceholder: '例如 梅西',
      fieldAge: '年龄 (16–35)',
      agePlaceholder: '19',
      ageHelp: '你的球员从这个年龄开始，35 岁退役。',
      ageA11y: '球员年龄，介于 16 至 35 岁',
      nameA11y: '球员姓名',
      lastNameA11y: '球员姓氏',
      fieldFoot: '惯用脚',
      footLeft: '左脚',
      footRight: '右脚',
      footBoth: '双脚',
      fieldNationality: '国籍',
      nationalityPlaceholder: '搜索国家…',
      nationalityNoMatches: '无匹配。',
      nationalityExpandLabel: '查看全部 {n}',
      nationalityCollapseLabel: '收起',
      nationalityCollapseA11y: '收起国籍列表',
      nationalityExpandA11y: '查看全部 {n} 个国籍',
      nationalityHint: '输入以搜索全部 {n} 个国籍。',
      nationalitySearchA11y: '选择国籍',
      jerseyEyebrow: '球衣预览',
      jerseyCaption: '{position} · OVR 50',
      fieldLeague: '所属联赛',
      leagueOpenHint: '打开联赛列表',
      leaguePlaceholder: '选择联赛…',
      leagueSearchPlaceholder: '搜索联赛…',
      leagueSearchA11y: '搜索联赛',
      leagueNoMatches: '无匹配。',
      fieldPosition: '位置',
      positionA11y: '位置 {label}',
      positionChipsA11y: '位置：{label}',
      positionGroupGk: 'GK',
      positionGroupDef: 'DEF',
      positionGroupMid: 'MID',
      positionGroupFwd: 'FWD',
      fieldMapA11y: '带位置的球场地图',
      numberLabel: '号码 (1–99)',
      numberDecrement: '减少号码',
      numberIncrement: '增加号码',
      // MGC-1647 (WF1): 年龄取代了号码步进器。
      ageLabel: '年龄 (16–35)',
      ageErrorLow: '最小年龄为 16 岁。',
      ageErrorHigh: '最大年龄为 35 岁。',
      nameErrorShort: '姓名至少需要 2 个字符。',
      nameErrorLong: '姓名不能超过 24 个字符。',
      continueHint: '请填写名字和姓氏以继续。',
      continue: '继续 → 选择球队',
      continueA11yHint: '保存身份并打开球队选择',
      nationalityOptionA11y: '选择国籍 {name}',
    },
    teamSelect: {
      eyebrow: '选择你的俱乐部',
      title: '你想从哪支球队开始你的职业生涯?',
      subtitle:
        '你的第一支球队决定了起步。之后,每赛季之间你可能收到来自更高声望球队的邀请。',
      reputationLabel: '声望',
      reputationValue: '{n} / 5',
      cardA11y: '{name},{league},声望 {reputation} / {maxReputation}',
      selectedBadge: '已选择',
      continueHint: '点击一支球队以选择它。',
      continue: '开始职业生涯',
      continueA11yHint: '保存所选球队并打开仪表盘',
    },
    // MGC-1649 — WF3 赛季中心 + 本周决策占位。
    seasonHub: {
      eyebrow: '赛季中心',
      heroName: '{name}',
      position: '{position}',
      age: '{age} 岁',
      club: '{club}',
      freeAgent: '自由球员',
      week: '第 {week}/38 周',
      fatigueEyebrow: '疲劳',
      fatigueValue: '{value}/100',
      statsEyebrow: '位置属性',
      statsNote: '其他位置在 F2 加入',
      statVision: '视野',
      statPass: '传球',
      statDribble: '盘带',
      statStamina: '体能',
      nextMatchEyebrow: '下一场比赛',
      nextMatchVs: '对阵 {rival}',
      nextMatchJornada: '第 {week} 轮',
      nextMatchEmpty: '暂无对手',
      ctaViewTable: '查看积分榜',
      ctaViewTableHint: '打开赛季时间线',
      ctaDecide: '决定本周 →',
      ctaDecideHint: '打开本周的 4 个选项',
    },
    weekDecision: {
      eyebrow: '本周决策',
      title: '本周你打算做什么？',
      subtitle: '选择一项。F2 将用完整的位置树替换此界面。',
      optDoubleShift: '双倍训练',
      optDoubleShiftDesc: '高风险 · 高回报。增加疲劳。',
      optSimpleShift: '单次训练',
      optSimpleShiftDesc: '平衡 · 低风险 · 中等变化。',
      optRest: '休息',
      optRestDesc: '恢复疲劳 · 本周无比赛。',
      optTraining: '专项体能训练',
      optTrainingDesc: '提升一个位置属性。',
      backHint: '返回赛季中心',
    },
    temporada: {
      traits: {
        eyebrow: '球员特质',
        title: '你的球员表现如何',
        subtitle: '选择一或两个特质来定义风格。每个特质会影响事件发展和俱乐部报价。',
        capHint: '最多 2 个特质',
        itemA11y: '特质 {name}，{selected}',
        a11ySelected: '已选',
        a11yNotSelected: '未选',
        'magneto-mediatico': {
          name: '媒体磁铁',
          desc: '吸引赞助商和头条。报价与媒体事件更多，但曝光度更高。',
        },
        trotamundos: {
          name: '世界游民',
          desc: '快速适应新联赛。国际转会更顺利，海外 OVR 增长更快。',
        },
      },
    },
    postMatch: {
      eyebrow: '赛后',
      title: '今晚你怎么收场？',
      ratingLabel: '本场评分',
      luckGatePassed: '你的实力撑得住这波势头：本周运气站在你这边。',
      luckGateBlocked: '没有实力就没有运气：你只付出消耗，得不到回报。',
      continue: '继续',
      continueHint: '关闭事件并进入下一周',
      evDescanso: '休息',
      evDescansoDesc: '你留在家里。恢复体能，平静地结束这一周。',
      evFiesta: '派对',
      evFiestaDesc: '你和队友出去庆祝。士气上升，体能下降。',
      evGambling: '赌博',
      evGamblingDesc: '这一夜以牌桌收尾。熬夜、宿醉，受伤风险更高。',
      evCompraLujosa: '奢侈消费',
      evCompraLujosaDesc: '你给自己买了件贵重物品。士气高涨，训练专注度下降。',
      evPremiacion: '个人奖项',
      evPremiacionDesc: '你当选本轮最佳球员。士气与信心达到顶峰。',
      sectionLabel: '比赛总结',
      subtitle: '评分与确认后应用的变动。',
      ratingA11y: '评分 {rating} / 10',
      ratingOutstanding: ' 出色表现',
      ratingSolid: ' 稳健表现',
      ratingRegular: ' 中规中矩',
      ratingPoor: ' 低于预期',
      ratingBad: ' 艰难的夜晚',
      changesTitle: '变动',
      statMoral: '士气',
      statFisico: '体能',
      statConfianza: '信心',
      statGoals: '本场进球',
      reputationTitle: '声誉',
      prensa: '媒体: {value}',
      hinchada: '球迷: {value}',
      vestuario: '更衣室: {value}',
      repPrensaEnsalzada: '受褒扬',
      repPrensaNeutral: '中性',
      repPrensaCritica: '受批评',
      repPrensaHostil: '敌对',
      repHinchadaIdolo: '偶像',
      repHinchadaAceptado: '被接受',
      repHinchadaDiscutido: '争议',
      repHinchadaOdiado: '被敌视',
      repVestuarioCapitan: '精神队长',
      repVestuarioIntegrado: '融入',
      repVestuarioAislado: '被孤立',
      nextTitle: '下一场',
      nextWeek: '第 {week} / 38 周',
      ctaNextWeek: '下一周 →',
      ctaNextWeekHint: '应用变动并进入下一比赛周',
      ctaBackToHub: '返回主页',
      ctaBackToHubHint: '丢弃变动并返回仪表盘',
      // MGC-246 — MVP 标签 + 伤员卡片。
      mvpBadge: '全场最佳',
      mvpBadgeA11y: '本场最佳',
      injuriesTitle: '伤员',
      injuriesEmpty: '本场无伤员。',
      injuryKindLeve: '轻伤',
      injuryKindMedia: '中度伤',
      injuryKindGrave: '重伤',
      injuryRecoveryWeeks: '{count} 周恢复',
},
    transfers: {
      eyebrow: '转会市场',
      title: '赛季结束',
      subtitle: '你的表现决定哪些俱乐部会来找你。',
      verdictElite: '豪门想要你。桌上有三份顶级报价。',
      verdictStrong: '赛季不错。两家中游俱乐部提出报价。',
      verdictHold: '赛季中规中矩。除非出现更好的选择，否则你留下。',
      verdictHoldLow: '赛季平淡，但不至于亮红灯。你留在原地。',
      verdictDescent: '赛季糟糕。俱乐部把你推向门外。',
      verdictRetirement: '路走到头了。是时候挂靴了。',
      noOffers: '没有收到任何报价。你继续留在俱乐部。',
      forcedTransfer: '被迫离队：俱乐部下赛季不要你。',
      deadline: '你有到第 {{week}} 周的时间做决定。',
      offerRole: '预期角色',
      roleStarter: '主力',
      roleRotation: '轮换',
      offerYears: '合同',
      offerWage: '薪水',
      offerReputation: '声望',
      accept: '接受',
      acceptHint: '加盟这家俱乐部',
      decline: '全部拒绝',
      declineHint: '留在现在的俱乐部',
    },
    decisionTree: {
      nodePretemporada: '季前赛：教练组从零开始评估你。',
      nodeEntrenamientoBase: '与球队进行常规周训练。',
      nodeDobleSesion: '双练：上午和下午连轴转。',
      nodeGimnasio: '健身房力量训练。',
      nodeVideoAnalisis: '与分析师一起看录像。',
      nodeCharlaTecnico: '与主教练单独谈话。',
      nodeVestuarioTension: '上一场结果之后更衣室气氛紧张。',
      nodePartidoLiga: '联赛比赛：常规轮次。',
      nodePartidoCopa: '杯赛比赛：淘汰赛。',
      nodeDerbi: '德比：一年中最重要的比赛。',
      nodeVisitanteHostil: '客场作战，气氛敌意十足。',
      nodeRuedaPrensa: '面对尖锐记者的新闻发布会。',
      nodeRedesSociales: '你在社交媒体上说得太过了。',
      nodeOfertaAgente: '你的经纪人带来一份提案。',
      nodeConvocatoriaJuvenil: '入选青年国家队。',
      nodeAmistosoInternacional: '国际友谊赛，长途奔波。',
      nodeManejoMolestia: '你带着伤病：必须妥善处理。',
      nodeRotacionBanco: '轮换：你从替补席开始。',
      nodeCierreMercado: '转会窗口的最后一周。',
      nodeFinalTemporada: '赛季收官：一切在此见分晓。',
      outBrillante: '出色',
      outSolido: '稳健',
      outCorrecto: '中规中矩',
      outIrregular: '起伏不定',
      outFlojo: '低迷',
      outDesastre: '灾难',
    },
    // MGC-1650 (WF4) — /match 屏幕。
    match: {
      loading: '加载比赛中…',
      loadError: '比赛加载失败。请返回主页后重试。',
      ctaLoadErrorBack: '返回主页',
      weekLabel: '第',
      title: '本场比赛',
      subtitle: '比分、事件与本场表现。',
      finalLabel: '全场结束',
      rival: '对手',
      cleanSheet: '零封对手',
      resultClosed: '结果已出',
      eventsTitle: '事件',
      noEvents: '本场无进球。',
      goalEvent: '进球。冷静射门。',
      yourGameTitle: '你的表现',
      statGoals: '进球',
      statAst: '助攻',
      statPassPct: '传球 %',
      statMinutes: '分钟',
      ctaFinalize: '结束比赛',
      ctaFinalizeHint: '进入赛后屏幕以确认',
    },
    // MGC-1736 (WF6) — fin de carrera / retiro.
    retire: {
      eyebrow: '职业生涯完结',
      title: '退役',
      subtitle: '职业生涯落幕。回顾你的最佳赛季、奖杯陈列与传奇。',
      statRetirementAge: '退役年龄',
      statFinalOvr: '最终 OVR',
      statApps: '出场次数',
      statGoalsAssists: '进球 + 助攻',
      attributesTitle: '退役属性',
      attributesA11y: '退役时的属性',
      trophyTitle: '奖杯陈列',
      trophyEmpty: '你的职业生涯中没有奖杯。',
      legadoTitle: '传奇',
      ovrDelta: 'OVR {{initial}} → {{final}}',
      legadoLead: '你从新秀成长为标杆。',
      retiredAt: '你在 {{age}} 岁退役。',
      restart: '开始新的职业生涯',
      restartA11y: '清除当前职业生涯并返回起始页',
      backSeason: '返回赛季',
      backSeasonA11y: '回到赛季主页',
      notFinished: '你的职业生涯尚未结束。返回赛季继续完整地打完。',
      // MGC-215 — wipe 前的破坏性确认弹窗
      confirmTitle: '开始新的职业生涯？',
      confirmBody: '将清除已保存的职业生涯、单词游戏最高分和测验进度。应用状态会回到全新安装的样子。',
      confirmAccept: '是，清除全部',
      confirmCancel: '取消',
      confirmDismiss: '关闭弹窗且不清除',
    },
    copa: {
      bannerEyebrow: '杯赛模式',
      bannerTitle: '全国杯赛已开放',
      bannerBody: '为你的球队报名参加由 {size} 支球队组成的全国杯赛，使用确定性抽签。',
      bannerCta: '开启杯赛模式',
      inscriptionTitle: '确认报名杯赛？',
      inscriptionBody: '将通过确定性种子生成 {size} 支球队的淘汰赛对阵。种子顺位由当前排名决定。',
      inscriptionAccept: '确认报名',
      inscriptionCancel: '取消',
      bracketTitle: '全国杯赛',
      bracketSubtitle: '第 {round} 轮 / 共 {total} 轮',
      round32: '32强',
      round16: '16强',
      round8: '8强',
      semifinal: '半决赛',
      final: '决赛',
      fallbackNoticeTitle: '缩减赛制',
      fallbackNoticeBody: '当前仅 {teams} 支球队报名。对阵表将自动调整为最近的 2 的幂次并附带轮空。',
      championTitle: '恭喜夺冠！',
      championBadge: '第 N 届杯赛冠军',
      championContinue: '返回主页',
      eliminatedTitle: '杯赛中出局',
      eliminatedBody: '你的球队已离开杯赛。名额已释放，下个赛季可再次报名。',
      eliminatedContinue: '返回赛季',
      slotEmpty: '暂无进行中的杯赛',
      slotActive: '杯赛进行中 · 第 {round} 轮',
    },
    // MGC-487.1 — 季后赛入口（日历 CTA）。
    playoff: {
      ctaOpenBracket: '进入季后赛',
      ctaOpenBracketHint: '解决四强、半决赛与决赛',
    },
  },
  // MGC-320 — locale pt-BR (Bug A del padre MGC-306). Solo poblamos
  // las claves que el header, settings y home body necesitan; el resto
  // cae al fallback `es` (regla del `t()` en `locale-context.tsx`).
  // El alcance del fix de MGC-320 es el selector + propagación + persistencia;
  // la traducción completa del juego sigue siendo follow-up de MGC-306.
  'pt-BR': {
    brand: 'Copero',
    home: {
      eyebrow: 'COPERO · SIMULADOR DE CARREIRA',
      title: 'Vire uma lenda',
      body: 'Tome decisões, assuma consequências e construa sua carreira de futebol passo a passo.',
      play: 'Jogar',
    },
    // MGC-479 — Welcome screen (pt-BR).
    welcome: {
      eyebrow: 'COPERO · BEM-VINDO',
      title: 'Bem-vindo ao Copero',
      body: 'Sua carreira de futebol começa aqui. Crie seu jogador, escolha um clube e comece a competir semana a semana.',
      cta: 'Começar',
      ctaHint: 'Abre o formulário de identidade para criar seu jogador',
    },
    nav: {
      simulator: 'Simulador de carreira',
      buildCareer: 'Crie sua carreira',
      fullCareer: 'Carreira completa',
      quickCareer: 'Carreira rápida',
      howToPlay: 'Como jogar',
      mechanics: 'Mecânicas',
      faq: 'FAQ',
      play: 'Jogar',
      primary: 'Navegação principal',
      languageLabel: 'Trocar idioma',
      menuOpen: 'Abrir menu',
      menuClose: 'Fechar menu',
      settings: 'Ajustes',
    },
    settings: {
      title: 'Ajustes',
      version: 'Versão',
      build: 'Build',
      language: 'Idioma',
      resetCareer: 'Resetar carreira',
      howToPlay: 'Como jogar',
      feedback: 'Enviar feedback',
      feedbackSubject: 'Feedback Copero',
      close: 'Fechar',
    },
    // MGC-491 + MGC-555 — selector de idioma (pt-BR).
    onboarding: {
      languageTitle: 'Escolha seu idioma',
      languageSubtitle:
        'Seu idioma define os textos do app e o formato regional (datas, números, moeda). Você pode mudar quando quiser em Configurações.',
      autoDetectTitle: 'Detectamos sua localização',
      autoDetectBody:
        'Se seu dispositivo está em outro idioma, você pode manter o atual ou trocar manualmente abaixo.',
    },
    identity: {
      eyebrow: 'COPERO · NOVA CARREIRA',
      title: 'Crie seu jogador',
      subtitle: 'Passo 1 de 2 — Seu jogador',
      stepIndicator: 'Passo 1 de 2',
      fieldName: 'Nome',
      namePlaceholder: 'Ex. Lionel',
      fieldLastName: 'Sobrenome',
      lastNamePlaceholder: 'Ex. Messi',
      fieldAge: 'Idade (16–35)',
      agePlaceholder: '19',
      ageHelp: 'Seu jogador começa nesta idade e se aposenta aos 35.',
      ageA11y: 'Idade do jogador, entre 16 e 35 anos',
      nameA11y: 'Nome do jogador',
      lastNameA11y: 'Sobrenome do jogador',
      fieldFoot: 'Pé dominante',
      footLeft: 'Esquerdo',
      footRight: 'Direito',
      footBoth: 'Ambos',
      fieldNationality: 'Nacionalidade',
      nationalityPlaceholder: 'Buscar país…',
      nationalityNoMatches: 'Sem resultados.',
      nationalityExpandLabel: 'Ver todas as {n}',
      nationalityCollapseLabel: 'Ver menos',
      nationalityCollapseA11y: 'Ver menos nacionalidades',
      nationalityExpandA11y: 'Ver todas as {n} nacionalidades',
      nationalityHint: 'Digite para buscar entre as {n} nacionalidades.',
      nationalitySearchA11y: 'Selecionar nacionalidade',
      jerseyEyebrow: 'PREVIEW DA CAMISA',
      jerseyCaption: '{position} · OVR 50',
      fieldLeague: 'Liga de origem',
      leagueOpenHint: 'Abre a lista de ligas',
      leaguePlaceholder: 'Selecionar liga…',
      leagueSearchPlaceholder: 'Buscar liga…',
      leagueSearchA11y: 'Buscar liga',
      leagueNoMatches: 'Sem resultados.',
      fieldPosition: 'Posição',
      positionA11y: 'Posição {label}',
      positionChipsA11y: 'Posição: {label}',
      positionGroupGk: 'GK',
      positionGroupDef: 'DEF',
      positionGroupMid: 'MID',
      positionGroupFwd: 'FWD',
      fieldMapA11y: 'Mapa do campo com posições',
      numberLabel: 'NÚMERO (1–99)',
      numberDecrement: 'Diminuir número',
      numberIncrement: 'Aumentar número',
      ageLabel: 'IDADE (16–35)',
      ageErrorLow: 'A idade mínima é 16 anos.',
      ageErrorHigh: 'A idade máxima é 35 anos.',
      nameErrorShort: 'O nome deve ter pelo menos 2 caracteres.',
      nameErrorLong: 'O nome não pode passar de 24 caracteres.',
      continueHint: 'Preencha nome e sobrenome para continuar.',
      continue: 'Continuar → Escolher clube',
      continueA11yHint: 'Salva a identidade e abre a seleção de clube',
      nationalityOptionA11y: 'Selecionar nacionalidade {name}',
    },
    teamSelect: {
      eyebrow: 'ESCOLHA SEU CLUBE',
      title: 'Em que clube você começa sua carreira?',
      subtitle:
        'Seu primeiro clube define o começo. Depois, entre temporadas, você pode receber ofertas de clubes com melhor reputação.',
      reputationLabel: 'REPUTAÇÃO',
      reputationValue: '{n} / 5',
      cardA11y: '{name}, {league}, reputação {reputation} de {maxReputation}',
      selectedBadge: 'Selecionado',
      continueHint: 'Toque em um clube para selecioná-lo.',
      continue: 'Começar carreira',
      continueA11yHint: 'Salva o clube escolhido e abre o dashboard',
    },
    seasonHub: {
      eyebrow: 'HUB DA TEMPORADA',
      heroName: '{name}',
      position: '{position}',
      age: '{age} anos',
      club: '{club}',
      freeAgent: 'Sem clube',
      week: 'SEMANA {week}/38',
      fatigueEyebrow: 'FADIGA',
      fatigueValue: '{value}/100',
      statsEyebrow: 'STATS DA POSIÇÃO',
      statsNote: 'Outras posições somam no F2',
      statVision: 'Visão',
      statPass: 'Passe',
      statDribble: 'Drible',
      statStamina: 'Resistência',
      nextMatchEyebrow: 'PRÓXIMO JOGO',
      nextMatchVs: 'vs {rival}',
      nextMatchJornada: 'Rodada {week}',
      nextMatchEmpty: 'Sem adversário ainda',
      ctaViewTable: 'Ver tabela',
      ctaViewTableHint: 'Abre a linha do tempo das temporadas',
      ctaDecide: 'Decidir semana →',
      ctaDecideHint: 'Abre a decisão semanal com as 4 opções',
    },
    weekDecision: {
      eyebrow: 'DECISÃO SEMANAL',
      title: 'O que você faz esta semana?',
      subtitle: 'Escolha uma opção. F2 substitui pela árvore posicional completa.',
      optDoubleShift: 'Turno duplo',
      optDoubleShiftDesc: 'Alto risco · alta recompensa. Aumenta fadiga.',
      optSimpleShift: 'Turno simples',
      optSimpleShiftDesc: 'Equilíbrio · risco baixo · deltas moderados.',
      optRest: 'Descanso',
      optRestDesc: 'Recupera fadiga · sem jogo nesta semana.',
      optTraining: 'Treino físico',
      optTrainingDesc: 'Melhora um stat posicional específico.',
      backHint: 'Voltar ao hub da temporada',
    },
    temporada: {
      traits: {
        eyebrow: 'TRAÇOS DO JOGADOR',
        title: 'Como seu jogador se comporta',
        subtitle: 'Toque em um ou dois traços para definir seu estilo. Cada um muda como os eventos se desenrolam e quais clubes aparecem.',
        capHint: 'Máximo 2 traços',
        itemA11y: 'Traço {name}, {selected}',
        a11ySelected: 'selecionado',
        a11yNotSelected: 'não selecionado',
        'magneto-mediatico': {
          name: 'Ímã de mídia',
          desc: 'Atrai patrocinadores e manchetes. Mais ofertas e eventos midiáticos, mas maior exposição.',
        },
        trotamundos: {
          name: 'Globetrotter',
          desc: 'Se adapta rápido a ligas novas. Transferências internacionais melhores e drift de OVR no exterior.',
        },
      },
    },
    postMatch: {
      eyebrow: 'DEPOIS DO JOGO',
      title: 'Como você encerra a noite?',
      ratingLabel: 'Nota do jogo',
      luckGatePassed: 'Seu nível segura a fase: a sorte joga a favor nesta semana.',
      luckGateBlocked: 'Sem nível não há sorte: você paga o desgaste sem prêmio.',
      continue: 'Continuar',
      continueHint: 'Fechar o evento e avançar para a próxima semana',
      evDescanso: 'Descanso',
      evDescansoDesc: 'Você fica em casa. Recupera físico e encerra a semana tranquilo.',
      evFiesta: 'Festa',
      evFiestaDesc: 'Você sai para festejar com o elenco. Moral sobe, físico desce.',
      evGambling: 'Jogo',
      evGamblingDesc: 'A noite termina na mesa de jogo. Madrugada, ressaca e mais risco de lesão.',
      evCompraLujosa: 'Compra de luxo',
      evCompraLujosaDesc: 'Você se dá um luxo. Moral nas alturas, foco no treino cai.',
      evPremiacion: 'Prêmio individual',
      evPremiacionDesc: 'Você é eleito o craque da rodada. Moral e confiança no topo.',
      sectionLabel: 'RESUMO DO JOGO',
      subtitle: 'Sua nota e as mudanças que serão aplicadas ao confirmar.',
      ratingA11y: 'Nota {rating} em 10',
      ratingOutstanding: ' atuação brilhante',
      ratingSolid: ' atuação sólida',
      ratingRegular: ' partida correta',
      ratingPoor: ' abaixo do esperado',
      ratingBad: ' noite difícil',
      changesTitle: 'MUDANÇAS',
      statMoral: 'Moral',
      statFisico: 'Energia',
      statConfianza: 'Confiança',
      statGoals: 'Gols da partida',
      reputationTitle: 'REPUTAÇÃO',
      prensa: 'Imprensa: {value}',
      hinchada: 'Torcida: {value}',
      vestuario: 'Vestiário: {value}',
      repPrensaEnsalzada: 'enaltecida',
      repPrensaNeutral: 'neutra',
      repPrensaCritica: 'crítica',
      repPrensaHostil: 'hostil',
      repHinchadaIdolo: 'ídolo',
      repHinchadaAceptado: 'aceito',
      repHinchadaDiscutido: 'discutido',
      repHinchadaOdiado: 'odiado',
      repVestuarioCapitan: 'capitão moral',
      repVestuarioIntegrado: 'integrado',
      repVestuarioAislado: 'isolado',
      nextTitle: 'PRÓXIMO',
      nextWeek: 'Semana {week} / 38',
      ctaNextWeek: 'Próxima semana →',
      ctaNextWeekHint: 'Aplica as mudanças e avança para a próxima rodada',
      ctaBackToHub: 'Voltar ao hub',
      ctaBackToHubHint: 'Descarta as mudanças e volta ao dashboard',
      mvpBadge: 'MVP',
      mvpBadgeA11y: 'Craque da partida',
      injuriesTitle: 'LESIONADOS',
      injuriesEmpty: 'Sem lesionados nesta partida.',
      injuryKindLeve: 'Lesão leve',
      injuryKindMedia: 'Lesão média',
      injuryKindGrave: 'Lesão grave',
      injuryRecoveryWeeks: '{count} sem. de recuperação',
    },
    transfers: {
      eyebrow: 'MERCADO DA BOLA',
      title: 'Fim de temporada',
      subtitle: 'Seu rendimento define quais clubes te buscam.',
      verdictElite: 'Os grandes te querem. Três ofertas de elite na mesa.',
      verdictStrong: 'Boa temporada. Dois clubes do meio te fazem proposta.',
      verdictHold: 'Temporada correta. Você fica a menos que apareça algo melhor.',
      verdictHoldLow: 'Temporada fraca mas sem alarme. Você fica onde está.',
      verdictDescent: 'Temporada ruim. O clube te empurra para fora.',
      verdictRetirement: 'A estrada acaba aqui. Hora de pendurar as chuteiras.',
      noOffers: 'Não chegou oferta. Você fica no clube.',
      forcedTransfer: 'Saída forçada: o clube não te quer na próxima.',
      deadline: 'Você tem até a semana {{week}} para decidir.',
      offerRole: 'Papel esperado',
      roleStarter: 'Titular',
      roleRotation: 'Rotação',
      offerYears: 'Contrato',
      offerWage: 'Salário',
      offerReputation: 'Reputação',
      accept: 'Aceitar',
      acceptHint: 'Assinar com este clube',
      decline: 'Recusar tudo',
      declineHint: 'Ficar no seu clube atual',
    },
    decisionTree: {
      nodePretemporada: 'Pré-temporada: a comissão técnica mede do zero.',
      nodeEntrenamientoBase: 'Treino da semana com o elenco.',
      nodeDobleSesion: 'Sessão dupla: manhã e tarde sem respiro.',
      nodeGimnasio: 'Trabalho de musculação e força.',
      nodeVideoAnalisis: 'Sessão de vídeo com o analista.',
      nodeCharlaTecnico: 'Conversa cara a cara com o técnico.',
      nodeVestuarioTension: 'Tensão no vestiário depois do último resultado.',
      nodePartidoLiga: 'Jogo de liga: rodada comum.',
      nodePartidoCopa: 'Jogo de copa: mata-mata.',
      nodeDerbi: 'Clássico: o jogo do ano.',
      nodeVisitanteHostil: 'Visitante em campo hostil.',
      nodeRuedaPrensa: 'Coletiva com jornalistas afiados.',
      nodeRedesSociales: 'Você exagera nas redes sociais.',
      nodeOfertaAgente: 'Seu representante traz uma proposta.',
      nodeConvocatoriaJuvenil: 'Convocação para a seleção juvenil.',
      nodeAmistosoInternacional: 'Amistoso internacional com viagem longa.',
      nodeManejoMolestia: 'Você carrega um desconforto: precisa administrar.',
      nodeRotacionBanco: 'Rotação: você começa no banco.',
      nodeCierreMercado: 'Última semana do mercado da bola.',
      nodeFinalTemporada: 'Final de temporada: tudo se decide.',
      outBrillante: 'Brilhante',
      outSolido: 'Sólido',
      outCorrecto: 'Correto',
      outIrregular: 'Irregular',
      outFlojo: 'Fraco',
      outDesastre: 'Desastre',
    },
    match: {
      loading: 'Carregando jogo…',
      loadError: 'Não conseguimos carregar o jogo. Volte ao hub e tente de novo.',
      ctaLoadErrorBack: 'Voltar ao hub',
      weekLabel: 'SEMANA',
      title: 'Seu jogo',
      subtitle: 'Resultado, eventos e seu rendimento na rodada.',
      finalLabel: 'FIM',
      rival: 'Adversário',
      cleanSheet: 'Vela invicta',
      resultClosed: 'Resultado fechado',
      eventsTitle: 'EVENTOS',
      noEvents: 'Sem gols neste jogo.',
      goalEvent: 'Gol. Finalização letal.',
      yourGameTitle: 'SEU JOGO',
      statGoals: 'Gols',
      statAst: 'Assist.',
      statPassPct: 'Passe %',
      statMinutes: 'Minutos',
      ctaFinalize: 'Finalizar jogo',
      ctaFinalizeHint: 'Vai para a tela de pós-jogo para confirmar',
    },
    retire: {
      eyebrow: 'CARREIRA COMPLETA',
      title: 'FIM DE CARREIRA',
      subtitle: 'Encerramento da carreira. Resumo das suas melhores temporadas, vitrine e legado.',
      statRetirementAge: 'IDADE DE APOSENTADORIA',
      statFinalOvr: 'OVR FINAL',
      statApps: 'JOGOS',
      statGoalsAssists: 'GOLS + ASSIST.',
      attributesTitle: 'ATRIBUTOS NA APOSENTADORIA',
      attributesA11y: 'Atributos na aposentadoria',
      trophyTitle: 'VITRINE',
      trophyEmpty: 'Sem títulos na sua carreira.',
      legadoTitle: 'LEGADO',
      ovrDelta: 'OVR {{initial}} → {{final}}',
      legadoLead: 'Cresceu de novato a referência.',
      retiredAt: 'Você se aposentou aos {{age}} anos.',
      restart: 'Começar nova carreira',
      restartA11y: 'Apaga a carreira atual e volta ao início',
      backSeason: 'Voltar à temporada',
      backSeasonA11y: 'Volta ao hub da temporada',
      notFinished: 'Sua carreira ainda não terminou. Volte à temporada para jogar completa.',
      confirmTitle: 'Começar uma nova carreira?',
      confirmBody: 'Você vai apagar a partida salva, o high score do minigame e o progresso do quiz. O app fica como recém-instalado.',
      confirmAccept: 'Sim, apagar tudo',
      confirmCancel: 'Cancelar',
      confirmDismiss: 'Fechar o diálogo sem apagar',
    },
    copa: {
      bannerEyebrow: 'MODO COPA',
      bannerTitle: 'Copa nacional disponível',
      bannerBody: 'Inscreva seu time e dispute a copa nacional com chaveamento determinístico de {size} times.',
      bannerCta: 'Iniciar Modo Copa',
      inscriptionTitle: 'Inscrever seu time na copa?',
      inscriptionBody: 'Será gerada uma chave com {size} times usando uma seed determinística. Sua posição na siembra depende do ranking atual.',
      inscriptionAccept: 'Inscrever time',
      inscriptionCancel: 'Cancelar',
      bracketTitle: 'Copa nacional',
      bracketSubtitle: 'Rodada {round} de {total}',
      round32: 'Fase de 32',
      round16: 'Oitavas de final',
      round8: 'Quartas de final',
      semifinal: 'Semifinal',
      final: 'Final',
      fallbackNoticeTitle: 'Chaveamento reduzido',
      fallbackNoticeBody: 'Há {teams} times inscritos. A chave ajusta-se automaticamente para a potência de 2 mais próxima com byes.',
      championTitle: 'Você é o campeão da copa!',
      championBadge: 'Campeão da Copa N',
      championContinue: 'Voltar ao início',
      eliminatedTitle: 'Eliminado da copa',
      eliminatedBody: 'Seu time saiu da chave. A vaga é liberada e você pode se inscrever na próxima temporada.',
      eliminatedContinue: 'Voltar à temporada',
      slotEmpty: 'Sem copa ativa',
      slotActive: 'Copa ativa · Rodada {round}',
    },
    // MGC-487.1 — CTA dos playoffs a partir do calendário.
    playoff: {
      ctaOpenBracket: 'Ir para os playoffs',
      ctaOpenBracketHint: 'Resolver quartas, semis e final',
    },
  },
};
