// Keystone ERP - Declaração de Faturamento
// Gerenciamento de documento fiscal/cadastral com preenchimento dinâmico, máscara de moeda e cálculo em tempo real

// @ts-nocheck
(() => {
    const win = window as any;

    // Memória para manter os valores editados por competência (mes-ano)
    const memoriaValores: Record<string, string> = {};
    const mesesNomes: string[] = [
        'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
        'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
    ];

    // 1. Prevenir quebra de linha com Enter em contenteditable
    document.addEventListener('keydown', (e: KeyboardEvent) => {
        const target = e.target as HTMLElement;
        if (target && target.getAttribute('contenteditable') === 'true') {
            if (e.key === 'Enter') {
                e.preventDefault();
                target.blur();
            }
        }
    });

    // 2. Formatação e Manipulação de CNPJ / BrasilAPI
    function formatarCnpj(cnpj: string): string {
        if (!cnpj) return '';
        const limpo = cnpj.toString().replace(/\D/g, '');
        if (limpo.length === 14) {
            return limpo.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
        }
        return cnpj.toString().trim();
    }

    function formatarCep(cep: string): string {
        if (!cep) return '';
        const limpo = cep.toString().replace(/\D/g, '');
        if (limpo.length === 8) {
            return limpo.replace(/^(\d{5})(\d{3})$/, '$1-$2');
        }
        return cep.toString().trim();
    }

    function formatarCpf(cpf: string, ocultar = false): string {
        if (!cpf) return '';
        const limpo = cpf.toString().replace(/\D/g, '');
        if (limpo.length === 11) {
            if (ocultar) {
                return `***.${limpo.substring(3, 6)}.${limpo.substring(6, 9)}-**`;
            }
            return limpo.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
        }
        return cpf.toString().trim();
    }

    function gerarHashGovBr(): string {
        const hexChars = '0123456789ABCDEF';
        const blocos: string[] = [];
        for (let b = 0; b < 6; b++) {
            let bloco = '';
            for (let c = 0; c < 4; c++) {
                bloco += hexChars.charAt(Math.floor(Math.random() * hexChars.length));
            }
            blocos.push(bloco);
        }
        return blocos.join('-');
    }

    function atualizarQrCodeGovBr(hash?: string) {
        const qrImg = document.getElementById('govbr-qr-image') as HTMLImageElement | null;
        if (qrImg) {
            const validationUrl = hash 
                ? `https://validar.iti.br/?codigo=${encodeURIComponent(hash)}` 
                : 'https://validar.iti.br';
            qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(validationUrl)}`;
        }
    }

    function aplicarNovoHashGovBr(): string {
        const novoHash = gerarHashGovBr();
        const hashEl = document.getElementById('stamp-govbr-hash');
        if (hashEl) hashEl.innerText = novoHash;
        atualizarQrCodeGovBr(novoHash);
        return novoHash;
    }

    async function buscarCnpjNaAPI(cnpjElement: HTMLElement) {
        const cnpjLimpo = cnpjElement.innerText.replace(/\D/g, '');

        if (cnpjLimpo.length === 14) {
            const cnpjFormatado = formatarCnpj(cnpjLimpo);
            atualizarTodosOsCampos('.sync-cnpj', cnpjFormatado);
            atualizarTodosOsCampos('.sync-empresa', 'Buscando dados na Receita Federal...');

            try {
                const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`);
                if (!response.ok) throw new Error('CNPJ não encontrado');
                const data = await response.json();

                if (data.razao_social) {
                    atualizarTodosOsCampos('.sync-empresa', data.razao_social);
                }

                let logradouro = `${data.logradouro || ''}, ${data.numero || 'S/N'}`;
                if (data.complemento) logradouro += ` - ${data.complemento}`;
                if (data.bairro) logradouro += ` - ${data.bairro}`;
                atualizarTodosOsCampos('.sync-endereco-linha1', logradouro);

                const cepFormatado = formatarCep(data.cep || '');
                const cidadeUfCep = `${data.municipio || ''} - ${data.uf || ''}${cepFormatado ? ', CEP: ' + cepFormatado : ''}`;
                atualizarTodosOsCampos('.sync-endereco-linha2', cidadeUfCep);

                if (data.municipio && data.uf) {
                    atualizarDataExtenso(data.municipio, data.uf);
                }
            } catch (error) {
                console.warn('Erro ao consultar BrasilAPI:', error);
                const nomeFallback = localStorage.getItem('keystone_last_company_name') || '[NOME DA SUA EMPRESA LTDA]';
                atualizarTodosOsCampos('.sync-empresa', nomeFallback);
            }
        }
    }

    function atualizarTodosOsCampos(classeCss: string, valor: string) {
        if (!valor) return;
        document.querySelectorAll<HTMLElement>(classeCss).forEach(campo => {
            campo.innerText = valor;
        });
    }

    // 3. Funções Auxiliares de Meses e Datas
    function getMesIndex(m: string | null | undefined): number {
        if (!m) return -1;
        const limpo = m.toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace('ç', 'c').toLowerCase().trim();
        return mesesNomes.findIndex(nome => nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace('ç', 'c') === limpo);
    }

    function parseValorMoeda(texto: string): number {
        if (!texto) return 0;
        const textoLimpo = texto.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
        const num = parseFloat(textoLimpo);
        return isNaN(num) ? 0 : num;
    }

    function formatarMoeda(valor: number): string {
        return valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function calcularTotal() {
        let total = 0;
        document.querySelectorAll<HTMLElement>('.valor-mes').forEach(celula => {
            total += parseValorMoeda(celula.innerText);
        });

        const totalEl = document.getElementById('total-anual');
        if (totalEl) {
            totalEl.innerText = formatarMoeda(total);
        }
    }

    function formatarMoedaInput(texto: string): string {
        const valor = parseValorMoeda(texto);
        return formatarMoeda(valor);
    }

    function anexarEventosValores() {
        document.querySelectorAll<HTMLElement>('.valor-mes').forEach(celula => {
            celula.addEventListener('input', function (this: HTMLElement) {
                const key = this.getAttribute('data-key');
                if (key) memoriaValores[key] = this.innerText;
                calcularTotal();
            });

            celula.addEventListener('focus', function (this: HTMLElement) {
                if (this.innerText.trim() === '0,00' || this.innerText.trim() === '0') {
                    this.innerText = '';
                }
            });

            celula.addEventListener('blur', function (this: HTMLElement) {
                const texto = this.innerText.trim();
                this.innerText = texto === '' ? '0,00' : formatarMoedaInput(texto);
                const key = this.getAttribute('data-key');
                if (key) memoriaValores[key] = this.innerText;
                calcularTotal();
            });
        });
    }

    function calcularDiferencaMeses(startMes: number, startAno: number, endMes: number, endAno: number): number {
        return (endAno - startAno) * 12 + (endMes - startMes) + 1;
    }

    function sincronizarSeletorMeses(qtdMeses: number) {
        const sel = document.getElementById('selectNumMeses') as HTMLSelectElement | null;
        const containerCustom = document.getElementById('containerCustomMeses');
        const inputCustom = document.getElementById('inputNumMesesCustom') as HTMLInputElement | null;

        if (!sel) return;

        const opcoesPadrao = ['1', '2', '3', '4', '5', '6', '12', '18', '24', '36', '48', '60'];
        const strQtd = String(qtdMeses);

        if (opcoesPadrao.includes(strQtd)) {
            sel.value = strQtd;
            if (containerCustom) {
                containerCustom.classList.remove('flex');
                containerCustom.classList.add('hidden');
            }
        } else {
            sel.value = 'custom';
            if (containerCustom) {
                containerCustom.classList.remove('hidden');
                containerCustom.classList.add('flex');
            }
            if (inputCustom) {
                inputCustom.value = strQtd;
            }
        }
    }

    function obterFimPeriodoAtual(): { fimMes: number; fimAno: number } {
        const elMesFim = document.querySelector<HTMLElement>('.sync-mes-fim');
        const elAnoFim = document.querySelector<HTMLElement>('.sync-ano-fim');
        const endMes = elMesFim ? getMesIndex(elMesFim.innerText) : -1;
        const endAno = elAnoFim ? parseInt(elAnoFim.innerText.trim(), 10) : NaN;

        if (endMes !== -1 && !isNaN(endAno) && endAno >= 1900) {
            return { fimMes: endMes, fimAno: endAno };
        }

        const hoje = new Date();
        let fimMes = hoje.getMonth() - 1;
        let fimAno = hoje.getFullYear();
        if (fimMes < 0) {
            fimMes = 11;
            fimAno--;
        }
        return { fimMes, fimAno };
    }

    function atualizarTabelaMeses() {
        const elMesIni = document.querySelector<HTMLElement>('.sync-mes-inicio');
        const elAnoIni = document.querySelector<HTMLElement>('.sync-ano-inicio');
        const elMesFim = document.querySelector<HTMLElement>('.sync-mes-fim');
        const elAnoFim = document.querySelector<HTMLElement>('.sync-ano-fim');

        if (!elMesIni || !elAnoIni || !elMesFim || !elAnoFim) return;

        const startMes = getMesIndex(elMesIni.innerText);
        const endMes = getMesIndex(elMesFim.innerText);
        const txtAnoInicio = parseInt(elAnoIni.innerText.trim(), 10);
        const txtAnoFim = parseInt(elAnoFim.innerText.trim(), 10);

        if (startMes === -1 || endMes === -1 || isNaN(txtAnoInicio) || isNaN(txtAnoFim) || txtAnoInicio < 1900 || txtAnoFim < 1900) return;
        if (txtAnoFim < txtAnoInicio || (txtAnoFim === txtAnoInicio && endMes < startMes)) return;

        // Sincroniza controles de período da toolbar
        const selIniMes = document.getElementById('toolbarSelectMesInicio') as HTMLSelectElement | null;
        const inpIniAno = document.getElementById('toolbarInputAnoInicio') as HTMLInputElement | null;
        const selFimMes = document.getElementById('toolbarSelectMesFim') as HTMLSelectElement | null;
        const inpFimAno = document.getElementById('toolbarInputAnoFim') as HTMLInputElement | null;

        if (selIniMes && selIniMes.value !== String(startMes)) selIniMes.value = String(startMes);
        if (inpIniAno && inpIniAno.value !== String(txtAnoInicio)) inpIniAno.value = String(txtAnoInicio);
        if (selFimMes && selFimMes.value !== String(endMes)) selFimMes.value = String(endMes);
        if (inpFimAno && inpFimAno.value !== String(txtAnoFim)) inpFimAno.value = String(txtAnoFim);

        const diff = calcularDiferencaMeses(startMes, txtAnoInicio, endMes, txtAnoFim);
        if (diff >= 1 && diff <= 60) {
            sincronizarSeletorMeses(diff);
        }

        const tbody = document.getElementById('tbody-meses');
        if (!tbody) return;
        tbody.innerHTML = '';

        let currentMes = startMes;
        let currentAno = txtAnoInicio;
        let limit = 0;

        while (limit < 120) {
            const mesNomeFormatado = mesesNomes[currentMes].charAt(0).toUpperCase() + mesesNomes[currentMes].slice(1);
            const key = `${currentMes}-${currentAno}`;
            const valorAtual = memoriaValores[key] || '0,00';

            const tr = document.createElement('tr');
            tr.className = 'hover:bg-gray-50/70 transition-colors';
            tr.innerHTML = `<td class="px-4 py-2.5 text-gray-900 font-medium">${mesNomeFormatado} / ${currentAno}</td>
                            <td class="px-4 py-2.5 text-right font-mono font-bold text-gray-900">R$ <span contenteditable="true" class="valor-mes outline-none px-1.5 py-0.5 rounded hover:bg-yellow-100/50 focus:ring-1 focus:ring-brand-500" data-key="${key}">${valorAtual}</span></td>`;
            tbody.appendChild(tr);

            if (currentMes === endMes && currentAno === txtAnoFim) break;
            currentMes++;
            if (currentMes > 11) {
                currentMes = 0;
                currentAno++;
            }
            limit++;
        }

        anexarEventosValores();
        calcularTotal();
    }

    function configurarSincronizacao(classeCss: string) {
        const campos = document.querySelectorAll<HTMLElement>('.' + classeCss);
        campos.forEach(campo => {
            if (campo.getAttribute('contenteditable') === 'true') {
                campo.addEventListener('input', function (this: HTMLElement) {
                    const textoAtual = this.innerText;
                    campos.forEach(outroCampo => {
                        if (outroCampo !== this) {
                            outroCampo.innerText = textoAtual;
                        }
                    });
                });
            }
        });
    }

    // 4. Presets e seleção dinâmica de período
    function aplicarPeriodo(iniMesIdx: number, iniAno: number, fimMesIdx: number, fimAno: number) {
        const iniNome = mesesNomes[iniMesIdx].charAt(0).toUpperCase() + mesesNomes[iniMesIdx].slice(1);
        const fimNome = mesesNomes[fimMesIdx].charAt(0).toUpperCase() + mesesNomes[fimMesIdx].slice(1);

        atualizarTodosOsCampos('.sync-mes-inicio', iniNome);
        atualizarTodosOsCampos('.sync-ano-inicio', iniAno.toString());
        atualizarTodosOsCampos('.sync-mes-fim', fimNome);
        atualizarTodosOsCampos('.sync-ano-fim', fimAno.toString());

        // Atualiza controles da toolbar
        const selIniMes = document.getElementById('toolbarSelectMesInicio') as HTMLSelectElement | null;
        const inpIniAno = document.getElementById('toolbarInputAnoInicio') as HTMLInputElement | null;
        const selFimMes = document.getElementById('toolbarSelectMesFim') as HTMLSelectElement | null;
        const inpFimAno = document.getElementById('toolbarInputAnoFim') as HTMLInputElement | null;

        if (selIniMes) selIniMes.value = String(iniMesIdx);
        if (inpIniAno) inpIniAno.value = String(iniAno);
        if (selFimMes) selFimMes.value = String(fimMesIdx);
        if (inpFimAno) inpFimAno.value = String(fimAno);

        atualizarTabelaMeses();
    }

    function preencherUltimosNMeses(qtdMeses: number, usarFimAtual = true) {
        if (!qtdMeses || qtdMeses < 1) qtdMeses = 1;
        if (qtdMeses > 60) qtdMeses = 60;

        let fimMes: number;
        let fimAno: number;

        if (usarFimAtual) {
            const fim = obterFimPeriodoAtual();
            fimMes = fim.fimMes;
            fimAno = fim.fimAno;
        } else {
            const hoje = new Date();
            fimMes = hoje.getMonth() - 1;
            fimAno = hoje.getFullYear();
            if (fimMes < 0) {
                fimMes = 11;
                fimAno--;
            }
        }

        const iniData = new Date(fimAno, fimMes - (qtdMeses - 1), 1);
        const iniMes = iniData.getMonth();
        const iniAno = iniData.getFullYear();

        aplicarPeriodo(iniMes, iniAno, fimMes, fimAno);
        sincronizarSeletorMeses(qtdMeses);
    }

    function preencherUltimos12Meses() {
        preencherUltimosNMeses(12, false);
    }

    function preencherAnoAtual() {
        const hoje = new Date();
        const ano = hoje.getFullYear();
        aplicarPeriodo(0, ano, 11, ano);
        sincronizarSeletorMeses(12);
    }

    function preencherUltimos6Meses() {
        preencherUltimosNMeses(6, false);
    }

    function parseTransactionDate(dateStr: any): { ano: number; mes: number } | null {
        if (!dateStr) return null;
        const str = String(dateStr).trim();
        const matchIso = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
        if (matchIso) {
            const ano = parseInt(matchIso[1], 10);
            const mes = parseInt(matchIso[2], 10) - 1;
            if (!isNaN(ano) && !isNaN(mes) && mes >= 0 && mes <= 11) {
                return { ano, mes };
            }
        }
        const matchBr = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        if (matchBr) {
            const ano = parseInt(matchBr[3], 10);
            const mes = parseInt(matchBr[2], 10) - 1;
            if (!isNaN(ano) && !isNaN(mes) && mes >= 0 && mes <= 11) {
                return { ano, mes };
            }
        }
        const d = new Date(str);
        if (!isNaN(d.getTime())) {
            return { ano: d.getFullYear(), mes: d.getMonth() };
        }
        return null;
    }

    // Cache e gerenciamento de clientes/empresas cadastrados
    let clientesCache: any[] = [];

    function aplicarDadosCliente(cliente: any) {
        if (!cliente) return;

        const razaoSocial = cliente.name || cliente.trade_name || '';
        const cnpj = cliente.cnpj_cpf ? formatarCnpj(cliente.cnpj_cpf) : '';

        if (razaoSocial) {
            atualizarTodosOsCampos('.sync-empresa', razaoSocial);
        }
        if (cnpj) {
            atualizarTodosOsCampos('.sync-cnpj', cnpj);
        }

        const logradouro = cliente.street || cliente.logradouro || cliente.endereco || '';
        const numero = cliente.number || cliente.numero || '';
        const complemento = cliente.complement || cliente.complemento || '';
        const bairro = cliente.neighborhood || cliente.bairro || '';

        let enderecoLinha1 = '';
        if (logradouro) {
            enderecoLinha1 = `${logradouro}${numero ? ', ' + numero : ''}`;
            if (complemento) enderecoLinha1 += ` - ${complemento}`;
            if (bairro) enderecoLinha1 += ` - ${bairro}`;
            atualizarTodosOsCampos('.sync-endereco-linha1', enderecoLinha1);
        }

        const cidade = cliente.city || cliente.municipio || cliente.cidade || '';
        const uf = cliente.state || cliente.uf || cliente.estado || '';
        const cepRaw = cliente.zipcode || cliente.cep || '';
        const cepFormatado = cepRaw ? formatarCep(cepRaw) : '';

        if (cidade || uf) {
            const cidadeUfCep = `${cidade || 'Niterói'} - ${uf || 'RJ'}${cepFormatado ? ', CEP: ' + cepFormatado : ''}`;
            atualizarTodosOsCampos('.sync-endereco-linha2', cidadeUfCep);
            atualizarDataExtenso(cidade || 'Niterói', uf || 'RJ');
        }

        if (!enderecoLinha1 && cnpj && cnpj.replace(/\D/g, '').length === 14) {
            const cnpjEl = document.querySelector<HTMLElement>('.sync-cnpj');
            if (cnpjEl) {
                buscarCnpjNaAPI(cnpjEl);
            }
        }
    }

    async function carregarClientesNoSeletor() {
        const select = document.getElementById('toolbarSelectCliente') as HTMLSelectElement | null;
        if (!select || typeof win.api !== 'function') return;

        try {
            const previousVal = select.value;
            const res = await win.api('/entities/customers');
            clientesCache = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);

            // Ordena clientes por nome
            clientesCache.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

            // Preserva a opção padrão da empresa ativa
            select.innerHTML = '<option value="">🏢 Empresa Ativa Logada</option>';

            clientesCache.forEach(c => {
                const opt = document.createElement('option');
                opt.value = String(c.id);
                const docFmt = c.cnpj_cpf ? ` - ${formatarCnpj(c.cnpj_cpf)}` : '';
                const tradeFmt = c.trade_name && c.trade_name !== c.name ? ` (${c.trade_name})` : '';
                opt.textContent = `👤 ${c.name}${tradeFmt}${docFmt}`;
                select.appendChild(opt);
            });

            if (previousVal && clientesCache.some(c => String(c.id) === previousVal)) {
                select.value = previousVal;
            }

            atualizarComboboxDeclaracoesSalvas(undefined, false, true);
        } catch (e) {
            console.debug('Não foi possível carregar lista de clientes no seletor:', e);
        }
    }

    async function importarFaturamentoDoERP(): Promise<void> {
        const btn = document.getElementById('btnPuxarFaturamento') as HTMLButtonElement | null;
        const textoOriginal = btn ? btn.innerHTML : '';

        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `
                <svg class="animate-spin w-3.5 h-3.5 inline text-indigo-600 dark:text-indigo-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Puxando Fechamento...</span>
            `;
        }

        try {
            if (typeof win.api !== 'function') {
                throw new Error('API não inicializada. Recarregue a página.');
            }

            const selCliente = document.getElementById('toolbarSelectCliente') as HTMLSelectElement | null;
            const selectedCustomerId = selCliente?.value ? Number(selCliente.value) : null;

            let url = '/fechamentos';
            if (selectedCustomerId) {
                url += `?customerId=${selectedCustomerId}`;
            }

            const res = await win.api(url);
            let fechamentos = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);

            if (selectedCustomerId && fechamentos.length > 0) {
                fechamentos = fechamentos.filter((f: any) => Number(f.customer_id) === selectedCustomerId);
            }

            if (fechamentos.length === 0) {
                (win.UI as any)?.showAlert?.('alertMessage', 'Nenhum fechamento fiscal encontrado no ERP para a empresa / cliente selecionado.', 'info');
                return;
            }

            // Agrupa faturamento bruto por competência mês-ano
            const faturamentoPorMesAno: Record<string, number> = {};
            let totalPeriodo = 0;
            let countFechamentos = 0;

            for (const f of fechamentos) {
                const comp = String(f.competencia || '').trim();
                if (!comp || !comp.includes('-')) continue;

                const [anoStr, mesStr] = comp.split('-');
                const ano = parseInt(anoStr, 10);
                const mes = parseInt(mesStr, 10) - 1; // 0-indexed

                if (isNaN(ano) || isNaN(mes) || mes < 0 || mes > 11) continue;

                const key = `${mes}-${ano}`;
                
                // Prioridade: Simples Nacional > Venda / SPED > Tributado
                let valor = 0;
                const sFat = Number(f.simples_faturamento || 0);
                const vVal = Number(f.venda_valor || 0);
                const sTrib = Number(f.simples_valor_tributado || 0);

                if (sFat > 0) {
                    valor = sFat;
                } else if (vVal > 0) {
                    valor = vVal;
                } else if (sTrib > 0) {
                    valor = sTrib;
                }

                if (valor > 0) {
                    faturamentoPorMesAno[key] = (faturamentoPorMesAno[key] || 0) + valor;
                    countFechamentos++;
                }
            }

            // Atualiza memória de valores com o que foi apurado
            Object.keys(faturamentoPorMesAno).forEach(k => {
                memoriaValores[k] = formatarMoeda(faturamentoPorMesAno[k]);
            });

            // Atualiza cada linha visível na tabela
            let countMesesPreenchidos = 0;
            document.querySelectorAll<HTMLElement>('.valor-mes').forEach(celula => {
                const key = celula.getAttribute('data-key');
                if (key) {
                    const valorDoMes = faturamentoPorMesAno[key] || 0;
                    celula.innerText = formatarMoeda(valorDoMes);
                    memoriaValores[key] = formatarMoeda(valorDoMes);
                    if (valorDoMes > 0) {
                        totalPeriodo += valorDoMes;
                        countMesesPreenchidos++;
                    }
                }
            });

            calcularTotal();

            const totalPeriodoFormatado = formatarMoeda(totalPeriodo);
            (win.UI as any)?.showAlert?.(
                'alertMessage',
                `Faturamento dos Fechamentos Fiscais importado com sucesso! Total no período: R$ ${totalPeriodoFormatado} (${countMesesPreenchidos} mês(es) com faturamento no período da declaração).`,
                'success',
                5000
            );
        } catch (err: any) {
            console.error('Erro ao buscar fechamentos do ERP:', err);
            (win.UI as any)?.showAlert?.('alertMessage', err.message || 'Erro ao carregar faturamento dos fechamentos.', 'error');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = textoOriginal;
            }
        }
    }

    async function importarReceitasDoERP(): Promise<void> {
        const btn = document.getElementById('btnPuxarReceitas') as HTMLButtonElement | null;
        const textoOriginal = btn ? btn.innerHTML : '';

        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `
                <svg class="animate-spin w-3.5 h-3.5 inline text-emerald-600 dark:text-emerald-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Puxando Receitas...</span>
            `;
        }

        try {
            if (typeof win.api !== 'function') {
                throw new Error('API não inicializada. Recarregue a página.');
            }

            const selCliente = document.getElementById('toolbarSelectCliente') as HTMLSelectElement | null;
            const selectedCustomerId = selCliente?.value ? Number(selCliente.value) : null;

            const res = await win.api('/finance/revenues');
            const revenues = Array.isArray(res?.data) ? res.data : [];

            if (revenues.length === 0) {
                (win.UI as any)?.showAlert?.('alertMessage', 'Nenhum lançamento de receita encontrado no ERP para a empresa ativa.', 'info');
                return;
            }

            // Agrupa faturamento bruto por competência mês-ano
            const faturamentoPorMesAno: Record<string, number> = {};
            let totalPeriodo = 0;
            let totalGeral = 0;
            let countTotal = 0;

            for (const rev of revenues) {
                if (rev.status === 'cancelled') continue;
                if (selectedCustomerId && rev.customer_id && Number(rev.customer_id) !== selectedCustomerId) continue;

                const dt = parseTransactionDate(rev.date || rev.date_launch || rev.created_at);
                if (!dt) continue;

                const key = `${dt.mes}-${dt.ano}`;
                const rawVal = Number(rev.received_amount || rev.amount || rev.original_amount || 0);
                const valor = isNaN(rawVal) ? 0 : rawVal;

                if (valor > 0) {
                    faturamentoPorMesAno[key] = (faturamentoPorMesAno[key] || 0) + valor;
                    totalGeral += valor;
                    countTotal++;
                }
            }

            // Atualiza memória de valores com tudo que foi apurado
            Object.keys(faturamentoPorMesAno).forEach(k => {
                memoriaValores[k] = formatarMoeda(faturamentoPorMesAno[k]);
            });

            // Atualiza cada linha visível na tabela
            let countMesesPreenchidos = 0;
            document.querySelectorAll<HTMLElement>('.valor-mes').forEach(celula => {
                const key = celula.getAttribute('data-key');
                if (key) {
                    const valorDoMes = faturamentoPorMesAno[key] || 0;
                    celula.innerText = formatarMoeda(valorDoMes);
                    memoriaValores[key] = formatarMoeda(valorDoMes);
                    if (valorDoMes > 0) {
                        totalPeriodo += valorDoMes;
                        countMesesPreenchidos++;
                    }
                }
            });

            calcularTotal();

            const totalPeriodoFormatado = formatarMoeda(totalPeriodo);
            (win.UI as any)?.showAlert?.(
                'alertMessage',
                `Faturamento bruto importado com sucesso! Total no período da declaração: R$ ${totalPeriodoFormatado} (${countMesesPreenchidos} mês(es) com movimento de receitas no período).`,
                'success',
                5000
            );
        } catch (err: any) {
            console.error('Erro ao buscar receitas do ERP:', err);
            (win.UI as any)?.showAlert?.('alertMessage', err.message || 'Erro ao carregar receitas do ERP.', 'error');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = textoOriginal;
            }
        }
    }

    function zerarValores() {
        document.querySelectorAll<HTMLElement>('.valor-mes').forEach(celula => {
            celula.innerText = '0,00';
            const key = celula.getAttribute('data-key');
            if (key) memoriaValores[key] = '0,00';
        });
        calcularTotal();
    }

    function atualizarDataExtenso(cidade = 'Niterói', uf = 'RJ') {
        const data = new Date();
        const dia = String(data.getDate()).padStart(2, '0');
        const mesExtenso = mesesNomes[data.getMonth()].charAt(0).toUpperCase() + mesesNomes[data.getMonth()].slice(1);
        const ano = data.getFullYear();

        const campoData = document.getElementById('campo-data-extenso');
        if (campoData) {
            campoData.innerText = `${cidade} - ${uf}, ${dia} de ${mesExtenso} de ${ano}.`;
        }

        // Atualiza carimbos de data/hora
        const hora = String(data.getHours()).padStart(2, '0');
        const min = String(data.getMinutes()).padStart(2, '0');
        const sec = String(data.getSeconds()).padStart(2, '0');
        const tsFormatado = `${dia}/${String(data.getMonth() + 1).padStart(2, '0')}/${ano} ${hora}:${min}:${sec} -03:00`;

        const stampEmpresa = document.getElementById('stamp-time-empresa');
        const stampContador = document.getElementById('stamp-time-contador');
        const stampGovBr = document.getElementById('stamp-time-govbr');

        if (stampEmpresa) stampEmpresa.innerText = `Data e Hora: ${tsFormatado}`;
        if (stampContador) stampContador.innerText = `Data e Hora: ${tsFormatado}`;
        if (stampGovBr) stampGovBr.innerText = tsFormatado;
    }

    // 5. Modos de Assinatura & Assinatura Gov.br / ICP-Brasil
    function gerarSerialIcp(): string {
        const hexChars = '0123456789ABCDEF';
        const blocos: string[] = [];
        for (let b = 0; b < 4; b++) {
            let bloco = '';
            for (let c = 0; c < 4; c++) {
                bloco += hexChars.charAt(Math.floor(Math.random() * hexChars.length));
            }
            blocos.push(bloco);
        }
        return blocos.join('-');
    }

    function aplicarSeriaisIcp() {
        const elEmpresa = document.getElementById('stamp-icp-empresa-serial');
        if (elEmpresa && (!elEmpresa.innerText || elEmpresa.innerText.includes('4A82'))) {
            elEmpresa.innerText = gerarSerialIcp();
        }
        const elContador = document.getElementById('stamp-icp-contador-serial');
        if (elContador && (!elContador.innerText || elContador.innerText.includes('7F3B'))) {
            elContador.innerText = gerarSerialIcp();
        }
    }

    interface SavedDeclaracao {
        id: string;
        dataHora: string;
        timestamp: number;
        customerId?: string | number | null;
        customerName?: string;
        nomeEmpresa: string;
        nomePdf: string;
        cnpj: string;
        enderecoLinha1: string;
        enderecoLinha2: string;
        mesInicio: number;
        anoInicio: number;
        mesFim: number;
        anoFim: number;
        periodoTexto: string;
        totalFaturamento: string;
        valores: Record<string, string>;
        dataExtenso: string;
        modoAssinatura: 'govbr' | 'icp' | 'ambos';
        govbr: {
            nome: string;
            cpf: string;
            cargo: string;
            time: string;
            hash: string;
        };
        icp: {
            empresaAc: string;
            empresaSerial: string;
            empresaTime: string;
            contadorNome: string;
            contadorCrc: string;
            contadorAc: string;
            contadorSerial: string;
            contadorTime: string;
        };
    }

    let modoAssinaturaAtual: 'govbr' | 'icp' | 'ambos' = 'govbr';

    function getSavedDeclaracoesStorageKey(): string {
        const companyId = win.gNavbarAuthContext?.activeCompanyId || win.gNavbarAuthContext?.user?.company_id || localStorage.getItem('keystone_last_company_public_id') || 'default';
        return `@Keystone:declaracoes_salvas_${companyId}`;
    }

    function carregarDeclaracoesSalvas(): SavedDeclaracao[] {
        try {
            const key = getSavedDeclaracoesStorageKey();
            const raw = (win.CompanyStorage?.getItem(key) ?? localStorage.getItem(key)) || '';
            let list: SavedDeclaracao[] = [];
            if (raw) {
                try {
                    const parsed = JSON.parse(raw);
                    if (Array.isArray(parsed)) list = parsed;
                } catch {}
            }

            // Fallback para chave legado sem sufixo se a lista estiver vazia
            if (list.length === 0) {
                const legacyKey = '@Keystone:declaracoes_salvas';
                const legacyRaw = (win.CompanyStorage?.getItem(legacyKey) ?? localStorage.getItem(legacyKey)) || '';
                if (legacyRaw) {
                    try {
                        const legacyParsed = JSON.parse(legacyRaw);
                        if (Array.isArray(legacyParsed) && legacyParsed.length > 0) {
                            list = legacyParsed;
                        }
                    } catch {}
                }
            }

            return list.filter(item => item && typeof item === 'object' && item.id);
        } catch {
            return [];
        }
    }

    function salvarDeclaracoesLista(lista: SavedDeclaracao[]) {
        try {
            const key = getSavedDeclaracoesStorageKey();
            const val = JSON.stringify(lista);
            if (win.CompanyStorage?.setItem) {
                win.CompanyStorage.setItem(key, val);
            }
            localStorage.setItem(key, val);
            // Também atualiza chave legada para retrocompatibilidade
            localStorage.setItem('@Keystone:declaracoes_salvas', val);
        } catch (e) {
            console.warn('Erro ao salvar declarações no storage:', e);
        }
    }

    function sanitizarNomeArquivo(texto: string): string {
        return texto
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-zA-Z0-9_-]/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '')
            .substring(0, 40);
    }

    function normalizarTexto(txt: string): string {
        return (txt || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .trim();
    }

    function obterClienteSelecionadoInfo(): { id: string | null; name: string; cnpj: string; isEmpresaAtiva: boolean } {
        const selCliente = document.getElementById('toolbarSelectCliente') as HTMLSelectElement | null;
        const val = selCliente?.value ? String(selCliente.value) : '';

        if (!val) {
            const nomeEmpresa = document.querySelector<HTMLElement>('.sync-empresa')?.innerText.trim() || localStorage.getItem('keystone_last_company_name') || 'EMPRESA';
            const cnpj = document.querySelector<HTMLElement>('.sync-cnpj')?.innerText.trim() || localStorage.getItem('keystone_last_company_cnpj') || '';
            return {
                id: null,
                name: nomeEmpresa,
                cnpj,
                isEmpresaAtiva: true
            };
        }

        const found = clientesCache.find(c => String(c.id) === val);
        const name = found ? (found.name || found.trade_name || '') : '';
        const cnpj = found ? (found.cnpj_cpf || '') : '';
        return {
            id: val,
            name,
            cnpj,
            isEmpresaAtiva: false
        };
    }

    function filtrarDeclaracoesPorCliente(lista: SavedDeclaracao[], clienteInfo: { id: string | null; name: string; cnpj: string; isEmpresaAtiva: boolean }): SavedDeclaracao[] {
        const cleanCnpj = (doc: string) => (doc || '').toString().replace(/\D/g, '');
        const targetCnpj = cleanCnpj(clienteInfo.cnpj);
        const targetNameNorm = normalizarTexto(clienteInfo.name);

        if (clienteInfo.isEmpresaAtiva) {
            return lista.filter(d => {
                if (d.customerId === null || d.customerId === undefined || d.customerId === '' || d.customerId === 'empresa_ativa') return true;
                if (targetCnpj && targetCnpj.length >= 8 && cleanCnpj(d.cnpj) === targetCnpj) return true;
                if (targetNameNorm && normalizarTexto(d.nomeEmpresa) === targetNameNorm && (!d.customerId || d.customerId === 'empresa_ativa')) return true;
                return false;
            });
        }

        const targetIdStr = String(clienteInfo.id);
        return lista.filter(d => {
            if (d.customerId && String(d.customerId) === targetIdStr) return true;
            if (targetCnpj && targetCnpj.length >= 8 && cleanCnpj(d.cnpj) === targetCnpj) return true;
            if (targetNameNorm && (normalizarTexto(d.customerName || '') === targetNameNorm || normalizarTexto(d.nomeEmpresa || '') === targetNameNorm) && d.customerId !== 'empresa_ativa') return true;
            return false;
        });
    }

    function atualizarComboboxDeclaracoesSalvas(selecionarId?: string, autoCarregarSeHouver = false, isSilent = false) {
        const select = document.getElementById('selectDeclaracoesSalvas') as HTMLSelectElement | null;
        const badge = document.getElementById('badgeQtdSalvas');
        const containerLista = document.getElementById('containerListaDeclaracoesSalvas');
        if (!select) return;

        const todas = carregarDeclaracoesSalvas();
        const clienteInfo = obterClienteSelecionadoInfo();
        const filtradas = filtrarDeclaracoesPorCliente(todas, clienteInfo);

        // Mais recentes primeiro
        filtradas.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

        const rotuloCliente = clienteInfo.isEmpresaAtiva ? 'Empresa Ativa' : (clienteInfo.name || 'Cliente');
        if (badge) {
            badge.innerText = `${filtradas.length} salva${filtradas.length === 1 ? '' : 's'} (${rotuloCliente})`;
        }

        select.innerHTML = '';
        if (filtradas.length === 0) {
            const opt = document.createElement('option');
            opt.value = '';
            opt.textContent = `-- Nenhuma declaração salva para: ${rotuloCliente} --`;
            select.appendChild(opt);
            select.value = '';

            if (autoCarregarSeHouver) {
                zerarValores();
            }
        } else {
            const defaultOpt = document.createElement('option');
            defaultOpt.value = '';
            defaultOpt.textContent = `-- Selecione uma declaração (${filtradas.length} salva${filtradas.length === 1 ? '' : 's'} de ${rotuloCliente}) --`;
            select.appendChild(defaultOpt);

            filtradas.forEach(item => {
                const opt = document.createElement('option');
                opt.value = item.id;
                // Formato: Data, Hora e Nome em PDF
                opt.textContent = `📅 ${item.dataHora} • 📄 ${item.nomePdf}${item.totalFaturamento ? ` • R$ ${item.totalFaturamento}` : ''}`;
                select.appendChild(opt);
            });

            if (selecionarId && filtradas.some(f => f.id === selecionarId)) {
                select.value = selecionarId;
            } else if (autoCarregarSeHouver) {
                const maisRecente = filtradas[0];
                select.value = maisRecente.id;
                carregarDeclaracaoSalva(maisRecente.id, isSilent);
            }
        }

        // Renderiza lista detalhada com Data, Hora e Nome em PDF
        if (containerLista) {
            if (filtradas.length === 0) {
                containerLista.classList.add('hidden');
                containerLista.classList.remove('flex');
                containerLista.innerHTML = '';
            } else {
                containerLista.classList.remove('hidden');
                containerLista.classList.add('flex');
                containerLista.innerHTML = filtradas.map(item => `
                    <div class="p-2 sm:p-2.5 rounded-lg bg-white dark:bg-slate-800/90 border border-teal-200/80 dark:border-slate-700 flex items-center justify-between gap-2 text-xs shadow-2xs hover:border-teal-400 transition-colors">
                        <div class="flex flex-col gap-0.5 min-w-0 flex-1">
                            <div class="flex items-center gap-1.5 font-bold text-gray-900 dark:text-gray-100 truncate">
                                <span class="text-teal-600 dark:text-teal-400 shrink-0">📅 ${item.dataHora}</span>
                                <span class="text-gray-400 dark:text-gray-500 shrink-0">•</span>
                                <span class="truncate font-mono text-[11px] text-teal-800 dark:text-teal-300 font-semibold" title="${item.nomePdf}">📄 ${item.nomePdf}</span>
                            </div>
                            <div class="text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-2 truncate">
                                <span>🏢 ${item.nomeEmpresa}</span>
                                ${item.periodoTexto ? `<span>• 🗓️ ${item.periodoTexto}</span>` : ''}
                                ${item.totalFaturamento ? `<span class="font-bold text-emerald-600 dark:text-emerald-400">• Total: R$ ${item.totalFaturamento}</span>` : ''}
                            </div>
                        </div>
                        <div class="flex items-center gap-1 shrink-0">
                            <button type="button" class="btn-item-carregar px-2.5 py-1 rounded bg-teal-600 hover:bg-teal-700 text-white font-bold text-[11px] transition-colors shadow-2xs cursor-pointer inline-flex items-center gap-1" data-id="${item.id}" title="Carregar esta declaração no documento">
                                📂 Carregar
                            </button>
                            <button type="button" class="btn-item-excluir p-1 rounded text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 dark:text-red-400 transition-colors cursor-pointer" data-id="${item.id}" title="Excluir declaração salva">
                                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                        </div>
                    </div>
                `).join('');

                containerLista.querySelectorAll<HTMLButtonElement>('.btn-item-carregar').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const id = btn.getAttribute('data-id');
                        if (id) {
                            if (select) select.value = id;
                            carregarDeclaracaoSalva(id, false);
                        }
                    });
                });

                containerLista.querySelectorAll<HTMLButtonElement>('.btn-item-excluir').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const id = btn.getAttribute('data-id');
                        if (id) {
                            excluirDeclaracaoSalva(id);
                        }
                    });
                });
            }
        }
    }

    function salvarDeclaracaoAtual(): void {
        const clienteInfo = obterClienteSelecionadoInfo();
        const nomeEmpresa = document.querySelector<HTMLElement>('.sync-empresa')?.innerText.trim() || clienteInfo.name || 'EMPRESA';
        const cnpj = document.querySelector<HTMLElement>('.sync-cnpj')?.innerText.trim() || clienteInfo.cnpj || '';
        const endereco1 = document.querySelector<HTMLElement>('.sync-endereco-linha1')?.innerText.trim() || '';
        const endereco2 = document.querySelector<HTMLElement>('.sync-endereco-linha2')?.innerText.trim() || '';
        
        const elMesIni = document.querySelector<HTMLElement>('.sync-mes-inicio');
        const elAnoIni = document.querySelector<HTMLElement>('.sync-ano-inicio');
        const elMesFim = document.querySelector<HTMLElement>('.sync-mes-fim');
        const elAnoFim = document.querySelector<HTMLElement>('.sync-ano-fim');

        const mesIni = getMesIndex(elMesIni?.innerText);
        const anoIni = parseInt(elAnoIni?.innerText.trim() || '', 10) || new Date().getFullYear();
        const mesFim = getMesIndex(elMesFim?.innerText);
        const anoFim = parseInt(elAnoFim?.innerText.trim() || '', 10) || new Date().getFullYear();

        const periodoTexto = `${mesesNomes[mesIni >= 0 ? mesIni : 0]}/${anoIni} a ${mesesNomes[mesFim >= 0 ? mesFim : 11]}/${anoFim}`;
        const totalFaturamento = document.getElementById('total-anual')?.innerText.trim() || '0,00';
        const dataExtenso = document.getElementById('campo-data-extenso')?.innerText.trim() || '';

        // Copia todos os valores da memória e células da tabela
        const valores: Record<string, string> = { ...memoriaValores };
        document.querySelectorAll<HTMLElement>('.valor-mes').forEach(celula => {
            const key = celula.getAttribute('data-key');
            if (key && celula.innerText.trim()) {
                valores[key] = celula.innerText.trim();
            }
        });

        const agora = new Date();
        const dia = String(agora.getDate()).padStart(2, '0');
        const mesNum = String(agora.getMonth() + 1).padStart(2, '0');
        const ano = agora.getFullYear();
        const hora = String(agora.getHours()).padStart(2, '0');
        const min = String(agora.getMinutes()).padStart(2, '0');
        const seg = String(agora.getSeconds()).padStart(2, '0');

        const dataHoraFormatada = `${dia}/${mesNum}/${ano} ${hora}:${min}:${seg}`;
        const dataHoraArquivo = `${ano}${mesNum}${dia}_${hora}${min}${seg}`;
        const empresaSanitizada = sanitizarNomeArquivo(nomeEmpresa);
        const nomePdf = `Declaracao_Faturamento_${empresaSanitizada}_${dataHoraArquivo}.pdf`;

        const id = `decl_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const customerId = clienteInfo.isEmpresaAtiva ? 'empresa_ativa' : clienteInfo.id;
        const customerName = clienteInfo.name || nomeEmpresa;

        const novaDeclaracao: SavedDeclaracao = {
            id,
            dataHora: dataHoraFormatada,
            timestamp: agora.getTime(),
            customerId,
            customerName,
            nomeEmpresa,
            nomePdf,
            cnpj,
            enderecoLinha1: endereco1,
            enderecoLinha2: endereco2,
            mesInicio: mesIni >= 0 ? mesIni : 0,
            anoInicio: anoIni,
            mesFim: mesFim >= 0 ? mesFim : 11,
            anoFim: anoFim,
            periodoTexto,
            totalFaturamento,
            valores,
            dataExtenso,
            modoAssinatura: modoAssinaturaAtual,
            govbr: {
                nome: document.querySelector<HTMLElement>('.sync-govbr-nome')?.innerText.trim() || '',
                cpf: document.querySelector<HTMLElement>('.sync-govbr-cpf')?.innerText.trim() || '',
                cargo: document.getElementById('stamp-govbr-cargo')?.innerText.trim() || '',
                time: document.getElementById('stamp-time-govbr')?.innerText.trim() || '',
                hash: document.getElementById('stamp-govbr-hash')?.innerText.trim() || ''
            },
            icp: {
                empresaAc: document.getElementById('stamp-icp-empresa-ac')?.innerText.trim() || '',
                empresaSerial: document.getElementById('stamp-icp-empresa-serial')?.innerText.trim() || '',
                empresaTime: document.getElementById('stamp-time-empresa')?.innerText.trim() || '',
                contadorNome: document.getElementById('stamp-contador-nome')?.innerText.trim() || '',
                contadorCrc: document.getElementById('stamp-contador-crc')?.innerText.trim() || '',
                contadorAc: document.getElementById('stamp-icp-contador-ac')?.innerText.trim() || '',
                contadorSerial: document.getElementById('stamp-icp-contador-serial')?.innerText.trim() || '',
                contadorTime: document.getElementById('stamp-time-contador')?.innerText.trim() || ''
            }
        };

        const lista = carregarDeclaracoesSalvas();
        lista.unshift(novaDeclaracao);
        salvarDeclaracoesLista(lista);

        atualizarComboboxDeclaracoesSalvas(id, false, true);

        (win.UI as any)?.showAlert?.(
            'alertMessage',
            `💾 Declaração salva com sucesso! Arquivo: "${nomePdf}" (${dataHoraFormatada})`,
            'success',
            5000
        );
    }

    function carregarDeclaracaoSalva(id: string, isSilent = false): void {
        if (!id) {
            if (!isSilent) {
                (win.UI as any)?.showAlert?.('alertMessage', 'Selecione uma declaração salva no combobox para carregar.', 'info');
            }
            return;
        }

        const lista = carregarDeclaracoesSalvas();
        const item = lista.find(d => d.id === id);
        if (!item) {
            if (!isSilent) {
                (win.UI as any)?.showAlert?.('alertMessage', 'Declaração não encontrada.', 'error');
            }
            return;
        }

        // Sincroniza o seletor de cliente se houver correspondência sem disparar loop
        const selectCliente = document.getElementById('toolbarSelectCliente') as HTMLSelectElement | null;
        if (selectCliente) {
            if (item.customerId && item.customerId !== 'empresa_ativa') {
                selectCliente.value = String(item.customerId);
            } else if (item.cnpj) {
                const cleanItemCnpj = item.cnpj.replace(/\D/g, '');
                const foundCliente = clientesCache.find(c => (c.cnpj_cpf || '').replace(/\D/g, '') === cleanItemCnpj);
                if (foundCliente) {
                    selectCliente.value = String(foundCliente.id);
                } else {
                    selectCliente.value = '';
                }
            } else {
                selectCliente.value = '';
            }
        }

        // 1. Dados da empresa
        if (item.nomeEmpresa) atualizarTodosOsCampos('.sync-empresa', item.nomeEmpresa);
        if (item.cnpj) atualizarTodosOsCampos('.sync-cnpj', item.cnpj);
        if (item.enderecoLinha1) atualizarTodosOsCampos('.sync-endereco-linha1', item.enderecoLinha1);
        if (item.enderecoLinha2) atualizarTodosOsCampos('.sync-endereco-linha2', item.enderecoLinha2);

        // 2. Período e valores
        if (item.valores) {
            Object.keys(memoriaValores).forEach(k => delete memoriaValores[k]);
            Object.keys(item.valores).forEach(k => {
                memoriaValores[k] = item.valores[k];
            });
        }

        aplicarPeriodo(item.mesInicio, item.anoInicio, item.mesFim, item.anoFim);

        // Sincroniza os inputs da toolbar
        const selIniMes = document.getElementById('toolbarSelectMesInicio') as HTMLSelectElement | null;
        const inpIniAno = document.getElementById('toolbarInputAnoInicio') as HTMLInputElement | null;
        const selFimMes = document.getElementById('toolbarSelectMesFim') as HTMLSelectElement | null;
        const inpFimAno = document.getElementById('toolbarInputAnoFim') as HTMLInputElement | null;

        if (selIniMes && item.mesInicio !== undefined) selIniMes.value = String(item.mesInicio);
        if (inpIniAno && item.anoInicio) inpIniAno.value = String(item.anoInicio);
        if (selFimMes && item.mesFim !== undefined) selFimMes.value = String(item.mesFim);
        if (inpFimAno && item.anoFim) inpFimAno.value = String(item.anoFim);

        // 3. Data por extenso
        if (item.dataExtenso) {
            const campoDataExt = document.getElementById('campo-data-extenso');
            if (campoDataExt) campoDataExt.innerText = item.dataExtenso;
        }

        // 4. Modo de Assinatura e Dados Gov.br
        if (item.modoAssinatura) {
            definirModoAssinatura(item.modoAssinatura);
        }

        if (item.govbr) {
            if (item.govbr.nome) atualizarTodosOsCampos('.sync-govbr-nome', item.govbr.nome);
            if (item.govbr.cpf) atualizarTodosOsCampos('.sync-govbr-cpf', item.govbr.cpf);
            if (item.govbr.cargo) {
                const el = document.getElementById('stamp-govbr-cargo');
                if (el) el.innerText = item.govbr.cargo;
            }
            if (item.govbr.time) {
                const el = document.getElementById('stamp-time-govbr');
                if (el) el.innerText = item.govbr.time;
            }
            if (item.govbr.hash) {
                const el = document.getElementById('stamp-govbr-hash');
                if (el) el.innerText = item.govbr.hash;
                atualizarQrCodeGovBr(item.govbr.hash);
            }
        }

        // 5. Dados ICP-Brasil
        if (item.icp) {
            if (item.icp.empresaAc) {
                const el = document.getElementById('stamp-icp-empresa-ac');
                if (el) el.innerText = item.icp.empresaAc;
            }
            if (item.icp.empresaSerial) {
                const el = document.getElementById('stamp-icp-empresa-serial');
                if (el) el.innerText = item.icp.empresaSerial;
            }
            if (item.icp.empresaTime) {
                const el = document.getElementById('stamp-time-empresa');
                if (el) el.innerText = item.icp.empresaTime;
            }
            if (item.icp.contadorNome) {
                const el = document.getElementById('stamp-contador-nome');
                if (el) el.innerText = item.icp.contadorNome;
            }
            if (item.icp.contadorCrc) {
                const el = document.getElementById('stamp-contador-crc');
                if (el) el.innerText = item.icp.contadorCrc;
            }
            if (item.icp.contadorAc) {
                const el = document.getElementById('stamp-icp-contador-ac');
                if (el) el.innerText = item.icp.contadorAc;
            }
            if (item.icp.contadorSerial) {
                const el = document.getElementById('stamp-icp-contador-serial');
                if (el) el.innerText = item.icp.contadorSerial;
            }
            if (item.icp.contadorTime) {
                const el = document.getElementById('stamp-time-contador');
                if (el) el.innerText = item.icp.contadorTime;
            }
        }

        atualizarComboboxDeclaracoesSalvas(id, false, true);

        if (!isSilent) {
            (win.UI as any)?.showAlert?.(
                'alertMessage',
                `📂 Declaração salva carregada com sucesso! (${item.nomePdf} • ${item.dataHora})`,
                'success',
                4000
            );
        }
    }

    function excluirDeclaracaoSalva(id: string): void {
        if (!id) {
            (win.UI as any)?.showAlert?.('alertMessage', 'Selecione uma declaração salva para excluir.', 'info');
            return;
        }

        const lista = carregarDeclaracoesSalvas();
        const item = lista.find(d => d.id === id);
        const nome = item?.nomePdf || 'esta declaração';

        if (!confirm(`Deseja realmente excluir a declaração salva:\n"${nome}"?`)) {
            return;
        }

        const novaLista = lista.filter(d => d.id !== id);
        salvarDeclaracoesLista(novaLista);
        atualizarComboboxDeclaracoesSalvas();

        (win.UI as any)?.showAlert?.(
            'alertMessage',
            `🗑️ Declaração salva excluída com sucesso.`,
            'info',
            3000
        );
    }

    function definirModoAssinatura(modo: 'govbr' | 'icp' | 'ambos') {
        modoAssinaturaAtual = modo;
        const secGovBr = document.getElementById('secao-assinatura-govbr');
        const secIcp = document.getElementById('secao-assinaturas-icp');

        const btnGov = document.getElementById('btnModoGovBr');
        const btnIcp = document.getElementById('btnModoIcp');
        const btnAmbos = document.getElementById('btnModoAmbos');

        const resetBtn = (btn: HTMLElement | null) => {
            if (!btn) return;
            btn.className = 'px-2.5 py-1 rounded-md font-medium text-xs transition-colors bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-slate-600 hover:bg-gray-100';
        };

        const setActiveBtn = (btn: HTMLElement | null, bgClass = 'bg-[#1351b4]') => {
            if (!btn) return;
            btn.className = `px-2.5 py-1 rounded-md font-medium text-xs transition-colors ${bgClass} text-white shadow-xs`;
        };

        resetBtn(btnGov);
        resetBtn(btnIcp);
        resetBtn(btnAmbos);

        if (modo === 'govbr') {
            if (secGovBr) secGovBr.style.display = 'flex';
            if (secIcp) secIcp.style.display = 'none';
            setActiveBtn(btnGov, 'bg-[#1351b4]');
        } else if (modo === 'icp') {
            if (secGovBr) secGovBr.style.display = 'none';
            if (secIcp) secIcp.style.display = 'flex';
            setActiveBtn(btnIcp, 'bg-emerald-600');
            aplicarSeriaisIcp();
        } else if (modo === 'ambos') {
            if (secGovBr) secGovBr.style.display = 'flex';
            if (secIcp) secIcp.style.display = 'flex';
            setActiveBtn(btnAmbos, 'bg-slate-800 dark:bg-slate-600');
            aplicarSeriaisIcp();
        }
    }

    // Estado em memória para preenchimento rápido
    let responsavelEmpresaCache: { nome: string; cpf: string } = { nome: '', cpf: '' };
    let contadorCadastradoCache: { nome: string; crc: string; cpf: string } = { nome: '', crc: '', cpf: '' };

    function aplicarDadosContador(contador: any) {
        if (!contador) return;

        const nome = contador.full_name || contador.name || '';
        const crcRaw = contador.crc || '';
        const docRaw = contador.cpf_cnpj ? formatarCpf(contador.cpf_cnpj, false) : '';

        let docCargo = '';
        if (crcRaw) {
            docCargo = crcRaw.toUpperCase().includes('CRC') ? crcRaw.toUpperCase() : `CRC: ${crcRaw.toUpperCase()}`;
            if (docRaw) docCargo += ` • CPF: ${docRaw}`;
            docCargo += ` • Contador Responsável`;
        } else if (docRaw) {
            docCargo = `CPF: ${docRaw} • Responsável Legal / Sócio`;
        } else {
            docCargo = 'Contador / Responsável Legal';
        }

        contadorCadastradoCache = {
            nome: nome.toUpperCase(),
            crc: docCargo,
            cpf: docRaw
        };

        const stampContadorNome = document.getElementById('stamp-contador-nome');
        if (stampContadorNome && nome) {
            stampContadorNome.innerText = nome.toUpperCase();
        }

        const stampContadorCrc = document.getElementById('stamp-contador-crc');
        if (stampContadorCrc && docCargo) {
            stampContadorCrc.innerText = docCargo;
        }
    }

    async function carregarDadosContadorERP() {
        if (typeof win.api !== 'function') return;

        try {
            // Tenta consultar a listagem de usuários para buscar contadores cadastrados
            const res = await win.api('/users');
            const users = Array.isArray(res?.data) ? res.data : [];

            const contadores = users.filter((u: any) => 
                (u.role === 'accountant' || u.role === 'auxiliar_contador') && u.is_active !== false
            );

            // Identifica o sócio / dono da empresa responsável padrão
            const socios = users.filter((u: any) => 
                u.role === 'socio' && u.is_active !== false
            );
            if (socios.length > 0) {
                const socioPadrao = socios.find((u: any) => Boolean(u.is_default_declaration_signer)) || socios[0];
                if (socioPadrao) {
                    responsavelEmpresaCache = {
                        nome: (socioPadrao.full_name || socioPadrao.name || '').toUpperCase(),
                        cpf: socioPadrao.cpf_cnpj ? formatarCpf(socioPadrao.cpf_cnpj, false) : ''
                    };
                }
            }

            if (contadores.length > 0) {
                // Seleciona o contador padrão se definido, ou o primeiro cadastrado
                const contadorPadrao = contadores.find((u: any) => Boolean(u.is_default_declaration_signer));
                const contadorPrincipal = contadorPadrao || contadores[0];
                aplicarDadosContador(contadorPrincipal);
            } else if (socios.length > 0 && responsavelEmpresaCache.nome) {
                // Se não houver contador cadastrado, usa o sócio responsável no segundo carimbo
                const stampContadorNome = document.getElementById('stamp-contador-nome');
                const stampContadorCrc = document.getElementById('stamp-contador-crc');
                if (stampContadorNome && (!stampContadorNome.innerText || stampContadorNome.innerText.includes('[NOME'))) {
                    stampContadorNome.innerText = responsavelEmpresaCache.nome;
                }
                if (stampContadorCrc && (!stampContadorCrc.innerText || stampContadorCrc.innerText.includes('000000'))) {
                    stampContadorCrc.innerText = responsavelEmpresaCache.cpf ? `CPF: ${responsavelEmpresaCache.cpf} • Responsável Legal / Sócio` : 'Responsável Legal / Sócio';
                }
            } else {
                // Se nenhum usuário tiver role='accountant', verifica se o usuário logado atual tem CRC
                const authUser = win.gNavbarAuthContext?.user;
                if (authUser?.crc) {
                    aplicarDadosContador(authUser);
                }
            }
        } catch (err) {
            console.debug('Consulta de usuários/contadores/sócios não disponível para a sessão atual:', err);
            const authUser = win.gNavbarAuthContext?.user;
            if (authUser?.crc) {
                aplicarDadosContador(authUser);
            }
        }
    }

    function abrirModalGovBr() {
        const modal = document.getElementById('modalGovBr');
        if (!modal) return;

        // Pré-preenche campos do modal a partir dos dados do carimbo ou do usuário
        const nomeAtual = document.querySelector<HTMLElement>('.sync-govbr-nome')?.innerText || '';
        const cpfAtual = document.querySelector<HTMLElement>('.sync-govbr-cpf')?.innerText || '';

        const inputNome = document.getElementById('modalInputGovBrNome') as HTMLInputElement | null;
        const inputCpf = document.getElementById('modalInputGovBrCpf') as HTMLInputElement | null;

        if (inputNome && nomeAtual && !nomeAtual.includes('[NOME')) {
            inputNome.value = nomeAtual;
        }
        if (inputCpf && cpfAtual && !cpfAtual.includes('000.000')) {
            inputCpf.value = cpfAtual;
        }

        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }

    function fecharModalGovBr() {
        const modal = document.getElementById('modalGovBr');
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
    }

    function configurarEventosGovBr() {
        // Alternadores de modo de assinatura
        document.getElementById('btnModoGovBr')?.addEventListener('click', () => definirModoAssinatura('govbr'));
        document.getElementById('btnModoIcp')?.addEventListener('click', () => definirModoAssinatura('icp'));
        document.getElementById('btnModoAmbos')?.addEventListener('click', () => definirModoAssinatura('ambos'));

        // Modal Gov.br
        document.getElementById('btnAbrirModalGovBr')?.addEventListener('click', abrirModalGovBr);
        document.getElementById('btnFecharModalGovBr')?.addEventListener('click', fecharModalGovBr);
        document.getElementById('btnFecharModalGovBrSecundario')?.addEventListener('click', fecharModalGovBr);

        // Botões de Preenchimento Rápido no Modal
        document.getElementById('btnPreencherGovBrEmpresa')?.addEventListener('click', () => {
            const inputNome = document.getElementById('modalInputGovBrNome') as HTMLInputElement | null;
            const inputCpf = document.getElementById('modalInputGovBrCpf') as HTMLInputElement | null;
            if (inputNome && responsavelEmpresaCache.nome) inputNome.value = responsavelEmpresaCache.nome;
            if (inputCpf && responsavelEmpresaCache.cpf) inputCpf.value = responsavelEmpresaCache.cpf;
        });

        document.getElementById('btnPreencherGovBrContador')?.addEventListener('click', () => {
            const inputNome = document.getElementById('modalInputGovBrNome') as HTMLInputElement | null;
            const inputCpf = document.getElementById('modalInputGovBrCpf') as HTMLInputElement | null;
            if (inputNome && contadorCadastradoCache.nome) inputNome.value = contadorCadastradoCache.nome;
            if (inputCpf && contadorCadastradoCache.cpf) inputCpf.value = contadorCadastradoCache.cpf;
        });

        // Ação: Exportar PDF e Abrir Assinador ITI Oficial
        document.getElementById('btnExportarPdfEAbrirIti')?.addEventListener('click', () => {
            window.open('https://assinador.iti.br/', '_blank', 'noopener,noreferrer');
            fecharModalGovBr();
            setTimeout(() => {
                window.print();
            }, 500);
        });

        // Ação: Aplicar Selo Gov.br no documento a partir do modal
        document.getElementById('btnAplicarSeloGovBrModal')?.addEventListener('click', () => {
            const inputNome = document.getElementById('modalInputGovBrNome') as HTMLInputElement | null;
            const inputCpf = document.getElementById('modalInputGovBrCpf') as HTMLInputElement | null;

            if (inputNome && inputNome.value.trim()) {
                atualizarTodosOsCampos('.sync-govbr-nome', inputNome.value.trim().toUpperCase());
            }
            if (inputCpf && inputCpf.value.trim()) {
                const cpfFmt = formatarCpf(inputCpf.value.trim(), false);
                atualizarTodosOsCampos('.sync-govbr-cpf', cpfFmt);
            }

            // Atualiza hora e novo hash com QR code
            atualizarDataExtenso();
            aplicarNovoHashGovBr();

            definirModoAssinatura('govbr');
            fecharModalGovBr();
        });

        // Regenerar Hash
        document.getElementById('btnRegenerarHashGovBr')?.addEventListener('click', () => {
            aplicarNovoHashGovBr();
        });
    }

    // 6. Carregar Sempre os Dados da Empresa Ativa Selecionada no ERP
    function aplicarDadosEmpresa(company: any, user?: any) {
        if (!company) return;

        const razaoSocial = company.company_name || company.razao_social || company.trade_name || company.nome_fantasia || company.name || '';
        const cnpj = company.cnpj ? formatarCnpj(company.cnpj) : '';

        if (razaoSocial) {
            atualizarTodosOsCampos('.sync-empresa', razaoSocial);
        }
        if (cnpj) {
            atualizarTodosOsCampos('.sync-cnpj', cnpj);
        }

        // Endereço Linha 1 (Logradouro + Número + Complemento + Bairro)
        const logradouro = company.street || company.logradouro || company.endereco || '';
        const numero = company.number || company.numero || '';
        const complemento = company.complement || company.complemento || '';
        const bairro = company.neighborhood || company.bairro || '';

        let enderecoLinha1 = '';
        if (logradouro) {
            enderecoLinha1 = `${logradouro}${numero ? ', ' + numero : ''}`;
            if (complemento) enderecoLinha1 += ` - ${complemento}`;
            if (bairro) enderecoLinha1 += ` - ${bairro}`;
            atualizarTodosOsCampos('.sync-endereco-linha1', enderecoLinha1);
        }

        // Endereço Linha 2 (Cidade + UF + CEP)
        const cidade = company.city || company.municipio || company.cidade || '';
        const uf = company.state || company.uf || company.estado || '';
        const cepRaw = company.zipcode || company.cep || '';
        const cepFormatado = cepRaw ? formatarCep(cepRaw) : '';

        if (cidade || uf) {
            const cidadeUfCep = `${cidade || 'Niterói'} - ${uf || 'RJ'}${cepFormatado ? ', CEP: ' + cepFormatado : ''}`;
            atualizarTodosOsCampos('.sync-endereco-linha2', cidadeUfCep);
            atualizarDataExtenso(cidade || 'Niterói', uf || 'RJ');
        }

        // Se o endereço no ERP estiver vazio, consulta a Receita via BrasilAPI pelo CNPJ para enriquecer
        if (!enderecoLinha1 && cnpj && cnpj.replace(/\D/g, '').length === 14) {
            const cnpjEl = document.querySelector<HTMLElement>('.sync-cnpj');
            if (cnpjEl) {
                buscarCnpjNaAPI(cnpjEl);
            }
        }

        // Responsável / Contador / Usuário Gov.br
        if (user) {
            const userName = user.full_name || user.name || '';
            const userCpf = user.cpf || user.cpf_cnpj ? formatarCpf(user.cpf || user.cpf_cnpj, false) : '';

            responsavelEmpresaCache = {
                nome: userName.toUpperCase(),
                cpf: userCpf
            };

            if (userName) {
                // Selo Gov.br padrão (preenche com o responsável)
                const govBrNomeEl = document.querySelector<HTMLElement>('.sync-govbr-nome');
                if (govBrNomeEl && (!govBrNomeEl.innerText || govBrNomeEl.innerText.includes('[NOME'))) {
                    atualizarTodosOsCampos('.sync-govbr-nome', userName.toUpperCase());
                }
            }

            if (userCpf) {
                const govBrCpfEl = document.querySelector<HTMLElement>('.sync-govbr-cpf');
                if (govBrCpfEl && (!govBrCpfEl.innerText || govBrCpfEl.innerText.includes('000.000'))) {
                    atualizarTodosOsCampos('.sync-govbr-cpf', userCpf);
                }
            }

            if (user.role === 'accountant' || user.role === 'auxiliar_contador' || user.crc) {
                aplicarDadosContador(user);
            }

            if (user.role || user.job_title) {
                const cargoEl = document.getElementById('stamp-govbr-cargo');
                if (cargoEl) cargoEl.innerText = user.role || user.job_title;
            }
        }
    }

    async function carregarEmpresaAtivaERP() {
        // Passo 1: Leitura instantânea síncrona do cache local (sem delay visual)
        const cachedName = localStorage.getItem('keystone_last_company_name') || '';
        const cachedCnpj = localStorage.getItem('keystone_last_company_cnpj') || '';

        if (cachedName) {
            atualizarTodosOsCampos('.sync-empresa', cachedName);
        }
        if (cachedCnpj) {
            atualizarTodosOsCampos('.sync-cnpj', formatarCnpj(cachedCnpj));
        }

        // Passo 2: Tenta obter contexto da navbar ou da API /auth/me
        try {
            let company = win.gNavbarAuthContext?.company;
            let user = win.gNavbarAuthContext?.user;

            if ((!company || !company.street) && typeof win.api === 'function') {
                const response = await win.api('/auth/me');
                if (response?.data) {
                    if (response.data.company) company = response.data.company;
                    if (response.data.user) user = response.data.user;
                }
            }

            if (company) {
                aplicarDadosEmpresa(company, user);
            } else if (cachedCnpj && cachedCnpj.replace(/\D/g, '').length === 14) {
                const cnpjEl = document.querySelector<HTMLElement>('.sync-cnpj');
                if (cnpjEl) {
                    buscarCnpjNaAPI(cnpjEl);
                }
            }
        } catch (e) {
            console.debug('Contexto de empresa ativa carregado do cache local:', e);
        }

        // Passo 3: Busca o contador cadastrado da empresa no ERP
        await carregarDadosContadorERP();
    }

    // 7. Inicialização no carregamento da página
    document.addEventListener('DOMContentLoaded', () => {
        configurarSincronizacao('sync-empresa');
        configurarSincronizacao('sync-cnpj');
        configurarSincronizacao('sync-mes-inicio');
        configurarSincronizacao('sync-ano-inicio');
        configurarSincronizacao('sync-mes-fim');
        configurarSincronizacao('sync-ano-fim');
        configurarSincronizacao('sync-govbr-nome');
        configurarSincronizacao('sync-govbr-cpf');

        document.querySelectorAll<HTMLElement>('.sync-cnpj').forEach(campo => {
            if (campo.getAttribute('contenteditable') === 'true') {
                campo.addEventListener('blur', function (this: HTMLElement) {
                    buscarCnpjNaAPI(this);
                });
            }
        });

        ['sync-mes-inicio', 'sync-ano-inicio', 'sync-mes-fim', 'sync-ano-fim'].forEach(classe => {
            document.querySelectorAll<HTMLElement>('.' + classe).forEach(campo => {
                if (campo.getAttribute('contenteditable') === 'true') {
                    campo.addEventListener('blur', atualizarTabelaMeses);
                }
            });
        });

        // Controles de Período da Toolbar (Mês/Ano Inicial até Mês/Ano Final)
        function aplicarPeriodoPelaToolbar() {
            const selIniMes = document.getElementById('toolbarSelectMesInicio') as HTMLSelectElement | null;
            const inpIniAno = document.getElementById('toolbarInputAnoInicio') as HTMLInputElement | null;
            const selFimMes = document.getElementById('toolbarSelectMesFim') as HTMLSelectElement | null;
            const inpFimAno = document.getElementById('toolbarInputAnoFim') as HTMLInputElement | null;

            if (!selIniMes || !inpIniAno || !selFimMes || !inpFimAno) return;

            const iniMes = parseInt(selIniMes.value, 10);
            const iniAno = parseInt(inpIniAno.value, 10);
            const fimMes = parseInt(selFimMes.value, 10);
            const fimAno = parseInt(inpFimAno.value, 10);

            if (isNaN(iniMes) || isNaN(iniAno) || isNaN(fimMes) || isNaN(fimAno) || iniAno < 1900 || fimAno < 1900) return;
            if (fimAno < iniAno || (fimAno === iniAno && fimMes < iniMes)) return;

            aplicarPeriodo(iniMes, iniAno, fimMes, fimAno);
        }

        document.getElementById('toolbarSelectMesInicio')?.addEventListener('change', aplicarPeriodoPelaToolbar);
        document.getElementById('toolbarInputAnoInicio')?.addEventListener('input', aplicarPeriodoPelaToolbar);
        document.getElementById('toolbarSelectMesFim')?.addEventListener('change', aplicarPeriodoPelaToolbar);
        document.getElementById('toolbarInputAnoFim')?.addEventListener('input', aplicarPeriodoPelaToolbar);

        // Toggle do Painel de Filtro (Estilo Customers ERP)
        const filterToggleBtn = document.getElementById('declaracao_filter_panel-filter-panel-toggle');
        const filterBody = document.getElementById('declaracao_filter_panel-filter-panel-body');
        const filterChevron = document.getElementById('declaracao_filter_panel-filter-panel-chevron');

        if (filterToggleBtn && filterBody) {
            let isFilterOpen = true;
            filterToggleBtn.addEventListener('click', () => {
                isFilterOpen = !isFilterOpen;
                if (isFilterOpen) {
                    filterBody.style.maxHeight = filterBody.scrollHeight + 'px';
                    filterBody.style.opacity = '1';
                    if (filterChevron) filterChevron.style.transform = 'rotate(0deg)';
                } else {
                    filterBody.style.maxHeight = '0px';
                    filterBody.style.opacity = '0';
                    if (filterChevron) filterChevron.style.transform = 'rotate(-90deg)';
                }
            });
            filterBody.style.transition = 'max-height 0.3s ease, opacity 0.3s ease';
            filterBody.style.maxHeight = filterBody.scrollHeight + 'px';
        }


        // Ações de Carregamento de Dados (Faturamento e Receitas)
        document.getElementById('btnPuxarFaturamento')?.addEventListener('click', () => void importarFaturamentoDoERP());
        document.getElementById('btnPuxarReceitas')?.addEventListener('click', () => void importarReceitasDoERP());
        document.getElementById('btnBuscarEmpresaAtiva')?.addEventListener('click', () => {
            const select = document.getElementById('toolbarSelectCliente') as HTMLSelectElement | null;
            if (select) select.value = '';
            carregarEmpresaAtivaERP();
            atualizarComboboxDeclaracoesSalvas(undefined, true, false);
        });

        // Ações de Salvar e Gerenciar Declarações Salvas (Combobox)
        document.getElementById('btnSalvarDeclaracao')?.addEventListener('click', () => {
            salvarDeclaracaoAtual();
        });

        document.getElementById('btnCarregarDeclaracaoSalva')?.addEventListener('click', () => {
            const select = document.getElementById('selectDeclaracoesSalvas') as HTMLSelectElement | null;
            if (select && select.value) {
                carregarDeclaracaoSalva(select.value, false);
            } else {
                (win.UI as any)?.showAlert?.('alertMessage', 'Selecione uma declaração salva no combobox para carregar.', 'info');
            }
        });

        document.getElementById('selectDeclaracoesSalvas')?.addEventListener('change', (e: Event) => {
            const select = e.target as HTMLSelectElement;
            if (select.value) {
                carregarDeclaracaoSalva(select.value, false);
            }
        });

        document.getElementById('btnExcluirDeclaracaoSalva')?.addEventListener('click', () => {
            const select = document.getElementById('selectDeclaracoesSalvas') as HTMLSelectElement | null;
            if (select && select.value) {
                excluirDeclaracaoSalva(select.value);
            } else {
                (win.UI as any)?.showAlert?.('alertMessage', 'Selecione uma declaração salva no combobox para excluir.', 'info');
            }
        });

        // Seletor de Cliente / Empresa Cadastrada no Filtro
        document.getElementById('toolbarSelectCliente')?.addEventListener('change', (e: Event) => {
            const select = e.target as HTMLSelectElement;
            const custId = select.value ? String(select.value) : '';
            if (!custId) {
                carregarEmpresaAtivaERP();
            } else {
                const found = clientesCache.find(c => String(c.id) === custId);
                if (found) {
                    aplicarDadosCliente(found);
                }
            }
            atualizarComboboxDeclaracoesSalvas(undefined, true, false);
        });

        // Configuração Gov.br e assinaturas
        configurarEventosGovBr();

        // Inicialização
        aplicarNovoHashGovBr();

        atualizarDataExtenso();
        preencherUltimos12Meses();
        carregarEmpresaAtivaERP();
        carregarClientesNoSeletor();
        atualizarComboboxDeclaracoesSalvas(undefined, true, true);

        // Repete o carregamento após pequeno delay para garantir que o navbar.js já concluiu a injeção do contexto
        setTimeout(() => {
            carregarEmpresaAtivaERP();
            carregarClientesNoSeletor();
            atualizarComboboxDeclaracoesSalvas(undefined, false, true);
        }, 300);
        setTimeout(() => {
            carregarEmpresaAtivaERP();
            atualizarComboboxDeclaracoesSalvas(undefined, false, true);
        }, 1000);
    });

    // Sincroniza se houver troca de storage entre abas
    window.addEventListener('storage', (e: StorageEvent) => {
        if (e.key === 'keystone_last_company_name' || e.key === 'keystone_last_company_cnpj' || e.key === 'keystone_last_company_public_id') {
            carregarEmpresaAtivaERP();
            atualizarComboboxDeclaracoesSalvas(undefined, false, true);
        }
    });
})();
