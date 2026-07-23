# 03 — Feature Projects (Especificación técnica)

## 1) Objetivo

Implementar la gestión de proyectos en frontend y backend, incluyendo listado, creación, edición, compartición y borrado lógico.

## 2) Alcance funcional

### Frontend (`/projects`)

La pantalla `/projects` debe incluir:

1. **Botón "Crear proyecto"** en la parte superior derecha.
2. **Listado de proyectos** con todas sus propiedades visibles.
3. **Acciones por proyecto**:
   - **Borrar**: no elimina físicamente; cambia `isDeleted=true` y debe solicitar confirmación previa.
   - **Compartir**: muestra usuarios con acceso y permite añadir uno nuevo por email, en formato popup/modal.
   - **Editar**: permite editar todas las propiedades del proyecto, en formato popup/modal.
   - **Ver páginas**: acción principal que navega al listado de páginas del proyecto.
4. **Creación de proyecto**:
   - Debe mostrarse en formato popup/modal desde el botón "Crear proyecto".

### Backend

Se requiere soporte API para:

1. Crear proyecto.
2. Listar proyectos accesibles al usuario autenticado (`owner` + compartidos).
3. Editar todas las propiedades del proyecto.
4. Borrado lógico (`isDeleted=true`).
5. Obtener miembros compartidos del proyecto.
6. Compartir proyecto con nuevo usuario por email.

## 3) Modelo de datos (proyecto)

Propiedades mínimas esperadas de `Project`:

- `id`
- `name`
- `description` (opcional)
- `ownerUserId`
- `createdAt`
- `updatedAt`
- `isDeleted`

## 4) Rutas funcionales frontend

Base de navegación jerárquica:

`/projects/{idproject}/{idpagina}/{idpaginaversion}/{resource}/{idresourcepage}`

Interpretación por niveles:

1. `/projects` -> listado de proyectos
2. `/projects/{idproject}` -> contexto de proyecto
3. `/projects/{idproject}/{idpagina}` -> contexto de página
4. `/projects/{idproject}/{idpagina}/{idpaginaversion}` -> contexto de versión de página
5. `/projects/{idproject}/{idpagina}/{idpaginaversion}/{resource}` -> contexto de recurso
6. `/projects/{idproject}/{idpagina}/{idpaginaversion}/{resource}/{idresourcepage}` -> detalle final del recurso en página

## 5) Contrato backend recomendado (REST)

- `GET /api/v1/projects` -> lista proyectos visibles (no borrados)
- `POST /api/v1/projects` -> crea proyecto
- `PUT /api/v1/projects/{projectId}` -> edita propiedades
- `DELETE /api/v1/projects/{projectId}` -> soft delete (`isDeleted=true`)
- `GET /api/v1/projects/{projectId}/members` -> lista usuarios con acceso
- `POST /api/v1/projects/{projectId}/members` -> comparte proyecto por email

## 6) Reglas de negocio

1. Solo el propietario o miembros autorizados pueden consultar/editar.
2. Los proyectos con `isDeleted=true` no aparecen en listados por defecto.
3. No se deben duplicar miembros activos para el mismo email en un proyecto.
4. La acción principal del listado es **Ver páginas**.

## 7) Criterios de aceptación

- En `/projects` se muestra botón de creación arriba a la derecha.
- Se listan proyectos con todas sus propiedades.
- Cada proyecto permite Borrar, Compartir, Editar y Ver páginas.
- Crear proyecto se ejecuta desde popup/modal.
- Editar proyecto se ejecuta desde popup/modal.
- Compartir proyecto se ejecuta desde popup/modal.
- Borrar proyecto solicita confirmación antes de aplicar el soft-delete.
- Borrar actualiza `isDeleted=true` sin eliminación física.
- Compartir permite ver miembros actuales y añadir email nuevo.
- Ver páginas navega correctamente a la ruta jerárquica del proyecto.
