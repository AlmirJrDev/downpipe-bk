/**
 * Geocodificação de endereço via Nominatim (OpenStreetMap).
 *
 * Escolhido por ser gratuito e não exigir chave — o que mantém o deploy sem
 * mais um segredo pra configurar. Em troca, a política de uso pede
 * User-Agent identificando a aplicação e no máximo 1 requisição por segundo.
 * Como isto só roda quando alguém cria ou muda o endereço de um evento, o
 * volume fica muito abaixo do limite.
 *
 * Nunca lança: endereço que não resolve devolve null, e o evento é salvo sem
 * coordenada. Mapa é enfeite do evento, não pré-requisito dele.
 */

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

// A política do Nominatim exige identificar a aplicação e um contato.
const USER_AGENT = 'Downpipe/1.0 (app de projetos de carros; contato via downpipe.app)';

// Curto de propósito: isto acontece dentro da requisição de criar evento, e
// é melhor salvar sem coordenada do que deixar o organizador esperando.
const TIMEOUT_MS = 5000;

export interface Coordinates {
  latitude: number;
  longitude: number;
  /**
   * "exact" = o endereço resolveu; "city" = só a cidade resolveu e o ponto
   * é o centro dela. A tela precisa saber a diferença para não mostrar um
   * pino aproximado como se fosse o lugar exato.
   */
  precision: "exact" | "city";
}

interface NominatimResult {
  lat: string;
  lon: string;
}

async function query(search: string): Promise<Coordinates | null> {
  const params = new URLSearchParams({
    q: search,
    format: 'json',
    limit: '1',
    // Restringe ao Brasil: "Marginal Tietê" sozinho casa com lugar em outro
    // país, e o resultado errado é pior que resultado nenhum.
    countrycodes: 'br',
  });

  const response = await fetch(`${NOMINATIM_URL}?${params.toString()}`, {
    headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'pt-BR' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!response.ok) return null;

  const results = (await response.json()) as NominatimResult[];
  const first = results[0];
  if (!first) return null;

  const latitude = Number(first.lat);
  const longitude = Number(first.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  return { latitude, longitude, precision: "exact" };
}

export interface AddressSuggestion {
  label: string;
  latitude: number;
  longitude: number;
}

interface NominatimSuggestion {
  lat: string;
  lon: string;
  display_name: string;
}

export const geocodingService = {
  /**
   * Sugestões de endereço para o organizador escolher enquanto digita.
   *
   * Existe para atacar o problema na raiz: se o endereço vem de uma lista
   * gerada pelo próprio geocodificador, ele resolve por construção — em vez
   * de o servidor tentar adivinhar depois o que a pessoa quis dizer com um
   * texto livre.
   */
  async search(query: string): Promise<AddressSuggestion[]> {
    if (query.trim().length < 3) return [];

    const params = new URLSearchParams({
      q: query.trim(),
      format: 'json',
      limit: '6',
      countrycodes: 'br',
      addressdetails: '0',
    });

    try {
      const response = await fetch(`${NOMINATIM_URL}?${params.toString()}`, {
        headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'pt-BR' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      if (!response.ok) return [];

      const results = (await response.json()) as NominatimSuggestion[];
      return results
        .map((r) => ({
          label: r.display_name,
          latitude: Number(r.lat),
          longitude: Number(r.lon),
        }))
        .filter((r) => Number.isFinite(r.latitude) && Number.isFinite(r.longitude));
    } catch {
      // Busca de endereço fora do ar não pode quebrar a tela de criar evento:
      // o organizador ainda pode arrastar o pino ou usar o GPS.
      return [];
    }
  },

  /**
   * Tenta o endereço completo primeiro; se não resolver, cai para a cidade.
   * Um pino no centro da cidade é bem mais útil que nenhum — o organizador
   * escreveu o ponto exato no texto de qualquer forma, e a pessoa quer
   * saber a região antes do número da rua.
   */
  async geocodeEvent(location: string, city: string): Promise<Coordinates | null> {
    try {
      const exact = await query(`${location}, ${city}, Brasil`);
      if (exact) return exact;

      const cityOnly = await query(`${city}, Brasil`);
      // Marca como aproximado: é o centro da cidade, não o local do rolê.
      return cityOnly ? { ...cityOnly, precision: 'city' } : null;
    } catch {
      // Nominatim fora do ar, timeout, rede — nada disso pode impedir o
      // organizador de criar o evento.
      return null;
    }
  },
};
