/**
 * Fake Orders List for Apple Review
 * 
 * Displays fake demo orders when in review mode. Overlays on top of the Orders WebView.
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Package, CheckCircle, Clock } from 'lucide-react-native';
import { REVIEW_BUILD, REVIEW_DEMO_FAKE_CHECKOUT } from '@/constants/config';
import { FakeDemoOrdersService, type FakeDemoOrder } from '@/services/fakeDemoOrders';
import Colors from '@/constants/colors';

export const FakeOrdersList: React.FC = () => {
  const [orders, setOrders] = useState<FakeDemoOrder[]>([]);

  useEffect(() => {
    if (REVIEW_BUILD && REVIEW_DEMO_FAKE_CHECKOUT) {
      FakeDemoOrdersService.getOrders().then(setOrders);
    }
  }, []);

  if (!REVIEW_BUILD || !REVIEW_DEMO_FAKE_CHECKOUT || orders.length === 0) {
    return null;
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Confirmed':
        return <CheckCircle size={20} color="#10B981" />;
      case 'Processing':
        return <Clock size={20} color="#F59E0B" />;
      case 'Completed':
        return <CheckCircle size={20} color="#3B82F6" />;
      default:
        return <Package size={20} color="#6B7280" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Confirmed':
        return '#D1FAE5';
      case 'Processing':
        return '#FEF3C7';
      case 'Completed':
        return '#DBEAFE';
      default:
        return '#F3F4F6';
    }
  };

  const getStatusTextColor = (status: string) => {
    switch (status) {
      case 'Confirmed':
        return '#059669';
      case 'Processing':
        return '#D97706';
      case 'Completed':
        return '#2563EB';
      default:
        return '#6B7280';
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Demo Orders</Text>
        <View style={styles.demoBadge}>
          <Text style={styles.demoBadgeText}>For Review Only</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {orders.map((order) => {
          const orderDate = new Date(order.createdAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          });

          return (
            <TouchableOpacity
              key={order.id}
              style={styles.orderCard}
              activeOpacity={0.8}
            >
              <View style={styles.orderHeader}>
                <View style={styles.orderIdRow}>
                  <Text style={styles.orderId}>#{order.id}</Text>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: getStatusColor(order.status) },
                    ]}
                  >
                    {getStatusIcon(order.status)}
                    <Text
                      style={[
                        styles.statusText,
                        { color: getStatusTextColor(order.status) },
                      ]}
                    >
                      {order.status}
                    </Text>
                  </View>
                </View>
                <Text style={styles.orderDate}>{orderDate}</Text>
              </View>

              <View style={styles.orderDetails}>
                <Text style={styles.storeName}>{order.storeName}</Text>
                
                <View style={styles.itemsContainer}>
                  {order.items.slice(0, 2).map((item, idx) => (
                    <View key={idx} style={styles.itemRow}>
                      <Text style={styles.itemName} numberOfLines={1}>
                        {item.quantity}x {item.name}
                      </Text>
                      <Text style={styles.itemPrice}>{item.price}</Text>
                    </View>
                  ))}
                  {order.items.length > 2 && (
                    <Text style={styles.moreItems}>
                      + {order.items.length - 2} more item{order.items.length - 2 > 1 ? 's' : ''}
                    </Text>
                  )}
                </View>

                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Total</Text>
                  <Text style={styles.totalValue}>{order.total}</Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          💡 These are demo orders created during App Review. Real orders will sync from your website account.
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  demoBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  demoBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#92400E',
  },
  scrollView: {
    flex: 1,
  },
  orderCard: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  orderHeader: {
    marginBottom: 12,
  },
  orderIdRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  orderId: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  orderDate: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  orderDetails: {
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 12,
  },
  storeName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  itemsContainer: {
    marginBottom: 12,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  itemName: {
    flex: 1,
    fontSize: 14,
    color: '#6B7280',
    marginRight: 12,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
  },
  moreItems: {
    fontSize: 13,
    color: '#9CA3AF',
    fontStyle: 'italic',
    marginTop: 4,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.primary,
  },
  footer: {
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  footerText: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 18,
  },
});

