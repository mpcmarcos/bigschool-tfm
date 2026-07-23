# 04 — Feature Navigation (Gestión jerárquica base)

## 1) Objetivo

Implementar la gestión jerárquica base reutilizando el mismo sistema visual aplicado en **Projects**, cubriendo navegación y operación de entidades encadenadas dentro del proyecto:

- Páginas (`Page`)
- Versiones de página (`PageVersion`)
- Recursos (`Resource`)
- Versiones de recurso (`ResourceVersion`)
- Recursos asociados a versión de página (`ResourcePage`)

## 2) Alcance funcional

### Frontend (navegación jerárquica)

La experiencia visual debe seguir el patrón de `03-feature-projects` (listado + acciones + formularios en modal/popup), aplicada por nivel jerárquico.

1. **Contexto Proyecto** (`/projects/{projectId}`)
   - Listado de páginas del proyecto.
   - Acción principal: **Ver versiones** de cada página.
   - Acción crear/editar/borrar lógico de página.

2. **Contexto Página** (`/projects/{projectId}/{pageId}`)
   - Listado de versiones de la página.
   - Acción para marcar versión por defecto.
   - Acción principal: **Ver recursos** del contexto versión seleccionada.

3. **Contexto Versión de Página** (`/projects/{projectId}/{pageId}/{pageVersionId}`)
   - Listado de recursos vinculables y recursos ya creados en esa versión.
   - Acción para crear `ResourcePage` directamente dentro de la versión de página (1:N).
   - Acción principal: navegar al detalle del recurso en esa versión.

4. **Contexto Recurso** (`/projects/{projectId}/{pageId}/{pageVersionId}/{resourceId}`)
   - Listado de versiones del recurso.
   - Acción para marcar versión por defecto.
   - Acción principal: ver detalle final del recurso en página.

5. **Detalle Recurso en Página** (`/projects/{projectId}/{pageId}/{pageVersionId}/{resourceId}/{resourcePageId}`)
   - Vista de detalle contextual final.
   - Edición de metadatos funcionales del vínculo `ResourcePage`.

### Backend

Se requiere soporte API para CRUD y operaciones de negocio por cada nivel jerárquico, con control de acceso por membresía del proyecto.

## 3) Modelo de datos (jerárquico)

Propiedades mínimas esperadas:

- `Page`: `id`, `projectId`, `name`, `description?`, `createdAt`, `updatedAt`, `isDeleted`
- `PageVersion`: `id`, `pageId`, `name|label`, `isDefault`, `createdAt`, `updatedAt`, `isDeleted`
- `Resource`: `id`, `projectId`, `key`, `description?`, `createdAt`, `updatedAt`, `isDeleted`
- `ResourceVersion`: `id`, `resourceId`, `name|label`, `isDefault`, `createdAt`, `updatedAt`, `isDeleted`
- `ResourcePage`: `id`, `pageVersionId`, `resourceId`, `resourceVersionId?`, `createdAt`, `updatedAt`, `isDeleted`

Relaciones clave:

- `Project 1:N Page`
- `Page 1:N PageVersion`
- `Project 1:N Resource`
- `Resource 1:N ResourceVersion`
- `PageVersion 1:N ResourcePage`
- `Resource 1:N ResourcePage`

## 4) Rutas funcionales frontend

Base de navegación jerárquica:

`/projects/{projectId}/{pageId}/{pageVersionId}/{resourceId}/{resourcePageId}`

Interpretación por niveles:

1. `/projects` -> listado de proyectos
2. `/projects/{projectId}` -> contexto de proyecto (páginas)
3. `/projects/{projectId}/{pageId}` -> contexto de página (versiones de página)
4. `/projects/{projectId}/{pageId}/{pageVersionId}` -> contexto de versión de página (recursos y recursos en página)
5. `/projects/{projectId}/{pageId}/{pageVersionId}/{resourceId}` -> contexto de recurso (versiones de recurso)
6. `/projects/{projectId}/{pageId}/{pageVersionId}/{resourceId}/{resourcePageId}` -> detalle final del recurso en página

## 5) Contrato backend recomendado (REST)

### Pages

- `GET /api/v1/projects/{projectId}/pages` -> lista páginas visibles del proyecto
- `POST /api/v1/projects/{projectId}/pages` -> crea página
- `PUT /api/v1/projects/{projectId}/pages/{pageId}` -> edita página
- `DELETE /api/v1/projects/{projectId}/pages/{pageId}` -> soft delete de página

### PageVersions

- `GET /api/v1/projects/{projectId}/pages/{pageId}/versions` -> lista versiones de página
- `POST /api/v1/projects/{projectId}/pages/{pageId}/versions` -> crea versión de página
- `PUT /api/v1/projects/{projectId}/pages/{pageId}/versions/{pageVersionId}` -> edita versión
- `DELETE /api/v1/projects/{projectId}/pages/{pageId}/versions/{pageVersionId}` -> soft delete de versión
- `POST /api/v1/projects/{projectId}/pages/{pageId}/versions/{pageVersionId}/set-default` -> marca versión por defecto

### Resources

- `GET /api/v1/projects/{projectId}/resources` -> lista recursos del proyecto
- `POST /api/v1/projects/{projectId}/resources` -> crea recurso
- `PUT /api/v1/projects/{projectId}/resources/{resourceId}` -> edita recurso
- `DELETE /api/v1/projects/{projectId}/resources/{resourceId}` -> soft delete de recurso

