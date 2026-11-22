import { getSupabaseErrorMessage } from "../supabaseErrorHandler";

// A creator emailed support a raw "new row violates row-level security policy
// for table campaign_submissions" — no RLS rejection should reach a user.
describe("RLS rejections", () => {
  const raw = 'new row violates row-level security policy for table "campaign_submissions"';

  it("explains a refused submission instead of quoting Postgres", () => {
    const msg = getSupabaseErrorMessage({ code: "42501", message: raw });

    expect(msg).not.toMatch(/row-level security|violates/i);
    expect(msg).toMatch(/deadline|shortlisted/i);
  });

  it("matches on the message when the code is missing", () => {
    expect(getSupabaseErrorMessage({ message: raw })).toMatch(/deadline|shortlisted/i);
  });

  it("falls back to a plain refusal for any other table", () => {
    const msg = getSupabaseErrorMessage({
      code: "42501",
      message: 'new row violates row-level security policy for table "withdrawal_requests"',
    });

    expect(msg).toBe("You do not have permission to do that.");
  });
});
