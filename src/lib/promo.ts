import {
  collection,
  getDocs,
  getFirestore,
  limit,
  query,
  where,
  DocumentData,
  Timestamp,
} from 'firebase/firestore';
import { app } from '@/app/lib/firebase';

let firestore: ReturnType<typeof getFirestore> | null = null;

function getFirestoreInstance() {
  if (!firestore) {
    try {
      if (typeof getFirestore !== 'function') {
        throw new Error('getFirestore is not a function - Firebase may not be properly initialized');
      }
      firestore = getFirestore(app);
      console.log('[PromoService] ✅ Firestore initialized successfully');
    } catch (error: any) {
      console.error('[PromoService] 💥 Failed to initialize Firestore:', error);
      console.error('[PromoService] Firebase imports:', {
        getFirestore: typeof getFirestore,
        collection: typeof collection,
        getDocs: typeof getDocs,
        query: typeof query,
        where: typeof where,
        limit: typeof limit,
      });
      throw error;
    }
  }
  return firestore;
}

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
    console.log('[PromoService] 🚀 Starting getLivePromos...');
    const nowDate = new Date(now);
    const db = getFirestoreInstance();
    
    if (typeof collection !== 'function') {
      throw new Error('collection is not a function');
    }
    const promotionsRef = collection(db, 'promotions');
    console.log('[PromoService] ✅ Collection reference created');
    
    if (typeof query !== 'function') {
      throw new Error('query is not a function');
    }
    if (typeof where !== 'function') {
      throw new Error('where is not a function');
    }
    if (typeof limit !== 'function') {
      throw new Error('limit is not a function');
    }

    const normalizedStoreIds = (storeIds.length ? storeIds : ['cookeville', 'crossville']).map((id) => id.toLowerCase());

    console.log('[PromoService] 🔍 Querying Firestore:', {
      collection: 'promotions',
      storeIds: normalizedStoreIds,
      limit: limitCount,
      now: nowDate.toISOString(),
    });

    const q = query(
      promotionsRef,
      where('status', '==', 'live'),
      limit(50)
    );

    console.log('[PromoService] 📡 Executing query...');
    const snapshot = await getDocs(q);
    console.log(`[PromoService] ✅ Raw docs fetched: ${snapshot.size}`);

    if (snapshot.empty) {
      console.log('[PromoService] ⚠️ No documents found in Firestore');
      return [];
    }

    const allDocs = snapshot.docs
      .map((doc) => {
        const data = doc.data();
        console.log(`[PromoService] 📄 Doc ${doc.id}:`, {
          status: data.status,
          storeId: data.storeId,
          title: data.title,
          startsAt: data.startsAt,
          endsAt: data.endsAt,
        });
        return normalize(data, doc.id);
      })
      .sort((a, b) => {
        const aTime = a.startsAt?.getTime() ?? 0;
        const bTime = b.startsAt?.getTime() ?? 0;
        return bTime - aTime;
      });

    const promos = allDocs.filter((promo) => {
      if (!promo.storeId) {
        console.log(`[PromoService] ✅ Included ${promo.id}: No storeId filter`);
        return true;
      }
      const matches = normalizedStoreIds.length === 1
        ? promo.storeId.toLowerCase().includes(normalizedStoreIds[0])
        : normalizedStoreIds.some((id) => promo.storeId?.toLowerCase().includes(id));
      
      if (!matches) {
        console.log(`[PromoService] ❌ Filtered ${promo.id}: Store doesn't match (${promo.storeId})`);
        return false;
      }
      
      console.log(`[PromoService] ✅ Included ${promo.id}: Store matches`);
      
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
      return true;
    }).slice(0, limitCount);

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
