import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Signup from './pages/Signup';
import DashboardLayout from './components/layouts/DashboardLayout';
import Upload from './pages/Upload';
import Quiz from './pages/Quiz';
import Review from './pages/Review';
import Profile from './pages/Profile';
import { SocketProvider } from './contexts/SocketContext';
import { initializeSocket } from './utils/socketManager';
import Transcripts from './pages/Transcripts';
import Settings from './pages/Settings';
import Dashboard from './pages/Dashboard';
import TranscriptionView from './pages/TranscriptionView';
import './App.css';

// Need to add date-fns package for the history component
// Run: npm install date-fns

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return !!localStorage.getItem('token');
  });

  // Initialize socket connection once at app startup
  useEffect(() => {
    // Force socket initialization
    const socket = initializeSocket();
    
    // Check socket periodically to ensure it's connected
    const socketCheckInterval = setInterval(() => {
      if (socket && !socket.connected) {
        console.log('Socket disconnected, attempting to reconnect...');
        socket.connect();
      }
    }, 10000);
    
    return () => {
      clearInterval(socketCheckInterval);
    };
  }, []);

  useEffect(() => {
    const handleStorageChange = () => {
      setIsAuthenticated(!!localStorage.getItem('token'));
    };

    // Listen for local changes
    window.addEventListener('storage', handleStorageChange);
    
    // Listen for direct changes
    const intervalId = setInterval(handleStorageChange, 1000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(intervalId);
    };
  }, []);

  return (
    <SocketProvider>
      <Routes>
        {!isAuthenticated ? (
          <>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </>
        ) : (
          <>
            <Route path="/dashboard" element={<DashboardLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="upload" element={<Upload />} />
              <Route path="quiz" element={<Quiz />} />
              <Route path="review" element={<Review />} />
              <Route path="profile" element={<Profile />} />
              <Route path="transcripts" element={<Transcripts />} />
              <Route path="settings" element={<Settings />} />
              <Route path="transcription" element={<TranscriptionView />} />
            </Route>
            <Route path="/quiz" element={<Quiz />} />
            <Route path="/transcription" element={<TranscriptionView />} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </>
        )}
      </Routes>
    </SocketProvider>
  );
};

export default App;
