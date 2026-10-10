# TAREA 3 — Componentes UI base limpios

Base: MGL Systems 0.8.1 (Tarea 2).
Versión del entregable: 0.8.2.

## Implementado

- Card: superficie blanca, border 1px, radius 12px, shadow-sm máximo.
- Badge: neutral/info/success/warning/danger/critical.
- ProgressBar: accesible, semántico y con clamp 0–100%.
- Chip: seleccionable y opcionalmente removible.
- SearchInput: Lucide Search, clear action y focus ring azul.
- EmptyState: icono, título, descripción y action slot.
- Sidebar gerencial: #0F172A, 240px → 64px, persistencia local de colapso.
- BottomNav operativo: componente mobile-first de 5 tabs preparado para /field/*.
- Topbar limpia con NotificationBell base y badge de no leídas.
- Workspace principal: #FAFAFA / superficies blancas.
- Bridge visual para módulos legacy mientras Tasks 4–12 migran cada pantalla.

## Límites intencionales

- NotificationBell es presentacional en esta tarea. Realtime, drawer, Web Push y delivery se implementan en Tarea 9.
- FieldBottomNav queda como componente base; las rutas funcionales /field/* se implementan en Tareas 9–11.
- No se agregó lógica de negocio a componentes UI.
