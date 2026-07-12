import { useEffect, useRef, useState } from 'react';
import { usePubSub } from '@videosdk.live/react-native-sdk';

const POPUP_DURATION_MS = 5000;

/**
 * Shows a brief popup when a remote participant sends a chat message
 * while the chat panel is closed.
 */
export function useInCallChatPopup({ localParticipantId, isChatOpen, onOpenChat }) {
  const chatPubSub = usePubSub('CHAT', {});
  const processedRef = useRef(new Set());
  const hideTimerRef = useRef(null);
  const [popup, setPopup] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (isChatOpen) {
      setUnreadCount(0);
      setPopup(null);
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    }
  }, [isChatOpen]);

  useEffect(() => {
    const messages = chatPubSub.messages || [];
    if (!messages.length) return;

    messages.forEach(entry => {
      const messageId = `${entry.timestamp}-${entry.senderId}-${entry.message}`;
      if (processedRef.current.has(messageId)) return;
      processedRef.current.add(messageId);

      if (!localParticipantId || entry.senderId === localParticipantId) return;

      if (!isChatOpen) {
        setUnreadCount(count => count + 1);
        setPopup({
          id: messageId,
          senderName: entry.senderName || 'Participant',
          message: entry.message,
        });

        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        hideTimerRef.current = setTimeout(() => {
          setPopup(null);
          hideTimerRef.current = null;
        }, POPUP_DURATION_MS);
      }
    });
  }, [chatPubSub.messages, isChatOpen, localParticipantId]);

  useEffect(
    () => () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    },
    [],
  );

  const dismissPopup = () => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    setPopup(null);
  };

  const openChatFromPopup = () => {
    dismissPopup();
    setUnreadCount(0);
    onOpenChat?.();
  };

  return {
    popup,
    unreadCount,
    dismissPopup,
    openChatFromPopup,
  };
}
