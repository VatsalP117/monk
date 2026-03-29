import { Navigate, Route, Routes } from "react-router-dom";
import LandingScreen from "./screens/LandingScreen";
import LibraryScreen from "./screens/LibraryScreen";
import ReaderScreen from "./screens/ReaderScreen";

export default function App(): JSX.Element {
  return (
    <div className="min-h-screen bg-paper text-ink font-ui">
      <Routes>
        <Route path="/" element={<LandingScreen />} />
        <Route path="/library" element={<LibraryScreen />} />
        <Route path="/reader/:documentId" element={<ReaderScreen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
