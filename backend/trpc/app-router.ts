import { createTRPCRouter } from "./create-context";
import hiRoute from "./routes/example/hi/route";
import deleteRequestRoute from "./routes/account/deleteRequest/route";
import todaySalesRoute from "./routes/lightspeed/todaySales/route";
import recentSalesRoute from "./routes/lightspeed/recentSales/route";
import customerRoute from "./routes/lightspeed/customer/route";
import productsRoute from "./routes/lightspeed/products/route";
import storeInfoRoute from "./routes/lightspeed/storeInfo/route";

export const appRouter = createTRPCRouter({
  example: createTRPCRouter({
    hi: hiRoute,
  }),
  account: createTRPCRouter({
    deleteRequest: deleteRequestRoute,
  }),
  lightspeed: createTRPCRouter({
    todaySales: todaySalesRoute,
    recentSales: recentSalesRoute,
    customer: customerRoute,
    products: productsRoute,
    storeInfo: storeInfoRoute,
  }),
});

export type AppRouter = typeof appRouter;
