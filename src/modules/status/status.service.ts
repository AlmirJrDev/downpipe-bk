/**
 * Estado da sessão de testes: qual URL do Expo está no ar no momento.
 *
 * Fica em memória de propósito — se o backend cair, a sessão deixa de valer,
 * que é exatamente a verdade que a página de status precisa mostrar. Nada
 * disso é dado de produto, então não vai pro banco.
 */

interface Session {
  expoUrl: string;
  updatedAt: Date;
}

// Depois disso a sessão é considerada velha: o Expo provavelmente foi
// desligado sem avisar (fechar o terminal não manda nenhum sinal).
const SESSION_TTL_MINUTES = 90;

let session: Session | null = null;

export const statusService = {
  setSession(expoUrl: string) {
    session = { expoUrl, updatedAt: new Date() };
  },

  clearSession() {
    session = null;
  },

  getSession(): (Session & { stale: boolean }) | null {
    if (!session) return null;
    const ageMinutes = (Date.now() - session.updatedAt.getTime()) / 60000;
    return { ...session, stale: ageMinutes > SESSION_TTL_MINUTES };
  },
};
