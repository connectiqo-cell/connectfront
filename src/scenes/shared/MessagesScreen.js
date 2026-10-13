import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Image,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  Keyboard,
  Platform,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useFocusEffect } from '@react-navigation/native';
import { SafeScreen } from '../../components/SafeScreen';
import StackScreenHeader from '../../components/StackScreenHeader';
import { STACK_OVERLAY_LAYOUT } from '../../utils/platformLayout';
import { useTheme, useThemedStyles } from '../../hooks/useTheme';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { messagesApi, isConversationUnread } from '../../api/messagesApi';
import { SCREEN_NAMES } from '../../navigators/screenNames';

function formatWhen(iso) {
  const date = new Date(iso);
  if (date.toDateString() === new Date().toDateString()) {
    return date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
  }
  return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
}

function formatDateDivider(iso) {
  const date = new Date(iso);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === now.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString('en-IN', { weekday: 'long', month: 'short', day: 'numeric' });
}

function Avatar({ uri, size }) {
  const styles = useThemedStyles(createStyles);
  const { theme } = useTheme();
  const dims = { width: size, height: size, borderRadius: size / 2 };
  return uri ? (
    <Image source={{ uri }} style={[styles.avatar, dims]} />
  ) : (
    <View style={[styles.avatar, dims]}>
      <MaterialIcons name="person" size={size / 2} color={theme.colors.text.muted} />
    </View>
  );
}

function Header({ navigation, title, subtitle, avatarUrl, showAvatar }) {
  const styles = useThemedStyles(createStyles);
  const { theme } = useTheme();
  return (
    <StackScreenHeader insetTop={STACK_OVERLAY_LAYOUT.headerInsetTop} style={styles.headerShell}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={8}>
          <MaterialIcons name="arrow-back" size={22} color={theme.colors.accent.primary} />
        </Pressable>
        {showAvatar ? <Avatar uri={avatarUrl} size={36} /> : null}
        <View style={styles.flex1}>
          <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
          {subtitle ? <Text style={styles.headerSub}>{subtitle}</Text> : null}
        </View>
      </View>
    </StackScreenHeader>
  );
}

/** Inbox — mirrors web portal /messages. */
export function MessagesScreen({ navigation }) {
  const styles = useThemedStyles(createStyles);
  const { theme } = useTheme();
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!user?.id) return;
    try {
      setConversations(await messagesApi.getConversations(user.id));
      setError('');
    } catch (err) {
      setError(err?.message || 'Could not load messages');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Refetch on focus so read state updates after returning from a thread.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <SafeScreen scrollable={false} padding={0} hasBottomTabs={false} includeTopInset={STACK_OVERLAY_LAYOUT.safeScreenIncludeTopInset}>
      <Header navigation={navigation} title="Messages" subtitle="Conversations with other creators" />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? (
        <ActivityIndicator style={styles.loader} color={theme.colors.accent.secondary} />
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(c) => c.id}
          contentContainerStyle={[styles.listContent, !conversations.length && styles.listEmpty]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.accent.secondary} />}
          ListEmptyComponent={(
            <View style={styles.empty}>
              <MaterialIcons name="chat-bubble-outline" size={32} color={theme.colors.text.muted} />
              <Text style={styles.emptyText}>
                No conversations yet. Message a creator from their profile to get started.
              </Text>
            </View>
          )}
          renderItem={({ item }) => {
            const party = item.mentor_id === user.id ? item.learner : item.mentor;
            const unread = isConversationUnread(item, user.id);
            return (
              <Pressable
                style={[styles.row, unread && styles.rowUnread]}
                onPress={() => navigation.navigate(SCREEN_NAMES.MessageThread, { conversationId: item.id })}
              >
                <Avatar uri={party?.avatar_url} size={44} />
                <View style={styles.flex1}>
                  <View style={styles.rowTop}>
                    <Text style={[styles.rowTitle, unread && styles.bold]} numberOfLines={1}>
                      {party?.name || 'User'}
                    </Text>
                    <Text style={styles.rowTime}>{formatWhen(item.last_message_at)}</Text>
                  </View>
                  <Text style={styles.rowPreview} numberOfLines={1}>
                    {item.last_message_preview || 'No messages yet'}
                  </Text>
                </View>
                {unread ? <View style={styles.unreadDot} /> : null}
              </Pressable>
            );
          }}
        />
      )}
    </SafeScreen>
  );
}

