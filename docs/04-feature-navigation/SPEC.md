# 04 — Feature Navigation (Gestión jerárquica simplificada)

## 1) Objetivo

Implementar una navegación jerárquica directa en la que cada recurso pertenece a una única versión de página y cada versión del recurso representa una traducción por idioma.

Jerarquía funcional:

`Project → Page → PageVersion → Resource → ResourceVersion`

La asociación intermedia `ResourcePage` se elimina del frontend, backend y base de datos.

## 2) Navegación frontend

1. `/projects` muestra los proyectos.
2. `/projects/{projectId}` muestra las páginas del proyecto.
3. `/projects/{projectId}/{pageId}` muestra las versiones de la página.
4. `/projects/{projectId}/{pageId}/{pageVersionId}` muestra los recursos de esa versión.
5. `/projects/{projectId}/{pageId}/{pageVersionId}/{resourceId}` muestra las traducciones del recurso.

No existe una vista final ni un identificador para una asociación recurso-página.

## 3) Modelo de datos

- `Page`: `id`, `projectId`, `name`, `description?`, trazabilidad y soft delete.
- `PageVersion`: `id`, `pageId`, `name`, `isDefault`, trazabilidad y soft delete.
- `Resource`: `id`, `pageVersionId`, `key`, `normalizedKey`, `description?`, trazabilidad y soft delete.
- `ResourceVersion`: `id`, `resourceId`, `languageCode`, `value`, trazabilidad y soft delete.

Relaciones:

- `Project 1:N Page`
- `Page 1:N PageVersion`
- `PageVersion 1:N Resource`
- `Resource 1:N ResourceVersion`

Restricciones:

- `Resource.PageVersionId` es obligatorio.
- `(ResourceId, LanguageCode)` es único entre versiones activas.
- `ResourceVersion` no tiene nombre libre ni propiedad `isDefault`.

## 4) Creación de recursos

El modal contiene clave obligatoria, descripción opcional, idioma inicial mediante desplegable con bandera y valor traducido obligatorio.

El backend crea `Resource` y su primera `ResourceVersion` en una única operación. Un error de validación o persistencia no deja datos parciales.

## 5) Idiomas

Catálogo inicial:

- `pt-br` — Português (Brasil), bandera de Brasil.
- `es-es` — Español, bandera de España.
- `en-uk` — English (United Kingdom), bandera de Reino Unido.

Las banderas se almacenan como SVG locales. El catálogo se centraliza y puede ampliarse sin modificar el esquema de datos.

Al añadir una traducción, el selector solo muestra idiomas que el recurso todavía no utiliza. Un código no soportado produce `400 Bad Request` y un idioma duplicado produce `409 Conflict`.

## 6) Contrato REST

### Pages y PageVersions

- `GET|POST /api/v1/projects/{projectId}/pages`
- `PUT|DELETE /api/v1/projects/{projectId}/pages/{pageId}`
- `GET|POST /api/v1/projects/{projectId}/pages/{pageId}/versions`
- `PUT|DELETE /api/v1/projects/{projectId}/pages/{pageId}/versions/{pageVersionId}`
- `POST /api/v1/projects/{projectId}/pages/{pageId}/versions/{pageVersionId}/set-default`

### Resources

- `GET|POST /api/v1/projects/{projectId}/pages/{pageId}/versions/{pageVersionId}/resources`
- `PUT|DELETE /api/v1/projects/{projectId}/pages/{pageId}/versions/{pageVersionId}/resources/{resourceId}`

El alta recibe `key`, `description?`, `languageCode` y `value`.

### ResourceVersions

- `GET|POST /api/v1/projects/{projectId}/pages/{pageId}/versions/{pageVersionId}/resources/{resourceId}/versions`
- `PUT|DELETE /api/v1/projects/{projectId}/pages/{pageId}/versions/{pageVersionId}/resources/{resourceId}/versions/{resourceVersionId}`

El alta recibe `languageCode` y `value`. Se elimina el endpoint `set-default` de versiones de recurso.

## 7) Reglas de negocio

1. Todos los IDs de ruta deben pertenecer al mismo árbol jerárquico.
2. Solo miembros autorizados pueden consultar o modificar el proyecto.
3. Los listados excluyen entidades borradas lógicamente.
4. Cada página mantiene una única versión de página predeterminada activa.
5. Cada recurso pertenece a una sola versión de página.
6. Cada recurso mantiene como máximo una traducción por idioma.
7. Borrar una versión de página oculta también sus recursos y traducciones.
8. No se puede vincular ni reutilizar un recurso entre versiones de página.

## 8) Cambios de persistencia

- Eliminar `DbSet<ResourcePage>`, su modelo, relaciones e índices.
- Reemplazar `Resource.ProjectId` por `Resource.PageVersionId`.
- Reemplazar `ResourceVersion.Name` por `ResourceVersion.LanguageCode`.
- Eliminar `ResourceVersion.IsDefault`.
- Añadir índice único para `(ResourceId, LanguageCode)`.
- Recrear la base de desarrollo sin conservar los datos anteriores.

## 9) Criterios de aceptación

- La navegación tiene cinco niveles y no contiene un ID de asociación recurso-página.
- Una versión de página lista únicamente sus propios recursos.
- Crear un recurso exige una primera traducción y es atómico.
- El selector muestra banderas locales y los tres idiomas iniciales.
- Un idioma ya utilizado desaparece del selector de ese recurso.
- Backend rechaza idiomas no soportados, duplicados y jerarquías incoherentes.
- No queda código, contrato, ruta, estado o prueba funcional de `ResourcePage`.
- Las suites completas de backend y frontend, build y lint quedan en verde.

## 10) Estrategia TDD

1. Escribir primero pruebas API para el nuevo árbol y observar su fallo.
2. Implementar el modelo y endpoints mínimos hasta pasarlas.
3. Escribir pruebas frontend para rutas, creación y selector de idiomas.
4. Implementar la interfaz y los assets locales.
5. Ejecutar regresión completa y validación visual en escritorio y móvil.