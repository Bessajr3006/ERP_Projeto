export type TaskStatus = 'pending' | 'progress' | 'completed';

export interface TaskAttachment {
    type?: string;
    name?: string;
    data?: string;
}

export interface Task {
    id: string;
    public_id: string;
    company_id: number;
    title: string;
    dueDate: string | null;
    userId: string | null;
    status: TaskStatus;
    personType: string | null;
    personId: string | null;
    attachments: TaskAttachment[];
    createdAt: string;
    updatedAt: string | null;
    completedAt: string | null;
}

export interface TaskInput {
    title: string;
    dueDate?: string | null | undefined;
    userId?: string | null | undefined;
    status?: TaskStatus | undefined;
    personType?: string | null | undefined;
    personId?: string | null | undefined;
    attachments?: TaskAttachment[] | undefined;
    completedAt?: string | null | undefined;
}