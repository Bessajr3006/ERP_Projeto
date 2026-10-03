import { DentalRepository } from '../repositories/dentalRepository';
import {
    DentalChartInput,
    DentalChartUpdateInput,
    DentalPerformInput,
    DentalProcedureInput,
    DentalQuoteInput,
    DentalToothInput,
} from '../types/Dental';
import { CacheService } from './cacheService';

export class DentalService {
    static getChartByCustomer(companyId: number, customerPublicId: string) {
        return DentalRepository.getChartByCustomer(companyId, customerPublicId);
    }

    static getChart(companyId: number, chartPublicId: string) {
        return DentalRepository.getChart(companyId, chartPublicId);
    }

    static createChart(companyId: number, data: DentalChartInput) {
        return DentalRepository.createChart(companyId, data);
    }

    static updateChart(companyId: number, chartPublicId: string, data: DentalChartUpdateInput) {
        return DentalRepository.updateChart(companyId, chartPublicId, data);
    }

    static upsertTeeth(companyId: number, chartPublicId: string, teeth: DentalToothInput[]) {
        return DentalRepository.upsertTeeth(companyId, chartPublicId, teeth);
    }

    static async listProcedures(companyId: number, chartPublicId: string) {
        const chart = await DentalRepository.getChart(companyId, chartPublicId);
        return chart.procedures;
    }

    static createProcedure(companyId: number, userPublicId: string, chartPublicId: string, data: DentalProcedureInput) {
        return DentalRepository.createProcedure(companyId, userPublicId, chartPublicId, data);
    }

    static updateProcedure(companyId: number, procedurePublicId: string, data: DentalProcedureInput) {
        return DentalRepository.updateProcedure(companyId, procedurePublicId, data);
    }

    static deleteProcedure(companyId: number, procedurePublicId: string) {
        return DentalRepository.deleteProcedure(companyId, procedurePublicId);
    }

    static generateQuote(companyId: number, chartPublicId: string, data: DentalQuoteInput) {
        return DentalRepository.generateQuote(companyId, chartPublicId, data);
    }

    static async performProcedure(companyId: number, userPublicId: string, procedurePublicId: string, data: DentalPerformInput) {
        const result = await DentalRepository.performProcedure(companyId, userPublicId, procedurePublicId, data);
        if (result.order_completed) CacheService.invalidate(`dashboard_${companyId}`);
        return result;
    }
}
