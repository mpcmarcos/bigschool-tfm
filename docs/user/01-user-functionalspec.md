# Historial de prompts de usuario: especificaciones funcionales

## 2026-07-21T23:30:16.134+02:00
Dame una lista de las principales funcionalidades que deberia tener un software de gestión de recursos, ordenados por prioridad.

Algunas de las ideas son las siguientes:
- Crear proyecto
- Un proyecto tiene varias páginas
- Cada página tiene versiones , la default
- Una versión tiene varios recursos
- cada recurso tiene 0 o varias versiones ç

Un proyecto es accesible por el usuario creador, y aquellos usuarios a los que se les comparte
El login debe funcionar con login social
Una página debe poderse crear subiendo una imagen, esta debe pasar por un OCR y detectar todos los recursos existentes
Al crear un nuevo recurso, debe indicar que el resource ya existe en algun otro uso y sugerir crear un resource compartido

## 2026-07-21T23:42:45.510+02:00
Dame una lista de las principales funcionalidades que deberia tener un software de gestión de recursos, ordenados por prioridad.

Algunas de las ideas son las siguientes:

- Crear proyecto
- Un proyecto tiene varias páginas
- Cada página tiene versiones , la default
- Una versión tiene varios recursos
- cada recurso tiene varias versiones, la default
- Cada Versión tiene varios idiomas, identificados por su código pt-br o es-ES , es-MX y asi sucesivamente.
- Finalmente tenemos el ResouceText que tiene el texto con la traducción

Un proyecto es accesible por el usuario creador, y aquellos usuarios a los que se les comparte
El login debe funcionar con login social, necesitaremos una funcionalidad para compartir proyectos
Una página debe poderse crear subiendo una imagen, esta debe pasar por un OCR y detectar todos los recursos existentes
Al crear un nuevo recurso, debe indicar que el resource ya existe en algun otro uso y sugerir crear un resource compartido
Los recursos pueden ser exportados a Json o xml desde proyecto, exporta todo los recursos, desde página, exporta los recursos de una pagina o individualmente, y exporta las diferentes versiones.

El identificador del recurso será el siguiente
PáginaID + VersionPaginaID + ResourceID + VersionResourceID, en caso de teno tener VersionResourceID este no se añade.

Propiedades de las principales entidades
Página: Id Pagina, Nombre, Fecha de Inserción, Fecha Modificación, IsDeleted
Versión Página: Id Versión Pagina, Nombre, Fecha de Inserción, Fecha Modificación, IsDeleted
Resource: Id Resource, Nombre, Fecha de Inserción, Fecha Modificación, IsDeleted
Version Resource: Id Version Resource, Nombre, Fecha de Inserción, Fecha Modificación, IsDeleted
Languages : Id Language, Nombre, Fecha de Inserción, Fecha Modificación, IsDeleted

Estas propiedades son orientativas, y puedes mejorarlo, revisa las relaciones, y plasmalas claramente en el documento.

Revisa https://www.frontitude.com/guides como guia del software que estamos clonando, desde una vertiente más simplificada.

El output debe ser un fichero de Especificaciones funcionales priorizada, guarda el fichero como docs/funcional-spec.md en el directorio

## 2026-07-21T23:51:23.678+02:00
Revisa para que pageversion tenga una relación 1 a N con Resource, plasma más gráficamente las entiades y sus relaciones.

