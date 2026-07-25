# Diseño: jerarquía simplificada de recursos por idioma

**Fecha:** 2026-07-25  
**Estado:** Aprobado

## Objetivo

Eliminar la asociación indirecta `ResourcePage` y convertir el árbol funcional en una relación directa:

`Project → Page → PageVersion → Resource → ResourceVersion`

Cada recurso pertenece a una única versión de página. Cada versión de recurso contiene el texto de un idioma.

## Decisiones aprobadas

- `Resource.PageVersionId` es obligatorio.
- Se eliminan `Resource.ProjectId` y toda la entidad `ResourcePage`.
- `ResourceVersion.Name` se reemplaza por `LanguageCode`.
- `ResourceVersion.Value` contiene el texto traducido.
- Se elimina `ResourceVersion.IsDefault`.
- `(ResourceId, LanguageCode)` es único entre versiones activas.
- La base de desarrollo puede eliminarse y recrearse sin conservar datos.
- El cambio cubre modelo, API, frontend, pruebas y documentación.

## Idiomas

El catálogo inicial es:

| Código | Etiqueta | Asset local |
| --- | --- | --- |
| `pt-br` | Português (Brasil) | Brasil |
| `es-es` | Español | España |
| `en-uk` | English (United Kingdom) | Reino Unido |

El catálogo se comparte conceptualmente entre backend y frontend, aunque cada capa mantiene una representación apropiada para su entorno. No existe un límite estructural de tres idiomas: ampliar el catálogo no requiere una migración.

El backend normaliza códigos en minúsculas y rechaza códigos desconocidos. El frontend usa un desplegable con bandera SVG local, código y nombre, excluyendo idiomas ya usados por el recurso.

## Backend

### Creación atómica

Crear un recurso recibe `key`, `description` opcional, `languageCode` y `value`. Tras validar permisos, jerarquía, idioma y duplicados, el servicio crea `Resource` y la primera `ResourceVersion` con una sola persistencia. Cualquier fallo deja ambas entidades sin guardar.

### Errores

- Usuario sin permisos: `403 Forbidden`.
- Entidad ausente o fuera del árbol: `404 Not Found`.
- Datos obligatorios o idioma desconocido: `400 Bad Request`.
- Idioma ya existente para el recurso: `409 Conflict`.

### Rutas

```text
GET|POST   /api/v1/projects/{projectId}/pages/{pageId}/versions/{pageVersionId}/resources
PUT|DELETE /api/v1/projects/{projectId}/pages/{pageId}/versions/{pageVersionId}/resources/{resourceId}

GET|POST   /api/v1/projects/{projectId}/pages/{pageId}/versions/{pageVersionId}/resources/{resourceId}/versions
PUT|DELETE /api/v1/projects/{projectId}/pages/{pageId}/versions/{pageVersionId}/resources/{resourceId}/versions/{resourceVersionId}
```

## Frontend

La ruta funcional termina en el recurso:

`/projects/{projectId}/{pageId}/{pageVersionId}/{resourceId}`

La vista de versión de página lista directamente sus recursos. Se eliminan el listado, modal de vínculo y detalle de `ResourcePage`.

El modal de recurso solicita clave, descripción opcional, idioma inicial y valor. El detalle del recurso lista traducciones y permite añadir otra desde los idiomas todavía disponibles. Se elimina la acción de marcar una versión de recurso como predeterminada.

Las banderas se descargan como SVG y se sirven desde assets locales del frontend.

## Persistencia

El esquema de navegación se recrea con las relaciones nuevas. No se implementa una transformación de datos antiguos porque se ha aprobado reiniciar la base de desarrollo.

Al borrar lógicamente una versión de página, sus recursos y traducciones dejan de ser consultables. Las consultas siempre validan el árbol completo y el estado de sus ancestros.

## Pruebas

### Backend

- Creación atómica de recurso y primera traducción.
- Acceso autorizado y no autorizado.
- Validación de proyecto, página y versión de página.
- Catálogo válido, código desconocido e idioma duplicado.
- Listado aislado por versión de página.
- Borrado lógico y ausencia de datos parciales.

### Frontend

- Navegación sin `resourcePageId`.
- Carga de recursos directos de la versión de página.
- Creación con idioma y valor obligatorios.
- Banderas y etiquetas del catálogo inicial.
- Exclusión de idiomas ya utilizados.
- Eliminación de llamadas y vistas de `ResourcePage`.

### Verificación final

- Suite completa de API.
- Suite completa de frontend.
- Build de producción y lint.
- Comprobación de migraciones desde base vacía.
- Validación visual responsive del selector y los modales.

## Fuera de alcance

- Preservar datos del esquema anterior.
- Administrar idiomas desde la UI.
- Configurar idiomas por proyecto.
- Compartir recursos entre páginas o versiones de página.
- Introducir `Language`, `ProjectLanguage` o `ResourceText`.