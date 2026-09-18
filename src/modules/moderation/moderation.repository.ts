import { supabaseAdmin } from '@/config/supabase';
import { CreateReportInput } from './moderation.schema';

export const moderationRepository = {
  /** Devolve false quando a pessoa já tinha denunciado este mesmo alvo. */
  async createReport(reporterId: string, input: CreateReportInput): Promise<boolean> {
    const { error } = await supabaseAdmin.from('reports').insert({
      reporter_id: reporterId,
      post_id: input.postId ?? null,
      comment_id: input.commentId ?? null,
      profile_id: input.profileId ?? null,
      message_id: input.messageId ?? null,
      reason: input.reason,
      details: input.details ?? null,
    });

    // 23505 = índice único: a pessoa já denunciou este alvo. Não é erro pra
    // ela, e repetir a denúncia não muda nada — o service trata como sucesso.
    if (error && error.code !== '23505') throw error;
    return !error;
  },

  /**
   * O alvo de uma denúncia em forma de gente: um rótulo curto pro aviso e o
   * caminho da tela que mostra o conteúdo. Alvo que já sumiu (apagado entre a
   * denúncia e o aviso) ainda devolve algo utilizável, só sem link útil.
   */
  async describeTarget(input: CreateReportInput): Promise<{ rotulo: string; url: string }> {
    if (input.profileId) {
      const { data } = await supabaseAdmin
        .from('profiles')
        .select('username')
        .eq('id', input.profileId)
        .maybeSingle();
      // Sem username, o perfil já não existe: manda pra home em vez de um
      // endereço de perfil vazio, que abriria a tela de "não encontrado".
      return {
        rotulo: data?.username ? `perfil @${data.username}` : 'perfil já removido',
        url: data?.username ? `/app/user/${data.username}` : '/app',
      };
    }

    if (input.messageId) {
      const { data } = await supabaseAdmin
        .from('event_messages')
        .select('event_id, events ( name ), profiles ( username )')
        .eq('id', input.messageId)
        .maybeSingle();
      const evento = (data?.events as unknown as { name: string } | null)?.name;
      const autor = (data?.profiles as unknown as { username: string } | null)?.username;
      // O link é o do rolê, não o do chat: quem modera normalmente não
      // confirmou presença, e o chat recusaria. O texto da mensagem aparece
      // no `npm run moderar`.
      return {
        rotulo: autor && evento ? `mensagem de @${autor} no chat de "${evento}"` : 'mensagem de chat',
        url: data?.event_id ? `/app/event/${data.event_id}` : '/app',
      };
    }

    let postId = input.postId;
    let rotulo = 'publicação';
    if (input.commentId) {
      const { data } = await supabaseAdmin
        .from('comments')
        .select('post_id')
        .eq('id', input.commentId)
        .maybeSingle();
      postId = data?.post_id;
      rotulo = 'comentário';
    }

    const { data: post } = await supabaseAdmin
      .from('posts')
      .select('profiles!posts_author_id_fkey ( username )')
      .eq('id', postId ?? '')
      .maybeSingle();
    const autor = (post?.profiles as unknown as { username: string } | null)?.username;

    return {
      rotulo: autor ? `${rotulo} de @${autor}` : rotulo,
      url: autor ? `/app/user-posts/${autor}?postId=${postId}` : '/app',
    };
  },

  /** Quem modera: recebe o aviso de denúncia nova. */
  async listAdminIds(): Promise<string[]> {
    const { data, error } = await supabaseAdmin.from('admins').select('user_id');
    if (error) throw error;
    return (data ?? []).map((linha) => linha.user_id);
  },

  async block(blockerId: string, blockedId: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from('blocks')
      .upsert({ blocker_id: blockerId, blocked_id: blockedId }, { onConflict: 'blocker_id,blocked_id' });

    if (error) throw error;
  },

  async unblock(blockerId: string, blockedId: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from('blocks')
      .delete()
      .eq('blocker_id', blockerId)
      .eq('blocked_id', blockedId);

    if (error) throw error;
  },

  /** Perfis que o usuário bloqueou — a lista que ele gerencia. */
  async listBlocked(blockerId: string) {
    const { data, error } = await supabaseAdmin
      .from('blocks')
      .select('created_at, profiles!blocks_blocked_id_fkey ( id, username, display_name, avatar_url )')
      .eq('blocker_id', blockerId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data ?? [];
  },

  /**
   * Ids que devem sumir da vista deste usuário: quem ele bloqueou E quem o
   * bloqueou.
   *
   * As duas direções de propósito. Esconder só quem eu bloqueei deixaria a
   * pessoa que me bloqueou continuar vendo tudo meu — e bloqueio que só vale
   * pra um lado não protege ninguém.
   */
  async listHiddenIds(userId: string): Promise<string[]> {
    const { data, error } = await supabaseAdmin
      .from('blocks')
      .select('blocker_id, blocked_id')
      .or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`);

    if (error) throw error;

    const ids = new Set<string>();
    for (const linha of data ?? []) {
      ids.add(linha.blocker_id === userId ? linha.blocked_id : linha.blocker_id);
    }
    return [...ids];
  },

  async isBlocked(blockerId: string, blockedId: string): Promise<boolean> {
    const { data, error } = await supabaseAdmin
      .from('blocks')
      .select('blocker_id')
      .eq('blocker_id', blockerId)
      .eq('blocked_id', blockedId)
      .maybeSingle();

    if (error) throw error;
    return !!data;
  },
};
