import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store';
import { chatService } from '../../services/chatService';
import { locationService } from '../../services/locationService';
import { Chat, ChatMessage, ChatStatusEnum, UserRoleEnum } from '../../types';
import {
  COLORS,
  SPACING,
  FONT_SIZE,
  FONT_WEIGHT,
  BORDER_RADIUS,
  SHADOWS,
} from '../../constants';
import { showAlert } from '../../utils/alert';

import { useVocab } from '../../config/hooks';
interface ChatScreenProps {
  route: {
    params: {
      orderId: string;
    };
  };
}

const formatMessageTime = (date: Date): string => {
  return date.toLocaleTimeString('es-VE', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const ChatScreen: React.FC<ChatScreenProps> = ({ route }) => {
  const vocab = useVocab();
  const { orderId } = route.params;
  const { user, customer, role } = useAuthStore();
  const [chat, setChat] = useState<Chat | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const flatListRef = useRef<FlatList<ChatMessage>>(null);

  const isWaiter =
    role === UserRoleEnum.WAITER ||
    role === UserRoleEnum.ADMIN ||
    role === UserRoleEnum.MANAGER;

  const senderRole = isWaiter ? ('waiter' as const) : ('customer' as const);

  useEffect(() => {
    const unsubscribe = chatService.subscribeToChat(orderId, (updatedChat) => {
      setChat(updatedChat);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [orderId]);

  const handleSend = async () => {
    if (!message.trim() || !user || !customer || isSending) return;

    const text = message.trim();
    setMessage('');
    setIsSending(true);

    try {
      await chatService.sendMessage(orderId, {
        senderId: user.uid,
        senderName: customer.name,
        senderRole,
        text,
      });
    } catch (error) {
      console.error('Error enviando mensaje:', error);
      setMessage(text); // Restaurar el mensaje si falla
      showAlert('Error', 'No se pudo enviar el mensaje');
    } finally {
      setIsSending(false);
    }
  };

  const handleShareLocation = async () => {
    if (!user || !customer) return;

    try {
      const granted = await locationService.requestPermissions();
      if (!granted) {
        showAlert(
          'Permisos',
          'Se necesitan permisos de ubicacion para compartir tu posicion',
        );
        return;
      }

      setIsSending(true);
      const coords = await locationService.getCurrentLocation();

      await chatService.sendMessage(orderId, {
        senderId: user.uid,
        senderName: customer.name,
        senderRole,
        text: 'Compartio su ubicacion',
        location: coords,
      });
    } catch (error) {
      console.error('Error compartiendo ubicacion:', error);
      showAlert('Error', 'No se pudo obtener la ubicacion');
    } finally {
      setIsSending(false);
    }
  };

  const openInMaps = (latitude: number, longitude: number) => {
    const url = Platform.select({
      ios: `maps:0,0?q=${latitude},${longitude}`,
      android: `geo:${latitude},${longitude}?q=${latitude},${longitude}`,
    });

    if (url) {
      Linking.openURL(url).catch(() => {
        // Fallback a Google Maps web
        Linking.openURL(
          `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`,
        );
      });
    }
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isOwn = item.senderId === user?.uid;

    return (
      <View
        style={[
          styles.messageBubbleContainer,
          isOwn ? styles.ownMessage : styles.otherMessage,
        ]}
      >
        {!isOwn && <Text style={styles.senderName}>{item.senderName}</Text>}
        <View
          style={[styles.bubble, isOwn ? styles.ownBubble : styles.otherBubble]}
        >
          <Text
            style={[
              styles.messageText,
              isOwn ? styles.ownMessageText : styles.otherMessageText,
            ]}
          >
            {item.text}
          </Text>

          {item.location && (
            <TouchableOpacity
              style={styles.locationBadge}
              onPress={() =>
                openInMaps(item.location!.latitude, item.location!.longitude)
              }
            >
              <Ionicons name="location" size={16} color={COLORS.primary} />
              <Text style={styles.locationText}>Ver en mapa</Text>
              <Ionicons name="open-outline" size={14} color={COLORS.primary} />
            </TouchableOpacity>
          )}

          <Text
            style={[
              styles.timeText,
              isOwn ? styles.ownTimeText : styles.otherTimeText,
            ]}
          >
            {formatMessageTime(item.timestamp)}
          </Text>
        </View>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Cargando chat...</Text>
      </View>
    );
  }

  if (!chat) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons
          name="chatbubbles-outline"
          size={64}
          color={COLORS.textLight}
        />
        <Text style={styles.errorTitle}>Chat no disponible</Text>
        <Text style={styles.errorSubtitle}>
          No se encontro el chat para esta orden
        </Text>
      </View>
    );
  }

  const isClosed = chat.status === ChatStatusEnum.CLOSED;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoiding}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        {/* Chat header info */}
        <View style={styles.chatHeader}>
          <View style={styles.chatHeaderInfo}>
            <Ionicons
              name="person-circle-outline"
              size={24}
              color={COLORS.primary}
            />
            <Text style={styles.chatHeaderName}>
              {isWaiter ? chat.customerName : chat.waiterName}
            </Text>
          </View>
          <Text style={styles.chatHeaderRole}>
            {isWaiter ? 'Cliente' : vocab.waiter}
          </Text>
        </View>

        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={chat.messages}
          renderItem={renderMessage}
          keyExtractor={(_, index) => index.toString()}
          contentContainerStyle={styles.messagesList}
          inverted={false}
          onContentSizeChange={() => {
            if (chat.messages.length > 0) {
              flatListRef.current?.scrollToEnd({ animated: true });
            }
          }}
          ListEmptyComponent={
            <View style={styles.emptyChat}>
              <Ionicons
                name="chatbubbles-outline"
                size={48}
                color={COLORS.textLight}
              />
              <Text style={styles.emptyChatText}>Inicia la conversacion</Text>
            </View>
          }
        />

        {/* Input bar */}
        {isClosed ? (
          <View style={styles.closedBar}>
            <Ionicons
              name="lock-closed-outline"
              size={18}
              color={COLORS.textSecondary}
            />
            <Text style={styles.closedText}>Este chat ha sido cerrado</Text>
          </View>
        ) : (
          <View style={styles.inputBar}>
            <TouchableOpacity
              style={styles.locationButton}
              onPress={handleShareLocation}
              disabled={isSending}
            >
              <Ionicons
                name="location-outline"
                size={22}
                color={COLORS.primary}
              />
            </TouchableOpacity>

            <TextInput
              style={styles.input}
              value={message}
              onChangeText={setMessage}
              placeholder="Escribe un mensaje..."
              placeholderTextColor={COLORS.textLight}
              multiline
              maxLength={500}
            />

            <TouchableOpacity
              style={[
                styles.sendButton,
                (!message.trim() || isSending) && styles.sendButtonDisabled,
              ]}
              onPress={handleSend}
              disabled={!message.trim() || isSending}
            >
              {isSending ? (
                <ActivityIndicator size="small" color={COLORS.textWhite} />
              ) : (
                <Ionicons name="send" size={18} color={COLORS.textWhite} />
              )}
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  keyboardAvoiding: {
    flex: 1,
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    padding: SPACING.xl,
  },
  errorTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.text,
    marginTop: SPACING.lg,
  },
  errorSubtitle: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    marginTop: SPACING.sm,
    textAlign: 'center',
  },
  // Chat header
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  chatHeaderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  chatHeaderName: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.text,
  },
  chatHeaderRole: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
  },
  // Messages list
  messagesList: {
    padding: SPACING.md,
    flexGrow: 1,
  },
  emptyChat: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.xxxl * 2,
  },
  emptyChatText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textLight,
    marginTop: SPACING.md,
  },
  // Message bubbles
  messageBubbleContainer: {
    marginBottom: SPACING.md,
    maxWidth: '80%',
  },
  ownMessage: {
    alignSelf: 'flex-end',
  },
  otherMessage: {
    alignSelf: 'flex-start',
  },
  senderName: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
    marginLeft: SPACING.sm,
  },
  bubble: {
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    ...SHADOWS.small,
  },
  ownBubble: {
    backgroundColor: COLORS.primary,
    borderBottomRightRadius: SPACING.xs,
  },
  otherBubble: {
    backgroundColor: COLORS.surface,
    borderBottomLeftRadius: SPACING.xs,
  },
  messageText: {
    fontSize: FONT_SIZE.md,
    lineHeight: 20,
  },
  ownMessageText: {
    color: COLORS.textWhite,
  },
  otherMessageText: {
    color: COLORS.text,
  },
  timeText: {
    fontSize: FONT_SIZE.xs,
    marginTop: SPACING.xs,
    alignSelf: 'flex-end',
  },
  ownTimeText: {
    color: 'rgba(255,255,255,0.7)',
  },
  otherTimeText: {
    color: COLORS.textLight,
  },
  // Location badge
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: 'rgba(0,0,0,0.15)',
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    marginTop: SPACING.sm,
  },
  locationText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.primary,
    fontWeight: FONT_WEIGHT.medium,
  },
  // Input bar
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: SPACING.sm,
  },
  locationButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${COLORS.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
    maxHeight: 100,
    minHeight: 40,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  // Closed bar
  closedBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.surface,
    paddingVertical: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  closedText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
  },
});
