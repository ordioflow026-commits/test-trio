import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LanguageProvider } from './contexts/LanguageContext';
import { UserProvider } from './contexts/UserContext';
import LoginScreen from './screens/LoginScreen';
import MainScreen from './screens/MainScreen';
import DummyCallScreen from './screens/DummyCallScreen';

export default function App() {
  return (
    <LanguageProvider>
      <UserProvider>
        <BrowserRouter>
          <div className="max-w-md mx-auto bg-white min-h-screen shadow-2xl overflow-hidden relative">
            <Routes>
              <Route path="/" element={<LoginScreen />} />
              <Route path="/main" element={<MainScreen />} />
              <Route path="/call" element={<DummyCallScreen />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </BrowserRouter>
      </UserProvider>
    </LanguageProvider>
  );
}
