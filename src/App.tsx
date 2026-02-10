import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Editor from './pages/Editor';
import Library from './pages/Library';

function App() {
  return (
    <Router>
      <div className="w-full h-full min-h-screen bg-surface text-on-surface">
        <Routes>
          <Route path="/" element={<Navigate to="/library" replace />} />
          <Route path="/library" element={<Library />} />
          <Route path="/editor" element={<Editor />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
