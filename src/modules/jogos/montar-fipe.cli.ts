/* eslint-disable no-console */
/**
 * Monta a lista do jogo "Mais Caro ou Mais Barato?" com preço da FIPE.
 *
 * A lista é escolhida à mão (carros que todo mundo conhece, do Mobi ao 911,
 * do Gol GTI ao Hilux); o preço vem da API pública da FIPE na hora de rodar.
 * O resultado é um JSON que vai junto com o app — o jogo não chama a FIPE,
 * e a lista só muda quando alguém roda isto de novo (uma vez por mês, que é
 * quando a tabela muda).
 *
 * Uso:
 *   npm run jogo:fipe -- <arquivo de saída.json>
 *
 * Cada carro diz a marca, um pedaço do nome do modelo na FIPE e o ano. O
 * script mostra qual modelo da FIPE casou com cada um, pra conferir.
 */
import fs from 'node:fs';
import { env } from '@/config/env';

type Pedido = [marca: RegExp, modelo: RegExp, ano: number, nome: string];

// prettier-ignore
const LISTA: Pedido[] = [
  // Zero (ou quase) dos mais vendidos
  [/^Fiat$/i, /^Mobi Like 1\.0/i, 2024, 'Fiat Mobi Like 1.0'],
  [/^Renault$/i, /^KWID Zen 1\.0/i, 2024, 'Renault Kwid Zen 1.0'],
  [/Chevrolet/i, /^ONIX HATCH LT 1\.0/i, 2024, 'Chevrolet Onix LT 1.0'],
  [/^Hyundai$/i, /^HB20 Comfort 1\.0/i, 2024, 'Hyundai HB20 Comfort 1.0'],
  [/VolksWagen/i, /^Polo Track 1\.0/i, 2024, 'VW Polo Track 1.0'],
  [/^Fiat$/i, /^ARGO DRIVE 1\.0/i, 2024, 'Fiat Argo Drive 1.0'],
  [/^Fiat$/i, /^Strada Freedom 1\.3/i, 2024, 'Fiat Strada Freedom 1.3'],
  [/VolksWagen/i, /^VIRTUS Comfortline 1\.0/i, 2024, 'VW Virtus Comfortline 1.0 TSI'],
  [/VolksWagen/i, /^NIVUS Highline 1\.0/i, 2024, 'VW Nivus Highline 1.0 TSI'],
  [/VolksWagen/i, /^T-Cross Highline 1\.4/i, 2024, 'VW T-Cross Highline 1.4 TSI'],
  [/Chevrolet/i, /^TRACKER Premier 1\.2/i, 2024, 'Chevrolet Tracker Premier 1.2 Turbo'],
  [/^Jeep$/i, /^Renegade Longitude 1\.3/i, 2024, 'Jeep Renegade Longitude 1.3 Turbo'],
  [/^Jeep$/i, /^COMPASS LONGITUDE 1\.3/i, 2024, 'Jeep Compass Longitude 1.3 Turbo'],
  [/^Nissan$/i, /^KICKS Advance 1\.6/i, 2024, 'Nissan Kicks Advance 1.6'],
  [/^Honda$/i, /^HR-V EXL 1\.5/i, 2024, 'Honda HR-V EXL 1.5'],
  [/^Hyundai$/i, /^CRETA Limited 1\.0/i, 2024, 'Hyundai Creta Limited 1.0 Turbo'],
  [/^Toyota$/i, /^Corolla XEi 2\.0/i, 2024, 'Toyota Corolla XEi 2.0'],
  [/^Toyota$/i, /^Corolla Cross XRE 2\.0/i, 2024, 'Toyota Corolla Cross XRE 2.0'],
  [/^Toyota$/i, /^Yaris XL.*Sedan|^Yaris Sedan XL/i, 2024, 'Toyota Yaris Sedan XL'],
  [/^Honda$/i, /^City Sedan EXL/i, 2024, 'Honda City Sedan EXL'],
  [/^Fiat$/i, /^Toro Volcano 2\.0/i, 2024, 'Fiat Toro Volcano 2.0 Diesel'],
  [/^Toyota$/i, /^Hilux CD SRX 2\.8/i, 2024, 'Toyota Hilux SRX 2.8 Diesel'],
  [/Chevrolet/i, /^S10 PICK-UP HIGH COUNTRY 2\.8/i, 2024, 'Chevrolet S10 High Country 2.8 Diesel'],
  [/^Ford$/i, /^Ranger Limited 3\.0/i, 2024, 'Ford Ranger Limited V6 Diesel'],
  [/^Toyota$/i, /^SW4 SRX 2\.8/i, 2024, 'Toyota SW4 SRX 2.8 Diesel'],
  [/^RAM$/i, /^RAMPAGE Laramie/i, 2024, 'RAM Rampage Laramie'],
  [/^BYD$/i, /^DOLPHIN 1/i, 2024, 'BYD Dolphin'],
  [/^BYD$/i, /^SEAL/i, 2024, 'BYD Seal'],
  [/^Jeep$/i, /^Wrangler Rubicon/i, 2024, 'Jeep Wrangler Rubicon'],
  [/^Land Rover$/i, /^Defender 110/i, 2024, 'Land Rover Defender 110'],

  // Esportivos e premium
  [/^Honda$/i, /^Civic Type R/i, 2024, 'Honda Civic Type R'],
  [/^Toyota$/i, /^GR COROLLA/i, 2024, 'Toyota GR Corolla'],
  [/^Toyota$/i, /^GR SUPRA/i, 2022, 'Toyota GR Supra'],
  [/^Ford$/i, /^Mustang GT/i, 2024, 'Ford Mustang GT V8'],
  [/^Mini$/i, /^COOPER S/i, 2024, 'Mini Cooper S'],
  [/^BMW$/i, /^320i M Sport/i, 2024, 'BMW 320i M Sport'],
  [/^BMW$/i, /^M3 Competition/i, 2023, 'BMW M3 Competition'],
  [/^Audi$/i, /^A3 Sedan Performance|^A3 Sedan.*S line/i, 2024, 'Audi A3 Sedan'],
  [/^Mercedes-Benz$/i, /^C-200/i, 2024, 'Mercedes-Benz C 200'],
  [/^Porsche$/i, /^911 Carrera 3\.0/i, 2024, 'Porsche 911 Carrera'],
  [/^Porsche$/i, /^Macan 2\.0/i, 2024, 'Porsche Macan'],
  [/^Porsche$/i, /^Cayenne 3\.0/i, 2024, 'Porsche Cayenne'],
  [/^Ferrari$/i, /^Roma/i, 2023, 'Ferrari Roma'],
  [/^Lamborghini$/i, /^Urus/i, 2023, 'Lamborghini Urus'],
  [/^Volvo$/i, /^XC60/i, 2024, 'Volvo XC60'],

  // Usados e clássicos que a galera ama
  [/VolksWagen/i, /^Gol GTI 2\.0/i, 1995, 'VW Gol GTI 2.0'],
  [/VolksWagen/i, /^Gol 1\.0/i, 2010, 'VW Gol 1.0'],
  [/VolksWagen/i, /^Fusca 1\.6/i, 1996, 'VW Fusca 1.6 (Itamar)'],
  [/VolksWagen/i, /^Kombi/i, 2013, 'VW Kombi'],
  [/VolksWagen/i, /^Santana/i, 1995, 'VW Santana'],
  [/VolksWagen/i, /^Golf GTI 1\.8/i, 2003, 'VW Golf GTI 1.8 Turbo (MK4)'],
  [/VolksWagen/i, /^Golf GTI 2\.0/i, 2018, 'VW Golf GTI 2.0 TSI (MK7)'],
  [/VolksWagen/i, /^Jetta 2\.0/i, 2012, 'VW Jetta 2.0'],
  [/VolksWagen/i, /^Saveiro/i, 2010, 'VW Saveiro'],
  [/^Fiat$/i, /^Uno Mille/i, 2005, 'Fiat Uno Mille'],
  [/^Fiat$/i, /^Uno Turbo/i, 1995, 'Fiat Uno Turbo'],
  [/^Fiat$/i, /^Palio/i, 2010, 'Fiat Palio'],
  [/^Fiat$/i, /^Tempra.*Turbo/i, 1995, 'Fiat Tempra Turbo'],
  [/Chevrolet/i, /^Celta/i, 2010, 'Chevrolet Celta'],
  [/Chevrolet/i, /^Corsa Hatch/i, 2005, 'Chevrolet Corsa Hatch'],
  [/Chevrolet/i, /^Kadett GSi/i, 1993, 'Chevrolet Kadett GSi'],
  [/Chevrolet/i, /^Opala/i, 1992, 'Chevrolet Opala Comodoro'],
  [/Chevrolet/i, /^Omega CD/i, 1995, 'Chevrolet Omega CD'],
  [/Chevrolet/i, /^Monza/i, 1995, 'Chevrolet Monza'],
  [/Chevrolet/i, /^Camaro SS/i, 2012, 'Chevrolet Camaro SS'],
  [/^Ford$/i, /^Escort XR3/i, 1993, 'Ford Escort XR3'],
  [/^Ford$/i, /^Fiesta/i, 2010, 'Ford Fiesta'],
  [/^Ford$/i, /^Ka/i, 2020, 'Ford Ka'],
  [/^Ford$/i, /^EcoSport/i, 2015, 'Ford EcoSport'],
  [/^Ford$/i, /^Mustang GT/i, 2018, 'Ford Mustang GT V8'],
  [/^Honda$/i, /^Civic Si/i, 2009, 'Honda Civic Si'],
  [/^Honda$/i, /^Civic Sedan LXS/i, 2012, 'Honda Civic LXS'],
  [/^Toyota$/i, /^Corolla XEi/i, 2010, 'Toyota Corolla XEi'],
  [/^Toyota$/i, /^Hilux CD SRV/i, 2012, 'Toyota Hilux SRV'],
  [/^Mitsubishi$/i, /^Lancer Evolution/i, 2012, 'Mitsubishi Lancer Evolution X'],
  [/^Mitsubishi$/i, /^Pajero Full/i, 2012, 'Mitsubishi Pajero Full'],
  [/^Subaru$/i, /^Impreza.*WRX|^WRX/i, 2012, 'Subaru Impreza WRX'],
  [/^BMW$/i, /^M3/i, 2010, 'BMW M3 Cabrio V8'],
  [/^Mercedes-Benz$/i, /^C-180/i, 2012, 'Mercedes-Benz C 180'],
  [/^Audi$/i, /^A3/i, 2008, 'Audi A3'],
  [/^Hyundai$/i, /^HB20/i, 2015, 'Hyundai HB20'],
  [/^Renault$/i, /^Sandero/i, 2014, 'Renault Sandero'],
  [/^Peugeot$/i, /^206/i, 2008, 'Peugeot 206'],
  [/^Troller$/i, /^T-4|^T4/i, 2015, 'Troller T4'],
  [/^Dodge$/i, /^Challenger/i, 2012, 'Dodge Challenger'],
];

