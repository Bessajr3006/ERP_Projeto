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
});
