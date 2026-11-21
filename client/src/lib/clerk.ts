/** Clerk publishable key (pk_test_… / pk_live_…). Empty → Clerk sign-in is hidden. */
export const CLERK_PUBLISHABLE_KEY = (import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ?? '').trim();
export const isClerkConfigured = CLERK_PUBLISHABLE_KEY.length > 0;
