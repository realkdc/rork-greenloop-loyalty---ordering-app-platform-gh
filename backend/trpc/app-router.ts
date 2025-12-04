import { createTRPCRouter } from "./create-context";
import hiRoute from "./routes/example/hi/route";
import deleteRequestRoute from "./routes/account/deleteRequest/route";

export const appRouter = createTRPCRouter({
  example: createTRPCRouter({
    hi: hiRoute,
  }),
  account: createTRPCRouter({
    deleteRequest: deleteRequestRoute,
  }),
});

export type AppRouter = typeof appRouter;
