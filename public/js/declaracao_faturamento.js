// Keystone ERP - Declaração de Faturamento
// Gerenciamento de documento fiscal/cadastral com preenchimento dinâmico, máscara de moeda e cálculo em tempo real
// @ts-nocheck
(() => {
    const win = window;
    // Memória para manter os valores editados por competência (mes-ano)
    const memoriaValores = {};
    const mesesNomes = [
        'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
        'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
    ];
    // 1. Prevenir quebra de linha com Enter em contenteditable
    document.addEventListener('keydown', (e) => {
        const target = e.target;
        if (target && target.getAttribute('contenteditable') === 'true') {
            if (e.key === 'Enter') {
                e.preventDefault();
                target.blur();
            }
        }
    });
    // 2. Formatação e Manipulação de CNPJ / BrasilAPI
    function formatarCnpj(cnpj) {
        if (!cnpj)
            return '';
        const limpo = cnpj.toString().replace(/\D/g, '');
        if (limpo.length === 14) {
            return limpo.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
        }
        return cnpj.toString().trim();
    }
    function formatarCep(cep) {
        if (!cep)
            return '';
        const limpo = cep.toString().replace(/\D/g, '');
        if (limpo.length === 8) {
            return limpo.replace(/^(\d{5})(\d{3})$/, '$1-$2');
        }
        return cep.toString().trim();
    }
    function formatarCpf(cpf, ocultar = false) {
        if (!cpf)
            return '';
        const limpo = cpf.toString().replace(/\D/g, '');
        if (limpo.length === 11) {
            if (ocultar) {
                return `***.${limpo.substring(3, 6)}.${limpo.substring(6, 9)}-**`;
            }
            return limpo.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
        }
        return cpf.toString().trim();
    }
    function gerarHashGovBr() {
        const hexChars = '0123456789ABCDEF';
        const blocos = [];
        for (let b = 0; b < 6; b++) {
            let bloco = '';
            for (let c = 0; c < 4; c++) {
                bloco += hexChars.charAt(Math.floor(Math.random() * hexChars.length));
            }
            blocos.push(bloco);
        }
        return blocos.join('-');
    }
    function atualizarQrCodeGovBr(hash) {
        const qrImg = document.getElementById('govbr-qr-image');
        if (qrImg) {
            const validationUrl = hash
                ? `https://validar.iti.br/?codigo=${encodeURIComponent(hash)}`
                : 'https://validar.iti.br';
            qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(validationUrl)}`;
        }
    }
    function aplicarNovoHashGovBr() {
        const novoHash = gerarHashGovBr();
        const hashEl = document.getElementById('stamp-govbr-hash');
        if (hashEl)
            hashEl.innerText = novoHash;
        atualizarQrCodeGovBr(novoHash);
        return novoHash;
    }
    async function buscarCnpjNaAPI(cnpjElement) {
        const cnpjLimpo = cnpjElement.innerText.replace(/\D/g, '');
        if (cnpjLimpo.length === 14) {
            const cnpjFormatado = formatarCnpj(cnpjLimpo);
            atualizarTodosOsCampos('.sync-cnpj', cnpjFormatado);
            atualizarTodosOsCampos('.sync-empresa', 'Buscando dados na Receita Federal...');
            try {
                const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`);
                if (!response.ok)
                    throw new Error('CNPJ não encontrado');
                const data = await response.json();
                if (data.razao_social) {
                    atualizarTodosOsCampos('.sync-empresa', data.razao_social);
                }
                let logradouro = `${data.logradouro || ''}, ${data.numero || 'S/N'}`;
                if (data.complemento)
                    logradouro += ` - ${data.complemento}`;
                if (data.bairro)
                    logradouro += ` - ${data.bairro}`;
                atualizarTodosOsCampos('.sync-endereco-linha1', logradouro);
                const cepFormatado = formatarCep(data.cep || '');
                const cidadeUfCep = `${data.municipio || ''} - ${data.uf || ''}${cepFormatado ? ', CEP: ' + cepFormatado : ''}`;
                atualizarTodosOsCampos('.sync-endereco-linha2', cidadeUfCep);
                if (data.municipio && data.uf) {
                    atualizarDataExtenso(data.municipio, data.uf);
                }
            }
            catch (error) {
                console.warn('Erro ao consultar BrasilAPI:', error);
                const nomeFallback = localStorage.getItem('keystone_last_company_name') || '[NOME DA SUA EMPRESA LTDA]';
                atualizarTodosOsCampos('.sync-empresa', nomeFallback);
            }
        }
    }
    function atualizarTodosOsCampos(classeCss, valor) {
        if (!valor)
            return;
        document.querySelectorAll(classeCss).forEach(campo => {
            campo.innerText = valor;
        });
    }
    // 3. Funções Auxiliares de Meses e Datas
    function getMesIndex(m) {
        if (!m)
            return -1;
        const limpo = m.toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace('ç', 'c').toLowerCase().trim();
        return mesesNomes.findIndex(nome => nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace('ç', 'c') === limpo);
    }
    function parseValorMoeda(texto) {
        if (!texto)
            return 0;
        const textoLimpo = texto.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
        const num = parseFloat(textoLimpo);
        return isNaN(num) ? 0 : num;
    }
    function formatarMoeda(valor) {
        return valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    function calcularTotal() {
        let total = 0;
        document.querySelectorAll('.valor-mes').forEach(celula => {
            total += parseValorMoeda(celula.innerText);
        });
        const totalEl = document.getElementById('total-anual');
        if (totalEl) {
            totalEl.innerText = formatarMoeda(total);
        }
    }
    function formatarMoedaInput(texto) {
        const valor = parseValorMoeda(texto);
        return formatarMoeda(valor);
    }
    function anexarEventosValores() {
        document.querySelectorAll('.valor-mes').forEach(celula => {
            celula.addEventListener('input', function () {
                const key = this.getAttribute('data-key');
                if (key)
                    memoriaValores[key] = this.innerText;
                calcularTotal();
            });
            celula.addEventListener('focus', function () {
                if (this.innerText.trim() === '0,00' || this.innerText.trim() === '0') {
                    this.innerText = '';
                }
            });
            celula.addEventListener('blur', function () {
                const texto = this.innerText.trim();
                this.innerText = texto === '' ? '0,00' : formatarMoedaInput(texto);
                const key = this.getAttribute('data-key');
                if (key)
                    memoriaValores[key] = this.innerText;
                calcularTotal();
            });
        });
    }
    function atualizarTabelaMeses() {
        const elMesIni = document.querySelector('.sync-mes-inicio');
        const elAnoIni = document.querySelector('.sync-ano-inicio');
        const elMesFim = document.querySelector('.sync-mes-fim');
        const elAnoFim = document.querySelector('.sync-ano-fim');
        if (!elMesIni || !elAnoIni || !elMesFim || !elAnoFim)
            return;
        const startMes = getMesIndex(elMesIni.innerText);
        const endMes = getMesIndex(elMesFim.innerText);
        const txtAnoInicio = parseInt(elAnoIni.innerText.trim(), 10);
        const txtAnoFim = parseInt(elAnoFim.innerText.trim(), 10);
        if (startMes === -1 || endMes === -1 || isNaN(txtAnoInicio) || isNaN(txtAnoFim) || txtAnoInicio < 1900 || txtAnoFim < 1900)
            return;
        if (txtAnoFim < txtAnoInicio || (txtAnoFim === txtAnoInicio && endMes < startMes))
            return;
        const tbody = document.getElementById('tbody-meses');
        if (!tbody)
            return;
        tbody.innerHTML = '';
        let currentMes = startMes;
        let currentAno = txtAnoInicio;
        let limit = 0;
        while (limit < 60) {
            const mesNomeFormatado = mesesNomes[currentMes].charAt(0).toUpperCase() + mesesNomes[currentMes].slice(1);
            const key = `${currentMes}-${currentAno}`;
            const valorAtual = memoriaValores[key] || '0,00';
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${mesNomeFormatado} / ${currentAno}</td>
                            <td>R$ <span contenteditable="true" class="valor-mes" data-key="${key}">${valorAtual}</span></td>`;
            tbody.appendChild(tr);
            if (currentMes === endMes && currentAno === txtAnoFim)
                break;
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
    function configurarSincronizacao(classeCss) {
        const campos = document.querySelectorAll('.' + classeCss);
        campos.forEach(campo => {
            if (campo.getAttribute('contenteditable') === 'true') {
                campo.addEventListener('input', function () {
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
    // 4. Presets rápidos de período
    function aplicarPeriodo(iniMesIdx, iniAno, fimMesIdx, fimAno) {
        const iniNome = mesesNomes[iniMesIdx].charAt(0).toUpperCase() + mesesNomes[iniMesIdx].slice(1);
        const fimNome = mesesNomes[fimMesIdx].charAt(0).toUpperCase() + mesesNomes[fimMesIdx].slice(1);
        atualizarTodosOsCampos('.sync-mes-inicio', iniNome);
        atualizarTodosOsCampos('.sync-ano-inicio', iniAno.toString());
        atualizarTodosOsCampos('.sync-mes-fim', fimNome);
        atualizarTodosOsCampos('.sync-ano-fim', fimAno.toString());
        atualizarTabelaMeses();
    }
    function preencherUltimos12Meses() {
        const hoje = new Date();
        let fimMes = hoje.getMonth() - 1; // Mês anterior fechado
        let fimAno = hoje.getFullYear();
        if (fimMes < 0) {
            fimMes = 11;
            fimAno--;
        }
        const iniData = new Date(fimAno, fimMes - 11, 1);
        const iniMes = iniData.getMonth();
        const iniAno = iniData.getFullYear();
        aplicarPeriodo(iniMes, iniAno, fimMes, fimAno);
    }
    function preencherAnoAtual() {
        const hoje = new Date();
        const ano = hoje.getFullYear();
        aplicarPeriodo(0, ano, 11, ano);
    }
    function preencherUltimos6Meses() {
        const hoje = new Date();
        let fimMes = hoje.getMonth() - 1;
        let fimAno = hoje.getFullYear();
        if (fimMes < 0) {
            fimMes = 11;
            fimAno--;
        }
        const iniData = new Date(fimAno, fimMes - 5, 1);
        const iniMes = iniData.getMonth();
        const iniAno = iniData.getFullYear();
        aplicarPeriodo(iniMes, iniAno, fimMes, fimAno);
    }
    function zerarValores() {
        document.querySelectorAll('.valor-mes').forEach(celula => {
            celula.innerText = '0,00';
            const key = celula.getAttribute('data-key');
            if (key)
                memoriaValores[key] = '0,00';
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
        if (stampEmpresa)
            stampEmpresa.innerText = `Data: ${tsFormatado}`;
        if (stampContador)
            stampContador.innerText = `Data: ${tsFormatado}`;
        if (stampGovBr)
            stampGovBr.innerText = tsFormatado;
    }
    // 5. Modos de Assinatura & Assinatura Gov.br
    function definirModoAssinatura(modo) {
        const secGovBr = document.getElementById('secao-assinatura-govbr');
        const secIcp = document.getElementById('secao-assinaturas-icp');
        const btnGov = document.getElementById('btnModoGovBr');
        const btnIcp = document.getElementById('btnModoIcp');
        const btnAmbos = document.getElementById('btnModoAmbos');
        const resetBtn = (btn) => {
            if (!btn)
                return;
            btn.className = 'px-2.5 py-1 rounded-md font-medium text-xs transition-colors bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-slate-600 hover:bg-gray-100';
        };
        const setActiveBtn = (btn, bgClass = 'bg-[#1351b4]') => {
            if (!btn)
                return;
            btn.className = `px-2.5 py-1 rounded-md font-medium text-xs transition-colors ${bgClass} text-white shadow-xs`;
        };
        resetBtn(btnGov);
        resetBtn(btnIcp);
        resetBtn(btnAmbos);
        if (modo === 'govbr') {
            if (secGovBr)
                secGovBr.style.display = 'flex';
            if (secIcp)
                secIcp.style.display = 'none';
            setActiveBtn(btnGov, 'bg-[#1351b4]');
        }
        else if (modo === 'icp') {
            if (secGovBr)
                secGovBr.style.display = 'none';
            if (secIcp)
                secIcp.style.display = 'flex';
            setActiveBtn(btnIcp, 'bg-emerald-600');
        }
        else if (modo === 'ambos') {
            if (secGovBr)
                secGovBr.style.display = 'flex';
            if (secIcp)
                secIcp.style.display = 'flex';
            setActiveBtn(btnAmbos, 'bg-slate-800 dark:bg-slate-600');
        }
    }
    // Estado em memória para preenchimento rápido
    let responsavelEmpresaCache = { nome: '', cpf: '' };
    let contadorCadastradoCache = { nome: '', crc: '', cpf: '' };
    function aplicarDadosContador(contador) {
        if (!contador)
            return;
        const nome = contador.full_name || contador.name || '';
        const crcRaw = contador.crc || '';
        const docRaw = contador.cpf_cnpj ? formatarCpf(contador.cpf_cnpj, false) : '';
        let crcFormatado = '';
        if (crcRaw) {
            crcFormatado = crcRaw.toUpperCase().includes('CRC') ? crcRaw.toUpperCase() : `CRC: ${crcRaw.toUpperCase()}`;
        }
        else if (docRaw) {
            crcFormatado = `CPF: ${docRaw}`;
        }
        contadorCadastradoCache = {
            nome: nome.toUpperCase(),
            crc: crcFormatado,
            cpf: docRaw
        };
        const stampContadorNome = document.getElementById('stamp-contador-nome');
        if (stampContadorNome && nome) {
            stampContadorNome.innerText = nome.toUpperCase();
        }
        const stampContadorCrc = document.getElementById('stamp-contador-crc');
        if (stampContadorCrc && crcFormatado) {
            stampContadorCrc.innerText = crcFormatado;
        }
    }
    async function carregarDadosContadorERP() {
        if (typeof win.api !== 'function')
            return;
        try {
            // Tenta consultar a listagem de usuários para buscar contadores cadastrados
            const res = await win.api('/users');
            const users = Array.isArray(res?.data) ? res.data : [];
            const contadores = users.filter((u) => (u.role === 'accountant' || u.role === 'auxiliar_contador') && u.is_active !== false);
            if (contadores.length > 0) {
                // Seleciona o contador padrão se definido, ou o primeiro cadastrado
                const contadorPadrao = contadores.find((u) => Boolean(u.is_default_declaration_signer));
                const contadorPrincipal = contadorPadrao || contadores[0];
                aplicarDadosContador(contadorPrincipal);
            }
            else {
                // Se nenhum usuário tiver role='accountant', verifica se o usuário logado atual tem CRC
                const authUser = win.gNavbarAuthContext?.user;
                if (authUser?.crc) {
                    aplicarDadosContador(authUser);
                }
            }
        }
        catch (err) {
            console.debug('Consulta de usuários/contadores não disponível para a sessão atual:', err);
            const authUser = win.gNavbarAuthContext?.user;
            if (authUser?.crc) {
                aplicarDadosContador(authUser);
            }
        }
    }
    function abrirModalGovBr() {
        const modal = document.getElementById('modalGovBr');
        if (!modal)
            return;
        // Pré-preenche campos do modal a partir dos dados do carimbo ou do usuário
        const nomeAtual = document.querySelector('.sync-govbr-nome')?.innerText || '';
        const cpfAtual = document.querySelector('.sync-govbr-cpf')?.innerText || '';
        const inputNome = document.getElementById('modalInputGovBrNome');
        const inputCpf = document.getElementById('modalInputGovBrCpf');
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
            const inputNome = document.getElementById('modalInputGovBrNome');
            const inputCpf = document.getElementById('modalInputGovBrCpf');
            if (inputNome && responsavelEmpresaCache.nome)
                inputNome.value = responsavelEmpresaCache.nome;
            if (inputCpf && responsavelEmpresaCache.cpf)
                inputCpf.value = responsavelEmpresaCache.cpf;
        });
        document.getElementById('btnPreencherGovBrContador')?.addEventListener('click', () => {
            const inputNome = document.getElementById('modalInputGovBrNome');
            const inputCpf = document.getElementById('modalInputGovBrCpf');
            if (inputNome && contadorCadastradoCache.nome)
                inputNome.value = contadorCadastradoCache.nome;
            if (inputCpf && contadorCadastradoCache.cpf)
                inputCpf.value = contadorCadastradoCache.cpf;
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
            const inputNome = document.getElementById('modalInputGovBrNome');
            const inputCpf = document.getElementById('modalInputGovBrCpf');
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
    function aplicarDadosEmpresa(company, user) {
        if (!company)
            return;
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
            if (complemento)
                enderecoLinha1 += ` - ${complemento}`;
            if (bairro)
                enderecoLinha1 += ` - ${bairro}`;
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
            const cnpjEl = document.querySelector('.sync-cnpj');
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
                const govBrNomeEl = document.querySelector('.sync-govbr-nome');
                if (govBrNomeEl && (!govBrNomeEl.innerText || govBrNomeEl.innerText.includes('[NOME'))) {
                    atualizarTodosOsCampos('.sync-govbr-nome', userName.toUpperCase());
                }
            }
            if (userCpf) {
                const govBrCpfEl = document.querySelector('.sync-govbr-cpf');
                if (govBrCpfEl && (!govBrCpfEl.innerText || govBrCpfEl.innerText.includes('000.000'))) {
                    atualizarTodosOsCampos('.sync-govbr-cpf', userCpf);
                }
            }
            if (user.role === 'accountant' || user.role === 'auxiliar_contador' || user.crc) {
                aplicarDadosContador(user);
            }
            if (user.role || user.job_title) {
                const cargoEl = document.getElementById('stamp-govbr-cargo');
                if (cargoEl)
                    cargoEl.innerText = user.role || user.job_title;
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
                    if (response.data.company)
                        company = response.data.company;
                    if (response.data.user)
                        user = response.data.user;
                }
            }
            if (company) {
                aplicarDadosEmpresa(company, user);
            }
            else if (cachedCnpj && cachedCnpj.replace(/\D/g, '').length === 14) {
                const cnpjEl = document.querySelector('.sync-cnpj');
                if (cnpjEl) {
                    buscarCnpjNaAPI(cnpjEl);
                }
            }
        }
        catch (e) {
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
        document.querySelectorAll('.sync-cnpj').forEach(campo => {
            if (campo.getAttribute('contenteditable') === 'true') {
                campo.addEventListener('blur', function () {
                    buscarCnpjNaAPI(this);
                });
            }
        });
        ['sync-mes-inicio', 'sync-ano-inicio', 'sync-mes-fim', 'sync-ano-fim'].forEach(classe => {
            document.querySelectorAll('.' + classe).forEach(campo => {
                if (campo.getAttribute('contenteditable') === 'true') {
                    campo.addEventListener('blur', atualizarTabelaMeses);
                }
            });
        });
        // Botões da Toolbar
        document.getElementById('btnPreset12Meses')?.addEventListener('click', preencherUltimos12Meses);
        document.getElementById('btnPresetAnoAtual')?.addEventListener('click', preencherAnoAtual);
        document.getElementById('btnBuscarEmpresaAtiva')?.addEventListener('click', carregarEmpresaAtivaERP);
        // Configuração Gov.br e assinaturas
        configurarEventosGovBr();
        // Inicialização
        aplicarNovoHashGovBr();
        atualizarDataExtenso();
        preencherUltimos12Meses();
        carregarEmpresaAtivaERP();
        // Repete o carregamento após pequeno delay para garantir que o navbar.js já concluiu a injeção do contexto
        setTimeout(() => {
            carregarEmpresaAtivaERP();
        }, 300);
        setTimeout(() => {
            carregarEmpresaAtivaERP();
        }, 1000);
    });
    // Sincroniza se houver troca de storage entre abas
    window.addEventListener('storage', (e) => {
        if (e.key === 'keystone_last_company_name' || e.key === 'keystone_last_company_cnpj' || e.key === 'keystone_last_company_public_id') {
            carregarEmpresaAtivaERP();
        }
    });
})();
