# Componentes — design system Copero

Catálogo de componentes visuales reutilizables. Los contratos son referencia para
mobile-developer al implementar cada pantalla.

## C1 — Núcleo (MGC-297)

Componentes base entregados en el primer PR de design system. Estos contratos están
**MERGED** y no se modifican sin ticket nuevo.

| Componente | Uso | Notas accesibilidad |
|---|---|---|
| `Button` (primary / secondary / ghost) | CTAs principales | `accessibilityRole="button"`, `accessibilityLabel` requerido |
| `Card` | Contenedor elevado | `accessibilityRole="summary"` cuando es interactivo |
| `Input` (text / number / search) | Campos de formulario | `accessibilityLabel` o `<label>` enlazado |
| `Toggle / ToggleGroup` | Switches binarios (pierna hábil, modo) | `accessibilityRole="button"` + `accessibilityState.selected` |
| `Pressable` wrapper | Cualquier interactivo custom | `accessibilityRole` + `accessibilityLabel` + focus visible |
| `Modal` | Overlays (ej. VER MÁS países) | `accessibilityViewIsModal` + trampa de foco |
| `TopBar` | Header con back / título / acciones | `accessibilityRole="header"` |

## C2 — Tarjeta accesible (MGC-373)

Patrón de `<a>` Pressable con contraste WCAG AA. Cualquier `<a>`/`<button>` que use
estilo de tarjeta debe respetar:

```ts
// ✅ Correcto
<Pressable
  accessibilityRole="button"
  accessibilityLabel="Fichar por Villarreal, LaLiga"
  accessibilityState={{ selected: pressed }}
  style={({ pressed }) => ({
    backgroundColor: pressed ? palette.dark.primarySoft : palette.dark.surface,
    borderColor: pressed ? palette.dark.primary : palette.dark.border,
  })}
>
```

Contrato: `backgroundColor` SIEMPRE opaco + `color` con contraste ≥ 4.5:1. No usar
`transparent` como background de un Pressable con texto.

## C3 — Específicos del simulador-carrera (MGC-435)

Componentes **nuevos** definidos para el flow del simulador. NO rompen C1/C2.

### `<ModeCard>`

Selector de cadencia del SPLASH. Variantes: Intensa / Normal / Exprés.

Props:

```ts
interface ModeCardProps {
  mode: 'intensa' | 'normal' | 'expres';
  title: string;        // "Normal"
  description: string;  // "Decisiones cada 2 temporadas, una experiencia equilibrada."
  selected: boolean;
  onPress: () => void;
}
```

Tokens: `--radius-lg` 12, padding 16, border 1px, `aria-pressed`, focus visible.

Implementación RN: reutilizar `Pressable` de C2 con `accessibilityRole="button"` y
`accessibilityState={{ selected }}`.

### `<CountryTile>`

Celda del grid de NATIONALITY. Variantes: 24 países base + N adicionales vía VER MÁS.

Props:

```ts
interface CountryTileProps {
  code: string;       // ISO-3166-1 alfa-2
  name: string;
  flagUrl: string;    // https://.../{cc}.svg
  selected: boolean;
  onPress: () => void;
}
```

Tokens: grid 3 columnas, gap 8px, padding 12×8, altura mínima 88px, radius 12.

Implementación RN: `<Pressable>` con `Image` 32×24 SVG (requiere `react-native-svg-transformer`
o componente nativo `<SvgUri>`). `accessibilityLabel="{name}, {selected ? 'seleccionado' : 'no seleccionado'}"`.

### `<PositionTile>`

Celda del grid de POSITION. 12 posiciones hardcoded (no data-driven).

Props:

```ts
interface PositionTileProps {
  code: 'EI' | 'DC' | 'ED' | 'MI' | 'MCO' | 'MD' | 'LI' | 'MC' | 'LD' | 'MCD' | 'DFC' | 'POR';
  fullName: string;
  selected: boolean;
  onPress: () => void;
}
```

Tokens: grid 3 columnas, gap 12px, padding 16×12, altura mínima 88px, radius 12.

### `<StatCard>`

Celda de stats del DASHBOARD. Variantes: OVR / EDAD / VALOR / PJ / GLS / AST / GR / VI.

Props:

```ts
interface StatCardProps {
  label: 'OVR' | 'EDAD' | 'VALOR' | 'PJ' | 'GLS' | 'AST' | 'GR' | 'VI';
  value: string | number;  // "81", "€22M", "412"
  emphasis?: boolean;      // true → color primario
}
```

