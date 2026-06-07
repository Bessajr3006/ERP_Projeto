export type WhatsAppBusinessOwnerType = 'company' | 'user';
export type WhatsAppBusinessMessageDirection = 'inbound' | 'outbound';

export interface WhatsAppBusinessMessage {
    id: number;
    public_id: string;
    company_id: number;
    owner_type: WhatsAppBusinessOwnerType;
    owner_id: number;
    user_id?: number | null;
    direction: WhatsAppBusinessMessageDirection;
    contact_phone: string;
    contact_name: string | null;
    chat_id: string | null;
    message_id: string | null;
    message_type: string | null;
    message_text: string;
    media_mime_type: string | null;
    media_file_name: string | null;
    media_url: string | null;
    status: string | null;
    message_timestamp: number | null;
    raw_payload: string | null;
    created_at: Date | string;
    updated_at: Date | string;
}

export interface WhatsAppBusinessConversation {
    contact_phone: string;
    contact_name: string | null;
    last_notify_name?: string | null;
    last_chat_id?: string | null;
    last_message_public_id: string;
    last_message_text: string;
    last_direction: WhatsAppBusinessMessageDirection;
    last_message_type: string | null;
    last_status: string | null;
    last_message_timestamp: number | null;
    last_message_created_at: Date | string;
    messages_count: number;
}

export interface SaveWhatsAppBusinessMessageData {
    public_id?: string;
    direction: WhatsAppBusinessMessageDirection;
    contact_phone: string;
    contact_name?: string | null;
    chat_id?: string | null;
    message_id?: string | null;
    message_type?: string | null;
    message_text: string;
    media_mime_type?: string | null;
    media_file_name?: string | null;
    media_url?: string | null;
    status?: string | null;
    message_timestamp?: number | null;
    raw_payload?: string | null;
}

export interface WhatsAppBusinessMessageScope {
    companyId: number;
    ownerType: WhatsAppBusinessOwnerType;
    ownerId: number;
    userId?: number | null;
}

export interface WhatsAppBusinessAnalyticsSummary {
    total_messages: number;
    inbound_messages: number;
    outbound_messages: number;
    conversations_count: number;
    media_messages: number;
    messages_today: number;
    messages_last_7_days: number;
    phone_aliases_count: number;
    first_message_at: Date | string | null;
    last_message_at: Date | string | null;
}

export interface WhatsAppBusinessAnalyticsDirection {
    direction: WhatsAppBusinessMessageDirection;
    total: number;
}

export interface WhatsAppBusinessAnalyticsMessageType {
    message_type: string;
    total: number;
}

export interface WhatsAppBusinessAnalyticsSession {
    status: string | null;
    persisted_session: boolean;
    connected_number: string | null;
    connected_name: string | null;
    platform: string | null;
    last_event_at: Date | string | null;
    last_error: string | null;
    updated_at: Date | string | null;
}

export interface WhatsAppBusinessAnalyticsRecentMessage {
    public_id: string;
    direction: WhatsAppBusinessMessageDirection;
    contact_phone: string;
    contact_name: string | null;
    message_type: string | null;
    message_text: string;
    status: string | null;
    message_at: Date | string | null;
}

export interface WhatsAppBusinessAnalytics {
    scope: WhatsAppBusinessMessageScope;
    session: WhatsAppBusinessAnalyticsSession | null;
    summary: WhatsAppBusinessAnalyticsSummary;
    directions: WhatsAppBusinessAnalyticsDirection[];
    message_types: WhatsAppBusinessAnalyticsMessageType[];
    recent_conversations: WhatsAppBusinessConversation[];
    recent_messages: WhatsAppBusinessAnalyticsRecentMessage[];
}
