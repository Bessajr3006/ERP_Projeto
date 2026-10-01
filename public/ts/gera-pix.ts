(() => {
    /**
     * gera-pix.ts
     * Gerencia a tela de geração de cobranças PIX do ERP
     */

    type PixCharge = {
        public_id: string;
        description: string;
        amount: number;
        status: string;
        date: string;
        received_at: string | null;
        pix_code: string;
        user_name: string;
    };

    let g_charges: PixCharge[] = [];
    let g_activeQrTxid: string | null = null;
    const api = (window as any).api;

    const getEl = <T extends HTMLElement = HTMLElement>(id: string): T | null =>
        document.getElementById(id) as T | null;

    document.addEventListener('DOMContentLoaded', () => {
        void init();

        // Modal triggers
        getEl('btnOpenModal')?.addEventListener('click', () => openCreateModal());
        getEl('btnCancelModal')?.addEventListener('click', closeCreateModal);
        getEl('modalBackdrop')?.addEventListener('click', closeCreateModal);

        getEl('btnCloseQrModal')?.addEventListener('click', closeQrModal);
        getEl('qrModalBackdrop')?.addEventListener('click', closeQrModal);

        getEl<HTMLFormElement>('createPixForm')?.addEventListener('submit', handleSavePix);
        getEl('btnCopyPix')?.addEventListener('click', handleCopyPix);

        // PDF Modal triggers
        const closePdfModal = () => {
            const modal = getEl('pdfModal');
            if (modal) modal.classList.add('hidden');
            const pdfIframe = getEl<HTMLIFrameElement>('pdfIframe');
            if (pdfIframe) pdfIframe.src = '';
        };

        getEl('closePdfModalBackdrop')?.addEventListener('click', closePdfModal);
        getEl('closePdfModalCross')?.addEventListener('click', closePdfModal);
        getEl('closePdfModalBtn')?.addEventListener('click', closePdfModal);
        getEl('printPdfBtn')?.addEventListener('click', () => {
            const pdfIframe = getEl<HTMLIFrameElement>('pdfIframe');
            if (pdfIframe?.contentWindow) {
                pdfIframe.contentWindow.print();
            }
        });

        const pixAmountEl = getEl('pixAmount') as HTMLInputElement | null;
        if (pixAmountEl) {
            pixAmountEl.addEventListener('input', (e) => {
                const target = e.target as HTMLInputElement | null;
                if (!target) return;

                let value = target.value.replace(/\D/g, '');
                if (value === '') value = '0';
                let formatted = (parseInt(value, 10) / 100).toFixed(2) + '';
                formatted = formatted.replace('.', ',');
                formatted = formatted.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
                target.value = 'R$ ' + formatted;
            });
        }

        // Event delegation for table action buttons
        getEl('pixChargesTable')?.addEventListener('click', (e) => {
            const target = e.target as HTMLElement | null;
            const btn = target?.closest('button[data-action]') as HTMLButtonElement | null;
            if (!btn) return;

            const action = btn.getAttribute('data-action');
            const id = btn.getAttribute('data-id');

            if (action === 'view-qr' && id) {
                const charge = g_charges.find(c => c.public_id === id);
                if (charge) {
                    openQrModal(charge.pix_code, id);
                }
            } else if (action === 'copy-txid' && id) {
                navigator.clipboard.writeText(id).then(() => {
                    const orig = btn.innerHTML;
                    btn.innerHTML = `<svg class="w-3.5 h-3.5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>`;
                    setTimeout(() => {
                        btn.innerHTML = orig;
                    }, 1000);
                });
            } else if (action === 'view-receipt' && id) {
                let url = '/api/v1/finance/revenues/' + id + '/receipt';
                const jwtToken = (window as any).Auth?.getToken?.() || localStorage.getItem('erp_token') || sessionStorage.getItem('erp_token') || '';
                if (jwtToken) {
                    url += '?token=' + encodeURIComponent(jwtToken);
                }
                const pdfIframe = getEl<HTMLIFrameElement>('pdfIframe');
                if (pdfIframe) pdfIframe.src = url;
                getEl('pdfModal')?.classList.remove('hidden');
            } else if (action === 'delete-charge' && id) {
                const confirmed = confirm('Tem certeza que deseja excluir esta cobrança PIX pendente?');
                if (!confirmed) return;

                // Disable button during delete to prevent double clicks
                btn.disabled = true;
                const origContent = btn.innerHTML;
                btn.innerHTML = 'Excluindo...';

                (api as any)('/finance/transactions/' + id, { method: 'DELETE' })
                    .then(() => {
                        showAlert('Cobrança PIX excluída com sucesso!', 'success');
                        void fetchCharges();
                    })
                    .catch((err: any) => {
                        console.error('Erro ao excluir cobrança:', err);
                        showAlert(err.message || 'Erro ao excluir cobrança.', 'error');
                        btn.disabled = false;
                        btn.innerHTML = origContent;
                    });
            }
        });
    });

    let pollInterval: any = null;

    async function init(): Promise<void> {
        setupFilters();
        await fetchCharges();

        if (pollInterval) clearInterval(pollInterval);
        pollInterval = setInterval(async () => {
            const hasPending = g_charges.some(c => c.status === 'progress');
            if (hasPending) {
                await fetchCharges();
            }
        }, 5000);
    }

    // --- API Calls ---

    async function fetchCharges(): Promise<void> {
        try {
            const pixChargesTable = getEl('pixChargesTable');
            if (pixChargesTable && g_charges.length === 0) {
                pixChargesTable.innerHTML = `
                    <tr>
                        <td colspan="8" class="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                            Carregando...
                        </td>
                    </tr>
                `;
            }

            const res = await (api as any)('/finance/pix-charges');
            g_charges = res.data || [];
            populateUserFilter();
            renderCharges();

            // Fechar o modal do QR Code automaticamente se o pagamento foi confirmado
            if (g_activeQrTxid) {
                const activeCharge = g_charges.find(c => c.public_id === g_activeQrTxid);
                if (activeCharge && activeCharge.status === 'paid') {
                    closeQrModal();
                    window.dispatchEvent(new CustomEvent('add-notification', {
                        detail: {
                            title: 'Pagamento Recebido! 💰',
                            message: `O PIX de ${formatCurrency(activeCharge.amount)} foi recebido com sucesso!`,
                            type: 'success'
                        }
                    }));
                }
            }
        } catch (err: any) {
            console.error('Erro ao buscar cobranças PIX:', err);
            showAlert('Erro ao buscar cobranças PIX: ' + (err.message || err), 'error');
        }
    }

    async function handleSavePix(e: Event): Promise<void> {
        e.preventDefault();
        const form = e.target as HTMLFormElement;
        const amountEl = getEl<HTMLInputElement>('pixAmount');
        const descEl = getEl<HTMLInputElement>('pixDescription');

        if (!amountEl || !descEl) return;

        const amount = parseFloat(amountEl.value.replace(/[^\d]/g, '')) / 100;
        const description = descEl.value.trim();

        if (isNaN(amount) || amount <= 0) {
            showAlert('Por favor, informe um valor válido maior que zero.', 'error');
            return;
        }

        if (!description) {
            showAlert('Por favor, informe uma descrição.', 'error');
            return;
        }

        const saveBtn = getEl<HTMLButtonElement>('saveBtn');
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.textContent = 'Gerando...';
        }

        try {
            const res = await (api as any)('/finance/pix-charges', {
                method: 'POST',
                body: JSON.stringify({ amount, description })
            });

            closeCreateModal();
            form.reset();

            if (res.data) {
                // Abre o segundo modal com o QR Code imediatamente!
                openQrModal(res.data.pixCopiaECola, res.data.txid, res.data.qrCodeBase64);
            }

            await fetchCharges();
            showAlert('Cobrança PIX gerada com sucesso!', 'success');
        } catch (err: any) {
            console.error('Erro ao gerar cobrança PIX:', err);
            showAlert(err.message || 'Erro ao gerar cobrança PIX', 'error');
        } finally {
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.textContent = 'Gerar PIX';
            }
        }
    }

    // --- Rendering ---

    function renderCharges(): void {
        const tableBody = getEl('pixChargesTable');
        const footerCount = getEl('footerCount');

        let filtered = [...g_charges];

        // 1. Filter by User
        const filterUser = (getEl('filterUser') as HTMLSelectElement | null)?.value || '';
        if (filterUser) {
            filtered = filtered.filter(c => (c.user_name || '-') === filterUser);
        }

        // 2. Filter by Status
        const filterStatus = (getEl('filterStatus') as HTMLSelectElement | null)?.value || '';
        if (filterStatus) {
            filtered = filtered.filter(c => c.status === filterStatus);
        }

        // 3. Filter by Creation Date (Start/End)
        const createStart = (getEl('filterCreateStart') as HTMLInputElement | null)?.value || '';
        const createEnd = (getEl('filterCreateEnd') as HTMLInputElement | null)?.value || '';
        if (createStart) {
            const startD = new Date(createStart + 'T00:00:00');
            filtered = filtered.filter(c => new Date(c.date) >= startD);
        }
        if (createEnd) {
            const endD = new Date(createEnd + 'T23:59:59');
            filtered = filtered.filter(c => new Date(c.date) <= endD);
        }

        // 4. Filter by Paid Date (Start/End)
        const paidStart = (getEl('filterPaidStart') as HTMLInputElement | null)?.value || '';
        const paidEnd = (getEl('filterPaidEnd') as HTMLInputElement | null)?.value || '';
        if (paidStart) {
            const startD = new Date(paidStart + 'T00:00:00');
            filtered = filtered.filter(c => c.received_at && new Date(c.received_at) >= startD);
        }
        if (paidEnd) {
            const endD = new Date(paidEnd + 'T23:59:59');
            filtered = filtered.filter(c => c.received_at && new Date(c.received_at) <= endD);
        }

        let totalPaid = 0;
        let totalPending = 0;

        filtered.forEach((c) => {
            const amt = parseFloat(c.amount as any) || 0;
            if (c.status === 'paid') {
                totalPaid += amt;
            } else {
                totalPending += amt;
            }
        });

        const footerTotalPaid = getEl('footerTotalPaid');
        const footerTotalPending = getEl('footerTotalPending');

        if (footerCount) {
            footerCount.textContent = String(filtered.length);
        }
        if (footerTotalPaid) {
            footerTotalPaid.textContent = formatCurrency(totalPaid);
        }
        if (footerTotalPending) {
            footerTotalPending.textContent = formatCurrency(totalPending);
        }

        if (!tableBody) return;

        if (filtered.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="8" class="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                        Nenhuma cobrança PIX correspondente aos filtros.
                    </td>
                </tr>
            `;
            return;
        }

        tableBody.innerHTML = filtered.map((charge) => {
            const isPaid = charge.status === 'paid';
            const statusClass = isPaid
                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800'
                : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800';
            const statusLabel = isPaid ? 'Pago' : 'Pendente';

            const shortTxid = charge.public_id ? `${charge.public_id.substring(0, 8)}...` : '-';

            return `
                <tr class="hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors">
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 font-mono">
                        <div class="flex items-center gap-1.5">
                            <span>${shortTxid}</span>
                            <button type="button" data-action="copy-txid" data-id="${charge.public_id}" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none" title="Copiar Txid completo">
                                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/></svg>
                            </button>
                        </div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        ${escapeHtml(charge.description)}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        ${escapeHtml(charge.user_name || '-')}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 dark:text-gray-100">
                        ${formatCurrency(charge.amount)}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        ${formatDate(charge.date)}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm">
                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusClass}">
                            ${statusLabel}
                        </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        ${charge.received_at ? formatDate(charge.received_at) : '-'}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                        ${isPaid
                            ? `
                                <button type="button" data-action="view-receipt" data-id="${charge.public_id}" 
                                    class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-50 hover:bg-green-100 dark:bg-green-950/20 dark:hover:bg-green-900/30 text-green-700 dark:text-green-300 focus:outline-none transition-colors border border-green-200 dark:border-green-800" title="Visualizar Recibo">
                                    <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    <span>Recibo</span>
                                </button>
                              `
                            : `
                                <div class="flex items-center justify-center gap-2">
                                    <button type="button" data-action="view-qr" data-id="${charge.public_id}" 
                                        class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-200 focus:outline-none transition-colors border border-gray-200 dark:border-slate-600" title="Visualizar QR Code">
                                        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 2L2 12l10 10 10-10L12 2z" />
                                        </svg>
                                        <span>QR Code</span>
                                    </button>
                                    <button type="button" data-action="delete-charge" data-id="${charge.public_id}" 
                                        class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 dark:bg-red-950/20 dark:hover:bg-red-900/30 text-red-700 dark:text-red-300 focus:outline-none transition-colors border border-red-200 dark:border-red-800" title="Excluir Cobrança">
                                        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                        <span>Excluir</span>
                                    </button>
                                </div>
                              `
                        }
                    </td>
                </tr>
            `;
        }).join('');
    }

    // --- Modal Management ---

    function openCreateModal(): void {
        const modal = getEl('createPixModal');
        if (modal) {
            modal.classList.remove('hidden');
            const pixAmountEl = getEl('pixAmount') as HTMLInputElement | null;
            if (pixAmountEl) {
                pixAmountEl.value = 'R$ 0,00';
            }
        }
    }

    function closeCreateModal(): void {
        const modal = getEl('createPixModal');
        if (modal) modal.classList.add('hidden');
    }

    function openQrModal(copiaECola: string, txid: string, qrCodeBase64?: string): void {
        const modal = getEl('qrCodeModal');
        const qrImage = getEl<HTMLImageElement>('qrCodeImage');
        const codeInput = getEl<HTMLInputElement>('pixCopyPasteCode');

        g_activeQrTxid = txid;

        if (codeInput) {
            codeInput.value = copiaECola;
        }

        if (qrImage) {
            if (qrCodeBase64) {
                // Se a API retornou o base64
                const hasPrefix = qrCodeBase64.startsWith('data:image');
                qrImage.src = hasPrefix ? qrCodeBase64 : `data:image/png;base64,${qrCodeBase64}`;
            } else {
                // Fallback para api.qrserver.com
                qrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(copiaECola)}`;
            }
        }

        if (modal) modal.classList.remove('hidden');
    }
    function closeQrModal(): void {
        const modal = getEl('qrCodeModal');
        g_activeQrTxid = null;
        if (modal) modal.classList.add('hidden');
    }

    function handleCopyPix(): void {
        const codeInput = getEl<HTMLInputElement>('pixCopyPasteCode');
        const btnCopy = getEl('btnCopyPix');

        if (!codeInput || !btnCopy) return;

        navigator.clipboard.writeText(codeInput.value).then(() => {
            const origText = btnCopy.textContent;
            btnCopy.textContent = 'Copiado!';
            btnCopy.classList.add('bg-green-600');
            setTimeout(() => {
                btnCopy.textContent = origText;
                btnCopy.classList.remove('bg-green-600');
            }, 1500);
        });
    }

    // --- Helpers ---

    function formatCurrency(value: number | string): string {
        const numeric = typeof value === 'string' ? parseFloat(value) : value;
        if (isNaN(numeric)) return 'R$ 0,00';
        return numeric.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }

    function formatDate(dateStr: string | null): string {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return dateStr;
        return date.toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function escapeHtml(str: string): string {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function showAlert(message: string, type: 'success' | 'error' = 'success'): void {
        const alertBox = getEl('alertMessage');
        if (!alertBox) return;

        alertBox.className = `mx-4 sm:mx-0 mb-4 p-4 rounded-xl text-sm border font-medium transition-all duration-300 ${
            type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-800'
                : 'bg-red-50 text-red-800 border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-800'
        }`;
        alertBox.textContent = message;
        alertBox.classList.remove('hidden');

        // Scroll dynamically to the top alert
        alertBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

        setTimeout(() => {
            alertBox.classList.add('hidden');
        }, 5000);
    }

    function populateUserFilter(): void {
        const sel = getEl('filterUser') as HTMLSelectElement | null;
        if (!sel) return;
        const previousValue = sel.value;

        // Coletar nomes de usuários únicos
        const users = Array.from(new Set(g_charges.map(c => c.user_name || '-').filter(Boolean))).sort();

        sel.innerHTML = '<option value="">Todos os usuários</option>';
        users.forEach(u => {
            sel.innerHTML += `<option value="${u}">${u}</option>`;
        });
        if (previousValue) {
            sel.value = previousValue;
        } else {
            const saved = (window as any).CompanyStorage?.getItem('gera_pix_filter_values') ?? localStorage.getItem('gera_pix_filter_values');
            if (saved) {
                try {
                    const filters = JSON.parse(saved);
                    if (filters.user && users.includes(filters.user)) {
                        sel.value = filters.user;
                    }
                } catch (e) {}
            }
        }
    }

    function setupFilters(): void {
        const FilterPanel = (window as any).FilterPanel;
        if (!FilterPanel) return;

        FilterPanel.mount({
            storageKey: 'gera_pix_filters',
            fields: [
                {
                    id: 'filterUser',
                    label: 'Usuário',
                    type: 'select',
                    options: [{ value: '', label: 'Todos os usuários' }]
                },
                {
                    id: 'filterStatus',
                    label: 'Status',
                    type: 'select',
                    options: [
                        { value: '', label: 'Todos' },
                        { value: 'progress', label: 'Pendente' },
                        { value: 'paid', label: 'Pago' }
                    ]
                },
                { id: 'filterCreateStart', label: 'Criação De', type: 'date' },
                { id: 'filterCreateEnd', label: 'Criação Até', type: 'date' },
                { id: 'filterPaidStart', label: 'Pago De', type: 'date' },
                { id: 'filterPaidEnd', label: 'Pago Até', type: 'date' }
            ],
            gridClass: 'grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-3 items-end'
        });

        restoreFilters();

        // Add change listeners
        ['filterUser', 'filterStatus', 'filterCreateStart', 'filterCreateEnd', 'filterPaidStart', 'filterPaidEnd'].forEach((id) => {
            getEl(id)?.addEventListener('change', () => {
                saveFilters();
                renderCharges();
            });
        });

        // Listen to Clear Filters button
        const clearBtn = getEl('gera_pix_filters-clear');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                if ((window as any).CompanyStorage) {
                    (window as any).CompanyStorage.removeItem('gera_pix_filter_values');
                } else {
                    localStorage.removeItem('gera_pix_filter_values');
                }
                setTimeout(() => {
                    renderCharges();
                }, 50);
            });
        }
    }

    function saveFilters(): void {
        const filters = {
            user: (getEl('filterUser') as HTMLSelectElement | null)?.value || '',
            status: (getEl('filterStatus') as HTMLSelectElement | null)?.value || '',
            createStart: (getEl('filterCreateStart') as HTMLInputElement | null)?.value || '',
            createEnd: (getEl('filterCreateEnd') as HTMLInputElement | null)?.value || '',
            paidStart: (getEl('filterPaidStart') as HTMLInputElement | null)?.value || '',
            paidEnd: (getEl('filterPaidEnd') as HTMLInputElement | null)?.value || ''
        };
        if ((window as any).CompanyStorage) {
            (window as any).CompanyStorage.setItem('gera_pix_filter_values', JSON.stringify(filters));
        } else {
            localStorage.setItem('gera_pix_filter_values', JSON.stringify(filters));
        }
    }

    function restoreFilters(): void {
        const saved = (window as any).CompanyStorage?.getItem('gera_pix_filter_values') ?? localStorage.getItem('gera_pix_filter_values');
        if (!saved) return;
        try {
            const filters = JSON.parse(saved);
            const userEl = getEl('filterUser') as HTMLSelectElement | null;
            if (userEl) userEl.value = filters.user || '';

            const statusEl = getEl('filterStatus') as HTMLSelectElement | null;
            if (statusEl) statusEl.value = filters.status || '';

            const createStartEl = getEl('filterCreateStart') as HTMLInputElement | null;
            if (createStartEl) createStartEl.value = filters.createStart || '';

            const createEndEl = getEl('filterCreateEnd') as HTMLInputElement | null;
            if (createEndEl) createEndEl.value = filters.createEnd || '';

            const paidStartEl = getEl('filterPaidStart') as HTMLInputElement | null;
            if (paidStartEl) paidStartEl.value = filters.paidStart || '';

            const paidEndEl = getEl('filterPaidEnd') as HTMLInputElement | null;
            if (paidEndEl) paidEndEl.value = filters.paidEnd || '';
        } catch (e) {
            console.warn('Erro ao restaurar filtros do localStorage:', e);
        }
    }
})();
