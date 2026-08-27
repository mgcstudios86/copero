# Copero Web — 5 pantallas (MGC-11-B)

App web navegable que replica las 5 pantallas clave del simulador de carrera de Copero,
basada en las capturas adjuntas en MGC-11:

1. **Identidad** — crear futbolista (`/identidad`).
2. **Draft** — elegir 8 atributos con leyendas (`/draft`).
3. **Draft complete** — resumen con OVR inicial y potencial (`/draft/complete`).
4. **Selección de club** — elegir entre 3 caminos (`/club`).
5. **Temporada** — dashboard con línea de tiempo (`/temporada`).

Bonus: **Fin de carrera** (`/fin`) — pantalla de cierre no presente en las capturas pero
mencionada en el plan de MGC-11.

## Stack

- React 18 + TypeScript.
- Vite como bundler / dev server.
- Tailwind 3 con tokens propios (`tailwind.config.js`).
- React Router 6 para navegación SPA.
- Mock data en `src/data/mock.ts` (sin backend).

## Comandos

```bash
cd copero-web/web
npm install
npm run dev     # http://localhost:5173
npm run build   # build producción a dist/
```

## Tokens visuales

Extraídos de las capturas de MGC-11:

- Fondo `#09090B` con glow verde/ámbar sutil.
- Verde acento `#00E676`, ámbar `#FBBF24`, amarillo `#FFD500`, rosa `#FF5470`.
- Tipografía: Archivo Black (display), Inter (body), JetBrains Mono (mono).
- Tarjetas con borde `#1C1C20` y radio 14px.
- Pills, eyebrows y chips con tracking amplio y mayúsculas.

Sin textos hardcodeados en inglés. Localización completa al español.

## Estructura

```
src/
  App.tsx          # router principal
  main.tsx         # bootstrap React
  components/
    Topbar.tsx     # nav superior + lang switcher
  data/
    mock.ts        # leyendas, clubes, atributos, timeline
  screens/
    Identidad.tsx
    Draft.tsx
    DraftComplete.tsx
    SeleccionClub.tsx
    Temporada.tsx
    FinCarrera.tsx
  styles/
    index.css      # tailwind + componentes utilitarios
```

## Navegación sin recarga

Todo el flujo es SPA. Las pantallas se enlazan entre sí (Identidad → Draft → Draft complete →
Selección de club → Temporada → Fin de carrera) sin refrescar el navegador. La barra superior
permite saltar a cualquiera.