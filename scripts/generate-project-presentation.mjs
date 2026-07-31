import PptxGenJS from "pptxgenjs";
import fs from "node:fs";
import path from "node:path";

const FONT_FACE = "Arial";
const PPTX_LAYOUT = "LAYOUT_WIDE";
const COLORS = {
  ink: "183B56",
  coral: "FF6B57",
  green: "2FA36B",
  gold: "C58A2B",
  text: "243746",
  muted: "5B6B7B",
  line: "D6DFE8",
  panel: "F7F9FC",
  panelStrong: "EEF3F8",
  white: "FFFFFF",
  redSoft: "FFF1EE",
  greenSoft: "EDF8F2",
  blueSoft: "EEF5FB",
  sandSoft: "FFF7EC",
};

const ASSET_DIR = path.join("docs", "presentation", "assets");
const OUTPUT_DIR = path.join("docs", "presentation");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "ResourceApp-TFM-Marcos-Palacios.pptx");

const slideManifest = [];

function assetPath(name) {
  return path.join(ASSET_DIR, name);
}

function addNotes(slide, notes) {
  slide.addNotes(notes.map((note, index) => `${index + 1}. ${note}`).join("\n"));
}

function addText(slide, text, options = {}) {
  slide.addText(text, {
    fontFace: FONT_FACE,
    color: COLORS.text,
    margin: 0,
    breakLine: false,
    ...options,
  });
}

function addShape(slide, shape, options = {}) {
  slide.addShape(shape, options);
}

function addLine(slide, x1, y1, x2, y2, { color = COLORS.ink, width = 1.4, endArrowType = "triangle" } = {}) {
  addShape(slide, "line", {
    x: x1,
    y: y1,
    w: x2 - x1,
    h: y2 - y1,
    line: { color, pt: width, endArrowType },
  });
}

function addPanel(slide, { x, y, w, h, fill = COLORS.white, line = COLORS.line, radius = 0.08 }) {
  addShape(slide, "roundRect", {
    x,
    y,
    w,
    h,
    rectRadius: radius,
    fill: { color: fill },
    line: { color: line, pt: 1 },
  });
}

function addSectionPill(slide, section, color = COLORS.ink) {
  addShape(slide, "roundRect", {
    x: 0.55,
    y: 0.34,
    w: 2.55,
    h: 0.34,
    rectRadius: 0.08,
    fill: { color },
    line: { color },
  });
  addText(slide, section, {
    x: 0.72,
    y: 0.405,
    w: 2.2,
    h: 0.18,
    fontSize: 11,
    bold: true,
    color: COLORS.white,
    align: "center",
  });
}

function addFooter(slide, slideNumber, section) {
  addShape(slide, "line", { x: 0.55, y: 6.88, w: 12.23, h: 0, line: { color: COLORS.line, pt: 1 } });
  addText(slide, section, { x: 0.55, y: 6.95, w: 4.2, h: 0.18, fontSize: 9.5, color: COLORS.muted });
  addText(slide, "ResourceApp · Marcos Palacios", {
    x: 4.8,
    y: 6.95,
    w: 3.8,
    h: 0.18,
    fontSize: 9.5,
    color: COLORS.muted,
    align: "center",
  });
  addText(slide, String(slideNumber), {
    x: 12.05,
    y: 6.95,
    w: 0.7,
    h: 0.18,
    fontSize: 9.5,
    color: COLORS.muted,
    align: "right",
  });
}

function addHeader(slide, { section, title, subtitle, number, accent = COLORS.ink }) {
  slide.background = { color: COLORS.white };
  addSectionPill(slide, section, accent);
  addText(slide, title, {
    x: 0.55,
    y: 0.84,
    w: 8.9,
    h: 0.5,
    fontSize: 24,
    bold: true,
    color: COLORS.ink,
  });
  if (subtitle) {
    addText(slide, subtitle, {
      x: 0.55,
      y: 1.28,
      w: 10.8,
      h: 0.32,
      fontSize: 11.5,
      color: COLORS.muted,
    });
  }
  addFooter(slide, number, section);
}

function createSlide(pptx, meta) {
  const slide = pptx.addSlide();
  addHeader(slide, meta);
  addNotes(slide, meta.notes);
  slideManifest.push({
    number: meta.number,
    section: meta.section,
    title: meta.title,
    notesCount: meta.notes.length,
    images: meta.images || [],
  });
  return slide;
}

function addList(slide, items, { x, y, w, h, fontSize = 13, color = COLORS.text, bulletColor = COLORS.coral, gap = 0.34 }) {
  items.forEach((item, index) => {
    addText(slide, "•", { x, y: y + index * gap, w: 0.2, h: 0.18, fontSize, bold: true, color: bulletColor });
    addText(slide, item, { x: x + 0.24, y: y + index * gap - 0.01, w: w - 0.24, h, fontSize, color });
  });
}

function addTag(slide, label, { x, y, w = 1.6, color = COLORS.ink, fill = COLORS.panel }) {
  addShape(slide, "roundRect", {
    x,
    y,
    w,
    h: 0.28,
    rectRadius: 0.07,
    fill: { color: fill },
    line: { color, pt: 0.9 },
  });
  addText(slide, label, {
    x,
    y: y + 0.05,
    w,
    h: 0.12,
    fontSize: 9.5,
    bold: true,
    color,
    align: "center",
  });
}

function addMetricCard(slide, { x, y, w, h, title, body, accent = COLORS.ink, fill = COLORS.panel }) {
  addPanel(slide, { x, y, w, h, fill });
  addShape(slide, "rect", { x, y, w: 0.1, h, fill: { color: accent }, line: { color: accent, pt: 0 } });
  addText(slide, title, { x: x + 0.24, y: y + 0.18, w: w - 0.34, h: 0.2, fontSize: 13, bold: true, color: COLORS.ink });
  addText(slide, body, { x: x + 0.24, y: y + 0.48, w: w - 0.34, h: h - 0.58, fontSize: 11.5, color: COLORS.muted });
}

function addProcessStep(slide, { x, y, w, h, step, title, body, accent = COLORS.ink, fill = COLORS.white }) {
  addPanel(slide, { x, y, w, h, fill });
  addTag(slide, step, { x: x + 0.18, y: y + 0.16, w: 0.7, color: accent, fill: COLORS.white });
  addText(slide, title, { x: x + 0.18, y: y + 0.52, w: w - 0.36, h: 0.2, fontSize: 12.5, bold: true, color: COLORS.ink });
  addText(slide, body, { x: x + 0.18, y: y + 0.82, w: w - 0.36, h: h - 1.0, fontSize: 10.5, color: COLORS.muted });
}

