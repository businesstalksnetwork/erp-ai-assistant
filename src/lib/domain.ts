/**
 * Returns the production domain URL for all external-facing links.
 * This ensures referral and partner links always use the custom domain,
 * regardless of the current environment (preview, localhost, etc.)
 */
export function getProductionUrl(): string {
  return 'https://pausalbox.aiknjigovodja.rs';
}
