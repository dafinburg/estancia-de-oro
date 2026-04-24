#!/usr/bin/env node
// Borra TODAS las tablas de la database (útil para rearmar limpio tras error)
import { readFileSync, existsSync } from 'node:fs';

const ENV_FILE = '.env.local.baserow';
if (existsSync(ENV_FILE)) {
  const lines = readFileSync(ENV_FILE, 'utf-8').split('\n');
  for (const line of lines) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}

const URL_BASE = process.env.BASEROW_URL;
const USER = process.env.BASEROW_USER;
const PASS = process.env.BASEROW_PASSWORD;
const DB = parseInt(process.env.BASEROW_DATABASE_ID, 10);

const login = await fetch(`${URL_BASE}/api/user/token-auth/`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: USER, password: PASS }),
}).then(r => r.json());
const JWT = login.token;
console.log('✓ Login');

const tables = await fetch(`${URL_BASE}/api/database/tables/database/${DB}/`, {
  headers: { Authorization: `JWT ${JWT}` },
}).then(r => r.json());

for (const t of tables) {
  const r = await fetch(`${URL_BASE}/api/database/tables/${t.id}/`, {
    method: 'DELETE',
    headers: { Authorization: `JWT ${JWT}` },
  });
  console.log(`${r.ok ? '✓' : '✗'} borré "${t.name}" (id=${t.id})`);
}
