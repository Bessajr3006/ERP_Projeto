document.addEventListener('DOMContentLoaded', () => {
    if (Auth.isAuthenticated()) {
        window.location.href = '/pages/dashboard.html';
        return;
    }
    const form = document.getElementById('registerForm');
    const submitBtn = document.getElementById('submitBtn');

    const generateAutoPassword = () => {
        const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
        const length = 16;
        const randomBytes = new Uint32Array(length);
        window.crypto.getRandomValues(randomBytes);

        let value = '';
        for (let i = 0; i < length; i += 1) {
            value += alphabet[randomBytes[i] % alphabet.length];
        }

        return value;
    };
    // Configuração da máscara do CNPJ
    const cnpjInput = document.getElementById('cnpj');
    const whatsappInput = document.getElementById('whatsapp');
    const companyNameInput = document.getElementById('companyName');
    const cnpjLoading = document.getElementById('cnpjLoading');
    const cnpjError = document.getElementById('cnpjError');
    const makeMask = window.createMaskAdapter || ((input, options) => window.IMask?.(input, options));
    const cnpjMask = makeMask ? makeMask(cnpjInput, { mask: '00.000.000/0000-00' }) : null;
    const whatsappMask = makeMask ? makeMask(whatsappInput, { mask: '(00) 00000-0000' }) : null;
    let lastCnpjLookup = { cnpj: '', data: null };

    const setCnpjError = (message) => {
        if (!cnpjError)
            return;
        cnpjError.textContent = message;
        cnpjError.classList.remove('hidden');
    };

    const fetchCompanyByCnpj = async (cnpjDigits) => {
        if (lastCnpjLookup.cnpj === cnpjDigits && lastCnpjLookup.data) {
            return lastCnpjLookup.data;
        }

        if (cnpjLoading) {
            cnpjLoading.classList.remove('hidden');
        }
        if (cnpjError) {
            cnpjError.classList.add('hidden');
        }
        if (companyNameInput) {
            companyNameInput.readOnly = true;
            companyNameInput.classList.add('bg-gray-100');
        }

        try {
            const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjDigits}`);
            const data = await response.json();
            if (!response.ok || !data?.razao_social) {
                return null;
            }

            lastCnpjLookup = { cnpj: cnpjDigits, data };
            return data;
        }
        catch (error) {
            console.error('Falha ao buscar CNPJ:', error);
            return null;
        }
        finally {
            if (cnpjLoading) {
                cnpjLoading.classList.add('hidden');
            }
            if (companyNameInput) {
                companyNameInput.readOnly = false;
                companyNameInput.classList.remove('bg-gray-100');
            }
        }
    };

    if (cnpjInput) {
        cnpjInput.addEventListener('input', () => {
            lastCnpjLookup = { cnpj: '', data: null };
            if (cnpjError) {
                cnpjError.classList.add('hidden');
            }
        });
    }

    if (cnpjInput && cnpjMask && companyNameInput && cnpjLoading && cnpjError) {
        // Busca dados da Empresa via CNPJ (BrasilAPI)
        cnpjInput.addEventListener('blur', async () => {
            const unmaskedCnpj = String(cnpjMask.unmaskedValue || '');
            if (unmaskedCnpj.length === 14) {
                const data = await fetchCompanyByCnpj(unmaskedCnpj);
                if (data?.razao_social) {
                    companyNameInput.value = data.razao_social;
                }
                else {
                    companyNameInput.value = '';
                    setCnpjError('CNPJ inválido ou não encontrado na API.');
                }
            }
        });
    }
    if (!form || !submitBtn)
        return;
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const companyNameEl = document.getElementById('companyName');
        const nameEl = document.getElementById('name');
        const emailEl = document.getElementById('email');
        if (!companyNameEl || !nameEl || !emailEl)
            return;
        const cnpjDigits = String(cnpjMask?.unmaskedValue || '').trim();
        if (cnpjDigits.length !== 14) {
            setCnpjError('Informe um CNPJ válido com 14 dígitos.');
            UI.showAlert('alertMessage', 'CNPJ é obrigatório para cadastro da empresa.');
            return;
        }

        const cnpjData = await fetchCompanyByCnpj(cnpjDigits);
        if (!cnpjData?.razao_social) {
            setCnpjError('Não foi possível consultar o CNPJ na API.');
            UI.showAlert('alertMessage', 'Não foi possível validar o CNPJ na API. Verifique e tente novamente.');
            return;
        }

        companyNameEl.value = cnpjData.razao_social;
        const rawCompany = companyNameEl.value;
        // Limitamos o tamanho máximo do companyName para 150 caso a API retorne gigante
        const companyName = rawCompany.substring(0, 150);
        const name = nameEl.value;
        const companyEmail = String(emailEl.value || '').trim();
        const userEmail = companyEmail || `admin.${cnpjDigits}@keystone.local`;
        const whatsappDigits = String(whatsappMask?.unmaskedValue || whatsappInput?.value || '').replace(/\D/g, '');
        if (whatsappDigits && whatsappDigits.length < 10) {
            UI.showAlert('alertMessage', 'Informe um WhatsApp válido com DDD.');
            return;
        }
        const password = generateAutoPassword();
        UI.hideAlert('alertMessage');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Registrando...';
        try {
            // Primeiro criamos a empresa
            const compRes = await fetch('/api/v1/companies', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    trade_name: companyName,
                    company_name: companyNameEl.value,
                    cnpj: cnpjDigits,
                    email: companyEmail || undefined,
                    phone: whatsappDigits || undefined
                })
            });
            const compData = await compRes.json();
            if (!compRes.ok) {
                throw new Error(compData?.message || (compData?.errors ? 'Erro dados de empresa' : 'Erro ao criar empresa'));
            }
            const companyId = compData?.data?.id;
            // Criamos o admin passando id
            const responseData = await fetch('/api/v1/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    company_id: parseInt(String(companyId), 10),
                    full_name: name,
                    email: userEmail,
                    passwordRaw: password
                })
            });
            const data = await responseData.json();
            if (!responseData.ok) {
                throw new Error(data?.message || (data?.errors ? JSON.stringify(data.errors) : 'Erro no cadastro do usuário.'));
            }
            alert('Empresa cadastrada com sucesso! Faça login para acessar o sistema.');
            window.location.href = '/index.html';
        }
        catch (error) {
            UI.showAlert('alertMessage', error?.message || 'Erro ao realizar cadastro.');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Criar Conta e Empresa';
        }
    });
});
