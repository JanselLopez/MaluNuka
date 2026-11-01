// ---------- Pistas ----------
// Solo cuando un nivel estrena algo: explican cómo funciona lo nuevo, no cómo pasar el nivel.
// Los niveles que no están aquí no muestran pista.
const PISTAS = {
  "Primeros pasos": "Un botón abre la puerta de su color mientras alguien lo pisa.",
  "Sobre mi cabeza": "Pueden pararse uno en la cabeza del otro para llegar más alto.",
  "Cada quien su color": "La cortina azul solo deja pasar a Malu y la naranja solo a Nuka.",
  "Agua helada": "En el agua, Saltar es nadar. Si ven una jaula, ¡tóquenla para liberar a quien está adentro!",
  "El ferry": "Algunos botones mueven plataformas mientras alguien los pisa.",
  "Pista de hielo": "El hielo celeste resbala. Un botón con reloj deja la puerta abierta unos segundos.",
  "Hielo frágil": "El hielo agrietado se rompe al pisarlo. En el aire junto a una pared, mantén Agarrar para pegarte.",
  "Ventilador": "El viento sopla hacia arriba mientras alguien pisa su botón. Sin la llave, el iglú no se abre.",
  "Atados": "Están atados. Mantén Agarrar en el suelo para anclarte; anclado, mantén Saltar para jalar. Las banderas guardan el avance.",
  "Columpio": "Colgando de la cuerda, empuja a un lado y al otro para columpiarte.",
  "Bajo cero": "Sobre el hielo resbaloso no se puede anclar.",
  "Hombros fuertes": "Con tu pareja parada en tu cabeza, toca Agarrar para lanzarla. El botón grande necesita a los dos.",
  "Balancín": "Si uno cae desde alto sobre un lado del balancín, el otro sale volando.",
  "Cambio de lugar": "Al tocar el cristal morado, se cambian de lugar.",
  "Linterna": "El hielo fantasma solo existe cerca de la linterna de Malu.",
  "Interruptores": "La palanca cambia qué bloques de color existen: los rosas o los verdes.",
  "Bajo el hielo": "Bajo el agua se gasta el aire: se recupera en la superficie y en las burbujas. Mantén Agarrar para bucear.",
  "Corrientes": "Las corrientes te arrastran.",
  "La compuerta": "Mientras alguien pisa el botón, el agua de la torre sube.",
  "El rape abisal": "Si la luz del rape te alcanza, te congela y viene a comerte.",
  "Medusas": "No toquen las medusas.",
  "¡Corran!": "¡Una bola de nieve gigante! Nunca se detiene.",
  "Contrarreloj": "Lleguen al iglú antes de que el reloj llegue a cero.",
};
for (const lv of LEVELS) lv.hint = PISTAS[lv.name] || "";
