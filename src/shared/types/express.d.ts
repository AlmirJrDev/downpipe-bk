export interface AuthenticatedUser {
  id: string;
  email: string | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      /** Token JWT bruto recebido no header Authorization, quando presente. */
      accessToken?: string;
    }
  }
}

export {};
