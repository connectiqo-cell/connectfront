import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  RefreshControl,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from 'react-native-linear-gradient';
import Toast from 'react-native-simple-toast';
import moment from 'moment';
import { launchImageLibrary } from 'react-native-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SafeScreen } from '../../components/SafeScreen';
import BottomSheet from '../../components/BottomSheet';
import StackScreenHeader from '../../components/StackScreenHeader';
import { STACK_OVERLAY_LAYOUT } from '../../utils/platformLayout';
import { useTheme, useThemedStyles } from '../../hooks/useTheme';
import { softBorder, softFill, softFillStrong, cardFill } from '../../theme/surfaceStyles';
import { useAuth } from '../../hooks/useAuth';
import { collabHubApi, MAX_SUBMISSION_MB } from '../../api/collabHubApi';
import { useCampaignSubmissionRealtime } from '../../hooks/useCampaignSubmissionRealtime';
import { shareCampaign } from '../../utils/shareProfile';

const money = n => `₹${parseFloat(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const PITCH_MIN = 20;
const PITCH_MAX = 500;

const APPLICATION_STATUS = {
  pending: { label: 'Application sent', body: 'The brand is reviewing applications.', icon: 'schedule', tone: 'info' },
  // Shortlisting is the brand's invitation to submit — the insert policy on
  // campaign_submissions accepts 'shortlisted' as well as 'accepted'.
  shortlisted: { label: "You're shortlisted", body: 'Shoot the brief and upload your video.', icon: 'star', tone: 'success' },
  accepted: { label: "You're in", body: 'Shoot the brief and upload your video.', icon: 'check-circle', tone: 'success' },
  rejected: { label: 'Not selected', body: 'This one went to someone else.', icon: 'cancel', tone: 'error' },
};

const SUBMISSION_STATUS = {
  processing: { label: 'Processing your video', body: 'Watermarking it for review — this updates itself.', icon: 'hourglass-top', tone: 'info' },
  submitted: { label: 'Submitted', body: 'Waiting for the brand to review.', icon: 'done-all', tone: 'info' },
  revision_requested: { label: 'Revision requested', body: 'Upload a new cut below.', icon: 'replay', tone: 'warning' },
  approved: { label: 'Approved', body: 'The brand approved your video.', icon: 'verified', tone: 'success' },
  rejected: { label: 'Rejected', body: 'The brand did not approve this one.', icon: 'cancel', tone: 'error' },
};

export default function CampaignDetailScreen({ navigation, route }) {
  const { campaignId } = route.params || {};
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const C = theme.colors;

  // One object, not four pieces of state: RN does not batch updates made
  // after an await, so setting them separately rendered a frame with the
  // campaign loaded but the application still null — which flashed the Apply
  // form at someone who had already applied.
  const [data, setData] = useState(null);
  const { campaign, application, submission, unlock } = data || {};
  const [pitch, setPitch] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const uploading = useRef(false);
  const sheet = useRef(null);

  const load = useCallback(async () => {
    if (!campaignId || !user?.id) return;
    try {
      setError('');
      const [c, app] = await Promise.all([
        collabHubApi.getCampaignById(campaignId),
        collabHubApi.getMyApplication({ campaignId, creatorId: user.id }),
      ]);
      const [sub, unl] = app
        ? await Promise.all([
            collabHubApi.getSubmission(app.id),
            collabHubApi.getCampaignUnlock(app.id),
          ])
        : [null, null];
      setData({ campaign: c, application: app, submission: sub, unlock: unl });
    } catch (e) {
      setError(e?.message || 'Could not load this campaign');
    } finally {
      setRefreshing(false);
    }
  }, [campaignId, user?.id]);

  useEffect(() => { load(); }, [load]);

  // The watermark worker flips the row from processing to submitted, so the
  // screen follows the row instead of polling for it.
  useCampaignSubmissionRealtime(application?.id, load);

  const share = useCallback(async () => {
    try {
      const deadline = campaign?.application_deadline
        ? moment(campaign.application_deadline)
        : null;
      await shareCampaign({
        campaignId,
        title: campaign?.title,
        brandName: campaign?.brand?.name,
        budgetPerWinner: campaign?.budget_per_winner,
        deadlineLabel: deadline?.isValid() ? deadline.format('DD MMM YYYY') : null,
      });
    } catch (e) {
      // Cancelling the share sheet is not a failure worth a toast.
      if (e?.message && e.message !== 'User did not share') {
        Toast.show('Could not share this collab');
      }
    }
  }, [campaignId, campaign]);

  const apply = async () => {
    const text = pitch.trim();
    if (text.length < PITCH_MIN) {
      Toast.show(`Tell the brand a bit more — at least ${PITCH_MIN} characters`, Toast.LONG);
      return;
    }
    setBusy(true);
    try {
      await collabHubApi.applyToCampaign({ campaignId, creatorId: user.id, pitch: text });
      sheet.current?.close();
      setPitch('');
      // Show the result immediately rather than after a round trip — load()
      // below reconciles with the real row.
      setData(d => ({
        ...d,
        application: { id: null, status: 'pending', pitch: text, applied_at: new Date().toISOString() },
      }));
      Toast.show('Application sent', Toast.SHORT);
      await load();
    } catch (e) {
      Toast.show(e?.message || 'Could not apply', Toast.LONG);
    } finally {
      setBusy(false);
    }
  };

  // RLS stores an acceptance timestamp on every submission, so the creator has
  // to see the brand's usage-rights terms before we write the row. Same terms
  // already shown in the "Usage rights" section below.
  const confirmUsageRights = () =>
    new Promise(resolve => {
      Alert.alert(
        'Usage rights',
        `${campaign?.content_usage_rights
          || 'The brand receives usage rights to the video you submit for this campaign.'}\n\nUploading means you accept these terms.`,
        [
          { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Accept & upload', onPress: () => resolve(true) },
        ],
        { cancelable: true, onDismiss: () => resolve(false) },
      );
    });

  const pickAndSubmit = () => {
    if (uploading.current) return;
    // No app-side compression: the watermark pass re-encodes server-side, so
    // compressing here would only cost battery and quality the brand pays for.
    launchImageLibrary({ mediaType: 'video' }, async (response) => {
      if (response.didCancel || response.errorCode) return;
      const asset = response.assets?.[0];
      if (!asset?.uri) return;

      const sizeMB = (asset.fileSize || 0) / (1024 * 1024);
      if (sizeMB > MAX_SUBMISSION_MB) {
        Toast.show(
          `That video is ${sizeMB.toFixed(0)} MB — the limit is ${MAX_SUBMISSION_MB} MB.`,
          Toast.LONG,
        );
        return;
      }

      if (!(await confirmUsageRights())) return;

      uploading.current = true;
      setBusy(true);
      setProgress(0);
      try {
        const row = await collabHubApi.submitVideo({
          applicationId: application.id,
          creatorId: user.id,
          fileUri: asset.uri,
          fileName: asset.fileName || 'submission.mp4',
          onProgress: pct => setProgress(typeof pct === 'number' ? pct : 0),
        });
        setData(d => ({ ...d, submission: row }));
        Toast.show('Uploaded — watermarking now', Toast.SHORT);
      } catch (e) {
        Toast.show(e?.message || 'Upload failed', Toast.LONG);
      } finally {
        uploading.current = false;
        setBusy(false);
        setProgress(null);
      }
    });
  };

  const retry = async () => {
    // Pre-agreement rows carry no acceptance, and the update policy needs one.
    if (!submission.agreement_accepted_at && !(await confirmUsageRights())) return;
    setBusy(true);
    try {
      await collabHubApi.retryWatermark(submission);
      Toast.show('Retrying', Toast.SHORT);
      await load();
    } catch (e) {
      Toast.show(e?.message || 'Could not retry', Toast.LONG);
    } finally {
      setBusy(false);
    }
  };

  const tone = key => ({
    success: C.accent.success,
    warning: C.accent.warning,
    error: C.accent.error,
    info: C.accent.info,
  }[key] || C.text.muted);

  // Shortlisted or accepted — both are a green light to upload (see the
  // insert policy on campaign_submissions).
  const canSubmit = application
    && ['shortlisted', 'accepted'].includes(application.status)
    && (!submission || submission.status === 'revision_requested');

  // One banner, not three: the submission supersedes the application once it
  // exists, because it is the thing that moves.
  const banner = submission
    ? { ...SUBMISSION_STATUS[submission.status], feedback: submission.feedback }
    : application
      ? APPLICATION_STATUS[application.status]
      : null;

  const pitchLen = pitch.trim().length;

  return (
    <SafeScreen
      scrollable={false}
      padding={0}
      hasBottomTabs={false}
      includeTopInset={STACK_OVERLAY_LAYOUT.safeScreenIncludeTopInset}
    >
      <StackScreenHeader insetTop={STACK_OVERLAY_LAYOUT.headerInsetTop}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.iconBtn}>
            <MaterialIcons name="arrow-back" size={22} color={C.accent.primary} />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {campaign?.brand?.name || 'Campaign'}
            </Text>
          </View>
          {campaign ? (
            <Pressable onPress={share} style={styles.iconBtn} hitSlop={8}>
              <MaterialIcons name="share" size={20} color={C.accent.primary} />
            </Pressable>
          ) : (
            <View style={styles.iconBtn} />
          )}
        </View>
      </StackScreenHeader>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={C.accent.secondary}
          />
        }
      >
        {error ? (
          <View style={styles.errorBox}>
            <MaterialIcons name="error-outline" size={16} color={C.accent.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {!data ? (
          <>
            <View style={styles.skelCover} />
            <View style={[styles.skelLine, { width: '70%', height: 16 }]} />
            <View style={[styles.skelLine, { width: '90%' }]} />
            <View style={[styles.skelLine, { width: '50%' }]} />
          </>
        ) : !campaign ? (
          // Pulled or unpublished while the link was sitting in someone's chat.
          <View style={styles.errorBox}>
            <MaterialIcons name="info-outline" size={16} color={C.text.muted} />
            <Text style={styles.body}>This campaign is no longer available.</Text>
          </View>
        ) : (
          <>
            <View style={styles.hero}>
              {campaign.cover_image_url ? (
                <Image source={{ uri: campaign.cover_image_url }} style={styles.heroImage} resizeMode="cover" />
              ) : (
                <LinearGradient
                  colors={C.buttons.premiumGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.heroImage}
                />
              )}
              <LinearGradient
                colors={['transparent', 'rgba(6,4,18,0.35)', 'rgba(6,4,18,0.88)']}
                style={styles.heroScrim}
              />
              <View style={styles.heroFoot}>
                {campaign.brand?.avatar_url ? (
                  <Image source={{ uri: campaign.brand.avatar_url }} style={styles.heroAvatar} />
                ) : (
                  <View style={[styles.heroAvatar, styles.heroAvatarFallback]}>
                    <MaterialIcons name="business" size={13} color="#fff" />
                  </View>
                )}
                <Text style={styles.heroBrand} numberOfLines={1}>
                  {campaign.brand?.name || 'Brand'}
                </Text>
                {campaign.category ? (
                  <View style={styles.heroTag}>
                    <Text style={styles.heroTagText} numberOfLines={1}>{campaign.category}</Text>
                  </View>
                ) : null}
              </View>
            </View>

            <Text style={styles.title}>{campaign.title}</Text>

            <View style={styles.statRow}>
              <Stat value={money(campaign.budget_per_winner)} label="per winner" styles={styles} />
              <View style={styles.statDivider} />
              <Stat
                value={String(campaign.winner_count || 1)}
                label={campaign.winner_count > 1 ? 'creators picked' : 'creator picked'}
                styles={styles}
              />
              {campaign.video_duration_seconds ? (
                <>
                  <View style={styles.statDivider} />
                  <Stat value={`${campaign.video_duration_seconds}s`} label="video length" styles={styles} />
                </>
              ) : null}
            </View>

            {banner ? (
              <View style={[styles.banner, { borderColor: tone(banner.tone) }]}>
                <View style={[styles.bannerIcon, { backgroundColor: `${tone(banner.tone)}22` }]}>
                  <MaterialIcons name={banner.icon} size={18} color={tone(banner.tone)} />
                </View>
                <View style={styles.flex1}>
                  <Text style={[styles.bannerLabel, { color: tone(banner.tone) }]}>{banner.label}</Text>
                  <Text style={styles.bannerBody}>{banner.body}</Text>
                  {banner.feedback ? <Text style={styles.feedback}>{banner.feedback}</Text> : null}
                </View>
              </View>
            ) : null}

            {submission?.watermark_error ? (
              <View style={[styles.banner, { borderColor: C.accent.error }]}>
                <View style={[styles.bannerIcon, { backgroundColor: `${C.accent.error}22` }]}>
                  <MaterialIcons name="error-outline" size={18} color={C.accent.error} />
                </View>
                <View style={styles.flex1}>
                  <Text style={[styles.bannerLabel, { color: C.accent.error }]}>Processing failed</Text>
                  <Text style={styles.bannerBody}>{submission.watermark_error}</Text>
                  <Pressable style={styles.secondaryBtn} onPress={retry} disabled={busy}>
                    <MaterialIcons name="refresh" size={14} color={C.text.primary} />
                    <Text style={styles.secondaryText}>Retry processing</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}

            {unlock ? (
              <View style={[styles.banner, { borderColor: C.accent.success }]}>
                <View style={[styles.bannerIcon, { backgroundColor: `${C.accent.success}22` }]}>
                  <MaterialIcons name="lock-open" size={18} color={C.accent.success} />
                </View>
                <View style={styles.flex1}>
                  <Text style={[styles.bannerLabel, { color: C.accent.success }]}>
                    Paid {money(unlock.amount_paid)}
                  </Text>
                  <Text style={styles.bannerBody}>
                    The brand unlocked your video. It lands in your wallet.
                  </Text>
                </View>
              </View>
            ) : null}

            <Section title="The brief" text={campaign.description} styles={styles} icon="description" C={C} />
            <Section title="What they want" text={campaign.objectives} styles={styles} icon="track-changes" C={C} />
            <Section title="Audience" text={campaign.target_audience} styles={styles} icon="groups" C={C} />
            <Section title="Who can apply" text={campaign.eligibility_criteria} styles={styles} icon="verified-user" C={C} />
            <Section title="Usage rights" text={campaign.content_usage_rights} styles={styles} icon="gavel" C={C} />

            <View style={styles.metaCard}>
              {(campaign.platforms || []).length ? (
                <MetaRow icon="share" label="Post on" value={campaign.platforms.join(' · ')} styles={styles} C={C} />
              ) : null}
              {campaign.location ? (
                <MetaRow icon="place" label="Location" value={campaign.location} styles={styles} C={C} />
              ) : null}
              {campaign.application_deadline ? (
                <MetaRow
                  icon="how-to-reg"
                  label="Apply by"
                  value={moment(campaign.application_deadline).format('D MMM YYYY')}
                  styles={styles}
                  C={C}
                />
              ) : null}
              {campaign.submission_deadline ? (
                <MetaRow
                  icon="movie"
                  label="Deliver by"
                  value={moment(campaign.submission_deadline).format('D MMM YYYY')}
                  styles={styles}
                  C={C}
                  last
                />
              ) : null}
            </View>

            {application?.pitch ? (
              <View style={styles.card}>
                <View style={styles.sectionHead}>
                  <MaterialIcons name="forum" size={14} color={C.text.muted} />
                  <Text style={styles.sectionTitle}>Your pitch</Text>
                </View>
                <Text style={styles.body}>{application.pitch}</Text>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>

      {/* Sticky action bar: the one thing to do on this screen, always in reach. */}
      {campaign ? (
        <View style={[styles.actionBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          {progress !== null ? (
            <View style={styles.progressWrap}>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${progress}%` }]} />
              </View>
              <Text style={styles.progressText}>Uploading {progress}%</Text>
            </View>
          ) : !application ? (
            <Pressable
              style={[styles.primaryBtn, busy && styles.btnDisabled]}
              onPress={() => sheet.current?.show()}
              disabled={busy}
            >
              <Text style={styles.primaryText}>Apply to this campaign</Text>
              <MaterialIcons name="arrow-forward" size={18} color="#fff" />
            </Pressable>
          ) : canSubmit ? (
            <Pressable
              style={[styles.primaryBtn, busy && styles.btnDisabled]}
              onPress={pickAndSubmit}
              disabled={busy}
            >
              <MaterialIcons name="file-upload" size={18} color="#fff" />
              <Text style={styles.primaryText}>
                {submission ? 'Upload a new cut' : 'Upload your video'}
              </Text>
            </Pressable>
          ) : (
            <View style={styles.statusStrip}>
              {submission?.status === 'processing' ? (
                <ActivityIndicator size="small" color={C.accent.secondary} />
              ) : (
                <MaterialIcons
                  name={banner?.icon || 'schedule'}
                  size={17}
                  color={tone(banner?.tone)}
                />
              )}
              <Text style={styles.statusStripText} numberOfLines={1}>
                {banner?.label || 'Applied'}
              </Text>
            </View>
          )}
        </View>
      ) : null}

      <BottomSheet
        ref={sheet}
        height={360}
        radius={22}
        sheetBackgroundColor={C.surface.panel}
        dragIconColor={C.text.muted}
      >
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>Your pitch</Text>
          <Text style={styles.sheetHint}>
            Why you, and how you would shoot this. The brand reads this next to your profile.
          </Text>
          <TextInput
            style={styles.pitchInput}
            value={pitch}
            onChangeText={setPitch}
            multiline
            maxLength={PITCH_MAX}
            placeholder="I make short-form food content in Pune…"
            placeholderTextColor={C.text.muted}
            autoFocus
          />
          <View style={styles.sheetFoot}>
            <Text style={[styles.counter, pitchLen >= PITCH_MIN && styles.counterOk]}>
              {pitchLen < PITCH_MIN
                ? `${PITCH_MIN - pitchLen} more characters`
                : `${pitchLen}/${PITCH_MAX}`}
            </Text>
            <Pressable
              style={[
                styles.sendBtn,
                (busy || pitchLen < PITCH_MIN) && styles.btnDisabled,
              ]}
              onPress={apply}
              disabled={busy || pitchLen < PITCH_MIN}
            >
              <Text style={styles.primaryText}>{busy ? 'Sending…' : 'Send application'}</Text>
            </Pressable>
          </View>
        </View>
      </BottomSheet>
    </SafeScreen>
  );
}

