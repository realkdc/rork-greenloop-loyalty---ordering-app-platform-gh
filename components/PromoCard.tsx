import { memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import colors from '@/constants/colors';
import type { PromoRecord } from '@/src/lib/promo';

interface PromoCardProps {
  promo: PromoRecord;
  onPressView?: (url: string) => void;
}

export const PromoCard = memo(function PromoCard({ promo, onPressView }: PromoCardProps) {
  const canView = !!promo.deepLinkUrl;

  return (
    <View style={styles.container} testID="promo-card">
      <View style={styles.header}>
        <Text style={styles.pill}>{promo.storeName || promo.storeId?.toUpperCase() || 'PROMO'}</Text>
        {promo.startsAt && (
          <Text style={styles.meta}>
            {promo.startsAt.toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
            })}
          </Text>
        )}
      </View>
      <Text style={styles.title}>{promo.title}</Text>
      {!!promo.body && <Text style={styles.body}>{promo.body}</Text>}
      {canView && onPressView && (
        <TouchableOpacity
          onPress={() => onPressView(promo.deepLinkUrl as string)}
          activeOpacity={0.75}
          style={styles.cta}
        >
          <Text style={styles.ctaText}>View</Text>
        </TouchableOpacity>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: '#F9FAFB',
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pill: {
    backgroundColor: colors.primary,
    color: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  meta: {
    fontSize: 12,
    color: colors.textLight,
    marginLeft: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  body: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  cta: {
    marginTop: 12,
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
