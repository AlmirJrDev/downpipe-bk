/* eslint-disable no-console */
import { supabaseAdmin } from '@/config/supabase';
import { env } from '@/config/env';
import { profilesService } from '@/modules/profiles/profiles.service';
import { moderationService } from './moderation.service';

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
 *   npm run moderar -- apagar-mensagem <id>    mensagem do chat de um rolê
 *   npm run moderar -- excluir-conta <@>       exclusão pedida por e-mail
 *   npm run moderar -- admin                   quem recebe os avisos
 *   npm run moderar -- admin <@>               adiciona
 *   npm run moderar -- admin remover <@>
 *
 * Apagar um post ou comentário leva junto as denúncias dele (cascade no
 * banco), então não precisa revisar uma por uma depois.
 *
 * A mesma fila, com os mesmos botões, agora também vive no app em
 * /app/moderacao pra quem está na tabela `admins`.
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
  const denuncias = await moderationService.fila('open');

  if (denuncias.length === 0) {
    console.log('Nenhuma denúncia aberta.');
    return;
  }

  for (const d of denuncias) {
    console.log(`
${d.id}`);
    console.log(`  ${new Date(d.createdAt).toLocaleString('pt-BR')} · ${d.reason} · por @${d.reporter ?? '?'}`);
    console.log(`  alvo: ${d.target.rotulo} (${d.target.id})`);
    if (d.target.texto) console.log(`  texto: "${d.target.texto}"`);
    if (d.details) console.log(`  detalhe: "${d.details}"`);
    console.log(`  ver: ${BASE}${d.target.url}`);
  }
  console.log(`
${denuncias.length} denúncia(s) aberta(s).`);
}

async function revisar(id: string) {
  if (!id) throw new Error('faltou o id da denúncia');
  await moderationService.revisar(id);
  console.log(`Denúncia ${id} revisada.`);
}

async function apagarPost(id: string) {
  if (!id) throw new Error('faltou o id do post');
  await moderationService.apagarConteudo('post', id);
  console.log(`Post ${id} apagado, com as fotos e as denúncias dele.`);
}

async function apagarMensagem(id: string) {
  if (!id) throw new Error('faltou o id da mensagem');
  await moderationService.apagarConteudo('mensagem', id);
  console.log(`Mensagem ${id} apagada do chat, e as denúncias dela marcadas como revisadas.`);
}

async function apagarComentario(id: string) {
  if (!id) throw new Error('faltou o id do comentário');
  await moderationService.apagarConteudo('comentario', id);
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
    case 'apagar-mensagem':
      return apagarMensagem(resto[0]);
    case 'apagar-comentario':
      return apagarComentario(resto[0]);
    case 'excluir-conta':
      return excluirConta(resto[0]);
    case 'admin':
      return admin(resto);
    default:
      throw new Error(
        `comando desconhecido: "${comando}" (use fila, revisar, apagar-post, apagar-comentario, apagar-mensagem, excluir-conta ou admin)`
      );
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