function Stat({ value, label, styles }) {
  return (
    <View style={styles.statBlock}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Section({ title, text, styles, icon, C }) {
  if (!text) return null;
  return (
    <View style={styles.card}>
      <View style={styles.sectionHead}>
        <MaterialIcons name={icon} size={14} color={C.text.muted} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <Text style={styles.body}>{text}</Text>
    </View>
  );
}

function MetaRow({ icon, label, value, styles, C, last }) {
  return (
    <View style={[styles.metaRow, last && styles.metaRowLast]}>
      <MaterialIcons name={icon} size={15} color={C.text.muted} />
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const makeStyles = (theme) => {
  const C = theme.colors;
  return StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: theme.spacing.md },
    headerCenter: { flex: 1, alignItems: 'center' },
    headerTitle: { color: C.text.primary, fontSize: 15, fontWeight: '800' },
    iconBtn: { padding: 8, minWidth: 38 },
    content: {
      paddingHorizontal: theme.spacing.lg,
      paddingBottom: 110,
      gap: theme.spacing.md,
    },
    flex1: { flex: 1 },

    hero: { borderRadius: 18, overflow: 'hidden', height: 180, justifyContent: 'flex-end' },
    heroImage: { ...StyleSheet.absoluteFillObject, backgroundColor: softFillStrong(theme) },
    heroScrim: { ...StyleSheet.absoluteFillObject },
    heroFoot: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      padding: theme.spacing.md,
    },
    heroAvatar: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: 'rgba(255,255,255,0.25)',
    },
    heroAvatarFallback: { alignItems: 'center', justifyContent: 'center' },
    heroBrand: { flex: 1, color: '#fff', fontSize: 13, fontWeight: '800' },
    heroTag: {
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
      backgroundColor: 'rgba(255,255,255,0.9)',
      maxWidth: '45%',
    },
    heroTagText: { color: '#1a1a2e', fontSize: 10, fontWeight: '800' },

    title: { color: C.text.primary, fontSize: 21, fontWeight: '800', lineHeight: 28 },

    statRow: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: softBorder(theme),
      backgroundColor: cardFill(theme),
      paddingVertical: theme.spacing.md,
    },
    statBlock: { flex: 1, alignItems: 'center', gap: 2 },
    statDivider: { width: 1, height: 28, backgroundColor: softBorder(theme) },
    statValue: { color: C.accent.primary, fontSize: 17, fontWeight: '800' },
    statLabel: {
      color: C.text.muted,
      fontSize: 9.5,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },

    banner: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 11,
      borderRadius: 16,
      borderWidth: 1,
      padding: theme.spacing.md,
      backgroundColor: softFill(theme),
    },
    bannerIcon: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
    },
    bannerLabel: { fontSize: 13.5, fontWeight: '800' },
    bannerBody: { color: C.text.secondary, fontSize: 12, lineHeight: 17, marginTop: 1 },
    feedback: {
      color: C.text.secondary,
      fontSize: 12,
      lineHeight: 17,
      marginTop: 7,
      padding: 9,
      borderRadius: 10,
      backgroundColor: softFillStrong(theme),
      fontStyle: 'italic',
    },

    card: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: softBorder(theme),
      backgroundColor: cardFill(theme),
      padding: theme.spacing.md,
      gap: 7,
    },
    sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    sectionTitle: {
      color: C.text.muted,
      fontSize: 10.5,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    body: { color: C.text.secondary, fontSize: 13, lineHeight: 19 },

    metaCard: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: softBorder(theme),
      backgroundColor: cardFill(theme),
      paddingHorizontal: theme.spacing.md,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: softBorder(theme),
    },
    metaRowLast: { borderBottomWidth: 0 },
    metaLabel: { color: C.text.muted, fontSize: 12, flex: 1 },
    metaValue: { color: C.text.primary, fontSize: 12.5, fontWeight: '700', flexShrink: 1 },

    // ── sticky action bar ──────────────────────────────────────────────────
    actionBar: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: softBorder(theme),
      backgroundColor: C.surface.sheet,
    },
    primaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderRadius: 14,
      paddingVertical: 15,
      backgroundColor: C.component.button,
    },
    primaryText: { color: '#fff', fontSize: 14, fontWeight: '800' },
    btnDisabled: { opacity: 0.5 },
    statusStrip: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderRadius: 14,
      paddingVertical: 14,
      backgroundColor: softFill(theme),
    },
    statusStripText: { color: C.text.secondary, fontSize: 13, fontWeight: '700' },
    progressWrap: { gap: 7, paddingVertical: 6 },
    progressTrack: {
      height: 6,
      borderRadius: 3,
      backgroundColor: softFillStrong(theme),
      overflow: 'hidden',
    },
    progressFill: { height: 6, borderRadius: 3, backgroundColor: C.accent.secondary },
    progressText: { color: C.text.secondary, fontSize: 12, fontWeight: '700', textAlign: 'center' },

    secondaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      alignSelf: 'flex-start',
      marginTop: 9,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: softBorder(theme),
      paddingHorizontal: 11,
      paddingVertical: 7,
    },
    secondaryText: { color: C.text.primary, fontSize: 11.5, fontWeight: '700' },

    // ── pitch sheet ────────────────────────────────────────────────────────
    sheet: { paddingHorizontal: theme.spacing.lg, paddingTop: 6, gap: 9 },
    sheetTitle: { color: C.text.primary, fontSize: 17, fontWeight: '800' },
    sheetHint: { color: C.text.muted, fontSize: 12, lineHeight: 17 },
    pitchInput: {
      color: C.text.primary,
      backgroundColor: softFill(theme),
      borderRadius: 12,
      padding: 12,
      fontSize: 13,
      height: 130,
      textAlignVertical: 'top',
    },
    sheetFoot: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    counter: { color: C.accent.warning, fontSize: 11, fontWeight: '700', flex: 1 },
    counterOk: { color: C.text.muted },
    sendBtn: {
      borderRadius: 12,
      paddingHorizontal: 20,
      paddingVertical: 13,
      backgroundColor: C.component.button,
    },

    errorBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      borderRadius: 12,
      padding: theme.spacing.md,
      backgroundColor: softFill(theme),
    },
    errorText: { color: C.accent.error, fontSize: 12, flex: 1 },

    skelCover: { width: '100%', height: 180, borderRadius: 18, backgroundColor: softFillStrong(theme) },
    skelLine: { height: 11, borderRadius: 6, backgroundColor: softFillStrong(theme) },
  });
};
