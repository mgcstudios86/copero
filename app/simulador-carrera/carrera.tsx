// app/simulador-carrera/carrera.tsx — MGC-1210
//
// Wrapper file-based para `/simulador-carrera/carrera`. Resuelve el
// "Unmatched Route" que devolvía el deep link `copero://simulador-carrera/carrera`
// (MGC-1183 cancelado por mismo síntoma; APK MGC-1194 PR-303 SHA 6629ccc3).
//
// No existe una pantalla dedicada `carrera` en features/ — `carrera` en este
// contexto designa el simulador completo, no un screen individual. La entrada
// canónica es `/simulador-carrera` (app/simulador-carrera/index.tsx), que ya
// dispatcha según `careerStage` persistido (identity / dashboard / club /
// temporada / fin-carrera). Por eso este wrapper es un Redirect al index:
// preserva la lógica de resume y evita dos puntos de entrada divergentes que
// peleen por el mismo estado.
import { Redirect } from 'expo-router';

export default function CarreraRoute() {
  return <Redirect href="/simulador-carrera" />;
}
