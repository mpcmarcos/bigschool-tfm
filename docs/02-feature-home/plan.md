# Plan de implementación — Feature 2 Home (TDD)

## Acciones ejecutadas en esta solicitud

- [x] Crear `docs/02-feature-home/README.md`
- [x] Crear `docs/02-feature-home/plan.md`
- [x] Añadir funcionalidad 2 en `docs/funcional-spec.md` y renumerar las restantes
- [x] Implementar Home pública con diseño inspirado en Frontitude
- [x] Añadir cobertura de tests frontend para Home/Login/Projects
- [x] Actualizar documentación principal (`README.md`)

---

## Objetivo

Entregar la funcionalidad `02-feature-home` como landing pública de producto, conservando el flujo de autenticación y protección de rutas existentes.

## Ciclo TDD aplicado

1. Definir escenarios de prueba esperados para la nueva Home.
2. Ajustar tests de integración frontend para reflejar:
   - home pública,
   - navegación al login,
   - carrusel funcional,
   - secciones de clientes y testimonios.
3. Implementar UI y lógica mínima para llevar los tests a verde.
4. Refactorizar estructura de secciones y estilos manteniendo cobertura.

## Escenarios funcionales cubiertos

1. Render inicial de Home con marca `resourceApp`.
2. Link de login accesible desde menú superior.
3. Carrusel de funcionalidades con navegación.
4. Bloque de 10 clientes ficticios.
5. Bloque de testimonios con foto de persona por comentario.
6. Assets locales versionados en formato WebP para logos y testimonios.
7. Ruta protegida `/projects` sigue requiriendo sesión.
8. Login y logout mantienen persistencia/limpieza de sesión.

## Validación pendiente

> No ejecutada en esta iteración por requisito del usuario:

- `npm run lint`
- `npm run build`
- `npm run test`
