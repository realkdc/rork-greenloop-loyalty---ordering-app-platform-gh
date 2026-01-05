import { z } from "zod";
import { publicProcedure } from "@/backend/trpc/create-context";
import { getRecentSales } from "@/services/lightspeed";

export default publicProcedure
  .input(
    z.object({
      limit: z.number().min(1).max(100).default(10).optional(),
    })
  )
  .query(async ({ input }) => {
    return await getRecentSales(input.limit || 10);
  });
