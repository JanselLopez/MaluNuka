# Malu y Nuka · app móvil

App Expo y React Native para Android e iOS. La portada, el selector de niveles, los controles y el renderizado con SVG se dibujan en vistas nativas. `src/game-engine.js` y `src/levels.json` se generan desde el motor y los niveles compartidos de la web.

## Arrancar

Desde la raíz del proyecto, genera primero el motor y los datos:

```sh
npm run build
cd mobile
npm install
npx expo start
```

El modo en línea usa PeerJS sobre WebRTC nativo. Como WebRTC incluye código nativo, crea una compilación de desarrollo (Expo Go no lo incluye): `npx expo run:android` o `npx expo run:ios`, con dispositivo o simulador preparado. La app comparte las salas de código con la web y emplea el mismo protocolo de presencia.

El modo cooperativo en el mismo teléfono ya ejecuta el motor y los niveles en nativo. La app incluye la integración PeerJS/WebRTC para usar las mismas salas con la web. Hay que validar la conexión entre plataformas en dispositivos reales; según la red, puede hacer falta un servidor TURN.

La versión web queda en la raíz y se publica aparte en GitHub Pages. No necesita React Native ni Expo.
