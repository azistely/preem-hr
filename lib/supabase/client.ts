/**
 * DEPRECATED: Legacy Supabase Client
 *
 * ⚠️ WARNING: This file uses the old @supabase/supabase-js package directly
 * and does NOT handle cookies properly for SSR.
 *
 * DO NOT USE THIS FILE IN NEW CODE!
 *
 * Use instead:
 * - Client components: import { createAuthClient } from '@/lib/supabase/auth-client'
 * - Server components/actions: import { createClient } from '@/lib/supabase/server'
 * - Middleware: import { updateSession } from '@/lib/supabase/middleware'
 *
 * This file is kept only for backwards compatibility.
 * It should be removed once all usages are migrated.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * @deprecated Use createAuthClient() for client-side or createClient() for server-side instead
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
