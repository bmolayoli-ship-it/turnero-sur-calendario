# Turnero SUR ONLINE

Proyecto React + Vite preparado para trabajar en modo local o conectado a Supabase.

## Ejecutar en modo prueba local

```bash
npm install
npm run dev
```

Si no cargás variables de Supabase, la app funciona en modo local usando `localStorage` del navegador.

## Cambios integrados

- Calendario grande mensual dentro de Agenda Online.
- Turnos visibles dentro de cada día.
- Drag & drop para mover un turno de un día a otro.
- Al mover un turno, si Supabase está conectado, se actualiza la fecha en la tabla `turnos`.
- Filtros por estado: todos, pendientes, confirmados, asistió, avisó y no avisó.
- Panel de detalle del turno seleccionado.
- Botón `+ turno` dentro de cada día.
- Se quitó el calendario chico lateral que quedaba cortado.
- Se mantiene la Agenda diaria como vista alternativa.

## Configurar Supabase

1. Crear un proyecto nuevo en Supabase.
2. Ir a **SQL Editor**.
3. Copiar y ejecutar el contenido de `supabase.sql`.
4. Copiar `.env.example` como `.env`.
5. Completar:

```env
VITE_SUPABASE_URL=TU_URL_DE_SUPABASE
VITE_SUPABASE_PUBLISHABLE_KEY=TU_PUBLISHABLE_KEY
```

También se acepta `VITE_SUPABASE_ANON_KEY` para proyectos viejos que todavía usen anon key.

## Publicar en Vercel

1. Subir este proyecto a un repositorio de GitHub.
2. En Vercel, crear un proyecto nuevo e importar ese repositorio.
3. Framework: **Vite**.
4. Build command: `npm run build`.
5. Output directory: `dist`.
6. En **Environment Variables**, cargar:

```env
VITE_SUPABASE_URL=TU_URL_DE_SUPABASE
VITE_SUPABASE_PUBLISHABLE_KEY=TU_PUBLISHABLE_KEY
```

7. Deploy.

## Build local

```bash
npm run build
```


## Actualización: estado del turno

- Cada turno ahora muestra botones **Asistió**, **Avisó** y **No avisó** dentro de la tarjeta.
- Al tocar un botón, queda tildado visualmente y se actualiza el campo `estado` del turno.
- Si Supabase está conectado, el cambio se guarda en la tabla `turnos`.
