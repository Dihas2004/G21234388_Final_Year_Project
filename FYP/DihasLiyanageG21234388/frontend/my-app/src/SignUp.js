// src/SignUp.js
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from './firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import './SignUp.css';

function SignUp() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const handleSignUp = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      console.log('Signed up user:', userCredential.user);
      // Navigate to home page after successful sign-up
      navigate('/home');
    } catch (error) {
      console.error('Error signing up:', error);
      setError(error.message);
    }
  };

  return (
    <div className="signup-page">
      <div className="header-bar">
        <h1>Bitcoin Prediction Interpreter</h1>
      </div>
      <div className="signup-container">
        <div className="signup-box">
          <h2>Sign up</h2>
          {error && <p className="error">{error}</p>}
          <form onSubmit={handleSignUp}>
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
            <button type="submit">Sign Up</button>
          </form>
          <p>
            Already have an account?{' '}
            <span className="login-link" onClick={() => navigate('/')}>
              Log in
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

export default SignUp;
