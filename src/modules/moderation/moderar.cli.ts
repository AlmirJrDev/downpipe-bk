/* eslint-disable no-console */
import { supabaseAdmin } from '@/config/supabase';
import { env } from '@/config/env';
import { storageService } from '@/shared/storage/storage.service';
import { STORAGE_BUCKETS } from '@/shared/storage/storage.constants';
import { profilesService } from '@/modules/profiles/profiles.service';
import { moderationRepository } from './moderation.repository';

/**
 * Moderação pela linha de comando.
 *
 * Denúncia chega como push no celular de quem está na tabela `admins`; é
 * daqui que se olha a fila e se age. Mesmo raciocínio do `npm run ads`: não
 * existe painel, e escrever nessas tabelas só é permitido ao service role.
 *
 * Uso:
 *   npm run moderar                            fila de denúncias abertas
 *   npm run moderar -- revisar <id>            tira a denúncia da fila
 *   npm run moderar -- apagar-post <id>        apaga o post e as fotos
 *   npm run moderar -- apagar-comentario <id>
 *   npm run moderar -- excluir-conta <@>       exclusão pedida por e-mail
 *   npm run moderar -- admin                   quem recebe os avisos
 *   npm run moderar -- admin <@>               adiciona
 *   npm run moderar -- admin remover <@>
 *
 * Apagar um post ou comentário leva junto as denúncias dele (cascade no
 * banco), então não precisa revisar uma por uma depois.
 */

const BASE = env.APP_URL ?? 'https://downpipe.onrender.com';

async function perfilPorUsername(entrada: string) {
  const username = entrada.replace(/^@/, '');
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, username')
    .eq('username', username)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`nenhuma conta com o @${username}`);
  return data;
}

async function fila() {
  const { data, error } = await supabaseAdmin
    .from('reports')
    .select('id, reason, details, created_at, post_id, comment_id, profile_id, profiles!reports_reporter_id_fkey ( username )')
    .eq('status', 'open')
    .order('created_at', { ascending: true });
  if (error) throw error;

  if (!data || data.length === 0) {
    console.log('Nenhuma denúncia aberta.');
    return;
  }

  for (const r of data) {
    const alvo = await moderationRepository.describeTarget({
      postId: r.post_id ?? undefined,
      commentId: r.comment_id ?? undefined,
      profileId: r.profile_id ?? undefined,
      reason: r.reason,
    });
    const quem = (r.profiles as unknown as { username: string } | null)?.username ?? '?';
    const idAlvo = r.post_id ?? r.comment_id ?? r.profile_id;

    console.log(`\n${r.id}`);
    console.log(`  ${new Date(r.created_at).toLocaleString('pt-BR')} · ${r.reason} · por @${quem}`);
    console.log(`  alvo: ${alvo.rotulo} (${idAlvo})`);
    if (r.comment_id) {
      const { data: c } = await supabaseAdmin.from('comments').select('text').eq('id', r.comment_id).maybeSingle();
      if (c) console.log(`  comentário: "${c.text}"`);
    }
    if (r.details) console.log(`  detalhe: "${r.details}"`);
    console.log(`  ver: ${BASE}${alvo.url}`);
  }
  console.log(`\n${data.length} denúncia(s) aberta(s).`);
}

async function revisar(id: string) {
  if (!id) throw new Error('faltou o id da denúncia');
  const { data, error } = await supabaseAdmin.from('reports').update({ status: 'reviewed' }).eq('id', id).select('id');
  if (error) throw error;
  if (!data?.length) throw new Error(`denúncia ${id} não encontrada`);
  console.log(`Denúncia ${id} revisada.`);
}

async function apagarPost(id: string) {
  if (!id) throw new Error('faltou o id do post');
  const { data: midias, error } = await supabaseAdmin.from('post_media').select('media_url').eq('post_id', id);
  if (error) throw error;

  // Fotos primeiro, mesma lógica do postsService.remove — só sem a checagem
  // de dono, que aqui é justamente o que a moderação precisa pular.
  for (const m of midias ?? []) {
    const caminho = storageService.extractPathFromPublicUrl(STORAGE_BUCKETS.POSTS, m.media_url);
    if (caminho) await storageService.deleteImage(STORAGE_BUCKETS.POSTS, caminho);
  }

  const { data, error: erroPost } = await supabaseAdmin.from('posts').delete().eq('id', id).select('id');
  if (erroPost) throw erroPost;
  if (!data?.length) throw new Error(`post ${id} não encontrado`);
  console.log(`Post ${id} apagado, com ${midias?.length ?? 0} foto(s) e as denúncias dele.`);
}

async function apagarComentario(id: string) {
  if (!id) throw new Error('faltou o id do comentário');
  const { data, error } = await supabaseAdmin.from('comments').delete().eq('id', id).select('id');
  if (error) throw error;
  if (!data?.length) throw new Error(`comentário ${id} não encontrado`);
  console.log(`Comentário ${id} apagado, com as denúncias dele.`);
}

async function excluirConta(entrada: string) {
  if (!entrada) throw new Error('faltou o @ da conta');
  const perfil = await perfilPorUsername(entrada);
  // O mesmo caminho do botão do app: fotos do Storage, depois a conta.
  await profilesService.deleteMe(perfil.id, perfil.username);
  console.log(`Conta @${perfil.username} excluída, com fotos e dados.`);
}

async function admin(args: string[]) {
  if (args.length === 0) {
    const { data, error } = await supabaseAdmin.from('admins').select('profiles ( username )');
    if (error) throw error;
    if (!data?.length) {
      console.log('Ninguém recebe os avisos de denúncia. Adicione com: npm run moderar -- admin <@>');
      return;
    }
    for (const linha of data) {
      console.log(`@${(linha.profiles as unknown as { username: string }).username}`);
    }
    return;
  }

  if (args[0] === 'remover') {
    const perfil = await perfilPorUsername(args[1] ?? '');
    const { error } = await supabaseAdmin.from('admins').delete().eq('user_id', perfil.id);
    if (error) throw error;
    console.log(`@${perfil.username} não recebe mais os avisos.`);
    return;
  }

  const perfil = await perfilPorUsername(args[0]);
  const { error } = await supabaseAdmin.from('admins').upsert({ user_id: perfil.id });
  if (error) throw error;
  console.log(`@${perfil.username} agora recebe os avisos de denúncia.`);
  console.log('O aviso chega por push: a conta precisa ter as notificações ativadas no app.');
}

async function main() {
  const [comando, ...resto] = process.argv.slice(2);

  switch (comando) {
    case undefined:
    case 'fila':
      return fila();
    case 'revisar':
      return revisar(resto[0]);
    case 'apagar-post':
      return apagarPost(resto[0]);
    case 'apagar-comentario':
      return apagarComentario(resto[0]);
    case 'excluir-conta':
      return excluirConta(resto[0]);
    case 'admin':
      return admin(resto);
    default:
      throw new Error(
        `comando desconhecido: "${comando}" (use fila, revisar, apagar-post, apagar-comentario, excluir-conta ou admin)`
      );
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
