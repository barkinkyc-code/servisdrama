const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const usePostgres = Boolean(process.env.DATABASE_URL || process.env.POSTGRES_URL);
let db;
let readyPromise;

function pgSql(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => '$' + (++i));
}

async function seedUsersPg(pool) {
  /* Migration: eski 'suleyman' kullanıcı adını 'suleyman.kucuk' olarak düzelt (seed listesinden ÖNCE çalışmalı) */
  const oldUser = await pool.query(`SELECT id FROM users WHERE username = 'suleyman'`);
  if (oldUser.rowCount) {
    const dupe = await pool.query(`SELECT id FROM users WHERE username = 'suleyman.kucuk'`);
    if (dupe.rowCount) {
      /* 'suleyman.kucuk' zaten var (önceki hatalı çalıştırmadan kalmış) - eski 'suleyman' kaydını sil */
      await pool.query(`DELETE FROM users WHERE username = 'suleyman'`);
    } else {
      const newHash = await bcrypt.hash('1016', 10);
      await pool.query(
        `UPDATE users SET username = 'suleyman.kucuk', password = $1 WHERE username = 'suleyman'`,
        [newHash]
      );
    }
  }

  const users = [
    { username: 'barkin.kayaci', password: process.env.ADMIN_PASSWORD || '1452580000', name: 'Barkın Kayacı', email: 'barkin.kayaci@dramamakine.com', role: 'admin' },
    { username: 'semih.aglan', password: '1015', name: 'Semih Ağlan', email: 'semih.aglan@dramamakine.com', role: 'tech' },
    { username: 'suleyman.kucuk', password: '1016', name: 'Süleyman Küçük', email: 'suleyman.kucuk@dramamakine.com', role: 'tech' }
  ];
  for (const user of users) {
    const hash = await bcrypt.hash(user.password, 10);
    await pool.query(
      `INSERT INTO users (username,password,name,email,role)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (username) DO NOTHING`,
      [user.username, hash, user.name, user.email, user.role]
    );
  }
}

async function seedStatePg(pool) {
  const found = await pool.query("SELECT state_key FROM app_state WHERE state_key='main'");
  if (found.rowCount) return;
  let initial = {};
  try { initial = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'initial-state.json'), 'utf8')); } catch (_) {}
  await pool.query(
    `INSERT INTO app_state (state_key, payload, updated_at)
     VALUES ('main', $1::jsonb, NOW())
     ON CONFLICT (state_key) DO NOTHING`,
    [JSON.stringify(initial)]
  );
}

