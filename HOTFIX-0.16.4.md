# MGL Systems v0.16.4 — Hotfix formulario fiscal

## Corrección

React 19 / Next.js 16 administra automáticamente el método y el enctype cuando un `<form>` usa una función (Server Action) en `action`.

Se eliminó `encType="multipart/form-data"` de `FiscalSettingsForm`. La carga de certificados PFX/P12 sigue llegando como `FormData` a `saveFiscalSettingsAction` sin necesidad de declarar `encType` manualmente.

## Alcance

- Sin cambios de base de datos.
- Sin nueva migración.
- Mantiene las series fiscales y correcciones de navegación de v0.16.3.
