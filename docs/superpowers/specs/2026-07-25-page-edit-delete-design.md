# Edición y borrado de páginas

## Objetivo

Permitir editar y borrar lógicamente páginas desde el listado de páginas de un proyecto, manteniendo el patrón visual y de interacción usado en Projects.

## Diseño

Cada tarjeta de página incorpora las acciones `Editar` y `Borrar` junto a `Ver versiones`. `Editar` abre un modal con nombre y descripción precargados; el nombre es obligatorio y, tras un `PUT` correcto, la página se reemplaza en el estado local. `Borrar` abre un modal de confirmación y, tras un `DELETE` correcto, elimina la página del listado visible.

El cliente API expone `putPage` y `deletePage` sobre el wrapper autenticado existente, por lo que conserva la renovación automática de token. Los errores se muestran mediante el aviso global existente y el usuario permanece en el contexto del proyecto.

## Pruebas

Una prueba de integración recorre ambos flujos, comprueba los payloads enviados, verifica la actualización visible y confirma que la página borrada desaparece. La suite completa, el build y el lint actúan como regresión.