import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

const DEBOUNCE_MS = 500;

/**
 * Reloads when this application's submission row changes — the watermark
 * worker owns the processing -> submitted flip, and the brand owns the review
 * statuses, so neither is something the app can predict. Mirrors
 * useWithdrawalRequestsRealtime.
 */
export function useCampaignSubmissionRealtime(applicationId, onChange) {
  const onChangeRef = useRef(onChange);
  const timerRef = useRef(null);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!applicationId) return undefined;

    const triggerDebounced = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => onChangeRef.current?.(), DEBOUNCE_MS);
    };

    const channel = supabase
      .channel(`campaign-submission-${applicationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'campaign_submissions',
          filter: `application_id=eq.${applicationId}`,
        },
        triggerDebounced,
      )
      .subscribe();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      supabase.removeChannel(channel);
    };
  }, [applicationId]);
}
