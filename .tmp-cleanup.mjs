import fs from 'node:fs';
import pg from 'pg';

const url = fs.readFileSync('.env','utf-8').split(/\r?\n/).find(l => l.startsWith('DATABASE_URL=')).slice('DATABASE_URL='.length).trim();

const run = async (attempt) => {
  const pool = new pg.Pool({ connectionString: url, max: 1, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 });
  try {
    const before = await pool.query('select user_id from user_state order by user_id');
    console.log('before:', before.rowCount, JSON.stringify(before.rows.map(r => r.user_id)));
    await pool.query("delete from user_state where user_id like 'tg:900%' or user_id like 'dev:%'");
    await pool.query("delete from battles where creator_id like 'tg:900%' or opponent_id like 'tg:900%' or creator_id like 'dev:%' or opponent_id like 'dev:%'");
    for (const t of ['experiments','cycles','custom_metrics','notifications']) {
      await pool.query("delete from " + t + " where user_id like 'tg:900%' or user_id like 'dev:%'");
    }
    const after = await pool.query('select user_id from user_state order by user_id');
    const battles = await pool.query('select count(*)::int as n from battles');
    console.log('after:', after.rowCount, '| battles:', battles.rows[0].n);
    await pool.end();
    return true;
  } catch (e) {
    console.log('attempt', attempt, 'failed:', e.message);
    await pool.end().catch(() => {});
    if (attempt < 3) { await new Promise(r => setTimeout(r, 2500)); return run(attempt + 1); }
    return false;
  }
};

process.exit((await run(1)) ? 0 : 1);
