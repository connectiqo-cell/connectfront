import React, {
  createContext,
  useState,
  useCallback,
  useRef,
  useEffect,
  useContext,
  useMemo,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthContext } from './AuthContext';

export const NotificationContext = createContext();

const readIdsStorageKey = (userId) => `notification_read_ids_${userId}`;

export const NotificationProvider = ({ children }) => {
  const { profile } = useContext(AuthContext);
  const userId = profile?.id;
  const [unreadCount, setUnreadCount] = useState(0);
  const readIdsRef = useRef(new Set());
  const hydratedUserRef = useRef(null);

  const persistReadIds = useCallback(async () => {
    if (!userId) return;
    try {
      await AsyncStorage.setItem(
        readIdsStorageKey(userId),
        JSON.stringify([...readIdsRef.current]),
      );
    } catch {
      // ignore persistence errors
    }
  }, [userId]);

  const hydrateReadIds = useCallback(async () => {
    if (!userId) {
      readIdsRef.current = new Set();
      hydratedUserRef.current = null;
      return;
    }
    if (hydratedUserRef.current === userId) return;
    try {
      const raw = await AsyncStorage.getItem(readIdsStorageKey(userId));
      const ids = raw ? JSON.parse(raw) : [];
      readIdsRef.current = new Set(Array.isArray(ids) ? ids : []);
    } catch {
      readIdsRef.current = new Set();
    }
    hydratedUserRef.current = userId;
  }, [userId]);

  useEffect(() => {
    hydratedUserRef.current = null;
    void hydrateReadIds();
  }, [hydrateReadIds]);

  const isRead = useCallback((id) => readIdsRef.current.has(id), []);

  const markAsRead = useCallback((id) => {
    if (!id || readIdsRef.current.has(id)) return;
    readIdsRef.current.add(id);
    setUnreadCount((c) => Math.max(0, c - 1));
    void persistReadIds();
  }, [persistReadIds]);

  const markAllRead = useCallback((ids = []) => {
    ids.forEach((id) => readIdsRef.current.add(id));
    setUnreadCount(0);
    void persistReadIds();
  }, [persistReadIds]);

  const syncUnreadCount = useCallback(async (notifications = []) => {
    await hydrateReadIds();
    const count = notifications.filter((n) => !readIdsRef.current.has(n.id)).length;
    setUnreadCount(count);
  }, [hydrateReadIds]);

  const incrementUnreadCount = useCallback(() => {
    setUnreadCount((c) => c + 1);
  }, []);

  const value = useMemo(
    () => ({
      unreadCount,
      setUnreadCount,
      markAsRead,
      markAllRead,
      syncUnreadCount,
      isRead,
      incrementUnreadCount,
    }),
    [
      unreadCount,
      markAsRead,
      markAllRead,
      syncUnreadCount,
      isRead,
      incrementUnreadCount,
    ],
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};
