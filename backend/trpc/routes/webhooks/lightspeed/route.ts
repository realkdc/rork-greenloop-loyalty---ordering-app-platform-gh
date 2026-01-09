import { z } from "zod";
import { publicProcedure } from "@/backend/trpc/create-context";
import { getCustomerSales } from "@/lib/lightspeedClient";

/**
 * Webhook endpoint for Lightspeed Retail X-Series
 * Receives notifications when sales are created/updated
 * 
 * This allows us to get real-time updates when eCom orders sync
 * 
 * Setup:
 * 1. Go to: https://greenhauscannabisco.retail.lightspeed.app/setup/api
 * 2. Create webhook for event: sale.created
 * 3. Point to: /api/webhooks/lightspeed/sale-created
 */
export default publicProcedure
  .input(
    z.object({
      type: z.string(), // e.g., "sale.created"
      data: z.object({
        id: z.string(), // Sale ID
        customer_id: z.string().optional(),
        receipt_number: z.string().optional(),
      }),
    })
  )
  .mutation(async ({ input }) => {
    try {
      console.log('[Webhook] Lightspeed sale event:', input.type, input.data.id);

      if (input.type === 'sale.created' || input.type === 'sale.updated') {
        const saleId = input.data.id;
        const customerId = input.data.customer_id;

        // Fetch full sale details
        // This will include eCom orders once they sync
        if (customerId) {
          // Trigger customer analytics update
          // Could queue a job to refresh customer metrics
          console.log('[Webhook] Sale for customer:', customerId);
          
          // Optionally: Fetch customer email and update analytics
          // This ensures we catch eCom orders as soon as they sync
        }

        return { success: true, message: 'Webhook processed' };
      }

      return { success: true, message: 'Event type not processed' };
    } catch (error) {
      console.error('[Webhook] Error:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });
