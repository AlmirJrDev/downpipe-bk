import { supabaseAdmin } from '@/config/supabase';

export interface AdvertisementRow {
  id: string;
  title: string;
  caption: string | null;
  image_url: string | null;
  cta_label: string | null;
  cta_url: string | null;
  starts_at: string | null;
  ends_at: string | null;
}

export const advertisementsRepository = {
  /**
   * Retorna anúncios ativos e dentro da janela de veiculação (starts_at/
   * ends_at, quando definidos), para o app interlear no feed. Rascunhos,
   * pausados e finalizados nunca aparecem aqui.
   */
  async listActive(limit: number): Promise<AdvertisementRow[]> {
    const nowIso = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('advertisements')
      .select('id, title, caption, image_url, cta_label, cta_url, starts_at, ends_at')
      .eq('status', 'active')
      .or(`starts_at.is.null,starts_at.lte.${nowIso}`)
      .or(`ends_at.is.null,ends_at.gte.${nowIso}`)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data ?? [];
  },
};
