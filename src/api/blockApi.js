import { supabase } from "../lib/supabase";
import { getSupabaseErrorMessage } from "../lib/supabaseErrorHandler";

export const blockApi = {
  // Blocks the user and files a report so moderators are notified. The server
  // also drops their content from every feed this viewer loads.
  blockUser: async ({ blockedUserId, reason = "other", details = "" }) => {
    const targetId = String(blockedUserId || "").trim();
    if (!targetId) throw new Error("The user to block is missing.");
    const { error } = await supabase.rpc("block_user", {
      p_blocked_id: targetId,
      p_reason: reason,
      p_details: String(details || "").trim() || null,
    });
    if (error) throw new Error(getSupabaseErrorMessage(error));
  },

  unblockUser: async (blockedUserId) => {
    const targetId = String(blockedUserId || "").trim();
    if (!targetId) throw new Error("The user to unblock is missing.");
    const { error } = await supabase
      .from("user_blocks")
      .delete()
      .eq("blocked_id", targetId);
    if (error) throw new Error(getSupabaseErrorMessage(error));
  },

  listBlockedUsers: async () => {
    const { data, error } = await supabase
      .from("user_blocks")
      .select("blocked_id, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(getSupabaseErrorMessage(error));
    const ids = (data || []).map((row) => row.blocked_id);
    if (!ids.length) return [];
    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("id, name, avatar_url")
      .in("id", ids);
    if (profileError) throw new Error(getSupabaseErrorMessage(profileError));
    const byId = new Map((profiles || []).map((p) => [p.id, p]));
    return (data || []).map((row) => ({
      id: row.blocked_id,
      createdAt: row.created_at,
      name: byId.get(row.blocked_id)?.name || "Removed account",
      avatarUrl: byId.get(row.blocked_id)?.avatar_url || null,
    }));
  },
};
