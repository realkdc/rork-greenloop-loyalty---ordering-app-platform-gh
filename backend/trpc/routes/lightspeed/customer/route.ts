import { z } from "zod";
import { publicProcedure } from "@/backend/trpc/create-context";
import { getCustomer, searchCustomers } from "@/services/lightspeed";

export default publicProcedure
  .input(
    z.object({
      id: z.string().optional(),
      query: z.string().optional(),
      limit: z.number().min(1).max(100).default(20).optional(),
    })
  )
  .query(async ({ input }) => {
    if (input.id) {
      return await getCustomer(input.id);
    }
    if (input.query) {
      return await searchCustomers(input.query, input.limit || 20);
    }
    throw new Error("Either 'id' or 'query' must be provided");
  });
