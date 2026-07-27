const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'servisdrama.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Database connection error:', err);
  } else {
    console.log('✅ SQLite Database Connected');
    initializeDatabase();
  }
});

// Enable foreign keys
db.run('PRAGMA foreign_keys = ON');

// Wrapper for query method to match MySQL2 interface
const originalRun = db.run.bind(db);
db.query = function(sql, params, callback) {
  if (typeof params === 'function') {
    callback = params;
    params = [];
  }

  this.all(sql, params, function(err, rows) {
    if (callback) {
      callback(err, rows || []);
    }
  });
};

// Initialize database tables
function initializeDatabase() {
  const schema = `
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      email TEXT,
      role TEXT DEFAULT 'tech',
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS device_data (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      device_id TEXT,
      device_name TEXT,
      attack_type TEXT,
      severity TEXT DEFAULT 'Medium',
      location TEXT,
      ip_address TEXT,
      port INTEGER,
      payload TEXT,
      status TEXT DEFAULT 'pending',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      action TEXT,
      details TEXT,
      ip_address TEXT,
      user_agent TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS backup_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      backup_type TEXT DEFAULT 'json',
      filename TEXT,
      file_size INTEGER,
      record_count INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `;

  db.exec(schema, (err) => {
    if (err) {
      console.error('Schema creation error:', err);
    } else {
      insertDefaultUsers();
    }
  });
}

// Insert default users
function insertDefaultUsers() {
  const bcrypt = require('bcryptjs');

  db.get("SELECT COUNT(*) as count FROM users", (err, row) => {
    if (err || row.count > 0) return; // Already has users

    const users = [
      { username: 'barkin.kayaci', password: '1452580000', name: 'Barkın Kayacı', email: 'barkin@dramagroup.com', role: 'admin' },
      { username: 'semih.aglan', password: '1015', name: 'Semih Ağlan', email: 'semih@dramagroup.com', role: 'tech' },
      { username: 'suleyman', password: '1016', name: 'Süleyman Küçük', email: 'suleyman@dramagroup.com', role: 'tech' }
    ];

    users.forEach(user => {
      bcrypt.hash(user.password, 10, (err, hashedPassword) => {
        db.run(
          'INSERT INTO users (username, password, name, email, role) VALUES (?, ?, ?, ?, ?)',
          [user.username, hashedPassword, user.name, user.email, user.role],
          (err) => {
            if (!err) console.log(`✅ User created: ${user.username}`);
          }
        );
      });
    });
  });
}

module.exports = db;
