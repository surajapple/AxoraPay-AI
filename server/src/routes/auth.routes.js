import { Router } from 'express';
import { AuthService } from '../services/AuthService.js';

const router = Router();

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const { token, user } = await AuthService.login(email, password);
    
    res.json({
      success: true,
      token,
      user
    });
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
});

router.post('/logout', (req, res) => {
  res.json({ success: true, message: 'Logged out successfully' });
});

router.get('/demo-credentials', (req, res) => {
  res.json({
    email: 'admin@axorapay.com',
    password: 'password123',
    role: 'ADMIN'
  });
});

export default router;
