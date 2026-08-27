import { env } from '@/config/env';

export interface FipeBrand {
  codigo: string;
  nome: string;
}

export interface FipeModel {
  codigo: number;
  nome: string;
}

export interface FipeModelsResponse {
  modelos: FipeModel[];
}

export interface FipeYear {
  codigo: string; // ex.: "2014-3"
  nome: string; // ex.: "2014 Diesel"
}

export interface FipeVehicleDetails {
  Valor: string; // ex.: "R$ 45.000,00"
  Marca: string;
  Modelo: string;
  AnoModelo: number;
  Combustivel: string;
  CodigoFipe: string;
  MesReferencia: string;
  TipoVeiculo: number;
  SiglaCombustivel: string;
}

const BASE_URL = env.FIPE_API_URL;

async function fipeGet<T>(path: string): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`);

  if (!response.ok) {
    throw new Error(`FIPE API respondeu ${response.status} para ${path}`);
  }

  return (await response.json()) as T;
}

/**
 * Client fino sobre a API pública da FIPE (parallelum). Usado exclusivamente
 * pelo módulo vehicle-sync — nunca chamado no caminho de uma requisição de
 * usuário do app.
 */
export const fipeClient = {
  getBrands(): Promise<FipeBrand[]> {
    return fipeGet<FipeBrand[]>('/carros/marcas');
  },

  getModels(brandCode: string): Promise<FipeModelsResponse> {
    return fipeGet<FipeModelsResponse>(`/carros/marcas/${brandCode}/modelos`);
  },

  getYears(brandCode: string, modelCode: number): Promise<FipeYear[]> {
    return fipeGet<FipeYear[]>(`/carros/marcas/${brandCode}/modelos/${modelCode}/anos`);
  },

  getDetails(
    brandCode: string,
    modelCode: number,
    yearCode: string
  ): Promise<FipeVehicleDetails> {
    return fipeGet<FipeVehicleDetails>(
      `/carros/marcas/${brandCode}/modelos/${modelCode}/anos/${yearCode}`
    );
  },
};

/** Converte "R$ 45.000,00" em 45000.00 (number). */
export function parseFipePrice(value: string): number | null {
  const numeric = value.replace(/[^\d,]/g, '').replace(',', '.');

  if (!numeric) {
    return null;
  }

  const parsed = Number(numeric);
  return Number.isFinite(parsed) ? parsed : null;
}
