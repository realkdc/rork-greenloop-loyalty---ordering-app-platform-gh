import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { X, CheckCircle, XCircle } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import { TrackingService } from '@/services/tracking';
import Colors from '@/constants/colors';

export default function QRScannerScreen() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const { redeemCode } = useApp();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState<boolean>(true);
  const [result, setResult] = useState<{ success: boolean; points?: number; message: string } | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/auth');
    }
  }, [isAuthenticated, router]);

  if (!permission) {
    return (
      <>
        <Stack.Screen options={{ title: 'QR Scanner', headerShown: true }} />
        <View style={styles.container}>
          <Text style={styles.message}>Loading camera...</Text>
        </View>
      </>
    );
  }

  if (!permission.granted) {
    return (
      <>
        <Stack.Screen options={{ title: 'QR Scanner', headerShown: true }} />
        <View style={styles.container}>
          <Text style={styles.message}>We need camera permission to scan QR codes</Text>
          <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
            <Text style={styles.permissionButtonText}>Grant Permission</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  }

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (!scanning || !user) return;
    
    setScanning(false);
    console.log('QR Code scanned:', data);

    try {
      await TrackingService.logEvent('qr_scanned', user.id, { qrData: data });
      const scanResult = await redeemCode(data);
      setResult(scanResult);
    } catch (error) {
      console.error('Error processing QR code:', error);
      setResult({
        success: false,
        message: 'Error processing QR code',
      });
    }
  };

  if (!user) return null;

  const handleClose = () => {
    setResult(null);
    router.back();
  };

  const handleScanAgain = () => {
    setResult(null);
    setScanning(true);
  };

  return (
    <>
      <Stack.Screen 
        options={{ 
          title: 'Scan QR Code',
          headerShown: true,
          presentation: 'modal',
        }} 
      />
      <View style={styles.container}>
        <CameraView
          style={styles.camera}
          facing="back"
          onBarcodeScanned={scanning ? handleBarCodeScanned : undefined}
          barcodeScannerSettings={{
            barcodeTypes: ['qr'],
          }}
        >
          <View style={styles.overlay}>
            <View style={styles.scanArea}>
              <View style={[styles.corner, styles.topLeft]} />
              <View style={[styles.corner, styles.topRight]} />
              <View style={[styles.corner, styles.bottomLeft]} />
              <View style={[styles.corner, styles.bottomRight]} />
            </View>
            <Text style={styles.instruction}>
              Position QR code within the frame
            </Text>
          </View>
        </CameraView>

        <Modal
          visible={result !== null}
          transparent
          animationType="fade"
          onRequestClose={handleClose}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <TouchableOpacity 
                style={styles.modalClose}
                onPress={handleClose}
              >
                <X size={24} color={Colors.text} />
              </TouchableOpacity>

              {result && (
                <>
                  <View style={styles.resultIcon}>
                    {result.success ? (
                      <CheckCircle size={64} color={Colors.success} />
                    ) : (
                      <XCircle size={64} color={Colors.error} />
                    )}
                  </View>

                  <Text style={styles.resultTitle}>
                    {result.success ? 'Success!' : 'Oops!'}
                  </Text>

                  {result.success && result.points && (
                    <Text style={styles.pointsEarned}>
                      +{result.points} points
                    </Text>
                  )}

                  <Text style={styles.resultMessage}>{result.message}</Text>

                  <View style={styles.modalButtons}>
                    {result.success ? (
                      <TouchableOpacity 
                        style={styles.primaryButton}
                        onPress={handleClose}
                      >
                        <Text style={styles.primaryButtonText}>Done</Text>
                      </TouchableOpacity>
                    ) : (
                      <>
                        <TouchableOpacity 
                          style={styles.secondaryButton}
                          onPress={handleClose}
                        >
                          <Text style={styles.secondaryButtonText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={styles.primaryButton}
                          onPress={handleScanAgain}
                        >
                          <Text style={styles.primaryButtonText}>Try Again</Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                </>
              )}
            </View>
          </View>
        </Modal>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  message: {
    fontSize: 16,
    color: Colors.text,
    textAlign: 'center',
    padding: 24,
  },
  permissionButton: {
    backgroundColor: Colors.primary,
    padding: 16,
    borderRadius: 12,
    marginHorizontal: 24,
  },
  permissionButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanArea: {
    width: 250,
    height: 250,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: '#FFFFFF',
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
  },
  instruction: {
    fontSize: 16,
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 32,
    paddingHorizontal: 24,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    padding: 32,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  modalClose: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 1,
  },
  resultIcon: {
    marginBottom: 24,
  },
  resultTitle: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 8,
  },
  pointsEarned: {
    fontSize: 36,
    fontWeight: '700' as const,
    color: Colors.success,
    marginBottom: 16,
  },
  resultMessage: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  primaryButton: {
    flex: 1,
    backgroundColor: Colors.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: Colors.border,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
  },
});
