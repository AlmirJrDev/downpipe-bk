/* eslint-disable no-console */
import fs from 'node:fs';
import path from 'node:path';
import { Client } from 'pg';
import { env } from '@/config/env';

/**
 * Runner simples de migrations: aplica os arquivos .sql de
 * src/database/migrations em ordem alfabética, registrando os já
 * executados em uma tabela de controle (schema_migrations).
 *
 * Uso: npm run migrate
 * Requer DATABASE_URL apontando para o Postgres do projeto Supabase
 * (Settings > Database > Connection string, com a senha do projeto).
 */
async function run() {
  if (!env.DATABASE_URL) {
    throw new Error('DATABASE_URL não configurada no .env');
  }

  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  const client = new Client({ connectionString: env.DATABASE_URL });
  await client.connect();

  try {
    await client.query(`
      create table if not exists schema_migrations (
        name text primary key,
        applied_at timestamptz not null default timezone('utc', now())
      );
    `);

    const { rows: applied } = await client.query<{ name: string }>(
      'select name from schema_migrations'
    );
    const appliedNames = new Set(applied.map((row) => row.name));

    for (const file of files) {
      if (appliedNames.has(file)) {
        console.log(`↷ já aplicada: ${file}`);
        continue;
      }

      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
      console.log(`→ aplicando: ${file}`);

      await client.query('begin');
      try {
        await client.query(sql);
        await client.query('insert into schema_migrations (name) values ($1)', [file]);
        await client.query('commit');
        console.log(`✔ concluída: ${file}`);
      } catch (err) {
        await client.query('rollback');
        throw new Error(`Falha ao aplicar ${file}: ${(err as Error).message}`);
      }
    }

    console.log('Migrations concluídas com sucesso.');
  } finally {
    await client.end();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
