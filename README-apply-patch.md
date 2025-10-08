# Patch: mejoras combos/kits, clientes y pedidos (v126 base)

Archivos incluidos (copiar y reemplazar en tu proyecto):
- components/order-form.tsx
- components/order-details.tsx
- app/customers/page.tsx

Cambios clave:
- Botones flotantes renombrados: "Confirmar Pedido" / "Cancelar Pedido".
- FAB para saltar al resumen del pedido.
- Barra sticky en modales de Combo/Kit con contadores (fijos, opcionales requeridos, seleccionados) y mensajes de límite.
- Tooltips en botones + / -.
- Clientes: vista Compacta/Espaciada + resaltado de término buscado.
- Detalle de pedido: header sticky + resumen de totales sticky.

Cómo aplicar
1) Descomprime este paquete.
2) Copia cada archivo en la ruta indicada dentro de tu proyecto (mantén la misma estructura de carpetas).
3) Ejecuta:
   corepack enable
   pnpm i
   pnpm dev

Si algo no calza con tus rutas, revisa que existan las carpetas `components`, `app/customers` y el archivo `components/order-details.tsx`.
