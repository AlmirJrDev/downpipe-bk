/**
 * Geocodificação de endereço via Nominatim (OpenStreetMap).
 *
 * Escolhido por ser gratuito e não exigir chave — o que mantém o deploy sem
 * mais um segredo pra configurar. Em troca, a política de uso é rígida: 1
 * requisição por segundo pro servidor inteiro, cache obrigatório e nada de
 * busca enquanto a pessoa digita. Tudo isso fica no nominatim.client.ts,
 * por onde passam as três funções abaixo.
 *
 * Nunca lança: endereço que não resolve devolve null, e o evento é salvo sem
 * coordenada. Mapa é enfeite do evento, não pré-requisito dele.
 */
import { consultarNominatim } from './nominatim.client';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const NOMINATIM_REVERSE_URL = 'https://nominatim.openstreetmap.org/reverse';

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

  const results = (await consultarNominatim(`${NOMINATIM_URL}?${params.toString()}`)) as
    | NominatimResult[]
    | null;
  const first = results?.[0];
  if (!first) return null;

  const latitude = Number(first.lat);
  const longitude = Number(first.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  return { latitude, longitude, precision: "exact" };
}

/** O que o pino no mapa vira em texto. */
export interface EnderecoDoPonto {
  /** Rua e número quando existem; vazio quando o Nominatim só sabe a região. */
  location: string;
  city: string;
}

interface NominatimAddress {
  road?: string;
  house_number?: string;
  suburb?: string;
  neighbourhood?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  state?: string;
}

interface NominatimReverse {
  address?: NominatimAddress;
  display_name?: string;
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
   * Sugestões de endereço para o organizador escolher, quando ele pede a
   * busca.
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
      const results = (await consultarNominatim(`${NOMINATIM_URL}?${params.toString()}`)) as
        | NominatimSuggestion[]
        | null;
      if (!results) return [];

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
   * O caminho inverso: o pino que a pessoa cravou no mapa vira endereço e
   * cidade, pra ela não ter que digitar de novo o que já apontou.
   *
   * A cidade sai de city/town/village/municipality porque o Nominatim usa
   * chaves diferentes conforme o tamanho do lugar — só "city" deixaria
   * distrito e cidade pequena de fora, justamente onde mais rolê acontece.
   *
   * Nunca lança, pelo mesmo motivo do resto do arquivo: não conseguir
   * resolver é só a pessoa preencher na mão, não um erro de tela.
   */
  async reverse(latitude: number, longitude: number): Promise<EnderecoDoPonto | null> {
    const params = new URLSearchParams({
      // Arredonda pra ~11 m. Pino arrastado dois pixels pro lado resolve pro
      // mesmo endereço, e assim cai no cache em vez de gastar outra chamada.
      lat: latitude.toFixed(4),
      lon: longitude.toFixed(4),
      format: 'json',
      addressdetails: '1',
      // 18 = nível de rua. Mais fino que isso devolve o número da casa de
      // um vizinho qualquer como se fosse o ponto.
      zoom: '18',
    });

    try {
      const dados = (await consultarNominatim(
        `${NOMINATIM_REVERSE_URL}?${params.toString()}`
      )) as NominatimReverse | null;
      const a = dados?.address;
      if (!a) return null;

      const cidade = a.city ?? a.town ?? a.village ?? a.municipality ?? '';
      const rua = [a.road, a.house_number].filter(Boolean).join(', ');
      const local = rua || a.neighbourhood || a.suburb || '';

      if (!cidade && !local) return null;
      return { location: local, city: cidade };
    } catch {
      return null;
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
