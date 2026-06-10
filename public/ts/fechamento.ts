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
    const tabCompraPanel = document.getElementById('tabCompraPanel') as HTMLElement;
    const tabVendaPanel = document.getElementById('tabVendaPanel') as HTMLElement;
    
    const companyParam = document.getElementById('companyParam') as HTMLSelectElement;
    const fechamentoForm = document.getElementById('fechamentoForm') as HTMLFormElement;

    const alertMessage = document.getElementById('alertMessage') as HTMLElement;

    // Load Customers for the select
    async function loadCustomers() {
        try {
            const response = await api('/entities/customers');
            companyParam.innerHTML = '<option value="">Selecione um cliente</option>';
            
            if (response && response.data && Array.isArray(response.data)) {
                response.data.forEach((customer: any) => {
                    const option = document.createElement('option');
                    option.value = customer.id;
                    option.textContent = customer.nome || customer.razao_social || `Cliente ${customer.id}`;
                    companyParam.appendChild(option);
                });
            } else if (response && Array.isArray(response)) {
                response.forEach((customer: any) => {
                    const option = document.createElement('option');
                    option.value = customer.id;
                    option.textContent = customer.nome || customer.razao_social || `Cliente ${customer.id}`;
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

    function switchTab(tab: 'compra' | 'venda') {
        if (tab === 'compra') {
            tabCompraBtn.classList.add('border-brand-500', 'text-brand-600', 'dark:text-brand-300');
            tabCompraBtn.classList.remove('border-transparent', 'text-gray-500', 'dark:text-gray-400');
            tabVendaBtn.classList.add('border-transparent', 'text-gray-500', 'dark:text-gray-400');
            tabVendaBtn.classList.remove('border-brand-500', 'text-brand-600', 'dark:text-brand-300');
            
            tabCompraPanel.classList.remove('hidden');
            tabVendaPanel.classList.add('hidden');
        } else {
            tabVendaBtn.classList.add('border-brand-500', 'text-brand-600', 'dark:text-brand-300');
            tabVendaBtn.classList.remove('border-transparent', 'text-gray-500', 'dark:text-gray-400');
            tabCompraBtn.classList.add('border-transparent', 'text-gray-500', 'dark:text-gray-400');
            tabCompraBtn.classList.remove('border-brand-500', 'text-brand-600', 'dark:text-brand-300');
            
            tabVendaPanel.classList.remove('hidden');
            tabCompraPanel.classList.add('hidden');
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
                bs_icms: parseFloat(formData.get('compra_bs_icms') as string) || 0,
                isento: parseFloat(formData.get('compra_isento') as string) || 0,
                outros: parseFloat(formData.get('compra_outros') as string) || 0,
            },
            venda: {
                bs_icms: parseFloat(formData.get('venda_bs_icms') as string) || 0,
                isento: parseFloat(formData.get('venda_isento') as string) || 0,
                outros: parseFloat(formData.get('venda_outros') as string) || 0,
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
