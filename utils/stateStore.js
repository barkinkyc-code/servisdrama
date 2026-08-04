const db = require('../config/database');

function clone(value, fallback = {}) {
  try { return JSON.parse(JSON.stringify(value)); } catch (_) { return fallback; }
}

async function readState() {
  await db.ready();
  if (db.dialect === 'postgres') {
    const r = await db.raw.query("SELECT payload,updated_at FROM app_state WHERE state_key='main'");
    return { state: r.rows[0]?.payload || {}, updatedAt: r.rows[0]?.updated_at || null };
  }
  return await new Promise((resolve, reject) => db.get(
    "SELECT payload,updated_at FROM app_state WHERE state_key='main'", [],
    (e, row) => e ? reject(e) : resolve({ state: row ? JSON.parse(row.payload || '{}') : {}, updatedAt: row?.updated_at || null })
  ));
}

async function mutateState(mutator, userId = null) {
  await db.ready();
  if (db.dialect === 'postgres') {
    const client = await db.raw.connect();
    try {
      await client.query('BEGIN');
      await client.query("INSERT INTO app_state(state_key,payload,updated_at) VALUES('main','{}'::jsonb,NOW()) ON CONFLICT(state_key) DO NOTHING");
      const locked = await client.query("SELECT payload FROM app_state WHERE state_key='main' FOR UPDATE");
      const state = clone(locked.rows[0]?.payload || {}, {});
      const result = await mutator(state, client);
      await client.query(
        `UPDATE app_state SET payload=$1::jsonb,updated_by=$2,updated_at=NOW() WHERE state_key='main'`,
        [JSON.stringify(state), userId]
      );
      await client.query('COMMIT');
      return result;
    } catch (err) {
      try { await client.query('ROLLBACK'); } catch (_) {}
      throw err;
    } finally { client.release(); }
  }

  await new Promise((resolve, reject) => db.run('BEGIN IMMEDIATE', e => e ? reject(e) : resolve()));
  try {
    const row = await new Promise((resolve, reject) => db.get("SELECT payload FROM app_state WHERE state_key='main'", [], (e, r) => e ? reject(e) : resolve(r)));
    const state = row?.payload ? clone(JSON.parse(row.payload), {}) : {};
    const result = await mutator(state, db);
    await new Promise((resolve, reject) => db.run(
      "INSERT OR REPLACE INTO app_state(state_key,payload,updated_by,updated_at) VALUES('main',?,?,CURRENT_TIMESTAMP)",
      [JSON.stringify(state), userId], e => e ? reject(e) : resolve()
    ));
    await new Promise((resolve, reject) => db.run('COMMIT', e => e ? reject(e) : resolve()));
    return result;
  } catch (err) {
    try { await new Promise(resolve => db.run('ROLLBACK', () => resolve())); } catch (_) {}
    throw err;
  }
}

module.exports = { readState, mutateState, clone };
