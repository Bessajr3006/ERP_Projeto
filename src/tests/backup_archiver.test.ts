import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { ZipArchive } from 'archiver';
import { PassThrough } from 'node:stream';
import unzipper from 'unzipper';

describe('Archiver v8 and Backup Zip Generation', () => {
    test('ZipArchive generates a valid zip with files and content', async () => {
        const archive = new ZipArchive({
            zlib: { level: 9 }
        });

        const passThrough = new PassThrough();
        const chunks: Buffer[] = [];

        passThrough.on('data', (chunk) => {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });

        const streamPromise = new Promise<Buffer>((resolve, reject) => {
            passThrough.on('end', () => resolve(Buffer.concat(chunks)));
            passThrough.on('error', reject);
            archive.on('error', reject);
        });

        archive.pipe(passThrough);

        // Append two small files
        archive.append('"id","name","price"\n1,"Produto Teste",19.99\n', { name: 'products.csv' });
        archive.append('"id","razao_social"\n10,"Empresa Teste LTDA"\n', { name: 'companies.csv' });

        await archive.finalize();
        const zipBuffer = await streamPromise;

        assert.ok(zipBuffer.length > 0, 'O buffer do arquivo ZIP gerado deve ser maior que 0 bytes');

        // Verify ZIP header magic bytes (PK\x03\x04 or 0x50 0x4b 0x03 0x04)
        assert.equal(zipBuffer[0], 0x50);
        assert.equal(zipBuffer[1], 0x4b);

        // Unpack and verify contents using unzipper
        const directory = await unzipper.Open.buffer(zipBuffer);
        const fileNames = directory.files.map(f => f.path);

        assert.ok(fileNames.includes('products.csv'), 'ZIP deve conter products.csv');
        assert.ok(fileNames.includes('companies.csv'), 'ZIP deve conter companies.csv');

        const productsEntry = directory.files.find(f => f.path === 'products.csv');
        assert.ok(productsEntry, 'productsEntry deve existir');
        const content = (await productsEntry.buffer()).toString('utf8');
        assert.ok(content.includes('Produto Teste'), 'products.csv deve conter o texto inserido');
    });
});
