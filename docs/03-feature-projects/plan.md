# Plan de implementación — Feature 3 Projects (TDD)

## Estado de ejecución

- [x] Especificación funcional/técnica creada en `docs/03-feature-projects/README.md`.
- [x] Definición de URLs añadida en `docs/funcional-spec.md`.

---

## Estrategia TDD aplicada

Para cada bloque:

1. **Red**: escribir test que falla.
2. **Green**: implementar el mínimo para pasar.
3. **Refactor**: mejorar estructura sin romper tests.

---

## Fase 1 — Contrato y flujo de Projects en backend (TDD)

### Red
- [x] Añadir tests de integración API para:
  - [x] Crear proyecto autenticado.
  - [x] Compartir proyecto por email.
  - [x] Editar proyecto.
  - [x] Borrado lógico (`isDeleted` + exclusión de listados).
  - [x] Listado de miembros.
  - [x] Acceso no autenticado devuelve `401`.

### Green
- [x] Implementar modelo `Project`.
- [x] Implementar modelo `ProjectMember`.
- [x] Añadir contratos REST (`Create/Update/Share` + respuestas).
- [x] Implementar `ProjectService` con reglas de acceso.
- [x] Implementar `ProjectsController` con endpoints:
  - [x] `GET /api/v1/projects`
  - [x] `POST /api/v1/projects`
  - [x] `PUT /api/v1/projects/{projectId}`
  - [x] `DELETE /api/v1/projects/{projectId}`
  - [x] `GET /api/v1/projects/{projectId}/members`
  - [x] `POST /api/v1/projects/{projectId}/members`

### Refactor
- [x] Reforzar validaciones de rol y acceso.
- [x] Mantener soft-delete consistente en consultas.

---

## Fase 2 — Persistencia y esquema de datos (TDD)

### Red
- [x] Tests API dependen de tablas de proyectos/miembros.

### Green
- [x] Extender `AppDbContext` con `DbSet<Project>` y `DbSet<ProjectMember>`.
- [x] Configurar relaciones e índices (owner, membresía única, soft-delete).
- [x] Añadir migración `AddProjectsSchema`.
- [x] Ajustar startup para entorno `Testing` con `EnsureCreated` y entorno normal con `Migrate`.

### Refactor
- [x] Mantener compatibilidad de proveedor para test/local.

---

## Fase 3 — Frontend `/projects` (TDD)

### Red
- [x] Añadir tests de integración frontend para:
  - [x] Render de listado con botón "Crear proyecto" (arriba derecha) y propiedades.
  - [x] Acciones por proyecto: **Borrar**, **Compartir**, **Editar**, **Ver páginas**.
  - [x] Flujo completo de crear/editar/compartir/borrar.
  - [x] Navegación principal a páginas (`/projects/{idproject}`).

### Green
- [x] Implementar cliente API de proyectos en `src/resources-app/src/api.ts`.
- [x] Implementar vista `/projects` con:
  - [x] Formulario de creación.
  - [x] Listado de proyectos y propiedades.
  - [x] Panel de edición.
  - [x] Panel de compartición (listado de miembros + nuevo email + rol).
  - [x] Acción de borrado lógico vía API.
  - [x] Acción principal "Ver páginas".
- [x] Extender enrutado frontend para soportar `/projects/{idproject}`.

### Refactor
- [x] Consolidar estados de UI de proyecto en `App.tsx`.
- [x] Añadir estilos específicos de la vista projects.

---

## Fase 4 — Validación final

- [x] Ejecutar baseline inicial de lint/test/build para detectar estado previo.
- [x] Ejecutar test suite final post-cambios.
- [x] Ejecutar build final post-cambios.
- [x] Ejecutar lint final post-cambios.

## Incidencias de entorno detectadas

- Baseline inicial falló por dependencias frontend no instaladas (`oxlint` y `tsc` no disponibles).
- Se resolvió instalando dependencias con `npm ci` en `src/resources-app` y `src/resources-app-test`.
- `dotnet ef migrations add` no fue ejecutable por runtime faltante de `dotnet-ef`; se añadió migración manual `AddProjectsSchema`.

---

## Nuevas tareas solicitadas (pendientes)

### UX de acciones en frontend `/projects`

- [x] Implementar **Crear proyecto** en popup/modal.
- [x] Implementar **Editar proyecto** en popup/modal.
- [x] Implementar **Compartir proyecto** en popup/modal.
- [x] Añadir confirmación obligatoria en **Borrar proyecto** antes de ejecutar soft-delete.

### TDD para las nuevas tareas UX

- [x] Añadir tests frontend (RED) para validar apertura/cierre de modales de Crear/Editar/Compartir.
- [x] Añadir test frontend (RED) para validación de confirmación de borrado.
- [x] Implementar UI mínima (GREEN) hasta pasar los tests.
- [x] Refactorizar estados y componentes de modal sin romper cobertura.
