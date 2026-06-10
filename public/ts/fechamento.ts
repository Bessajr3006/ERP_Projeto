document.addEventListener('DOMContentLoaded', async () => {
    // Requires Authentication
    if (typeof Auth !== 'undefined' && !Auth.isAuthenticated()) {
        return;
    }

    // DOM Elements
    const btnOpenModal = document.getElementById('btnOpenModal') as HTMLButtonElement;
    const btnCancelModal = document.getElementById('btnCancelModal') as HTMLButtonElement;
    const fechamentoModal = document.getElementById('fechamentoModal') as HTMLElement;
    const modalBackdrop = document.getElementById('modalBackdrop') as HTMLElement;
    
    const tabCompraBtn = document.getElementById('tabCompraBtn') as HTMLButtonElement;
    const tabVendaBtn = document.getElementById('tabVendaBtn') as HTMLButtonElement;
    const tabApuracaoBtn = document.getElementById('tabApuracaoBtn') as HTMLButtonElement;
    const tabCompraPanel = document.getElementById('tabCompraPanel') as HTMLElement;
    const tabVendaPanel = document.getElementById('tabVendaPanel') as HTMLElement;
    const tabApuracaoPanel = document.getElementById('tabApuracaoPanel') as HTMLElement;
    
    const companyParam = document.getElementById('companyParam') as HTMLSelectElement;
    const fechamentoForm = document.getElementById('fechamentoForm') as HTMLFormElement;

    const alertMessage = document.getElementById('alertMessage') as HTMLElement;

    const parseCurrency = (str: string | null): number => {
        if (!str) return 0;
        return parseFloat(str.replace(/\./g, '').replace(',', '.')) || 0;
    };

    const makeMask: any = (window as any).createMaskAdapter || ((input: any, options: any) => (window as any).IMask?.(input, options));
    const moneyOptions = {
        mask: Number,
        scale: 2,
        signed: true,
        thousandsSeparator: '.',
        padFractionalZeros: true,
        normalizeZeros: true,
        radix: ',',
        mapToRadix: ['.']
    };

    const fieldsToMask = [
        'compra_valor', 'compra_bs_icms', 'compra_isento', 'compra_outros', 'compra_pis', 'compra_cofins',
        'venda_valor', 'venda_bs_icms', 'venda_isento', 'venda_outros', 'venda_pis', 'venda_cofins',
        'apuracao_icms', 'apuracao_pis', 'apuracao_cofins'
    ];

    fieldsToMask.forEach(id => {
        const el = document.getElementById(id);
        if (el) makeMask(el, moneyOptions);
    });

    // Load Customers for the select
    async function loadCustomers() {
        try {
            const response = await api('/entities/customers');
            companyParam.innerHTML = '<option value="">Selecione um cliente</option>';
            
            if (response && response.data && Array.isArray(response.data)) {
                response.data.forEach((customer: any) => {
                    const option = document.createElement('option');
                    option.value = customer.id;
                    option.textContent = customer.name || customer.razao_social || `Cliente ${customer.id}`;
                    companyParam.appendChild(option);
                });
            } else if (response && Array.isArray(response)) {
                response.forEach((customer: any) => {
                    const option = document.createElement('option');
                    option.value = customer.id;
                    option.textContent = customer.name || customer.razao_social || `Cliente ${customer.id}`;
                    companyParam.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Erro ao carregar clientes:', error);
            companyParam.innerHTML = '<option value="">Erro ao carregar clientes</option>';
        }
    }

    function openModal() {
        fechamentoModal.classList.remove('hidden');
        fechamentoForm.reset();
        switchTab('compra');
    }

    function closeModal() {
        fechamentoModal.classList.add('hidden');
    }

    function switchTab(tab: 'compra' | 'venda' | 'apuracao') {
        [tabCompraBtn, tabVendaBtn, tabApuracaoBtn].forEach(btn => {
            btn.classList.add('border-transparent', 'text-gray-500', 'dark:text-gray-400');
            btn.classList.remove('border-brand-500', 'text-brand-600', 'dark:text-brand-300');
        });
        [tabCompraPanel, tabVendaPanel, tabApuracaoPanel].forEach(panel => {
            panel.classList.add('hidden');
        });

        if (tab === 'compra') {
            tabCompraBtn.classList.remove('border-transparent', 'text-gray-500', 'dark:text-gray-400');
            tabCompraBtn.classList.add('border-brand-500', 'text-brand-600', 'dark:text-brand-300');
            tabCompraPanel.classList.remove('hidden');
        } else if (tab === 'venda') {
            tabVendaBtn.classList.remove('border-transparent', 'text-gray-500', 'dark:text-gray-400');
            tabVendaBtn.classList.add('border-brand-500', 'text-brand-600', 'dark:text-brand-300');
            tabVendaPanel.classList.remove('hidden');
        } else if (tab === 'apuracao') {
            tabApuracaoBtn.classList.remove('border-transparent', 'text-gray-500', 'dark:text-gray-400');
            tabApuracaoBtn.classList.add('border-brand-500', 'text-brand-600', 'dark:text-brand-300');
            tabApuracaoPanel.classList.remove('hidden');
        }
    }

    function showAlert(message: string, isError = false) {
        alertMessage.textContent = message;
        alertMessage.className = `mx-4 sm:mx-0 mb-4 p-4 rounded-xl text-sm ${isError ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300' : 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300'}`;
        alertMessage.classList.remove('hidden');
        setTimeout(() => alertMessage.classList.add('hidden'), 5000);
    }

    // Event Listeners
    btnOpenModal.addEventListener('click', openModal);
    btnCancelModal.addEventListener('click', closeModal);
    modalBackdrop.addEventListener('click', closeModal);

    tabCompraBtn.addEventListener('click', () => switchTab('compra'));
    tabVendaBtn.addEventListener('click', () => switchTab('venda'));
    tabApuracaoBtn.addEventListener('click', () => switchTab('apuracao'));

    fechamentoForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (!companyParam.value) {
            alert('Por favor, selecione a empresa.');
            return;
        }

        const formData = new FormData(fechamentoForm);
        
        const payload = {
            customerId: formData.get('customerId'),
            compra: {
                valor: parseCurrency(formData.get('compra_valor') as string),
                bs_icms: parseCurrency(formData.get('compra_bs_icms') as string),
                isento: parseCurrency(formData.get('compra_isento') as string),
                outros: parseCurrency(formData.get('compra_outros') as string),
                pis: parseCurrency(formData.get('compra_pis') as string),
                cofins: parseCurrency(formData.get('compra_cofins') as string),
            },
            venda: {
                valor: parseCurrency(formData.get('venda_valor') as string),
                bs_icms: parseCurrency(formData.get('venda_bs_icms') as string),
                isento: parseCurrency(formData.get('venda_isento') as string),
                outros: parseCurrency(formData.get('venda_outros') as string),
                pis: parseCurrency(formData.get('venda_pis') as string),
                cofins: parseCurrency(formData.get('venda_cofins') as string),
            },
            apuracao: {
                icms: parseCurrency(formData.get('apuracao_icms') as string),
                pis: parseCurrency(formData.get('apuracao_pis') as string),
                cofins: parseCurrency(formData.get('apuracao_cofins') as string),
            }
        };

        console.log('Payload do Fechamento a ser enviado:', payload);
        
        try {
            // Simulando um timeout de rede para mostrar que carregou
            await new Promise(resolve => setTimeout(resolve, 500));
            
            showAlert('Fechamento lançado com sucesso! (Salvo apenas no Console no momento)');
            closeModal();
        } catch (error) {
            console.error('Erro ao salvar fechamento:', error);
            showAlert('Erro ao salvar o fechamento. Verifique o console.', true);
        }
    });

    // Initialize
    loadCustomers();
});
