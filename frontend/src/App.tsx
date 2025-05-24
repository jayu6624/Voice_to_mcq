import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Signup from './pages/Signup';
import DashboardLayout from './components/layouts/DashboardLayout';
import Upload from './pages/Upload';
import Quiz from './pages/Quiz';
import Review from './pages/Review';
import Profile from './pages/Profile';
import './App.css';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return !!localStorage.getItem('token');
  });

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
            <Route path="upload" element={<Upload />} />
            <Route path="quiz" element={<Quiz />} />
            <Route path="review" element={<Review />} />
            <Route path="profile" element={<Profile />} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard/upload" replace />} />
        </>
      )}
    </Routes>
  );
};

export default App;
