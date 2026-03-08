// API Configuration
export const API_URL = 'http://localhost:3001/api';

// Default barbershop ID for now
export const DEFAULT_BARBERSHOP_ID = 1;

export const API_ENDPOINTS = {
  // Queue
  queue: (barbershopId: number = DEFAULT_BARBERSHOP_ID) => `/queue/${barbershopId}`,
  joinQueue: '/queue/join',
  removeFromQueue: '/queue/remove',
  callNext: '/queue/call-next',
  finishClient: '/queue/finish',
  skipClient: '/queue/skip',
  
  // Barbers
  barbers: (barbershopId: number = DEFAULT_BARBERSHOP_ID) => `/barbers/barbershop/${barbershopId}`,
  availableBarbers: (barbershopId: number = DEFAULT_BARBERSHOP_ID) => `/barbers/available/${barbershopId}`,
  updateBarberStatus: '/barbers/status',

  // Unified
  barbershopStatus: (barbershopId: number = DEFAULT_BARBERSHOP_ID) => `/barbershops/${barbershopId}/status`,

  // Reports
  reports: (barbershopId: number = DEFAULT_BARBERSHOP_ID) => `/barbershops/${barbershopId}/reports`,
  barberReport: (barbershopId: number, barberId: number) => `/barbershops/${barbershopId}/reports/barber/${barberId}`,

  // WhatsApp
  whatsappConnect: (barbershopId: number = DEFAULT_BARBERSHOP_ID) => `/whatsapp/connect/${barbershopId}`,
  whatsappDisconnect: (barbershopId: number = DEFAULT_BARBERSHOP_ID) => `/whatsapp/disconnect/${barbershopId}`,
  whatsappStatus: (barbershopId: number = DEFAULT_BARBERSHOP_ID) => `/whatsapp/status/${barbershopId}`,
  whatsappQr: (barbershopId: number = DEFAULT_BARBERSHOP_ID) => `/whatsapp/qr/${barbershopId}`,
};
