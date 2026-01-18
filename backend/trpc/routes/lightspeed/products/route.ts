import { z } from "zod";
import { publicProcedure } from "@/backend/trpc/create-context";
import { getProducts } from "@/services/lightspeed";

export default publicProcedure
  .input(
    z.object({
      page: z.number().min(1).default(1).optional(),
      pageSize: z.number().min(1).max(200).default(50).optional(),
    })
  )
  .query(async ({ input }) => {
    return await getProducts(input.page || 1, input.pageSize || 50);
  });
