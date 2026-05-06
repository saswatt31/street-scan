export type UserRole = 'admin' | 'repair_team' | 'citizen';

export type TicketStatus = 
  | 'reported'
  | 'verified' 
  | 'assigned' 
  | 'in_progress' 
  | 'resolved' 
  | 'rejected';

export type DamageType = 
  | 'pothole' 
  | 'crack' 
  | 'subsidence'
  | 'structural'
  | 'flooding'
  | 'other';

export type Priority = 'low' | 'medium' | 'high' | 'critical';

export interface Report {
  id: string;
  created_at: string;
  latitude: number;
  longitude: number;
  damage_type: DamageType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  severity_score: number;
  image_url?: string;
  image_path?: string;
  status: 'pending' | 'validated' | 'rejected' | 'clustered' | 'assigned' | 'resolved';
  report_id?: string; // used in some contexts as alias for id
  ticket_id?: string;
  reporter_id?: string;
  reporter_name?: string;
  address?: string;
  nearest_landmark?: string;
  description?: string;
  source: 'citizen' | 'iot' | 'camera' | 'dashcam';
  ai_validated: boolean;
  ai_damage: boolean;
  ai_confidence: number;
  ai_notes?: string;
  ai_processed_at?: string;
  recurrence_count?: number;
  first_reported_at?: string;
  last_reported_at?: string;
}

export interface Ticket {
  id: string;
  created_at: string;
  updated_at?: string;
  ticket_number: string;
  report_id?: string;
  cluster_id?: string;
  title: string;
  description: string;
  status: TicketStatus;
  priority: Priority;
  assigned_to?: string | null;
  assigned_team?: string | null;
  resolved_at?: string | null;
  resolution_notes?: string | null;
  resolution_image_url?: string | null;
  ai_verified_resolved?: boolean;
  reports?: {
    image_url: string | null;
  };
}
