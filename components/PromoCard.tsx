import { memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import colors from '@/constants/colors';
import type { PromoRecord } from '@/src/lib/promos';

interface PromoCardProps {
  promo: PromoRecord;
  onPressView?: (url: string) => void;
  getCleanStoreName?: (storeId?: string | null) => string;
}

export const PromoCard = memo(function PromoCard({ promo, onPressView, getCleanStoreName }: PromoCardProps) {
  const canView = !!promo.deepLinkUrl;

  // Clean up store name for display - just show location
  const getLocationOnly = (storeId?: string | null) => {
    if (!storeId) return 'PROMO';
    
    if (storeId.includes('cookeville')) {
      return 'COOKEVILLE';
    } else if (storeId.includes('crossville')) {
      return 'CROSSVILLE';
    }
    
    // Extract last part after last dash
    const parts = storeId.split('-');
    return parts[parts.length - 1].toUpperCase();
  };

  const locationName = getLocationOnly(promo.storeId);

  return (
    <View style={styles.container} testID="promo-card">
      <View style={styles.header}>
        <Text style={styles.pill} numberOfLines={1}>{locationName}</Text>
        {promo.startsAt && (
          <Text style={styles.meta} numberOfLines={1}>
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
    minHeight: 32,
  },
  pill: {
    backgroundColor: colors.primary,
    color: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    alignSelf: 'flex-start',
  },
  meta: {
    fontSize: 12,
    color: colors.textLight,
    fontWeight: '500',
    flexShrink: 0,
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
