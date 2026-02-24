export type AgentStatus =
  | 'idle'
  | 'requesting_token'
  | 'connecting'
  | 'connected'
  | 'disconnecting'
  | 'error';

export interface LeadData {
  name?: string;
  phone?: string;
  email?: string;
  budget?: string;
  propertyType?: string;
  location?: string;
  purchaseObjective?: string;
  financingMode?: string;
  timeline?: string;
  bedrooms?: number;
  qualification?: string;
  notes?: string;
}

export interface MeetingBooking {
  name?: string;
  email?: string;
  phone?: string;
  date?: string;
  time?: string;
  meetingType?: string;
  notes?: string;
  confirmed?: boolean;
}

export interface TranscriptEntry {
  role: 'user' | 'agent' | 'system';
  text: string;
  timestamp: number;
}
