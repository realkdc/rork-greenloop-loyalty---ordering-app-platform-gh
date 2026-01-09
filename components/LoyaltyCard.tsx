import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { TIERS, getTierByPoints, getNextTier } from '@/constants/tiers';
import type { TierLevel } from '@/types';

interface LoyaltyCardProps {
  points: number;
  tier: TierLevel;
  customerName?: string;
}

export function LoyaltyCard({ points, tier, customerName }: LoyaltyCardProps) {
  const currentTier = getTierByPoints(points);
  const nextTier = getNextTier(points);
  const progressToNext = nextTier 
    ? Math.min(100, ((points - currentTier.minPoints) / (nextTier.minPoints - currentTier.minPoints)) * 100)
    : 100;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[currentTier.color, `${currentTier.color}CC`]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <View style={styles.content}>
          <Text style={styles.label}>LOYALTY POINTS</Text>
          <Text style={styles.points}>{points.toLocaleString()}</Text>
          <View style={styles.tierContainer}>
            <View style={[styles.tierBadge, { backgroundColor: currentTier.color }]}>
              <Text style={styles.tierText}>{currentTier.name.toUpperCase()}</Text>
            </View>
          </View>
          
          {nextTier && (
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View 
                  style={[
                    styles.progressFill, 
                    { width: `${progressToNext}%`, backgroundColor: nextTier.color }
                  ]} 
                />
              </View>
              <Text style={styles.progressText}>
                {nextTier.minPoints - points} points until {nextTier.name}
              </Text>
            </View>
          )}
          
          {!nextTier && (
            <View style={styles.maxTierContainer}>
              <Text style={styles.maxTierText}>⭐ MAX TIER ACHIEVED ⭐</Text>
            </View>
          )}
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    overflow: 'hidden',
    marginHorizontal: 20,
    marginVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  gradient: {
    padding: 20,
  },
  content: {
    alignItems: 'center',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
    opacity: 0.9,
    letterSpacing: 1,
    marginBottom: 8,
  },
  points: {
    fontSize: 48,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  tierContainer: {
    marginBottom: 16,
  },
  tierBadge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  tierText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  progressContainer: {
    width: '100%',
    marginTop: 8,
  },
  progressBar: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    color: '#FFFFFF',
    opacity: 0.9,
    textAlign: 'center',
  },
  maxTierContainer: {
    marginTop: 8,
  },
  maxTierText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
});
