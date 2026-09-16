// app/simulador-carrera/ronda.tsx — MGC-42.C
//
// Ruta legacy del juego de palabras (MGC-1210). Auditoría UX MGC-44 lo marcó
// como dead route fuera del simulador de carrera. Esta entrada queda como
// Redirect al index del simulador para preservar deep links viejos sin
// montar el motor legacy del quiz.
import { Redirect } from 'expo-router';

export default function RondaRoute() {
  return <Redirect href="/simulador-carrera" />;
}