if (usePostgres) {
  const { Pool } = require('pg');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
  });

  readyPromise = (async () => {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id BIGSERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        name TEXT NOT NULL,
        email TEXT,
        role TEXT DEFAULT 'tech',
        status TEXT DEFAULT 'active',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS app_state (
        state_key TEXT PRIMARY KEY,
        payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        updated_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS email_logs (
        id BIGSERIAL PRIMARY KEY,
        report_date DATE,
        recipients TEXT,
        status TEXT NOT NULL,
        provider_message_id TEXT,
        error_message TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await seedUsersPg(pool);
    await seedStatePg(pool);
    console.log('✅ PostgreSQL connected and initialized');
  })();

  db = {
    dialect: 'postgres',
    ready: () => readyPromise,
    raw: pool,
    query(sql, params, callback) {
      if (typeof params === 'function') { callback = params; params = []; }
      const promise = readyPromise.then(() => pool.query(pgSql(sql), params || [])).then(result => {
        const rows = result.rows || [];
        rows.insertId = rows[0] && (rows[0].id || rows[0].insert_id);
        rows.affectedRows = result.rowCount;
        return rows;
      });
      if (callback) promise.then(rows => callback(null, rows)).catch(err => callback(err));
      return promise;
    },
    all(sql, params, callback) { return this.query(sql, params, callback); },
    get(sql, params, callback) {
      if (typeof params === 'function') { callback = params; params = []; }
      return this.query(sql, params).then(rows => { const row = rows[0]; if (callback) callback(null, row); return row; }).catch(err => { if (callback) callback(err); else throw err; });
    },
    run(sql, params, callback) {
      if (typeof params === 'function') { callback = params; params = []; }
      return readyPromise.then(() => pool.query(pgSql(sql), params || [])).then(result => {
        const ctx = { lastID: result.rows?.[0]?.id, changes: result.rowCount, affectedRows: result.rowCount };
        if (callback) callback.call(ctx, null);
        return ctx;
      }).catch(err => { if (callback) callback(err); else throw err; });
    }
  };
} else {
  const sqlite3 = require('sqlite3').verbose();
  const os = require('os');
  const dbPath = process.env.VERCEL ? path.join(os.tmpdir(), 'servisdrama.db') : path.join(__dirname, '..', 'servisdrama.db');
  const sqlite = new sqlite3.Database(dbPath);
  readyPromise = new Promise((resolve, reject) => {
    sqlite.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL,
        name TEXT NOT NULL, email TEXT, role TEXT DEFAULT 'tech', status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS app_state (
        state_key TEXT PRIMARY KEY, payload TEXT NOT NULL DEFAULT '{}', updated_by INTEGER,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS email_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT, report_date TEXT, recipients TEXT, status TEXT NOT NULL,
        provider_message_id TEXT, error_message TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `, async err => {
      if (err) return reject(err);
      try {
        /* Migration: eski 'suleyman' kullanıcı adını 'suleyman.kucuk' olarak düzelt (seed listesinden ÖNCE çalışmalı) */
        const oldRow = await new Promise((res,rej) => sqlite.get("SELECT id FROM users WHERE username='suleyman'", [], (e,row) => e?rej(e):res(row)));
        if (oldRow) {
          const dupeRow = await new Promise((res,rej) => sqlite.get("SELECT id FROM users WHERE username='suleyman.kucuk'", [], (e,row) => e?rej(e):res(row)));
          if (dupeRow) {
            await new Promise((res,rej) => sqlite.run("DELETE FROM users WHERE username='suleyman'", [], e => e?rej(e):res()));
          } else {
            const oldHash = await bcrypt.hash('1016', 10);
            await new Promise((res,rej) => sqlite.run("UPDATE users SET username='suleyman.kucuk', password=? WHERE username='suleyman'", [oldHash], e => e?rej(e):res()));
          }
        }

        const users = [
          ['barkin.kayaci', process.env.ADMIN_PASSWORD || '1452580000', 'Barkın Kayacı', 'barkin.kayaci@dramamakine.com', 'admin'],
          ['semih.aglan', '1015', 'Semih Ağlan', 'semih.aglan@dramamakine.com', 'tech'],
          ['suleyman.kucuk', '1016', 'Süleyman Küçük', 'suleyman.kucuk@dramamakine.com', 'tech']
        ];
        for (const u of users) {
          const hash = await bcrypt.hash(u[1], 10);
          await new Promise(r => sqlite.run('INSERT OR IGNORE INTO users (username,password,name,email,role) VALUES (?,?,?,?,?)',[u[0],hash,u[2],u[3],u[4]],()=>r()));
        }
        const initial = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'initial-state.json'),'utf8'));
        sqlite.run("INSERT OR IGNORE INTO app_state (state_key,payload) VALUES ('main',?)",[JSON.stringify(initial)],()=>resolve());
      } catch(e){ reject(e); }
    });
  });
  sqlite.ready = () => readyPromise;
  sqlite.dialect = 'sqlite';
  const origAll = sqlite.all.bind(sqlite);
  sqlite.query = function(sql, params, callback){
    if(typeof params==='function'){callback=params;params=[];}
    const promise = readyPromise.then(() => new Promise((resolve,reject) => {
      origAll(sql,params||[],function(err,rows){
        if(err)return reject(err);
        rows=rows||[];rows.affectedRows=this&&this.changes?this.changes:0;resolve(rows);
      });
    }));
    if(callback)promise.then(rows=>callback(null,rows)).catch(err=>callback(err));
    return promise;
  };
  db = sqlite;
}

module.exports = db;
