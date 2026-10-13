# Hotfix 0.18.1 — PDF format test / TypeScript strict

Corrige `tests/unit/invoice-pdf-formats.test.ts` para que `firstPage()` compruebe explícitamente que el PDF generado contiene al menos una página antes de devolverla.

Esto elimina los errores `TS18048: '<page>' is possibly 'undefined'` bajo `noUncheckedIndexedAccess` / TypeScript strict.

No cambia la lógica de generación de comprobantes ni el flujo SUNAT/Drive.
