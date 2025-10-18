import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Animated, Dimensions } from 'react-native';
import { X, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { PromoCard } from './PromoCard';
import type { PromoRecord } from '@/src/lib/promos';

interface PromoPopupProps {
  visible: boolean;
  promos: PromoRecord[];
  onClose: () => void;
  onPressView?: (url: string) => void;
  storeName: string;
}

export const PromoPopup = ({ visible, promos, onClose, onPressView, storeName }: PromoPopupProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const fadeAnim = new Animated.Value(0);
  const slideAnim = new Animated.Value(50);

  useEffect(() => {
    if (visible) {
      setCurrentIndex(0);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 50,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const nextPromo = () => {
    if (currentIndex < promos.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const prevPromo = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  if (!visible || promos.length === 0) return null;

  const currentPromo = promos[currentIndex];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Animated.View 
          style={[
            styles.container,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            }
          ]}
        >
          <View style={styles.header}>
            <Text style={styles.title}>{storeName} Promotions</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            <PromoCard 
              promo={currentPromo} 
              onPressView={onPressView}
            />
          </View>

          {promos.length > 1 && (
            <View style={styles.navigation}>
              <TouchableOpacity 
                onPress={prevPromo} 
                style={[styles.navButton, currentIndex === 0 && styles.navButtonDisabled]}
                disabled={currentIndex === 0}
              >
                <ChevronLeft size={20} color={currentIndex === 0 ? "#9CA3AF" : "#1E4D3A"} />
              </TouchableOpacity>
              
              <View style={styles.dots}>
                {promos.map((_, index) => (
                  <View
                    key={index}
                    style={[
                      styles.dot,
                      index === currentIndex && styles.dotActive
                    ]}
                  />
                ))}
              </View>
              
              <TouchableOpacity 
                onPress={nextPromo} 
                style={[styles.navButton, currentIndex === promos.length - 1 && styles.navButtonDisabled]}
                disabled={currentIndex === promos.length - 1}
              >
                <ChevronRight size={20} color={currentIndex === promos.length - 1 ? "#9CA3AF" : "#1E4D3A"} />
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
};

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    width: width - 40,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E4D3A',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    padding: 20,
  },
  navigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  navButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  navButtonDisabled: {
    backgroundColor: '#F9FAFB',
  },
  dots: {
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D1D5DB',
  },
  dotActive: {
    backgroundColor: '#1E4D3A',
  },
});
