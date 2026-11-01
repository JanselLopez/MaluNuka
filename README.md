# Malu y Nuka

Un juego cooperativo de plataformas para dos pingüinos: Malu, azul, y Nuka, naranja. Resuelvan los niveles en equipo, recojan peces y lleguen juntos al iglú.

La versión web es el juego principal y puede publicarse como sitio estático en GitHub Pages. Incluye modo local para jugar en un solo dispositivo y modo en línea con salas.

## Jugar en la web

### Abrir la versión local

Necesitas Node.js 22 o posterior. Desde la carpeta del proyecto, ejecuta:

```bash
npm ci
npm run build
npm run web
```

Abre [http://localhost:5320](http://localhost:5320) para jugar. La raíz redirige a [http://localhost:5320/publico/](http://localhost:5320/publico/), la misma carpeta estática que se publica en GitHub Pages.

### Controles

- **Malu:** `A` y `D` para moverse, `W` para saltar y `S` para agarrar.
- **Nuka:** flechas izquierda y derecha para moverse, `↑` para saltar y `↓` para agarrar.
- **Pantallas táctiles:** usa los controles en pantalla. El juego admite orientación horizontal.

## Publicar en GitHub Pages

El repositorio ya incluye una acción de GitHub que construye la web y publica `publicar/` automáticamente al hacer push a `main` o `master`.

1. Sube el proyecto completo a un repositorio de GitHub.
2. En el repositorio, abre **Settings → Pages**.
3. En **Build and deployment → Source**, selecciona **GitHub Actions**.
4. Sube los cambios a `main` o `master`, o ejecuta manualmente el flujo **Publicar juego web** desde **Actions**.
5. Al terminar el flujo, GitHub mostrará la dirección del sitio en **Settings → Pages**. Para un repositorio de proyecto suele tener el formato `https://USUARIO.github.io/REPOSITORIO/`.

`npm run build` genera en `publicar/` un `index.html` junto con las fuentes locales y PeerJS. Las rutas de esos recursos son relativas para que funcionen bajo la subruta que GitHub Pages asigna a cada repositorio. No edites los archivos generados dentro de `publicar/`; haz los cambios en `src/` y vuelve a ejecutar el build.

El modo en línea requiere conexión a internet y un sitio servido por HTTPS, como GitHub Pages. Usa PeerJS y WebRTC para conectar las salas entre dispositivos.

## Desarrollo

Los archivos fuente del juego están en `src/`. Para añadir o ajustar niveles, consulta `src/levels/` y `src/pistas.js`. Los archivos HTML, JavaScript y recursos estáticos listos para alojar se generan con `build.js`.

```text
src/                    Interfaz web, motor, controles y niveles
publicar/               Sitio estático generado para GitHub Pages
assets/                 Recursos gráficos de origen
.github/workflows/       Automatización de GitHub Pages
mobile/                 Proyecto React Native independiente, actualmente en pausa
```

## Licencia y créditos

Este repositorio contiene el juego Malu y Nuka y sus recursos. Los avisos de licencia de PeerJS y las fuentes están incluidos en `publicar/lib/` y `publicar/fonts/` al generar el sitio.