Tokens: padding 10-12, border 1px, radius 12, label 10px muted, value 16-22px mono.

### `<TimelineBar>`

Línea de tiempo 16→39 con dots clicables.

Props:

```ts
interface TimelineBarProps {
  currentAge: number;       // 16..39
  markers?: Array<{ age: number; label?: string }>;  // eventos pasados
  onMarkerPress?: (age: number) => void;
}
```

Tokens: 24 dots flex, altura 8px (current 12px), color primario para current, surface2 para future, border para past.

### `<HistoryTable>`

Tabla historial EDAD/CLUB/OVR/PJ/GLS/AST.

Props:

```ts
interface HistoryTableProps {
  rows: Array<{ edad: number; club: string; ovr: number; pj: number; gls: number; ast: number }>;
  showPorColumns?: boolean;  // si true → GR/VI en vez de GLS/AST
}
```

Tokens: `JetBrains Mono`, 12px, padding 8×4, border-bottom hairline.

Implementación RN: `<ScrollView horizontal>` + `<View>` por fila (no `Table` nativo — RN no tiene). Mantener `accessibilityRole="grid"` y `accessibilityLabel` por fila con resumen.

### `<OfferCard>`

Botón de selección de club para OFFER_YOUTH, LOAN_OFFER y RETURN_PARENT.

Props:

```ts
interface OfferCardProps {
  crestUrl?: string;
  crestInitials: string;    // "VIL", "DEP" cuando no hay asset
  clubName: string;         // "Villarreal"
  league: string;           // "LaLiga"
  action: 'fichar' | 'prestamo' | 'quedarse';
  selected: boolean;
  onPress: () => void;
}
```

Tokens: grid 56px crest + 1fr info + auto badge, padding 16, gap 12, altura mínima 88px, radius 12.

Variantes de color del accent:
- `fichar` → primary (verde)
- `prestamo` → accent (rojo/coral)
- `quedarse` → info (azul)

Implementación RN: reutilizar C2 `Pressable` con `accessibilityLabel="Fichar por {club}, {league}"`.

### `<EventTag>`

Pill superior de cada evento.

Props:

```ts
interface EventTagProps {
  variant: 'offer-youth' | 'loan-offer' | 'return-parent' | 'career-end';
  label: string;  // "Oferta de cantera"
}
```

Tokens: tipografía Space Grotesk 11px semibold uppercase letter-spacing 0.08em, color según variant (primary / accent / info / primary), margin-bottom 8.

### `<AchievementRow>`

Fila de logro en CAREER_END.

Props:

```ts
interface AchievementRowProps {
  emoji: string;     // "🏆"
  text: string;      // "Campeón de liga en 2 países distintos"
  unlocked: boolean;
}
```

Tokens: emoji 24px + texto 13px, padding 12, gap 12, radius 12.

### `<LanguageSwitcher>`

Toggle de idioma en SPLASH (ES / EN / PT).

Props:

```ts
interface LanguageSwitcherProps {
  value: 'es' | 'en' | 'pt';
  onChange: (lang: 'es' | 'en' | 'pt') => void;
}
```

Tokens: pill 32px alto, gap 4px, border 1px, font 12px.

## Compatibilidad C2 — recordatorio

Todo componente nuevo de C3 DEBE:

1. Usar `accessibilityRole` explícito (`button`, `link`, `summary`, `grid`, `gridcell`).
2. Pasar `accessibilityLabel` cuando el contenido visible es solo visual (crest, emoji).
3. Manejar estado selected/pressed via `accessibilityState`.
4. Mantener `tapTarget ≥ 44px` (algunos C3 van a 88px por ser listas verticales largas).
5. Usar colores con contraste WCAG AA sobre `palette.dark.bg` (≥ 4.5:1).

## Pendientes para mobile-developer

- `<HistoryTable>` requiere decisión sobre virtualización (24 filas max → no necesario).
- `<CountryTile>` y `<OfferCard>` requieren carga de SVG; validar `react-native-svg-transformer` o migrar a componente `<SvgUri>`.
- `<TimelineBar>` debe decidir si los dots son interactivos (ir a un año específico) o solo visuales.
- `<LanguageSwitcher>`: la app NO tiene i18n configurado (verificar con dev si se hace lazy o se delega a PR futura).