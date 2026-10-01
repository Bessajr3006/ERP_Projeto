import logger from '../config/logger';
import { FinanceService } from '../services/financeService';

export async function runMigration230SyncAllSolidconInterestRevenues() {
    try {
        logger.info('Starting migration: 230 - Sync all existing Solidcon interest revenues');
        const res = await FinanceService.sincronizarTodosLancamentosJurosSolidcon();
        logger.info({ res }, 'Migration 230: Successfully synced all Solidcon interest revenues.');
    } catch (err) {
        logger.error({ err }, 'Error running migration 230');
    }
}
