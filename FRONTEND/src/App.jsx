import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import axios from "axios"; // Import Axios
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard.jsx";
import "./App.css";

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => localStorage.getItem("isAuthenticated") === "true" || false
  );
  const [isLoading, setIsLoading] = useState(true);

  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000"; // Fallback for local dev

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/dashboard`, {
        withCredentials: true, // Send cookies/session
      });

      if (response.data.success) {
        setIsAuthenticated(true);
        localStorage.setItem("isAuthenticated", "true");
      } else {
        setIsAuthenticated(false);
        localStorage.removeItem("isAuthenticated");
      }
    } catch (error) {
      console.error("Auth check error:", error.message);
      setIsAuthenticated(false);
      localStorage.removeItem("isAuthenticated");
    } finally {
      setIsLoading(false);
    }
  };

  const ProtectedRoute = ({ children }) => {
    if (isLoading) {
      return <div>Loading...</div>;
    }

    if (!isAuthenticated) {
      return <Navigate to="/login" replace />;
    }

    return children;
  };

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
    localStorage.setItem("isAuthenticated", "true");
  };

  const handleLogout = async () => {
    try {
      const response = await axios.post(
        `${API_URL}/api/logout`,
        {},
        {
          withCredentials: true, // Send cookies/session
        }
      );

      if (response.data.success) {
        setIsAuthenticated(false);
        localStorage.removeItem("isAuthenticated");
        localStorage.removeItem("userLibrary");
        window.location.href = "/login"; // Force full page redirect
      }
    } catch (error) {
      console.error("Logout error:", error);
      setIsAuthenticated(false);
      localStorage.removeItem("isAuthenticated");
      localStorage.removeItem("userLibrary");
      window.location.href = "/login";
    }
  };

  return (
    <Router>
      <div className="app">
        <Routes>
          <Route
            path="/login"
            element={
              isAuthenticated ? (
                <Navigate to="/dashboard" replace />
              ) : (
                <Login setIsAuthenticated={handleLoginSuccess} />
              )
            }
          />
          <Route
            path="/signup"
            element={
              isAuthenticated ? <Navigate to="/dashboard" replace /> : <Signup />
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;