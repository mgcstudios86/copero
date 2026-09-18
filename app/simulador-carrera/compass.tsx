// app/simulador-carrera/compass.tsx — MGC-42.C
//
// Ruta legacy del quiz Ideología Futbolística (MGC-1210). Auditoría UX
// MGC-44 marcó compass como dead route fuera del simulador de carrera.
// Queda como Redirect al index del simulador para preservar deep links
// viejos sin montar el motor del quiz.
import { Redirect } from 'expo-router';

export default function CompassRoute() {
  return <Redirect href="/simulador-carrera" />;
}