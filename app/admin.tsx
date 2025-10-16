import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal, Alert, Platform } from 'react-native';
import { Stack } from 'expo-router';
import { Plus, Trash2, Eye, EyeOff } from 'lucide-react-native';
import { CampaignService } from '@/services/campaigns';
import { StorageService } from '@/services/storage';
import { useApp } from '@/contexts/AppContext';
import Colors from '@/constants/colors';
import type { Campaign, Event } from '@/types';

export default function AdminScreen() {
  const { campaigns, refreshCampaigns } = useApp();
  const [events, setEvents] = useState<Event[]>([]);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [showEventsModal, setShowEventsModal] = useState<boolean>(false);
  const [newCampaign, setNewCampaign] = useState<Partial<Campaign>>({
    name: '',
    code: '',
    pointsReward: 100,
    description: '',
    active: true,
  });

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    const allEvents = await StorageService.getEvents();
    setEvents(allEvents.slice(0, 50));
  };

  const handleAddCampaign = async () => {
    if (!newCampaign.name || !newCampaign.code) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    await CampaignService.addCampaign(newCampaign as Omit<Campaign, 'id'>);
    await refreshCampaigns();
    setShowAddModal(false);
    setNewCampaign({
      name: '',
      code: '',
      pointsReward: 100,
      description: '',
      active: true,
    });
  };

  const handleToggleActive = async (campaign: Campaign) => {
    await CampaignService.updateCampaign(campaign.id, { active: !campaign.active });
    await refreshCampaigns();
  };

  const handleDeleteCampaign = async (id: string) => {
    Alert.alert(
      'Delete Campaign',
      'Are you sure you want to delete this campaign?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await CampaignService.deleteCampaign(id);
            await refreshCampaigns();
          },
        },
      ]
    );
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Admin Dashboard' }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Campaigns</Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => setShowAddModal(true)}
            >
              <Plus size={20} color="#FFFFFF" />
              <Text style={styles.addButtonText}>Add</Text>
            </TouchableOpacity>
          </View>

          {campaigns.map((campaign) => (
            <View key={campaign.id} style={styles.campaignCard}>
              <View style={styles.campaignHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.campaignName}>{campaign.name}</Text>
                  <Text style={styles.campaignCode}>Code: {campaign.code}</Text>
                </View>
                <View style={styles.campaignActions}>
                  <TouchableOpacity onPress={() => handleToggleActive(campaign)}>
                    {campaign.active ? (
                      <Eye size={20} color={Colors.success} />
                    ) : (
                      <EyeOff size={20} color={Colors.textLight} />
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDeleteCampaign(campaign.id)}>
                    <Trash2 size={20} color={Colors.error} />
                  </TouchableOpacity>
                </View>
              </View>
              <Text style={styles.campaignDescription}>{campaign.description}</Text>
              <View style={styles.campaignFooter}>
                <Text style={styles.campaignPoints}>{campaign.pointsReward} points</Text>
                {campaign.maxRedemptionsPerUser && (
                  <Text style={styles.campaignLimit}>
                    Max: {campaign.maxRedemptionsPerUser}x per user
                  </Text>
                )}
              </View>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Events</Text>
            <TouchableOpacity onPress={() => setShowEventsModal(true)}>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>

          {events.slice(0, 10).map((event) => (
            <View key={event.id} style={styles.eventCard}>
              <View style={styles.eventHeader}>
                <Text style={styles.eventType}>{event.type}</Text>
                <Text style={styles.eventTime}>
                  {event.timestamp.toLocaleTimeString()}
                </Text>
              </View>
              <Text style={styles.eventUser}>User: {event.userId}</Text>
              {event.campaignId && (
                <Text style={styles.eventCampaign}>Campaign: {event.campaignId}</Text>
              )}
            </View>
          ))}
        </View>
      </ScrollView>

      <Modal
        visible={showAddModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Campaign</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="Campaign name"
                value={newCampaign.name}
                onChangeText={(text) => setNewCampaign({ ...newCampaign, name: text })}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Code *</Text>
              <TextInput
                style={styles.input}
                placeholder="PROMO2025"
                value={newCampaign.code}
                onChangeText={(text) => setNewCampaign({ ...newCampaign, code: text.toUpperCase() })}
                autoCapitalize="characters"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Points Reward *</Text>
              <TextInput
                style={styles.input}
                placeholder="100"
                value={String(newCampaign.pointsReward || '')}
                onChangeText={(text) => setNewCampaign({ ...newCampaign, pointsReward: parseInt(text) || 0 })}
                keyboardType="number-pad"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Campaign description"
                value={newCampaign.description}
                onChangeText={(text) => setNewCampaign({ ...newCampaign, description: text })}
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowAddModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleAddCampaign}
              >
                <Text style={styles.saveButtonText}>Add Campaign</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showEventsModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEventsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '80%' }]}>
            <Text style={styles.modalTitle}>All Events</Text>
            <ScrollView style={styles.eventsScroll}>
              {events.map((event) => (
                <View key={event.id} style={styles.eventCard}>
                  <View style={styles.eventHeader}>
                    <Text style={styles.eventType}>{event.type}</Text>
                    <Text style={styles.eventTime}>
                      {event.timestamp.toLocaleString()}
                    </Text>
                  </View>
                  <Text style={styles.eventUser}>User: {event.userId}</Text>
                  {event.campaignId && (
                    <Text style={styles.eventCampaign}>Campaign: {event.campaignId}</Text>
                  )}
                  {event.metadata && (
                    <Text style={styles.eventMetadata}>
                      {JSON.stringify(event.metadata, null, 2)}
                    </Text>
                  )}
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowEventsModal(false)}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  campaignCard: {
    backgroundColor: Colors.surface,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  campaignHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  campaignName: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  campaignCode: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  campaignActions: {
    flexDirection: 'row',
    gap: 16,
  },
  campaignDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 12,
  },
  campaignFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  campaignPoints: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.primary,
  },
  campaignLimit: {
    fontSize: 12,
    color: Colors.textLight,
  },
  eventCard: {
    backgroundColor: Colors.surface,
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  eventType: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  eventTime: {
    fontSize: 12,
    color: Colors.textLight,
  },
  eventUser: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  eventCampaign: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  eventMetadata: {
    fontSize: 10,
    color: Colors.textLight,
    marginTop: 4,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 24,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: Colors.text,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: Colors.border,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  saveButton: {
    flex: 1,
    backgroundColor: Colors.primary,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  eventsScroll: {
    maxHeight: 400,
  },
  closeButton: {
    backgroundColor: Colors.primary,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
});
