# Validación Fase 6

Backend Supabase validado con una transacción real que comprobó:

- presupuesto borrador → línea base;
- presupuesto total S/ 10,000;
- avance físico calculado 25 %;
- valorización presentada/aprobada por S/ 2,000;
- `ROLLBACK` final, sin conservar datos de prueba.

La generación se realizó en un entorno donde `npm install` agotó el tiempo de espera del registro npm. Por ello, el cierre final requiere ejecutar localmente:

```powershell
npm install
npm run verify
```


## Corrección 0.6.1
El replay de Fase 6 restaura `write_sync_receipt` de forma condicional porque la suite PGlite ejecuta Fase 6 sin cargar `phase2-sync.sql`. Esto no modifica la base remota.

## Cierre posterior

El permiso histórico que bloqueaba `Valuation snapshots baseline unit price` fue corregido concediendo `INSERT(unit_price)` sobre `public.valuation_items` al rol `authenticated`. El backend remoto confirma actualmente ese privilegio.
