/**
 * footer.js
 * Injeta o rodape compartilhado nas paginas que possuem <div id="app-footer"></div>.
 */


window.GridSummaryFooter = {
    update({ footerId, anchorId, count = 0, label = 'registro(s) exibido(s)' }) {
        const anchor = document.getElementById(anchorId);
        if (!anchor) return;

        let footer = document.getElementById(footerId);
        if (!footer) {
            footer = document.createElement('div');
            footer.id = footerId;
            footer.className = 'shrink-0 bg-white dark:bg-slate-800 border border-t-0 border-gray-200 dark:border-slate-700 px-5 py-3 rounded-b-xl shadow-sm flex items-center justify-between gap-4';
            footer.setAttribute('role', 'status');
            footer.setAttribute('aria-live', 'polite');
            footer.innerHTML = `
                <span class="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                    <svg class="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h8m-8 6h16"/>
                    </svg>
                    <span data-grid-footer-count class="font-semibold text-gray-700 dark:text-gray-200">0</span>
                    <span data-grid-footer-label>${label}</span>
                </span>
            `;
            anchor.insertAdjacentElement('afterend', footer);
        }

        const countEl = footer.querySelector('[data-grid-footer-count]');
        const labelEl = footer.querySelector('[data-grid-footer-label]');
        if (!countEl || !labelEl) return;

        countEl.textContent = Number(count || 0).toLocaleString('pt-BR');
        labelEl.textContent = label;
    },
};

const sharedFooterState = {
    companyText: localStorage.getItem('erp_last_company_name') || '',
    companyCnpj: localStorage.getItem('erp_last_company_cnpj') || '',
};

// Se recuperou do cache, formata o texto inicial
if (sharedFooterState.companyText) {
    const name = sharedFooterState.companyText;
    const cnpj = sharedFooterState.companyCnpj;
    sharedFooterState.companyText = formatFooterCompanyText({ name, cnpj });
}