/**
 * How far the keyboard covers the given view, in px (0 when closed).
 * Measured against the real keyboard frame instead of KeyboardAvoidingView:
 * Android 15 draws edge-to-edge, so the window no longer resizes for the
 * keyboard — and where it still does resize, the overlap is simply 0.
 */
function useKeyboardOverlap(viewRef) {
  const [overlap, setOverlap] = useState(0);
  useEffect(() => {
    const ios = Platform.OS === 'ios';
    const show = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', (e) => {
      // measure() pageY, not measureInWindow(): on Android the latter subtracts the
      // status bar, while the keyboard's screenY counts from the top of the screen —
      // mixing them left the composer short by exactly the status-bar height.
      viewRef.current?.measure((x, y, w, h, pageX, pageY) => {
        setOverlap(Math.max(0, pageY + h - e.endCoordinates.screenY));
      });
    });
    const hide = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => setOverlap(0));
    return () => { show.remove(); hide.remove(); };
  }, [viewRef]);
  return overlap;
}

/** Thread — mirrors web portal /messages/[conversationId]. */
export function MessageThreadScreen({ navigation, route }) {
  const styles = useThemedStyles(createStyles);
  const { theme } = useTheme();
  const { user } = useAuth();
  const conversationId = route.params?.conversationId;

  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [labels, setLabels] = useState([]);
  const [hasActiveBooking, setHasActiveBooking] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);
  const isMentorRef = useRef(false);
  const bodyRef = useRef(null);
  const keyboardOverlap = useKeyboardOverlap(bodyRef);

  // WhatsApp behaviour: when the keyboard opens, keep the newest message in view.
  useEffect(() => {
    if (keyboardOverlap <= 0) return undefined;
    // Wait one layout pass so the list has already shrunk above the keyboard.
    const t = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(t);
  }, [keyboardOverlap]);

  useEffect(() => {
    if (!user?.id || !conversationId) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const conv = await messagesApi.getConversation(conversationId);
        if (!conv || (conv.mentor_id !== user.id && conv.learner_id !== user.id)) {
          navigation.goBack();
          return;
        }
        if (cancelled) return;
        setConversation(conv);

        const isMentor = conv.mentor_id === user.id;
        isMentorRef.current = isMentor;
        const [msgs, active] = await Promise.all([
          messagesApi.getMessages(conversationId),
          isMentor ? true : messagesApi.hasActiveBooking({ mentorId: conv.mentor_id, learnerId: conv.learner_id }),
        ]);
        if (cancelled) return;
        setMessages(msgs);
        setHasActiveBooking(active);

        if (!isMentor && !active) {
          const learnerLabels = await messagesApi.getLabels('learner');
          if (!cancelled) setLabels(learnerLabels);
        }
        messagesApi.markRead({ conversationId, userId: user.id, isMentor }).catch(() => {});
      } catch (err) {
        if (!cancelled) setError(err?.message || 'Could not load conversation');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id, conversationId, navigation]);

  // Realtime: new messages from either side (including our own sends via the RPC).
  useEffect(() => {
    if (!conversationId || !user?.id) return undefined;
    const channel = supabase
      .channel(`messages-${conversationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const incoming = payload.new;
          setMessages((prev) => (prev.some((m) => m.id === incoming.id) ? prev : [...prev, incoming]));
          messagesApi.markRead({ conversationId, userId: user.id, isMentor: isMentorRef.current }).catch(() => {});
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [conversationId, user?.id]);

  const handleSend = async (body) => {
    const text = body.trim();
    if (!text || sending) return;
    setSending(true);
    setError('');
    try {
      await messagesApi.sendMessage({ conversationId, body: text });
      setDraft('');
    } catch (err) {
      setError(err?.message || 'Could not send message');
    } finally {
      setSending(false);
    }
  };

  const isMentor = conversation?.mentor_id === user?.id;
  const party = isMentor ? conversation?.learner : conversation?.mentor;
  const canFreeType = isMentor || hasActiveBooking;
  const accent = theme.colors.buttons.nebulaGradient[0];

  const renderMessage = ({ item, index }) => {
    const mine = item.sender_id === user.id;
    const prev = messages[index - 1];
    const newDay = !prev || new Date(prev.created_at).toDateString() !== new Date(item.created_at).toDateString();
    return (
      <View>
        {newDay ? (
          <View style={styles.dividerWrap}>
            <Text style={styles.divider}>{formatDateDivider(item.created_at)}</Text>
          </View>
        ) : null}
        <View style={[styles.bubbleRow, mine && styles.bubbleRowMine]}>
          <View style={[styles.bubble, mine ? [styles.bubbleMine, { backgroundColor: accent }] : styles.bubbleTheirs]}>
            {item.is_label ? (
              <View style={styles.labelTag}>
                <MaterialIcons name="auto-awesome" size={10} color={mine ? 'rgba(255,255,255,0.7)' : theme.colors.text.muted} />
                <Text style={[styles.labelTagText, mine && styles.mutedOnAccent]}>QUICK MESSAGE</Text>
              </View>
            ) : null}
            <Text style={[styles.bubbleText, mine && styles.textOnAccent]}>{item.body}</Text>
            <Text style={[styles.bubbleTime, mine && styles.mutedOnAccent]}>{formatTime(item.created_at)}</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeScreen scrollable={false} padding={0} hasBottomTabs={false} includeTopInset={STACK_OVERLAY_LAYOUT.safeScreenIncludeTopInset}>
      <Header
        navigation={navigation}
        title={party?.name || (loading ? '' : 'User')}
        subtitle={conversation ? 'Creator' : ''}
        avatarUrl={party?.avatar_url}
        showAvatar={!!conversation}
      />
      <View ref={bodyRef} collapsable={false} style={[styles.flex1, { paddingBottom: keyboardOverlap }]}>
        {loading ? (
          <ActivityIndicator style={styles.loader} color={theme.colors.accent.secondary} />
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            renderItem={renderMessage}
            contentContainerStyle={[styles.threadContent, !messages.length && styles.listEmpty]}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={(
              <View style={styles.empty}>
                <MaterialIcons name="auto-awesome" size={24} color={theme.colors.text.muted} />
                <Text style={styles.emptyText}>Say hello to start the conversation.</Text>
              </View>
            )}
          />
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {loading || !conversation ? null : !canFreeType ? (
          <View style={styles.composer}>
            <View style={styles.lockNote}>
              <MaterialIcons name="lock" size={14} color={accent} />
              <Text style={styles.lockText}>
                Book a session with this creator to send a custom message. For now, choose one:
              </Text>
            </View>
            <View style={styles.labelsWrap}>
              {labels.map((label) => (
                <Pressable
                  key={label.id}
                  onPress={() => handleSend(label.label)}
                  disabled={sending}
                  style={[styles.labelChip, { borderColor: accent }, sending && styles.disabled]}
                >
                  <Text style={[styles.labelChipText, { color: accent }]}>{label.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : (
          <View style={[styles.composer, styles.composerRow]}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Type a message…"
              placeholderTextColor={theme.colors.text.muted}
              editable={!sending}
              multiline
              style={styles.input}
            />
            <Pressable
              onPress={() => handleSend(draft)}
              disabled={sending || !draft.trim()}
              style={[styles.sendBtn, { backgroundColor: accent }, (sending || !draft.trim()) && styles.disabled]}
              accessibilityLabel="Send"
            >
              <MaterialIcons name="send" size={18} color="#fff" />
            </Pressable>
          </View>
        )}
      </View>
    </SafeScreen>
  );
}

export default MessagesScreen;

function createStyles(theme) {
  const T = theme;
  const C = theme.colors;
  const S = C.surface;
  return StyleSheet.create({
    flex1: { flex: 1, minWidth: 0 },
    headerShell: { paddingHorizontal: T.spacing.lg },
    header: { flexDirection: 'row', alignItems: 'center', gap: T.spacing.md, marginBottom: T.spacing.md },
    backBtn: {
      width: 40,
      height: 40,
      borderRadius: T.borderRadius.md,
      backgroundColor: S.accentViolet,
      borderWidth: 1,
      borderColor: C.border.default,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerTitle: { fontSize: 17, color: C.accent.primary, fontWeight: '800' },
    headerSub: { fontSize: 12, color: C.text.muted, marginTop: 2 },
    loader: { marginTop: T.spacing.xl },
    error: { color: C.accent.error, fontSize: 13, paddingHorizontal: T.spacing.lg, paddingVertical: T.spacing.sm },
    listContent: { paddingHorizontal: T.spacing.lg, paddingBottom: T.spacing.xxxl },
    listEmpty: { flexGrow: 1, justifyContent: 'center' },
    empty: { alignItems: 'center', gap: T.spacing.sm, padding: T.spacing.xl },
    emptyText: { fontSize: 13, color: C.text.muted, textAlign: 'center', lineHeight: 20 },
    avatar: { backgroundColor: S.chip, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: T.spacing.md,
      backgroundColor: S.panel,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: C.border.light,
      padding: T.spacing.md,
      marginBottom: T.spacing.sm,
    },
    rowUnread: { borderColor: C.border.default, backgroundColor: S.accentViolet },
    rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: T.spacing.sm, marginBottom: 2 },
    rowTitle: { flex: 1, fontSize: 14, fontWeight: '600', color: C.text.primary },
    bold: { fontWeight: '800' },
    rowTime: { fontSize: 11, color: C.text.muted },
    rowPreview: { fontSize: 12, color: C.text.muted },
    unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.accent.secondary },
    threadContent: { paddingHorizontal: T.spacing.lg, paddingBottom: T.spacing.md },
    dividerWrap: { alignItems: 'center', marginVertical: T.spacing.sm },
    divider: {
      fontSize: 11,
      fontWeight: '600',
      color: C.text.muted,
      backgroundColor: S.chip,
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 999,
      overflow: 'hidden',
    },
    bubbleRow: { flexDirection: 'row', justifyContent: 'flex-start', marginBottom: T.spacing.sm },
    bubbleRowMine: { justifyContent: 'flex-end' },
    bubble: { maxWidth: '78%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9, gap: 3 },
    bubbleMine: { borderBottomRightRadius: 6 },
    bubbleTheirs: { borderBottomLeftRadius: 6, backgroundColor: S.chip },
    bubbleText: { fontSize: 14, color: C.text.primary, lineHeight: 20 },
    textOnAccent: { color: '#fff' },
    bubbleTime: { fontSize: 10, color: C.text.muted },
    mutedOnAccent: { color: 'rgba(255,255,255,0.7)' },
    labelTag: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    labelTagText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.6, color: C.text.muted },
    composer: {
      borderTopWidth: 1,
      borderTopColor: C.border.light,
      backgroundColor: S.sheet,
      paddingHorizontal: T.spacing.lg,
      paddingVertical: T.spacing.md,
      gap: T.spacing.sm,
    },
    composerRow: { flexDirection: 'row', alignItems: 'flex-end' },
    input: {
      flex: 1,
      maxHeight: 120,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: C.border.light,
      backgroundColor: S.panel,
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 10,
      fontSize: 14,
      color: C.text.primary,
    },
    sendBtn: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center' },
    disabled: { opacity: 0.6 },
    lockNote: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: T.spacing.sm,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: C.border.default,
      backgroundColor: S.accentViolet,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    lockText: { flex: 1, fontSize: 12, color: C.text.secondary },
    labelsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: T.spacing.sm },
    labelChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: S.accentViolet },
    labelChipText: { fontSize: 13, fontWeight: '700' },
  });
}
