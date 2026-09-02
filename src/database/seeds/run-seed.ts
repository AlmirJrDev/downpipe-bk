/* eslint-disable no-console */
import { Client } from 'pg';
import { env } from '@/config/env';

/**
 * Seed apenas para ambiente de desenvolvimento. Como advertisements/
 * advertisers não têm endpoints de escrita nesta fase (gestão de anúncios
 * fica para um painel futuro), este script é a única forma de ter dados de
 * exemplo para testar GET /advertisements/active localmente.
 *
 * Uso: npm run seed
 */
async function run() {
  if (env.NODE_ENV === 'production') {
    throw new Error('Seed não deve ser executado em produção.');
  }

  if (!env.DATABASE_URL) {
    throw new Error('DATABASE_URL não configurada no .env');
  }

  const client = new Client({ connectionString: env.DATABASE_URL });
  await client.connect();

  try {
    const { rows: advertiserRows } = await client.query<{ id: string }>(
      `insert into advertisers (name, contact_email)
       values ('Oficina Turbo Shop', 'contato@turboshop.example.com')
       returning id`
    );
    const advertiserId = advertiserRows[0].id;

    await client.query(
      `insert into advertisements
         (advertiser_id, title, caption, image_url, cta_label, cta_url, status, starts_at, ends_at)
       values
         ($1, 'Kit de suspensão coilover com 15% off', 'Válido para os primeiros 50 pedidos do mês',
          'https://placehold.co/600x300?text=Turbo+Shop', 'Ver oferta',
          'https://turboshop.example.com/promo', 'active', now(), now() + interval '30 days'),
         ($1, 'Revisão completa de motor', 'Agende com desconto para membros Downpipe',
          'https://placehold.co/600x300?text=Revisao+Motor', 'Agendar',
          'https://turboshop.example.com/revisao', 'active', now(), now() + interval '30 days')`,
      [advertiserId]
    );

    console.log('✔ Seed de anúncios de desenvolvimento criado com sucesso.');
  } finally {
    await client.end();
  }
}

run().catch((err) => {
  console.error('❌ Falha ao rodar o seed:', err);
  process.exit(1);
});
