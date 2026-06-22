import 'dotenv/config';
import { WhatsAppBusinessService } from '../services/whatsappBusinessService';

async function main() {
    try {
        console.log('Sending plain text message via company 2...');
        const result = await WhatsAppBusinessService.sendTextMessage(2, '5521996895570', 'Olá! Este é um teste de texto puro (sem anexo) enviado via API.');
        console.log('Result:', JSON.stringify(result, null, 2));
    } catch (error) {
        console.error('Error sending message:', error);
    } finally {
        // give it a second to process events
        await new Promise((resolve) => setTimeout(resolve, 5000));
        process.exit(0);
    }
}

main();
