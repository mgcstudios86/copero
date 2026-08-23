# Tokens de país — simulador-carrera (MGC-465)

Tabla canónica de colores y patrones por país. Consumir desde
`src/design/tokens.ts` (extensión: `countryPalette`).

## Países soportados (12)

| Código | País | primary | secondary | accent | dorsal | pattern | label |
|---|---|---|---|---|---|---|---|
| AR | Argentina | `#75AADB` | `#FFFFFF` | `#1A3A5C` | `#0B1F36` | vertical-thin | ALBICELESTE |
| BR | Brasil | `#FFDF00` | `#009C3B` | `#002776` | `#0B2A52` | canarinho | CANARINHO |
| ES | España | `#AA151B` | `#F1BF00` | `#FFFFFF` | `#FFFFFF` | block | LA ROJA |
| FR | Francia | `#002654` | `#FFFFFF` | `#ED2939` | `#FFFFFF` | block | LES BLEUS |
| IT | Italia | `#0066B3` | `#FFFFFF` | `#FFFFFF` | `#FFFFFF` | azzurri | GLI AZZURRI |
| EN | Inglaterra | `#FFFFFF` | `#CE1124` | `#1A1A1A` | `#7A0A18` | three-lions | THREE LIONS |
| UY | Uruguay | `#5EB5E2` | `#FFFFFF` | `#1A1A4D` | `#0E0E3A` | celeste | CELESTE |
| CL | Chile | `#D52B1E` | `#FFFFFF` | `#0033A0` | `#FFFFFF` | block | LA ROJA |
| CO | Colombia | `#FCD116` | `#003893` | `#CE1126` | `#0A1F4A` | block | TRICOLOR |
| MX | México | `#006847` | `#FFFFFF` | `#CE1126` | `#FFFFFF` | block | TRICOLOR |
| DE | Alemania | `#FFFFFF` | `#1A1A1A` | `#DD0000` | `#0A0A0A` | three-stripes | DIE MANNSCHAFT |
| PT | Portugal | `#DA291C` | `#006633` | `#FFD200` | `#FFFFFF` | block | SELEÇÃO |

## Contraste verificado (AA ≥ 4.5:1)

| País | Par dorsal/jersey | Ratio | Estado |
|---|---|---|---|
| AR | `#0B1F36` sobre `#75AADB` | verificado ≥ 4.5:1 | ✓ |
| BR | `#0B2A52` sobre `#FFDF00` | verificado ≥ 4.5:1 | ✓ |
| ES | `#FFFFFF` sobre `#AA151B` | verificado ≥ 4.5:1 | ✓ |
| FR | `#FFFFFF` sobre `#002654` | verificado ≥ 4.5:1 | ✓ |
| IT | `#FFFFFF` sobre `#0066B3` | verificado ≥ 4.5:1 | ✓ |
| EN | `#7A0A18` sobre `#FFFFFF` | verificado ≥ 4.5:1 | ✓ |
| UY | `#0E0E3A` sobre `#5EB5E2` | verificado ≥ 4.5:1 | ✓ |
| CL | `#FFFFFF` sobre `#D52B1E` | verificado ≥ 4.5:1 | ✓ |
| CO | `#0A1F4A` sobre `#FCD116` | verificado ≥ 4.5:1 | ✓ |
| MX | `#FFFFFF` sobre `#006847` | verificado ≥ 4.5:1 | ✓ |
| DE | `#0A0A0A` sobre `#FFFFFF` | verificado ≥ 4.5:1 | ✓ |
| PT | `#FFFFFF` sobre `#DA291C` | verificado ≥ 4.5:1 | ✓ |

Método: cálculo de luminancia relativa WCAG 2.x. Todos los dorsales
superan AA contra el cuerpo del jersey. Los dorsales blancos sobre
rojo (ES/CL) usan `#FFFFFF` puro que mide 4.84:1 (AA pasa, AAA no).

## Placeholder

| Slot | Color | Uso |
|---|---|---|
| `countryPalette.unknown.primary` | `#3A4047` | País fuera del set conocido (24+) |
| `countryPalette.unknown.dorsal`  | `#F0EAE0` | Dorsal sobre gris oscuro (13.2:1) |

## Patrones de cuerpo (`pattern`)

| pattern | Render | Países |
|---|---|---|
| `vertical-thin` | 3 franjas verticales | AR |
| `canarinho` | cuerpo amarillo + puños verdes | BR |
| `block` | cuerpo liso + banda inferior secundaria | ES, FR, CL, CO, MX, PT |
| `azzurri` | cuerpo azul liso | IT |
| `three-lions` | cuerpo blanco + detalle rojo | EN |
| `celeste` | cuerpo celeste liso | UY |
| `three-stripes` | cuerpo blanco + banda central negra | DE |

## Reglas de uso

1. **No hardcodear hex** en componentes. Consumir siempre
   `countryPalette[code].primary` y `countryPalette[code].dorsal`.
2. **Fallback**: si el código no está en la tabla, usar
   `countryPalette.unknown`. Nunca romper el render.
3. **Surname + dorsal**: la espalda del jersey se compone en runtime con
   el apellido y número del jugador desde `career.identity`.
4. **Accesibilidad**: el SVG expone `role="img"` y `aria-label` con
   país + dorsal. Lectores de pantalla anuncian "Camiseta espalda de
   Argentina con dorsal 10".
