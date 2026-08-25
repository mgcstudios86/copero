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
    },
  },
};
