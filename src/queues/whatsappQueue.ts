import { WhatsappJobRepository } from '../repositories/whatsappJobRepository';

export const enqueueCompanySessionStart = async (companyId: number): Promise<{ id: number }> => {
    const id = await WhatsappJobRepository.enqueueJob('start-company-session', { companyId });
    return { id };
};

export const enqueueUserSessionStart = async (companyId: number, userId: number): Promise<{ id: number }> => {
    const id = await WhatsappJobRepository.enqueueJob('start-user-session', { companyId, userId });
    return { id };
};

export const enqueueCompanyDisconnect = async (companyId: number): Promise<{ id: number }> => {
    const id = await WhatsappJobRepository.enqueueJob('disconnect-company', { companyId });
    return { id };
};

export const enqueueUserDisconnect = async (companyId: number, userId: number): Promise<{ id: number }> => {
    const id = await WhatsappJobRepository.enqueueJob('disconnect-user', { companyId, userId });
    return { id };
};

export const enqueueCompanySendMessage = async (companyId: number, payload: any): Promise<{ id: number }> => {
    const id = await WhatsappJobRepository.enqueueJob('send-company-message', { companyId, payload });
    return { id };
};

export const enqueueUserSendMessage = async (companyId: number, userId: number, payload: any): Promise<{ id: number }> => {
    const id = await WhatsappJobRepository.enqueueJob('send-user-message', { companyId, userId, payload });
    return { id };
};
