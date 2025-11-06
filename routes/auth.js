const express = require('express');
const User = require('../models/User');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { flashMessages } = require('../utils/helpers');
const router = express.Router();

router.use(flashMessages);

// Login page
router.get('/login', (req, res) => {
  if (req.session.userId) {
    return res.redirect('/dashboard');
  }
  res.render('auth/login', { title: 'Login' });
});

// Public Signup page
router.get('/signup', (req, res) => {
  if (req.session.userId) {
    return res.redirect('/dashboard');
  }
  res.render('auth/signup', { title: 'Sign Up' });
});

// Public Signup post
router.post('/signup', async (req, res) => {
  try {
    const { username, email, password, confirmPassword } = req.body;

    // Validate password match
    if (password !== confirmPassword) {
      req.flash('error', 'Passwords do not match');
      return res.redirect('/signup');
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ username }, { email }]
    });

    if (existingUser) {
      req.flash('error', 'Username or email already exists');
      return res.redirect('/signup');
    }

    // Create new user with 'staff' role by default
    const user = new User({
      username,
      email,
      password,
      role: 'staff' // Default role for public signups
    });

    await user.save();

    req.flash('success', 'Account created successfully! Please login.');
    res.redirect('/login');
  } catch (error) {
    console.error('Signup error:', error);
    req.flash('error', 'An error occurred during signup');
    res.redirect('/signup');
  }
});

// Login post
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Find user by username or email
    const user = await User.findOne({
      $or: [
        { username: username },
        { email: username }
      ],
      isActive: true
    });

    if (!user) {
      req.flash('error', 'Invalid username or password');
      return res.redirect('/login');
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      req.flash('error', 'Invalid username or password');
      return res.redirect('/login');
    }

    // Set session
    req.session.userId = user._id;
    req.session.username = user.username;
    req.session.userRole = user.role;

    req.flash('success', `Welcome back, ${user.username}!`);
    res.redirect('/dashboard');
  } catch (error) {
    console.error('Login error:', error);
    req.flash('error', 'An error occurred during login');
    res.redirect('/login');
  }
});

// Register page (Admin only)
router.get('/register', requireAdmin, (req, res) => {
  res.render('auth/register', { 
    title: 'Register New User',
    user: req.user 
  });
});

// Register post (Admin only)
router.post('/register', requireAdmin, async (req, res) => {

  try {
    const { username, email, password, role } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ username }, { email }]
    });

    if (existingUser) {
      req.flash('error', 'Username or email already exists');
      return res.redirect('/register');
    }

    // Create new user
    const user = new User({
      username,
      email,
      password,
      role: role || 'staff'
    });

    await user.save();

    req.flash('success', 'User registered successfully');
    res.redirect('/dashboard');
  } catch (error) {
    console.error('Registration error:', error);
    req.flash('error', 'An error occurred during registration');
    res.redirect('/register');
  }
});

// Logout
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
    }
    res.redirect('/login');
  });
});

// Home page redirect
router.get('/', (req, res) => {
  if (req.session.userId) {
    res.redirect('/dashboard');
  } else {
    res.redirect('/login');
  }
});

module.exports = router;
