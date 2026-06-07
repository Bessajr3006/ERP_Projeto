document.addEventListener('DOMContentLoaded', () => {
    // Se já estiver logado, redireciona para o dashboard
    if (Auth.isAuthenticated()) {
        window.location.href = '/pages/dashboard.html';
        return;
    }
    const form = document.getElementById('loginForm');
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
    if (!form || !submitBtn)
        return;
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const emailInput = document.getElementById('email');
        const passwordInput = document.getElementById('password');
        if (!emailInput || !passwordInput)
            return;
        const email = emailInput.value;
        const password = passwordInput.value;
        UI.hideAlert('alertMessage');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Carregando...';
        try {
            const data = await api('/auth/login', {
                method: 'POST',
                body: JSON.stringify({ email, passwordRaw: password })
            });
            const tokenSaved = Auth.setToken(data?.data?.token || data?.token);
            if (!tokenSaved) {
                throw new Error('O servidor não retornou um token de acesso válido para este usuário.');
            }
            const defaultPage = data?.data?.user?.default_page;
            window.location.href = defaultPage || '/pages/dashboard.html';
        }
        catch (error) {
            UI.showAlert('alertMessage', error?.message || 'Erro ao realizar login. Tente novamente.');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Entrar no Sistema';
        }
    });
});
