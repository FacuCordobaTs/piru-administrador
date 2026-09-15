# Admin de Piru

Panel React/Vite del dueño y frontend de la app de escritorio Tauri. El árbol de rutas está en `src/main.tsx`; el source nativo está en `src-tauri/`.

Usar el router de dominios [`../AGENTS.md`](../AGENTS.md) para encontrar la pantalla, API y backend correctos. La operación vigente de pedidos parte de `src/pages/Dashboard.tsx`, no de `src/pages/Pedidos.tsx`.

```bash
bun install
bun run dev
bun run build
bun run lint
```

Para cambios de POS: `bun run test:pos`; la prueba UI adicional es `bun run test:pos-ui`.
