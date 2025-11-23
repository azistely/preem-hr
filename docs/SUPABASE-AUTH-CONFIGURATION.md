# Supabase Authentication Configuration Guide

## Password Reset Email Not Redirecting Correctly

If password reset emails redirect to the homepage instead of `/auth/reset-password`, follow these steps:

### 1. Configure Redirect URLs in Supabase Dashboard

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **Authentication** → **URL Configuration**
4. Update the following settings:

#### Site URL
Set this to your production domain:
```
https://www.preemhr.com
```

#### Redirect URLs (Add these)
Add the following URLs to the **Redirect URLs** allowlist:
```
https://www.preemhr.com/auth/reset-password
https://www.preemhr.com/auth/confirm
https://www.preemhr.com/onboarding
http://localhost:3002/auth/reset-password (for local development)
http://localhost:3002/auth/confirm (for local development)
http://localhost:3002/onboarding (for local development)
```

**Important:** Each URL must be added separately. Click "+ Add URL" for each one.

### 2. Email Template Configuration (Optional)

Supabase uses email templates for password reset. To customize:

1. Go to **Authentication** → **Email Templates**
2. Select "Reset Password" template
3. Ensure the confirm link uses: `{{ .ConfirmationURL }}`
4. The default template should work correctly once redirect URLs are configured

### 3. Verify Environment Variables

Ensure your production environment has the correct URL:

```bash
# In your production environment (Vercel, Railway, etc.)
NEXT_PUBLIC_APP_URL=https://www.preemhr.com
```

**Note:** Do NOT include a trailing slash. The code will handle path construction.

### 4. Test the Flow

After configuration:

1. Request a password reset from https://www.preemhr.com/auth/forgot-password
2. Check your email
3. Click the reset link
4. You should be redirected to https://www.preemhr.com/auth/reset-password
5. Enter your new password and confirm

### 5. Troubleshooting

#### Still redirecting to homepage?

Check server logs for:
```
[Password Reset] Sending reset email to: user@example.com
[Password Reset] Redirect URL: https://www.preemhr.com/auth/reset-password
```

If the redirect URL looks correct in logs but email still redirects wrong:
- Double-check Supabase dashboard Redirect URLs allowlist
- Ensure Site URL doesn't have trailing slash
- Try clearing Supabase dashboard cache (log out and back in)

#### Redirect URL not in allowlist error?

Supabase will block redirects to URLs not in the allowlist. Add the exact URL shown in the error to the Redirect URLs list.

#### Local development issues?

Ensure these are in `.env.local`:
```bash
NEXT_PUBLIC_APP_URL=http://localhost:3002
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

---

## Related Files

- Password reset request: `app/auth/forgot-password/actions.ts`
- Password reset form: `app/auth/reset-password/page.tsx`
- Email confirmation handler: `app/auth/confirm/route.ts`
- Supabase client: `lib/supabase/server.ts`

## Security Notes

- Reset links expire after 1 hour (Supabase default)
- Rate limiting: 3 reset requests per hour per email
- Email enumeration protection: Always returns success response
- PKCE flow ensures tokens cannot be intercepted

---

Last updated: 2025-11-23
