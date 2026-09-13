// app/simulador-carrera/fin.tsx — MGC-42.C
//
// Ruta legacy del juego de palabras (MGC-1210). NO confundir con
// `fin-carrera.tsx` (resumen de la trayectoria). Auditoría UX MGC-44 marcó
// `fin` como dead route fuera del simulador; queda como Redirect al index
// del simulador para preservar deep links viejos.
import { Redirect } from 'expo-router';

export default function FinRoute() {
  return <Redirect href="/simulador-carrera" />;
}