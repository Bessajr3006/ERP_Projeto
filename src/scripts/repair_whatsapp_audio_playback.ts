import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import ffmpegPath from 'ffmpeg-static';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import { RowDataPacket } from 'mysql2/promise';

dotenv.config();

const execFileAsync = promisify(execFile);

type AudioRow = RowDataPacket & {
    id: number;
    media_mime_type: string | null;
    media_file_name: string | null;
    media_base64: string | null;
};

function buildOutputFileName(fileName: string | null | undefined): string {
    const normalized = String(fileName || '').trim();
    if (!normalized) {
        return 'audio.mp3';
    }

    const extension = path.extname(normalized);
    if (!extension) {
        return `${normalized}.mp3`;
    }

    return `${normalized.slice(0, -extension.length)}.mp3`;
}

async function transcodeToMp3(base64: string, fileName: string | null | undefined): Promise<{ fileName: string; base64: string; }> {
    if (!ffmpegPath) {
        throw new Error('ffmpeg-static nao encontrado.');
    }

    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'wa-audio-repair-'));
    const inputPath = path.join(tempDir, String(fileName || '').trim() || 'audio-input.ogg');
    const outputFileName = buildOutputFileName(fileName);
    const outputPath = path.join(tempDir, outputFileName);

    try {
        await fs.promises.writeFile(inputPath, Buffer.from(base64, 'base64'));
        await execFileAsync(ffmpegPath, [
            '-hide_banner',
            '-loglevel',
            'error',
            '-y',
            '-i',
            inputPath,
            '-vn',
            '-codec:a',
            'libmp3lame',
            '-b:a',
            '96k',
            outputPath,
        ]);

        const outputBuffer = await fs.promises.readFile(outputPath);
        return {
            fileName: outputFileName,
            base64: outputBuffer.toString('base64'),
        };
    } finally {
        await fs.promises.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
    }
}

async function main() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'bessa_erp',
        port: Number(process.env.DB_PORT || 3306),
    });

    try {
        const [rows] = await connection.query<AudioRow[]>(
            `SELECT id, media_mime_type, media_file_name, media_base64
             FROM whatsapp_business_messages
             WHERE message_type IN ('audio', 'ptt')
               AND media_base64 IS NOT NULL
               AND media_base64 <> ''
               AND (media_mime_type IS NULL OR media_mime_type <> 'audio/mpeg')
             ORDER BY id ASC`
        );

        let repaired = 0;
        let skipped = 0;

        for (const row of rows) {
            try {
                const transcoded = await transcodeToMp3(String(row.media_base64 || '').trim(), row.media_file_name);
                await connection.query(
                    `UPDATE whatsapp_business_messages
                     SET media_mime_type = ?, media_file_name = ?, media_base64 = ?, updated_at = CURRENT_TIMESTAMP
                     WHERE id = ?`,
                    ['audio/mpeg', transcoded.fileName, transcoded.base64, row.id]
                );
                repaired += 1;
            } catch (error) {
                skipped += 1;
                console.warn(`[repair_whatsapp_audio_playback] Falha ao converter mensagem ${row.id}:`, error instanceof Error ? error.message : error);
            }
        }

        console.log(JSON.stringify({
            scanned: rows.length,
            repaired,
            skipped,
        }));
    } finally {
        await connection.end();
    }
}

main().catch((error) => {
    console.error('[repair_whatsapp_audio_playback] Erro fatal:', error);
    process.exit(1);
});
