/* eslint-disable no-console */
import fs from 'node:fs';
import { supabaseAdmin } from '@/config/supabase';
import { eventSuggestionsService } from './event-suggestions.service';
import { createSuggestionSchema } from './event-suggestions.schema';
import { linksDeEncontro } from './links';

/**
 * Fila de rolês pela linha de comando.
 *
 * É por aqui que uma caçada na web vira sugestão dentro do app: um arquivo
 * JSON com o que se achou, cada item com a fonte, e o `importar` joga tudo na
 * fila sem publicar nada. Publicar continua sendo decisão de gente.
 *
 * Uso:
 *   npm run roles                          a fila pendente
 *   npm run roles -- importar <arquivo>    joga um JSON de sugestões na fila
 *   npm run roles -- aprovar <id>          vira rolê de verdade
 *   npm run roles -- descartar <id>
 *   npm run roles -- links                 a caixa de links que a equipe colou no app
 *   npm run roles -- link-descartar <id> [motivo]
 *
 * No arquivo do importar, um item pode trazer "linkId": o link da caixa
 * que ele lançou fica marcado como lançado, ligado à sugestão.
 *
 * O formato do arquivo é uma lista dos mesmos campos que a API aceita:
 *   [{ "name": "...", "startsAt": "2026-10-18T12:00:00.000Z", "location": "...",
 *      "city": "...", "sourceUrl": "https://...", "sourceNote": "visto em ..." }]
 */

async function admin(): Promise<string> {
  const { data, error } = await supabaseAdmin.from('admins').select('user_id').limit(1);
  if (error) throw error;
  const id = data?.[0]?.user_id;
  if (!id) throw new Error('nenhum moderador cadastrado — use npm run moderar -- admin <@>');
  return id;
}

async function fila() {
  const pendentes = await eventSuggestionsService.fila('pending');
  if (pendentes.length === 0) {
    console.log('Fila vazia.');
    return;
  }

  for (const s of pendentes) {
    console.log(`\n${s.id}`);
    console.log(`  ${s.name}`);
    const quando = s.startsAt ? new Date(s.startsAt).toLocaleString('pt-BR') : 'sem data';
    console.log(`  ${quando} · ${s.location ?? 'sem local'} — ${s.city ?? 'sem cidade'}`);
    if (s.entryNote) console.log(`  entrada: ${s.entryNote}`);
    if (s.organizerInstagram) console.log(`  organiza: @${s.organizerInstagram}`);
    if (s.attractions.length) console.log(`  tem: ${s.attractions.join(', ')}`);
    if (s.rules.length) console.log(`  não pode: ${s.rules.join(', ')}`);
    console.log(`  fonte: ${s.sourceNote ?? s.source}${s.sourceUrl ? ` — ${s.sourceUrl}` : ''}`);
    if (s.suggestedBy) console.log(`  sugerido por @${s.suggestedBy}`);
  }
  console.log(`\n${pendentes.length} sugestão(ões) esperando.`);
}

async function importar(arquivo: string) {
  if (!arquivo) throw new Error('faltou o arquivo: npm run roles -- importar sugestoes.json');

  const bruto = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
  const lista = Array.isArray(bruto) ? bruto : [bruto];

  let novas = 0;
  let repetidas = 0;
  for (const item of lista) {
    const { linkId, ...campos } = item as { linkId?: string };
    const entrada = createSuggestionSchema.parse(campos);
    const criada = await eventSuggestionsService.registrarDaWeb(entrada);
    if (criada) {
      novas += 1;
      console.log(`+ ${entrada.name}`);
      if (linkId) await linksDeEncontro.marcar(linkId, 'lancado', criada.id);
    } else {
      repetidas += 1;
      console.log(`· ${entrada.name} (já estava na fila)`);
    }
  }
  console.log(`\n${novas} nova(s), ${repetidas} repetida(s).`);
}

async function aprovar(id: string) {
  if (!id) throw new Error('faltou o id da sugestão');

  const sugestao = (await eventSuggestionsService.fila('pending')).find((s) => s.id === id);
  if (!sugestao) throw new Error(`sugestão ${id} não está na fila`);
  if (!sugestao.startsAt || !sugestao.location || !sugestao.city) {
    throw new Error(
      'esta sugestão está sem data, local ou cidade — complete pelo app antes de aprovar'
    );
  }

  const { eventId } = await eventSuggestionsService.aprovar(id, await admin(), {
    startsAt: sugestao.startsAt,
    location: sugestao.location,
    city: sugestao.city,
  });
  console.log(`Encontro publicado: ${eventId}`);
}

async function descartar(id: string) {
  if (!id) throw new Error('faltou o id da sugestão');
  await eventSuggestionsService.descartar(id, await admin());
  console.log('Sugestão descartada.');
}

async function links() {
  const novos = await linksDeEncontro.listar('novo');
  if (novos.length === 0) {
    console.log('Caixa de links vazia.');
    return;
  }
  for (const l of novos) {
    console.log(`
${l.id}
  ${l.url}${l.note ? `
  nota: ${l.note}` : ''}`);
  }
  console.log(`
${novos.length} link(s) pra lançar.`);
}

async function main() {
  const [comando, ...resto] = process.argv.slice(2);

  switch (comando ?? 'fila') {
    case 'fila':
      return fila();
    case 'importar':
      return importar(resto[0]);
    case 'aprovar':
      return aprovar(resto[0]);
    case 'descartar':
      return descartar(resto[0]);
    case 'links':
      return links();
    case 'link-descartar':
      if (!resto[0]) throw new Error('faltou o id do link');
      await linksDeEncontro.marcar(resto[0], 'descartado', undefined, resto.slice(1).join(' ') || undefined);
      console.log('Link descartado.');
      return;
    default:
      throw new Error(`comando desconhecido: "${comando}" (use fila, importar, aprovar, descartar, links ou link-descartar)`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
