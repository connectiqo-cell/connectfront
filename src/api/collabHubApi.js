import { supabase } from '../lib/supabase';
import { getSupabaseErrorMessage } from '../lib/supabaseErrorHandler';
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

/** Row in legal_agreements shared with the web app — the wording lives there, never here. */
export const VIDEO_USAGE_AGREEMENT_ID = 'creator_video_usage';
const BRAND_PLACEHOLDER = '{{brand}}';

/**
 * Swap every {{brand}} for the campaign's brand name. split/join rather than
 * String.replace, which only replaces the first match — clause 1 has two.
 */
export const fillAgreementClauses = (clauses, brandName) => {
  const name = (brandName || '').trim() || 'the brand';
  return (Array.isArray(clauses) ? clauses : [])
    .filter(c => typeof c === 'string' && c.trim())
    .map(c => c.split(BRAND_PLACEHOLDER).join(name));
};

/**
 * Consent is asked once per application. A submission row that already
 * carries agreement_accepted_at keeps it; only a first upload — or a row from
 * before the agreement existed — needs the creator to accept.
 */
export const needsAgreement = submission => !submission?.agreement_accepted_at;

/** Server-side watermarking re-encodes anyway, so we upload the original. */
export const MAX_SUBMISSION_MB = 200;

// Every other api module routes errors through this; CollabHub threw the raw
// Postgres text, which is how a creator ended up emailing support a
// row-level-security message.
const unwrap = ({ data, error }) => {
  if (error) throw new Error(getSupabaseErrorMessage(error));
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

  /** The shared creator video-usage agreement (public read, admin-only write). */
  getVideoUsageAgreement: async () => {
    const row = unwrap(
      await supabase
        .from('legal_agreements')
        .select('id, version, clauses, updated_at')
        .eq('id', VIDEO_USAGE_AGREEMENT_ID)
        .maybeSingle(),
    );
    if (!row || !Array.isArray(row.clauses) || !row.clauses.length) {
      throw new Error('Could not load the agreement. Please try again.');
    }
    return row;
  },

  /**
   * Upload the clean original, then mark the submission 'processing'.
   *
   * That order matters: the row is what fires the database webhook, and the
   * watermark worker needs the object to already be there. Nothing else is
   * called — the worker does the watermarking and flips the row to
   * 'submitted', so a dropped app or a dead screen cannot lose the job.
   *
   * First upload → INSERT with agreement_accepted_at (RLS rejects it without).
   * Resubmission → plain UPDATE that leaves agreement_accepted_at out, so the
   * original acceptance carries forward. Not an upsert: Postgres checks the
   * INSERT policy on every upsert, which would reject the omitted field.
   * Pre-agreement rows (no timestamp) get one stamped, since the update policy
   * needs it — the caller must have shown the agreement for those.
   */
  submitVideo: async ({ applicationId, creatorId, fileUri, fileName, onProgress, existingSubmission }) => {
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

    const fields = {
      original_storage_path: storagePath,
      status: 'processing',
      // Clears a previous failure so the worker picks this up.
      watermark_error: null,
    };

    if (!existingSubmission?.id) {
      return unwrap(
        await supabase
          .from('campaign_submissions')
          .insert({
            ...fields,
            application_id: applicationId,
            creator_id: creatorId,
            agreement_accepted_at: new Date().toISOString(),
          })
          .select()
          .single(),
      );
    }

    if (needsAgreement(existingSubmission)) {
      fields.agreement_accepted_at = new Date().toISOString();
    }
    return unwrap(
      await supabase
        .from('campaign_submissions')
        .update(fields)
        .eq('id', existingSubmission.id)
        .select()
        .single(),
    );
  },

  /**
   * Retry a watermark pass that failed, without re-uploading the video.
   * Leaves agreement_accepted_at alone unless the row predates the agreement,
   * in which case the caller has just collected consent.
   */
  retryWatermark: async (submission) => {
    const fields = { status: 'processing', watermark_error: null };
    if (needsAgreement(submission)) {
      fields.agreement_accepted_at = new Date().toISOString();
    }
    unwrap(
      await supabase
        .from('campaign_submissions')
        .update(fields)
        .eq('id', submission.id),
    );
  },

};
