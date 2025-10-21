import { Hono } from "hono";
import { trpcServer } from "@hono/trpc-server";
import { cors } from "hono/cors";
import { initializeApp, getApps, type AppOptions } from "firebase-admin/app";
import {
  getFirestore,
  FieldValue,
  type Firestore,
  type Query,
  type QueryDocumentSnapshot,
  type DocumentData,
} from "firebase-admin/firestore";
import * as functions from "firebase-functions/v1";
import { appRouter } from "./trpc/app-router";
import { createContext } from "./trpc/create-context";

const firebaseConfig: AppOptions = {};
const TOKENS_COLLECTION = "expoPushTokens";
const EXPO_PUSH_API_URL = "https://exp.host/--/api/v2/push/send";
const INVALID_PUSH_ERRORS = new Set(["DeviceNotRegistered", "InvalidCredentials"]);
const MAX_TOKENS_PER_BATCH = 100;

const ensureFirebaseApp = () => {
  if (getApps().length === 0) {
    initializeApp(firebaseConfig);
  }
};

const getDb = (): Firestore => {
  ensureFirebaseApp();
  return getFirestore();
};

const getAdminApiKey = (): string | undefined => {
  try {
    return functions.config().admin?.api_key ?? process.env.ADMIN_API_KEY;
  } catch (error) {
    return process.env.ADMIN_API_KEY;
  }
};

const app = new Hono();

app.use("*", cors());

app.post("/v1/push/register", async (c) => {
  const db = getDb();
  const body = await c.req.json();

  const { token, userId, storeId, platform, deviceName, appVersion, env } = body ?? {};

  if (!token || !userId || !storeId || !platform) {
    return c.json({ ok: false, error: "Missing required fields" }, 400);
  }

  const docRef = db.collection(TOKENS_COLLECTION).doc(token);

  await docRef.set(
    {
      token,
      userId,
      storeId,
      platform,
      deviceName: deviceName ?? null,
      appVersion: appVersion ?? null,
      env: env ?? null,
      enabled: true,
      lastError: null,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return c.json({ ok: true });
});

app.post("/v1/push/broadcast", async (c) => {
  const db = getDb();
  const adminKey = c.req.header("x-admin-key");
  const expectedKey = getAdminApiKey();

  if (!expectedKey || adminKey !== expectedKey) {
    return c.json({ ok: false, error: "Unauthorized" }, 401);
  }

  const body = await c.req.json();
  const { title, body: messageBody, data, segment } = body ?? {};

  if (!title || !messageBody) {
    return c.json({ ok: false, error: "Missing title or body" }, 400);
  }

  let query: Query<DocumentData> = db
    .collection(TOKENS_COLLECTION)
    .where("enabled", "==", true);

  if (segment?.storeId) {
    query = query.where("storeId", "==", segment.storeId);
  }

  if (segment?.env) {
    query = query.where("env", "==", segment.env);
  }

  const snapshot = await query.get();
  const tokens = snapshot.docs.map((doc: QueryDocumentSnapshot<DocumentData>) => doc.id);

  if (tokens.length === 0) {
    return c.json({ sent: 0, batches: 0 });
  }

  const batches: string[][] = [];
  for (let i = 0; i < tokens.length; i += MAX_TOKENS_PER_BATCH) {
    batches.push(tokens.slice(i, i + MAX_TOKENS_PER_BATCH));
  }

  let sent = 0;
  let invalidated = 0;

  for (const batch of batches) {
    const messages = batch.map((token) => ({
      to: token,
      title,
      body: messageBody,
      data: data ?? {},
    }));

    const response = await fetch(EXPO_PUSH_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messages),
    });

    if (!response.ok) {
      functions.logger.warn("Failed to send push batch", {
        status: response.status,
        statusText: response.statusText,
        body: await response.text().catch(() => undefined),
      });
      continue;
    }

    const result = (await response.json().catch(() => null)) as
      | {
          data?: Array<{
            status?: string;
            message?: string;
            details?: { error?: string };
          }>;
          errors?: Array<{ message?: string }>;
        }
      | null;

    const invalidTokens: Array<{ token: string; reason: string }> = [];

    if (Array.isArray(result?.data)) {
      result.data.forEach((ticket, index) => {
        if (ticket?.status === "error") {
          const reason = ticket.details?.error ?? ticket.message ?? "unknown";
          if (INVALID_PUSH_ERRORS.has(reason)) {
            invalidTokens.push({ token: batch[index], reason });
          }
        }
      });
    }

    if (invalidTokens.length > 0) {
      const writeBatch = db.batch();

      invalidTokens.forEach(({ token, reason }) => {
        const ref = db.collection(TOKENS_COLLECTION).doc(token);
        writeBatch.set(
          ref,
          {
            enabled: false,
            lastError: reason,
            invalidatedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      });

      await writeBatch.commit();
      invalidated += invalidTokens.length;

      functions.logger.info("Disabled invalid push tokens", {
        count: invalidTokens.length,
      });
    }

    sent += batch.length - invalidTokens.length;
  }

  functions.logger.info("Push broadcast complete", {
    requested: tokens.length,
    sent,
    batches: batches.length,
    invalidated,
  });

  return c.json({ sent, batches: batches.length, invalidated });
});

app.use(
  "/trpc/*",
  trpcServer({
    endpoint: "/api/trpc",
    router: appRouter,
    createContext,
  })
);

app.get("/", (c) => {
  return c.json({ status: "ok", message: "API is running" });
});

export const pruneInvalidPushTokens = functions.pubsub
  .schedule("0 6 * * *")
  .timeZone("Etc/UTC")
  .onRun(async () => {
    const db = getDb();
    const snapshot = await db
      .collection(TOKENS_COLLECTION)
      .where("enabled", "==", false)
      .where("lastError", "in", Array.from(INVALID_PUSH_ERRORS))
      .get();

    if (snapshot.empty) {
      functions.logger.info("No invalid push tokens to prune");
      return null;
    }

    const batch = db.batch();

    snapshot.docs.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
      batch.delete(doc.ref);
    });

    await batch.commit();

    functions.logger.info("Pruned invalid push tokens", {
      deleted: snapshot.size,
    });

    return null;
  });

export default app;
