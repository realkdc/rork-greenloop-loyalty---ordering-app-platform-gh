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
  const nowDate = new Date(now);
  const promotionsRef = collection(firestore, 'promotions');

  const normalizedStoreIds = (storeIds.length ? storeIds : ['cookeville', 'crossville']).map((id) => id.toLowerCase());
  const storeFilter = normalizedStoreIds.length === 1
    ? where('storeId', '==', normalizedStoreIds[0])
    : where('storeId', 'in', normalizedStoreIds.slice(0, 10));

  console.log('[PromoService] Querying Firestore collection', {
    path: 'promotions',
    storeIds: normalizedStoreIds,
    limit: limitCount,
  });

  const q = query(
    promotionsRef,
    where('status', '==', 'live'),
    storeFilter,
    orderBy('startsAt', 'desc'),
    limit(limitCount)
  );

  const snapshot = await getDocs(q);
  console.log('[PromoService] Raw docs fetched', snapshot.size);

  const promos = snapshot.docs
    .map((doc) => normalize(doc.data(), doc.id))
    .filter((promo) => {
      const startsAt = promo.startsAt?.getTime();
      const endsAt = promo.endsAt?.getTime();
      if (startsAt === undefined) return false;
      if (startsAt > now) return false;
      if (endsAt !== undefined && endsAt < now) return false;
      if (!promo.storeId) return true;
      return normalizedStoreIds.length === 1
        ? promo.storeId.toLowerCase().includes(normalizedStoreIds[0])
        : normalizedStoreIds.some((id) => promo.storeId?.toLowerCase().includes(id));
    });

  console.log('[PromoService] Active promos after filter', promos.length);
  return promos;
}
