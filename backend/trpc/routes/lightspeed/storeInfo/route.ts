import { publicProcedure } from "@/backend/trpc/create-context";
import { getRetailer, getOutlets } from "@/services/lightspeed";

export default publicProcedure.query(async () => {
  const [retailer, outlets] = await Promise.all([
    getRetailer(),
    getOutlets(),
  ]);

  return {
    retailer,
    outlets,
  };
});