### ResourceVersions

- `GET /api/v1/projects/{projectId}/resources/{resourceId}/versions` -> lista versiones de recurso
- `POST /api/v1/projects/{projectId}/resources/{resourceId}/versions` -> crea versión de recurso
- `PUT /api/v1/projects/{projectId}/resources/{resourceId}/versions/{resourceVersionId}` -> edita versión
- `DELETE /api/v1/projects/{projectId}/resources/{resourceId}/versions/{resourceVersionId}` -> soft delete de versión
- `POST /api/v1/projects/{projectId}/resources/{resourceId}/versions/{resourceVersionId}/set-default` -> marca versión por defecto

### ResourcePage (recurso dentro de versión de página)

- `GET /api/v1/projects/{projectId}/pages/{pageId}/versions/{pageVersionId}/resource-pages` -> lista recursos en esa versión de página
- `POST /api/v1/projects/{projectId}/pages/{pageId}/versions/{pageVersionId}/resource-pages` -> crea vínculo recurso en página
- `PUT /api/v1/projects/{projectId}/pages/{pageId}/versions/{pageVersionId}/resource-pages/{resourcePageId}` -> edita vínculo
- `DELETE /api/v1/projects/{projectId}/pages/{pageId}/versions/{pageVersionId}/resource-pages/{resourcePageId}` -> soft delete de vínculo

## 6) Reglas de negocio

1. Solo miembros del proyecto (owner/editor/viewer según permiso) pueden consultar la jerarquía.
2. Un usuario no miembro recibe error de autorización en cualquier nivel.
3. El borrado es lógico (`isDeleted=true`) y los listados omiten borrados por defecto.
4. Debe existir una única `PageVersion` por defecto por cada `Page`.
5. Debe existir una única `ResourceVersion` por defecto por cada `Resource`.
6. Los IDs de ruta deben pertenecer al mismo árbol jerárquico; si hay inconsistencia se rechaza la operación.
7. `ResourcePage` solo puede apuntar a `PageVersion` y `Resource` accesibles dentro del mismo proyecto.
8. La UI mantiene consistencia visual y de interacción con el patrón usado en Projects (acciones, modales, confirmaciones).

## 7) Criterios de aceptación

- Desde un proyecto se pueden listar, crear, editar y borrar lógicamente páginas.
- Desde una página se pueden listar, crear, editar, borrar y definir versiones por defecto.
- Desde recurso se pueden listar, crear, editar, borrar y definir versiones por defecto.
- Desde versión de página se pueden crear recursos asociados (`ResourcePage`) y listarlos.
- La navegación por URL mantiene contexto correcto en los 6 niveles definidos.
- Operaciones con IDs jerárquicamente inconsistentes son rechazadas por backend.
- Usuarios no miembros no pueden acceder a datos jerárquicos del proyecto.
- La experiencia visual y patrón de interacción en esta funcionalidad es coherente con la usada en Projects.

## 8) Cambios requeridos en Entity Framework

Para soportar esta funcionalidad, se deben incluir cambios de persistencia en backend:

1. **Extensión de `AppDbContext`**
   - Añadir `DbSet<Page>`, `DbSet<PageVersion>`, `DbSet<Resource>`, `DbSet<ResourceVersion>`, `DbSet<ResourcePage>`.

2. **Configuración de entidades (Fluent API)**
   - Definir claves primarias y foráneas según la jerarquía.
   - Configurar relaciones 1:N:
     - `Project -> Pages`
     - `Page -> PageVersions`
     - `Project -> Resources`
     - `Resource -> ResourceVersions`
     - `PageVersion -> ResourcePages`
   - Configurar soft delete con `isDeleted`.

3. **Índices y restricciones**
   - Índices por claves de navegación frecuentes (`projectId`, `pageId`, `pageVersionId`, `resourceId`).
   - Restricción de unicidad por contexto para defaults:
     - una única `PageVersion` default activa por `Page`
     - una única `ResourceVersion` default activa por `Resource`
   - Restricción para evitar duplicados funcionales de `ResourcePage` en el mismo `PageVersion` cuando aplique la regla de negocio.

4. **Migraciones**
   - Crear migración dedicada para el esquema jerárquico base.
   - Verificar orden de creación de tablas por dependencias.
   - Aplicar migraciones en arranque normal y `EnsureCreated` solo en testing si ese patrón ya existe en el repositorio.

## 9) Estrategia obligatoria de implementación con TDD

La implementación debe ejecutarse con ciclo **Red -> Green -> Refactor** en cada bloque funcional.

1. **Red (tests que fallen primero)**
   - Tests API para CRUD jerárquico por nivel.
   - Tests de autorización (miembro vs no miembro).
   - Tests de defaults únicos y validación de árbol de IDs.
   - Tests frontend de navegación por niveles y acciones principales.

2. **Green (mínimo código para pasar)**
   - Implementar endpoints, servicios y consultas EF mínimos.
   - Implementar UI mínima para completar flujos definidos en criterios de aceptación.

3. **Refactor (sin romper tests)**
   - Consolidar lógica de validación jerárquica.
   - Mejorar legibilidad y reutilización de componentes frontend/backend.
   - Mantener contrato API y comportamiento funcional estable.

Regla de salida: no se considera completada la feature hasta que la suite de tests relevante quede en verde tras los cambios.
