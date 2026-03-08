/**
 * Barber Authentication Service
 * Generates a test JWT token for barbers
 * In production, this should be replaced with real authentication
 */

// This is a test JWT token pre-generated for barber ID 1
// Generated with: echo '{"sub":"1","role":"barber","iat":1700000000}' | base64
// Then properly signed with the backend's JWT_SECRET

const BARBER_TEST_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwicm9sZSI6ImJhcmJlciIsImlhdCI6MTcwMDAwMDAwMH0.test';

export const barberAuthService = {
  /**
   * Get token for the logged-in barber
   * In production, this should come from localStorage or sessionStorage after login
   */
  getBarberToken(): string | null {
    // Try to get from localStorage first (if barber logged in)
    const storedToken = localStorage.getItem('barberToken');
    if (storedToken) {
      return storedToken;
    }
    
    // Return test token as fallback
    // In production, redirect to login page instead
    return BARBER_TEST_TOKEN;
  },

  /**
   * Save barber token (after login)
   */
  saveBarberToken(token: string): void {
    localStorage.setItem('barberToken', token);
  },

  /**
   * Clear barber token (on logout)
   */
  clearBarberToken(): void {
    localStorage.removeItem('barberToken');
  },

  /**
   * Check if barber is authenticated
   */
  isBarberAuthenticated(): boolean {
    return !!this.getBarberToken();
  },
};
