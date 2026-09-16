/* eslint-disable no-console */
import fs from 'node:fs';
import path from 'node:path';
import { supabaseAdmin } from '@/config/supabase';

/**
 * Gestão de anúncios pela linha de comando.
 *
 * A tabela `advertisements` existe desde a migration 0010 e o app já sabe
 * intercalar o que estiver lá no feed, mas nunca houve como criar uma linha:
 * não existe painel de anunciante, e as policies de RLS só permitem escrita
 * pelo service role — ou seja, daqui de dentro do backend. Este arquivo é
 * esse "daqui de dentro".
 *
 * Uso:
 *   npm run ads
 *   npm run ads -- novo --anunciante "Downpipe" --titulo "Meu outro app" \
 *                       --texto "Descrição curta" --botao "BAIXAR" \
 *                       --link "https://play.google.com/..." \
 *                       --imagem ./banner.png
 *   npm run ads -- ativar <id>
 *   npm run ads -- pausar <id>
 *   npm run ads -- remover <id>
 *
 * `--imagem` aceita tanto um arquivo local (que sobe pro Storage) quanto uma
 * URL que já esteja no ar.
 */

const BUCKET = 'ads';
const TIPOS: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

/** `--chave valor` vira `{ chave: valor }`. Flags desconhecidas explodem cedo. */
function lerArgumentos(args: string[], permitidas: string[]): Record<string, string> {
  const saida: Record<string, string> = {};
  for (let i = 0; i < args.length; i += 2) {
    const chave = args[i];
    if (!chave.startsWith('--')) throw new Error(`esperava uma flag --alguma-coisa, veio "${chave}"`);
    const nome = chave.slice(2);
    if (!permitidas.includes(nome)) {
      throw new Error(`flag desconhecida: --${nome} (aceito: ${permitidas.map((p) => `--${p}`).join(', ')})`);
    }
    const valor = args[i + 1];
    if (valor === undefined) throw new Error(`--${nome} veio sem valor`);
    saida[nome] = valor;
  }
  return saida;
}

/**
 * Sobe a imagem pro Storage e devolve a URL pública. O bucket é criado na
 * primeira vez — público, porque a imagem do anúncio aparece pra qualquer um
 * que abrir o feed, inclusive deslogado.
 */
async function subirImagem(caminho: string): Promise<string> {
  if (/^https?:\/\//i.test(caminho)) return caminho;

  const absoluto = path.resolve(caminho);
  if (!fs.existsSync(absoluto)) throw new Error(`imagem não encontrada: ${absoluto}`);

  const extensao = path.extname(absoluto).toLowerCase();
  const tipo = TIPOS[extensao];
  if (!tipo) throw new Error(`formato não suportado: ${extensao} (use png, jpg ou webp)`);

  const { data: buckets, error: erroLista } = await supabaseAdmin.storage.listBuckets();
  if (erroLista) throw erroLista;

  if (!buckets.some((b) => b.name === BUCKET)) {
    const { error } = await supabaseAdmin.storage.createBucket(BUCKET, { public: true });
    if (error) throw error;
    console.log(`Bucket "${BUCKET}" criado.`);
  }

  const destino = `${Date.now()}-${path.basename(absoluto).replace(/[^\w.-]/g, '_')}`;
  const { error } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(destino, fs.readFileSync(absoluto), {
      contentType: tipo,
      upsert: false,
      // Mesmo um ano do storage.service: o nome carrega a data e não se repete.
      cacheControl: String(60 * 60 * 24 * 365),
    });
  if (error) throw error;

  const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(destino);
  return data.publicUrl;
}

async function listar() {
  const { data, error } = await supabaseAdmin
    .from('advertisements')
    .select('id, title, status, cta_url, starts_at, ends_at, advertisers ( name )')
    .order('created_at', { ascending: false });
  if (error) throw error;

  if (!data || data.length === 0) {
    console.log('Nenhum anúncio cadastrado. Crie um com: npm run ads -- novo --help');
    return;
  }

  for (const ad of data) {
    // O join do supabase-js tipa a relacao como array mesmo quando e um-pra-um.
    const relacao = ad.advertisers as unknown as { name: string } | { name: string }[] | null;
    const anunciante = (Array.isArray(relacao) ? relacao[0]?.name : relacao?.name) ?? '—';
    console.log(`${ad.status.padEnd(8)} ${ad.id}  ${ad.title}  [${anunciante}]`);
    console.log(`         ${ad.cta_url ?? 'sem link'}`);
  }
  console.log(`\n${data.length} anúncio(s). Só os "active" aparecem no feed.`);
}

async function criar(args: string[]) {
  const flags = lerArgumentos(args, ['anunciante', 'titulo', 'texto', 'botao', 'link', 'imagem', 'ativo']);

  for (const obrigatoria of ['anunciante', 'titulo']) {
    if (!flags[obrigatoria]) throw new Error(`--${obrigatoria} é obrigatório`);
  }

  // Um anunciante por nome: rodar o comando de novo pro mesmo app reaproveita
  // o registro em vez de criar um duplicado.
  const { data: existente, error: erroBusca } = await supabaseAdmin
    .from('advertisers')
    .select('id')
    .eq('name', flags.anunciante)
    .maybeSingle();
  if (erroBusca) throw erroBusca;

  let anuncianteId = existente?.id;
  if (!anuncianteId) {
    const { data, error } = await supabaseAdmin
      .from('advertisers')
      .insert({ name: flags.anunciante })
      .select('id')
      .single();
    if (error) throw error;
    anuncianteId = data.id;
    console.log(`Anunciante "${flags.anunciante}" criado.`);
  }

  const imagemUrl = flags.imagem ? await subirImagem(flags.imagem) : null;

  // Nasce como rascunho por padrão: assim dá pra conferir o texto e a imagem
  // com `npm run ads` antes de o anúncio aparecer pra quem está usando o app.
  const status = flags.ativo === 'sim' ? 'active' : 'draft';

  const { data, error } = await supabaseAdmin
    .from('advertisements')
    .insert({
      advertiser_id: anuncianteId,
      title: flags.titulo,
      caption: flags.texto ?? null,
      image_url: imagemUrl,
      cta_label: flags.botao ?? null,
      cta_url: flags.link ?? null,
      status,
    })
    .select('id')
    .single();
  if (error) throw error;

  console.log(`Anúncio criado: ${data.id} (${status})`);
  if (imagemUrl) console.log(`Imagem: ${imagemUrl}`);
  if (status === 'draft') console.log(`Pra colocar no ar: npm run ads -- ativar ${data.id}`);
}

async function mudarStatus(id: string, status: 'active' | 'paused') {
  if (!id) throw new Error('faltou o id do anúncio');
  const { error } = await supabaseAdmin.from('advertisements').update({ status }).eq('id', id);
  if (error) throw error;
  console.log(`Anúncio ${id} agora está "${status}".`);
}

async function remover(id: string) {
  if (!id) throw new Error('faltou o id do anúncio');
  const { error } = await supabaseAdmin.from('advertisements').delete().eq('id', id);
  if (error) throw error;
  console.log(`Anúncio ${id} removido.`);
}

async function main() {
  const [comando, ...resto] = process.argv.slice(2);

  switch (comando) {
    case undefined:
    case 'listar':
      return listar();
    case 'novo':
      return criar(resto);
    case 'ativar':
      return mudarStatus(resto[0], 'active');
    case 'pausar':
      return mudarStatus(resto[0], 'paused');
    case 'remover':
      return remover(resto[0]);
    default:
      throw new Error(`comando desconhecido: "${comando}" (use listar, novo, ativar, pausar ou remover)`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
