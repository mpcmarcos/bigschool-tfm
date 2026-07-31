# ResourceApp Project Presentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generar una presentación PowerPoint editable de 20 diapositivas, en español, con capturas reales y ejemplos de uso de ResourceApp para una defensa académica de 15 minutos.

**Architecture:** La presentación se generará de forma declarativa con PptxGenJS desde un único script, apoyado por funciones reutilizables de composición visual. Las capturas se obtendrán del frontend real con datos API controlados y se incrustarán como PNG; un segundo script validará la estructura Open XML, el número de diapositivas, las notas y los recursos embebidos.

**Tech Stack:** Node.js 20+, PptxGenJS, Vite, Playwright/browser tools, Microsoft PowerPoint, Quick Look de macOS.

## Global Constraints

- Audiencia principal: tribunal académico.
- Duración objetivo: 15 minutos.
- Extensión exacta de trabajo: 20 diapositivas.
- Idioma: español.
- Autoría: Marcos Palacios - TFM Business School.
- Formato final: `.pptx` editable y autocontenido.
- Estilo: académico moderno, fondo claro, azul tinta y acentos coral/verde.
- No incluir secretos, credenciales reales, tokens válidos ni cadenas de conexión.
- Etiquetar como alcance funcional cualquier capacidad documentada que no esté visible en la interfaz actual.
- No crear commits salvo petición explícita del usuario.

---

### Task 1: Tooling y estructura de artefactos

**Files:**
- Modify: `package.json`
- Create: `package-lock.json` si npm lo genera
- Create: `scripts/generate-project-presentation.mjs`
- Create: `scripts/validate-project-presentation.mjs`
- Create: `docs/presentation/assets/.gitkeep`
- Output: `docs/presentation/ResourceApp-TFM-Marcos-Palacios.pptx`

**Interfaces:**
- `generate-project-presentation.mjs` consume PNG de `docs/presentation/assets/` y produce el `.pptx` final.
- `validate-project-presentation.mjs <pptx>` devuelve código 0 solo si el paquete contiene 20 slides, notas, imágenes embebidas y los cuatro títulos de sección requeridos.

- [ ] **Step 1: Instalar el generador**

Run: `npm install --save-dev pptxgenjs`

Expected: `package.json` incluye `pptxgenjs` en `devDependencies` y npm termina con código 0.

- [ ] **Step 2: Añadir scripts de generación y validación**

Añadir a `package.json`:

```json
{
  "scripts": {
    "presentation:build": "node scripts/generate-project-presentation.mjs",
    "presentation:validate": "node scripts/validate-project-presentation.mjs docs/presentation/ResourceApp-TFM-Marcos-Palacios.pptx"
  }
}
```

- [ ] **Step 3: Definir el contrato visual del generador**

El generador debe exportar o definir estas funciones:

```js
addBaseSlide(pptx, { section, title, kicker, notes })
addTitle(slide, title, subtitle)
addBulletList(slide, items, options)
addMetric(slide, { value, label, x, y, color })
addScreenshot(slide, path, { x, y, w, h, caption })
addFlow(slide, nodes, connectors)
addCodeBlock(slide, code, { x, y, w, h, language })
addFooter(slide, slideNumber, section)
```

Usar formato panorámico `LAYOUT_WIDE`, tipografía Aptos/Arial de respaldo, imágenes con `imageSizingContain`, esquinas de 4-6 px equivalentes y márgenes constantes.

- [ ] **Step 4: Crear primero una presentación mínima**

Generar portada, una slide de prueba y archivo de salida para comprobar que PptxGenJS escribe correctamente.

Run: `npm run presentation:build`

Expected: existe `docs/presentation/ResourceApp-TFM-Marcos-Palacios.pptx` y es un ZIP Office válido.

---

### Task 2: Capturas reales y datos de demostración

**Files:**
- Create: `docs/presentation/assets/01-home.png`
- Create: `docs/presentation/assets/02-login.png`
- Create: `docs/presentation/assets/03-projects.png`
- Create: `docs/presentation/assets/04-project-members.png`
- Create: `docs/presentation/assets/05-pages.png`
- Create: `docs/presentation/assets/06-page-versions.png`
- Create: `docs/presentation/assets/07-resources.png`
- Create: `docs/presentation/assets/08-translations.png`
- Create: `docs/presentation/assets/09-automatic-translations.png`

**Interfaces:**
- Las capturas usan viewport 1440x900 y tema oscuro de la app.
- La sesión local usa tokens ficticios y el correo `marcos@example.com`.
- Las respuestas interceptadas siguen exactamente los tipos de `src/resources-app/src/api.ts`.

- [ ] **Step 1: Arrancar solo el frontend**

Run: `npm --prefix src/resources-app run dev -- --host 127.0.0.1`

Expected: Vite anuncia una URL local accesible, normalmente `http://127.0.0.1:5173`.

- [ ] **Step 2: Capturar las vistas públicas**

Capturar `/` y `/login` con la aplicación real, sin overlays del navegador y sin datos personales.

- [ ] **Step 3: Preparar la sesión de demostración**

Antes de cargar `/projects`, establecer `resources-auth-session`:

```json
{
  "accessToken": "presentation-access-token",
  "refreshToken": "presentation-refresh-token",
  "tokenType": "Bearer",
  "expiresIn": 3600,
  "user": {
    "id": "user-demo",
    "email": "marcos@example.com",
    "lastLoginAt": "2026-07-31T10:00:00Z"
  }
}
```

