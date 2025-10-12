'use server';

import { createClient } from '@/lib/supabase/server';

export async function updatePassword(newPassword: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      console.error('[Update Password] Error:', error);
      return {
        success: false,
        error: 'Impossible de modifier le mot de passe',
      };
    }

    return { success: true };
  } catch (error) {
    console.error('[Update Password] Unexpected error:', error);
    return {
      success: false,
      error: 'Une erreur s\'est produite',
    };
  }
}
