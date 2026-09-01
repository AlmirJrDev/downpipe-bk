/**
 * Distância entre coordenadas e a caixa que a delimita.
 *
 * Feito em TypeScript, sem PostGIS: habilitar extensão no Postgres é um
 * risco desnecessário no volume atual. A consulta filtra por uma caixa
 * (indexável com btree comum) e o recorte fino do círculo acontece aqui.
 * Quando o número de eventos justificar, isto vira índice geoespacial —
 * a fronteira já está isolada nestas duas funções.
 */

const EARTH_RADIUS_KM = 6371;
const KM_PER_DEGREE_LAT = 111.32;

const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Haversine — distância em km sobre a superfície da Terra. */
export function distanceKm(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number }
): number {
  const dLat = toRad(to.latitude - from.latitude);
  const dLng = toRad(to.longitude - from.longitude);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.latitude)) * Math.cos(toRad(to.latitude)) * Math.sin(dLng / 2) ** 2;

  return EARTH_RADIUS_KM * 2 * Math.asin(Math.sqrt(a));
}

/**
 * Caixa que contém o círculo de raio informado. É um quadrado, então traz
 * um pouco mais que o pedido nos cantos — o filtro exato por distância
 * remove essa sobra depois.
 */
export function boundingBox(
  center: { latitude: number; longitude: number },
  radiusKm: number
): { minLat: number; maxLat: number; minLng: number; maxLng: number } {
  const deltaLat = radiusKm / KM_PER_DEGREE_LAT;

  // Os meridianos se aproximam conforme sobe a latitude, então um grau de
  // longitude vale menos km longe do equador. Sem o cosseno, a caixa ficaria
  // estreita demais no sul do país.
  const cos = Math.cos(toRad(center.latitude));
  const deltaLng = radiusKm / (KM_PER_DEGREE_LAT * Math.max(Math.abs(cos), 0.01));

  return {
    minLat: center.latitude - deltaLat,
    maxLat: center.latitude + deltaLat,
    minLng: center.longitude - deltaLng,
    maxLng: center.longitude + deltaLng,
  };
}
