import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';

export const PushBannerContext = createContext(null);

export function PushBannerProvider({ children }) {
  const [banner, setBanner] = useState(null);
  const hideTimerRef = useRef(null);

  const hideBanner = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    setBanner(null);
  }, []);

  const showBanner = useCallback(
    ({ title, body, data = {}, durationMs = 4500 } = {}) => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
      setBanner({
        id: `${Date.now()}`,
        title: title || 'Connectiqo',
        body: body || '',
        data,
      });
      hideTimerRef.current = setTimeout(() => {
        setBanner(null);
        hideTimerRef.current = null;
      }, durationMs);
    },
    [],
  );

  const value = useMemo(
    () => ({ banner, showBanner, hideBanner }),
    [banner, showBanner, hideBanner],
  );

  return (
    <PushBannerContext.Provider value={value}>
      {children}
    </PushBannerContext.Provider>
  );
}

export function usePushBanner() {
  const ctx = useContext(PushBannerContext);
  if (!ctx) {
    return {
      banner: null,
      showBanner: () => {},
      hideBanner: () => {},
    };
  }
  return ctx;
}
