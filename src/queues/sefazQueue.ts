
import { SefazJobRepository } from '../repositories/sefazJobRepository';

export const enqueueSefazConsult = async (companyId: number, lastNSU: string): Promise<number> => {
    return await SefazJobRepository.enqueueJob(companyId, 'consult-destined', { lastNSU });
};

export const enqueueSefazManifest = async (companyId: number, payload: { chNFe: string, tpEvento: string, xJust?: string }): Promise<number> => {
    return await SefazJobRepository.enqueueJob(companyId, 'manifest', payload);
};

export const getPendingSefazJobs = async (companyId: number): Promise<number> => {
    return await SefazJobRepository.getPendingJobsCountByCompany(companyId);
};
