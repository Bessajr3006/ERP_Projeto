export interface OrganizerState {
    lastBoardId?: string | null | undefined;
    boards: unknown[];
    [key: string]: unknown;
}

export interface OrganizerStateRecord {
    company_id: number;
    state: OrganizerState;
    created_at: Date | string;
    updated_at: Date | string;
}