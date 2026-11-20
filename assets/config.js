/*
 * TABI FIXER — site settings. This file is PUBLIC: never put secrets here.
 *
 * FORM_ENDPOINT
 *   PRODUCTION inquiry receiver (Google Apps Script web app …/exec, Arthur's account,
 *   saves to the private "TABI FIXER inquiries" sheet). The URL is not a secret.
 *   Local preview never uses it: tests/preview-server.js serves this file with the
 *   separate TEST receiver instead, and the automated tests swap in a mock.
 *   Before release, tests/release-check.js confirms this is the production receiver.
 *   Empty = form says "not connected — please email" and never shows success.
 *
 * FREE_CALL_URL
 *   Booking page for a FREE 15-minute call. Keep empty until a real 15-minute
 *   event exists. While empty, visitors ask for the call with a form checkbox.
 *
 * GA_MEASUREMENT_ID
 *   Google Analytics 4. Empty = GA is not loaded at all (no _ga cookies).
 *   Keep empty until the cookie/consent approach is decided. The form and the
 *   referral/source fields of inquiries work the same with GA off.
 *
 * Payment: Stripe links are NOT shown on the site. After confirming a request
 * by email, Arthur sends the existing Stripe Payment Link to that customer.
 */
window.TABI_CONFIG = {
  FORM_ENDPOINT: 'https://script.google.com/macros/s/AKfycbxjf0wb1M-BiS7sgXOE_2gAxujscbI1aHXoiifqr4EevsR-9l6etWuNFh5EoQj1QxMW3Q/exec',
  FREE_CALL_URL: '',
  GA_MEASUREMENT_ID: '',
  CONTACT_EMAIL: 'arthur@tabifixer.com'
};
