import { supabaseAdmin } from '@/config/supabase';

export interface MessageRow {
  id: string;
  event_id: string;
  author_id: string | null;
  kind: 'mensagem' | 'sistema';
  text: string;
  created_at: string;
  profiles: { username: string; display_name: string; avatar_url: string | null } | null;
}

export interface ReadRow {
  user_id: string;
  last_read_at: string;
  last_pushed_at: string | null;
}

const MESSAGE_SELECT = `
  id, event_id, author_id, kind, text, created_at,
  profiles ( username, display_name, avatar_url )
`;

/**
 * Pra quem nunca abriu o chat. Marcar "leu agora" na primeira linha que o
 * push cria faria a pessoa parecer em dia com mensagens que nunca viu.
 */
const NUNCA_LEU = '1970-01-01T00:00:00Z';

export const eventChatRepository = {
  /** Organizador e confirmados: quem pode ler e escrever no chat. */
  async participantIds(eventId: string, organizerId: string): Promise<string[]> {
    const { data, error } = await supabaseAdmin
      .from('event_attendees')
      .select('user_id')
      .eq('event_id', eventId);
    if (error) throw error;
    return [...new Set([organizerId, ...(data ?? []).map((r) => r.user_id)])];
  },

  async isAttendee(eventId: string, userId: string): Promise<boolean> {
    const { data, error } = await supabaseAdmin
      .from('event_attendees')
      .select('user_id')
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    return !!data;
  },

  /**
   * As mensagens de uma janela, sempre em ordem de chegada.
   *
   * `desde` é inclusivo de propósito: duas mensagens podem ter o mesmo
   * instante, e com "maior que" a segunda sumiria pra quem já tinha visto a
   * primeira. O app descarta por id o que já tem.
   */
  async list(
    eventId: string,
    janela: { desde?: string; antes?: string; limite: number }
  ): Promise<MessageRow[]> {
    let query = supabaseAdmin
      .from('event_messages')
      .select(MESSAGE_SELECT)
      .eq('event_id', eventId)
      .is('deleted_at', null);

    if (janela.desde) {
      query = query.gte('created_at', janela.desde).order('created_at', { ascending: true });
    } else {
      if (janela.antes) query = query.lt('created_at', janela.antes);
      query = query.order('created_at', { ascending: false });
    }

    const { data, error } = await query.limit(janela.limite);
    if (error) throw error;

    const linhas = (data ?? []) as unknown as MessageRow[];
    // Sem "desde", a busca vem da mais nova pra trás; a tela quer em ordem.
    return janela.desde ? linhas : linhas.reverse();
  },

  async findById(id: string): Promise<MessageRow | null> {
    const { data, error } = await supabaseAdmin
      .from('event_messages')
      .select(MESSAGE_SELECT)
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();
    if (error) throw error;
    return data as unknown as MessageRow | null;
  },

  async create(
    eventId: string,
    autor: string | null,
    text: string
  ): Promise<MessageRow> {
    const { data, error } = await supabaseAdmin
      .from('event_messages')
      .insert({ event_id: eventId, author_id: autor, kind: autor ? 'mensagem' : 'sistema', text })
      .select(MESSAGE_SELECT)
      .single();
    if (error) throw error;
    return data as unknown as MessageRow;
  },

  /**
   * Marca como apagada, sem tirar a linha: é a marca que deixa o chat aberto
   * dos outros saber que a mensagem saiu (ver removedSince).
   *
   * A hora vem do relógio do servidor, o mesmo do `agora` que a conferida
   * devolve ao app. Comparar horas de um relógio só evita o descompasso que
   * já pegou a marcação de leitura (banco e servidor não batem por ~1 s).
   */
  async delete(id: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from('event_messages')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },

  /** Ids apagados deste rolê a partir de uma hora (inclusive). */
  async removedSince(eventId: string, desde: string): Promise<string[]> {
    const { data, error } = await supabaseAdmin
      .from('event_messages')
      .select('id')
      .eq('event_id', eventId)
      .gte('deleted_at', desde);
    if (error) throw error;
    return (data ?? []).map((r) => r.id);
  },

  /**
   * Marca como lido até agora — ou até a mensagem mais nova que a pessoa
   * acabou de receber, se ela for "mais nova" que agora.
   *
   * Parece redundante e não é. A hora da mensagem vem do relógio do banco; o
   * "agora", do relógio do servidor. Medido numa máquina de desenvolvimento,
   * o servidor estava 0,9 s atrás do banco: marcar "lido até agora" deixava a
   * mensagem que a pessoa acabou de ler contando como não lida.
   *
   * A hora da mensagem é gravada como veio do banco, com microssegundos. Se
   * fosse passada pelo Date do JavaScript, perderia a precisão, ficaria um
   * pouco antes da mensagem, e o mesmo problema voltaria.
   */
  async markRead(eventId: string, userId: string, ultimaVista?: string): Promise<void> {
    const agora = new Date().toISOString();
    const lidoAte =
      ultimaVista && Date.parse(ultimaVista) >= Date.parse(agora) ? ultimaVista : agora;

    const { error } = await supabaseAdmin
      .from('event_chat_reads')
      .upsert({ event_id: eventId, user_id: userId, last_read_at: lidoAte }, { onConflict: 'event_id,user_id' });
    if (error) throw error;
  },

  async reads(eventId: string, userIds: string[]): Promise<ReadRow[]> {
    if (userIds.length === 0) return [];
    const { data, error } = await supabaseAdmin
      .from('event_chat_reads')
      .select('user_id, last_read_at, last_pushed_at')
      .eq('event_id', eventId)
      .in('user_id', userIds);
    if (error) throw error;
    return data ?? [];
  },

  async markPushed(eventId: string, userId: string, jaTinhaLinha: boolean): Promise<void> {
    const agora = new Date().toISOString();
    const { error } = jaTinhaLinha
      ? await supabaseAdmin
          .from('event_chat_reads')
          .update({ last_pushed_at: agora })
          .eq('event_id', eventId)
          .eq('user_id', userId)
      : await supabaseAdmin
          .from('event_chat_reads')
          .insert({ event_id: eventId, user_id: userId, last_read_at: NUNCA_LEU, last_pushed_at: agora });
    if (error) throw error;
  },

  /** Mensagens depois da última leitura, sem contar as próprias. */
  async countUnread(eventId: string, userId: string): Promise<number> {
    const [leitura] = await this.reads(eventId, [userId]);
    let query = supabaseAdmin
      .from('event_messages')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .is('deleted_at', null)
      .or(`author_id.is.null,author_id.neq.${userId}`);
    if (leitura) query = query.gt('created_at', leitura.last_read_at);

    const { count, error } = await query;
    if (error) throw error;
    return count ?? 0;
  },
};
