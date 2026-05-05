export type UserRole = 'admin' | 'repair_team' | 'citizen';

export type TicketStatus = 
  | 'open' 
  | 'verified' 
  | 'assigned' 
  | 'in_progress' 
  | 'resolved' 
  | 'rejected' 
  | 'archived';

export type DamageType = 
  | 'pothole' 
  | 'crack' 
  | 'faded_marking' 
  | 'debris' 
  | 'subsidence' 
  | 'manhole_issue' 
  | 'other';

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
  status: 'pending' | 'validated' | 'rejected';
  reporter_id?: string;
  ai_validated: boolean;
  ai_damage: boolean;
  ai_confidence: number;
}

export interface Ticket {
  id: string;
  created_at: string;
  report_id?: string;
  cluster_id?: string;
  status: TicketStatus;
  priority: 'low' | 'medium' | 'high' | 'emergency';
  assigned_to?: string;
  assigned_team?: string;
  resolution_notes?: string;
  resolution_image_url?: string;
}
