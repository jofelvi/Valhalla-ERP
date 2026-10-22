import React, { useState, useEffect, useCallback } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '../../store';
import { attendanceService } from '../../services/attendanceService';
import { locationService } from '../../services/locationService';
import { Attendance, GpsCoordinates } from '../../types';
import {
  COLORS,
  SPACING,
  FONT_SIZE,
  FONT_WEIGHT,
  BORDER_RADIUS,
  SHADOWS,
} from '../../constants';
import { Button } from '../../components/ui';
import { showAlert } from '../../utils/alert';

type AttendanceState = 'no_checkin' | 'checked_in' | 'completed';

const formatTime = (date: Date | undefined): string => {
  if (!date) return '--:--';
  return date.toLocaleTimeString('es-VE', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatDuration = (start: Date | undefined, end?: Date): string => {
  if (!start) return '0h 0m';
  const endTime = end ?? new Date();
  const diffMs = endTime.getTime() - start.getTime();
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m`;
};

export const WaiterAttendanceScreen: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  const [attendance, setAttendance] = useState<Attendance | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selfieUri, setSelfieUri] = useState<string | null>(null);
  const [coords, setCoords] = useState<GpsCoordinates | null>(null);
  const [isInGeofence, setIsInGeofence] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [durationTick, setDurationTick] = useState(0);

  const getState = useCallback((): AttendanceState => {
    if (!attendance) return 'no_checkin';
    if (attendance.checkIn && !attendance.checkOut) return 'checked_in';
    return 'completed';
  }, [attendance]);

  // Suscripcion real-time a la asistencia de hoy
  // Si el indice de Firestore aun no esta listo, hace fallback a query directa
  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    const unsubscribe = attendanceService.subscribeToTodayAttendance(
      user.uid,
      (att) => {
        if (!cancelled) {
          setAttendance(att);
          setIsLoading(false);
        }
      },
    );

    // Fallback: si despues de 5s sigue loading, intentar query directa
    const timeout = setTimeout(async () => {
      if (!cancelled && isLoading) {
        try {
          const att = await attendanceService.getTodayAttendance(user.uid);
          if (!cancelled) {
            setAttendance(att);
            setIsLoading(false);
          }
        } catch (error) {
          console.error('Error cargando asistencia (fallback):', error);
          if (!cancelled) {
            setIsLoading(false);
          }
        }
      }
    }, 5000);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      unsubscribe();
    };
  }, [user]);

  // Tick para actualizar duracion
  useEffect(() => {
    if (getState() !== 'checked_in') return;
    const interval = setInterval(() => setDurationTick((t) => t + 1), 60_000);
    return () => clearInterval(interval);
  }, [getState]);

  // Verificar ubicacion
  const checkLocation = useCallback(async () => {
    setLocationError(null);
    try {
      const granted = await locationService.requestPermissions();
      if (!granted) {
        setLocationError('Permisos de ubicacion denegados');
        return;
      }
      const currentCoords = await locationService.getCurrentLocation();
      setCoords(currentCoords);
      const inGeofence = await locationService.isWithinGeofence(currentCoords);
      setIsInGeofence(inGeofence);
    } catch {
      setLocationError('No se pudo obtener la ubicacion');
    }
  }, []);

  // Al montar, verificar ubicacion
  useEffect(() => {
    checkLocation();
  }, [checkLocation]);

  const handleTakeSelfie = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      showAlert(
        'Permisos',
        'Se necesitan permisos de camara para tomar la foto',
      );
      return;
    }

    // SEGURIDAD: launchCameraAsync solo abre la camara, NO permite seleccionar de galeria
    // SEGURIDAD: cameraType.front — selfie en vivo cerca del logo del local
    // SEGURIDAD: allowsEditing: false para que no pueda recortar/manipular la foto
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.7,
      cameraType: ImagePicker.CameraType.front,
      exif: true,
    });

    if (!result.canceled && result.assets[0]) {
      setSelfieUri(result.assets[0].uri);
      // Actualizar ubicacion al tomar la foto
      await checkLocation();
    }
  };

  const handleCheckIn = async () => {
    if (!user || !selfieUri || !coords || !isInGeofence) return;

    setIsSubmitting(true);
    try {
      const photoUrl = await attendanceService.uploadSelfie(
        selfieUri,
        user.uid,
      );
      await attendanceService.checkIn(user.uid, photoUrl, coords);
      setSelfieUri(null);
      showAlert(
        'Entrada registrada',
        'Tu asistencia ha sido registrada correctamente',
      );
    } catch (error) {
      console.error('Error en check-in:', error);
      const message =
        error instanceof Error
          ? error.message
          : 'No se pudo registrar la entrada. Intenta de nuevo.';
      showAlert('Error', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCheckOut = async () => {
    if (!user || !attendance || !selfieUri || !coords || !isInGeofence) return;

    setIsSubmitting(true);
    try {
      const photoUrl = await attendanceService.uploadSelfie(
        selfieUri,
        user.uid,
      );
      await attendanceService.checkOut(user.uid, photoUrl, coords);
      setSelfieUri(null);
      showAlert(
        'Salida registrada',
        'Tu salida ha sido registrada correctamente',
      );
    } catch (error) {
      console.error('Error en check-out:', error);
      const message =
        error instanceof Error
          ? error.message
          : 'No se pudo registrar la salida. Intenta de nuevo.';
      showAlert('Error', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Cargando asistencia...</Text>
      </View>
    );
  }

  const currentState = getState();

  // Estado: Turno completado
  if (currentState === 'completed' && attendance) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.completedCard}>
            <View style={styles.completedIconContainer}>
              <Ionicons
                name="checkmark-circle"
                size={64}
                color={COLORS.success}
              />
            </View>
            <Text style={styles.completedTitle}>Turno completado</Text>
            <Text style={styles.completedSubtitle}>
              Has terminado tu jornada de hoy
            </Text>

            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <View style={styles.summaryItem}>
                  <Ionicons
                    name="log-in-outline"
                    size={20}
                    color={COLORS.primary}
                  />
                  <Text style={styles.summaryLabel}>Entrada</Text>
                  <Text style={styles.summaryValue}>
                    {formatTime(attendance.checkIn)}
                  </Text>
                </View>
                <View style={styles.summaryItem}>
                  <Ionicons
                    name="log-out-outline"
                    size={20}
                    color={COLORS.primary}
                  />
                  <Text style={styles.summaryLabel}>Salida</Text>
                  <Text style={styles.summaryValue}>
                    {formatTime(attendance.checkOut)}
                  </Text>
                </View>
              </View>
              <View style={styles.divider} />
              <View style={styles.totalHoursContainer}>
                <Ionicons
                  name="time-outline"
                  size={20}
                  color={COLORS.primary}
                />
                <Text style={styles.totalHoursLabel}>Horas trabajadas</Text>
                <Text style={styles.totalHoursValue}>
                  {formatDuration(attendance.checkIn, attendance.checkOut)}
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Estado: Check-in activo (mostrando info + opcion de check-out)
  if (currentState === 'checked_in' && attendance) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.activeCard}>
            <View style={styles.activeHeader}>
              <View style={styles.activeDot} />
              <Text style={styles.activeTitle}>Turno activo</Text>
            </View>

            <View style={styles.activeInfoRow}>
              <Ionicons
                name="log-in-outline"
                size={18}
                color={COLORS.textSecondary}
              />
              <Text style={styles.activeInfoLabel}>Entrada:</Text>
              <Text style={styles.activeInfoValue}>
                {formatTime(attendance.checkIn)}
              </Text>
            </View>

            <View style={styles.activeInfoRow}>
              <Ionicons
                name="timer-outline"
                size={18}
                color={COLORS.textSecondary}
              />
              <Text style={styles.activeInfoLabel}>Duracion:</Text>
              <Text style={styles.activeInfoValue} key={durationTick}>
                {formatDuration(attendance.checkIn)}
              </Text>
            </View>
          </View>

          {/* Selfie + GPS para check-out */}
          <Text style={styles.sectionTitle}>Registrar salida</Text>

          {selfieUri ? (
            <View style={styles.selfieContainer}>
              <Image source={{ uri: selfieUri }} style={styles.selfieImage} />
              <Button
                label="Tomar otra"
                variant="secondary"
                size="sm"
                icon={
                  <Ionicons
                    name="camera-reverse-outline"
                    size={18}
                    color={COLORS.text}
                  />
                }
                iconPosition="left"
                onPress={handleTakeSelfie}
              />
            </View>
          ) : (
            <TouchableOpacity
              style={styles.cameraButton}
              onPress={handleTakeSelfie}
            >
              <Ionicons
                name="camera-outline"
                size={32}
                color={COLORS.primary}
              />
              <Text style={styles.cameraButtonText}>
                Tomar selfie cerca del logo
              </Text>
              <Text style={styles.cameraHint}>
                Acércate al logo del local — debe verse claramente en la foto
              </Text>
            </TouchableOpacity>
          )}

          {/* GPS Status */}
          <View style={styles.gpsContainer}>
            <View
              style={[
                styles.gpsDot,
                {
                  backgroundColor: isInGeofence ? COLORS.success : COLORS.error,
                },
              ]}
            />
            <Text
              style={[
                styles.gpsText,
                { color: isInGeofence ? COLORS.success : COLORS.error },
              ]}
            >
              {locationError
                ? locationError
                : isInGeofence
                  ? 'Estas en el club'
                  : 'Debes estar en el club para registrar salida'}
            </Text>
            <TouchableOpacity onPress={checkLocation} style={styles.refreshGps}>
              <Ionicons
                name="refresh-outline"
                size={18}
                color={COLORS.textSecondary}
              />
            </TouchableOpacity>
          </View>

          <Button
            label="Registrar Salida"
            variant="primary"
            size="lg"
            icon={
              <Ionicons
                name="log-out-outline"
                size={22}
                color={COLORS.background}
              />
            }
            iconPosition="left"
            loading={isSubmitting}
            disabled={!selfieUri || !isInGeofence || isSubmitting}
            onPress={handleCheckOut}
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Estado: Sin check-in (flujo de entrada)
  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerCard}>
          <Ionicons
            name="finger-print-outline"
            size={48}
            color={COLORS.primary}
          />
          <Text style={styles.headerTitle}>Registro de Asistencia</Text>
          <Text style={styles.headerSubtitle}>
            Tómate una selfie cerca del logo del local para registrar tu entrada
          </Text>
        </View>

        {/* Foto del logo */}
        {selfieUri ? (
          <View style={styles.selfieContainer}>
            <Image source={{ uri: selfieUri }} style={styles.selfieImage} />
            <Button
              label="Tomar otra"
              variant="secondary"
              size="sm"
              icon={
                <Ionicons
                  name="camera-reverse-outline"
                  size={18}
                  color={COLORS.text}
                />
              }
              iconPosition="left"
              onPress={handleTakeSelfie}
            />
          </View>
        ) : (
          <TouchableOpacity
            style={styles.cameraButton}
            onPress={handleTakeSelfie}
          >
            <Ionicons name="camera-outline" size={32} color={COLORS.primary} />
            <Text style={styles.cameraButtonText}>
              Tomar selfie cerca del logo
            </Text>
            <Text style={styles.cameraHint}>
              Acércate al logo del local — debe verse claramente en la foto
            </Text>
          </TouchableOpacity>
        )}

        {/* GPS Status */}
        <View style={styles.gpsContainer}>
          <View
            style={[
              styles.gpsDot,
              { backgroundColor: isInGeofence ? COLORS.success : COLORS.error },
            ]}
          />
          <Text
            style={[
              styles.gpsText,
              { color: isInGeofence ? COLORS.success : COLORS.error },
            ]}
          >
            {locationError
              ? locationError
              : isInGeofence
                ? 'Estas en el club'
                : 'Debes estar en el club para registrar entrada'}
          </Text>
          <TouchableOpacity onPress={checkLocation} style={styles.refreshGps}>
            <Ionicons
              name="refresh-outline"
              size={18}
              color={COLORS.textSecondary}
            />
          </TouchableOpacity>
        </View>

        <Button
          label="Registrar Entrada"
          variant="primary"
          size="lg"
          icon={
            <Ionicons
              name="log-in-outline"
              size={22}
              color={COLORS.background}
            />
          }
          iconPosition="left"
          loading={isSubmitting}
          disabled={!selfieUri || !isInGeofence || isSubmitting}
          onPress={handleCheckIn}
        />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.backgroundSecondary,
  },
  scroll: {
    flex: 1,
  },
  // flexGrow (no flex): en un telefono chico el contenido debe poder crecer
  // mas alto que la pantalla para que el boton de fichar quede alcanzable
  // haciendo scroll. Con flex:1 se comprimia y el boton se salia de la vista.
  content: {
    flexGrow: 1,
    padding: SPACING.lg,
    paddingBottom: SPACING.xl,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
  },
  // Header (sin check-in)
  headerCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.xl,
    alignItems: 'center',
    marginBottom: SPACING.xl,
    ...SHADOWS.small,
  },
  headerTitle: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.text,
    marginTop: SPACING.md,
  },
  headerSubtitle: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.sm,
  },
  // Selfie
  selfieContainer: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  selfieImage: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 3,
    borderColor: COLORS.primary,
    marginBottom: SPACING.sm,
  },
  cameraButton: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.xxl,
    alignItems: 'center',
    marginBottom: SPACING.lg,
    borderWidth: 2,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    ...SHADOWS.small,
  },
  cameraButtonText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    marginTop: SPACING.sm,
    fontWeight: FONT_WEIGHT.semibold,
  },
  cameraHint: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
    fontStyle: 'italic',
  },
  // GPS
  gpsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.xl,
    ...SHADOWS.small,
  },
  gpsDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: SPACING.sm,
  },
  gpsText: {
    flex: 1,
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
  },
  refreshGps: {
    padding: SPACING.xs,
  },
  // Active state
  activeCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.xl,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.success,
    ...SHADOWS.small,
  },
  activeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  activeDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.success,
    marginRight: SPACING.sm,
  },
  activeTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.success,
  },
  activeInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  activeInfoLabel: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
  },
  activeInfoValue: {
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
    fontWeight: FONT_WEIGHT.semibold,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  // Completed state
  completedCard: {
    alignItems: 'center',
    paddingTop: SPACING.xxxl,
  },
  completedIconContainer: {
    marginBottom: SPACING.lg,
  },
  completedTitle: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  completedSubtitle: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xxl,
  },
  summaryCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    width: '100%',
    ...SHADOWS.small,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
    gap: SPACING.xs,
  },
  summaryLabel: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
  },
  summaryValue: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.text,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.md,
  },
  totalHoursContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  totalHoursLabel: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
  },
  totalHoursValue: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.primary,
  },
});
