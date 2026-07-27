const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const router = express.Router();

// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    // Kullanıcıyı veritabanından bul
    db.query('SELECT * FROM users WHERE username = ?', [username], async (err, results) => {
      if (err) return res.status(500).json({ error: 'Database error' });

      if (results.length === 0) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const user = results[0];

      // Şifreyi kontrol et
      const passwordMatch = await bcrypt.compare(password, user.password);
      if (!passwordMatch) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // JWT token oluştur
      const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        process.env.JWT_SECRET || 'servisdrama-change-this-secret',
        { expiresIn: process.env.JWT_EXPIRE || '8h' }
      );

      res.json({
        success: true,
        token,
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          role: user.role,
          email: user.email
        }
      });
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Register
router.post('/register', async (req, res) => {
  try {
    const { username, password, name, email, role } = req.body;

    if (!username || !password || !name) {
      return res.status(400).json({ error: 'Required fields missing' });
    }

    // Şifreyi hash et
    const hashedPassword = await bcrypt.hash(password, 10);

    db.query(
      'INSERT INTO users (username, password, name, email, role) VALUES (?, ?, ?, ?, ?)',
      [username, hashedPassword, name, email, role || 'tech'],
      (err, results) => {
        if (err) {
          if (err.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'Username already exists' });
          }
          return res.status(500).json({ error: 'Database error' });
        }

        res.status(201).json({
          success: true,
          message: 'User registered successfully',
          id: results.insertId
        });
      }
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Middleware: Token kontrol
function verifyToken(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'servisdrama-change-this-secret', (err, decoded) => {
    if (err) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    req.user = decoded;
    next();
  });
}

router.get('/verify', verifyToken, (req, res) => {
  res.json({ success: true, user: req.user });
});

// Tüm kullanıcıları getir
router.get('/users', (req, res) => {
  try {
    db.all('SELECT id, username, name, role, email FROM users ORDER BY role DESC, name', (err, rows) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json({ success: true, users: rows || [] });
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Teknisyen şifre kurulumu
router.post('/setup-tech-password', async (req, res) => {
  try {
    const { code, password } = req.body;

    if (!code || !password) {
      return res.status(400).json({ error: 'Code and password required' });
    }

    // Şifreyi hash et
    const hashedPassword = await bcrypt.hash(password, 10);

    // Teknisyen username'i: 'tech_' + code (örn: tech_1015)
    const techUsername = 'tech_' + code;

    db.query(
      'SELECT * FROM users WHERE username = ?',
      [techUsername],
      (err, results) => {
        if (err) return res.status(500).json({ error: 'Database error' });

        if (results.length > 0) {
          // Var olan tekinsiyeni güncelle
          db.run(
            'UPDATE users SET password = ? WHERE username = ?',
            [hashedPassword, techUsername],
            (updateErr) => {
              if (updateErr) return res.status(500).json({ error: 'Update error' });
              res.json({ success: true, message: 'Technician password updated' });
            }
          );
        } else {
          // Yeni teknisyen oluştur
          db.run(
            'INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, ?)',
            [techUsername, hashedPassword, 'Teknisyen ' + code, 'tech'],
            (insertErr) => {
              if (insertErr) return res.status(500).json({ error: 'Insert error' });
              res.json({ success: true, message: 'Technician password set' });
            }
          );
        }
      }
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
