import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
import { CheckCircle } from 'lucide-react-native';
import Colors from '@/constants/colors';
import type { FakeDemoOrder } from '@/services/fakeDemoOrders';

interface OrderConfirmationModalProps {
  visible: boolean;
  order: FakeDemoOrder | null;
  onClose: () => void;
}

export const OrderConfirmationModal: React.FC<OrderConfirmationModalProps> = ({
  visible,
  order,
  onClose,
}) => {
  if (!order) return null;

  const orderDate = new Date(order.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <CheckCircle size={48} color={Colors.primary} strokeWidth={2} />
            </View>
            <Text style={styles.title}>Demo Order Placed!</Text>
            <Text style={styles.subtitle}>
              This is a demo build. No real order was created.
            </Text>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Order Details</Text>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Order #</Text>
                <Text style={styles.detailValue}>{order.id}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Status</Text>
                <View style={styles.statusBadge}>
                  <Text style={styles.statusText}>{order.status}</Text>
                </View>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Date</Text>
                <Text style={styles.detailValue}>{orderDate}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Store</Text>
                <Text style={styles.detailValue}>{order.storeName}</Text>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Items</Text>
              {order.items.map((item, index) => (
                <View key={index} style={styles.itemRow}>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemQty}>Qty: {item.quantity}</Text>
                  </View>
                  <Text style={styles.itemPrice}>{item.price}</Text>
                </View>
              ))}
            </View>

            <View style={styles.section}>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Subtotal</Text>
                <Text style={styles.totalValue}>{order.subtotal}</Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Tax</Text>
                <Text style={styles.totalValue}>{order.tax}</Text>
              </View>
              <View style={[styles.totalRow, styles.grandTotal]}>
                <Text style={styles.grandTotalLabel}>Total</Text>
                <Text style={styles.grandTotalValue}>{order.total}</Text>
              </View>
            </View>

            <View style={styles.demoNotice}>
              <Text style={styles.demoNoticeText}>
                💡 This demo order is saved locally and will appear in the Orders tab.
              </Text>
            </View>
          </ScrollView>

          <TouchableOpacity style={styles.button} onPress={onClose}>
            <Text style={styles.buttonText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const { height } = Dimensions.get('window');

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: height * 0.85,
    paddingBottom: 24,
  },
  header: {
    alignItems: 'center',
    paddingTop: 32,
    paddingHorizontal: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  iconContainer: {
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  detailLabel: {
    fontSize: 15,
    color: '#6B7280',
  },
  detailValue: {
    fontSize: 15,
    color: '#1F2937',
    fontWeight: '500',
  },
  statusBadge: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#059669',
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 15,
    color: '#1F2937',
    fontWeight: '500',
    marginBottom: 4,
  },
  itemQty: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  itemPrice: {
    fontSize: 15,
    color: '#1F2937',
    fontWeight: '600',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  totalLabel: {
    fontSize: 15,
    color: '#6B7280',
  },
  totalValue: {
    fontSize: 15,
    color: '#1F2937',
    fontWeight: '500',
  },
  grandTotal: {
    paddingTop: 12,
    marginTop: 8,
    borderTopWidth: 2,
    borderTopColor: '#E5E7EB',
  },
  grandTotalLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  grandTotalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.primary,
  },
  demoNotice: {
    marginTop: 24,
    backgroundColor: '#FEF3C7',
    padding: 16,
    borderRadius: 12,
  },
  demoNoticeText: {
    fontSize: 14,
    color: '#92400E',
    lineHeight: 20,
    textAlign: 'center',
  },
  button: {
    marginHorizontal: 24,
    marginTop: 16,
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
});

