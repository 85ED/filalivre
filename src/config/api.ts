// API Configuration
const isProd = typeof window !== 'undefined' && window.location.hostname !== 'localhost';
export const API_URL = isProd ? 'https://filalivre-production.up.railway.app/api' : 'http://localhost:3001/api';

export const API_ENDPOINTS = {
  // Barbershop lookup
  barbershopBySlug: (slug: string) => `/barbershops/slug/${slug}`,
  
  // Queue
  queue: (barbershopId: number) => `/queue/${barbershopId}`,
  joinQueue: '/queue/join',
  removeFromQueue: '/queue/remove',
  callNext: '/queue/call-next',
  finishClient: '/queue/finish',
  skipClient: '/queue/skip',
  
  // Barbers
  barbers: (barbershopId: number) => `/barbers/barbershop/${barbershopId}`,
  availableBarbers: (barbershopId: number) => `/barbers/available/${barbershopId}`,
  updateBarberStatus: '/barbers/status',

  // Unified
  barbershopStatus: (barbershopId: number) => `/barbershops/${barbershopId}/status`,

  // Reports
  reports: (barbershopId: number) => `/barbershops/${barbershopId}/reports`,
  barberReport: (barbershopId: number, barberId: number) => `/barbershops/${barbershopId}/reports/barber/${barberId}`,

  // WhatsApp
  whatsappConnect: (barbershopId: number) => `/whatsapp/connect/${barbershopId}`,
  whatsappDisconnect: (barbershopId: number) => `/whatsapp/disconnect/${barbershopId}`,
  whatsappStatus: (barbershopId: number) => `/whatsapp/status/${barbershopId}`,
  whatsappQr: (barbershopId: number) => `/whatsapp/qr/${barbershopId}`,
};
