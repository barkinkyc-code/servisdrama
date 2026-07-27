const express = require('express');
const db = require('../config/database');
const router = express.Router();
const auth = require('../middleware/auth');

// Tüm verileri getir
router.get('/', auth, (req, res) => {
  const query = `
    SELECT d.*, u.username, u.name
    FROM device_data d
    JOIN users u ON d.user_id = u.id
    ORDER BY d.created_at DESC
  `;

  db.query(query, (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json({ success: true, data: results });
  });
});

// Belirli ID'deki veriyi getir
router.get('/:id', auth, (req, res) => {
  db.query('SELECT * FROM device_data WHERE id = ? AND user_id = ?', [req.params.id, req.user.id], (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (results.length === 0) return res.status(404).json({ error: 'Data not found' });
    res.json({ success: true, data: results[0] });
  });
});

// Yeni veri kaydet (Attack data, GPS, etc)
router.post('/', auth, (req, res) => {
  try {
    const { device_id, device_name, attack_type, severity, location, ip_address, port, payload, status, notes } = req.body;

    const query = `
      INSERT INTO device_data
      (user_id, device_id, device_name, attack_type, severity, location, ip_address, port, payload, status, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `;

    db.query(
      query,
      [req.user.id, device_id, device_name, attack_type, severity, location, ip_address, port, payload, status || 'pending', notes],
      (err, results) => {
        if (err) return res.status(500).json({ error: 'Database error' });

        res.status(201).json({
          success: true,
          message: 'Data saved successfully',
          id: results.insertId
        });
      }
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Veriyi güncelle
router.put('/:id', auth, (req, res) => {
  const { status, notes } = req.body;

  const query = 'UPDATE device_data SET status = ?, notes = ? WHERE id = ? AND user_id = ?';

  db.query(query, [status, notes, req.params.id, req.user.id], (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (results.affectedRows === 0) return res.status(404).json({ error: 'Data not found' });

    res.json({ success: true, message: 'Data updated' });
  });
});

// Veriyi sil
router.delete('/:id', auth, (req, res) => {
  db.query('DELETE FROM device_data WHERE id = ? AND user_id = ?', [req.params.id, req.user.id], (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (results.affectedRows === 0) return res.status(404).json({ error: 'Data not found' });

    res.json({ success: true, message: 'Data deleted' });
  });
});

module.exports = router;
