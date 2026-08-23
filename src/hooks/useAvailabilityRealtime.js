import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

const DEBOUNCE_MS = 500;

/**
 * Reloads when `availability_slots` for this mentor change (booked, added, removed).
 * Ported from the web portal so mentees and creators see Available → Booked live.
 */
export function useAvailabilityRealtime(mentorId, onChange) {
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
      .channel(`availability-${mentorId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'availability_slots',
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
