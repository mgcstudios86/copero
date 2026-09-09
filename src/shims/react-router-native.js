// MGC-2532 r2 — stub de react-router para builds nativos.
//
// Por que existe: react-router v7.x genera `import(/* @vite-ignore */)`
// que Hermes 0.86 no parsea en native bundle (5 errors "Invalid
// expression encountered" en chunk-7SIULPXI.js — MGC-2512). En native
// la navegación la provee Expo Router + react-native-screens, no RR.
// metro.config.js redirecciona `require('react-router' | 'react-router-dom'
// | 'react-router-dom-v5-compat' | '@remix-run/router')` a este stub
// cuando platform !== 'web'. El stub exporta el mismo shape de named
// exports que react-router-dom para mantener compatibilidad con código
// que importe tanto default como named exports transitivamente desde
// deps no-Expo (barrels web-only que llegan al module graph nativo).
//
// Que NO hacer: NO devolver `{type: 'empty'}` desde customResolver —
// eso patchea el resolver chain y Expo Router 57 renderiza Unmatched
// en cold-start (PR #566 SHA dd18e1e r1 falla). El resolver devuelve
// `{filePath: <este archivo>}` (modulo real, module ID valido).

const React = require('react');
const PassThrough = ({ children }) => React.createElement(React.Fragment, null, children);

const Router = ({ children }) => PassThrough({ children });
const Routes = ({ children }) => PassThrough({ children });
const Route = () => null;
const Outlet = () => null;
const Link = () => null;
const NavLink = () => null;
const Navigate = () => null;
const useNavigate = () => () => {};
const useLocation = () => ({ pathname: '/', search: '', hash: '', state: null });
const useParams = () => ({});
const useMatch = () => null;
const useRouteError = () => null;
const useSearchParams = () => [new URLSearchParams(), () => {}];
const BrowserRouter = ({ children }) => PassThrough({ children });
const HashRouter = ({ children }) => PassThrough({ children });
const MemoryRouter = ({ children }) => PassThrough({ children });
const createBrowserRouter = () => ({});
const createMemoryRouter = () => ({});
const createHashRouter = () => ({});
const RouterProvider = () => null;
const Outlet_ = Outlet;

module.exports = {
  default: Router,
  Router,
  Routes,
  Route,
  Outlet,
  Link,
  NavLink,
  Navigate,
  useNavigate,
  useLocation,
  useParams,
  useMatch,
  useRouteError,
  useSearchParams,
  BrowserRouter,
  HashRouter,
  MemoryRouter,
  createBrowserRouter,
  createMemoryRouter,
  createHashRouter,
  RouterProvider,
};
module.exports.default = module.exports;
// Compatibilidad ESM-style
Object.assign(module.exports, {
  __esModule: true,
  Outlet: Outlet_,
});
