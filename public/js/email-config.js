(() => {
    const getEl = (id) => document.getElementById(id);

    function showAlert(type, message, timeout = 5000) {
        const el = getEl('alertMessage');
        if (!el) return;
        const classes = {
            success: 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-800/40',
            error: 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800/40',
            info: 'bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800/40',
        };
        el.className = `mb-4 rounded-lg px-4 py-3 text-sm ${classes[type] || classes.info}`;
        el.textContent = message;
        el.classList.remove('hidden');
        if (timeout > 0) {
            setTimeout(() => el.classList.add('hidden'), timeout);
        }
    }

    function setLoading(btn, loading) {
        if (!btn) return;
        btn.disabled = loading;
        btn.textContent = loading ? 'Salvando...' : 'Salvar';
        if (!loading) {
            btn.innerHTML = `
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                </svg>
                Salvar`;
        }
    }

    async function loadConfig() {
        try {
            const res = await api('/email-config');
            const config = res?.data;
            if (!config) return;

            const host = getEl('smtpHost');
            const port = getEl('smtpPort');
            const secure = getEl('smtpSecure');
            const user = getEl('smtpUser');
            const senderName = getEl('senderName');
            const senderEmail = getEl('senderEmail');
            const isActive = getEl('isActive');
            const passwordHint = getEl('hasPasswordHint');

            if (host) host.value = config.smtp_host || '';
            if (port) port.value = config.smtp_port || 587;
            if (secure) secure.checked = Boolean(config.smtp_secure);
            if (user) user.value = config.smtp_user || '';
            if (senderName) senderName.value = config.sender_name || '';
            if (senderEmail) senderEmail.value = config.sender_email || '';
            if (isActive) isActive.checked = config.is_active !== false;

            if (passwordHint && config.has_password) {
                passwordHint.classList.remove('hidden');
            }
        } catch (err) {
            showAlert('error', `Erro ao carregar configuração: ${err.message}`);
        }
    }

    async function handleSave(e) {
        e.preventDefault();
        const btn = getEl('saveBtn');
        setLoading(btn, true);

        try {
            const payload = {
                smtp_host: getEl('smtpHost')?.value?.trim() || '',
                smtp_port: parseInt(getEl('smtpPort')?.value || '587', 10),
                smtp_secure: getEl('smtpSecure')?.checked ?? false,
                smtp_user: getEl('smtpUser')?.value?.trim() || '',
                smtp_password: getEl('smtpPassword')?.value || null,
                sender_name: getEl('senderName')?.value?.trim() || '',
                sender_email: getEl('senderEmail')?.value?.trim() || '',
                is_active: getEl('isActive')?.checked ?? true,
            };

            await api('/email-config', {
                method: 'POST',
                body: JSON.stringify(payload),
            });

            showAlert('success', 'Configuração de e-mail salva com sucesso!');

            // Limpar campo de senha após salvar
            const passwordInput = getEl('smtpPassword');
            if (passwordInput) passwordInput.value = '';
            const hint = getEl('hasPasswordHint');
            if (hint) hint.classList.remove('hidden');
        } catch (err) {
            showAlert('error', `Erro ao salvar: ${err.message}`);
        } finally {
            setLoading(btn, false);
        }
    }

    function setupPasswordToggle() {
        const btn = getEl('togglePassword');
        const input = getEl('smtpPassword');
        if (!btn || !input) return;

        btn.addEventListener('click', () => {
            const isPassword = input.type === 'password';
            input.type = isPassword ? 'text' : 'password';
        });
    }

    function init() {
        const form = getEl('emailConfigForm');
        if (form) form.addEventListener('submit', handleSave);
        setupPasswordToggle();
        loadConfig();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
