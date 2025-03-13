// src/Login.js
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from './firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import './Login.css';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      console.log('Logged in user:', userCredential.user);
      // Navigate to home page on successful login
      navigate('/home');
    } catch (error) {
      console.error('Error logging in:', error);
      setError(error.message);
    }
  };

  const handleSignUp = () => {
    // Navigate to the sign-up page
    navigate('/signup');
  };

  return (
    <div className="login-container">
      <div className="app-title">
        <h1>My ML App</h1>
      </div>
      <div className="login-box">
        <h2>Login</h2>
        {error && <p className="error">{error}</p>}
        <form onSubmit={handleLogin}>
          <input
            type="email"
            placeholder="E-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button type="submit">Login</button>
        </form>
        <p>
          Don’t have an account?{' '}
          <span className="signup-link" onClick={handleSignUp}>
            Sign up
          </span>
        </p>
      </div>
    </div>
  );
}

export default Login;
