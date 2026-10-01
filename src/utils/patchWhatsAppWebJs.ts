import fs from 'fs';
import path from 'path';
import logger from '../config/logger';

/**
 * Aplica correções críticas diretamente no código-fonte do whatsapp-web.js instalado em node_modules.
 * Isso resolve bugs conhecidos do WhatsApp Web, especificamente:
 * 1. "Data passed to getter must include an id property (it's how we memoize) but got undefined" ao enviar mídia.
 * 2. Sobrescrita de `newMsgKey` no objeto de mensagem ao espalhar MobX model ou atributos com `id: undefined`.
 * 3. Falhas ao chamar getters de contato em contatos do tipo LID sem identificador padrão.
 */
export function patchWhatsAppWebJs(): boolean {
    try {
        const utilsPath = path.join(
            process.cwd(),
            'node_modules',
            'whatsapp-web.js',
            'src',
            'util',
            'Injected',
            'Utils.js'
        );

        if (!fs.existsSync(utilsPath)) {
            return false;
        }

        let content = fs.readFileSync(utilsPath, 'utf8');
        let modified = false;

        // Patch 1: Correção do espalhamento de mediaOptions em sendMessage
        const targetMessagePattern = /\.\.\.mediaOptions,\s*\.\.\.\(mediaOptions\.toJSON\s*\?\s*mediaOptions\.toJSON\(\)\s*:\s*\{\}\),/g;
        if (targetMessagePattern.test(content)) {
            content = content.replace(
                targetMessagePattern,
                '...rawMedia,'
            );
            
            // Adiciona a extração e limpeza do rawMedia antes do objeto message se ainda não existir
            if (!content.includes('const rawMedia = mediaOptions')) {
                const searchStr = 'const message = {';
                const replacementStr = `const rawMedia = mediaOptions && typeof mediaOptions.toJSON === 'function' ? mediaOptions.toJSON() : (mediaOptions && typeof mediaOptions === 'object' ? { ...mediaOptions } : {});\n        delete rawMedia.id;\n\n        const message = {`;
                content = content.replace(searchStr, replacementStr);
            }

            // Garante que message.id sempre seja preservado
            if (!content.includes('message.id = newMsgKey;')) {
                content = content.replace(
                    'if (botOptions) {',
                    'message.id = newMsgKey;\n\n        if (botOptions) {'
                );
            }

            modified = true;
        }

        // Patch 2: Protege chamadas a getters de contato contra erro de memoize
        if (content.includes('const ContactMethods = window.require(\'WAWebContactGetters\');') && !content.includes('/* WAWebContactGetters guarded */')) {
            const gettersBlock = `        /* WAWebContactGetters guarded */
        try {
            const ContactMethods = window.require('WAWebContactGetters');
            res.isMe = ContactMethods.getIsMe(contact);
            res.isUser = ContactMethods.getIsUser(contact);
            res.isGroup = ContactMethods.getIsGroup(contact);
            res.isWAContact = ContactMethods.getIsWAContact(contact);
            res.userid = ContactMethods.getUserid(contact);
            res.verifiedName = ContactMethods.getVerifiedName(contact);
            res.verifiedLevel = ContactMethods.getVerifiedLevel(contact);
            res.statusMute = ContactMethods.getStatusMute(contact);
            res.name = ContactMethods.getName(contact);
            res.shortName = ContactMethods.getShortName(contact);
            res.pushname = ContactMethods.getPushname(contact);
            res.isEnterprise = ContactMethods.getIsEnterprise(contact);
        } catch (_cgErr) {
            // fallback silencioso para evitar memoize getter crash em contatos sem id completo
        }

        try {
            const { getIsMyContact } = window.require('WAWebFrontendContactGetters');
            res.isMyContact = getIsMyContact ? getIsMyContact(contact) : false;
        } catch (_fegErr) {
            res.isMyContact = false;
        }`;

            // Substitui o bloco original de getters
            const originalGettersRegex = /const ContactMethods = window\.require\('WAWebContactGetters'\);[\s\S]*?res\.isEnterprise = ContactMethods\.getIsEnterprise\(contact\);/m;
            if (originalGettersRegex.test(content)) {
                content = content.replace(originalGettersRegex, gettersBlock);
                modified = true;
            }
        }

        // Patch 3: Protege sendSeen contra falhas silenciosas
        if (content.includes('window.WWebJS.sendSeen = async (chatId) => {') && !content.includes('/* sendSeen guarded */')) {
            const sendSeenBlock = `    window.WWebJS.sendSeen = async (chatId) => {
        /* sendSeen guarded */
        try {
            const chat = await window.WWebJS.getChat(chatId, { getAsModel: false });
            if (chat) {
                window.require('WAWebStreamModel').Stream.markAvailable();
                await window.require('WAWebUpdateUnreadChatAction').sendSeen({
                    chat: chat,
                    threadId: undefined,
                });
                window.require('WAWebStreamModel').Stream.markUnavailable();
                return true;
            }
        } catch (_seenErr) {
            // ignore sendSeen errors
        }
        return false;
    };`;
            const originalSendSeenRegex = /window\.WWebJS\.sendSeen = async \(chatId\) => \{[\s\S]*?return false;\s*\};/m;
            if (originalSendSeenRegex.test(content)) {
                content = content.replace(originalSendSeenRegex, sendSeenBlock);
                modified = true;
            }
        }

        if (modified) {
            fs.writeFileSync(utilsPath, content, 'utf8');
            logger.info('[patchWhatsAppWebJs] Patch aplicado com sucesso em whatsapp-web.js (Utils.js)');
            return true;
        }

        return false;
    } catch (err: unknown) {
        logger.warn({ err }, '[patchWhatsAppWebJs] Falha ao aplicar patch em whatsapp-web.js');
        return false;
    }
}
