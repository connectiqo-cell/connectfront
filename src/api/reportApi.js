import { supabase } from "../lib/supabase";
import { getSupabaseErrorMessage } from "../lib/supabaseErrorHandler";

export const USER_REPORT_REASONS = [
  { value: "harassment", label: "Harassment or bullying" },
  { value: "hate_or_abuse", label: "Hate speech or abuse" },
  { value: "sexual_content", label: "Sexual or inappropriate content" },
  { value: "spam_or_scam", label: "Spam or scam" },
  { value: "impersonation", label: "Impersonation" },
  { value: "unsafe_behavior", label: "Unsafe behaviour" },
  { value: "other", label: "Other" },
];

const VALID_REASONS = new Set(USER_REPORT_REASONS.map((item) => item.value));
const VALID_CONTEXT_TYPES = new Set(["profile", "video", "booking", "call"]);

export const reportApi = {
  submitUserReport: async ({
    reportedUserId,
    reason,
    details = "",
    contextType = "profile",
    contextId = null,
  }) => {
    const targetId = String(reportedUserId || "").trim();
    const normalizedDetails = String(details || "").trim();

    if (!targetId) throw new Error("The reported user is missing.");
    if (!VALID_REASONS.has(reason))
      throw new Error("Select a valid report reason.");
    if (!VALID_CONTEXT_TYPES.has(contextType))
      throw new Error("Invalid report context.");
    if (normalizedDetails.length > 1000) {
      throw new Error("Report details must be 1,000 characters or less.");
    }
    if (contextType !== "profile" && !contextId) {
      throw new Error("Report context ID is required for this type of report.");
    }

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user?.id) throw new Error("You must be signed in to report a user.");
      if (user.id === targetId)
        throw new Error("You cannot report your own profile.");

      const { error } = await supabase.from("user_reports").insert({
        reporter_id: user.id,
        reported_user_id: targetId,
        reason,
        details: normalizedDetails || null,
        context_type: contextType,
        context_id: contextId || null,
      });
      if (error) {
        if (error.code === "23505") {
          throw new Error(
            contextType === "video"
              ? "You already have an open report for this video."
              : contextType === "call"
                ? "You already have an open report for this call."
              : contextType === "booking"
                ? "You already have an open report for this booking."
                : "You already have an open report for this user."
          );
        }
        throw error;
      }
    } catch (error) {
      // Preserve intentional client messages; only map raw Supabase errors.
      if (
        error instanceof Error &&
        !error.code &&
        error.message &&
        !error.message.startsWith("JSON")
      ) {
        const knownClient =
          error.message.includes("already have an open report") ||
          error.message.includes("must be signed in") ||
          error.message.includes("cannot report") ||
          error.message.includes("missing") ||
          error.message.includes("required") ||
          error.message.includes("valid report") ||
          error.message.includes("Invalid report") ||
          error.message.includes("1,000");
        if (knownClient) throw error;
      }
      throw new Error(getSupabaseErrorMessage(error));
    }
  },
};
