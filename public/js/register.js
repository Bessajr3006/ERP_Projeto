document.addEventListener('DOMContentLoaded', () => {
    if (Auth.isAuthenticated()) {
        window.location.href = '/pages/dashboard.html';
        return;
    }
    const form = document.getElementById('registerForm');
    const submitBtn = document.getElementById('submitBtn');
    const togglePasswordBtn = document.getElementById('togglePasswordBtn');
    if (togglePasswordBtn) {
        togglePasswordBtn.addEventListener('click', () => {
            const passwordInput = document.getElementById('password');
            const eyeOpen = document.getElementById('eyeIconOpen');
            const eyeClosed = document.getElementById('eyeIconClosed');
            if (passwordInput && eyeOpen && eyeClosed) {
                const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
                passwordInput.setAttribute('type', type);
                eyeOpen.classList.toggle('hidden');
                eyeClosed.classList.toggle('hidden');
            }
        });
    }
    // Configuração da máscara do CNPJ
    const cnpjInput = document.getElementById('cnpj');
    const companyNameInput = document.getElementById('companyName');
    const cnpjLoading = document.getElementById('cnpjLoading');
    const cnpjError = document.getElementById('cnpjError');
    const makeMask = window.createMaskAdapter || ((input, options) => window.IMask?.(input, options));
    const cnpjMask = makeMask ? makeMask(cnpjInput, { mask: '00.000.000/0000-00' }) : null;
    if (cnpjInput && cnpjMask && companyNameInput && cnpjLoading && cnpjError) {
        // Busca dados da Empresa via CNPJ (BrasilAPI)
        cnpjInput.addEventListener('blur', async () => {
            const unmaskedCnpj = String(cnpjMask.unmaskedValue || '');
            if (unmaskedCnpj.length === 14) {
                cnpjLoading.classList.remove('hidden');
                cnpjError.classList.add('hidden');
                companyNameInput.readOnly = true;
                companyNameInput.classList.add('bg-gray-100');
                try {
                    const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${unmaskedCnpj}`);
                    const data = await response.json();
                    if (response.ok && data?.razao_social) {
                        companyNameInput.value = data.razao_social;
                    }
                    else {
                        cnpjError.classList.remove('hidden');
                        companyNameInput.value = '';
                    }
                }
                catch (error) {
                    console.error('Falha ao buscar CNPJ:', error);
                    cnpjError.classList.remove('hidden');
                }
                finally {
                    cnpjLoading.classList.add('hidden');
                    companyNameInput.readOnly = false;
                    companyNameInput.classList.remove('bg-gray-100');
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
        const passwordEl = document.getElementById('password');
        if (!companyNameEl || !nameEl || !emailEl || !passwordEl)
            return;
        const rawCompany = companyNameEl.value;
        // Limitamos o tamanho máximo do companyName para 150 caso a API retorne gigante
        const companyName = rawCompany.substring(0, 150);
        const name = nameEl.value;
        const email = emailEl.value;
        const password = passwordEl.value;
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
                    cnpj: cnpjMask?.unmaskedValue || undefined
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
                    email,
                    passwordRaw: password
                })
            });
            const data = await responseData.json();
            if (!responseData.ok) {
                throw new Error(data?.message || (data?.errors ? JSON.stringify(data.errors) : 'Erro no cadastro do usuário.'));
            }
            const tokenSaved = Auth.setToken(data?.data?.token || data?.token);
            if (!tokenSaved) {
                throw new Error('O servidor não retornou um token de acesso válido para concluir o cadastro.');
            }
            alert('Cadastro realizado com sucesso! Bem-vindo ao KEYSTONE.');
            window.location.href = '/pages/dashboard.html';
        }
        catch (error) {
            UI.showAlert('alertMessage', error?.message || 'Erro ao realizar cadastro.');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Criar Conta e Empresa';
        }
    });
});
