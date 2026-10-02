import { supabaseAdmin } from '@/config/supabase';

export interface TicketRow {
  event_id: string;
  user_id: string;
  ticket_code: string;
  checked_in_at: string | null;
  profiles: { username: string; display_name: string | null; avatar_url: string | null } | null;
  cars: {
    version: string | null;
    vehicle_versions: {
      year: number;
      vehicle_models: { name: string; vehicle_brands: { name: string } };
    } | null;
  } | null;
}

const TICKET_SELECT = `
  event_id, user_id, ticket_code, checked_in_at,
  profiles ( username, display_name, avatar_url ),
  cars ( version, vehicle_versions ( year, vehicle_models ( name, vehicle_brands ( name ) ) ) )
`;

/**
 * O Supabase devolve no máximo 1000 linhas por consulta. A portaria precisa
 * da lista inteira, então a leitura vai em páginas até acabar.
 */
const PAGINA = 1000;

export const ticketsRepository = {
  async findByAttendee(eventId: string, userId: string): Promise<TicketRow | null> {
    const { data, error } = await supabaseAdmin
      .from('event_attendees')
      .select(TICKET_SELECT)
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    return (data as unknown as TicketRow) ?? null;
  },

  async listByEvent(eventId: string): Promise<TicketRow[]> {
    const linhas: TicketRow[] = [];
    for (let inicio = 0; ; inicio += PAGINA) {
      const { data, error } = await supabaseAdmin
        .from('event_attendees')
        .select(TICKET_SELECT)
        .eq('event_id', eventId)
        // Ordem estável: sem ela, paginar pode repetir ou pular linhas.
        .order('user_id')
        .range(inicio, inicio + PAGINA - 1);

      if (error) throw error;
      const pagina = (data ?? []) as unknown as TicketRow[];
      linhas.push(...pagina);
      if (pagina.length < PAGINA) return linhas;
    }
  },

  /**
   * Registra a entrada guardando sempre a hora mais cedo. Idempotente: a
   * portaria reenvia o lote quando a resposta não chega, e reenviar não
   * pode mudar nada.
   *
   * O filtro de event_id faz o código de outro rolê não tocar em nada.
   */
  async registrarEntrada(
    eventId: string,
    code: string,
    at: string,
    deviceId: string
  ): Promise<void> {
    const { error } = await supabaseAdmin
      .from('event_attendees')
      .update({ checked_in_at: at, checked_in_device: deviceId })
      .eq('event_id', eventId)
      .eq('ticket_code', code)
      .or(`checked_in_at.is.null,checked_in_at.gt."${at}"`);

    if (error) throw error;
  },
};
