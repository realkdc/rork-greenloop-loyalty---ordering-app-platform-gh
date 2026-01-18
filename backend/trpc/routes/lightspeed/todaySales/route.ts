import { publicProcedure } from "@/backend/trpc/create-context";
import { getTodaySales } from "@/services/lightspeed";

export default publicProcedure.query(async () => {
  return await getTodaySales();
});
