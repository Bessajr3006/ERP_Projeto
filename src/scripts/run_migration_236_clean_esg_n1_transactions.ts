import 'dotenv/config';

export async function runMigration236CleanEsgN1Transactions(): Promise<void> {
    // Migration 236: previously used for one-off cleanup
    console.log('[MIGRATION 236] Migration 236 already completed.');
}

if (require.main === module) {
    runMigration236CleanEsgN1Transactions()
        .then(() => {
            console.log('Migration 236 finished successfully.');
            process.exit(0);
        })
        .catch((err) => {
            console.error('Migration 236 failed:', err);
            process.exit(1);
        });
}
