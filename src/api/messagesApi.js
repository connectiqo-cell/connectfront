import { supabase } from '../lib/supabase';
import { getSupabaseErrorMessage } from '../lib/supabaseErrorHandler';

const CONVERSATION_SELECT =
  'id, mentor_id, learner_id, last_message_at, last_message_preview, mentor_last_read_at, learner_last_read_at, mentor:mentor_id ( id, name, avatar_url ), learner:learner_id ( id, name, avatar_url )';

async function run(query) {
  try {
    const { data, error } = await query;
    if (error) throw error;
    return data;
  } catch (error) {
    throw new Error(getSupabaseErrorMessage(error));
  }
}

/** True when this user has a message newer than their own last-read mark. */
export function isConversationUnread(conversation, userId) {
  const lastReadAt = conversation.mentor_id === userId
    ? conversation.mentor_last_read_at
    : conversation.learner_last_read_at;
  return !lastReadAt || new Date(lastReadAt) < new Date(conversation.last_message_at);
}

/**
 * Matches connectiqo_web-portal messagesApi. Learner label-only rule (until an
 * active booking exists) is enforced server-side in send_message().
 */
export const messagesApi = {
  getConversations: async (userId) =>
    (await run(
      supabase
        .from('conversations')
        .select(CONVERSATION_SELECT)
        .or(`mentor_id.eq.${userId},learner_id.eq.${userId}`)
        .order('last_message_at', { ascending: false }),
    )) || [],

  getConversation: (conversationId) =>
    run(supabase.from('conversations').select(CONVERSATION_SELECT).eq('id', conversationId).maybeSingle()),

  getOrCreateConversation: ({ mentorId, learnerId }) =>
    run(supabase.rpc('get_or_create_conversation', { p_mentor_id: mentorId, p_learner_id: learnerId })),

  getMessages: async (conversationId) =>
    (await run(
      supabase
        .from('messages')
        .select('id, conversation_id, sender_id, body, is_label, created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true }),
    )) || [],

  sendMessage: ({ conversationId, body }) =>
    run(supabase.rpc('send_message', { p_conversation_id: conversationId, p_body: body })),

  getLabels: async (role) =>
    (await run(
      supabase
        .from('conversation_labels')
        .select('id, role, label, sort_order')
        .eq('role', role)
        .eq('is_active', true)
        .order('sort_order', { ascending: true }),
    )) || [],

  hasActiveBooking: async ({ mentorId, learnerId }) =>
    Boolean(await run(supabase.rpc('has_active_booking', { p_mentor_id: mentorId, p_learner_id: learnerId }))),

  getUnreadConversationCount: async (userId) => {
    const rows = await run(
      supabase
        .from('conversations')
        .select('mentor_id, learner_id, last_message_at, mentor_last_read_at, learner_last_read_at')
        .or(`mentor_id.eq.${userId},learner_id.eq.${userId}`),
    );
    return (rows || []).filter((c) => isConversationUnread(c, userId)).length;
  },

  markRead: ({ conversationId, userId, isMentor }) =>
    run(
      supabase
        .from('conversations')
        .update({ [isMentor ? 'mentor_last_read_at' : 'learner_last_read_at']: new Date().toISOString() })
        .eq('id', conversationId)
        .eq(isMentor ? 'mentor_id' : 'learner_id', userId),
    ),
};
