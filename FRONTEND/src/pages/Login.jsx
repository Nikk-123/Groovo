import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Login.css';

const Login = ({ setIsAuthenticated }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [flashMessages, setFlashMessages] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFlashMessages([]);

    try {
      console.log('Sending login request to backend...');
      const response = await fetch('/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ email, password }),
        credentials: 'include', // Important for cookies/session
      });

      console.log('Response status:', response.status);
      
      // Check if response is ok before trying to parse JSON
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      
      // Try to parse the response as JSON
      let data;
      try {
        data = await response.json();
        console.log('Response data:', data);
      } catch (jsonError) {
        console.error('Error parsing JSON:', jsonError);
        throw new Error('Invalid JSON response from server');
      }

      if (data.success) {
        // Store user library in localStorage if available
        if (data.library) {
          localStorage.setItem('userLibrary', JSON.stringify(data.library));
        }
        
        // Update authentication state
        if (setIsAuthenticated) {
          setIsAuthenticated(true);
        }
        
        // Navigate to dashboard on success
        navigate(data.redirect || '/dashboard');
      } else {
        setFlashMessages([{ category: 'danger', message: data.message || 'Login failed. Please check your credentials.' }]);
        setIsSubmitting(false);
      }
    } catch (error) {
      console.error('Error:', error);
      setFlashMessages([{ category: 'danger', message: 'Login failed. Please try again.' }]);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="body">
      <div className="header">
        <a href="/" className="logo">
          <i className="fab fa-spotify"></i>
          Gareeb ka Spotify
        </a>
      </div>

      {flashMessages.length > 0 && (
        <div className="flash-messages">
          {flashMessages.map((msg, index) => (
            <div key={index} className={`flash ${msg.category}`}>
              {msg.message}
            </div>
          ))}
        </div>
      )}

      <div className="login-container">
        <h1>Log in to continue</h1>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email address</label>
            <input
              type="email"
              id="email"
              name="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="Enter your email"
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Password"
            />
          </div>
          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Logging in...' : 'LOG IN'}
          </button>
        </form>
        <div className="divider">or</div>
        <div className="signup-link">
          <p>Don't have an account?</p>
          <a href="/signup">SIGN UP FOR GAREEB KA SPOTIFY</a>
        </div>
      </div>
    </div>
  );
};

export default Login;