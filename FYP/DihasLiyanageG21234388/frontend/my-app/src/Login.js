// src/Login.js
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from './firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import './Login.css';
//Logo import
import Logo from './Logo.png'; 

function Login() {
  // State hooks to manage email, password, and any error messages.
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  // Handle the login process when the form is submitted.
  const handleLogin = async (e) => {
    // Prevent page reload on form submission
    e.preventDefault();
    // Reset error state before attempting login
    setError(null);
    try {
      // Attempt to sign in with Firebase using email and password
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      console.log('Logged in user:', userCredential.user);
      // Navigate to the home page on successful login
      navigate('/home');
    } catch (error) {
      console.error('Error logging in:', error);
      // Set error message if login fails
      setError(error.message);
    }
  };

  // Navigate to the Sign Up page when user clicks the sign-up link.
  const handleSignUp = () => {
    navigate('/signup');
  };

  return (
    <div className="login-container">
      <div className="app-title">
        <img src={Logo} alt="Logo" className="logo" />
        <h1>Bitcoin Prediction Interpreter</h1>
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
