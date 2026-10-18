import { supabase } from '../lib/supabase';
import { uploadFileXHR } from './videoApi';

/**
 * CollabHub, creator side only. Brands post campaigns on the web portal; this
 * is the half a creator needs on mobile — browse, apply, submit, track.
 *
 * Every call is a plain RLS-guarded query: "creator" is the same unified
 * account the app already signs in (see the collabhub migration), so there is
 * no extra role or token involved.
 */

const SUBMISSIONS_BUCKET = 'campaign-submissions';
const CAMPAIGN_SELECT = '*, brand:brand_id ( name, avatar_url )';

/** Server-side watermarking re-encodes anyway, so we upload the original. */
export const MAX_SUBMISSION_MB = 200;

const unwrap = ({ data, error }) => {
  if (error) throw new Error(error.message);
  return data;
};

export const collabHubApi = {
  /** Published campaigns, newest first. RLS hides drafts and closed ones. */
  getPublishedCampaigns: async ({ limit = 20, offset = 0 } = {}) =>
    unwrap(
      await supabase
        .from('campaigns')
        .select(CAMPAIGN_SELECT)
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1),
    ) || [],

  getCampaignById: async (campaignId) =>
    unwrap(
      await supabase.from('campaigns').select(CAMPAIGN_SELECT).eq('id', campaignId).maybeSingle(),
    ),

  /** UNIQUE(campaign_id, creator_id) blocks a second application. */
  applyToCampaign: async ({ campaignId, creatorId, pitch }) => {
    unwrap(
      await supabase
        .from('campaign_applications')
        .insert({ campaign_id: campaignId, creator_id: creatorId, pitch }),
    );
  },

  getMyApplication: async ({ campaignId, creatorId }) =>
    unwrap(
      await supabase
        .from('campaign_applications')
        .select('*')
        .eq('campaign_id', campaignId)
        .eq('creator_id', creatorId)
        .maybeSingle(),
    ),

  getMyApplications: async (creatorId) =>
    unwrap(
      await supabase
        .from('campaign_applications')
        .select('*, campaign:campaign_id ( id, title, status, budget_per_winner )')
        .eq('creator_id', creatorId)
        .order('applied_at', { ascending: false }),
    ) || [],

  getSubmission: async (applicationId) =>
    unwrap(
      await supabase
        .from('campaign_submissions')
        .select('*')
        .eq('application_id', applicationId)
        .maybeSingle(),
    ),

  /** Set once the brand has paid — both sides can read it (see migration RLS). */
  getCampaignUnlock: async (applicationId) =>
    unwrap(
      await supabase
        .from('campaign_unlocks')
        .select('*')
        .eq('application_id', applicationId)
        .maybeSingle(),
    ),

  /**
   * Upload the clean original, then mark the submission 'processing'.
   *
   * That order matters: the row is what fires the database webhook, and the
   * watermark worker needs the object to already be there. Nothing else is
   * called — the worker does the watermarking and flips the row to
   * 'submitted', so a dropped app or a dead screen cannot lose the job.
   */
  submitVideo: async ({ applicationId, creatorId, fileUri, fileName, onProgress }) => {
    const ext = (fileName?.split('.').pop() || 'mp4').toLowerCase();
    const storagePath = `${creatorId}/${Date.now()}.${ext}`;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Please sign in again to submit.');

    await uploadFileXHR(
      storagePath,
      fileUri,
      fileName || `submission.${ext}`,
      ext === 'mov' ? 'video/quicktime' : 'video/mp4',
      session.access_token,
      onProgress,
      SUBMISSIONS_BUCKET,
    );

    return unwrap(
      await supabase
        .from('campaign_submissions')
        .upsert(
          {
            application_id: applicationId,
            creator_id: creatorId,
            original_storage_path: storagePath,
            status: 'processing',
            // Clears a previous failure so the worker picks this up.
            watermark_error: null,
          },
          { onConflict: 'application_id' },
        )
        .select()
        .single(),
    );
  },

  /** Retry a watermark pass that failed, without re-uploading the video. */
  retryWatermark: async (submissionId) => {
    unwrap(
      await supabase
        .from('campaign_submissions')
        .update({ status: 'processing', watermark_error: null })
        .eq('id', submissionId),
    );
  },

};
