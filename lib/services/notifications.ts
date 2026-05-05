import { getServiceClient } from '../db';

/**
 * Marks notifications as read.
 */
export async function markRead(userId: string, ids: string[]) {
  const sb = getServiceClient();
  
  const { error } = await sb
    .from('notifications')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .in('id', ids);

  if (error) throw error;
  return true;
}

/**
 * Creates a notification for a user.
 */
export async function createNotification(userId: string, title: string, message: string, metadata: any = {}) {
  const sb = getServiceClient();
  
  const { data, error } = await sb
    .from('notifications')
    .insert({
      user_id: userId,
      title,
      message,
      metadata,
      is_read: false
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}
