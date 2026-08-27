/**
 * HTML da página de status. Página pública, aberta por testadores no
 * celular — por isso é uma string só, sem build nem dependência externa:
 * qualquer CDN quebraria a página justamente quando a conexão está ruim.
 */

interface PageData {
  appOnline: boolean;
  expoUrl: string | null;
  qrDataUri: string | null;
  updatedAtLabel: string | null;
}

const COLORS = {
  surface: "#121212",
  card: "#1a1a1a",
  border: "#333333",
  onSurface: "#f0f0f0",
  variant: "#a3a3a3",
  muted: "#8a8a8a",
  primary: "#ff4a3d",
  online: "#22c55e",
};

export function renderStatusPage({ appOnline, expoUrl, qrDataUri, updatedAtLabel }: PageData): string {
  const statusColor = appOnline ? COLORS.online : COLORS.muted;
  const statusText = appOnline ? "ONLINE" : "OFFLINE";

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Downpipe — Status</title>
<!-- Recarrega sozinho: quem deixa a aba aberta esperando o app subir vê
     mudar sem precisar atualizar na mão. -->
<meta http-equiv="refresh" content="30">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: ${COLORS.surface}; color: ${COLORS.onSurface};
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    min-height: 100vh; display: flex; align-items: center; justify-content: center;
    padding: 24px;
  }
  .card { width: 100%; max-width: 420px; }
  /* Proporção original 1457×292 — largura fluida, altura acompanha. */
  .brand { width: 100%; max-width: 300px; height: auto; display: block; }
  .tagline {
    color: ${COLORS.variant}; font-size: 10px; letter-spacing: 4px;
    margin-top: 10px; text-transform: uppercase;
  }
  .status {
    display: flex; align-items: center; gap: 10px;
    border: 1px solid ${COLORS.border}; background: ${COLORS.card};
    padding: 16px; margin-top: 28px;
  }
  .dot { width: 10px; height: 10px; border-radius: 50%; background: ${statusColor}; flex-shrink: 0; }
  .status-label { font-size: 13px; font-weight: 700; letter-spacing: 1.5px; color: ${statusColor}; }
  .status-sub { font-size: 12px; color: ${COLORS.muted}; margin-top: 2px; }
  .qr { background: #fff; padding: 16px; margin-top: 20px; display: flex; justify-content: center; }
  .qr img { width: 100%; max-width: 240px; height: auto; display: block; }
  .btn {
    display: block; text-align: center; text-decoration: none;
    background: #da291c; color: #fff; font-weight: 700; font-size: 13px;
    letter-spacing: 1.5px; padding: 16px; margin-top: 16px; text-transform: uppercase;
  }
  .steps { border: 1px solid ${COLORS.border}; padding: 18px; margin-top: 20px; }
  .steps h2 { font-size: 11px; letter-spacing: 1.8px; color: ${COLORS.variant}; margin-bottom: 12px; }
  .steps ol { margin-left: 18px; color: ${COLORS.onSurface}; font-size: 14px; line-height: 1.7; }
  .steps a { color: ${COLORS.primary}; }
  .offline { border: 1px solid ${COLORS.border}; padding: 18px; margin-top: 20px; color: ${COLORS.variant}; font-size: 14px; line-height: 1.6; }
  footer { margin-top: 24px; color: ${COLORS.muted}; font-size: 11px; text-align: center; line-height: 1.6; }
</style>
</head>
<body>
  <div class="card">
    <img class="brand" src="/status/logo.png" alt="Downpipe">
    <div class="tagline">Rede social automotiva</div>

    <div class="status">
      <div class="dot"></div>
      <div>
        <div class="status-label">${statusText}</div>
        <div class="status-sub">${
          appOnline
            ? `App disponível para teste${updatedAtLabel ? ` · atualizado ${updatedAtLabel}` : ""}`
            : "O app não está no ar neste momento"
        }</div>
      </div>
    </div>

    ${
      appOnline && qrDataUri && expoUrl
        ? `
    <div class="qr"><img src="${qrDataUri}" alt="QR code para abrir no Expo Go"></div>
    <a class="btn" href="${expoUrl}">Abrir no Expo Go</a>
    <div class="steps">
      <h2>COMO TESTAR</h2>
      <ol>
        <li>Instale o <a href="https://expo.dev/go" target="_blank" rel="noopener">Expo Go</a> na loja do seu celular.</li>
        <li>Android: abra o Expo Go e escaneie o QR. iPhone: escaneie com a câmera.</li>
        <li>Crie sua conta no app com e-mail e senha.</li>
      </ol>
    </div>`
        : `
    <div class="offline">
      O app fica disponível apenas durante as sessões de teste. Se você recebeu
      este link e a página está offline, peça para quem enviou subir o ambiente —
      esta página atualiza sozinha a cada 30 segundos.
    </div>`
    }

    <footer>Esta página reflete o estado real do servidor.<br>Backend online, pois ela está sendo servida por ele.</footer>
  </div>
</body>
</html>`;
}
