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
    const tabDespesaBtn = document.getElementById('tabDespesaBtn') as HTMLButtonElement;
    const tabImpostoBtn = document.getElementById('tabImpostoBtn') as HTMLButtonElement;
    const tabSimplesBtn = document.getElementById('tabSimplesBtn') as HTMLButtonElement;
    const tabObservacaoBtn = document.getElementById('tabObservacaoBtn') as HTMLButtonElement;
    const tabCompraPanel = document.getElementById('tabCompraPanel') as HTMLElement;
    const tabVendaPanel = document.getElementById('tabVendaPanel') as HTMLElement;
    const tabApuracaoPanel = document.getElementById('tabApuracaoPanel') as HTMLElement;
    const tabDespesaPanel = document.getElementById('tabDespesaPanel') as HTMLElement;
    const tabImpostoPanel = document.getElementById('tabImpostoPanel') as HTMLElement;
    const tabSimplesPanel = document.getElementById('tabSimplesPanel') as HTMLElement;
    const tabObservacaoPanel = document.getElementById('tabObservacaoPanel') as HTMLElement;
    
    // Filter Elements
    const toggleFilterBtn = document.getElementById('toggleFilterBtn') as HTMLButtonElement;
    const filterBody = document.getElementById('filterBody') as HTMLElement;
    const filterChevron = document.getElementById('filterChevron') as HTMLElement;
    const filterForm = document.getElementById('filterForm') as HTMLFormElement;
    const btnClearFilters = document.getElementById('btnClearFilters') as HTMLButtonElement;
    const filterCompanyParam = document.getElementById('filterCompanyParam') as HTMLSelectElement;
    const filterCustomerGroup = document.getElementById('filterCustomerGroup') as HTMLSelectElement;
    const filterCompetencia = document.getElementById('filterCompetencia') as HTMLInputElement;
    const selectAll = document.getElementById('selectAll') as HTMLInputElement | null;

    const companyParam = document.getElementById('companyParam') as HTMLSelectElement;
    const modalCustomerGroup = document.getElementById('modalCustomerGroup') as HTMLSelectElement | null;
    const fechamentoForm = document.getElementById('fechamentoForm') as HTMLFormElement;
    let allCustomers: any[] = [];
    let currentImportCfopTotals: Record<string, number> | null = null;
    let currentImportTotals: any = null;
    const companyTypeIndicator = document.getElementById('companyTypeIndicator') as HTMLElement | null;
    const companyTypeDot = document.getElementById('companyTypeDot') as HTMLElement | null;
    const companyTypeText = document.getElementById('companyTypeText') as HTMLElement | null;

    const alertMessage = document.getElementById('alertMessage') as HTMLElement;

    const parseCurrency = (str: string | null): number => {
        if (!str) return 0;
        const clean = str.replace(/[^\d.,-]/g, '');
        return parseFloat(clean.replace(/\./g, '').replace(',', '.')) || 0;
    };

    const formatCurrencyInput = (e: Event) => {
        const input = e.target as HTMLInputElement;
        let value = input.value.replace(/\D/g, '');
        if (value === '') {
            input.value = '';
            return;
        }
        const numberValue = parseInt(value, 10) / 100;
        input.value = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(numberValue);
    };

    const fieldsToMask = [
        'compra_valor', 'compra_bs_icms', 'compra_isento', 'compra_outros', 'compra_pis', 'compra_cofins',
        'venda_valor', 'venda_bs_icms', 'venda_isento', 'venda_outros', 'venda_pis', 'venda_cofins',
        'apuracao_icms', 'apuracao_fecp', 'apuracao_pis', 'apuracao_cofins',
        'apuracao_aj_icms', 'apuracao_aj_fecp', 'apuracao_aj_pis', 'apuracao_aj_cofins',
        'despesa_adm', 'despesa_operacional', 'despesa_folha', 'despesa_cmv', 'despesa_ir_aluguel',
        'imposto_irpj', 'imposto_csll',
        'simples_faturamento', 'simples_das',
        'simples_valor_tributado', 'simples_valor_nao_tributado',
        'simples_faturamento_acumulado_12m', 'simples_faturamento_acumulado_ano_anterior',
        'simples_cpp', 'simples_icms', 'simples_ipi', 'simples_iss', 'simples_pis', 'simples_cofins', 'simples_irpj', 'simples_csll'
    ];

    fieldsToMask.forEach(id => {
        const el = document.getElementById(id) as HTMLInputElement;
        if (el) {
            el.addEventListener('input', formatCurrencyInput);
        }
    });

    const calculateF = () => {
        const formatBRL = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
        
        const apurIcms = parseCurrency((document.getElementById('apuracao_icms') as HTMLInputElement)?.value);
        const ajIcms = parseCurrency((document.getElementById('apuracao_aj_icms') as HTMLInputElement)?.value);
        const fIcmsEl = document.getElementById('apuracao_f_icms') as HTMLInputElement;
        if (fIcmsEl) {
            fIcmsEl.value = formatBRL(apurIcms - ajIcms);
        }

        const apurFecp = parseCurrency((document.getElementById('apuracao_fecp') as HTMLInputElement)?.value);
        const ajFecp = parseCurrency((document.getElementById('apuracao_aj_fecp') as HTMLInputElement)?.value);
        const fFecpEl = document.getElementById('apuracao_f_fecp') as HTMLInputElement;
        if (fFecpEl) {
            fFecpEl.value = formatBRL(apurFecp - ajFecp);
        }

        const apurPis = parseCurrency((document.getElementById('apuracao_pis') as HTMLInputElement)?.value);
        const ajPis = parseCurrency((document.getElementById('apuracao_aj_pis') as HTMLInputElement)?.value);
        const fPisEl = document.getElementById('apuracao_f_pis') as HTMLInputElement;
        if (fPisEl) {
            fPisEl.value = formatBRL(apurPis - ajPis);
        }

        const apurCofins = parseCurrency((document.getElementById('apuracao_cofins') as HTMLInputElement)?.value);
        const ajCofins = parseCurrency((document.getElementById('apuracao_aj_cofins') as HTMLInputElement)?.value);
        const fCofinsEl = document.getElementById('apuracao_f_cofins') as HTMLInputElement;
        if (fCofinsEl) {
            fCofinsEl.value = formatBRL(apurCofins - ajCofins);
        }
    };

    const apuracaoSourceFields = [
        'apuracao_icms', 'apuracao_aj_icms',
        'apuracao_fecp', 'apuracao_aj_fecp',
        'apuracao_pis', 'apuracao_aj_pis',
        'apuracao_cofins', 'apuracao_aj_cofins'
    ];
    apuracaoSourceFields.forEach(id => {
        const el = document.getElementById(id) as HTMLInputElement;
        if (el) {
            el.addEventListener('input', () => {
                calculateF();
            });
        }
    });

    const formatPercentInput = (e: Event) => {
        const input = e.target as HTMLInputElement;
        let value = input.value.replace(/\D/g, '');
        if (value === '') {
            input.value = '';
            return;
        }
        const numberValue = parseInt(value, 10) / 100;
        input.value = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(numberValue) + ' %';
    };

    const calculateSimples = () => {
        const formatBRL = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
        
        const valorTributado = parseCurrency((document.getElementById('simples_valor_tributado') as HTMLInputElement)?.value);
        const valorNaoTributado = parseCurrency((document.getElementById('simples_valor_nao_tributado') as HTMLInputElement)?.value);
        const totalFaturamento = valorTributado + valorNaoTributado;
        
        const faturamentoEl = document.getElementById('simples_faturamento') as HTMLInputElement;
        if (faturamentoEl) {
            faturamentoEl.value = formatBRL(totalFaturamento);
        }

        const cppInput = document.getElementById('simples_cpp') as HTMLInputElement;
        const icmsInput = document.getElementById('simples_icms') as HTMLInputElement;
        const ipiInput = document.getElementById('simples_ipi') as HTMLInputElement;
        const issInput = document.getElementById('simples_iss') as HTMLInputElement;
        const pisInput = document.getElementById('simples_pis') as HTMLInputElement;
        const cofinsInput = document.getElementById('simples_cofins') as HTMLInputElement;
        const irpjInput = document.getElementById('simples_irpj') as HTMLInputElement;
        const csllInput = document.getElementById('simples_csll') as HTMLInputElement;

        const cpp = parseCurrency(cppInput?.value);
        const icms = parseCurrency(icmsInput?.value);
        const ipi = parseCurrency(ipiInput?.value);
        const iss = parseCurrency(issInput?.value);
        const pis = parseCurrency(pisInput?.value);
        const cofins = parseCurrency(cofinsInput?.value);
        const irpj = parseCurrency(irpjInput?.value);
        const csll = parseCurrency(csllInput?.value);
        
        const sumTaxes = cpp + icms + ipi + iss + pis + cofins + irpj + csll;
        
        const dasEl = document.getElementById('simples_das') as HTMLInputElement;
        const aliquotaInput = (document.getElementById('simples_aliquota') as HTMLInputElement)?.value || '';
        const cleanAliquotaStr = aliquotaInput.replace(/[^\d.,]/g, '').replace(',', '.');
        const aliquota = parseFloat(cleanAliquotaStr) || 0;

        if (sumTaxes > 0) {
            if (dasEl) {
                dasEl.value = formatBRL(sumTaxes);
            }
        } else {
            const calculatedDas = valorTributado * (aliquota / 100);
            if (dasEl) {
                dasEl.value = formatBRL(calculatedDas);
            }

            if (calculatedDas > 0) {
                if (cppInput) cppInput.value = formatBRL(calculatedDas * 0.415);
                if (icmsInput) icmsInput.value = formatBRL(calculatedDas * 0.34);
                if (pisInput) pisInput.value = formatBRL(calculatedDas * 0.0276);
                if (cofinsInput) cofinsInput.value = formatBRL(calculatedDas * 0.1274);
                if (irpjInput) irpjInput.value = formatBRL(calculatedDas * 0.055);
                if (csllInput) csllInput.value = formatBRL(calculatedDas * 0.035);
                if (ipiInput) ipiInput.value = '';
                if (issInput) issInput.value = '';
            } else {
                if (cppInput) cppInput.value = '';
                if (icmsInput) icmsInput.value = '';
                if (pisInput) pisInput.value = '';
                if (cofinsInput) cofinsInput.value = '';
                if (irpjInput) irpjInput.value = '';
                if (csllInput) csllInput.value = '';
                if (ipiInput) ipiInput.value = '';
                if (issInput) issInput.value = '';
            }
        }
    };

    const simplesAliquotaEl = document.getElementById('simples_aliquota') as HTMLInputElement;
    if (simplesAliquotaEl) {
        simplesAliquotaEl.addEventListener('input', formatPercentInput);
    }

    [
        'simples_valor_tributado', 'simples_valor_nao_tributado', 'simples_aliquota',
        'simples_cpp', 'simples_icms', 'simples_ipi', 'simples_iss', 'simples_pis', 'simples_cofins', 'simples_irpj', 'simples_csll'
    ].forEach(id => {
        const el = document.getElementById(id) as HTMLInputElement;
        if (el) {
            el.addEventListener('input', () => {
                calculateSimples();
            });
        }
    });

    const updateCustomerTypeIndicator = (customerId: string) => {
        const xmlImportLabel = document.getElementById('xmlImportLabel');
        const xmlFileInputEl = document.getElementById('xmlFileInput') as HTMLInputElement | null;
        const spedImportLabel = document.getElementById('spedImportLabel');
        const spedFileInputEl = document.getElementById('spedFileInput') as HTMLInputElement | null;

        const disableXmlImport = () => {
            if (xmlFileInputEl) xmlFileInputEl.disabled = true;
            if (xmlImportLabel) {
                xmlImportLabel.className = "flex-1 inline-flex items-center justify-center rounded-md border border-gray-200 dark:border-slate-700 shadow-sm px-3 py-2 bg-gray-100 dark:bg-slate-800/50 text-sm font-medium text-gray-400 dark:text-gray-500 cursor-not-allowed opacity-60 pointer-events-none transition-colors";
            }
            if (spedFileInputEl) spedFileInputEl.disabled = true;
            if (spedImportLabel) {
                spedImportLabel.classList.add('hidden');
                spedImportLabel.classList.remove('inline-flex');
            }
        };

        const enableXmlImport = (showSped: boolean) => {
            if (xmlFileInputEl) xmlFileInputEl.disabled = false;
            if (xmlImportLabel) {
                xmlImportLabel.className = "flex-1 inline-flex items-center justify-center rounded-md border border-gray-300 dark:border-slate-600 shadow-sm px-3 py-2 bg-white dark:bg-slate-800 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 cursor-pointer transition-colors";
            }
            if (spedFileInputEl) spedFileInputEl.disabled = !showSped;
            if (spedImportLabel) {
                if (showSped) {
                    spedImportLabel.classList.remove('hidden');
                    spedImportLabel.classList.add('inline-flex');
                } else {
                    spedImportLabel.classList.add('hidden');
                    spedImportLabel.classList.remove('inline-flex');
                }
            }
        };

        if (!companyTypeIndicator || !companyTypeDot || !companyTypeText) return;
        
        if (!customerId) {
            companyTypeIndicator.classList.add('hidden');
            companyTypeIndicator.classList.remove('inline-flex');
            disableXmlImport();
            return;
        }

        const customer = allCustomers.find(c => String(c.id) === String(customerId));
        if (!customer) {
            companyTypeIndicator.classList.add('hidden');
            companyTypeIndicator.classList.remove('inline-flex');
            disableXmlImport();
            return;
        }

        const cleanDoc = (customer.cnpj_cpf || '').replace(/\D/g, '');
        const isPJ = cleanDoc.length === 14;
        const isRegistered = customer.is_registered_as_company === 1 || customer.is_registered_as_company === true;

        const regime = customer.tax_regime || 'Regime não informado';
        companyTypeIndicator.classList.remove('hidden');
        companyTypeIndicator.classList.add('inline-flex');
        
        if (isRegistered) {
            companyTypeDot.className = 'h-2.5 w-2.5 rounded-full mr-1.5 bg-green-500';
            enableXmlImport(true);
        } else {
            companyTypeDot.className = 'h-2.5 w-2.5 rounded-full mr-1.5 bg-red-500';
            enableXmlImport(false);
        }

        if (isPJ) {
            companyTypeText.textContent = `Empresa | ${regime}`;
        } else {
            companyTypeText.textContent = `Pessoa Física | ${regime}`;
        }
    };

    async function loadFaturamentoAcumulado() {
        const customerId = companyParam?.value;
        const competenciaEl = document.getElementById('competencia') as HTMLInputElement | null;
        const competencia = competenciaEl?.value;

        if (!customerId || !competencia || !/^\d{4}-\d{2}$/.test(competencia)) {
            return;
        }

        try {
            const response = await api(`/fechamentos/faturamento-acumulado?customerId=${customerId}&competencia=${competencia}`);
            if (response && response.status === 'success' && response.data) {
                const data = response.data;
                const formatBRL = (val: number) => {
                    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
                };

                const f12m = document.getElementById('simples_faturamento_acumulado_12m') as HTMLInputElement;
                const fPrev = document.getElementById('simples_faturamento_acumulado_ano_anterior') as HTMLInputElement;

                if (f12m) f12m.value = formatBRL(data.faturamento_acumulado_12m);
                if (fPrev) fPrev.value = formatBRL(data.faturamento_acumulado_ano_anterior);
                
                calculateSimples();
            }
        } catch (err) {
            console.error('Erro ao buscar faturamento acumulado:', err);
        }
    }

    if (companyParam) {
        companyParam.addEventListener('change', () => {
            updateCustomerTypeIndicator(companyParam.value);
            loadFaturamentoAcumulado();
        });
    }

    const competenciaEl = document.getElementById('competencia') as HTMLInputElement | null;
    if (competenciaEl) {
        competenciaEl.addEventListener('change', loadFaturamentoAcumulado);
        competenciaEl.addEventListener('input', loadFaturamentoAcumulado);
    }

    function populateCustomersSelect(customersToRender: any[]) {
        if (!companyParam) return;
        companyParam.innerHTML = '<option value="">Selecione um cliente</option>';
        customersToRender.forEach((customer: any) => {
            const option = document.createElement('option');
            option.value = customer.id;
            option.textContent = customer.name || customer.razao_social || `Cliente ${customer.id}`;
            companyParam.appendChild(option);
        });
    }

    if (modalCustomerGroup) {
        modalCustomerGroup.addEventListener('change', () => {
            const groupId = modalCustomerGroup.value;
            if (!groupId) {
                populateCustomersSelect(allCustomers);
            } else {
                const filtered = allCustomers.filter(c => String(c.customer_group_id) === String(groupId));
                populateCustomersSelect(filtered);
            }
        });
    }

    // Load Customers for the select
    async function loadCustomers(savedCustomerId?: string) {
        try {
            const response = await api('/entities/customers');
            allCustomers = Array.isArray(response?.data) ? response.data : (Array.isArray(response) ? response : []);
            
            populateCustomersSelect(allCustomers);
            
            if (filterCompanyParam) {
                filterCompanyParam.innerHTML = '<option value="">Todas as empresas</option>';
                allCustomers.forEach((customer: any) => {
                    const option = document.createElement('option');
                    option.value = customer.id;
                    option.textContent = customer.name || customer.razao_social || `Cliente ${customer.id}`;
                    filterCompanyParam.appendChild(option);
                });
                if (savedCustomerId) {
                    filterCompanyParam.value = savedCustomerId;
                }
            }
        } catch (error) {
            console.error('Erro ao carregar clientes:', error);
            companyParam.innerHTML = '<option value="">Erro ao carregar clientes</option>';
        }
    }

    // Load Customer Groups for the filter select
    async function loadCustomerGroups(savedGroupId?: string) {
        try {
            const response = await api('/customer-groups');
            const groups = response.data || [];
            
            if (filterCustomerGroup) {
                filterCustomerGroup.innerHTML = '<option value="">Todos os grupos</option>';
                groups.forEach((group: any) => {
                    const option = document.createElement('option');
                    option.value = group.id;
                    option.textContent = group.name;
                    filterCustomerGroup.appendChild(option);
                });
                if (savedGroupId) {
                    filterCustomerGroup.value = savedGroupId;
                }
            }

            if (modalCustomerGroup) {
                modalCustomerGroup.innerHTML = '<option value="">Todos os grupos</option>';
                groups.forEach((group: any) => {
                    const option = document.createElement('option');
                    option.value = group.id;
                    option.textContent = group.name;
                    modalCustomerGroup.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Erro ao carregar grupos de clientes:', error);
            if (filterCustomerGroup) {
                filterCustomerGroup.innerHTML = '<option value="">Erro ao carregar grupos</option>';
            }
            if (modalCustomerGroup) {
                modalCustomerGroup.innerHTML = '<option value="">Erro ao carregar grupos</option>';
            }
        }
    }

    const FILTERS_STORAGE_KEY = 'erp_fechamentos_filters';
    const SORT_STORAGE_KEY = 'erp_fechamentos_sort';

    function saveFilters() {
        const data = {
            customerId: filterCompanyParam ? filterCompanyParam.value : '',
            customerGroupId: filterCustomerGroup ? filterCustomerGroup.value : '',
            competencia: filterCompetencia ? filterCompetencia.value : '',
            filterIsOpen: filterIsOpen
        };
        try {
            if ((window as any).CompanyStorage) {
                (window as any).CompanyStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(data));
            } else {
                localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(data));
            }
        } catch (e) {
            console.error('Erro ao salvar filtros:', e);
        }
    }

    function getSavedFilters() {
        try {
            const saved = (window as any).CompanyStorage?.getItem(FILTERS_STORAGE_KEY) ?? localStorage.getItem(FILTERS_STORAGE_KEY);
            if (saved) {
                return JSON.parse(saved);
            }
        } catch (e) {
            console.error('Erro ao ler filtros salvos:', e);
        }
        return null;
    }

    function saveSort() {
        try {
            const data = JSON.stringify({
                field: currentSortField,
                asc: currentSortAsc
            });
            if ((window as any).CompanyStorage) {
                (window as any).CompanyStorage.setItem(SORT_STORAGE_KEY, data);
            } else {
                localStorage.setItem(SORT_STORAGE_KEY, data);
            }
        } catch (e) {
            console.error('Erro ao salvar ordenação:', e);
        }
    }

    function loadSavedSort() {
        try {
            const saved = (window as any).CompanyStorage?.getItem(SORT_STORAGE_KEY) ?? localStorage.getItem(SORT_STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed && typeof parsed.field === 'string') {
                    currentSortField = parsed.field;
                    currentSortAsc = !!parsed.asc;
                }
            }
        } catch (e) {
            console.error('Erro ao ler ordenação salva:', e);
        }
    }

    function applySort(data: any[]) {
        if (!currentSortField) return;
        const field = currentSortField;
        data.sort((a, b) => {
            let valA = a[field];
            let valB = b[field];

            if (field === 'origem') {
                valA = a.origem || (a.observacao && (a.observacao.includes('Importado') || a.observacao.includes('SPED') || a.observacao.includes('XML')) ? 'Arquivo' : 'Manual');
                valB = b.origem || (b.observacao && (b.observacao.includes('Importado') || b.observacao.includes('SPED') || b.observacao.includes('XML')) ? 'Arquivo' : 'Manual');
            } else if (field === 'f_icms') {
                valA = (Number(a.apuracao_icms) || 0) - (Number(a.apuracao_aj_icms) || 0);
                valB = (Number(b.apuracao_icms) || 0) - (Number(b.apuracao_aj_icms) || 0);
            } else if (field === 'f_fecp') {
                valA = (Number(a.apuracao_fecp) || 0) - (Number(a.apuracao_aj_fecp) || 0);
                valB = (Number(b.apuracao_fecp) || 0) - (Number(b.apuracao_aj_fecp) || 0);
            } else if (field === 'f_pis') {
                valA = (Number(a.apuracao_pis) || 0) - (Number(a.apuracao_aj_pis) || 0);
                valB = (Number(b.apuracao_pis) || 0) - (Number(b.apuracao_aj_pis) || 0);
            } else if (field === 'f_cofins') {
                valA = (Number(a.apuracao_cofins) || 0) - (Number(a.apuracao_aj_cofins) || 0);
                valB = (Number(b.apuracao_cofins) || 0) - (Number(b.apuracao_aj_cofins) || 0);
            }

            if (valA === undefined || valA === null) valA = '';
            if (valB === undefined || valB === null) valB = '';

            if (typeof valA === 'string') {
                valA = valA.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            }
            if (typeof valB === 'string') {
                valB = valB.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            }

            if (valA < valB) return currentSortAsc ? -1 : 1;
            if (valA > valB) return currentSortAsc ? 1 : -1;
            return 0;
        });
    }

    let loadedFechamentos: any[] = [];
    let currentSortField: string = 'id';
    let currentSortAsc: boolean = false;
    let currentFechamentoPublicId: string | null = null;
    const fechamentosTable = document.getElementById('fechamentosTable') as HTMLElement;
    const fechamentosCount = document.getElementById('fechamentosCount') as HTMLElement;

    async function loadFechamentos() {
        try {
            const customerId = filterCompanyParam?.value;
            const customerGroupId = filterCustomerGroup?.value;
            const competencia = filterCompetencia?.value;
            
            let url = '/fechamentos';
            const params: string[] = [];
            if (customerId) params.push(`customerId=${customerId}`);
            if (customerGroupId) params.push(`customerGroupId=${customerGroupId}`);
            if (competencia) params.push(`competencia=${competencia}`);
            if (params.length > 0) {
                url += `?${params.join('&')}`;
            }
            
            const response = await api(url);
            loadedFechamentos = response.data || [];
            
            applySort(loadedFechamentos);
            renderFechamentosTable(loadedFechamentos);
            updateHeaderSortIcons();
        } catch (error) {
            console.error('Erro ao carregar fechamentos:', error);
            showAlert('Erro ao carregar fechamentos.', true);
        }
    }

    function renderFechamentosTable(fechamentos: any[]) {
        if (!fechamentosTable) return;

        if (selectAll) {
            selectAll.checked = false;
            selectAll.disabled = fechamentos.length === 0;
        }
        
        if (fechamentos.length === 0) {
            fechamentosTable.innerHTML = `
                <tr>
                    <td colspan="50" class="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                        Nenhum fechamento registrado.
                    </td>
                </tr>
            `;
            if (fechamentosCount) fechamentosCount.textContent = '0';
            return;
        }
        
        if (fechamentosCount) fechamentosCount.textContent = fechamentos.length.toString();
        
        fechamentosTable.innerHTML = fechamentos.map((f: any) => {
            const format = (val: any) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(val) || 0);
            const formatPercent = (val: any) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(val) || 0) + '%';
            const formatPeriod = (comp: string) => {
                if (!comp || !comp.includes('-')) return comp || '-';
                const [year, month] = comp.split('-');
                return `${month}/${year}`;
            };
            const formatCNPJ = (value: any) => {
                const clean = String(value || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
                if (clean.length !== 14) return value || '-';
                return clean.replace(/^([a-zA-Z0-9]{2})([a-zA-Z0-9]{3})([a-zA-Z0-9]{3})([a-zA-Z0-9]{4})([a-zA-Z0-9]{2})$/, "$1.$2.$3/$4-$5");
            };
            const formattedId = '#' + String(f.id).padStart(4, '0');
            const isArquivo = f.origem === 'Arquivo' || (f.observacao && (f.observacao.includes('Importado') || f.observacao.includes('SPED') || f.observacao.includes('XML')));
            const origemBadge = isArquivo
                ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800/40" title="${f.observacao || 'Importado por Arquivo'}">
                    <svg class="w-3.5 h-3.5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                    </svg>
                    Arquivo
                   </span>`
                : `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-700 dark:bg-slate-700/60 dark:text-gray-300 border border-gray-200 dark:border-slate-600" title="Incluso Manualmente">
                    <svg class="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/>
                    </svg>
                    Manual
                   </span>`;
            
            return `
                <tr class="hover:bg-gray-50 dark:hover:bg-slate-700/30">
                    <td class="col-selecionar px-3 py-4 whitespace-nowrap text-sm text-gray-500">
                        <input type="checkbox" class="row-checkbox rounded border-gray-300 dark:border-slate-600 text-brand-600 shadow-sm focus:border-brand-300 focus:ring focus:ring-brand-200 focus:ring-opacity-50 dark:bg-slate-800 cursor-pointer" data-id="${f.public_id}">
                    </td>
                    <td class="col-id px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-500 dark:text-gray-400">
                        ${formattedId}
                    </td>
                    <td class="col-empresa px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        <div class="font-medium">${f.customer_name || `Cliente ${f.customer_id}`}</div>
                    </td>
                    <td class="col-fantasia px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        ${f.customer_trade_name || '-'}
                    </td>
                    <td class="col-cnpj px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        ${formatCNPJ(f.customer_cnpj_cpf)}
                    </td>
                    <td class="col-periodo px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                        ${formatPeriod(f.competencia)}
                    </td>
                    <td class="col-origem px-6 py-4 whitespace-nowrap text-sm">
                        ${origemBadge}
                    </td>
                    <td class="col-compra px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                        ${format(f.compra_valor)}
                    </td>
                    <td class="col-compra_bs_icms px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                        ${format(f.compra_bs_icms)}
                    </td>
                    <td class="col-compra_isento px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                        ${format(f.compra_isento)}
                    </td>
                    <td class="col-compra_outros px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                        ${format(f.compra_outros)}
                    </td>
                    <td class="col-compra_pis px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                        ${format(f.compra_pis)}
                    </td>
                    <td class="col-compra_cofins px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                        ${format(f.compra_cofins)}
                    </td>
                    <td class="col-venda px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                        ${format(f.venda_valor)}
                    </td>
                    <td class="col-venda_bs_icms px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                        ${format(f.venda_bs_icms)}
                    </td>
                    <td class="col-venda_isento px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                        ${format(f.venda_isento)}
                    </td>
                    <td class="col-venda_outros px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                        ${format(f.venda_outros)}
                    </td>
                    <td class="col-venda_pis px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                        ${format(f.venda_pis)}
                    </td>
                    <td class="col-venda_cofins px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                        ${format(f.venda_cofins)}
                    </td>
                    <td class="col-icms px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                        ${format(f.apuracao_icms)}
                    </td>
                    <td class="col-apuracao_aj_icms px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                        ${format(f.apuracao_aj_icms)}
                    </td>
                    <td class="col-f_icms px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                        ${format((Number(f.apuracao_icms) || 0) - (Number(f.apuracao_aj_icms) || 0))}
                    </td>
                    <td class="col-fecp px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                        ${format(f.apuracao_fecp)}
                    </td>
                    <td class="col-apuracao_aj_fecp px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                        ${format(f.apuracao_aj_fecp)}
                    </td>
                    <td class="col-f_fecp px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                        ${format((Number(f.apuracao_fecp) || 0) - (Number(f.apuracao_aj_fecp) || 0))}
                    </td>
                    <td class="col-pis px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                        ${format(f.apuracao_pis)}
                    </td>
                    <td class="col-apuracao_aj_pis px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                        ${format(f.apuracao_aj_pis)}
                    </td>
                    <td class="col-f_pis px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                        ${format((Number(f.apuracao_pis) || 0) - (Number(f.apuracao_aj_pis) || 0))}
                    </td>
                    <td class="col-cofins px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                        ${format(f.apuracao_cofins)}
                    </td>
                    <td class="col-apuracao_aj_cofins px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                        ${format(f.apuracao_aj_cofins)}
                    </td>
                    <td class="col-f_cofins px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                        ${format((Number(f.apuracao_cofins) || 0) - (Number(f.apuracao_aj_cofins) || 0))}
                    </td>
                    <td class="col-despesa_adm px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                        ${format(f.despesa_adm)}
                    </td>
                    <td class="col-despesa_operacional px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                        ${format(f.despesa_operacional)}
                    </td>
                    <td class="col-despesa_folha px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                        ${format(f.despesa_folha)}
                    </td>
                    <td class="col-despesa_cmv px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                        ${format(f.despesa_cmv)}
                    </td>
                    <td class="col-despesa_ir_aluguel px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                        ${format(f.despesa_ir_aluguel)}
                    </td>
                    <td class="col-imposto_irpj px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                        ${format(f.imposto_irpj)}
                    </td>
                    <td class="col-imposto_csll px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                        ${format(f.imposto_csll)}
                    </td>
                    <td class="col-simples_faturamento px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                        ${format(f.simples_faturamento)}
                    </td>
                    <td class="col-simples_aliquota px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                        ${formatPercent(f.simples_aliquota)}
                    </td>
                    <td class="col-simples_das px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                        ${format(f.simples_das)}
                    </td>
                    <td class="col-simples_cpp px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                        ${format(f.simples_cpp)}
                    </td>
                    <td class="col-simples_icms px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                        ${format(f.simples_icms)}
                    </td>
                    <td class="col-simples_ipi px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                        ${format(f.simples_ipi)}
                    </td>
                    <td class="col-simples_iss px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                        ${format(f.simples_iss)}
                    </td>
                    <td class="col-simples_pis px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                        ${format(f.simples_pis)}
                    </td>
                    <td class="col-simples_cofins px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                        ${format(f.simples_cofins)}
                    </td>
                    <td class="col-simples_irpj px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                        ${format(f.simples_irpj)}
                    </td>
                    <td class="col-simples_csll px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                        ${format(f.simples_csll)}
                    </td>
                    <td class="col-simples_faturamento_acumulado_12m px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                        ${format(f.simples_faturamento_acumulado_12m)}
                    </td>
                    <td class="col-simples_faturamento_acumulado_ano_anterior px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                        ${format(f.simples_faturamento_acumulado_ano_anterior)}
                    </td>
                    <td class="col-simples_valor_tributado px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                        ${format(f.simples_valor_tributado)}
                    </td>
                    <td class="col-simples_valor_nao_tributado px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                        ${format(f.simples_valor_nao_tributado)}
                    </td>
                    <td class="col-acoes px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div class="flex items-center justify-end gap-3">
                            <button type="button" class="btn-edit text-brand-600 hover:text-brand-900 dark:text-brand-400 dark:hover:text-brand-300" data-public-id="${f.public_id}" title="Editar">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                            </button>
                            <button type="button" class="btn-delete text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300" data-public-id="${f.public_id}" title="Excluir">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
        
        // Add event listeners to edit and delete buttons
        fechamentosTable.querySelectorAll('.btn-edit').forEach((btn: any) => {
            btn.addEventListener('click', () => {
                const publicId = btn.getAttribute('data-public-id');
                editFechamento(publicId);
            });
        });
        
        fechamentosTable.querySelectorAll('.btn-delete').forEach((btn: any) => {
            btn.addEventListener('click', () => {
                const publicId = btn.getAttribute('data-public-id');
                deleteFechamento(publicId);
            });
        });

        // Add event listeners to row checkboxes to update selectAll state
        const rowCheckboxes = fechamentosTable.querySelectorAll('.row-checkbox') as NodeListOf<HTMLInputElement>;
        rowCheckboxes.forEach(cb => {
            cb.addEventListener('change', () => {
                if (selectAll) {
                    const allChecked = Array.from(rowCheckboxes).every(r => r.checked);
                    selectAll.checked = allChecked;
                }
            });
        });

        // Apply visibility rules to new rows
        applyColumnVisibility();
    }

    function editFechamento(publicId: string) {
        currentImportCfopTotals = null;
        currentImportTotals = null;
        const fechamento = loadedFechamentos.find(f => f.public_id === publicId);
        if (!fechamento) return;
        
        currentFechamentoPublicId = publicId;
        const modalTitle = document.getElementById('modalTitle');
        if (modalTitle) modalTitle.textContent = 'Editar Fechamento';
        
        // Open modal
        fechamentoModal.classList.remove('hidden');
        switchTab('compra');
        
        // Fill in fields
        const selectedCustomer = allCustomers.find(c => String(c.id) === String(fechamento.customer_id));
        if (modalCustomerGroup) {
            modalCustomerGroup.value = selectedCustomer?.customer_group_id ? String(selectedCustomer.customer_group_id) : '';
        }
        if (selectedCustomer?.customer_group_id) {
            const filtered = allCustomers.filter(c => String(c.customer_group_id) === String(selectedCustomer.customer_group_id));
            populateCustomersSelect(filtered);
        } else {
            populateCustomersSelect(allCustomers);
        }
        companyParam.value = fechamento.customer_id.toString();
        updateCustomerTypeIndicator(fechamento.customer_id.toString());
        const competenciaInput = document.getElementById('competencia') as HTMLInputElement;
        if (competenciaInput) competenciaInput.value = fechamento.competencia;
        
        const formatValue = (val: number) => {
            if (val === 0) return '';
            return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
        };
        
        const setVal = (id: string, val: number) => {
            const el = document.getElementById(id) as HTMLInputElement;
            if (el) {
                el.value = formatValue(val);
            }
        };
        
        setVal('compra_valor', fechamento.compra_valor);
        setVal('compra_bs_icms', fechamento.compra_bs_icms);
        setVal('compra_isento', fechamento.compra_isento);
        setVal('compra_outros', fechamento.compra_outros);
        setVal('compra_pis', fechamento.compra_pis);
        setVal('compra_cofins', fechamento.compra_cofins);
        
        setVal('venda_valor', fechamento.venda_valor);
        setVal('venda_bs_icms', fechamento.venda_bs_icms);
        setVal('venda_isento', fechamento.venda_isento);
        setVal('venda_outros', fechamento.venda_outros);
        setVal('venda_pis', fechamento.venda_pis);
        setVal('venda_cofins', fechamento.venda_cofins);
        
        setVal('apuracao_icms', fechamento.apuracao_icms);
        setVal('apuracao_fecp', (fechamento as any).apuracao_fecp);
        setVal('apuracao_pis', fechamento.apuracao_pis);
        setVal('apuracao_cofins', fechamento.apuracao_cofins);
        setVal('apuracao_aj_icms', (fechamento as any).apuracao_aj_icms);
        setVal('apuracao_aj_fecp', (fechamento as any).apuracao_aj_fecp);
        setVal('apuracao_aj_pis', (fechamento as any).apuracao_aj_pis);
        setVal('apuracao_aj_cofins', (fechamento as any).apuracao_aj_cofins);
        calculateF();
        
        setVal('despesa_adm', fechamento.despesa_adm);
        setVal('despesa_operacional', fechamento.despesa_operacional);
        setVal('despesa_folha', fechamento.despesa_folha);
        setVal('despesa_cmv', fechamento.despesa_cmv);
        setVal('despesa_ir_aluguel', fechamento.despesa_ir_aluguel);
        
        setVal('imposto_irpj', fechamento.imposto_irpj);
        setVal('imposto_csll', fechamento.imposto_csll);

        setVal('simples_faturamento', (fechamento as any).simples_faturamento);
        const aliquotaEl = document.getElementById('simples_aliquota') as HTMLInputElement;
        if (aliquotaEl) {
            const val = (fechamento as any).simples_aliquota || 0;
            aliquotaEl.value = val === 0 ? '' : new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val) + ' %';
        }
        setVal('simples_das', (fechamento as any).simples_das);
        setVal('simples_valor_tributado', (fechamento as any).simples_valor_tributado);
        setVal('simples_valor_nao_tributado', (fechamento as any).simples_valor_nao_tributado);
        setVal('simples_faturamento_acumulado_12m', (fechamento as any).simples_faturamento_acumulado_12m);
        setVal('simples_faturamento_acumulado_ano_anterior', (fechamento as any).simples_faturamento_acumulado_ano_anterior);
        setVal('simples_cpp', (fechamento as any).simples_cpp);
        setVal('simples_icms', (fechamento as any).simples_icms);
        setVal('simples_ipi', (fechamento as any).simples_ipi);
        setVal('simples_iss', (fechamento as any).simples_iss);
        setVal('simples_pis', (fechamento as any).simples_pis);
        setVal('simples_cofins', (fechamento as any).simples_cofins);
        setVal('simples_irpj', (fechamento as any).simples_irpj);
        setVal('simples_csll', (fechamento as any).simples_csll);

        const observacaoEl = document.getElementById('observacao') as HTMLTextAreaElement;
        if (observacaoEl) {
            observacaoEl.value = (fechamento as any).observacao || '';
        }
    }

    async function deleteFechamento(publicId: string) {
        if (!confirm('Tem certeza que deseja excluir este fechamento?')) {
            return;
        }
        
        try {
            await api(`/fechamentos/${publicId}`, {
                method: 'DELETE'
            });
            showAlert('Fechamento excluído com sucesso!');
            loadFechamentos();
        } catch (error) {
            console.error('Erro ao excluir fechamento:', error);
            showAlert('Erro ao excluir fechamento. Verifique o console.', true);
        }
    }

    function openModal() {
        currentImportCfopTotals = null;
        currentImportTotals = null;
        clearImportFeedback();
        fechamentoModal.classList.remove('hidden');
        fechamentoForm.reset();
        if (modalCustomerGroup) {
            modalCustomerGroup.value = '';
        }
        if (companyTypeIndicator) {
            companyTypeIndicator.classList.add('hidden');
            companyTypeIndicator.classList.remove('inline-flex');
        }
        updateCustomerTypeIndicator('');
        populateCustomersSelect(allCustomers);
        calculateF();
        switchTab('compra');
    }

    function closeModal() {
        clearImportFeedback();
        fechamentoModal.classList.add('hidden');
    }

    function switchTab(tab: 'compra' | 'venda' | 'apuracao' | 'despesa' | 'imposto' | 'simples' | 'observacao') {
        [tabCompraBtn, tabVendaBtn, tabApuracaoBtn, tabDespesaBtn, tabImpostoBtn, tabSimplesBtn, tabObservacaoBtn].forEach(btn => {
            if (btn) {
                btn.classList.add('border-transparent', 'text-gray-500', 'dark:text-gray-400');
                btn.classList.remove('border-brand-500', 'text-brand-600', 'dark:text-brand-300');
            }
        });
        [tabCompraPanel, tabVendaPanel, tabApuracaoPanel, tabDespesaPanel, tabImpostoPanel, tabSimplesPanel, tabObservacaoPanel].forEach(panel => {
            if (panel) panel.classList.add('hidden');
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
        } else if (tab === 'despesa') {
            tabDespesaBtn.classList.remove('border-transparent', 'text-gray-500', 'dark:text-gray-400');
            tabDespesaBtn.classList.add('border-brand-500', 'text-brand-600', 'dark:text-brand-300');
            tabDespesaPanel.classList.remove('hidden');
        } else if (tab === 'imposto') {
            tabImpostoBtn.classList.remove('border-transparent', 'text-gray-500', 'dark:text-gray-400');
            tabImpostoBtn.classList.add('border-brand-500', 'text-brand-600', 'dark:text-brand-300');
            tabImpostoPanel.classList.remove('hidden');
        } else if (tab === 'simples') {
            tabSimplesBtn.classList.remove('border-transparent', 'text-gray-500', 'dark:text-gray-400');
            tabSimplesBtn.classList.add('border-brand-500', 'text-brand-600', 'dark:text-brand-300');
            tabSimplesPanel.classList.remove('hidden');
        } else if (tab === 'observacao') {
            tabObservacaoBtn.classList.remove('border-transparent', 'text-gray-500', 'dark:text-gray-400');
            tabObservacaoBtn.classList.add('border-brand-500', 'text-brand-600', 'dark:text-brand-300');
            tabObservacaoPanel.classList.remove('hidden');
        }
    }

    function showAlert(message: string, isError = false) {
        alertMessage.textContent = message;
        alertMessage.className = `mx-4 sm:mx-0 mb-4 p-4 rounded-xl text-sm ${isError ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300' : 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300'}`;
        alertMessage.classList.remove('hidden');
        setTimeout(() => alertMessage.classList.add('hidden'), 5000);
    }

    function showImportFeedback(message: string, type: 'success' | 'warning' | 'error', details = '') {
        const container = document.getElementById('importFeedbackContainer');
        const iconContainer = document.getElementById('importFeedbackIcon');
        const textElement = document.getElementById('importFeedbackText');
        const detailsElement = document.getElementById('importFeedbackDetails');

        if (!container || !iconContainer || !textElement || !detailsElement) return;

        container.className = 'mt-4 p-3 rounded-lg border text-sm flex items-start gap-2.5 transition-all';
        
        let iconHtml = '';
        if (type === 'success') {
            container.classList.add('border-emerald-200', 'bg-emerald-50', 'text-emerald-800', 'dark:border-emerald-800/30', 'dark:bg-emerald-950/20', 'dark:text-emerald-300');
            iconHtml = `
                <svg class="h-5 w-5 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            `;
        } else if (type === 'warning') {
            container.classList.add('border-amber-200', 'bg-amber-50', 'text-amber-800', 'dark:border-amber-800/30', 'dark:bg-amber-950/20', 'dark:text-amber-300');
            iconHtml = `
                <svg class="h-5 w-5 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
            `;
        } else {
            container.classList.add('border-red-200', 'bg-red-50', 'text-red-800', 'dark:border-red-800/30', 'dark:bg-red-950/20', 'dark:text-red-300');
            iconHtml = `
                <svg class="h-5 w-5 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            `;
        }

        iconContainer.innerHTML = iconHtml;
        textElement.textContent = message;
        
        if (details) {
            detailsElement.textContent = details;
            detailsElement.classList.remove('hidden');
        } else {
            detailsElement.textContent = '';
            detailsElement.classList.add('hidden');
        }

        container.classList.remove('hidden');
    }

    function clearImportFeedback() {
        const container = document.getElementById('importFeedbackContainer');
        if (container) container.classList.add('hidden');
    }

    const btnDismissImportFeedback = document.getElementById('btnDismissImportFeedback');
    if (btnDismissImportFeedback) {
        btnDismissImportFeedback.addEventListener('click', clearImportFeedback);
    }

    // Event Listeners
    btnOpenModal.addEventListener('click', () => {
        currentFechamentoPublicId = null;
        const modalTitle = document.getElementById('modalTitle');
        if (modalTitle) modalTitle.textContent = 'Lançar Fechamento';
        openModal();
    });
    btnCancelModal.addEventListener('click', closeModal);
    modalBackdrop.addEventListener('click', closeModal);

    // Event Listeners for Filters
    let filterIsOpen = false;
    if (toggleFilterBtn && filterBody) {
        filterBody.style.maxHeight = '0px';
        filterBody.style.overflow = 'hidden';
        if (filterChevron) filterChevron.style.transform = 'rotate(-90deg)';
        
        toggleFilterBtn.addEventListener('click', () => {
            filterIsOpen = !filterIsOpen;
            filterBody.style.maxHeight = filterIsOpen ? `${filterBody.scrollHeight || 500}px` : '0px';
            if (filterChevron) {
                filterChevron.style.transform = filterIsOpen ? 'rotate(0deg)' : 'rotate(-90deg)';
            }
            saveFilters();
        });
    }

    if (filterCompanyParam) {
        filterCompanyParam.addEventListener('change', () => {
            saveFilters();
        });
    }

    if (filterCustomerGroup) {
        filterCustomerGroup.addEventListener('change', () => {
            saveFilters();
        });
    }

    if (filterCompetencia) {
        filterCompetencia.addEventListener('change', () => {
            saveFilters();
        });
    }

    if (filterForm) {
        filterForm.addEventListener('submit', (e) => {
            e.preventDefault();
            saveFilters();
            loadFechamentos();
        });
    }

    if (btnClearFilters) {
        btnClearFilters.addEventListener('click', () => {
            if (filterForm) filterForm.reset();
            saveFilters();
            loadFechamentos();
        });
    }

    tabCompraBtn.addEventListener('click', () => switchTab('compra'));
    tabVendaBtn.addEventListener('click', () => switchTab('venda'));
    tabApuracaoBtn.addEventListener('click', () => switchTab('apuracao'));
    tabDespesaBtn.addEventListener('click', () => switchTab('despesa'));
    tabImpostoBtn.addEventListener('click', () => switchTab('imposto'));
    tabSimplesBtn.addEventListener('click', () => switchTab('simples'));
    tabObservacaoBtn.addEventListener('click', () => switchTab('observacao'));

    fechamentoForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (!companyParam.value) {
            alert('Por favor, selecione a empresa.');
            return;
        }

        const formData = new FormData(fechamentoForm);
        
        const payload = {
            customerId: formData.get('customerId'),
            competencia: formData.get('competencia'),
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
                fecp: parseCurrency(formData.get('apuracao_fecp') as string),
                pis: parseCurrency(formData.get('apuracao_pis') as string),
                cofins: parseCurrency(formData.get('apuracao_cofins') as string),
                aj_icms: parseCurrency(formData.get('apuracao_aj_icms') as string),
                aj_fecp: parseCurrency(formData.get('apuracao_aj_fecp') as string),
                aj_pis: parseCurrency(formData.get('apuracao_aj_pis') as string),
                aj_cofins: parseCurrency(formData.get('apuracao_aj_cofins') as string),
            },
            despesa: {
                adm: parseCurrency(formData.get('despesa_adm') as string),
                operacional: parseCurrency(formData.get('despesa_operacional') as string),
                folha: parseCurrency(formData.get('despesa_folha') as string),
                cmv: parseCurrency(formData.get('despesa_cmv') as string),
                ir_aluguel: parseCurrency(formData.get('despesa_ir_aluguel') as string),
            },
            imposto_federal: {
                irpj: parseCurrency(formData.get('imposto_irpj') as string),
                csll: parseCurrency(formData.get('imposto_csll') as string),
            },
            simples: {
                faturamento: parseCurrency(formData.get('simples_faturamento') as string),
                aliquota: parseCurrency(formData.get('simples_aliquota') as string),
                das: parseCurrency(formData.get('simples_das') as string),
                cpp: parseCurrency(formData.get('simples_cpp') as string),
                icms: parseCurrency(formData.get('simples_icms') as string),
                ipi: parseCurrency(formData.get('simples_ipi') as string),
                iss: parseCurrency(formData.get('simples_iss') as string),
                pis: parseCurrency(formData.get('simples_pis') as string),
                cofins: parseCurrency(formData.get('simples_cofins') as string),
                irpj: parseCurrency(formData.get('simples_irpj') as string),
                csll: parseCurrency(formData.get('simples_csll') as string),
                faturamento_acumulado_12m: parseCurrency(formData.get('simples_faturamento_acumulado_12m') as string),
                faturamento_acumulado_ano_anterior: parseCurrency(formData.get('simples_faturamento_acumulado_ano_anterior') as string),
                valor_tributado: parseCurrency(formData.get('simples_valor_tributado') as string),
                valor_nao_tributado: parseCurrency(formData.get('simples_valor_nao_tributado') as string),
            },
            observacao: formData.get('observacao') as string || null
        };

        try {
            const url = currentFechamentoPublicId 
                ? `/fechamentos/${currentFechamentoPublicId}` 
                : '/fechamentos';
            
            const method = currentFechamentoPublicId ? 'PUT' : 'POST';
            
            await api(url, {
                method,
                body: JSON.stringify(payload),
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            showAlert(currentFechamentoPublicId 
                ? 'Fechamento atualizado com sucesso!' 
                : 'Fechamento lançado com sucesso!'
            );
            closeModal();
            loadFechamentos();
        } catch (error: any) {
            console.error('Erro ao salvar fechamento:', error);
            const errorMsg = error?.message || 'Erro ao salvar o fechamento. Verifique o console.';
            showAlert(errorMsg, true);
        }
    });

    const xmlFileInput = document.getElementById('xmlFileInput') as HTMLInputElement | null;
    if (xmlFileInput) {
        xmlFileInput.addEventListener('change', async (e) => {
            const files = xmlFileInput.files;
            if (!files || files.length === 0) return;

            const customerId = companyParam.value;
            if (!customerId) {
                showImportFeedback('Por favor, selecione um cliente antes de importar as notas.', 'error');
                xmlFileInput.value = '';
                return;
            }

            const xmlPromises: Promise<string>[] = [];
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                xmlPromises.push(new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result as string);
                    reader.onerror = reject;
                    reader.readAsText(file);
                }));
            }

            const progressOverlay = document.createElement('div');
            progressOverlay.id = 'importProgressModal';
            progressOverlay.className = 'fixed inset-0 z-[100000] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm';
            progressOverlay.innerHTML = `
                <div class="bg-white dark:bg-slate-800 rounded-xl shadow-2xl p-6 w-full max-w-md border border-gray-100 dark:border-slate-700">
                    <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100 mb-2">Importando Notas Fiscais</h3>
                    <p id="importProgressText" class="text-sm text-gray-500 dark:text-gray-400 mb-4">Lendo arquivos...</p>
                    <div class="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-2.5 mb-2 overflow-hidden">
                        <div id="importProgressBar" class="bg-brand-600 h-2.5 rounded-full transition-all duration-300" style="width: 0%"></div>
                    </div>
                    <div class="text-right">
                        <span id="importProgressPercent" class="text-xs font-semibold text-brand-600 dark:text-brand-400">0%</span>
                    </div>
                </div>
            `;
            document.body.appendChild(progressOverlay);

            const progressText = document.getElementById('importProgressText')!;
            const progressBar = document.getElementById('importProgressBar')!;
            const progressPercent = document.getElementById('importProgressPercent')!;

            try {
                const xmls = await Promise.all(xmlPromises);
                
                const aggregatedTotals = {
                    venda_valor: 0,
                    venda_bs_icms: 0,
                    venda_isento: 0,
                    venda_outros: 0,
                    venda_pis: 0,
                    venda_cofins: 0,
                    simples_valor_tributado: 0,
                    simples_valor_nao_tributado: 0
                };
                const cfopTotals: Record<string, number> = {};
                let totalImportedCount = 0;
                const allErrors: string[] = [];

                const totalFiles = xmls.length;

                for (let idx = 0; idx < totalFiles; idx++) {
                    const currentXml = xmls[idx];
                    
                    progressText.textContent = `Processando arquivo ${idx + 1} de ${totalFiles}...`;
                    const percent = Math.round(((idx + 1) / totalFiles) * 100);
                    progressBar.style.width = `${percent}%`;
                    progressPercent.textContent = `${percent}%`;

                    try {
                        const response = await api('/fechamentos/import-sales-xml', {
                            method: 'POST',
                            body: JSON.stringify({
                                customerId: Number(customerId),
                                xmls: [currentXml]
                            }),
                            headers: {
                                'Content-Type': 'application/json'
                            }
                        });

                        if (response && response.status === 'success' && response.data) {
                            const data = response.data;
                            
                            aggregatedTotals.venda_valor += (data.totals.venda_valor || 0);
                            aggregatedTotals.venda_bs_icms += (data.totals.venda_bs_icms || 0);
                            aggregatedTotals.venda_isento += (data.totals.venda_isento || 0);
                            aggregatedTotals.venda_outros += (data.totals.venda_outros || 0);
                            aggregatedTotals.venda_pis += (data.totals.venda_pis || 0);
                            aggregatedTotals.venda_cofins += (data.totals.venda_cofins || 0);
                            aggregatedTotals.simples_valor_tributado += (data.totals.simples_valor_tributado || 0);
                            aggregatedTotals.simples_valor_nao_tributado += (data.totals.simples_valor_nao_tributado || 0);

                            if (data.cfopTotals) {
                                for (const [cfop, val] of Object.entries(data.cfopTotals)) {
                                    cfopTotals[cfop] = (cfopTotals[cfop] || 0) + (val as number);
                                }
                            }

                            totalImportedCount += (data.importedCount || 0);
                            if (data.errors && data.errors.length > 0) {
                                allErrors.push(...data.errors);
                            }
                        } else {
                            const errorMsg = response?.message || 'Erro de resposta';
                            if (errorMsg.includes('não está cadastrado') || errorMsg.includes('não cadastrado')) {
                                throw new Error(errorMsg);
                            }
                            allErrors.push(`Erro no arquivo ${idx + 1}: ${errorMsg}`);
                        }
                    } catch (err: any) {
                        const errorMsg = err.message || String(err);
                        if (errorMsg.includes('não está cadastrado') || errorMsg.includes('não cadastrado')) {
                            throw err;
                        }
                        allErrors.push(`Erro no arquivo ${idx + 1}: ${errorMsg}`);
                    }
                }

                progressBar.style.width = '100%';
                progressPercent.textContent = '100%';
                progressText.textContent = 'Finalizando importação...';

                currentImportCfopTotals = cfopTotals;
                currentImportTotals = aggregatedTotals;

                const formatBRL = (val: number) => {
                    if (val === 0) return '';
                    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
                };

                const setFieldValue = (id: string, val: number) => {
                    const el = document.getElementById(id) as HTMLInputElement;
                    if (el) el.value = formatBRL(val);
                };

                setFieldValue('venda_valor', aggregatedTotals.venda_valor);
                setFieldValue('venda_bs_icms', aggregatedTotals.venda_bs_icms);
                setFieldValue('venda_isento', aggregatedTotals.venda_isento);
                setFieldValue('venda_outros', aggregatedTotals.venda_outros);
                setFieldValue('venda_pis', aggregatedTotals.venda_pis);
                setFieldValue('venda_cofins', aggregatedTotals.venda_cofins);
                
                setFieldValue('simples_valor_tributado', aggregatedTotals.simples_valor_tributado);
                setFieldValue('simples_valor_nao_tributado', aggregatedTotals.simples_valor_nao_tributado);

                calculateF();
                calculateSimples();

                const observacaoEl = document.getElementById('observacao') as HTMLTextAreaElement | null;
                if (observacaoEl && !observacaoEl.value) {
                    observacaoEl.value = 'Importado via XML de Vendas';
                }

                let message = `Importação concluída! Processado(s) ${totalFiles} arquivo(s).`;
                if (totalImportedCount > 0) {
                    message += ` ${totalImportedCount} venda(s) registrada(s) no banco de dados da empresa.`;
                }
                if (allErrors.length > 0) {
                    message += `\n\nAlguns arquivos apresentaram avisos:\n` + allErrors.slice(0, 5).join('\n');
                    if (allErrors.length > 5) {
                        message += `\n... e mais ${allErrors.length - 5} aviso(s).`;
                    }
                }
                
                if (allErrors.length > 0) {
                    const warnDetails = allErrors.slice(0, 5).join('\n') + (allErrors.length > 5 ? `\n... e mais ${allErrors.length - 5} aviso(s).` : '');
                    showImportFeedback(message, 'warning', warnDetails);
                } else {
                    showImportFeedback(message, 'success');
                }

            } catch (err: any) {
                console.error('Erro na importação de XMLs:', err);
                showImportFeedback(err.message || 'Erro ao processar importação de XMLs.', 'error');
            } finally {
                if (document.body.contains(progressOverlay)) {
                    document.body.removeChild(progressOverlay);
                }
                xmlFileInput.value = '';
            }
        });
    }

    const spedFileInput = document.getElementById('spedFileInput') as HTMLInputElement | null;
    if (spedFileInput) {
        spedFileInput.addEventListener('change', async (e) => {
            const files = spedFileInput.files;
            if (!files || files.length === 0) return;

            const customerId = companyParam.value;
            if (!customerId) {
                showImportFeedback('Por favor, selecione um cliente antes de importar o SPED.', 'error');
                spedFileInput.value = '';
                return;
            }

            const file = files[0]!;
            const reader = new FileReader();

            const progressOverlay = document.createElement('div');
            progressOverlay.id = 'importProgressModal';
            progressOverlay.className = 'fixed inset-0 z-[100000] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm';
            progressOverlay.innerHTML = `
                <div class="bg-white dark:bg-slate-800 rounded-xl shadow-2xl p-6 w-full max-w-md border border-gray-100 dark:border-slate-700">
                    <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100 mb-2">Importando SPED Fiscal</h3>
                    <p id="importProgressText" class="text-sm text-gray-500 dark:text-gray-400 mb-4">Processando arquivo localmente...</p>
                    <div class="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-2.5 mb-2 overflow-hidden">
                        <div id="importProgressBar" class="bg-brand-600 h-2.5 rounded-full transition-all duration-300" style="width: 100%"></div>
                    </div>
                </div>
            `;
            document.body.appendChild(progressOverlay);

            reader.onload = async () => {
                try {
                    const fileContent = reader.result as string;
                    
                    const response = await api('/fechamentos/import-sped-fiscal', {
                        method: 'POST',
                        body: JSON.stringify({
                            customerId,
                            fileContent
                        })
                    });

                    if (response.status === 'error') {
                        throw new Error(response.message || 'Erro ao processar arquivo SPED.');
                    }

                    const { totals, cfopTotals } = response.data;

                    const formatBRL = (val: number) => {
                        if (val === 0) return '';
                        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
                    };

                    const setFieldValue = (id: string, val: number) => {
                        const el = document.getElementById(id) as HTMLInputElement;
                        if (el) el.value = formatBRL(val);
                    };

                    setFieldValue('venda_valor', totals.venda_valor);
                    setFieldValue('venda_bs_icms', totals.venda_bs_icms);
                    setFieldValue('venda_isento', totals.venda_isento);
                    setFieldValue('venda_outros', totals.venda_outros);
                    setFieldValue('venda_pis', totals.venda_pis);
                    setFieldValue('venda_cofins', totals.venda_cofins);
                    
                    setFieldValue('compra_valor', totals.compra_valor);
                    setFieldValue('compra_bs_icms', totals.compra_bs_icms);
                    setFieldValue('compra_isento', totals.compra_isento);
                    setFieldValue('compra_outros', totals.compra_outros);
                    setFieldValue('compra_pis', totals.compra_pis);
                    setFieldValue('compra_cofins', totals.compra_cofins);
                    
                    setFieldValue('simples_valor_tributado', totals.simples_valor_tributado);
                    setFieldValue('simples_valor_nao_tributado', totals.simples_valor_nao_tributado);

                    setFieldValue('apuracao_icms', totals.apuracao_icms || 0);
                    setFieldValue('apuracao_fecp', totals.apuracao_fecp || 0);

                    currentImportCfopTotals = cfopTotals;
                    currentImportTotals = totals;

                    calculateF();
                    calculateSimples();

                    const observacaoEl = document.getElementById('observacao') as HTMLTextAreaElement | null;
                    if (observacaoEl && !observacaoEl.value) {
                        observacaoEl.value = 'Importado via SPED Fiscal EFD';
                    }

                    showImportFeedback('Importação do SPED Fiscal concluída com sucesso!', 'success');
                } catch (err: any) {
                    console.error('Erro na importação de SPED:', err);
                    showImportFeedback(err.message || 'Erro ao processar arquivo SPED.', 'error');
                } finally {
                    if (document.body.contains(progressOverlay)) {
                        document.body.removeChild(progressOverlay);
                    }
                    spedFileInput.value = '';
                }
            };

            reader.onerror = () => {
                showImportFeedback('Erro ao ler arquivo local.', 'error');
                if (document.body.contains(progressOverlay)) {
                    document.body.removeChild(progressOverlay);
                }
                spedFileInput.value = '';
            };

            reader.readAsText(file);
        });
    }

    const btnClearImport = document.getElementById('btnClearImport') as HTMLButtonElement | null;
    if (btnClearImport) {
        btnClearImport.addEventListener('click', () => {
            const formatBRL = (val: number) => {
                if (val === 0) return '';
                return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
            };

            const setFieldValue = (id: string, val: number) => {
                const el = document.getElementById(id) as HTMLInputElement;
                if (el) el.value = formatBRL(val);
            };

            setFieldValue('venda_valor', 0);
            setFieldValue('venda_bs_icms', 0);
            setFieldValue('venda_isento', 0);
            setFieldValue('venda_outros', 0);
            setFieldValue('venda_pis', 0);
            setFieldValue('venda_cofins', 0);
            
            setFieldValue('simples_valor_tributado', 0);
            setFieldValue('simples_valor_nao_tributado', 0);

            currentImportCfopTotals = {};
            currentImportTotals = null;

            calculateF();
            calculateSimples();

            showImportFeedback('Movimento importado apagado com sucesso!', 'success');
        });
    }

    const columnCheckboxes = document.querySelectorAll('input[data-column-target]') as NodeListOf<HTMLInputElement>;
    const btnToggleColumns = document.getElementById('btnToggleColumns') as HTMLButtonElement;
    const columnsDropdownMenu = document.getElementById('columnsDropdownMenu') as HTMLElement;
    const STORAGE_KEY = 'erp_fechamentos_columns_visibility';

    function saveColumnVisibility() {
        const preferences: Record<string, boolean> = {};
        columnCheckboxes.forEach(cb => {
            const target = cb.getAttribute('data-column-target');
            if (target) {
                preferences[target] = cb.checked;
            }
        });
        if ((window as any).CompanyStorage) {
            (window as any).CompanyStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
        } else {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
        }
    }

    function loadColumnVisibility() {
        try {
            const saved = (window as any).CompanyStorage?.getItem(STORAGE_KEY) ?? localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const preferences = JSON.parse(saved);
                columnCheckboxes.forEach(cb => {
                    const target = cb.getAttribute('data-column-target');
                    if (target && target in preferences) {
                        cb.checked = preferences[target];
                    }
                });
            }
        } catch (e) {
            console.error('Erro ao carregar preferências de colunas:', e);
        }
    }

    function applyColumnVisibility() {
        columnCheckboxes.forEach(cb => {
            const target = cb.getAttribute('data-column-target');
            const elements = document.querySelectorAll(`.col-${target}`);
            elements.forEach(el => {
                if (cb.checked) {
                    el.classList.remove('hidden');
                } else {
                    el.classList.add('hidden');
                }
            });
        });
    }

    columnCheckboxes.forEach(cb => {
        cb.addEventListener('change', () => {
            saveColumnVisibility();
            applyColumnVisibility();
        });
    });

    if (btnToggleColumns && columnsDropdownMenu) {
        btnToggleColumns.addEventListener('click', (e) => {
            e.stopPropagation();
            columnsDropdownMenu.classList.toggle('hidden');
        });

        document.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            if (!columnsDropdownMenu.contains(target) && target !== btnToggleColumns) {
                columnsDropdownMenu.classList.add('hidden');
            }
        });
    }

    if (selectAll) {
        selectAll.addEventListener('change', () => {
            const rowCheckboxes = fechamentosTable.querySelectorAll('.row-checkbox') as NodeListOf<HTMLInputElement>;
            rowCheckboxes.forEach(cb => {
                cb.checked = selectAll.checked;
            });
        });
    }

    // CFOP Modal Event Listeners
    const btnViewXmlSummary = document.getElementById('btnViewXmlSummary');
    const cfopSummaryModal = document.getElementById('cfopSummaryModal');
    const btnCloseCfopModal = document.getElementById('btnCloseCfopModal');
    const btnCloseCfopModalBottom = document.getElementById('btnCloseCfopModalBottom');
    const closeCfopModalBackdrop = document.getElementById('closeCfopModalBackdrop');

    const escapeHtml = (str: string) => {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    };

    const formatCurrencyBRL = (val: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
    };

    if (btnViewXmlSummary && cfopSummaryModal) {
        btnViewXmlSummary.addEventListener('click', () => {
            let totalsToDisplay = currentImportTotals;
            
            // If no active session import totals, fallback to values in the form inputs
            if (!totalsToDisplay) {
                const parseField = (id: string) => {
                    const el = document.getElementById(id) as HTMLInputElement | null;
                    return el ? parseCurrency(el.value) : 0;
                };
                
                totalsToDisplay = {
                    venda_valor: parseField('venda_valor'),
                    venda_bs_icms: parseField('venda_bs_icms'),
                    venda_isento: parseField('venda_isento'),
                    venda_outros: parseField('venda_outros')
                };
            }

            // If still no values (all zero), show warning
            if (totalsToDisplay.venda_valor === 0 && totalsToDisplay.venda_bs_icms === 0 && 
                totalsToDisplay.venda_isento === 0 && totalsToDisplay.venda_outros === 0) {
                showAlert('Nenhum valor de notas de saída foi importado ou preenchido.', true);
                return;
            }

            // Populate Totais
            const totalValorEl = document.getElementById('cfopModalTotalValor');
            const totalBCEl = document.getElementById('cfopModalTotalBC');
            const totalIsentoEl = document.getElementById('cfopModalTotalIsento');
            const totalOutrosEl = document.getElementById('cfopModalTotalOutros');

            if (totalValorEl) totalValorEl.textContent = formatCurrencyBRL(totalsToDisplay.venda_valor);
            if (totalBCEl) totalBCEl.textContent = formatCurrencyBRL(totalsToDisplay.venda_bs_icms);
            if (totalIsentoEl) totalIsentoEl.textContent = formatCurrencyBRL(totalsToDisplay.venda_isento);
            if (totalOutrosEl) totalOutrosEl.textContent = formatCurrencyBRL(totalsToDisplay.venda_outros);

            // Populate Table
            const tbody = document.getElementById('cfopTableBody');
            if (tbody) {
                if (currentImportCfopTotals && Object.keys(currentImportCfopTotals).length > 0) {
                    tbody.innerHTML = Object.entries(currentImportCfopTotals)
                        .map(([cfop, val]) => `
                            <tr>
                                <td class="px-4 py-2 font-medium text-gray-900 dark:text-gray-150">${escapeHtml(cfop)}</td>
                                <td class="px-4 py-2 text-right font-semibold text-gray-950 dark:text-gray-50">${formatCurrencyBRL(val)}</td>
                            </tr>
                        `).join('');
                } else {
                    tbody.innerHTML = `
                        <tr>
                            <td colspan="2" class="px-4 py-3 text-center text-xs text-gray-400 italic">
                                Detalhamento por CFOP indisponível (disponível apenas imediatamente após a importação de XMLs).
                            </td>
                        </tr>
                    `;
                }
            }

            // Open Modal
            cfopSummaryModal.classList.remove('hidden');
        });
    }

    const closeCfopModal = () => {
        if (cfopSummaryModal) cfopSummaryModal.classList.add('hidden');
    };

    if (btnCloseCfopModal) btnCloseCfopModal.addEventListener('click', closeCfopModal);
    if (btnCloseCfopModalBottom) btnCloseCfopModalBottom.addEventListener('click', closeCfopModal);
    if (closeCfopModalBackdrop) closeCfopModalBackdrop.addEventListener('click', closeCfopModal);

    function sortFechamentos(field: string) {
        if (currentSortField === field) {
            currentSortAsc = !currentSortAsc;
        } else {
            currentSortField = field;
            currentSortAsc = true;
        }

        saveSort();
        applySort(loadedFechamentos);
        renderFechamentosTable(loadedFechamentos);
        updateHeaderSortIcons();
    }

    function updateHeaderSortIcons() {
        document.querySelectorAll('.sortable-header').forEach((th: any) => {
            const field = th.getAttribute('data-sort');
            const iconEl = th.querySelector('.sort-icon');
            if (iconEl) {
                if (field === currentSortField) {
                    iconEl.textContent = currentSortAsc ? ' ▲' : ' ▼';
                    iconEl.classList.remove('text-gray-400');
                    iconEl.classList.add('text-brand-600', 'dark:text-brand-400');
                } else {
                    iconEl.textContent = ' ↕';
                    iconEl.classList.remove('text-brand-600', 'dark:text-brand-400');
                    iconEl.classList.add('text-gray-400');
                }
            }
        });
    }

    // Sort Event Listeners
    document.querySelectorAll('.sortable-header').forEach((th: any) => {
        th.addEventListener('click', () => {
            const field = th.getAttribute('data-sort');
            if (field) {
                sortFechamentos(field);
            }
        });
    });

    // Initialize
    loadColumnVisibility();
    applyColumnVisibility();
    loadSavedSort();
    updateHeaderSortIcons();

    const savedFilters = getSavedFilters();
    if (savedFilters) {
        if (filterCompetencia && savedFilters.competencia) {
            filterCompetencia.value = savedFilters.competencia;
        }
        if (savedFilters.filterIsOpen) {
            filterIsOpen = true;
            if (filterBody) {
                filterBody.style.maxHeight = '500px';
            }
            if (filterChevron) {
                filterChevron.style.transform = 'rotate(0deg)';
            }
        }
    }

    await Promise.all([
        loadCustomers(savedFilters?.customerId),
        loadCustomerGroups(savedFilters?.customerGroupId)
    ]);
    await loadFechamentos();
});
