import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import axios from "axios"; // Import Axios
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard.jsx";
import "./App.css";

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(
    localStorage.getItem("isAuthenticated") === "true"
  );
  const [isLoading, setIsLoading] = useState(true);

  const API_URL = import.meta.env.VITE_API_URL || 'https://spotify-3-0-es19.onrender.com';

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      // First check if we have stored authentication data
      const storedAuth = localStorage.getItem("isAuthenticated");
      if (!storedAuth || storedAuth !== "true") {
        setIsAuthenticated(false);
        setIsLoading(false);
        return;
      }

      // Only make API call if we have stored authentication
      const response = await axios.get(`${API_URL}/api/dashboard`, {
        withCredentials: true,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        }
      });

      if (response.data.success) {
        setIsAuthenticated(true);
        localStorage.setItem("isAuthenticated", "true");
      } else {
        setIsAuthenticated(false);
        localStorage.removeItem("isAuthenticated");
      }
    } catch (error) {
      // Only log non-401 errors
      if (error.response?.status !== 401) {
        console.error("Auth check error:", error.message);
      }
      setIsAuthenticated(false);
      localStorage.removeItem("isAuthenticated");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoginSuccess = async () => {
    try {
      // Verify the session immediately after login
      const response = await axios.get(`${API_URL}/api/dashboard`, {
        withCredentials: true,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        }
      });

      if (response.data.success) {
        setIsAuthenticated(true);
        localStorage.setItem("isAuthenticated", "true");
      } else {
        setIsAuthenticated(false);
        localStorage.removeItem("isAuthenticated");
      }
    } catch (error) {
      console.error("Login verification error:", error);
      setIsAuthenticated(false);
      localStorage.removeItem("isAuthenticated");
    }
  };

  const handleLogout = async () => {
    try {
      const response = await axios.post(
        `${API_URL}/api/logout`,
        {},
        {
          withCredentials: true,
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          }
        }
      );

      if (response.data.success) {
        setIsAuthenticated(false);
        localStorage.removeItem("isAuthenticated");
        localStorage.removeItem("userLibrary");
        window.location.href = "/login";
      }
    } catch (error) {
      console.error("Logout error:", error);
      setIsAuthenticated(false);
      localStorage.removeItem("isAuthenticated");
      localStorage.removeItem("userLibrary");
      window.location.href = "/login";
    }
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <Router>
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
            isAuthenticated ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <Signup />
            )
          }
        />
        <Route
          path="/dashboard"
          element={
            isAuthenticated ? (
              <Dashboard onLogout={handleLogout} />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/"
          element={
            isAuthenticated ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
      </Routes>
    </Router>
  );
}

export default App;