# Flujos del producto

Spec de los user flows y business flows aprobada por el agente
`flow-architect`. Vivien acá (en el repo del proyecto) en vez de en
un repo separado, para co-evolucionar con el código.

## Convención

```
docs/flows/
  <feature-id>/         ← kebab-case, ej. mtrx-nueva-partida
    flow.md             ← spec producida por flow-architect
    handoff.md          ← spec para mobile-developer (producida por designer)
  overview-product-flow/   ← macro-spec (todo el producto)
    flow.md
    README.md
docs/screens/
  <feature-id>/
    01-<nombre>.png     ← mockups high-fi (producidos por designer vía OpenDesign)
    02-<otro>.png
    README.md
    source/             ← HTML fuente de OpenDesign
docs/handoffs/
  <feature-id>.md       ← generado por designer, leído por mobile-developer
```

## Validación visual

Cada `flow.md` debe pasar el lint de la skill `flow-validator` antes
de merge (V1 frontmatter, V2 mermaid, V3 secciones, V4 ≥3 edge cases,
V5 ≥4/5 campos por step, V6 out-of-scope no vacío, V7 sin TODO).
Correlo localmente:

```bash
bash /Users/matiasgonzalocalvo/Desktop/mgcstudios/github/mgcstudios-paperclip/skills/company/MGC/flow-validator/lint/lint.sh \
  docs/flows/<feat>/flow.md
```

## Origen de los flows

Los flows fueron migrados el 2026-09-11 desde el repo transitorio
`mgcstudios-flows` (borrado el mismo día por obsoleto, ahora flows
viven con su app).
