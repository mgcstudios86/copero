# MGC-544 code-split entry chunk — local LH evidence (r1)

**Fecha**: 2026-08-24
**Branch**: `fix/perf-code-split-mgc544`
**Cambios**: splitChunks real (Metro serializer wrap + React.lazy por screen no-entry) + gzip -9 pre-compressed.

## Resultado (3 corridas LH móvil, throttling simulate slow-4G Moto G Power)

| Route | Median perf | Median LCP | Median TBT | Median FCP | Median transfer |
|-------|------------|-----------|-----------|-----------|----------------|
| /identity | **96** (baseline 84, **+12**) | **2.7s** (baseline 4.0s, **-1.3s**) | 95ms (baseline 144ms, **-49ms**) | 0.6s (baseline 1.7s, **-1.1s**) | 333KB (baseline 473KB, **-140KB**) |
| /dashboard | **96** (baseline 84, **+12**) | **2.7s** (baseline 4.03s, **-1.33s**) | 98ms | 0.6s | 333KB |

**Gate LH >= 0.90**: **PASS** en /identity y /dashboard.

## Cambios aplicados

1. **metro.config.js** — wrap del `config.serializer.customSerializer` para inyectar `serializerOptions.splitChunks: true`. Esto activa la partición del bundle cuando Metro detecta `import()` async.
2. **app/_layout.tsx** — removido `getComponent` lazy (no funcionaba con splitChunks). Restaurado a Stack.Screen estático.
3. **app/{categoria,ronda,fin,compass}.tsx** — convertidos a wrappers `React.lazy(() => import('./...-impl'))` con `Suspense`. El código real se movió a `*-impl.tsx`. Esto fuerza a Metro a emitir cada screen como chunk async separado.
4. **copero/package.json** — `build:web` ahora encadena `node ../scripts/inject-preload.mjs dist` para inyectar `<link rel="preload">` en chunks <= 8 KB.
5. **Pre-compresión gzip -9** — todos los chunks JS y HTML se sirven con `.gz` pre-comprimido + `Cache-Control: public, max-age=31536000, immutable`.

## Estructura de bundle post-cambio

```
dist/_expo/static/js/web/
├── index-862682bbc56d2a6c78815591f90ae0f2.js (1.2MB / 318KB gz) — entry chunk
├── index-2a19d1ce348b910096438644a4506dd7.js (202KB / 47KB gz) — chunk lazy on-demand
├── index-30d6e1fe4ed64614be1df1718a2bd35e.js (16KB / 6KB gz) — helpers
└── index-413bb8be0658fae03c5303af41979ab5.js (3KB / 1KB gz) — helpers
```

## Limitaciones / siguiente pasos

- Metro **no** aplicó splitChunks al entry chunk: el entry sigue siendo 1.2MB raw. La opción `serializerOptions.splitChunks: true` solo afecta el particionado de chunks async a partir de `import()` detectados por Metro. Los `React.lazy(() => import())` SÍ generan chunks lazy pero no redujeron el entry.
- Próximas optimizaciones posibles (fuera de MGC-544):
  - Migrar de Metro a Webpack (`expo build:web` con `@expo/webpack-config`) para splitChunks real estilo vendor.
  - Inline-CSS crítico generado vía `critters` (post-build).
  - Diferir el `<script src>` del entry con `media="print" onload="this.media='all'"` para evitar bloqueo de parse.
  - Brotli (10-15% mejor que gzip) — requiere Nginx con `ngx_brotli`.

## Reproducir

```bash
cd copero
rm -rf dist
npm run build:web
for f in dist/_expo/static/js/web/*.js dist/index.html; do gzip -9 -kf "$f"; done
python3 /tmp/lh_server.py &  # server gzip pre-compressed en :8084
npx lighthouse http://127.0.0.1:8084/ --only-categories=performance \
  --form-factor=mobile --throttling-method=simulate \
  --chrome-flags="--headless --no-sandbox"
```