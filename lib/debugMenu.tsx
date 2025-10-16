import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Modal } from 'react-native';
import { X } from 'lucide-react-native';
import { useApp } from '@/contexts/AppContext';
import { GREENHAUS } from '@/config/greenhaus';

export function DebugMenu() {
  const [visible, setVisible] = useState<boolean>(false);
  const { cartCount } = useApp();

  if (__DEV__ === false) {
    return null;
  }

  return (
    <>
      <TouchableOpacity
        style={styles.floatingButton}
        onPress={() => setVisible(true)}
      >
        <Text style={styles.floatingButtonText}>🐛</Text>
      </TouchableOpacity>

      <Modal
        visible={visible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.header}>
              <Text style={styles.title}>Debug Menu - GreenHaus</Text>
              <TouchableOpacity onPress={() => setVisible(false)}>
                <X size={24} color="#000" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.scrollView}>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Cart Count</Text>
                <Text style={styles.value}>{cartCount}</Text>
                <Text style={styles.info}>Updates from WebView injected JS</Text>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Tab URLs</Text>
                {Object.entries(GREENHAUS).filter(([key]) => 
                  ['home', 'search', 'cart', 'orders', 'profile'].includes(key)
                ).map(([key, url]) => (
                  <View key={key} style={styles.urlRow}>
                    <Text style={styles.label}>{key}:</Text>
                    <Text style={styles.urlText} numberOfLines={2}>{url as string}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Features</Text>
                <Text style={styles.feature}>✅ Shared cookies across all tabs</Text>
                <Text style={styles.feature}>✅ Auto tab switching (cart/orders/profile URLs)</Text>
                <Text style={styles.feature}>✅ Scroll to top on tab reselect</Text>
                <Text style={styles.feature}>✅ Breadcrumbs & footer hidden</Text>
                <Text style={styles.feature}>✅ Quick-links grid removed</Text>
                <Text style={styles.feature}>✅ Cart badge updates automatically</Text>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Navigation</Text>
                <Text style={styles.info}>• Home tab always reloads to {GREENHAUS.home}</Text>
                <Text style={styles.info}>• Other tabs scroll to top on reselect</Text>
                <Text style={styles.info}>• Cart/Account links auto-switch tabs</Text>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Cleanup</Text>
                <Text style={styles.info}>Injected CSS/JS removes:</Text>
                <Text style={styles.feature}>• Site header & footer</Text>
                <Text style={styles.feature}>• Breadcrumbs (Home / Store / ...)</Text>
                <Text style={styles.feature}>• Quick-links grid at bottom</Text>
                <Text style={styles.feature}>• Extra padding/gaps</Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  floatingButton: {
    position: 'absolute' as const,
    bottom: 100,
    right: 20,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#1E4D3A',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    zIndex: 9999,
  },
  floatingButtonText: {
    fontSize: 24,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end' as const,
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  title: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#000',
  },
  scrollView: {
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#1E4D3A',
    marginBottom: 8,
  },
  value: {
    fontSize: 32,
    fontWeight: '700' as const,
    color: '#000',
    marginBottom: 4,
  },
  urlRow: {
    marginBottom: 12,
    backgroundColor: '#F5F5F5',
    padding: 8,
    borderRadius: 6,
  },
  label: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#666',
    marginBottom: 4,
    textTransform: 'uppercase' as const,
  },
  urlText: {
    fontSize: 11,
    color: '#000',
    fontFamily: 'monospace',
  },
  info: {
    fontSize: 12,
    color: '#666',
    marginBottom: 6,
    lineHeight: 18,
  },
  feature: {
    fontSize: 12,
    color: '#333',
    marginBottom: 4,
    lineHeight: 18,
  },
});
