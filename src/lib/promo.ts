import {
  collection,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
  where,
  DocumentData,
  Timestamp,
} from 'firebase/firestore';
import { app } from '@/app/lib/firebase';

const firestore = getFirestore(app);

export type PromoRecord = {
  id: string;
  title: string;
  body?: string;
  deepLinkUrl?: string;
  storeId?: string;
  storeName?: string;
  startsAt?: Date;
  endsAt?: Date;
  [key: string]: any;
};

function parseTimestamp(value: Timestamp | Date | string | undefined): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }
  return value.toDate();
}

function normalize(doc: DocumentData, id: string): PromoRecord {
  return {
    id,
    title: doc.title ?? '',
    body: doc.body ?? '',
    deepLinkUrl: doc.deepLinkUrl ?? doc.url ?? undefined,
    storeId: doc.storeId ?? undefined,
    storeName: doc.storeName ?? undefined,
    startsAt: parseTimestamp(doc.startsAt),
    endsAt: parseTimestamp(doc.endsAt),
    ...doc,
  };
}

type PromoQueryOptions = {
  storeIds: string[];
  limit?: number;
  now?: number;
};

export async function getLivePromos({ storeIds, limit: limitCount = 5, now = Date.now() }: PromoQueryOptions): Promise<PromoRecord[]> {
  try {
    const nowDate = new Date(now);
    const promotionsRef = collection(firestore, 'promotions');

    const normalizedStoreIds = (storeIds.length ? storeIds : ['cookeville', 'crossville']).map((id) => id.toLowerCase());
    const storeFilter = normalizedStoreIds.length === 1
      ? where('storeId', '==', normalizedStoreIds[0])
      : where('storeId', 'in', normalizedStoreIds.slice(0, 10));

    console.log('[PromoService] 🔍 Querying Firestore:', {
      collection: 'promotions',
      storeIds: normalizedStoreIds,
      limit: limitCount,
      now: nowDate.toISOString(),
    });

    const q = query(
      promotionsRef,
      where('status', '==', 'live'),
      storeFilter,
      orderBy('startsAt', 'desc'),
      limit(limitCount)
    );

    console.log('[PromoService] 📡 Executing query...');
    const snapshot = await getDocs(q);
    console.log(`[PromoService] ✅ Raw docs fetched: ${snapshot.size}`);

    if (snapshot.empty) {
      console.log('[PromoService] ⚠️ No documents found in Firestore');
      return [];
    }

    const allDocs = snapshot.docs.map((doc) => {
      const data = doc.data();
      console.log(`[PromoService] 📄 Doc ${doc.id}:`, {
        status: data.status,
        storeId: data.storeId,
        title: data.title,
        startsAt: data.startsAt,
        endsAt: data.endsAt,
      });
      return normalize(data, doc.id);
    });

    const promos = allDocs.filter((promo) => {
      const startsAt = promo.startsAt?.getTime();
      const endsAt = promo.endsAt?.getTime();
      
      if (startsAt === undefined) {
        console.log(`[PromoService] ❌ Filtered ${promo.id}: No startsAt`);
        return false;
      }
      if (startsAt > now) {
        console.log(`[PromoService] ❌ Filtered ${promo.id}: Not started yet (${new Date(startsAt).toISOString()})`);
        return false;
      }
      if (endsAt !== undefined && endsAt < now) {
        console.log(`[PromoService] ❌ Filtered ${promo.id}: Expired (${new Date(endsAt).toISOString()})`);
        return false;
      }
      if (!promo.storeId) {
        console.log(`[PromoService] ✅ Included ${promo.id}: No storeId filter`);
        return true;
      }
      const matches = normalizedStoreIds.length === 1
        ? promo.storeId.toLowerCase().includes(normalizedStoreIds[0])
        : normalizedStoreIds.some((id) => promo.storeId?.toLowerCase().includes(id));
      
      if (matches) {
        console.log(`[PromoService] ✅ Included ${promo.id}: Store matches`);
      } else {
        console.log(`[PromoService] ❌ Filtered ${promo.id}: Store doesn't match (${promo.storeId})`);
      }
      return matches;
    });

    console.log(`[PromoService] 🎉 Returning ${promos.length} active promos`);
    return promos;
  } catch (error: any) {
    console.error('[PromoService] 💥 Error fetching promos:', error);
    console.error('[PromoService] Error details:', {
      message: error?.message,
      code: error?.code,
      stack: error?.stack,
    });
    throw error;
  }
}
