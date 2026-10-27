# Ingeniería en Ciencia de Datos — Universidad del Magdalena

Landing page (MVP) del programa. Sitio estático: HTML, CSS y JavaScript sin dependencias ni paso de compilación.

## Qué incluye

1. **Hero "el logo se arma con datos"**: una nube de dígitos `0` y `1` flota en pantalla; al hacer scroll las partículas vuelan y forman el logo, aparece el logo real y luego el título con efecto blur.
2. **Contenedor principal**: sube sobre el hero con navegación, contador rápido hasta **140** créditos, gráfico de duración (barras con distinta velocidad y etiqueta "34% más rápido") y datos de modalidad y título.
3. **Información del programa**: por qué la Universidad del Magdalena (cartas 3D que se voltean una a una con el scroll y muestran una mini visualización), perfil profesional, perfil del aspirante, resultados de aprendizaje (SO1–SO6, uno a la vez con su imagen), misión y visión.
4. **Santa Marta en datos**: maqueta realista que gira con el scroll (118 cuadros extraídos de un video de 24 fps, uno de cada dos, en versión de escritorio y de móvil). Cada indicador se une con una línea a su elemento, cuya posición en cada cuadro se obtuvo siguiendo el video. Los valores son ilustrativos.
5. **Ciclo de los datos**: escena 3D guiada por el scroll; una nube de datos crudos pasa por captura, almacenamiento, procesamiento y análisis hasta formar un gráfico de barras.

Respeta `prefers-reduced-motion`: sin animaciones, el hero se muestra ya resuelto.

## Ver en local

```bash
python3 -m http.server 8000
# abrir http://localhost:8000
```

## Estructura

```
index.html            Contenido y estructura
css/styles.css        Estilos
js/hero.js            Animación de partículas guiada por el scroll
js/content.js         Contador, gráfico, cartas de los pilares, revelado al hacer scroll y navegación activa
js/santa-marta.js     Santa Marta: cuadros guiados por el scroll e indicadores
js/santa-marta-track.js  Posición de cada elemento en cada cuadro (generado)
js/pipeline.js        Ciclo de los datos guiado por el scroll
js/logo-points.js     Posiciones de las partículas (generado)
assets/               Logo y favicons
assets/resultados/    Imágenes 1:1 de los resultados de aprendizaje (ver PROMPTS.md)
assets/santa-marta/   Cuadros de la maqueta (desktop/ 880 px y mobile/ 520 px, WebP con transparencia)
tools/generate_points.py  Regenera js/logo-points.js a partir del logo
```

Si cambia el logo: `python3 tools/generate_points.py ruta/al/logo.webp js/logo-points.js` (requiere Pillow).

## Pendiente

- La página es una muestra del programa: no incluye botones ni enlaces de inscripción.