function addImageFrame(slide, imageFile, { x, y, w, h, caption, accent = COLORS.ink }) {
  addPanel(slide, { x, y, w, h: h + 0.38, fill: COLORS.white });
  const fullPath = assetPath(imageFile);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Missing asset: ${fullPath}`);
  }
  slide.addImage({ path: fullPath, x: x + 0.08, y: y + 0.08, w: w - 0.16, h: h - 0.02 });
  addShape(slide, "line", { x, y: y + h + 0.04, w, h: 0, line: { color: COLORS.line, pt: 0.8 } });
  addText(slide, caption, {
    x: x + 0.12,
    y: y + h + 0.1,
    w: w - 0.24,
    h: 0.18,
    fontSize: 9,
    color: accent,
  });
}

function addCodePanel(slide, { x, y, w, h, title, code, accent = COLORS.ink }) {
  addPanel(slide, { x, y, w, h, fill: COLORS.panel });
  addText(slide, title, { x: x + 0.18, y: y + 0.16, w: w - 0.36, h: 0.18, fontSize: 11, bold: true, color: accent });
  addText(slide, code, {
    x: x + 0.18,
    y: y + 0.48,
    w: w - 0.36,
    h: h - 0.62,
    fontSize: 9.5,
    color: COLORS.text,
    fit: "shrink",
  });
}

function addEntity(slide, { x, y, w, h, title, body, fill = COLORS.white, accent = COLORS.ink }) {
  addPanel(slide, { x, y, w, h, fill });
  addText(slide, title, { x: x + 0.12, y: y + 0.14, w: w - 0.24, h: 0.18, fontSize: 11.5, bold: true, color: accent, align: "center" });
  addShape(slide, "line", { x, y: y + 0.4, w, h: 0, line: { color: COLORS.line, pt: 0.8 } });
  addText(slide, body, { x: x + 0.12, y: y + 0.5, w: w - 0.24, h: h - 0.6, fontSize: 9.3, color: COLORS.muted, align: "center", fit: "shrink" });
}

function addConnectorLabel(slide, label, { x, y, w = 0.45, color = COLORS.muted }) {
  addText(slide, label, { x, y, w, h: 0.14, fontSize: 8.5, color, align: "center" });
}

export function addBaseSlide(pptx, { section, title, subtitle, kicker, notes, number, accent } = {}) {
  const slide = pptx.addSlide();
  slide.background = { color: COLORS.white };
  addSectionPill(slide, section || kicker || "Introducción", accent || COLORS.ink);
  addText(slide, title || "", { x: 0.55, y: 0.84, w: 9, h: 0.5, fontSize: 24, bold: true, color: COLORS.ink });
  if (subtitle) {
    addText(slide, subtitle, { x: 0.55, y: 1.28, w: 10.6, h: 0.28, fontSize: 11.5, color: COLORS.muted });
  }
  if (notes) addNotes(slide, Array.isArray(notes) ? notes : [notes]);
  addFooter(slide, number || 1, section || kicker || "Introducción");
  return slide;
}

export function addTitle(slide, title, subtitle) {
  addText(slide, title, { x: 0.55, y: 0.84, w: 9, h: 0.5, fontSize: 24, bold: true, color: COLORS.ink });
  if (subtitle) addText(slide, subtitle, { x: 0.55, y: 1.28, w: 10.6, h: 0.28, fontSize: 11.5, color: COLORS.muted });
}

export function addBulletList(slide, items = [], options = {}) {
  addList(slide, items, {
    x: options.x ?? 0.7,
    y: options.y ?? 2,
    w: options.w ?? 5.2,
    h: options.h ?? 0.24,
    fontSize: options.fontSize ?? 13,
    color: options.color ?? COLORS.text,
    bulletColor: options.bulletColor ?? COLORS.coral,
    gap: options.gap ?? 0.34,
  });
}

export function addMetric(slide, { value, label, x = 0.5, y = 2.0, color = COLORS.ink } = {}) {
  addText(slide, String(value), { x, y, w: 1.4, h: 0.36, fontSize: 28, bold: true, color });
  addText(slide, label || "", { x, y: y + 0.42, w: 2.2, h: 0.18, fontSize: 11, color: COLORS.muted });
}

export function addScreenshot(slide, imgPath, { x = 0.5, y = 2.0, w = 6.0, h = 3.5, caption } = {}) {
  const imageFile = path.basename(imgPath);
  addImageFrame(slide, imageFile, { x, y, w, h, caption: caption || imageFile });
}

export function addFlow(slide, nodes = [], connectors = []) {
  nodes.forEach((node) => addProcessStep(slide, node));
  connectors.forEach((connector) =>
    addLine(slide, connector.x1, connector.y1, connector.x2, connector.y2, {
      color: connector.color,
      width: connector.width,
      endArrowType: connector.endArrowType,
    }),
  );
}

export function addCodeBlock(slide, code, { x = 0.5, y = 2.0, w = 8.5, h = 3.5 } = {}) {
  addCodePanel(slide, { x, y, w, h, title: "Detalle", code });
}

function buildSlides(pptx) {
  const slide1 = createSlide(pptx, {
    number: 1,
    section: "Introducción",
    title: "ResourceApp",
    subtitle: "Gestión centralizada de recursos multilingües para equipos producto y desarrollo",
    notes: [
      "Abrir la defensa situando el problema: los textos de interfaz viven dispersos y cambian sin trazabilidad.",
      "Presentar ResourceApp como una pieza de coordinación entre producto, localización y desarrollo.",
      "Recordar la autoría y el alcance académico del TFM antes de entrar en el contenido funcional.",
    ],
  });
  addText(slide1, "Marcos Palacios", { x: 0.72, y: 2.08, w: 2.8, h: 0.28, fontSize: 18, bold: true, color: COLORS.ink });
  addText(slide1, "TFM Business School", { x: 0.72, y: 2.42, w: 3.0, h: 0.22, fontSize: 12.5, color: COLORS.muted });
  addText(slide1, "Defensa del proyecto · julio 2026", { x: 0.72, y: 2.7, w: 3.3, h: 0.2, fontSize: 10.5, color: COLORS.muted });
  addMetricCard(slide1, { x: 0.68, y: 3.25, w: 3.4, h: 1.02, title: "Propuesta de valor", body: "Una única fuente de verdad para proyectos, páginas, versiones y traducciones reutilizables.", accent: COLORS.ink, fill: COLORS.blueSoft });
  addMetricCard(slide1, { x: 0.68, y: 4.42, w: 3.4, h: 1.02, title: "Resultado esperado", body: "Reducir handoff manual, mantener consistencia y preparar la exportación consumible por desarrollo.", accent: COLORS.green, fill: COLORS.greenSoft });
  addPanel(slide1, { x: 4.55, y: 1.9, w: 8.0, h: 3.95, fill: COLORS.panel });
  addText(slide1, "Secuencia de la defensa", { x: 4.88, y: 2.16, w: 2.6, h: 0.2, fontSize: 14, bold: true, color: COLORS.ink });
  const agenda = [
    ["Introducción", COLORS.ink, "Problema, objetivos y recorrido de uso."],
    ["Especificación funcional", COLORS.coral, "Capturas reales del flujo de trabajo y alcance funcional."],
    ["Especificación técnica", COLORS.green, "Modelo de dominio, API, seguridad y calidad."],
    ["Despliegue y entorno productivo", COLORS.gold, "Operación local, CI/CD y evolución prevista."],
  ];
  agenda.forEach(([label, accent, body], index) => {
    const y = 2.58 + index * 0.78;
    addShape(slide1, "ellipse", { x: 4.92, y, w: 0.26, h: 0.26, fill: { color: accent }, line: { color: accent, pt: 0 } });
    addText(slide1, label, { x: 5.32, y: y - 0.02, w: 3.2, h: 0.2, fontSize: 12.5, bold: true, color: COLORS.ink });
    addText(slide1, body, { x: 8.1, y: y - 0.01, w: 4.0, h: 0.22, fontSize: 10.5, color: COLORS.muted });
  });

  const slide2 = createSlide(pptx, {
    number: 2,
    section: "Introducción",
    title: "Problema que resuelve ResourceApp",
    subtitle: "Los textos de producto cambian con frecuencia, pero la coordinación entre equipos suele seguir siendo manual.",
    notes: [
      "Conectar el problema con una realidad operativa: backlog rápido, múltiples idiomas y decisiones repartidas.",
      "Explicar que el mayor coste no es traducir, sino alinear qué texto es válido y cuándo debe publicarse.",
      "Usar esta diapositiva para justificar por qué la jerarquía proyecto-página-versión-recurso es central en la solución.",
    ],
  });
  addMetricCard(slide2, { x: 0.68, y: 2.02, w: 3.88, h: 1.6, title: "Textos dispersos", body: "Claves y copies repartidos entre documentos, hojas de cálculo y conversaciones puntuales.", accent: COLORS.coral, fill: COLORS.redSoft });
  addMetricCard(slide2, { x: 4.72, y: 2.02, w: 3.88, h: 1.6, title: "Inconsistencias", body: "La misma intención funcional termina con traducciones distintas según la pantalla o el sprint.", accent: COLORS.ink, fill: COLORS.blueSoft });
  addMetricCard(slide2, { x: 8.76, y: 2.02, w: 3.88, h: 1.6, title: "Handoff manual", body: "Desarrollo recibe cambios sin contexto de versión, prioridad ni validación de alcance.", accent: COLORS.green, fill: COLORS.greenSoft });
  addPanel(slide2, { x: 0.68, y: 4.12, w: 11.96, h: 1.48, fill: COLORS.white });
  addText(slide2, "Impacto sobre el equipo", { x: 0.94, y: 4.34, w: 2.5, h: 0.2, fontSize: 13, bold: true, color: COLORS.ink });
  const impacts = [
    "Más tiempo en aclaraciones",
    "Menor trazabilidad del cambio",
    "Riesgo de errores al publicar",
    "Dificultad para reutilizar recursos",
  ];
  impacts.forEach((impact, index) => {
    const x = 1.0 + index * 2.9;
    addShape(slide2, "roundRect", { x, y: 4.78, w: 2.35, h: 0.5, rectRadius: 0.08, fill: { color: COLORS.panelStrong }, line: { color: COLORS.line, pt: 1 } });
    addText(slide2, impact, { x: x + 0.12, y: 4.95, w: 2.1, h: 0.16, fontSize: 10.2, color: COLORS.text, align: "center" });
    if (index < impacts.length - 1) addLine(slide2, x + 2.35, 5.03, x + 2.74, 5.03, { color: COLORS.line, width: 1.1 });
  });

  const slide3 = createSlide(pptx, {
    number: 3,
    section: "Introducción",
    title: "Objetivos y alcance de la primera versión",
    subtitle: "El proyecto prioriza resolver bien el flujo núcleo antes de ampliar automatizaciones periféricas.",
    notes: [
      "Presentar el alcance como una decisión de producto: primero consistencia y flujo end-to-end, después automatizaciones extra.",
      "Diferenciar claramente lo implementado del roadmap para no sobreprometer durante la defensa.",
      "Señalar que la estructura P0/P1 facilita explicar prioridades y próximos pasos con criterio técnico.",
    ],
  });
  addMetricCard(slide3, { x: 0.68, y: 2.0, w: 3.72, h: 3.5, title: "P0 · Implementado", body: "Centralización por proyecto\nJerarquía página > versión > recurso\nGestión de traducciones manuales\nTraducción automática asistida\nSesión con login social y control de acceso", accent: COLORS.green, fill: COLORS.greenSoft });
  addMetricCard(slide3, { x: 4.8, y: 2.0, w: 3.72, h: 3.5, title: "P1 · Siguiente iteración", body: "Exportación configurable por ámbito\nRevisión editorial y auditoría\nCatálogo administrable de idiomas\nMejoras de experiencia para equipos compartidos", accent: COLORS.ink, fill: COLORS.blueSoft });
  addMetricCard(slide3, { x: 8.92, y: 2.0, w: 3.72, h: 3.5, title: "Fuera de alcance actual", body: "OCR de capturas o documentos\nSincronización automática con repositorios\nFlujos complejos de aprobación\nPortal público de traducciones", accent: COLORS.coral, fill: COLORS.redSoft });

  const slide4 = createSlide(pptx, {
    number: 4,
    section: "Introducción",
    title: "Visión extremo a extremo",
    subtitle: "La propuesta une descubrimiento, edición, traducción y preparación para consumo técnico en una misma ruta.",
    notes: [
      "Usar esta secuencia como mapa mental del resto de la defensa: todo lo que se ve después encaja aquí.",
      "Reforzar que la aplicación no solo guarda textos: gestiona contexto, versiones y publicación coherente.",
      "Subrayar que exportación sigue en alcance funcional, pero el deck muestra ya cómo encaja en el flujo final.",
    ],
  });
  const flowSteps = [
    ["01", "Centralizar", "Un proyecto reúne páginas, versiones y recursos con dueño y miembros.", COLORS.ink],
    ["02", "Traducir", "El equipo mantiene idiomas activos y completa pendientes manual o automáticamente.", COLORS.coral],
    ["03", "Validar", "La versión predeterminada fija qué conjunto está listo para consumo.", COLORS.green],
    ["04", "Exportar", "El resultado se prepara en JSON o XML según el ámbito requerido.", COLORS.gold],
  ];
  flowSteps.forEach(([step, title, body, accent], index) => {
    const x = 0.72 + index * 3.12;
    addProcessStep(slide4, { x, y: 2.28, w: 2.58, h: 2.42, step, title, body, accent, fill: COLORS.white });
    if (index < flowSteps.length - 1) addLine(slide4, x + 2.58, 3.5, x + 2.96, 3.5, { color: accent, width: 1.4 });
  });
  addPanel(slide4, { x: 0.72, y: 5.15, w: 11.9, h: 0.62, fill: COLORS.panelStrong });
  addText(slide4, "Trazabilidad continua: proyecto → página → versión → recurso → traducciones → salida consumible", {
    x: 0.95,
    y: 5.37,
    w: 11.45,
    h: 0.18,
    fontSize: 11.5,
    bold: true,
    color: COLORS.ink,
    align: "center",
  });

  const slide5 = createSlide(pptx, {
    number: 5,
    section: "Introducción",
    title: "Actores y recorrido principal",
    subtitle: "La colaboración se apoya en roles simples y en una jerarquía que ordena el trabajo de localización.",
    notes: [
      "Definir rápido los dos perfiles operativos: quién administra y quién colabora sobre contenidos.",
      "Explicar que la jerarquía no es decorativa: determina permisos, rutas API y granularidad de exportación.",
      "Preparar la transición al bloque funcional mostrando que las capturas siguen exactamente este recorrido.",
    ],
  });
  addMetricCard(slide5, { x: 0.68, y: 1.96, w: 2.9, h: 1.3, title: "Propietario", body: "Crea proyectos, invita miembros y define la versión de referencia.", accent: COLORS.ink, fill: COLORS.blueSoft });
  addMetricCard(slide5, { x: 0.68, y: 3.48, w: 2.9, h: 1.3, title: "Miembro", body: "Gestiona páginas, recursos y traducciones dentro del alcance compartido.", accent: COLORS.green, fill: COLORS.greenSoft });
  addTag(slide5, "Recorrido jerárquico", { x: 4.08, y: 1.92, w: 2.1, color: COLORS.ink, fill: COLORS.panel });
  const chain = [
    ["Proyecto", 4.1, COLORS.ink],
    ["Página", 6.1, COLORS.coral],
    ["Versión", 8.1, COLORS.green],
    ["Recurso", 10.1, COLORS.gold],
  ];
  chain.forEach(([label, x, accent]) => {
    addPanel(slide5, { x, y: 2.55, w: 1.62, h: 0.9, fill: COLORS.white });
    addText(slide5, label, { x: x + 0.1, y: 2.87, w: 1.42, h: 0.18, fontSize: 12.3, bold: true, color: accent, align: "center" });
  });
  addLine(slide5, 5.72, 3.0, 6.08, 3.0, { color: COLORS.line, width: 1.2 });
  addLine(slide5, 7.72, 3.0, 8.08, 3.0, { color: COLORS.line, width: 1.2 });
  addLine(slide5, 9.72, 3.0, 10.08, 3.0, { color: COLORS.line, width: 1.2 });
  addText(slide5, "Cada nivel reduce el contexto y facilita editar, traducir y exportar con precisión.", { x: 4.12, y: 3.82, w: 7.7, h: 0.22, fontSize: 11.3, color: COLORS.muted, align: "center" });
  addPanel(slide5, { x: 4.08, y: 4.38, w: 8.58, h: 1.2, fill: COLORS.panel });
  addList(slide5, [
    "Proyecto: espacio colaborativo y permisos.",
    "Página: agrupación funcional de pantallas o módulos.",
    "Versión: instantánea editable con una marcada como predeterminada.",
    "Recurso: clave reutilizable con traducciones por idioma.",
  ], { x: 4.3, y: 4.64, w: 8.0, h: 0.2, fontSize: 10.5, bulletColor: COLORS.coral, gap: 0.23 });

  const slide6 = createSlide(pptx, {
    number: 6,
    section: "Especificación funcional",
    title: "Home pública y acceso inicial",
    subtitle: "La portada resume el valor del producto y dirige al usuario hacia autenticación y prueba guiada.",
    notes: [
      "La home introduce el producto sin ruido técnico y sirve como punto de entrada compartido.",
      "Destacar que el diseño de la aplicación puede ser expresivo, pero la presentación mantiene una estética académica separada.",
      "En la demo, esta pantalla es el comienzo del flujo real que se verá en el bloque funcional.",
    ],
    images: ["01-home.png"],
  });
  addImageFrame(slide6, "01-home.png", { x: 0.7, y: 1.92, w: 7.4, h: 4.62, caption: "Captura real · Home de bienvenida con propuesta de valor y llamada a la acción." });
  addMetricCard(slide6, { x: 8.55, y: 2.05, w: 3.85, h: 1.02, title: "Valor explicado", body: "Centraliza la gestión de textos de interfaz antes de llegar a desarrollo.", accent: COLORS.ink, fill: COLORS.blueSoft });
  addMetricCard(slide6, { x: 8.55, y: 3.27, w: 3.85, h: 1.02, title: "Acceso directo", body: "Desde aquí se inicia login y se enlaza la narrativa hacia los proyectos activos.", accent: COLORS.coral, fill: COLORS.redSoft });
  addMetricCard(slide6, { x: 8.55, y: 4.49, w: 3.85, h: 1.02, title: "Primera impresión", body: "La interfaz comunica producto moderno, pero la lógica clave vive en el recorrido autenticado.", accent: COLORS.green, fill: COLORS.greenSoft });

  const slide7 = createSlide(pptx, {
    number: 7,
    section: "Especificación funcional",
    title: "Autenticación, sesión y rutas protegidas",
    subtitle: "El acceso combina login social con emisión de JWT y refresh token para mantener sesiones seguras.",
    notes: [
      "Explicar el login social como simplificación de entrada y como decisión de seguridad delegada en Google.",
      "Resaltar que el frontend no gestiona credenciales propias: recibe tokens emitidos por la API.",
      "La renovación de sesión evita reautenticación constante y soporta un uso continuo de la herramienta.",
    ],
    images: ["02-login.png"],
  });
  addImageFrame(slide7, "02-login.png", { x: 0.7, y: 1.95, w: 5.8, h: 4.25, caption: "Captura real · Pantalla de login con acceso social y copy orientado al producto." });
  addProcessStep(slide7, { x: 6.95, y: 2.04, w: 1.35, h: 1.45, step: "A", title: "Google", body: "Valida identidad primaria.", accent: COLORS.coral });
  addProcessStep(slide7, { x: 8.55, y: 2.04, w: 1.52, h: 1.45, step: "B", title: "API", body: "Comprueba el token social.", accent: COLORS.ink });
  addProcessStep(slide7, { x: 10.33, y: 2.04, w: 1.75, h: 1.45, step: "C", title: "JWT + Refresh", body: "Emite sesión con expiración controlada.", accent: COLORS.green });
  addLine(slide7, 8.3, 2.77, 8.52, 2.77, { color: COLORS.line, width: 1.2 });
  addLine(slide7, 10.08, 2.77, 10.3, 2.77, { color: COLORS.line, width: 1.2 });
  addPanel(slide7, { x: 6.95, y: 3.92, w: 5.45, h: 1.65, fill: COLORS.panel });
  addList(slide7, [
    "Rutas privadas solo accesibles con sesión válida.",
    "Refresh token persistido para renovar acceso sin cortar el flujo.",
    "Logout explícito que revoca la continuidad de la sesión.",
  ], { x: 7.18, y: 4.18, w: 4.95, h: 0.18, fontSize: 10.8, bulletColor: COLORS.coral, gap: 0.33 });

  const slide8 = createSlide(pptx, {
    number: 8,
    section: "Especificación funcional",
    title: "Proyectos y miembros",
    subtitle: "El usuario crea espacios de trabajo compartidos y asigna colaboración con permisos sencillos.",
    notes: [
      "Mostrar que el proyecto es la unidad de colaboración y también el punto de aislamiento funcional.",
      "La gestión de miembros refuerza que la aplicación está pensada para trabajo en equipo, no solo para uso individual.",
      "El modelo Owner/Member reduce complejidad, pero ya soporta control de acceso suficiente para el MVP.",
    ],
    images: ["03-projects.png", "04-project-members.png"],
  });
  addImageFrame(slide8, "03-projects.png", { x: 0.7, y: 1.92, w: 6.0, h: 3.8, caption: "Captura real · Vista de proyectos con acceso al espacio de trabajo principal." });
  addImageFrame(slide8, "04-project-members.png", { x: 6.95, y: 1.92, w: 5.7, h: 3.8, caption: "Captura real · Modal de miembros para compartir el proyecto con colaboradores." });
  addMetricCard(slide8, { x: 0.92, y: 5.95, w: 3.7, h: 0.76, title: "Alta", body: "Crear proyecto y fijar un contexto común de trabajo.", accent: COLORS.ink, fill: COLORS.blueSoft });
  addMetricCard(slide8, { x: 4.82, y: 5.95, w: 3.7, h: 0.76, title: "Colaboración", body: "Añadir miembros para repartir edición y revisión.", accent: COLORS.coral, fill: COLORS.redSoft });
  addMetricCard(slide8, { x: 8.72, y: 5.95, w: 3.7, h: 0.76, title: "Permisos", body: "Owner gestiona el espacio y Member opera dentro del alcance asignado.", accent: COLORS.green, fill: COLORS.greenSoft });

  const slide9 = createSlide(pptx, {
    number: 9,
    section: "Especificación funcional",
    title: "Páginas y versiones",
    subtitle: "La jerarquía permite agrupar recursos por pantalla y separar trabajo en borrador de la versión de referencia.",
    notes: [
      "Enfatizar que la versión predeterminada es una decisión operativa muy relevante para publicación y exportación futura.",
      "La página ordena el contexto funcional y evita mezclar recursos de áreas distintas del producto.",
      "Esta estructura sostiene tanto la navegación del frontend como las rutas jerárquicas del backend.",
    ],
    images: ["05-pages.png", "06-page-versions.png"],
  });
  addImageFrame(slide9, "05-pages.png", { x: 0.7, y: 1.92, w: 6.0, h: 3.8, caption: "Captura real · Lista de páginas asociadas al proyecto seleccionado." });
  addImageFrame(slide9, "06-page-versions.png", { x: 6.95, y: 1.92, w: 5.7, h: 3.8, caption: "Captura real · Gestión de versiones con indicación de la predeterminada." });
  addPanel(slide9, { x: 0.9, y: 5.95, w: 11.55, h: 0.74, fill: COLORS.panelStrong });
  addText(slide9, "Regla clave: una versión puede editarse y otra marcarse como predeterminada para estabilizar el conjunto de recursos activo.", {
    x: 1.18,
    y: 6.18,
    w: 11.0,
    h: 0.2,
    fontSize: 10.8,
    color: COLORS.ink,
    align: "center",
  });

  const slide10 = createSlide(pptx, {
    number: 10,
    section: "Especificación funcional",
    title: "Recursos e idiomas activos",
    subtitle: "Cada recurso mantiene una clave única y un conjunto de traducciones ligado a los idiomas disponibles del proyecto.",
    notes: [
      "Presentar el recurso como unidad reutilizable: clave técnica, descripción y valores por idioma.",
      "Resaltar que el proyecto controla qué idiomas están activos y eso determina pendientes y validaciones.",
      "La combinación entre clave estable y versiones por idioma prepara muy bien la futura exportación técnica.",
    ],
    images: ["07-resources.png", "08-translations.png"],
  });
  addImageFrame(slide10, "07-resources.png", { x: 0.7, y: 1.92, w: 6.0, h: 3.82, caption: "Captura real · Recursos de la versión con clave y descripción orientadas a desarrollo." });
  addImageFrame(slide10, "08-translations.png", { x: 6.95, y: 1.92, w: 5.7, h: 3.82, caption: "Captura real · Traducciones existentes para pt-br, es-es y en-uk." });
  addTag(slide10, "Idiomas soportados", { x: 1.02, y: 5.98, w: 1.7, color: COLORS.ink, fill: COLORS.panel });
  addTag(slide10, "pt-br", { x: 3.12, y: 5.98, w: 1.0, color: COLORS.green, fill: COLORS.greenSoft });
  addTag(slide10, "es-es", { x: 4.35, y: 5.98, w: 1.0, color: COLORS.coral, fill: COLORS.redSoft });
  addTag(slide10, "en-uk", { x: 5.58, y: 5.98, w: 1.0, color: COLORS.ink, fill: COLORS.blueSoft });
  addText(slide10, "Ejemplo de clave: checkout.pay_button", { x: 7.15, y: 6.0, w: 2.6, h: 0.18, fontSize: 10.2, bold: true, color: COLORS.ink });
  addText(slide10, "Descripción: botón principal del flujo de pago.", { x: 9.84, y: 6.0, w: 2.4, h: 0.18, fontSize: 10.2, color: COLORS.muted, align: "right" });

  const slide11 = createSlide(pptx, {
    number: 11,
    section: "Especificación funcional",
    title: "Traducción automática con guardado atómico",
    subtitle: "La herramienta calcula idiomas pendientes, consulta Structured Outputs y persiste el resultado como una sola operación.",
    notes: [
      "Explicar que la automatización está acotada: parte de un idioma fuente existente y solo genera los pendientes.",
      "La secuencia incluye una llamada backend a OpenAI; el navegador nunca conversa directamente con ese servicio.",
      "El guardado atómico evita estados parciales si cambia el contexto del recurso mientras se genera la traducción.",
    ],
    images: ["09-automatic-translations.png"],
  });
  addImageFrame(slide11, "09-automatic-translations.png", { x: 0.7, y: 1.94, w: 6.35, h: 4.18, caption: "Captura real · Modal de traducciones automáticas con idioma origen y destinos pendientes." });
  const autoFlow = [
    ["01", "Seleccionar origen", "El usuario elige una traducción existente como base semántica.", COLORS.ink],
    ["02", "Calcular pendientes", "Se respetan los idiomas activos y se preserva el orden canónico pt-br, es-es, en-uk.", COLORS.coral],
    ["03", "Structured Outputs", "La API solicita a OpenAI un resultado estructurado y validable.", COLORS.green],
    ["04", "Persistir", "Las nuevas traducciones se guardan o se cancelan en bloque.", COLORS.gold],
  ];
  autoFlow.forEach(([step, title, body, accent], index) => {
    addProcessStep(slide11, { x: 7.45, y: 2.0 + index * 1.06, w: 5.0, h: 0.86, step, title, body, accent, fill: COLORS.white });
  });

  const slide12 = createSlide(pptx, {
    number: 12,
    section: "Especificación funcional",
    title: "Exportación JSON/XML",
    subtitle: "La salida final está diseñada, pero se presenta como alcance funcional porque no forma parte de las capturas implementadas.",
    notes: [
      "Aclarar explícitamente que aquí se muestra alcance funcional y no una captura de una UI ya construida.",
      "La exportación responde a la necesidad de consumo técnico y conecta el trabajo editorial con desarrollo.",
      "El ámbito de salida puede adaptarse a proyecto completo o a subconjuntos concretos de la jerarquía.",
    ],
  });
  addTag(slide12, "Alcance funcional", { x: 10.55, y: 0.92, w: 1.9, color: COLORS.coral, fill: COLORS.redSoft });
  addCodePanel(slide12, {
    x: 0.72,
    y: 2.0,
    w: 5.9,
    h: 3.45,
    title: "Salida JSON",
    code: `{
  "checkout.pay_button": {
    "es-es": "Pagar ahora",
    "en-uk": "Pay now",
    "pt-br": "Pagar agora"
  }
}`,
    accent: COLORS.ink,
  });
  addCodePanel(slide12, {
    x: 6.92,
    y: 2.0,
    w: 5.7,
    h: 3.45,
    title: "Salida XML",
    code: `<resource key="checkout.pay_button">
  <value language="es-es">Pagar ahora</value>
  <value language="en-uk">Pay now</value>
  <value language="pt-br">Pagar agora</value>
</resource>`,
    accent: COLORS.green,
  });
  addMetricCard(slide12, { x: 0.82, y: 5.8, w: 3.72, h: 0.72, title: "Ámbito proyecto", body: "Entrega completa para integraciones amplias.", accent: COLORS.ink, fill: COLORS.blueSoft });
  addMetricCard(slide12, { x: 4.82, y: 5.8, w: 3.72, h: 0.72, title: "Ámbito página", body: "Salida acotada a un módulo funcional concreto.", accent: COLORS.coral, fill: COLORS.redSoft });
  addMetricCard(slide12, { x: 8.82, y: 5.8, w: 3.72, h: 0.72, title: "Ámbito versión", body: "Base estable para publicar una iteración específica.", accent: COLORS.green, fill: COLORS.greenSoft });

  const slide13 = createSlide(pptx, {
    number: 13,
    section: "Especificación técnica",
    title: "Modelo de dominio",
    subtitle: "Siete entidades sostienen la jerarquía de trabajo y la seguridad de acceso dentro del producto.",
    notes: [
      "Explicar el modelo de dominio como la pieza que conecta reglas funcionales, API y persistencia.",
      "Las cardinalidades muestran por qué la aplicación prioriza contexto y trazabilidad frente a listas planas de textos.",
      "Destacar que ResourceVersion desacopla la clave del recurso de cada valor localizado por idioma.",
    ],
  });
  addEntity(slide13, { x: 0.72, y: 2.05, w: 1.65, h: 1.12, title: "User", body: "Identidad social\nSesiones", fill: COLORS.blueSoft, accent: COLORS.ink });
  addEntity(slide13, { x: 2.75, y: 2.05, w: 1.85, h: 1.12, title: "Project", body: "Nombre\nIdiomas activos", fill: COLORS.white, accent: COLORS.ink });
  addEntity(slide13, { x: 2.75, y: 3.63, w: 1.85, h: 1.12, title: "ProjectMember", body: "Rol\nRelación usuario-proyecto", fill: COLORS.white, accent: COLORS.coral });
  addEntity(slide13, { x: 5.05, y: 2.05, w: 1.85, h: 1.12, title: "Page", body: "Título\nÁmbito funcional", fill: COLORS.white, accent: COLORS.coral });
  addEntity(slide13, { x: 7.35, y: 2.05, w: 1.85, h: 1.12, title: "PageVersion", body: "Nombre\nPredeterminada", fill: COLORS.greenSoft, accent: COLORS.green });
  addEntity(slide13, { x: 5.05, y: 3.63, w: 1.85, h: 1.12, title: "Resource", body: "Clave\nDescripción", fill: COLORS.white, accent: COLORS.gold });
  addEntity(slide13, { x: 7.35, y: 3.63, w: 1.85, h: 1.12, title: "ResourceVersion", body: "Idioma\nValor traducido", fill: COLORS.white, accent: COLORS.green });
  addLine(slide13, 2.37, 2.61, 2.74, 2.61, { color: COLORS.line, width: 1.2 });
  addConnectorLabel(slide13, "1..n", { x: 2.44, y: 2.36 });
  addLine(slide13, 3.67, 3.18, 3.67, 3.62, { color: COLORS.line, width: 1.2, endArrowType: "none" });
  addConnectorLabel(slide13, "1..n", { x: 3.45, y: 3.32, w: 0.5 });
  addLine(slide13, 4.61, 2.61, 5.04, 2.61, { color: COLORS.line, width: 1.2 });
  addConnectorLabel(slide13, "1..n", { x: 4.69, y: 2.36 });
  addLine(slide13, 6.91, 2.61, 7.34, 2.61, { color: COLORS.line, width: 1.2 });
  addConnectorLabel(slide13, "1..n", { x: 7.0, y: 2.36 });
  addLine(slide13, 5.98, 3.18, 5.98, 3.62, { color: COLORS.line, width: 1.2, endArrowType: "none" });
  addConnectorLabel(slide13, "1..n", { x: 5.76, y: 3.32, w: 0.5 });
  addLine(slide13, 6.91, 4.19, 7.34, 4.19, { color: COLORS.line, width: 1.2 });
  addConnectorLabel(slide13, "1..n", { x: 7.0, y: 3.94 });
  addPanel(slide13, { x: 9.75, y: 2.02, w: 2.75, h: 2.96, fill: COLORS.panel });
  addText(slide13, "Lectura del modelo", { x: 10.0, y: 2.24, w: 2.2, h: 0.18, fontSize: 13, bold: true, color: COLORS.ink });
  addList(slide13, [
    "User se relaciona con Project mediante ProjectMember.",
    "Cada Project agrupa múltiples Page y define idiomas activos.",
    "PageVersion estabiliza el estado funcional antes de tocar Resource.",
    "ResourceVersion materializa cada traducción final por idioma.",
  ], { x: 10.0, y: 2.62, w: 2.2, h: 0.18, fontSize: 9.8, bulletColor: COLORS.coral, gap: 0.48 });

  const slide14 = createSlide(pptx, {
    number: 14,
    section: "Especificación técnica",
    title: "Arquitectura técnica",
    subtitle: "El frontend React/Vite consume una API ASP.NET Core que coordina persistencia EF Core y servicios externos.",
    notes: [
      "La arquitectura separa claramente presentación, reglas de negocio y acceso a datos para facilitar evolución.",
      "La integración OpenAI se aloja solo en backend para preservar secretos y controlar validaciones.",
      "Esta vista ayuda a enlazar la solución tecnológica con el comportamiento funcional visto en las capturas.",
    ],
  });
  addProcessStep(slide14, { x: 0.72, y: 2.3, w: 2.35, h: 2.05, step: "Cliente", title: "React + TypeScript + Vite", body: "Navegación, estado de sesión y formularios de gestión.", accent: COLORS.ink, fill: COLORS.blueSoft });
  addProcessStep(slide14, { x: 3.52, y: 2.3, w: 2.55, h: 2.05, step: "API", title: "ASP.NET Core 8", body: "Autenticación, validaciones jerárquicas y orquestación funcional.", accent: COLORS.coral, fill: COLORS.redSoft });
  addProcessStep(slide14, { x: 6.53, y: 2.3, w: 2.3, h: 2.05, step: "Datos", title: "EF Core + MySQL", body: "Persistencia relacional y transacciones para cambios atómicos.", accent: COLORS.green, fill: COLORS.greenSoft });
  addProcessStep(slide14, { x: 9.32, y: 2.3, w: 2.65, h: 2.05, step: "IA", title: "OpenAI vía backend", body: "Generación estructurada de traducciones automáticas.", accent: COLORS.gold, fill: COLORS.sandSoft });
  addLine(slide14, 3.08, 3.28, 3.49, 3.28, { color: COLORS.line, width: 1.3 });
  addLine(slide14, 6.08, 3.28, 6.5, 3.28, { color: COLORS.line, width: 1.3 });
  addLine(slide14, 8.84, 3.28, 9.29, 3.28, { color: COLORS.line, width: 1.3 });
  addPanel(slide14, { x: 0.94, y: 5.0, w: 11.45, h: 0.72, fill: COLORS.panelStrong });
  addText(slide14, "Flujo principal: UI → API REST → servicios de dominio → EF Core/MySQL, con OpenAI integrado solo cuando el caso de uso lo requiere.", {
    x: 1.18,
    y: 5.24,
    w: 11.0,
    h: 0.16,
    fontSize: 10.8,
    color: COLORS.ink,
    align: "center",
  });

  const slide15 = createSlide(pptx, {
    number: 15,
    section: "Especificación técnica",
    title: "API jerárquica y consistencia",
    subtitle: "Las rutas reflejan el dominio y concentran validaciones de pertenencia, duplicados, borrado lógico y transacciones.",
    notes: [
      "Mostrar que la forma de la API replica la jerarquía funcional y evita accesos ambiguos entre contextos.",
      "Las reglas de consistencia viven en backend, no en el navegador, para proteger el dato incluso ante clientes alternativos.",
      "La referencia al borrado lógico y a las transacciones demuestra madurez en el tratamiento del ciclo de vida del recurso.",
    ],
  });
  addCodePanel(slide15, {
    x: 0.72,
    y: 2.0,
    w: 6.1,
    h: 3.6,
    title: "Ruta representativa",
    code: `POST /api/v1/projects/{projectId}/pages/{pageId}/versions/{pageVersionId}/resources/{resourceId}/automatic-translations

GET  /api/v1/projects/{projectId}/pages/{pageId}
POST /api/v1/projects/{projectId}/pages/{pageId}/versions
PATCH /api/v1/projects/{projectId}/pages/{pageId}/versions/{pageVersionId}`,
    accent: COLORS.ink,
  });
  addMetricCard(slide15, { x: 7.15, y: 2.0, w: 5.2, h: 0.78, title: "Pertenencia", body: "Cada operación verifica que proyecto, página y versión pertenecen al mismo contexto solicitado.", accent: COLORS.ink, fill: COLORS.blueSoft });
  addMetricCard(slide15, { x: 7.15, y: 2.95, w: 5.2, h: 0.78, title: "Duplicados", body: "Se bloquean claves repetidas y conflictos de recursos para mantener consistencia funcional.", accent: COLORS.coral, fill: COLORS.redSoft });
  addMetricCard(slide15, { x: 7.15, y: 3.9, w: 5.2, h: 0.78, title: "Soft delete", body: "El borrado lógico preserva trazabilidad y evita perder historial útil de edición.", accent: COLORS.green, fill: COLORS.greenSoft });
  addMetricCard(slide15, { x: 7.15, y: 4.85, w: 5.2, h: 0.78, title: "Transacciones", body: "Los cambios críticos, como traducciones automáticas, se completan o revierten de forma atómica.", accent: COLORS.gold, fill: COLORS.sandSoft });

  const slide16 = createSlide(pptx, {
    number: 16,
    section: "Especificación técnica",
    title: "Seguridad y frontera de confianza",
    subtitle: "La solución combina autenticación delegada, tokens propios y aislamiento de secretos en el backend y en Azure.",
    notes: [
      "Explicar la diferencia entre identidad delegada a Google y autorización propia resuelta por la API.",
      "Señalar que el frontend opera con tokens de acceso, pero los secretos y decisiones sensibles permanecen fuera del navegador.",
      "La diapositiva prepara bien el paso al despliegue porque enlaza seguridad lógica y seguridad operativa.",
    ],
  });
  addProcessStep(slide16, { x: 0.72, y: 2.18, w: 2.1, h: 1.42, step: "1", title: "Google OAuth", body: "Valida la identidad inicial del usuario.", accent: COLORS.coral, fill: COLORS.redSoft });
  addProcessStep(slide16, { x: 3.15, y: 2.18, w: 2.2, h: 1.42, step: "2", title: "Frontend", body: "Guarda tokens y llama a rutas protegidas.", accent: COLORS.ink, fill: COLORS.blueSoft });
  addProcessStep(slide16, { x: 5.72, y: 2.18, w: 2.38, h: 1.42, step: "3", title: "API", body: "Emite JWT y refresh; aplica roles Owner y Member.", accent: COLORS.green, fill: COLORS.greenSoft });
  addProcessStep(slide16, { x: 8.45, y: 2.18, w: 1.9, h: 1.42, step: "4", title: "MySQL", body: "Persistencia y refresh tokens.", accent: COLORS.gold, fill: COLORS.sandSoft });
  addProcessStep(slide16, { x: 10.65, y: 2.18, w: 1.9, h: 1.42, step: "5", title: "OpenAI", body: "Solo accesible desde backend.", accent: COLORS.coral, fill: COLORS.white });
  addLine(slide16, 2.84, 2.92, 3.12, 2.92, { color: COLORS.line, width: 1.2 });
  addLine(slide16, 5.37, 2.92, 5.69, 2.92, { color: COLORS.line, width: 1.2 });
  addLine(slide16, 8.13, 2.92, 8.42, 2.92, { color: COLORS.line, width: 1.2 });
  addLine(slide16, 10.37, 2.92, 10.62, 2.92, { color: COLORS.line, width: 1.2 });
  addPanel(slide16, { x: 1.0, y: 4.2, w: 11.35, h: 1.48, fill: COLORS.panel });
  addText(slide16, "Controles relevantes", { x: 1.25, y: 4.42, w: 2.0, h: 0.18, fontSize: 13, bold: true, color: COLORS.ink });
  addList(slide16, [
    "Access token corto y refresh token revocable.",
    "Validación de permisos por proyecto antes de cada acción sensible.",
    "Secretos de JWT, Google y base de datos fuera del navegador y gestionados en entorno.",
    "OpenAI queda fuera de la frontera de confianza del cliente web.",
  ], { x: 1.25, y: 4.74, w: 10.6, h: 0.18, fontSize: 10.4, bulletColor: COLORS.coral, gap: 0.26 });

  const slide17 = createSlide(pptx, {
    number: 17,
    section: "Especificación técnica",
    title: "Calidad, pruebas y disciplina de entrega",
    subtitle: "La solución se apoya en pruebas de API y frontend, verificación estática y una cadencia Red-Green-Refactor.",
    notes: [
      "Esta diapositiva demuestra que el proyecto no solo implementa funcionalidades, también controla regresiones.",
      "Diferenciar la cobertura de integración backend/frontend de la validación estática por lint y build.",
      "La referencia a Red-Green-Refactor conecta con la forma de trabajo usada durante el desarrollo del TFM.",
    ],
  });
  addMetricCard(slide17, { x: 0.72, y: 2.0, w: 2.8, h: 1.18, title: "API tests", body: "Pruebas de integración sobre controladores y servicios críticos.", accent: COLORS.ink, fill: COLORS.blueSoft });
  addMetricCard(slide17, { x: 3.72, y: 2.0, w: 2.8, h: 1.18, title: "Frontend tests", body: "Recorridos funcionales sobre React y modales de traducción.", accent: COLORS.coral, fill: COLORS.redSoft });
  addMetricCard(slide17, { x: 6.72, y: 2.0, w: 2.8, h: 1.18, title: "Lint + build", body: "Comprobación continua de calidad estática y compilación reproducible.", accent: COLORS.green, fill: COLORS.greenSoft });
  addMetricCard(slide17, { x: 9.72, y: 2.0, w: 2.8, h: 1.18, title: "Validación deck", body: "El propio entregable PowerPoint también se genera y valida por script.", accent: COLORS.gold, fill: COLORS.sandSoft });
  addProcessStep(slide17, { x: 1.45, y: 4.0, w: 2.45, h: 1.42, step: "RED", title: "Fallo esperado", body: "Primero se fija el comportamiento objetivo y se observa el fallo.", accent: COLORS.coral, fill: COLORS.redSoft });
  addProcessStep(slide17, { x: 5.05, y: 4.0, w: 2.45, h: 1.42, step: "GREEN", title: "Implementación mínima", body: "Se escribe solo lo necesario para pasar la comprobación.", accent: COLORS.green, fill: COLORS.greenSoft });
  addProcessStep(slide17, { x: 8.65, y: 4.0, w: 2.45, h: 1.42, step: "REFACTOR", title: "Limpieza", body: "Se mejora estructura sin abrir una nueva superficie de riesgo.", accent: COLORS.ink, fill: COLORS.blueSoft });
  addLine(slide17, 3.93, 4.72, 5.0, 4.72, { color: COLORS.line, width: 1.3 });
  addLine(slide17, 7.53, 4.72, 8.6, 4.72, { color: COLORS.line, width: 1.3 });

  const slide18 = createSlide(pptx, {
    number: 18,
    section: "Despliegue y entorno productivo",
    title: "Entorno local con Docker Compose",
    subtitle: "El repositorio levanta aplicación web, API y MySQL en contenedores coordinados para desarrollo y demo reproducible.",
    notes: [
      "Explicar que el entorno local replica la colaboración entre servicios sin exigir instalaciones manuales complejas.",
      "Los puertos 5173, 5174 y 3306 hacen visible la separación entre frontend, API y base de datos.",
      "Esta base local reduce fricción tanto para desarrollo como para demostraciones funcionales controladas.",
    ],
  });
  addProcessStep(slide18, { x: 0.82, y: 2.18, w: 3.0, h: 1.55, step: "app", title: "resources-app", body: "Contenedor Nginx\nPuerto local 5173\nConsume API por VITE_API_BASE_URL", accent: COLORS.ink, fill: COLORS.blueSoft });
  addProcessStep(slide18, { x: 5.15, y: 2.18, w: 3.0, h: 1.55, step: "api", title: "resources-api", body: "ASP.NET Core\nPuerto local 5174 -> 8080\nConecta a MySQL", accent: COLORS.coral, fill: COLORS.redSoft });
  addProcessStep(slide18, { x: 9.48, y: 2.18, w: 3.0, h: 1.55, step: "db", title: "mysql", body: "MySQL 8.4\nPuerto 3306\nVolumen mysql_data", accent: COLORS.green, fill: COLORS.greenSoft });
  addLine(slide18, 3.85, 2.95, 5.12, 2.95, { color: COLORS.line, width: 1.3 });
  addLine(slide18, 8.18, 2.95, 9.45, 2.95, { color: COLORS.line, width: 1.3 });
  addPanel(slide18, { x: 1.02, y: 4.45, w: 11.35, h: 1.2, fill: COLORS.panel });
  addList(slide18, [
    "Frontend: http://localhost:5173",
    "API: http://localhost:5174",
    "Base de datos: localhost:3306",
    "Dependencias y healthcheck orquestados por docker-compose.",
  ], { x: 1.26, y: 4.75, w: 10.8, h: 0.18, fontSize: 10.6, bulletColor: COLORS.coral, gap: 0.24 });

  const slide19 = createSlide(pptx, {
    number: 19,
    section: "Despliegue y entorno productivo",
    title: "CI/CD y entorno productivo en Azure",
    subtitle: "GitHub Actions publica imágenes en ACR y actualiza Container Apps con secretos y variables diferenciando build-time y runtime.",
    notes: [
      "Separar dos ideas: el pipeline construye imágenes y Azure ejecuta contenedores ya parametrizados.",
      "OIDC evita credenciales largas en GitHub y encaja con una práctica actual de seguridad en despliegues cloud.",
      "Subrayar que el frontend recibe ciertas variables en build-time, mientras la API recibe secretos de runtime en Container Apps.",
    ],
  });
  const prodSteps = [
    ["GitHub Actions", 0.72, 1.95, "Build + push", COLORS.ink],
    ["OIDC", 2.95, 1.25, "Login federado", COLORS.coral],
    ["ACR", 4.58, 1.25, "Registro de imágenes", COLORS.green],
    ["Container Apps", 6.25, 2.55, "Frontend y API", COLORS.gold],
    ["MySQL Flexible Server", 9.12, 3.18, "Persistencia gestionada", COLORS.ink],
  ];
  prodSteps.forEach(([label, x, w, body, accent], index) => {
    addProcessStep(slide19, { x, y: 2.18, w, h: 1.22, step: String(index + 1), title: label, body, accent, fill: COLORS.white });
  });
  addLine(slide19, 2.7, 2.8, 2.92, 2.8, { color: COLORS.line, width: 1.2 });
  addLine(slide19, 4.33, 2.8, 4.55, 2.8, { color: COLORS.line, width: 1.2 });
  addLine(slide19, 6.0, 2.8, 6.22, 2.8, { color: COLORS.line, width: 1.2 });
  addLine(slide19, 8.85, 2.8, 9.09, 2.8, { color: COLORS.line, width: 1.2 });
  addMetricCard(slide19, { x: 0.92, y: 4.22, w: 5.6, h: 1.1, title: "Build-time", body: "El frontend recibe VITE_API_BASE_URL y VITE_GOOGLE_CLIENT_ID durante docker build; no se inyectan después en Nginx.", accent: COLORS.ink, fill: COLORS.blueSoft });
  addMetricCard(slide19, { x: 6.82, y: 4.22, w: 5.4, h: 1.1, title: "Runtime", body: "La API obtiene ConnectionStrings, JWT y Google Client Secret como secretos y env vars en Azure Container Apps.", accent: COLORS.green, fill: COLORS.greenSoft });

  const slide20 = createSlide(pptx, {
    number: 20,
    section: "Despliegue y entorno productivo",
    title: "Conclusiones y evolución prevista",
    subtitle: "El TFM entrega un flujo usable hoy y deja preparadas varias líneas de crecimiento funcional con encaje técnico claro.",
    notes: [
      "Cerrar la defensa resaltando primero el valor ya entregado y después la evolución prevista, no al revés.",
      "Mencionar OCR y exportación completa como siguientes pasos naturales, ya visibles en el diseño funcional.",
      "La evolución futura se apoya en la misma arquitectura, por lo que no exige rehacer el núcleo actual.",
    ],
  });
  addMetricCard(slide20, { x: 0.72, y: 2.0, w: 3.72, h: 2.58, title: "Lo que ya aporta", body: "Fuente única de verdad\nTrabajo colaborativo por proyecto\nTraducción automática integrada\nBase sólida para publicar recursos", accent: COLORS.green, fill: COLORS.greenSoft });
  addMetricCard(slide20, { x: 4.82, y: 2.0, w: 3.72, h: 2.58, title: "Siguientes incrementos", body: "Exportación completa JSON/XML\nOCR para extraer textos\nCatálogo administrable de idiomas\nRevisión editorial y trazabilidad", accent: COLORS.coral, fill: COLORS.redSoft });
  addMetricCard(slide20, { x: 8.92, y: 2.0, w: 3.72, h: 2.58, title: "Visión de madurez", body: "Más automatización sin perder control\nOperación reproducible\nEscalado natural hacia producto interno", accent: COLORS.ink, fill: COLORS.blueSoft });
  addTag(slide20, "OCR · Alcance funcional", { x: 0.96, y: 5.12, w: 1.85, color: COLORS.coral, fill: COLORS.redSoft });
  addTag(slide20, "Exportación completa · Alcance funcional", { x: 3.2, y: 5.12, w: 2.7, color: COLORS.gold, fill: COLORS.sandSoft });
  addTag(slide20, "Auditoría", { x: 6.3, y: 5.12, w: 1.2, color: COLORS.ink, fill: COLORS.panel });
  addTag(slide20, "Revisión editorial", { x: 7.82, y: 5.12, w: 1.9, color: COLORS.green, fill: COLORS.greenSoft });
  addTag(slide20, "Catálogo administrable", { x: 10.06, y: 5.12, w: 2.05, color: COLORS.ink, fill: COLORS.blueSoft });
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const pptx = new PptxGenJS();

  try {
    pptx.layout = PPTX_LAYOUT;
  } catch {
    // keep default if layout constant is not supported by the installed version
  }

  try {
    pptx.author = "Marcos Palacios";
    pptx.company = "TFM Business School";
    pptx.subject = "Presentación del proyecto ResourceApp TFM";
    pptx.title = "ResourceApp - Presentación del proyecto";
    if (pptx.lang !== undefined) pptx.lang = "es-ES";
  } catch {
    // ignore best-effort metadata issues
  }

  buildSlides(pptx);

  await pptx.writeFile({ fileName: OUTPUT_FILE });
  console.log("Wrote", OUTPUT_FILE);
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("generate-project-presentation.mjs")) {
  try {
    await main();
  } catch (error) {
    console.error("Generation failed:", error?.message || error);
    process.exitCode = 2;
  }
}

export default {
  addBaseSlide,
  addTitle,
  addBulletList,
  addMetric,
  addScreenshot,
  addFlow,
  addCodeBlock,
  addFooter,
  slideManifest,
};
