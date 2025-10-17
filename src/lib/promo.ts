import {
  collection,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
  where,
  DocumentData,
} from 'firebase/firestore';
import type { Timestamp } from 'firebase/firestore';
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

export async function getLivePromos(now = Date.now()): Promise<PromoRecord[]> {
  const nowDate = new Date(now);
  const promotionsRef = collection(firestore, 'promotions');

  const baseQuery = query(
    promotionsRef,
    where('status', '==', 'live'),
    where('startsAt', '<=', nowDate),
    orderBy('startsAt', 'desc'),
    limit(10)
  );

  const snapshot = await getDocs(baseQuery);
  const promos = snapshot.docs.map((doc) => normalize(doc.data(), doc.id));

  const livePromos = promos
    .filter((promo) => {
      if (!promo.startsAt) return false;
      if (promo.startsAt.getTime() > now) return false;
      if (promo.endsAt && promo.endsAt.getTime() <= now) return false;
      return true;
    })
    .sort((a, b) => (b.startsAt?.getTime() ?? 0) - (a.startsAt?.getTime() ?? 0))
    .slice(0, 3);

  return livePromos;
}
