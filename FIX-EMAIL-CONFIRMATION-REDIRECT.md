# 🔧 Fix: Email Confirmation Redirects to Homepage

## 🐛 Problem

Email confirmation links redirect users to the homepage instead of the onboarding flow:
- Current: `https://whrcqqnrzfcehlbnwhfl.supabase.co/auth/v1/verify?token=...&redirect_to=https://preem-hr.vercel.app` → Homepage
- Expected: User clicks link → Email verified → Redirect to `/onboarding`

## 🔍 Root Cause

The Supabase email template is using the **direct Supabase verification endpoint** instead of routing through your app's confirmation handler at `/auth/confirm`.

**What's happening:**
1. User clicks link in email
2. Supabase verifies the token
3. Supabase redirects to `redirect_to` URL (homepage)
4. ❌ User lands on homepage, not logged in, confused

**What should happen:**
1. User clicks link in email
2. Link goes to **your app**: `/auth/confirm?token_hash=...&type=email`
3. Your app verifies token with Supabase
4. Your app creates session
5. ✅ Your app redirects to `/onboarding`

---

## ✅ Solution: Update Supabase Email Template

### Step 1: Update Confirm Signup Email Template

1. Go to [Supabase Dashboard](https://supabase.com/dashboard) → Your Project
2. Navigate to **Authentication** → **Email Templates**
3. Click on **Confirm signup** template
4. Replace the email HTML with:

```html
<h2>Bienvenue sur Preem HR !</h2>

<p>Merci d'avoir créé votre compte. Pour commencer, activez votre email en cliquant sur le bouton ci-dessous:</p>

<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 20px 0;">
  <tr>
    <td style="border-radius: 6px; background-color: #0891B2;">
      <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email"
         target="_blank"
         style="border: solid 1px #0891B2; border-radius: 6px; color: #ffffff; display: inline-block; font-size: 16px; font-weight: bold; margin: 0; padding: 12px 25px; text-decoration: none;">
        Activer mon compte
      </a>
    </td>
  </tr>
</table>

<p style="color: #666; font-size: 14px;">Ou copiez ce lien dans votre navigateur:</p>
<p style="color: #0891B2; font-size: 12px; word-break: break-all;">
  {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
</p>

<hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />

<p style="color: #999; font-size: 12px;">
  Ce lien expire dans 24 heures.<br />
  Si vous n'avez pas créé de compte Preem HR, ignorez cet email.
</p>
```

**Key Points:**
- ✅ Uses `{{ .SiteURL }}/auth/confirm` (routes through your app)
- ✅ Uses `token_hash={{ .TokenHash }}` and `type=email` (your route handler expects these)
- ✅ No `redirect_to` parameter (your app controls the redirect)
- ✅ Styled button for better UX
- ✅ Fallback plain link for email clients that block buttons

---

### Step 2: Configure Site URL

1. In **Supabase Dashboard** → **Authentication** → **URL Configuration**
2. Set **Site URL** to: `https://preem-hr.vercel.app`
3. Add **Redirect URLs** (one per line):

```
https://preem-hr.vercel.app/auth/confirm
https://preem-hr.vercel.app/onboarding
http://localhost:3002/auth/confirm
http://localhost:3002/onboarding
```

**Why these URLs?**
- `/auth/confirm` - Where email links point to
- `/onboarding` - Where users are redirected after confirmation
- `localhost:3002` - For local development testing

---

### Step 3: Update Environment Variables

Make sure your `.env.local` has the correct URL:

```env
# Production
NEXT_PUBLIC_APP_URL=https://preem-hr.vercel.app

# Or for local dev:
NEXT_PUBLIC_APP_URL=http://localhost:3002
```

Also verify on Vercel:
1. Go to **Vercel Dashboard** → Your Project → **Settings** → **Environment Variables**
2. Add/update: `NEXT_PUBLIC_APP_URL` = `https://preem-hr.vercel.app`
3. Redeploy if needed

---

## 🧪 Testing the Fix

### Test in Production

1. **Create a test account:**
   - Go to https://preem-hr.vercel.app/signup
   - Use a real email you can access (e.g., your Gmail)
   - Complete signup form

2. **Check email:**
   - Open the confirmation email
   - Verify the link looks like: `https://preem-hr.vercel.app/auth/confirm?token_hash=...&type=email`
   - **NOT**: `https://whrcqqnrzfcehlbnwhfl.supabase.co/...`

3. **Click the link:**
   - Should redirect to https://preem-hr.vercel.app/onboarding
   - You should be logged in
   - You should see the onboarding wizard

4. **If it fails:**
   - Check browser console for errors
   - Check if you land on `/auth/auth-code-error` (means token invalid/expired)
   - Try again with a fresh signup

### Test Locally

```bash
# Start dev server
npm run dev

# Open http://localhost:3002/signup
# Complete signup with real email
# Check that email link points to localhost:3002/auth/confirm
```

---

## 📋 Verification Checklist

After updating the email template:

- [ ] Email template updated in Supabase Dashboard
- [ ] Site URL set to `https://preem-hr.vercel.app`
- [ ] Redirect URLs added (including `/auth/confirm`)
- [ ] `NEXT_PUBLIC_APP_URL` env var set correctly on Vercel
- [ ] Test signup with real email address
- [ ] Email link points to your app (not `whrcqqnrzfcehlbnwhfl.supabase.co`)
- [ ] Clicking link redirects to `/onboarding` (not homepage)
- [ ] User is logged in after confirmation

---

## 🎨 HCI Improvements for Email Template

The email template above includes several UX improvements for low digital literacy users:

### Visual Design
- ✅ **Large button** (min 44px height) - easy to tap on mobile
- ✅ **High contrast** (teal button on white background)
- ✅ **Clear hierarchy** (heading → button → fallback link)

### Copy (Text)
- ✅ **Action-oriented:** "Activer mon compte" (not "Verify email")
- ✅ **French language** throughout
- ✅ **Simple instructions:** One clear action
- ✅ **Expiration notice:** "Ce lien expire dans 24 heures"

### Accessibility
- ✅ **Fallback link:** Plain URL for email clients that block buttons
- ✅ **Alt text ready:** Works with screen readers
- ✅ **Works without images:** Pure HTML/CSS (no image dependencies)

---

## 🔧 Advanced: Custom Email Domain (Optional)

For better deliverability and branding, consider using a custom email domain:

1. Go to **Supabase Dashboard** → **Project Settings** → **Auth**
2. Scroll to **SMTP Settings**
3. Configure with your email provider (SendGrid, AWS SES, etc.)
4. Update "From" address to: `noreply@preem-hr.com` or `notifications@yourdomain.com`

**Benefits:**
- ✅ Better email deliverability (less spam)
- ✅ Professional branding
- ✅ Custom email templates with your logo

---

## 🚨 Common Issues & Fixes

### Issue 1: Email Link Still Goes to Homepage

**Cause:** Email template not saved or cached
**Fix:**
1. Clear the email template in Supabase Dashboard
2. Re-paste the HTML exactly as shown above
3. Click **Save**
4. Test with a **new signup** (old emails still use old template)

### Issue 2: "Invalid Token" Error

**Cause:** Token expired (24h) or already used
**Fix:**
1. Create a new signup (generates fresh token)
2. Click email link within 24 hours
3. Don't click the same link twice

### Issue 3: Redirects to Error Page

**Cause:** Token verification failed
**Fix:**
1. Check `app/auth/confirm/route.ts` is deployed
2. Check Supabase logs: Dashboard → Logs → Auth
3. Verify `type=email` parameter in URL (not `type=signup`)

### Issue 4: Email Not Received

**Cause:** SMTP rate limit or spam filter
**Fix:**
1. Check Supabase Dashboard → Authentication → Logs
2. Wait 2-3 minutes (email can be slow)
3. Check spam folder
4. Try resending (implement resend functionality)

---

## 📚 Technical Details

### Email Template Variables

Supabase provides these variables in email templates:

- `{{ .SiteURL }}` - Your site URL (from URL Configuration)
- `{{ .TokenHash }}` - Token for verification
- `{{ .Token }}` - **DEPRECATED** (don't use, use TokenHash)
- `{{ .ConfirmationURL }}` - Full Supabase verification URL (we're NOT using this)
- `{{ .RedirectTo }}` - Optional redirect after Supabase verification

**Why we use `{{ .SiteURL }}/auth/confirm` instead of `{{ .ConfirmationURL }}`:**
- ✅ Routes through our app (we control the session)
- ✅ We can show loading states, error handling
- ✅ We can customize redirect logic
- ✅ We can track analytics (who verified when)

### Confirmation Flow Diagram

```
User clicks email link
         ↓
https://preem-hr.vercel.app/auth/confirm?token_hash=abc123&type=email
         ↓
app/auth/confirm/route.ts (Next.js Route Handler)
         ↓
await supabase.auth.verifyOtp({ token_hash, type })
         ↓
Supabase validates token
         ↓
If valid: Create session, mark email as confirmed
         ↓
Redirect to /onboarding
         ↓
User sees onboarding wizard (logged in ✅)
```

---

## ✅ Success Indicators

You'll know it's working when:

1. **Email link format:**
   ```
   https://preem-hr.vercel.app/auth/confirm?token_hash=...&type=email
   ```
   NOT:
   ```
   https://whrcqqnrzfcehlbnwhfl.supabase.co/auth/v1/verify?...
   ```

2. **User journey:**
   - User clicks link
   - Brief flash of `/auth/confirm` page (< 1 second)
   - Immediate redirect to `/onboarding`
   - User is logged in (can see their name in nav)

3. **No errors:**
   - No 404 errors
   - No "Invalid token" errors
   - No landing on homepage confused

---

## 📝 Next Steps

After fixing the email template:

1. ✅ Test the full signup → email → confirm → onboarding flow
2. ⚠️ Implement "Resend verification email" feature (see EMAIL-CONFIRMATION-HCI-EVALUATION.md)
3. ⚠️ Add email typo correction (allow user to fix email before resending)
4. ⚠️ Add real-time verification polling (auto-detect when user clicks link)

---

**Status:** 🔴 **NEEDS IMMEDIATE FIX** - Update Supabase email template now to unblock all new signups.
