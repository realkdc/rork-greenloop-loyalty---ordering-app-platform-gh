export const AUTH_CONFIG = {
  host: 'greenhauscc.com',
  
  magicLinkPatterns: {
    hosts: ['greenhauscc.com'],
    paths: ['/products/account', '/account'],
    tokenParams: ['key', 'token', 'auth', 'login'],
  },
  
  cookieNames: [
    'ec_auth_token',
    'auth_token', 
    'token',
    'login_token',
  ],
  
  storageKeys: [
    'ec_auth_token',
    'auth_token',
  ],
  
  successSelectors: [
    '.account-dashboard',
    '.customer-info',
    '[data-user-name]',
    '.account-name',
  ],
  
  loginPagePatterns: [
    '/account/login',
    '/account#login',
    '/login',
  ],
  
  confirmationTextPatterns: [
    /link.*has.*been.*sent/i,
    /check.*your.*email/i,
    /sent.*you.*link/i,
    /email.*sent/i,
    /we.*sent.*you/i,
    /magic.*link.*sent/i,
  ],
  
  linkExpiryMinutes: 10,
} as const;
