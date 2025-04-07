import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './Signup.css';

const Signup = () => {
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
      console.log('Sending signup request to backend...');
      const response = await axios.post(
        'https://spotify-3-0-es19.onrender.com/api/signup',
        { email, password },
        {
          withCredentials: true
        }
      );

      console.log('Response status:', response.status);
      console.log('Response data:', response.data);

      if (response.data.success) {
        navigate('/login', { replace: true });
      } else {
        setFlashMessages([{ category: 'warning', message: response.data.message || 'Signup failed. Please try again.' }]);
      }
    } catch (error) {
      console.error('Error:', error);
      setFlashMessages([{ category: 'warning', message: error.response?.data?.message || 'Signup failed. Please try again.' }]);
    } finally {
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

      <div className="signup-container">
        <h1>Sign up for free</h1>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">What's your email?</label>
            <input
              type="email"
              id="email"
              name="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="Enter your email"
              disabled={isSubmitting}
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Create a password</label>
            <input
              type="password"
              id="password"
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Create a password"
              disabled={isSubmitting}
            />
          </div>
          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Signing up...' : 'SIGN UP'}
          </button>
          <div className="terms">
            By clicking on sign-up, you agree to Gareeb ka Spotify's Terms and Conditions of Use.
          </div>
        </form>
        <div className="divider">or</div>
        <div className="login-link">
          <p>Already have an account?</p>
          <a href="/login">LOG IN TO GAREEB KA SPOTIFY</a>
        </div>
      </div>
    </div>
  );
};

export default Signup;