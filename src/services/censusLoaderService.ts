import pool from '../config/db';
import logger from '../config/logger';

export interface CensusSyncStatus {
    status: 'idle' | 'running' | 'success' | 'error';
    totalRecords: number;
    progressPercent: number;
    errorMessage?: string | undefined;
}

export class CensusLoaderService {
    private static syncState: CensusSyncStatus = {
        status: 'idle',
        totalRecords: 0,
        progressPercent: 0
    };

    private static isSyncing = false;

    public static getStatus(): CensusSyncStatus {
        return { ...this.syncState };
    }

    public static async triggerLoad(force = false): Promise<void> {
        if (this.isSyncing) return;

        try {
            // Check if there is data already
            const [rows] = await pool.query<any[]>(`SELECT COUNT(*) as count FROM ibge_census_income`);
            const count = rows[0]?.count || 0;
            
            this.syncState.totalRecords = count;

            if (count > 0 && !force) {
                this.syncState.status = 'success';
                this.syncState.progressPercent = 100;
                return;
            }

            // Start background sync
            this.isSyncing = true;
            this.syncState.status = 'running';
            this.syncState.progressPercent = 0;
            this.syncState.errorMessage = undefined;

            // Trigger asynchronously so it does not block the HTTP request/server startup
            this.runBackgroundSync().catch((err) => {
                logger.error({ err }, 'Background IBGE Census sync failed');
            });

        } catch (error: any) {
            this.syncState.status = 'error';
            this.syncState.errorMessage = error?.message || 'Erro ao inicializar sincronização.';
            logger.error({ err: error }, 'Failed to trigger Census sync');
        }
    }

    private static async runBackgroundSync(): Promise<void> {
        try {
            logger.info('Starting background sync of IBGE Census 2022 data for all municipalities...');
            
            const url = "https://servicodados.ibge.gov.br/api/v3/agregados/10295/periodos/2022/variaveis/13431?localidades=N6[all]&classificacao=2[6794]|86[95251]|58[95253]";
            
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`IBGE SIDRA API returned status ${response.status}`);
            }

            const data: any = await response.json();
            if (!Array.isArray(data) || !data[0]?.resultados?.[0]?.series) {
                throw new Error('Unexpected format returned by IBGE API.');
            }

            const items = data[0].resultados[0].series;
            logger.info(`IBGE returned ${items.length} records. Processing & inserting into database...`);

            this.syncState.progressPercent = 10;

            const batchSize = 250;
            let currentBatch: Array<[string, string, string, number]> = [];
            let processed = 0;

            // Clear table first if forced
            await pool.query(`DELETE FROM ibge_census_income`);

            for (const item of items) {
                const rawName = String(item?.localidade?.nome || '').trim();
                const municipality_id = String(item?.localidade?.id || '').trim();
                const valStr = String(item?.serie?.['2022'] || '0').replace(',', '.');
                const value = parseFloat(valStr);

                if (rawName && municipality_id && !Number.isNaN(value)) {
                    // Extract name and State UF from "City Name - UF" or "Hyphenated-City-Name - UF"
                    const parts = rawName.split(/\s*-\s*/);
                    let name = rawName;
                    let state_uf = 'BR';

                    if (parts.length > 1) {
                        const lastPart = parts[parts.length - 1] || '';
                        if (lastPart.length === 2) {
                            state_uf = lastPart.toUpperCase();
                            name = parts.slice(0, parts.length - 1).join('-');
                        } else {
                            name = parts.join('-');
                        }
                    }

                    currentBatch.push([municipality_id, name, state_uf, value]);
                }

                if (currentBatch.length >= batchSize) {
                    await this.saveBatch(currentBatch);
                    processed += currentBatch.length;
                    currentBatch = [];
                    this.syncState.totalRecords = processed;
                    this.syncState.progressPercent = Math.min(95, Math.round((processed / items.length) * 100));
                }
            }

            // Save remaining
            if (currentBatch.length > 0) {
                await this.saveBatch(currentBatch);
                processed += currentBatch.length;
                this.syncState.totalRecords = processed;
            }

            this.syncState.status = 'success';
            this.syncState.progressPercent = 100;
            this.isSyncing = false;
            logger.info(`IBGE Census data sync completed successfully. Total records: ${processed}`);

        } catch (error: any) {
            this.isSyncing = false;
            this.syncState.status = 'error';
            this.syncState.errorMessage = error?.message || 'Erro durante a sincronização em segundo plano.';
            logger.error({ err: error }, 'Error in background census sync');
        }
    }

    private static async saveBatch(batch: Array<[string, string, string, number]>): Promise<void> {
        await pool.query(
            `INSERT INTO ibge_census_income (municipality_id, name, state_uf, income_per_capita)
             VALUES ?
             ON DUPLICATE KEY UPDATE
                name = VALUES(name),
                state_uf = VALUES(state_uf),
                income_per_capita = VALUES(income_per_capita)`,
            [batch]
        );
    }
}
