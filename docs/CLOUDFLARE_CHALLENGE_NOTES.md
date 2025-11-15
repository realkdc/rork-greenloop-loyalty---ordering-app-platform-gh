# Cloudflare Turnstile Requirements

The account tab embeds the Ecwid storefront in a React Native WebView. Ecwid occasionally
requires shoppers to pass a Cloudflare Turnstile challenge (`challenges.cloudflare.com`).
If we block those requests or hide the iframe, the storefront becomes unusable and App
Review will immediately reject the build.

## Do Not Remove These Safeguards

1. **Allowed host entry**  
   `components/WebShell.tsx` contains `ALLOWED_HOST_PATTERNS`.  
   The entry for `challenges.cloudflare.com` **must stay** or the iframe is blocked.

2. **Inline document allowance**  
   The Turnstile iframe loads as `about:srcdoc`. In `handleShouldStartLoadWithRequest`
   we explicitly allow URLs that start with `about:srcdoc`. Keep that check in place.

3. **Cloudflare state bridge**  
   `createInjectedJS()` posts `CLOUDFLARE_CHALLENGE_STATE` messages so the native
   helper banner can hide while the captcha renders. Do not delete this message type
   unless you replace the helper UX entirely.

## Verification Checklist

- Navigate to `/(tabs)/profile`.
- Confirm the Turnstile widget renders beneath the email field.
- Watch the native logs for `CLOUDFLARE_CHALLENGE_STATE` messages.
- Ensure the helper banner hides while the widget is visible.

If any of the above regress, re-run through this list before shipping. This doc exists
specifically so we do not regress the Cloudflare flow again.***

