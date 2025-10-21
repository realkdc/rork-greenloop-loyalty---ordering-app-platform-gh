/**
 * Reusable magic link login function
 * Extracted from the existing banner login logic in ProfileTab
 */
import { WebView } from 'react-native-webview';

export interface LoginWithMagicLinkOptions {
  webViewRef: React.RefObject<WebView>;
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

export const loginWithMagicLink = async (
  token: string,
  options: LoginWithMagicLinkOptions
): Promise<boolean> => {
  const { webViewRef, onSuccess, onError } = options;
  
  if (!webViewRef.current) {
    const error = 'WebView ref not available';
    console.error('❌', error);
    onError?.(error);
    return false;
  }

  try {
    console.log('🔐 Applying magic link with token:', token);

    const safeToken = token.replace(/'/g, "\\'");
    const applyScript = `
      (function(){
        try {
          console.log('[Auth] Injecting magic link form submission');
          const token = '${safeToken}';

          const existingForm = document.querySelector('form[action*="account/login"]');
          if (existingForm) {
            const input = existingForm.querySelector('input[name="email"]');
            if (input) {
              input.value = '';
            }
          }

          var form = document.createElement('form');
          form.method = 'POST';
          form.action = 'https://greenhauscc.com/account/login';
          form.style.display = 'none';

          var typeInput = document.createElement('input');
          typeInput.type = 'hidden';
          typeInput.name = 'form_type';
          typeInput.value = 'customer_login';
          form.appendChild(typeInput);

          var tokenInput = document.createElement('input');
          tokenInput.type = 'hidden';
          tokenInput.name = 'key';
          tokenInput.value = token;
          form.appendChild(tokenInput);

          document.body.appendChild(form);
          form.submit();

          console.log('[Auth] Magic link form submitted');
        } catch(e){
          console.error('[Auth] Error submitting magic link form', e);
        }
      })();
      true;
    `;

    webViewRef.current.injectJavaScript(applyScript);
    
    console.log('✅ Magic link applied successfully');
    onSuccess?.();
    return true;
    
  } catch (error) {
    const errorMessage = `Failed to apply magic link: ${error}`;
    console.error('❌', errorMessage);
    onError?.(errorMessage);
    return false;
  }
};
