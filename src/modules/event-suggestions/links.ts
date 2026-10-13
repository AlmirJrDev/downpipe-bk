/**
 * Caixa de links de encontro (ver migration 0043).
 *
 * Quem administra cola o link do post (Instagram, Sympla, o que for) pelo
 * app; depois alguém lê o post e lança como sugestão completa na fila
 * (npm run roles -- links / link-lancado / link-descartar).
 */
import { z } from 'zod';
import { supabaseAdmin } from '@/config/supabase';
import { AppError } from '@/shared/utils/AppError';

export const novoLinkSchema = z.object({
  url: z.string().trim().url('Cole um link inteiro, começando com https://').max(500),
  note: z.string().trim().max(300).optional(),
});

/**
 * Tira o que não muda o post: o "?igsh=…" que o Instagram cola no fim do
 * link compartilhado, a barra final e o "www.". Sem isso o mesmo post,
 * copiado duas vezes, virava dois links.
 */
export function normalizarLink(url: string): string {
  const u = new URL(url.trim());
  u.hostname = u.hostname.toLowerCase().replace(/^www\./, '').replace(/^m\./, '');
  if (u.hostname === 'instagram.com' || u.hostname.endsWith('.instagram.com')) {
    u.search = '';
  } else {
    for (const k of [...u.searchParams.keys()]) if (/^(utm_|igsh|fbclid|si$)/i.test(k)) u.searchParams.delete(k);
  }
  u.hash = '';
  return u.toString().replace(/\/+$/, '');
}

export interface LinkDeEncontro {
  id: string;
  url: string;
  note: string | null;
  status: 'novo' | 'lancado' | 'descartado';
  suggestionId: string | null;
  createdAt: string;
  handledAt: string | null;
}

type Linha = {
  id: string;
  url: string;
  note: string | null;
  status: LinkDeEncontro['status'];
  suggestion_id: string | null;
  created_at: string;
  handled_at: string | null;
};

const paraApp = (l: Linha): LinkDeEncontro => ({
  id: l.id,
  url: l.url,
  note: l.note,
  status: l.status,
  suggestionId: l.suggestion_id,
  createdAt: l.created_at,
  handledAt: l.handled_at,
});

export const linksDeEncontro = {
  /** Guarda o link. Colado de novo, devolve o que já estava (repetido: true). */
  async guardar(input: z.infer<typeof novoLinkSchema>, adminId: string) {
    const url = normalizarLink(input.url);
    const { data, error } = await supabaseAdmin
      .from('event_links')
      .insert({ url, note: input.note || null, created_by: adminId })
      .select('*')
      .single();
    if (error?.code === '23505') {
      const { data: existente } = await supabaseAdmin.from('event_links').select('*').eq('url', url).single();
      return { link: paraApp(existente as Linha), repetido: true };
    }
    if (error) throw error;
    return { link: paraApp(data as Linha), repetido: false };
  },

  async listar(status?: LinkDeEncontro['status']) {
    let q = supabaseAdmin.from('event_links').select('*').order('created_at', { ascending: false }).limit(100);
    if (status) q = q.eq('status', status);
    const { data, error } = await q;
    if (error) throw error;
    return (data as Linha[]).map(paraApp);
  },

  async marcar(id: string, status: 'lancado' | 'descartado', suggestionId?: string | null, nota?: string) {
    const patch: Record<string, unknown> = { status, handled_at: new Date().toISOString() };
    if (suggestionId !== undefined) patch.suggestion_id = suggestionId;
    if (nota) patch.note = nota;
    const { data, error } = await supabaseAdmin.from('event_links').update(patch).eq('id', id).select('*').maybeSingle();
    if (error) throw error;
    if (!data) throw AppError.notFound('LINK_NOT_FOUND', 'Link não encontrado');
    return paraApp(data as Linha);
  },
};
