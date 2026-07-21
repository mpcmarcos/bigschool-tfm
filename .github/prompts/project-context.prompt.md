# Contexto del Proyecto: Gestión de Recursos con Sincronización Figma + Sketch

## 1) Descripción del proyecto
Plataforma para la **gestión de recursos de una web** con sincronización bidireccional (cuando aplique) con herramientas de diseño:

- **Figma**
- **Sketch**

El objetivo es mantener consistencia entre recursos de diseño y su implementación en la aplicación web.

---

## 2) Stack tecnológico oficial

### Frontend
- **ReactJS**
- **TypeScript**

### Backend
- **APIs en .NET Core 10** (ASP.NET Core)

### Plugin de Sketch (tecnología recomendada)
Para el plugin de Sketch se recomienda:

- **TypeScript** para lógica del plugin
- **Sketch JavaScript API** (entorno oficial de Sketch)
- **skpm** como herramienta de build y empaquetado
- **WebView + React (opcional)** para UI del plugin cuando se necesite interfaz rica

> Motivo: esta combinación es la más práctica para mantener tipado, mantenibilidad y una integración moderna con flujos de frontend.

---

## 3) Estructura de carpetas requerida

```text
src/
  resources-app/         # aplicación frontend (React + TypeScript)
  resources-api/         # backend APIs (.NET Core 10)
  resources-app-test/    # tests frontend
  resources-api-test/    # tests backend
```

Reglas:
- No mezclar código de frontend y backend.
- Los tests deben vivir en sus carpetas dedicadas.
- Mantener organización por dominios/feature dentro de cada carpeta.

---

## 4) Metodología obligatoria: TDD
Todo el proyecto debe desarrollarse con **Test-Driven Development**:

1. **Red**: crear primero un test que falle.
2. **Green**: implementar lo mínimo para pasar el test.
3. **Refactor**: mejorar diseño sin romper tests.

### Reglas TDD operativas
- No implementar funcionalidad sin test previo.
- Cada bug corregido debe incluir un test de regresión.
- PRs deben incluir evidencia de ejecución de tests.
- Mantener tests unitarios rápidos y tests de integración para flujos clave.

---

## 5) Buenas prácticas de arquitectura y calidad

### Frontend (React + TypeScript)
- Componentes pequeños y cohesionados.
- Separar UI, estado y acceso a datos.
- Tipado estricto (`strict: true` recomendado).
- Manejo de errores explícito y estados de carga claros.

### Backend (.NET Core 10)
- Diseño por capas (API, aplicación, dominio, infraestructura).
- Contratos DTO versionados cuando cambien APIs.
- Validación de entrada y respuestas con códigos HTTP correctos.
- Logging estructurado y trazabilidad por request/correlation id.

### Integración con Figma y Sketch
- Definir adaptadores por proveedor (`FigmaAdapter`, `SketchAdapter`).
- Normalizar recursos a un modelo interno común.
- Idempotencia en sincronizaciones para evitar duplicados.
- Reintentos controlados con backoff para errores transitorios.

---

## 6) Calidad, seguridad y operación
- Gestión de secretos por variables de entorno (nunca hardcodear tokens).
- Validar y sanitizar datos externos de plugins/APIs.
- Cobertura mínima recomendada en lógica crítica: **>= 80%**.
- Pipeline CI con tests automáticos de frontend y backend.

---

## 7) Definición de hecho (Definition of Done)
Una tarea se considera completada si:

- Tiene tests (unitarios/integración) creados antes de la implementación.
- Todos los tests pasan en local y en CI.
- Se actualiza documentación técnica afectada.
- No introduce regresiones funcionales ni de sincronización.