- [ ] **Step 4: Interceptar el recorrido autenticado**

Responder a las rutas GET con datos coherentes:

```text
Proyecto: App móvil Commerce (`project-commerce`)
Miembros: marcos@example.com/admin, ana@example.com/editor
Página: Checkout (`page-checkout`)
Versiones: v1.0/predeterminada, v2.0
Recurso: checkout.pay_button
Descripción: Texto del botón principal de pago
Traducciones: es-es="Pagar ahora", en-uk="Pay now", pt-br="Pagar agora"
```

Capturar cada nivel de la jerarquía y los modales de miembros y traducción automática. No ejecutar llamadas reales a OpenAI.

- [ ] **Step 5: Verificar legibilidad**

Abrir las nueve imágenes y comprobar que no hay estados de carga, errores, recortes, overlays accidentales ni secretos.

---

### Task 3: Generación de las 20 diapositivas

**Files:**
- Modify: `scripts/generate-project-presentation.mjs`
- Output: `docs/presentation/ResourceApp-TFM-Marcos-Palacios.pptx`

**Interfaces:**
- Cada slide incluye `addNotes()` con 2-4 ideas breves.
- Los diagramas de dominio, arquitectura, seguridad, Docker y Azure se construyen con formas y conectores editables.
- Las capturas solo se usan para funcionalidad implementada; OCR y exportación se presentan como alcance funcional cuando corresponda.

- [ ] **Step 1: Implementar slides 1-5, introducción**

1. Portada.
2. Problema: textos dispersos, inconsistencias y handoff manual.
3. Objetivos y alcance mediante bloques P0/P1/fuera de alcance.
4. Visión de extremo a extremo: centralizar → traducir → validar → exportar.
5. Actores y recorrido jerárquico.

- [ ] **Step 2: Implementar slides 6-12, especificación funcional**

6. Home con `01-home.png`.
7. Login y sesión con `02-login.png` y flujo OAuth/JWT.
8. Proyectos y miembros con `03-projects.png` y `04-project-members.png`.
9. Páginas y versiones con `05-pages.png` y `06-page-versions.png`.
10. Recursos e idiomas con `07-resources.png` y `08-translations.png`.
11. Traducción automática con `09-automatic-translations.png`, Structured Outputs y atomicidad.
12. Exportación JSON/XML con ejemplo etiquetado como alcance funcional:

```json
{
  "checkout.pay_button": {
    "es-es": "Pagar ahora",
    "en-uk": "Pay now",
    "pt-br": "Pagar agora"
  }
}
```

- [ ] **Step 3: Implementar slides 13-17, especificación técnica**

13. Modelo de dominio con siete entidades y cardinalidades.
14. Arquitectura React/Vite → ASP.NET Core → EF Core → MySQL, con OpenAI como integración de backend.
15. API jerárquica, validación de pertenencia, duplicados, soft delete y transacciones.
16. Seguridad: Google OAuth, JWT/refresh, roles, secretos y frontera de confianza.
17. Calidad: pruebas API/frontend, lint, build y Red-Green-Refactor.

- [ ] **Step 4: Implementar slides 18-20, despliegue y cierre**

18. Docker Compose local con puertos 5173, 5174 y 3306.
19. GitHub Actions → OIDC → ACR → Container Apps → MySQL Flexible Server, diferenciando build-time de runtime.
20. Conclusiones y evolución: OCR, exportación completa, auditoría, revisión editorial y catálogo administrable.

- [ ] **Step 5: Generar el archivo completo**

Run: `npm run presentation:build`

Expected: `ResourceApp-TFM-Marcos-Palacios.pptx` se genera sin warnings de desbordamiento y contiene 20 slides.

---

### Task 4: Validación estructural, visual y de contenido

**Files:**
- Modify: `scripts/validate-project-presentation.mjs`
- Output: `docs/presentation/preview/`

**Interfaces:**
- El validador inspecciona el ZIP Open XML sin modificar el archivo.
- La comprobación visual usa PowerPoint instalado y Quick Look como respaldo.

- [ ] **Step 1: Implementar validación estructural**

Comprobar:

```text
20 entradas ppt/slides/slide*.xml
20 relaciones de slide
notas presentes para las 20 slides
al menos 9 imágenes en ppt/media
texto: Introducción
texto: Especificación funcional
texto: Especificación técnica
texto: Despliegue y entorno productivo
ausencia de patrones: sk-, password=, resources_pass, root_password
```

- [ ] **Step 2: Ejecutar validaciones del archivo**

Run: `npm run presentation:validate`

Expected: `PASS: 20 slides, notes, media and required sections validated`.

- [ ] **Step 3: Abrir en PowerPoint**

Run: `open -a 'Microsoft PowerPoint' docs/presentation/ResourceApp-TFM-Marcos-Palacios.pptx`

Expected: PowerPoint abre el archivo sin diálogo de reparación ni fuentes ausentes.

- [ ] **Step 4: Revisar visualmente las 20 slides**

Comprobar a pantalla completa: ausencia de solapes, texto cortado, imágenes deformadas, bajo contraste o elementos fuera del área segura. Verificar que la numeración es continua y que cada captura tiene pie.

- [ ] **Step 5: Ejecutar regresión del repositorio**

Run: `npm run build && npm run lint`

Expected: build y lint terminan con código 0; cualquier fallo preexistente no relacionado se documenta sin modificar código de producto.

- [ ] **Step 6: Entregar**

Confirmar la ruta del `.pptx`, resumir las capturas incluidas y registrar los comandos de validación ejecutados.