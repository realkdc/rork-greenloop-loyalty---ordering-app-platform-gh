/**
 * Pre-authenticated session cookies for App Store review
 * 
 * When DEMO_MODE is true, these cookies are injected into the webview
 * to automatically log reviewers into a test account without requiring
 * magic link authentication (which reviewers can't access).
 * 
 * These cookies are from a real logged-in session on greenhauscc.com
 */

export const PRE_AUTH_COOKIES = [
  {
    name: '_ga',
    value: 'GA1.1.2006634149.1762964163',
    domain: '.greenhauscc.com',
    path: '/',
    secure: false,
  },
  {
    name: '_ga_F8KP37XE5E',
    value: 'GS2.1.s1763129955$o5$g0$t1763129955$j60$l0$h0',
    domain: '.greenhauscc.com',
    path: '/',
    secure: false,
  },
  {
    name: 'ec-86917525-session',
    value: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJoYXNDaGVja291dCI6ZmFsc2UsImhhc1ByZXZpb3VzQ2hlY2tvdXQiOmZhbHNlLCJzdWIiOiJZWFNmRTYwdlgzV0xVRndtIiwiaGFzQ3VzdG9tZXIiOnRydWV9.jz2fotuHZ7DQgNwKJp19LEHEc3sEPIAHJ-X6-zlMr6c',
    domain: 'greenhauscc.com',
    path: '/',
    secure: true,
    sameSite: 'no_restriction',
  },
  {
    name: 'InAppAgeVerification',
    value: '1',
    domain: 'greenhauscc.com',
    path: '/',
    secure: false,
  },
];

