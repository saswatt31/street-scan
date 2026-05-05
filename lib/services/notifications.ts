import { getServiceClient } from '../db';

/**
 * Marks a notification as read.
 */
export async function markRead(id: string) {
  const sb = getServiceClient();
  
  const { data, error } = await sb
    .from('notifications')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
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
