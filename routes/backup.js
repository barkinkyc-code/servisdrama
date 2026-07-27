const express = require('express');
const db = require('../config/database');
const router = express.Router();
const auth = require('../middleware/auth');
const fs = require('fs');
const path = require('path');

// Tüm verileri JSON olarak indir
router.get('/export/json', auth, (req, res) => {
  db.query('SELECT * FROM device_data WHERE user_id = ? ORDER BY created_at DESC', [req.user.id], (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });

    const filename = `backup_${new Date().toISOString().split('T')[0]}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.json({
      timestamp: new Date(),
      user: req.user.username,
      total_records: results.length,
      data: results
    });
  });
});

// Tüm verileri CSV olarak indir
router.get('/export/csv', auth, (req, res) => {
  db.query('SELECT * FROM device_data WHERE user_id = ? ORDER BY created_at DESC', [req.user.id], (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });

    try {
      // Manual CSV conversion
      const headers = ['id', 'device_id', 'device_name', 'attack_type', 'severity', 'location', 'ip_address', 'port', 'status', 'created_at'];
      const csvRows = [headers.join(',')];

      results.forEach(row => {
        const csvRow = headers.map(header => {
          const value = row[header] || '';
          // Escape quotes in values
          return `"${String(value).replace(/"/g, '""')}"`;
        });
        csvRows.push(csvRow.join(','));
      });

      const csv = csvRows.join('\n');
      const filename = `backup_${new Date().toISOString().split('T')[0]}.csv`;
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
      res.send(csv);
    } catch (err) {
      res.status(500).json({ error: 'CSV conversion error' });
    }
  });
});

// Tüm verileri SQL dump olarak indir
router.get('/export/sql', auth, (req, res) => {
  db.query('SELECT * FROM device_data WHERE user_id = ?', [req.user.id], (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });

    let sqlContent = `-- ServisDrama Backup\n-- Generated: ${new Date().toISOString()}\n-- User: ${req.user.username}\n\n`;

    sqlContent += 'CREATE TABLE IF NOT EXISTS device_data_backup (\n';
    sqlContent += '  id INT PRIMARY KEY,\n';
    sqlContent += '  user_id INT,\n';
    sqlContent += '  device_id VARCHAR(100),\n';
    sqlContent += '  device_name VARCHAR(255),\n';
    sqlContent += '  attack_type VARCHAR(100),\n';
    sqlContent += '  severity VARCHAR(50),\n';
    sqlContent += '  location VARCHAR(255),\n';
    sqlContent += '  ip_address VARCHAR(45),\n';
    sqlContent += '  port INT,\n';
    sqlContent += '  payload LONGTEXT,\n';
    sqlContent += '  status VARCHAR(50),\n';
    sqlContent += '  created_at TIMESTAMP\n';
    sqlContent += ');\n\n';

    results.forEach(row => {
      sqlContent += `INSERT INTO device_data_backup VALUES (${row.id}, ${row.user_id}, '${row.device_id}', '${row.device_name}', '${row.attack_type}', '${row.severity}', '${row.location}', '${row.ip_address}', ${row.port}, '${(row.payload || '').replace(/'/g, "\\'")}', '${row.status}', '${row.created_at}');\n`;
    });

    const filename = `backup_${new Date().toISOString().split('T')[0]}.sql`;
    res.setHeader('Content-Type', 'application/sql');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.send(sqlContent);
  });
});

// Backup istatistikleri
router.get('/stats', auth, (req, res) => {
  const query = `
    SELECT
      COUNT(*) as total_records,
      COUNT(CASE WHEN severity='Critical' THEN 1 END) as critical_count,
      COUNT(CASE WHEN severity='High' THEN 1 END) as high_count,
      COUNT(CASE WHEN severity='Medium' THEN 1 END) as medium_count,
      COUNT(CASE WHEN severity='Low' THEN 1 END) as low_count,
      MAX(created_at) as last_backup
    FROM device_data
    WHERE user_id = ?
  `;

  db.query(query, [req.user.id], (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json({ success: true, stats: results[0] });
  });
});

// Otomatik backup oluştur (ZIP formatında)
router.post('/create', auth, (req, res) => {
  try {
    const backupDir = path.join(__dirname, '..', 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    db.query('SELECT * FROM device_data WHERE user_id = ?', [req.user.id], (err, results) => {
      if (err) return res.status(500).json({ error: 'Database error' });

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `backup_${req.user.username}_${timestamp}.json`;
      const filepath = path.join(backupDir, filename);

      const backupData = {
        timestamp: new Date(),
        user: req.user.username,
        total_records: results.length,
        data: results
      };

      fs.writeFileSync(filepath, JSON.stringify(backupData, null, 2));

      res.json({
        success: true,
        message: 'Backup created successfully',
        filename: filename,
        records: results.length,
        size: fs.statSync(filepath).size
      });
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
