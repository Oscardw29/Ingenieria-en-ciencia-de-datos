# Ingeniería en Ciencia de Datos — Universidad del Magdalena

Landing page (MVP) del programa. Sitio estático: HTML, CSS y JavaScript sin dependencias ni paso de compilación.

## Qué incluye

1. **Hero "el logo se arma con datos"**: una nube de dígitos `0` y `1` flota en pantalla; al hacer scroll las partículas vuelan y forman el logo, aparece el logo real y luego el título con efecto blur.
2. **Contenedor principal**: sube sobre el hero con navegación, contador rápido hasta **140** créditos, gráfico de duración (barras con distinta velocidad y etiqueta "50% más rápido") y datos de modalidad y título.
3. **Información del programa**: por qué la Universidad del Magdalena, perfil profesional, perfil del aspirante, resultados de aprendizaje (SO1–SO6), misión y visión.

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
js/content.js         Contador, gráfico, revelado al hacer scroll y navegación activa
js/logo-points.js     Posiciones de las partículas (generado)
assets/               Logo y favicons
tools/generate_points.py  Regenera js/logo-points.js a partir del logo
```

Si cambia el logo: `python3 tools/generate_points.py ruta/al/logo.webp js/logo-points.js` (requiere Pillow).

## Pendiente

- Enlace oficial de inscripciones (los botones "Inscríbete" apuntan por ahora a la sección final de la página).
