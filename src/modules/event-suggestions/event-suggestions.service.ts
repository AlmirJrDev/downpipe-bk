import { AppError } from '@/shared/utils/AppError';
import { eventsService } from '@/modules/events/events.service';
import { eventsRepository } from '@/modules/events/events.repository';
import { eventSuggestionsRepository, SuggestionRow } from './event-suggestions.repository';
import {
  ApproveSuggestionInput,
  CreateSuggestionInput,
} from './event-suggestions.schema';

function toPublic(row: SuggestionRow) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    endsAtEstimated: row.ends_at_estimated,
    location: row.location,
    city: row.city,
    address: row.address,
    latitude: row.latitude,
    longitude: row.longitude,
    entryNote: row.entry_note,
    attractions: row.attractions ?? [],
    rules: row.rules ?? [],
    kind: row.kind,
    carCategories: row.car_categories ?? [],
    source: row.source,
    sourceUrl: row.source_url,
    sourceNote: row.source_note,
    organizerInstagram: row.organizer_instagram,
    suggestedBy: row.profiles?.username ?? null,
    status: row.status,
    eventId: row.event_id,
    createdAt: row.created_at,
  };
}

export const eventSuggestionsService = {
  /**
   * Sugestão de quem usa o app.
   *
   * Responde igual quando a sugestão já existia: dizer "alguém já avisou" não
   * ajuda em nada e faz a pessoa achar que deu errado. O que importa pra ela
   * é que o recado chegou.
   */
  async sugerir(input: CreateSuggestionInput, userId: string) {
    await eventSuggestionsRepository.create(input, { source: 'usuario', suggestedBy: userId });
    return { message: 'Valeu! A gente confere e publica.' };
  },

  /** Entrada das fontes de fora (busca na web, importação). */
  async registrarDaWeb(input: CreateSuggestionInput) {
    const criada = await eventSuggestionsRepository.create(input, { source: 'web' });
    return criada ? toPublic(criada) : null;
  },

  async fila(status: 'pending' | 'approved' | 'rejected' = 'pending') {
    const linhas = await eventSuggestionsRepository.list(status);
    return linhas.map(toPublic);
  },

  async pendentes() {
    return { pending: await eventSuggestionsRepository.contarPendentes() };
  },

  /**
   * Vira rolê de verdade.
   *
   * Quem aprova entra como organizador — alguém precisa responder pelo rolê
   * dentro do app —, mas a fonte vai junto no evento: publicar encontro dos
   * outros sem dizer de onde veio esconde do usuário que a informação é de
   * segunda mão, que é justamente o que ele precisa saber antes de viajar até
   * lá. Os campos podem ser corrigidos na aprovação: data errada em post de
   * rede social é a regra, não a exceção.
   */
  async aprovar(id: string, adminId: string, correcoes: ApproveSuggestionInput) {
    const sugestao = await eventSuggestionsRepository.findById(id);
    if (!sugestao) {
      throw AppError.notFound('SUGGESTION_NOT_FOUND', 'Sugestão não encontrada');
    }
    if (sugestao.status !== 'pending') {
      throw AppError.conflict('SUGGESTION_ALREADY_REVIEWED', 'Esta sugestão já foi revisada');
    }

    const evento = await eventsService.create(adminId, {
      name: correcoes.name ?? sugestao.name,
      description: correcoes.description ?? sugestao.description,
      startsAt: correcoes.startsAt,
      endsAt: correcoes.endsAt ?? sugestao.ends_at,
      endsAtEstimated: correcoes.endsAtEstimated ?? sugestao.ends_at_estimated,
      location: correcoes.location,
      city: correcoes.city,
      address: correcoes.address ?? sugestao.address,
      latitude: correcoes.latitude ?? sugestao.latitude,
      longitude: correcoes.longitude ?? sugestao.longitude,
      entryNote: correcoes.entryNote ?? sugestao.entry_note,
      attractions: correcoes.attractions ?? sugestao.attractions,
      rules: correcoes.rules ?? sugestao.rules,
      kind: correcoes.kind ?? sugestao.kind,
      carCategories: correcoes.carCategories ?? sugestao.car_categories,
      // Quem organiza é o perfil que divulgou. O admin fica de organizador
      // dentro do app porque alguém precisa poder editar e cancelar, mas a
      // tela credita o @ — e é pra ele que quem tem dúvida pergunta.
      organizerInstagram: correcoes.organizerInstagram ?? sugestao.organizer_instagram,
      visibility: 'public',
    } as never);

    // O crédito: quem divulgou primeiro, e o link pra conferir.
    await eventsRepository.update(evento.id, {
      sourceUrl: correcoes.sourceUrl ?? sugestao.source_url,
      sourceNote: correcoes.sourceNote ?? sugestao.source_note,
    } as never);

    await eventSuggestionsRepository.marcar(id, 'approved', adminId, evento.id);
    return { eventId: evento.id };
  },

  async descartar(id: string, adminId: string) {
    const sugestao = await eventSuggestionsRepository.findById(id);
    if (!sugestao) {
      throw AppError.notFound('SUGGESTION_NOT_FOUND', 'Sugestão não encontrada');
    }
    await eventSuggestionsRepository.marcar(id, 'rejected', adminId);
    return { descartada: true };
  },
};
