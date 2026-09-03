import { supabaseAdmin } from '@/config/supabase';

export interface PushSubscriptionRow {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

export const pushSubscriptionsRepository = {
  /**
   * Upsert por endpoint: reinscrever no mesmo aparelho (permissão
   * concedida de novo, service worker trocado) atualiza a linha em vez de
   * violar a unicidade. Também cobre o aparelho mudando de dono — a
   * inscrição antiga do endpoint passa a apontar pro usuário atual.
   */
  async upsert(userId: string, endpoint: string, p256dh: string, auth: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from('push_subscriptions')
      .upsert({ user_id: userId, endpoint, p256dh, auth }, { onConflict: 'endpoint' });

    if (error) throw error;
  },

  async deleteByEndpoint(endpoint: string): Promise<void> {
    const { error } = await supabaseAdmin.from('push_subscriptions').delete().eq('endpoint', endpoint);
    if (error) throw error;
  },

  async listByUserId(userId: string): Promise<PushSubscriptionRow[]> {
    const { data, error } = await supabaseAdmin
      .from('push_subscriptions')
      .select('id, user_id, endpoint, p256dh, auth')
      .eq('user_id', userId);

    if (error) throw error;
    return data ?? [];
  },
};
