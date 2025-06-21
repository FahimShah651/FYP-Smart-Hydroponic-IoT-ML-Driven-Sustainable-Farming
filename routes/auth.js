const express = require('express');
const router = express.Router();
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');

// Admin login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    const auth = getAuth();
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const idToken = await userCredential.user.getIdToken();
    
    // Set session cookie or return token
    res.json({ 
      message: 'Login successful',
      user: {
        uid: userCredential.user.uid,
        email: userCredential.user.email,
        token: idToken
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

// Check authentication status
router.get('/check', (req, res) => {
  const auth = getAuth();
  const user = auth.currentUser;
  
  if (user) {
    res.json({ 
      isAuthenticated: true,
      user: {
        uid: user.uid,
        email: user.email
      }
    });
  } else {
    res.json({ isAuthenticated: false });
  }
});

// Logout
router.post('/logout', async (req, res) => {
  try {
    const auth = getAuth();
    await auth.signOut();
    res.json({ message: 'Logout successful' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Failed to logout' });
  }
});

module.exports = router;
