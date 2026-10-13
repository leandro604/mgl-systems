# MGL Systems — Auditoría responsive v0.18.2

Objetivo: que la interfaz gerencial funcione sin desbordes de página en móvil (360–430 px), tablet (768–1024 px) y escritorio.

## Hallazgos corregidos

- Header gerencial demasiado ancho en tablets por selector de proyecto + búsqueda + acciones.
- Selector de proyecto oculto por completo en móviles.
- Navegación gerencial móvil dependía de una fila horizontal larga.
- Padding de cards pensado para escritorio reducía demasiado el área útil en 360 px.
- Hero de proyecto y títulos largos podían forzar layouts incómodos.
- Navegación del proyecto necesitaba scroll táctil controlado.
- Dashboard por etapas truncaba nombres y la tabla de desviaciones era incómoda en móvil.
- Tabla de Partidas (mínimo 1620 px) no tenía una representación móvil útil.
- Peticiones y Finanzas dependían de tablas anchas en móvil.
- Formularios de líneas de compra/factura intentaban cuatro columnas desde 640 px.
- Editor de roles tenía anchos mínimos rígidos.

## Estrategia aplicada

- Móvil < 640 px: una columna, cards compactas, navegación por drawer y selector de proyecto de ancho completo.
- Tablet 640–1023 px: grid de dos columnas cuando aporta valor; búsqueda compacta; sin sidebar fija.
- Escritorio >= 1024 px: sidebar gerencial y densidad original.
- Tablas muy densas: cards en móvil cuando es posible; scroll horizontal táctil como fallback para información tabular compleja.
- Área principal con `min-width: 0` y `overflow-x: clip` en el shell para impedir scroll horizontal accidental de toda la página.

## Pantallas/componentes priorizados

- Shell `/app/*`
- Header y navegación gerencial
- Selector de proyecto
- Hero y navegación interna de proyecto
- Dashboard por etapas
- Partidas
- Peticiones
- Finanzas
- Formularios de compras/facturación
- Tablas densas mediante helper de scroll táctil
