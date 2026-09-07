# ADR-0025 — Runner watch: Telegram + 3min cadence + 30min mute (MGC-2191)

- **Estado**: propuesta
- **Fecha**: 2026-09-06
- **Contexto**: MGC-2191 (Alerta self-hosted runner busy=0 pero runs queued > N min)
- **Decisión previa**: ADR-0024 (detección + ticket Paperclip, merge PR #490)

## Contexto

ADR-0024 implementó `runner-watch.yml` (cron cada 5min) que detecta el patrón
zombie del runner copero-ci (busy=0 + queued > 5min) y crea un ticket Paperclip
asignado a devops. Esa pieza cubre la detección y el wake path interno.

MGC-2191 requiere una capa de notificación al operador humano: el ticket Paperclip
no garantiza que el operador reaccione dentro del runner-stuck window. Necesitamos
un canal push (Telegram) con rate-limit para no spamear cuando el problema persiste.

## Decisión

1. **Cadencia del cron**: `*/3 * * * *` en lugar de `*/5`. Justificación:
   detectado → notificar → operator responde: ventana ideal < 4min para que el
   operador vea el run todavía en `queued` antes de que expire el `cancel-in-progress`
   o colapse el job. A 5min perdemos margen; a 3min no (GitHub jitter aceptable).

2. **Canal Telegram**: paperclip/scripts/send-md.sh envía `sendMessage` vía Bot API.
   Credenciales vía Infisical path `/copero` env=prod (proyecto mgcstudios).
   El script es idempotente y rechaza mensajes vacíos; trunca a 3500 chars.

3. **Mute window 30min**: state file en `$RUNNER_TEMP/runner-watch-state/last-alert`
   registra epoch del último alert. Si delta < 1800s, skip ticket + Telegram
   (Paperclip ya creó el ticket en la primera detección y este está abierto).
   Default configurable vía `workflow_dispatch.input.mute_seconds`.

4. **Dry-run**: `workflow_dispatch` con `dry_run=true` ejecuta toda la
   detección pero salta ticket y Telegram. Imprime el mismo `stale_count` que
   el path real para evidencia de QA.

5. **Workflow file**: `.github/workflows/runner-watch.yml` se extiende en el
   mismo archivo mergeado por ADR-0024 (no se crea paralelo). El `name:` se
   mantiene; el `concurrency.group` también; sólo cambian cron + nuevos steps.

## Consecuencias

### Positivas
- Operador recibe push en Telegram dentro de 30s de detectada la condición.
- Mute window previene spam cuando el problema persiste > 1 cron cycle.
- Dry-run permite validar end-to-end sin tocar Paperclip ni Telegram.
- Detección sigue intacta (ADR-0024): cron 3min no cambia la lógica.

### Negativas / Riesgos
- **Telegram bot token en Infisical**: si rotamos sin actualizar el secret,
  la notificación falla silenciosamente. Mitigación: `send-md.sh` valida
  `TELEGRAM_BOT_TOKEN` no-vacío y devuelve 5 si la API responde `ok=false`;
  log se ve en CI del workflow.
- **State file en `$RUNNER_TEMP`**: si el runner reinicia entre alertas,
  pierde el mute y re-alerta en el siguiente ciclo. Aceptable: costo = 1
  alerta duplicada.
- **Doble canal (Paperclip + Telegram)**: ruido si operador ignora ambos.
  Mitigación: ADR-0024 ya triaje-a-devops; ADR-0025 es solo notificación
  humana. Operador ve Telegram, ignora o interviene.

## Alternativas consideradas

- **Sentry / Datadog alert**: descartado por costo y single-tenant infra.
- **GitHub Discussion bot**: descartado por dependencia cloud extra.
- **Email vía SMTP**: descartado por falta de inbox dedicado del operador.
- **Telegram directo sin mute window**: descartado por spam potencial cuando
  el runner queda zombie 2+ horas.

## Thresholds resumen

| Parámetro | Valor | Override |
|---|---|---|
| Cadencia | `*/3 * * * *` (cada 3min) | editar workflow |
| Queue threshold | 5min | `vars.QUEUE_THRESHOLD_MINUTES` |
| Mute window | 1800s (30min) | `workflow_dispatch.input.mute_seconds=0` desactiva |
| Telegram parse | HTML escapado | n/a |
| max msg chars | 3500 | hard-coded en `send-md.sh` |

## Rollback

Revertir PR que mergeó este cambio. ADR-0024 (detección sola) sigue funcional;
la única regresión es volver a la cadencia de 5min y perder notificación push.

## Referencias

- MGC-2159, MGC-2191
- ADR-0024 (`docs/adr/0024-stuck-inprogress-auto-cancel.md`)
- PR #490 (ADR-0024 merge)
- paperclip/scripts/send-md.sh (este PR)
- skill `paperclip` §1.10 (secretos)
