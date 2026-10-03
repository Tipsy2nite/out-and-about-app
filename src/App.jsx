import { HashRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './lib/auth.jsx';
import { isConfigured } from './lib/supabase.js';
import Layout from './components/Layout.jsx';
import RequireAuth from './components/RequireAuth.jsx';
import Explore from './pages/Explore.jsx';
import MapPage from './pages/MapPage.jsx';
import EventPage from './pages/EventPage.jsx';
import HostPage from './pages/HostPage.jsx';
import CirclesPage from './pages/CirclesPage.jsx';
import CirclePage from './pages/CirclePage.jsx';
import ParentsPage from './pages/ParentsPage.jsx';
import PersonPage from './pages/PersonPage.jsx';
import MePage from './pages/MePage.jsx';
import SignIn from './pages/SignIn.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import Welcome from './pages/Welcome.jsx';
import Guidelines from './pages/Guidelines.jsx';
import NotFound from './pages/NotFound.jsx';

function SetupNeeded() {
  return (
    <div className="pad narrow prose">
      <h1 className="page-title">Almost there</h1>
      <p>The app isn't connected to its database yet. Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> (see README.md, step 2), then restart.</p>
    </div>
  );
}

export default function App() {
  if (!isConfigured) return <SetupNeeded />;
  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Explore />} />
            <Route path="map" element={<MapPage />} />
            <Route path="events/:id" element={<EventPage />} />
            <Route path="host" element={<RequireAuth><HostPage /></RequireAuth>} />
            <Route path="circles" element={<CirclesPage />} />
            <Route path="circles/:id" element={<CirclePage />} />
            <Route path="parents/:mode" element={<ParentsPage />} />
            <Route path="people/:id" element={<PersonPage />} />
            <Route path="me" element={<RequireAuth><MePage /></RequireAuth>} />
            <Route path="signin" element={<SignIn />} />
            <Route path="reset-password" element={<ResetPassword />} />
            <Route path="welcome" element={<Welcome />} />
            <Route path="guidelines" element={<Guidelines />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </HashRouter>
    </AuthProvider>
  );
}
