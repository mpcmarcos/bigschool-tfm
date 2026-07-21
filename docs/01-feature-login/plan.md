# Plan de implementación — Feature 1 Login (TDD)

## Acciones ejecutadas en esta solicitud

- [x] Crear `docs/01-feature-login/plan.md`
- [x] Ajustar el plan para aplicar TDD en todas las tareas

---

## Objetivo

Implementar login social (Google) de extremo a extremo con API REST, frontend React, tokens (access + refresh), actualización de `lastLoginAt` y cobertura de pruebas, siguiendo **TDD en todas las fases**.

## Enfoque TDD global (obligatorio)

Para **cada historia/tarea**:

1. **Red**: escribir primero test que falle.
2. **Green**: implementar el mínimo código para pasar el test.
3. **Refactor**: mejorar diseño sin romper tests.
4. Repetir ciclo hasta cerrar la tarea.

Regla: no se implementa funcionalidad nueva sin test fallando previo.

---

## Fase 1 — Contrato API y arquitectura (TDD)

### Tareas
- [x] Definir contrato de `POST /api/v1/auth/social/login`
- [x] Definir contrato de `POST /api/v1/auth/refresh`
- [x] Definir contrato de `POST /api/v1/auth/logout`
- [x] Definir contrato de `GET /api/v1/me`
- [x] Estandarizar errores con `ProblemDetails`

### Ciclo TDD
- **Red**: tests de contrato (status code + shape JSON) en `resources-api-test`.
- **Green**: crear DTOs/endpoints mínimos que cumplan contrato.
- **Refactor**: consolidar validaciones y respuestas de error comunes.

---

## Fase 2 — Persistencia y migraciones (TDD)

### Tareas
- [x] Añadir `User.lastLoginAt`
- [x] Crear entidad `UserSocialLogin`
- [x] Crear entidad `RefreshToken` (hash, expiración, revocación, rotación)
- [x] Añadir índices/FKs/restricciones únicas
- [x] Crear migración EF Core y aplicarla

### Ciclo TDD
- **Red**: tests de repositorio/integración para alta, consulta, update y constraints.
- **Green**: implementar entidades, mapeos y migración.
- **Refactor**: optimizar nombres, índices y separación de responsabilidades.

---

## Fase 3 — Backend Auth (TDD)

### Tareas
- [x] Implementar validación de `idToken` Google
- [x] Implementar login social con creación automática de usuario
- [x] Actualizar `lastLoginAt` solo en login exitoso
- [x] Emitir `accessToken` (15 min) y `refreshToken` (30 días)
- [x] Implementar rotación de refresh token
- [x] Implementar revocación en logout

### Ciclo TDD
- **Red**: tests de casos felices y de error:
  - login válido/inválido
  - refresh válido/inválido
  - logout válido/inválido
  - no actualizar `lastLoginAt` en fallo
- **Green**: implementar servicios/controladores mínimos.
- **Refactor**: extraer servicios (`TokenService`, `SocialLoginService`, etc.).

---

## Fase 4 — Frontend Auth y rutas protegidas (TDD)

### Tareas
- [x] Crear ruta pública `/login`
- [x] Crear ruta protegida `/projects`
- [x] Redirección desde `/` según sesión
- [x] Integrar botón Google Sign-In
- [x] Consumir login social del backend
- [x] Gestionar sesión (login, refresh, logout)

### Ciclo TDD
- **Red**: tests en `resources-app-test`:
  - render login
  - redirección por estado de sesión
  - login exitoso/error
  - limpieza de sesión en logout
- **Green**: implementar componentes/hooks/rutas mínimas.
- **Refactor**: simplificar estado y cliente API auth.

---

## Fase 5 — Seguridad y validaciones (TDD)

### Tareas
- [x] Validar payloads y proveedor permitido (`google`)
- [x] Asegurar almacenamiento hash de refresh token
- [x] Garantizar expiración/revocación consistente
- [x] Evitar logging de secretos/tokens

### Ciclo TDD
- **Red**: tests negativos (payload inválido, token expirado, token revocado, proveedor inválido).
- **Green**: implementar validaciones y políticas.
- **Refactor**: centralizar validadores y manejo de errores.

---

## Fase 6 — Validación final automatizada (TDD)

### Tareas
- [x] Ejecutar `npm run lint`
- [x] Ejecutar `npm run build`
- [x] Ejecutar `npm run test`
- [x] Corregir regresiones hasta verde completo

### Criterio de salida
- Todo en verde sin desactivar tests ni relajar validaciones.

---

## Fase 7 — Documentación y cierre

### Tareas
- [x] Actualizar `README.md` (setup y uso de login)
- [x] Actualizar `docs/01-feature-login/README.md` con resultado final
- [x] Documentar variables de entorno y pasos OAuth Google
- [x] Checklist DoD final

### DoD (Definition of Done)
- [x] Endpoints auth implementados y probados
- [x] Frontend login integrado y probado
- [x] `lastLoginAt` persistido correctamente
- [x] Refresh/logout con rotación/revocación correctas
- [x] Lint/build/test en verde
- [x] Documentación actualizada

---

## Orden recomendado de ejecución

1. Fase 1 (contrato)  
2. Fase 2 (persistencia)  
3. Fase 3 (backend auth)  
4. Fase 4 (frontend)  
5. Fase 5 (seguridad)  
6. Fase 6 (validación global)  
7. Fase 7 (documentación)

Siempre siguiendo ciclo **Red -> Green -> Refactor** en cada tarea.
