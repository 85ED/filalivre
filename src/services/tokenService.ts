/**
 * Token Service - Gerencia persistência de tokens de fila em localStorage
 * Permite que clientes recuperem sua posição na fila após refresh de página
 */

const QUEUE_TOKEN_KEY = 'queueToken';
const QUEUE_BARBERSHOP_KEY = 'queueBarbershopId';
const QUEUE_EXPIRY_KEY = 'queueTokenExpiry';

export const tokenService = {
  /**
   * Salva token de fila no localStorage
   */
  saveToken(token: string, barbershopId: number, expiresAt: string) {
    localStorage.setItem(QUEUE_TOKEN_KEY, token);
    localStorage.setItem(QUEUE_BARBERSHOP_KEY, barbershopId.toString());
    localStorage.setItem(QUEUE_EXPIRY_KEY, expiresAt);
  },

  /**
   * Recupera token de fila do localStorage
   */
  getToken(): string | null {
    return localStorage.getItem(QUEUE_TOKEN_KEY);
  },

  /**
   * Recupera barbershop ID associado ao token
   */
  getBarbershopId(): number | null {
    const id = localStorage.getItem(QUEUE_BARBERSHOP_KEY);
    return id ? parseInt(id, 10) : null;
  },

  /**
   * Verifica se token ainda é válido (não expirou)
   */
  isTokenValid(): boolean {
    const expiry = localStorage.getItem(QUEUE_EXPIRY_KEY);
    if (!expiry) return false;

    const expiryTime = new Date(expiry).getTime();
    const currentTime = new Date().getTime();

    return currentTime < expiryTime;
  },

  /**
   * Limpa token do localStorage
   */
  clearToken() {
    localStorage.removeItem(QUEUE_TOKEN_KEY);
    localStorage.removeItem(QUEUE_BARBERSHOP_KEY);
    localStorage.removeItem(QUEUE_EXPIRY_KEY);
  },

  /**
   * Recupera token se ainda valid
   */
  getValidToken(): { token: string; barbershopId: number } | null {
    if (!this.isTokenValid()) {
      this.clearToken();
      return null;
    }

    const token = this.getToken();
    const barbershopId = this.getBarbershopId();

    if (!token || !barbershopId) {
      this.clearToken();
      return null;
    }

    return { token, barbershopId };
  },
};
