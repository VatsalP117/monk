import { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import LandingScreen from "./screens/LandingScreen";
import LibraryScreen from "./screens/LibraryScreen";
import ReaderScreen from "./screens/ReaderScreen";
import { useAppStore } from "./state/store";

export default function App(): JSX.Element {
  const theme = useAppStore((state) => state.prefs.theme);

  useEffect(() => {
    document.body.classList.remove("theme-paper", "theme-sepia", "theme-dark");
    document.body.classList.add(`theme-${theme}`);
  }, [theme]);

  return (
    <div className={`min-h-screen bg-paper text-ink font-ui theme-${theme}`}>
      <Routes>
        <Route path="/" element={<LandingScreen />} />
        <Route path="/library" element={<LibraryScreen />} />
        <Route path="/reader/:documentId" element={<ReaderScreen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
