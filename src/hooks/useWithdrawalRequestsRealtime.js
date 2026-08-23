import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

const DEBOUNCE_MS = 500;

/**
 * Reloads when `withdrawal_requests` for this mentor change (admin
 * marks processing/completed/rejected). Mirrors useAvailabilityRealtime.
 */
export function useWithdrawalRequestsRealtime(mentorId, onChange) {
  const onChangeRef = useRef(onChange);
  const timerRef = useRef(null);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!mentorId) return undefined;

    const triggerDebounced = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => onChangeRef.current?.(), DEBOUNCE_MS);
    };

    const channel = supabase
      .channel(`withdrawals-${mentorId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'withdrawal_requests',
          filter: `mentor_id=eq.${mentorId}`,
        },
        triggerDebounced,
      )
      .subscribe();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      supabase.removeChannel(channel);
    };
  }, [mentorId]);
}
