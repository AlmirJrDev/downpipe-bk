import { supabaseAdmin } from '@/config/supabase';
import { CreateReportInput } from './moderation.schema';

export const moderationRepository = {
  async createReport(reporterId: string, input: CreateReportInput): Promise<void> {
    const { error } = await supabaseAdmin.from('reports').insert({
      reporter_id: reporterId,
      post_id: input.postId ?? null,
      comment_id: input.commentId ?? null,
      profile_id: input.profileId ?? null,
      reason: input.reason,
      details: input.details ?? null,
    });

    // 23505 = índice único: a pessoa já denunciou este alvo. Não é erro pra
    // ela, e repetir a denúncia não muda nada — o service trata como sucesso.
    if (error && error.code !== '23505') throw error;
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
