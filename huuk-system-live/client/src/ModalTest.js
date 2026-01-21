import React, { useState } from 'react';
import SimpleSignInModal from './components/bookings/SimpleSignInModal';
import SimpleSignUpModal from './components/bookings/SimpleSignUpModal';
import './styles/enhancedModals.css';

const ModalTest = () => {
  const [showSignIn, setShowSignIn] = useState(false);
  const [showSignUp, setShowSignUp] = useState(false);

  const mockLoading = { signIn: false, signUp: false };
  const mockErrors = { phoneNumber: "", password: "", name: "" };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>Modal Test Page</h1>
      
      <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
        <button 
          onClick={() => setShowSignIn(true)}
          style={{
            padding: '10px 20px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          Test Sign In Modal
        </button>
        
        <button 
          onClick={() => setShowSignUp(true)}
          style={{
            padding: '10px 20px',
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          Test Sign Up Modal
        </button>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h3>Debug Info:</h3>
        <p>Sign In Modal Open: {showSignIn ? 'YES' : 'NO'}</p>
        <p>Sign Up Modal Open: {showSignUp ? 'YES' : 'NO'}</p>
      </div>

      <SimpleSignInModal
        isOpen={showSignIn}
        onClose={() => setShowSignIn(false)}
        signInPhoneNumber=""
        setSignInPhoneNumber={() => {}}
        signInPassword=""
        setSignInPassword={() => {}}
        handleSignIn={(e) => { e.preventDefault(); console.log('Sign In clicked'); }}
        errors={mockErrors}
        setSignInErrors={() => {}}
        loading={mockLoading}
        navigate={() => {}}
        profile={{}}
      />

      <SimpleSignUpModal
        isOpen={showSignUp}
        onClose={() => setShowSignUp(false)}
        signUpPhoneNumber=""
        setSignUpPhoneNumber={() => {}}
        signUpPassword=""
        setSignUpPassword={() => {}}
        signUpName=""
        setSignUpName={() => {}}
        handleSignUp={(e) => { e.preventDefault(); console.log('Sign Up clicked'); }}
        errors={mockErrors}
        setSignUpErrors={() => {}}
        loading={mockLoading}
        onShowSignIn={() => { setShowSignUp(false); setShowSignIn(true); }}
      />
    </div>
  );
};

export default ModalTest;
