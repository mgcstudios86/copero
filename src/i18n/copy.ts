/**
 * i18n — copy del SiteHeader (MGC-653).
 *
 * Fuente de verdad única para los strings del header global. Mantenido en
 * un módulo plano (no `i18next`) para evitar agregar dependencias nativas
 * nuevas al bundle (`expo-localization` requiere app.config.js plugin entry
 * y un rebuild nativo; el alcance de MGC-653 es solo el header). Cuando el
 * resto de la app necesite localización, este módulo se migra a `i18next`
 * + `expo-localization` siguiendo el plan documentado en ADR-0014.
 *
 * Locales soportados: `es` (default), `en`, `zh-CN`.
 *
 * Patrón de lookup: `t('nav.simulator')` devuelve el string traducido del
 * locale activo, con fallback a `es` si falta la clave en el locale pedido.
 */

export type Locale = 'es' | 'en' | 'zh-CN';

export const SUPPORTED_LOCALES: Locale[] = ['es', 'en', 'zh-CN'];

export const LOCALE_LABEL: Record<Locale, string> = {
  es: 'ES',
  en: 'EN',
  'zh-CN': '中文',
};

export type Copy = {
  brand: string;
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
    fieldName: string;
    namePlaceholder: string;
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
    jerseyEyebrow: string;
    jerseyCaption: string;
    fieldLeague: string;
    leagueOpenHint: string;
    leaguePlaceholder: string;
    leagueSearchPlaceholder: string;
    leagueSearchA11y: string;
    leagueNoMatches: string;
    fieldPosition: string;
    positionA11y: string;
    numberLabel: string;
    numberDecrement: string;
    numberIncrement: string;
    continueHint: string;
    continue: string;
    continueA11yHint: string;
    nameA11y: string;
    nationalitySearchA11y: string;
    fieldMapA11y: string;
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
};

export const COPY: Record<Locale, Copy> = {
  es: {
    brand: 'Copero',
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
    identity: {
      eyebrow: 'SIMULADOR DE CARRERA',
      title: 'Define tu identidad',
      subtitle: 'Tu jugador empieza con 16 años, OVR 50 y sin club. Elegí nombre, número y posición.',
      fieldName: 'Nombre',
      namePlaceholder: 'Ej. Mateo Romero',
      fieldFoot: 'Pie hábil',
      footLeft: 'Izquierdo',
      footRight: 'Derecho',
      footBoth: 'Ambos',
      fieldNationality: 'Nacionalidad',
      nationalityPlaceholder: 'Buscar país…',
      nationalityNoMatches: 'Sin coincidencias.',
      nationalityExpandLabel: 'Ver todas las {n}',
      nationalityCollapseLabel: 'Ver menos',
      nationalityCollapseA11y: 'Ver menos nacionalidades',
      nationalityExpandA11y: 'Ver todas las {n} nacionalidades',
      nationalityHint: 'Escribí para buscar entre las {n} nacionalidades.',
      jerseyEyebrow: 'VISTA PREVIA DE CAMISETA',
      jerseyCaption: '{position} · OVR 50',
      fieldLeague: 'Liga de origen',
      leagueOpenHint: 'Abre la lista de ligas',
      leaguePlaceholder: 'Seleccionar liga…',
      leagueSearchPlaceholder: 'Buscar liga…',
      leagueSearchA11y: 'Buscar liga',
      leagueNoMatches: 'Sin coincidencias.',
      fieldPosition: 'Posición (tap en el campo)',
      positionA11y: 'Posición {label}',
      numberLabel: 'NÚMERO (1–99)',
      numberDecrement: 'Restar número',
      numberIncrement: 'Sumar número',
      continueHint: 'Escribí tu nombre arriba para continuar.',
      continue: 'Continuar',
      continueA11yHint: 'Guarda la identidad y abre el dashboard',
      nameA11y: 'Nombre del jugador',
      nationalitySearchA11y: 'Buscar nacionalidad',
      fieldMapA11y: 'Mapa del campo con posiciones',
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
  },
  en: {
    brand: 'Copero',
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
    identity: {
      eyebrow: 'CAREER SIMULATOR',
      title: 'Define your identity',
      subtitle: 'Your player starts at 16, OVR 50, with no club. Pick a name, number and position.',
      fieldName: 'Name',
      namePlaceholder: 'e.g. Mateo Romero',
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
      jerseyEyebrow: 'JERSEY PREVIEW',
      jerseyCaption: '{position} · OVR 50',
      fieldLeague: 'Home league',
      leagueOpenHint: 'Open the league list',
      leaguePlaceholder: 'Pick a league…',
      leagueSearchPlaceholder: 'Search league…',
      leagueSearchA11y: 'Search league',
      leagueNoMatches: 'No matches.',
      fieldPosition: 'Position (tap on the pitch)',
      positionA11y: 'Position {label}',
      numberLabel: 'NUMBER (1–99)',
      numberDecrement: 'Decrease number',
      numberIncrement: 'Increase number',
      continueHint: 'Type your name above to continue.',
      continue: 'Continue',
      continueA11yHint: 'Saves your identity and opens the dashboard',
      nameA11y: 'Player name',
      nationalitySearchA11y: 'Search nationality',
      fieldMapA11y: 'Pitch map with positions',
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
  },
  'zh-CN': {
    brand: 'Copero',
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
    identity: {
      eyebrow: '职业生涯模拟器',
      title: '定义你的身份',
      subtitle: '你的球员从 16 岁、OVR 50、无俱乐部开始。选择姓名、号码和位置。',
      fieldName: '姓名',
      namePlaceholder: '例如 马蒂奥·罗梅罗',
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
      jerseyEyebrow: '球衣预览',
      jerseyCaption: '{position} · OVR 50',
      fieldLeague: '所属联赛',
      leagueOpenHint: '打开联赛列表',
      leaguePlaceholder: '选择联赛…',
      leagueSearchPlaceholder: '搜索联赛…',
      leagueSearchA11y: '搜索联赛',
      leagueNoMatches: '无匹配。',
      fieldPosition: '位置（点击球场）',
      positionA11y: '位置 {label}',
      numberLabel: '号码 (1–99)',
      numberDecrement: '减少号码',
      numberIncrement: '增加号码',
      continueHint: '在上方输入姓名以继续。',
      continue: '继续',
      continueA11yHint: '保存身份并打开仪表盘',
      nameA11y: '球员姓名',
      nationalitySearchA11y: '搜索国籍',
      fieldMapA11y: '带位置的球场地图',
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
  },
};
