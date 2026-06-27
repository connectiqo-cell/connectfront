export const getSupabaseErrorMessage = (error) => {
  if (!error) return 'An unknown error occurred';

  const message = error.message || '';
  const code = error.code || '';
  const status = error.status;

  // Auth — credentials
  if (
    code === 'invalid_credentials' ||
    message.includes('Invalid login credentials') ||
    message.includes('Incorrect email or password')
  ) {
    return 'Incorrect email or password. Please try again.';
  }

  // Auth — account state
  if (code === 'email_not_confirmed' || message.includes('Email not confirmed')) {
    return 'Please verify your email before signing in. Check your inbox.';
  }
  if (message.includes('User already registered')) {
    return 'This email is already registered. Try signing in instead.';
  }
  if (code === 'user_not_found') {
    return 'No account found with this email.';
  }

  // Auth — rate limiting
  if (
    code === 'over_email_send_rate_limit' ||
    code === 'over_request_rate_limit' ||
    status === 429 ||
    message.includes('too many requests') ||
    message.includes('rate limit')
  ) {
    return 'Too many attempts. Please wait a moment and try again.';
  }

  // Auth — session
  if (code === 'PGRST301' || code === 'session_not_found') {
    return 'Your session has expired. Please sign in again.';
  }

  // Auth — weak password
  if (code === 'weak_password') {
    return 'Password is too weak. Use at least 8 characters with letters and numbers.';
  }

  // Database errors
  if (code === '23505') {
    return 'This record already exists.';
  }
  if (code === '23502') {
    return 'A required field is missing.';
  }
  if (code === '42P01') {
    return 'Database error. Please contact support.';
  }

  // Network errors
  if (
    message.includes('Network request failed') ||
    message.includes('Failed to fetch') ||
    message.includes('network error')
  ) {
    return 'No internet connection. Please check your network and try again.';
  }

  return message || 'Something went wrong. Please try again.';
};
