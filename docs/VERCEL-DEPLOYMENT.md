# Vercel Deployment Guide - Preem HR

## Environment Variables Required

Add these to your Vercel project settings:

### Database & Supabase
```bash
DATABASE_URL="postgresql://postgres:password@host:5432/postgres"
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
```

### Application
```bash
NODE_ENV="production"
NEXT_PUBLIC_APP_URL="https://your-domain.vercel.app"  # CRITICAL for auth redirects
```

### Optional (but recommended)
```bash
# Rate limiting
UPSTASH_REDIS_REST_URL="https://your-redis.upstash.io"
UPSTASH_REDIS_REST_TOKEN="your-redis-token"

# Email notifications
RESEND_API_KEY="re_xxx"
EMAIL_FROM="noreply@your-domain.com"

# Workflows
INNGEST_EVENT_KEY="your-inngest-event-key"
INNGEST_SIGNING_KEY="your-inngest-signing-key"
```

## Common Deployment Issues

### Issue 1: Signup Works Locally But Not on Vercel

**Symptoms:**
- Signup completes on server (user created in database)
- Client shows "Une erreur s'est produite"
- Vercel logs show 303 redirect
- User is NOT redirected to `/auth/verify-email`

**Root Cause:**
Next.js Server Actions with `redirect()` behave differently on Vercel's serverless/edge runtime vs local Node.js.

**Solutions:**

#### Option A: Use Router.push (Client-Side Navigation) ✅ RECOMMENDED
```typescript
// In app/signup/actions.ts
export async function signup(formData: FormData) {
  // ... create user ...

  // Return success with redirect URL instead of using redirect()
  return {
    success: true,
    redirectTo: `/auth/verify-email?email=${encodeURIComponent(email)}`,
  };
}

// In app/signup/page.tsx
const result = await signup(formData);
if (result.success && result.redirectTo) {
  router.push(result.redirectTo);
} else if (!result.success) {
  toast.error(result.error);
}
```

#### Option B: Ensure redirect() is NEVER in try/catch
```typescript
// WRONG - redirect gets caught
try {
  await createUser();
  redirect('/success');  // ❌ Gets caught as error
} catch (error) {
  return { success: false };
}

// CORRECT - redirect outside try/catch
try {
  await createUser();
} catch (error) {
  return { success: false };
}
redirect('/success');  // ✅ Throws special NEXT_REDIRECT error
```

### Issue 2: Missing NEXT_PUBLIC_APP_URL

**Symptoms:**
- Email verification links go to wrong domain
- Password reset links broken

**Solution:**
Set `NEXT_PUBLIC_APP_URL` in Vercel dashboard:
```bash
NEXT_PUBLIC_APP_URL="https://your-production-domain.com"
```

Update Supabase redirect URLs:
- Go to Supabase Dashboard → Authentication → URL Configuration
- Add production URLs:
  ```
  https://your-domain.com/auth/confirm
  https://your-domain.com/auth/reset-password
  ```

### Issue 3: RLS/Database Connection Issues

**Symptoms:**
- `Failed query: select ... from users`
- RLS policy violations

**Solution:**
Ensure database connection string includes `search_path=public`:
```bash
DATABASE_URL="postgresql://user:pass@host:5432/db?options=-c%20search_path%3Dpublic"
```

### Issue 4: tRPC Context Creation Fails

**Symptoms:**
- `Cannot read cookies in Server Action`
- tRPC mutations fail on Vercel

**Solution:**
Verify middleware is properly configured and cookies are being set with correct domain/path.

## Deployment Checklist

Before deploying to Vercel:

- [ ] All environment variables added to Vercel project
- [ ] `NEXT_PUBLIC_APP_URL` set to production domain
- [ ] Supabase redirect URLs include production domain
- [ ] Database connection string includes `search_path=public`
- [ ] Upstash Redis configured (or rate limiting disabled)
- [ ] Email templates updated with production URLs
- [ ] Run `npm run build` locally to catch any build errors
- [ ] Run `npm run type-check` to verify TypeScript
- [ ] Test email delivery from production Supabase
- [ ] Verify `redirect()` calls are OUTSIDE try/catch blocks

## Testing Production Deployment

After deploying:

1. **Test Signup Flow:**
   ```
   1. Go to /signup
   2. Fill form and submit
   3. Should redirect to /auth/verify-email
   4. Check email inbox for confirmation
   5. Click link in email
   6. Should redirect to /onboarding
   ```

2. **Test Login Flow:**
   ```
   1. Try login before email verification (should fail)
   2. Verify email via link
   3. Login with verified account (should succeed)
   4. Should redirect to role-based dashboard
   ```

3. **Test Password Reset:**
   ```
   1. Go to /login → "Mot de passe oublié ?"
   2. Enter email
   3. Check inbox for reset link
   4. Click link → set new password
   5. Login with new password
   ```

4. **Check Vercel Logs:**
   ```bash
   vercel logs --follow
   ```
   - Look for any errors during signup/login
   - Verify 303 redirects are happening
   - Check for tRPC/database errors

## Debug Mode

To enable detailed logs on Vercel:

```bash
# In .env (Vercel)
DEBUG="*"
LOG_LEVEL="debug"
```

Then check Vercel function logs for detailed output.

## Performance Optimization

### Cold Start Issues
Vercel serverless functions have cold starts. For auth flows:
- Consider using Vercel Edge Runtime for middleware (already configured)
- Keep Server Actions lightweight
- Use edge-compatible libraries where possible

### Database Connection Pooling
Use Supabase connection pooler to avoid connection exhaustion:
```
postgresql://postgres:pass@aws-0-eu-west-3.pooler.supabase.com:6543/postgres
```

## Rollback Plan

If deployment fails:

1. **Immediate Rollback:**
   ```bash
   vercel rollback
   ```

2. **Check Previous Deployment:**
   - Go to Vercel Dashboard → Deployments
   - Click on working deployment
   - Click "Promote to Production"

3. **Fix and Redeploy:**
   - Fix issues locally
   - Test thoroughly
   - Push to git
   - Vercel auto-deploys

## Getting Help

If issues persist:

1. Check Vercel logs: `vercel logs --follow`
2. Check Supabase logs: Dashboard → Logs → Auth
3. Check browser console for client errors
4. Review this checklist thoroughly
5. Compare working local setup vs Vercel env vars

---

**Last Updated:** 2025-10-12
**Version:** 1.0.0
