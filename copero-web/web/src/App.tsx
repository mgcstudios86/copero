import { Routes, Route, Navigate } from 'react-router-dom';
import Topbar from './components/Topbar';
import Identidad from './screens/Identidad';
import Draft from './screens/Draft';
import DraftComplete from './screens/DraftComplete';
import SeleccionClub from './screens/SeleccionClub';
import Temporada from './screens/Temporada';
import FinCarrera from './screens/FinCarrera';

export default function App() {
  return (
    <div className="min-h-full">
      <Topbar />
      <main className="mx-auto max-w-6xl px-4 pb-24 pt-6 sm:px-6 lg:px-8">
        <Routes>
          <Route path="/" element={<Navigate to="/identidad" replace />} />
          <Route path="/identidad" element={<Identidad />} />
          <Route path="/draft" element={<Draft />} />
          <Route path="/draft/complete" element={<DraftComplete />} />
          <Route path="/club" element={<SeleccionClub />} />
          <Route path="/temporada" element={<Temporada />} />
          <Route path="/fin" element={<FinCarrera />} />
          <Route path="*" element={<Navigate to="/identidad" replace />} />
        </Routes>
      </main>
    </div>
  );
}