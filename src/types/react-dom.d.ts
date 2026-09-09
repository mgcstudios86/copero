// MGC-2494 — el repo no declara `@types/react-dom` (solo `@types/react`),
// pero `react-dom` sí es dependencia runtime (package.json: 19.2.3) porque
// react-native-web lo usa. identity.tsx importa `flushSync` para romper el
// automatic batching de React 19 en los setters de TextInput. Declaramos
// únicamente la firma que consumimos para no agregar un devDependency ni
// tocar el lockfile.
declare module 'react-dom' {
  export function flushSync<R>(fn: () => R): R;
}
