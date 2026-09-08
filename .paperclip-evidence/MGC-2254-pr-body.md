## Contexto
MGC-2254 — corregir flake de Playwright (web, headless) que fallaba en múltiples SHAs consecutivos de main. Detectado durante triage de PR #501 (MGC-2235).

## Causa raíz
Contract drift, no race condition real:
- **MGC-1188** (commit a9ee2fc, PR #302): home quedó como dispatcher invisible (Redirect desde /) y las 10 specs se reescribieron para esperar auto-redirect a /simulador-carrera/identity tras page.goto(/).
- **MGC-1397** (commit baf1937, PR #340): home se restauró como pantalla visible con CTA "Jugar" (AC7.1). El comentario en app/index.tsx:26 afirma que las specs se reescribieron en el mismo pase, pero git log e2e/home.spec.ts confirma que el último commit es a9ee2fc (MGC-1188). Las specs quedaron stale.

## Runs fallidos observados
- 34082268399 (PR #501, SHA 2900447) — 22 failed, 9 passed (23.9m)
- 34079184150 (push a main, SHA 339856d6)
- 34019230870 (push a main, SHA 721076c5)
- 34005415571 (push a main, SHA 69430bd4)

Patrón: page.waitForURL Timeout 15000ms exceeded + navigated to / (x2) en todas las corridas. El home NO redirige — solo renderiza el CTA "Jugar".

## Fix mínimo
Reemplazar page.goto(/) + waitForURL por navegación directa a la ruta destino. home.spec.ts se reescribió para testear el flow real:
- cold-start sin carrera → home muestra solo "Jugar" → click → /simulador-carrera/identity
- cold-start con carrera persistida → home muestra "Continuar" + "Jugar" → click Continuar → /simulador-carrera/dashboard

## Acceptance criteria
- [x] Identificar causa raíz (contract drift, no race).
- [x] Aplicar fix mínimo (goto directo + home.spec.ts reescrito).
- [ ] 3 runs consecutivos verdes en main post-merge (a verificar).
- [ ] Evidencia: SHA fix + links a runs verdes.

## Archivos modificados (10)
- e2e/_visual-regression.spec.ts
- e2e/a11y-axe.spec.ts
- e2e/a11y-keyboard.spec.ts
- e2e/home.spec.ts (rewrite)
- e2e/mgc-317-qa.spec.ts
- e2e/mgc-462-contrast.spec.ts
- e2e/mgc396-visual-match.spec.ts
- e2e/simulador-carrera-evidence-mgc444.spec.ts
- e2e/simulador-carrera.spec.ts
- e2e/siteheader.spec.ts