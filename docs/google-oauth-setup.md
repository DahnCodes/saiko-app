# Google OAuth Setup for SAIKO

The frontend calls Supabase Auth with `signInWithOAuth({ provider: 'google' })`. The provider must be enabled in the linked Supabase project before the button can work.

1. In Supabase Dashboard, open Authentication > Providers > Google and enable it.
2. In Google Cloud Console, create an OAuth 2.0 Web Client ID.
3. Add the Supabase callback URL shown in the provider panel as an authorized redirect URI. It normally looks like `https://<project-ref>.supabase.co/auth/v1/callback`.
4. Add the local application origin, `http://localhost:5173`, under authorized JavaScript origins.
5. Paste the Google client ID and client secret into the Supabase Google provider settings. Do not put either value in Vite environment variables or source code.
6. In Supabase Authentication > URL Configuration, add `http://localhost:5173` to the redirect allow list. Add the production URL there before deploying.

After saving, the existing **Continue with Google** button will redirect through Supabase Auth and return to the application. New Google users still complete username and favorite onboarding.
