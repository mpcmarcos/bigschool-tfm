# 02 — Feature Home (Plan de implementación detallado)

## Estado de implementación (esta iteración)

- Frontend implementado en `resources-app` para la nueva Home pública en `/`.
- Menú superior implementado con:
  - logo neon generado `ResouceApp`,
  - link visible a `Login`.
  - opción para alternar `modo oscuro / modo claro`.
- Cuerpo de Home implementado con:
  - carrusel de funcionalidades destacadas (inspiración Frontitude),
  - bloque de 10 clientes ficticios con logos inventados,
  - bloque de comentarios de clientes con foto por comentario.
- Imágenes de testimonios versionadas como assets locales WebP.
- Logos de clientes recreados como imágenes SVG embebidas (data URI) con estética neon.
- Tests frontend integrados en `src/resources-app-test/App.integration.test.tsx` para Home/Login/Projects.

> Nota: por instrucción explícita de esta solicitud, no se ejecutaron lint/build/test en esta iteración.

## 1) Objetivo

Definir e implementar la funcionalidad `02-feature-home` como landing pública del producto, reforzando propuesta de valor y punto de entrada a autenticación.

## 2) Alcance de esta iteración

- Añadir vista Home pública en ruta `/`.
- Mantener `/login` como ruta pública de autenticación y `/projects` como ruta protegida.
- Diseñar bloques de marketing funcional:
  - hero principal,
  - carrusel de funcionalidades,
  - logos de clientes ficticios,
  - testimonios.
- Añadir cobertura de pruebas frontend alineada con enfoque TDD.

## 3) Reglas funcionales aplicadas

1. La Home debe estar disponible sin autenticación.
2. El acceso a `/projects` sigue protegido por sesión.
3. El link superior de `Login` debe estar siempre visible.
4. El carrusel debe permitir navegar entre funcionalidades destacadas.
5. Los testimonios deben mostrar foto, autor y rol.

## 4) Diseño UX/UI implementado

### 4.1 Header superior
- Marca `ResouceApp` con logo neon.
- Navegación principal con links y control de tema (oscuro/claro).

### 4.2 Home body
- Hero con propuesta de valor.
- Carrusel de funcionalidades (navegación anterior/siguiente + contador de slide).
- Sección “Equipos que ya lo usan” con 10 clientes ficticios.
- Sección “Comentarios destacados” con 3 testimonios.

### 4.3 Optimización de imágenes
- Se usan assets locales `.webp` para testimonios.
- Los logos de clientes se renderizan como SVG (data URI), vectoriales y ligeros.
- Se aplica `loading="lazy"` en imágenes de testimonios.

## 5) Implementación técnica

### Frontend (`src/resources-app/src/App.tsx`)
- Se introducen datasets tipados para:
  - `FEATURE_SLIDES`
  - `CLIENTS`
  - `TESTIMONIALS`
- Se añade estado de carrusel (`activeFeatureIndex`) y handlers de navegación.
- Se añade estado de tema (`dark/light`) persistido en `localStorage`.
- Se ajusta el enrutado local:
  - `/` -> Home pública,
  - `/login` -> login,
  - `/projects` -> protegida.

### Estilos (`src/resources-app/src/App.css`)
- Nuevos estilos para:
  - top navigation,
  - hero,
  - carrusel,
  - grid de clientes,
  - grid de testimonios,
  - responsive móvil.

### Assets
- Nuevo logo generado:
  - `src/resources-app/src/assets/resourceapp-logo.svg`
- Assets WebP de testimonios:
  - `src/resources-app/src/assets/home/testimonials/*.webp`

## 6) Testing (filosofía TDD)

Se documentan y dejan implementadas pruebas de integración frontend para:

1. Render de Home con logo, login link, funcionalidades y clientes.
2. Navegación Home -> Login.
3. Interacción de carrusel (avance de slide).
4. Alternancia de modo oscuro/claro desde menú.
5. Presencia de testimonios con imágenes web optimizadas (WebP).
6. Protección de ruta `/projects` sin sesión.
7. Login exitoso con persistencia de sesión.
8. Manejo de error en login.
9. Logout y limpieza de sesión.

Archivo principal:
- `src/resources-app-test/App.integration.test.tsx`

## 7) Criterios de aceptación de la feature

- [x] Home pública visible en `/`.
- [x] Logo neon `ResouceApp`, link `Login` y toggle de tema en menú superior.
- [x] Carrusel de funcionalidades operativo.
- [x] Sección de 10 clientes ficticios.
- [x] Sección de testimonios con foto por comentario y preferencia WebP.
- [x] Tests frontend actualizados para el nuevo flujo.

## 8) Limitaciones y próximos pasos recomendados

- Sustituir logos/fotos ficticias por activos corporativos definitivos.
- Valorar internacionalización de textos de Home.
- Añadir analítica de interacción (click login, interacción carrusel).
- Ejecutar validación final (`lint`, `build`, `test`) en la siguiente iteración.
