import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import {
  COLORS,
  SPACING,
  FONT_SIZE,
  FONT_WEIGHT,
  SHADOWS,
  BORDER_RADIUS,
} from '../../constants';
import { formatearUsd, formatearBs } from '../../utils/dinero';
import {
  cashRegisterService,
  CashRegisterSession,
  CashRegisterEvent,
} from '../../services/cashRegisterService';
import { useAuthStore } from '../../store';

const formatDate = (date: Date | null): string => {
  if (!date) return '';
  return date.toLocaleDateString('es-VE', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  });
};

const formatTime = (date: Date | null): string => {
  if (!date) return '--:--';
  return date.toLocaleTimeString('es-VE', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

const EVENT_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  session_opened: 'lock-open-outline',
  session_closed: 'lock-closed-outline',
  order_created: 'receipt-outline',
  payment_processed: 'cash-outline',
  table_freed: 'restaurant-outline',
  comanda_printed: 'print-outline',
};

const EVENT_COLORS: Record<string, string> = {
  session_opened: COLORS.success,
  session_closed: COLORS.error,
  order_created: COLORS.primary,
  payment_processed: COLORS.success,
  table_freed: COLORS.info,
  comanda_printed: COLORS.textSecondary,
};

export const CashierHistoryScreen: React.FC = () => {
  const navigation = useNavigation();
  const user = useAuthStore((s) => s.user);
  const [sessions, setSessions] = useState<CashRegisterSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(
    null,
  );
  const [events, setEvents] = useState<CashRegisterEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);

  useEffect(() => {
    if (!user) return;
    cashRegisterService
      .getSessionHistory(user.uid, 30)
      .then((data) => {
        setSessions(data);
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  }, [user]);

  const handleToggleSession = async (sessionId: string) => {
    if (expandedSessionId === sessionId) {
      setExpandedSessionId(null);
      setEvents([]);
      return;
    }

    setExpandedSessionId(sessionId);
    setLoadingEvents(true);
    try {
      const sessionEvents =
        await cashRegisterService.getSessionEvents(sessionId);
      setEvents(sessionEvents);
    } catch {
      setEvents([]);
    } finally {
      setLoadingEvents(false);
    }
  };

  const getDuration = (session: CashRegisterSession): string => {
    if (!session.openedAt || !session.closedAt) return '';
    const diff = session.closedAt.getTime() - session.openedAt.getTime();
    const hours = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    if (hours > 0) return `${hours}h ${mins}min`;
    return `${mins}min`;
  };

  const renderSession = ({ item: session }: { item: CashRegisterSession }) => {
    const isExpanded = expandedSessionId === session.id;

    return (
      <View style={styles.sessionCard}>
        <TouchableOpacity
          style={styles.sessionHeader}
          onPress={() => handleToggleSession(session.id)}
          activeOpacity={0.7}
        >
          <View style={styles.sessionHeaderLeft}>
            <View style={styles.sessionDateBadge}>
              <Text style={styles.sessionDateText}>
                {formatDate(session.closedAt)}
              </Text>
            </View>
            <View>
              <Text style={styles.sessionTime}>
                {formatTime(session.openedAt)} — {formatTime(session.closedAt)}
              </Text>
              <Text style={styles.sessionDuration}>{getDuration(session)}</Text>
            </View>
          </View>
          <View style={styles.sessionHeaderRight}>
            {session.summary && (
              <View style={styles.sessionTotalBadge}>
                <Text style={styles.sessionTotalText}>
                  {formatearUsd(session.summary.totalAmount)}
                </Text>
              </View>
            )}
            <Ionicons
              name={isExpanded ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={COLORS.textSecondary}
            />
          </View>
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.sessionContent}>
            {/* Summary */}
            {session.summary && (
              <View style={styles.summarySection}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Ordenes</Text>
                  <Text style={styles.summaryValue}>
                    {session.summary.totalOrders}
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Total USD</Text>
                  <Text style={styles.summaryValuePrimary}>
                    {formatearUsd(session.summary.totalAmount)}
                  </Text>
                </View>
                {session.summary.totalAmountBs > 0 && (
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Total Bs</Text>
                    <Text style={styles.summaryValue}>
                      {formatearBs(session.summary.totalAmountBs)}
                    </Text>
                  </View>
                )}

                {session.summary.byPaymentMethod.length > 0 && (
                  <>
                    <View style={styles.divider} />
                    {session.summary.byPaymentMethod.map((pm) => (
                      <View key={pm.method} style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>
                          {pm.methodLabel} ({pm.count})
                        </Text>
                        <Text style={styles.summaryValue}>
                          {formatearUsd(pm.amount)}
                        </Text>
                      </View>
                    ))}
                  </>
                )}
              </View>
            )}

            {/* Timeline */}
            <View style={styles.timelineSection}>
              <Text style={styles.timelineTitle}>Timeline</Text>
              {loadingEvents ? (
                <ActivityIndicator
                  size="small"
                  color={COLORS.primary}
                  style={{ paddingVertical: SPACING.md }}
                />
              ) : events.length === 0 ? (
                <Text style={styles.noEventsText}>Sin eventos registrados</Text>
              ) : (
                events.map((event, index) => (
                  <View key={event.id} style={styles.timelineItem}>
                    <View style={styles.timelineLine}>
                      <View
                        style={[
                          styles.timelineDot,
                          {
                            backgroundColor:
                              EVENT_COLORS[event.type] ?? COLORS.textSecondary,
                          },
                        ]}
                      />
                      {index < events.length - 1 && (
                        <View style={styles.timelineConnector} />
                      )}
                    </View>
                    <View style={styles.timelineContent}>
                      <View style={styles.timelineHeader}>
                        <Ionicons
                          name={EVENT_ICONS[event.type] ?? 'ellipse-outline'}
                          size={14}
                          color={
                            EVENT_COLORS[event.type] ?? COLORS.textSecondary
                          }
                        />
                        <Text style={styles.timelineTime}>
                          {formatTime(event.createdAt)}
                        </Text>
                      </View>
                      <Text style={styles.timelineDescription}>
                        {event.description}
                      </Text>
                      {event.amount != null && event.amount > 0 && (
                        <Text style={styles.timelineAmount}>
                          {formatearUsd(event.amount)}
                        </Text>
                      )}
                    </View>
                  </View>
                ))
              )}
            </View>
          </View>
        )}
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Cargando historial...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={sessions}
        keyExtractor={(item) => item.id}
        renderItem={renderSession}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIcon}>
              <Ionicons
                name="time-outline"
                size={48}
                color={`${COLORS.primary}60`}
              />
            </View>
            <Text style={styles.emptyTitle}>Sin historial</Text>
            <Text style={styles.emptyText}>
              No hay sesiones de caja anteriores
            </Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    gap: SPACING.md,
  },
  loadingText: { fontSize: FONT_SIZE.md, color: COLORS.textSecondary },
  listContent: { padding: SPACING.lg, paddingBottom: SPACING.xxxl },

  sessionCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.xl,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    ...SHADOWS.small,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  sessionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    flex: 1,
  },
  sessionDateBadge: {
    backgroundColor: `${COLORS.primary}15`,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.md,
  },
  sessionDateText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.primary,
  },
  sessionTime: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.text,
  },
  sessionDuration: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  sessionHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  sessionTotalBadge: {
    backgroundColor: `${COLORS.success}15`,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.md,
  },
  sessionTotalText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.success,
  },

  sessionContent: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.lg },
  summarySection: {
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: SPACING.xs,
  },
  summaryLabel: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary },
  summaryValue: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.text,
  },
  summaryValuePrimary: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.primary,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.sm,
  },

  timelineSection: {},
  timelineTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  noEventsText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingVertical: SPACING.md,
  },

  timelineItem: { flexDirection: 'row', minHeight: 48 },
  timelineLine: { width: 24, alignItems: 'center' },
  timelineDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  timelineConnector: {
    width: 2,
    flex: 1,
    backgroundColor: COLORS.border,
    marginTop: 2,
  },
  timelineContent: {
    flex: 1,
    paddingLeft: SPACING.sm,
    paddingBottom: SPACING.md,
  },
  timelineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  timelineTime: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary },
  timelineDescription: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.text,
    marginTop: 2,
  },
  timelineAmount: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.primary,
    marginTop: 2,
  },

  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.xxxl * 2,
  },
  emptyIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: `${COLORS.primary}10`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  emptyTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.text,
  },
  emptyText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
});