function formatFooterCnpj(value) {
    const digits = String(value || '').replace(/\D/g, '');
    if (digits.length !== 14) {
        return String(value || '').trim();
    }

    return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

function formatFooterCompanyText({ text = '', name = '', meta = '', cnpj = '' } = {}) {
    const normalizedText = String(text || '').trim();
    if (normalizedText) return normalizedText;

    const normalizedName = String(name || '').trim();
    const normalizedMeta = String(meta || '').trim();
    const normalizedCnpj = formatFooterCnpj(cnpj);

    if (normalizedName && normalizedCnpj) {
        return `${normalizedName} - CNPJ: ${normalizedCnpj}`;
    }

    if (normalizedName) {
        return normalizedName;
    }

    return normalizedName || normalizedMeta || normalizedCnpj;
}

function applySharedFooterState() {
    const footerContainer = document.getElementById('app-footer');
    if (!footerContainer) return;

    const companyInfo = footerContainer.querySelector('#footerCompanyInfo');
    if (!companyInfo) return;

    const hasCompanyContext = Boolean(sharedFooterState.companyText);
    companyInfo.classList.toggle('hidden', !hasCompanyContext);
    
    // Se for um contexto de empresa, podemos adicionar um ícone ou label para indicar "Empresa Atual"
    companyInfo.innerHTML = `
        <span class="inline-flex items-center gap-1.5 py-0.5 px-2 rounded bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700">
            <svg class="w-3 h-3 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-10V4m-5 4V4m1 8h1m4 4h1m-5 4h1" />
            </svg>
            ${sharedFooterState.companyText}
        </span>
    `;
}

window.SharedFooter = {
    setCompanyContext(context = {}) {
        sharedFooterState.companyText = formatFooterCompanyText(context);
        applySharedFooterState();
    },
    clearCompanyContext() {
        sharedFooterState.companyText = '';
        applySharedFooterState();
    },
};

document.addEventListener('DOMContentLoaded', () => {
    const footerContainer = document.getElementById('app-footer');
    if (!footerContainer) return;

    footerContainer.innerHTML = `
<footer class="border-t border-gray-200 bg-white/90 dark:border-slate-700 dark:bg-slate-900/90 backdrop-blur-sm">
    <div class="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-4 py-2 text-[11px] sm:flex sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-3 sm:text-xs lg:px-8">
        <div class="flex min-w-0 items-center justify-start gap-2 font-semibold uppercase tracking-[0.22em] text-gray-700 dark:text-gray-200">
            <span class="h-2 w-2 rounded-full bg-brand-500"></span>
            <span>KEYSTONE ERP</span>
        </div>
        <p id="footerCompanyInfo" class="hidden col-span-2 min-w-0 text-center text-[10px] sm:text-[11px] font-medium leading-tight text-gray-500 dark:text-gray-400 sm:flex-1 sm:px-4 sm:flex sm:justify-center"></p>
        <div class="flex items-center justify-end gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
            <p class="text-right text-[11px] text-gray-600 dark:text-gray-400 sm:text-xs">&copy; <span data-footer-year></span></p>
        </div>
    </div>
</footer>`;

    const yearElement = footerContainer.querySelector('[data-footer-year]');
    if (yearElement) {
        yearElement.textContent = String(new Date().getFullYear());
    }


    // Em páginas com layout de app (navbar fixo + h-dvh flex-col),
    // o #app-navbar div tem altura 0 no flex (a <nav> usa position:fixed).
    // Isso faz o <main flex-1> preencher 100dvh inteiros, empurrando o footer
    // para além do viewport. Fix: adicionar um espaçador de 64px (h-16) ao
    // #app-navbar div para o flex math funcionar corretamente:
    //   100dvh = 64px (spacer) + main (flex-1) + footer (shrink-0)
    const navbarDiv = document.getElementById('app-navbar');
    if (navbarDiv !== null) {
        navbarDiv.style.height = '64px';
        navbarDiv.style.flexShrink = '0';
    }

    applySharedFooterState();
    injectWhatsAppButton();
});

function injectWhatsAppButton(): void {
    if (window.location.pathname.includes('/pages/whatsapp.html')) return;

    if (document.getElementById('waFloatingBtn')) return;

    const style = document.createElement('style');
    style.innerHTML = `
        @keyframes wa-pulse {
            0% {
                box-shadow: 0 0 0 0 rgba(37, 211, 102, 0.6);
            }
            70% {
                box-shadow: 0 0 0 15px rgba(37, 211, 102, 0);
            }
            100% {
                box-shadow: 0 0 0 0 rgba(37, 211, 102, 0);
            }
        }
        .wa-float-btn {
            animation: wa-pulse 2.2s infinite;
        }
    `;
    document.head.appendChild(style);

    const btn = document.createElement('a');
    btn.id = 'waFloatingBtn';
    btn.href = '#';
    btn.title = 'Abrir WhatsApp';
    btn.className = 'fixed bottom-6 right-6 z-[9999] flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-tr from-emerald-600 to-green-500 text-white transition-all duration-300 hover:scale-110 hover:-translate-y-1 active:scale-95 shadow-lg shadow-emerald-500/20 wa-float-btn group';
    btn.innerHTML = `
        <svg class="h-7 w-7 transition-transform group-hover:rotate-12 duration-300" fill="currentColor" viewBox="0 0 24 24">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
    `;
    btn.addEventListener('click', (e: MouseEvent) => {
        e.preventDefault();
        openWaSidebar();
    });
    document.body.appendChild(btn);
}

function openWaSidebar(): void {
    injectWhatsAppSidebar();
    const panel = document.getElementById('waSidebarPanel');
    const backdrop = document.getElementById('waSidebarBackdrop');
    if (panel && backdrop) {
        panel.classList.remove('translate-x-full');
        panel.classList.add('translate-x-0');
        backdrop.classList.remove('opacity-0', 'pointer-events-none');
        backdrop.classList.add('opacity-100', 'pointer-events-auto');
    }
}

function closeWaSidebar(): void {
    const panel = document.getElementById('waSidebarPanel');
    const backdrop = document.getElementById('waSidebarBackdrop');
    if (panel && backdrop) {
        panel.classList.remove('translate-x-0');
        panel.classList.add('translate-x-full');
        backdrop.classList.remove('opacity-100', 'pointer-events-auto');
        backdrop.classList.add('opacity-0', 'pointer-events-none');
    }
}

function injectWhatsAppSidebar(): void {
    if (window.location.pathname.includes('/pages/whatsapp.html')) return;
    if (document.getElementById('waSidebarPanel')) return;

    // style
    const style = document.createElement('style');
    style.innerHTML = `
        #waSidebarPanel .wa-sidebar {
            width: 100% !important;
            border-right: none !important;
        }
        #waSidebarPanel .wa-sidebar.hidden-mobile {
            display: none !important;
        }
        #waSidebarPanel #waChatPanel.hidden-mobile {
            display: none !important;
        }
        #waSidebarPanel .wa-messages-area {
            display: flex;
            flex-direction: column;
            gap: 0.75rem;
            padding: 1rem;
            overflow-y: auto;
            flex: 1;
            min-height: 0;
            background: #f8fafc;
        }
        .dark #waSidebarPanel .wa-messages-area {
            background: #0f172a;
        }
    `;
    document.head.appendChild(style);

    // Backdrop
    const backdrop = document.createElement('div');
    backdrop.id = 'waSidebarBackdrop';
    backdrop.className = 'fixed inset-0 z-[9998] bg-black/50 backdrop-blur-sm opacity-0 pointer-events-none transition-opacity duration-300';
    document.body.appendChild(backdrop);
    backdrop.addEventListener('click', closeWaSidebar);

    // Sidebar
    const panel = document.createElement('div');
    panel.id = 'waSidebarPanel';
    panel.className = 'fixed inset-y-0 right-0 z-[10000] w-full sm:w-[460px] bg-white dark:bg-slate-900 border-l border-gray-200 dark:border-slate-800 shadow-2xl flex flex-col transform translate-x-full transition-transform duration-300 ease-in-out';
    panel.innerHTML = `
        <div class="px-4 py-3 flex items-center justify-between border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800 shrink-0">
            <div class="flex items-center gap-2">
                <svg class="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                <h3 class="text-xs font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider">WhatsApp</h3>
            </div>
            <div class="flex items-center gap-1.5">
                <button type="button" id="waConnectBtn" class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors">Conectar</button>
                <button type="button" id="waDisconnectBtn" class="hidden items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-600 hover:bg-slate-700 text-white transition-colors">Desconectar</button>
                <span id="waStatusBadge" class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300">Verificando...</span>
                <button type="button" id="waSidebarCloseBtn" class="p-1 rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-slate-800 focus:outline-none ml-1" title="Fechar">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
            </div>
        </div>
        <div id="alertMessage" class="hidden mx-4 my-2 rounded-lg px-3 py-1.5 text-xs"></div>
        <div class="flex flex-1 min-h-0 overflow-hidden relative">
             <div class="wa-sidebar w-full h-full flex flex-col" id="waSidebar">
                 <div class="px-3 py-2 border-b border-gray-100 dark:border-slate-800 flex items-center gap-2">
                     <input type="text" id="waSearchInput" placeholder="Buscar conversa..."
                         class="w-full text-xs rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-gray-100 px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-500">
                     <button type="button" id="waLoadCustomersBtn" class="p-1.5 rounded bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-700 shrink-0" title="Sincronizar Clientes">
                         <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H18.5"/></svg>
                     </button>
                 </div>
                 <div id="waConvList" class="flex-1 overflow-y-auto">
                     <div class="flex items-center justify-center py-10 text-xs text-gray-400 dark:text-gray-500">Carregando conversas...</div>
                 </div>
             </div>

             <div class="flex flex-col w-full h-full bg-gray-50 dark:bg-slate-900 absolute inset-0 z-10 hidden-mobile" id="waChatPanel">
                 <div id="waChatEmpty" class="flex flex-col flex-1 items-center justify-center gap-2 text-gray-400 dark:text-gray-500 p-4 text-center">
                     <svg class="w-10 h-10 opacity-30" fill="currentColor" viewBox="0 0 24 24">
                         <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                     </svg>
                     <p class="text-xs">Selecione uma conversa</p>
                 </div>

                 <div id="waChatActive" class="hidden flex-col flex-1 min-h-0">
                     <div class="flex items-center gap-2 px-3 py-2 border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 shrink-0">
                         <button type="button" id="waBtnBack" aria-label="Voltar para conversas" class="text-gray-500 dark:text-gray-400 p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded">
                             <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
                         </button>
                         <div class="wa-avatar w-8 h-8 text-xs flex items-center justify-center rounded-full bg-brand-500 text-white font-bold" id="waChatAvatar">?</div>
                         <div class="flex-1 min-w-0">
                             <p class="font-semibold text-gray-900 dark:text-gray-100 text-xs truncate" id="waChatName">—</p>
                             <p class="text-[10px] text-gray-400 dark:text-gray-500 truncate" id="waChatPhone">—</p>
                         </div>
                         <button type="button" id="waDeleteContactBtn"
                             class="inline-flex items-center px-2 py-1 rounded text-[10px] font-medium bg-red-600 text-white hover:bg-red-700 transition-colors"
                             title="Excluir contato e mensagens">
                             Excluir
                         </button>
                     </div>
                     <div class="wa-messages-area" id="waMessagesArea"></div>
                     <div class="wa-input-area px-3 py-2 border-t border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-end gap-2 shrink-0">
                         <div class="wa-input-tools mb-1">
                             <input type="file" id="waAttachmentInput" class="hidden" accept="image/*,application/pdf" title="Selecionar imagem ou PDF" aria-label="Selecionar imagem ou PDF">
                             <button type="button" id="waAttachmentBtn" class="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" title="Anexar imagem ou PDF" aria-label="Anexar imagem ou PDF">
                                 <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                     <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.586-6.586a4 4 0 10-5.657-5.657L5.757 10.757a6 6 0 108.486 8.486L20 13"/>
                                 </svg>
                             </button>
                         </div>
                         <div class="flex-1 min-w-0">
                             <div id="waAttachmentInfo" class="wa-attachment-meta hidden text-[10px] bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded items-center justify-between mb-1" aria-live="polite">
                                 <span id="waAttachmentName" class="truncate max-w-[150px]"></span>
                                 <button type="button" id="waAttachmentClearBtn" class="text-emerald-700 font-bold hover:text-emerald-950">&times;</button>
                             </div>
                             <textarea id="waMessageInput" rows="1" placeholder="Digite uma mensagem..."
                                 class="w-full resize-none rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500 max-h-20 overflow-y-auto"></textarea>
                         </div>
                         <button type="button" id="waSendBtn" title="Enviar"
                             class="shrink-0 w-8 h-8 rounded-full bg-green-500 hover:bg-green-600 text-white flex items-center justify-center transition-colors mb-0.5 animate-none">
                             <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                 <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
                             </svg>
                         </button>
                     </div>
                 </div>
             </div>
        </div>
    `;
    document.body.appendChild(panel);

    const closeBtn = document.getElementById('waSidebarCloseBtn');
    closeBtn?.addEventListener('click', closeWaSidebar);

    // Load whatsapp.js dynamically
    const script = document.createElement('script');
    script.src = '/js/whatsapp.js';
    document.body.appendChild(script);
}
