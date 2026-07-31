# Diseño de la presentación del proyecto ResourceApp

## Propósito

Crear una presentación PowerPoint editable para la defensa académica del proyecto ResourceApp. La presentación debe explicar el problema, el alcance funcional, las decisiones técnicas y el despliegue productivo mediante una narrativa comprensible para un tribunal con perfiles mixtos.

## Audiencia y formato

- Audiencia principal: tribunal académico.
- Duración objetivo: 15 minutos.
- Extensión: 20 diapositivas.
- Idioma: español.
- Autoría: Marcos Palacios - TFM Business School.
- Entregable: archivo `.pptx` editable.
- Apoyo a la exposición: notas breves del orador.

## Enfoque narrativo

La presentación seguirá una secuencia de problema, solución, evidencia funcional, fundamento técnico y operación productiva. Las primeras diapositivas establecerán el contexto y el alcance; el bloque central mostrará recorridos reales de uso; el bloque final justificará la arquitectura, la calidad, la seguridad y el despliegue.

## Estructura de diapositivas

1. **Portada**: ResourceApp, subtítulo del proyecto, autoría y programa.
2. **Contexto y problema**: dispersión de textos de interfaz, inconsistencias de traducción y dificultad de entrega a desarrollo.
3. **Objetivos y alcance**: centralización, jerarquía, traducción y exportación; exclusiones de la primera versión.
4. **Visión general de la solución**: del proyecto a los archivos consumibles por desarrollo.
5. **Actores y flujo principal**: propietario, miembro y recorrido de trabajo.
6. **Home pública**: propuesta de valor y acceso al producto, con captura real.
7. **Autenticación y sesión**: login social, protección de rutas, refresh y logout, con captura real.
8. **Proyectos y miembros**: creación, acceso compartido y roles, con captura real.
9. **Páginas y versiones**: organización jerárquica y versión predeterminada, con captura real.
10. **Recursos e idiomas**: clave, descripción y traducciones `pt-br`, `es-es` y `en-uk`, con captura real.
11. **Traducción automática**: selección del idioma origen, generación de pendientes con OpenAI y guardado atómico, con ejemplo visual.
12. **Exportación**: salida JSON/XML en distintos niveles, con fragmento de ejemplo.
13. **Modelo de dominio**: User, Project, ProjectMember, Page, PageVersion, Resource y ResourceVersion.
14. **Arquitectura técnica**: React/TypeScript/Vite, ASP.NET Core 8, EF Core y MySQL.
15. **API y consistencia**: rutas REST jerárquicas, validaciones, duplicados, borrado lógico y transacciones.
16. **Seguridad**: OAuth de Google, JWT, permisos, secretos y ausencia de conexión directa del navegador con OpenAI.
17. **Pruebas y calidad**: integración backend/frontend, lint, build y estrategia Red-Green-Refactor.
18. **Entorno local**: Docker Compose, puertos y flujo de desarrollo.
19. **Producción y CI/CD**: GitHub Actions, OIDC, ACR, Azure Container Apps y Azure Database for MySQL.
20. **Conclusiones y evolución**: aportaciones, limitaciones actuales y líneas futuras.

## Lenguaje visual

- Estilo académico moderno y sobrio.
- Fondo claro, azul tinta como color estructural y acentos coral y verde para destacar funcionalidad y operación.
- Tipografía legible, con jerarquía clara y poco texto por diapositiva.
- Rejilla constante, numeración y pie discreto.
- El lenguaje neón propio de ResourceApp se conservará dentro de las capturas, sin dominar el resto de la presentación.
- Diagramas y formas editables en PowerPoint siempre que sea posible.
- Sin animaciones complejas ni dependencias de fuentes poco comunes.

## Capturas y ejemplos

Las capturas se obtendrán de la aplicación real ejecutada localmente. Se priorizarán Home, login, proyectos, páginas/versiones, recursos y traducciones. Los datos de demostración usarán nombres coherentes a lo largo de toda la presentación para que el recorrido parezca una única sesión de usuario.

Los ejemplos técnicos incluirán:

- Una clave de recurso y sus valores en varios idiomas.
- Una solicitud de traducción automática y sus idiomas pendientes.
- Un fragmento breve de exportación JSON/XML.
- Un ejemplo de ruta REST jerárquica.
- El flujo de una imagen desde GitHub Actions hasta Azure Container Apps.

Si una funcionalidad priorizada no está disponible en la interfaz actual, se mostrará mediante un diagrama o ejemplo etiquetado como alcance funcional, sin presentarlo como captura de una característica ya operativa.

## Notas del orador

Cada diapositiva incluirá entre dos y cuatro ideas breves para exposición. El reparto de tiempo objetivo será:

- Introducción y alcance: 3 minutos.
- Demostración funcional: 6 minutos.
- Especificación técnica y calidad: 4 minutos.
- Despliegue, conclusiones y evolución: 2 minutos.

## Validación

La presentación se considerará terminada cuando:

- El archivo `.pptx` contenga aproximadamente 20 diapositivas y se abra sin errores.
- Las cuatro áreas solicitadas estén claramente identificadas.
- Las capturas sean legibles y procedan de la aplicación real cuando representen funcionalidad implementada.
- No se expongan claves, tokens, contraseñas ni cadenas de conexión sensibles.
- Los diagramas coincidan con la especificación funcional y la documentación de despliegue.
- El contenido pueda presentarse en 15 minutos sin leer párrafos extensos.
- Todas las imágenes estén incrustadas y el documento siga siendo editable.