const BASE = env.FIPE_API_URL;
const pausa = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function get<T>(caminho: string): Promise<T> {
  for (let tentativa = 0; tentativa < 5; tentativa++) {
    const r = await fetch(`${BASE}${caminho}`);
    if (r.ok) {
      await pausa(350);
      return (await r.json()) as T;
    }
    // A API pública segura quem pede rápido demais: espera e tenta de novo.
    if (r.status === 429 || r.status >= 500) {
      await pausa(3000 * (tentativa + 1));
      continue;
    }
    throw new Error(`FIPE ${r.status} em ${caminho}`);
  }
  throw new Error(`FIPE não respondeu em ${caminho}`);
}

const reais = (valor: string) => Number(valor.replace(/[^\d,]/g, '').replace(',', '.'));

async function main() {
  const saida = process.argv[2];
  if (!saida) throw new Error('faltou o arquivo de saída: npm run jogo:fipe -- caminho/fipe-do-jogo.json');

  const marcas = await get<{ codigo: string; nome: string }[]>('/carros/marcas');
  const modelosDa = new Map<string, { codigo: number; nome: string }[]>();
  const carros: unknown[] = [];
  let referencia = '';

  for (const [marcaRe, modeloRe, ano, nome] of LISTA) {
    try {
      const marca = marcas.find((m) => marcaRe.test(m.nome) || marcaRe.test(m.nome.replace(/^.* - /, '')));
      if (!marca) throw new Error('marca não achada');
      if (!modelosDa.has(marca.codigo)) {
        modelosDa.set(marca.codigo, (await get<{ modelos: { codigo: number; nome: string }[] }>(`/carros/marcas/${marca.codigo}/modelos`)).modelos);
      }
      const candidatos = modelosDa.get(marca.codigo)!.filter((m) => modeloRe.test(m.nome));
      if (candidatos.length === 0) throw new Error('modelo não achado');

      // O primeiro modelo que casou e tem o ano pedido.
      let achou: { modelo: { codigo: number; nome: string }; codigoAno: string } | null = null;
      for (const modelo of candidatos.slice(0, 6)) {
        const anos = await get<{ codigo: string; nome: string }[]>(`/carros/marcas/${marca.codigo}/modelos/${modelo.codigo}/anos`);
        const doAno = anos.filter((a) => a.codigo.startsWith(`${ano}-`));
        if (doAno.length) {
          achou = { modelo, codigoAno: (doAno.find((a) => a.codigo.endsWith('-1')) ?? doAno[0]).codigo };
          break;
        }
      }
      if (!achou) throw new Error(`sem ano ${ano} (${candidatos.length} modelos casaram)`);

      const d = await get<{ Valor: string; Modelo: string; AnoModelo: number; Combustivel: string; CodigoFipe: string; MesReferencia: string }>(
        `/carros/marcas/${marca.codigo}/modelos/${achou.modelo.codigo}/anos/${achou.codigoAno}`
      );
      referencia ||= d.MesReferencia.trim();
      const preco = reais(d.Valor);
      carros.push({
        id: `${d.CodigoFipe}-${d.AnoModelo}`,
        nome,
        ano: d.AnoModelo,
        combustivel: d.Combustivel,
        preco,
        codigoFipe: d.CodigoFipe,
        modeloFipe: d.Modelo,
      });
      console.log(`✓ ${nome} ${ano} → ${d.Modelo} · ${d.Valor}`);
    } catch (e) {
      console.log(`✗ ${nome} ${ano}: ${e instanceof Error ? e.message : e}`);
    }
  }

  fs.writeFileSync(saida, JSON.stringify({ referencia, geradoEm: new Date().toISOString(), carros }, null, 2) + '\n');
  console.log(`\n${carros.length}/${LISTA.length} carros · tabela de ${referencia} → ${saida}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
