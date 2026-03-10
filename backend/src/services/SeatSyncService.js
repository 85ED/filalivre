import StripeService from './StripeService.js';
import Barbershop from '../models/Barbershop.js';
import Barber from '../models/Barber.js';

export class SeatSyncService {
  /**
   * Sync the Stripe subscription quantity with the number of active professionals.
   * Called after creating, deleting, or toggling active on a professional.
   */
  static async syncSeats(barbershopId) {
    try {
      if (!StripeService.isConfigured()) return;

      const barbershop = await Barbershop.findById(barbershopId);
      if (!barbershop?.stripe_subscription_id) return; // no active subscription
      if (barbershop.subscription_status !== 'active') return;

      const activeCount = await Barber.countActiveByBarbershop(barbershopId);
      if (activeCount === 0) return; // Stripe doesn't allow quantity 0

      await StripeService.updateSubscriptionQuantity(
        barbershop.stripe_subscription_id,
        activeCount
      );
      console.log(`[SeatSync] Updated barbershop ${barbershopId}: ${activeCount} seats`);
    } catch (err) {
      console.error(`[SeatSync] Error syncing barbershop ${barbershopId}:`, err.message);
    }
  }
}

export default SeatSyncService;
