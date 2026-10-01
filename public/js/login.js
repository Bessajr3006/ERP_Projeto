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
    // Modal de Conflito de Sessão Ativa
    const conflictModal = document.getElementById('sessionConflictModal');
    const btnForceLogin = document.getElementById('btnForceLogin');
    const btnCancelConflictLogin = document.getElementById('btnCancelConflictLogin');
    const sessionConflictBackdrop = document.getElementById('sessionConflictBackdrop');
    let pendingLoginPayload = null;
    function showSessionConflictModal(sessionInfo, payload) {
        pendingLoginPayload = payload;
        const locEl = document.getElementById('conflictLocation');
        const ipEl = document.getElementById('conflictIp');
        const uaEl = document.getElementById('conflictUserAgent');
        const timeEl = document.getElementById('conflictConnectedAt');
        if (locEl)
            locEl.textContent = sessionInfo?.location || 'Localização não identificada';
        if (ipEl)
            ipEl.textContent = sessionInfo?.ip || 'IP não informado';
        if (uaEl) {
            const ua = sessionInfo?.user_agent || 'Dispositivo não informado';
            uaEl.textContent = ua;
            uaEl.setAttribute('title', ua);
        }
        if (timeEl)
            timeEl.textContent = sessionInfo?.formatted_time || sessionInfo?.connected_at || 'Horário recente';
        if (conflictModal) {
            conflictModal.classList.remove('hidden');
            conflictModal.classList.add('flex');
        }
    }
    function hideSessionConflictModal() {
        if (conflictModal) {
            conflictModal.classList.add('hidden');
            conflictModal.classList.remove('flex');
        }
        pendingLoginPayload = null;
        if (btnForceLogin) {
            btnForceLogin.disabled = false;
            btnForceLogin.textContent = 'Desconectar outra sessão e entrar';
        }
    }
    btnCancelConflictLogin?.addEventListener('click', hideSessionConflictModal);
    sessionConflictBackdrop?.addEventListener('click', hideSessionConflictModal);
    btnForceLogin?.addEventListener('click', async () => {
        if (!pendingLoginPayload)
            return;
        btnForceLogin.disabled = true;
        btnForceLogin.textContent = 'Desconectando e entrando...';
        try {
            let data;
            if (pendingLoginPayload.type === 'password') {
                data = await api('/auth/login', {
                    method: 'POST',
                    body: JSON.stringify({
                        email: pendingLoginPayload.email,
                        passwordRaw: pendingLoginPayload.passwordRaw,
                        force: true
                    })
                });
            }
            else {
                data = await api('/auth/login-by-face', {
                    method: 'POST',
                    body: JSON.stringify({
                        descriptor: pendingLoginPayload.descriptor,
                        email: pendingLoginPayload.email,
                        force: true
                    })
                });
            }
            const tokenSaved = Auth.setToken(data?.data?.token || data?.token);
            if (!tokenSaved) {
                throw new Error('O servidor não retornou um token de acesso válido.');
            }
            if (typeof window.syncUiPreferencesFromServer === 'function') {
                try {
                    await window.syncUiPreferencesFromServer();
                }
                catch (err) {
                    console.error('Erro ao sincronizar preferências no login forçado:', err);
                }
            }
            const defaultPage = data?.data?.user?.default_page;
            window.location.href = defaultPage || '/pages/dashboard.html';
        }
        catch (error) {
            hideSessionConflictModal();
            UI.showAlert('alertMessage', error?.message || 'Erro ao forçar autenticação.');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Entrar no Sistema';
            }
        }
    });
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
            // Sincroniza preferências do servidor para o localStorage imediatamente antes de redirecionar
            if (typeof window.syncUiPreferencesFromServer === 'function') {
                try {
                    await window.syncUiPreferencesFromServer();
                }
                catch (err) {
                    console.error('Erro ao sincronizar preferências no login:', err);
                }
            }
            const defaultPage = data?.data?.user?.default_page;
            window.location.href = defaultPage || '/pages/dashboard.html';
        }
        catch (error) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Entrar no Sistema';
            if (error?.status === 409 || error?.code === 'SESSION_CONFLICT') {
                showSessionConflictModal(error?.data, {
                    type: 'password',
                    email,
                    passwordRaw: password
                });
                return;
            }
            UI.showAlert('alertMessage', error?.message || 'Erro ao realizar login. Tente novamente.');
        }
    });
    // Facial Recognition Login Implementation
    let faceStream = null;
    let isDetecting = false;
    async function ensureFaceApiLoaded() {
        if (window.faceapi)
            return true;
        return new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/dist/face-api.js';
            script.onload = async () => {
                try {
                    const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/model';
                    await window.faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
                    await window.faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
                    await window.faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
                    resolve(true);
                }
                catch (err) {
                    console.error('Erro ao carregar modelos do face-api:', err);
                    resolve(false);
                }
            };
            script.onerror = () => resolve(false);
            document.body.appendChild(script);
        });
    }
    function stopFaceCamera() {
        if (faceStream) {
            faceStream.getTracks().forEach(track => track.stop());
            faceStream = null;
        }
        const video = document.getElementById('faceVideo');
        if (video)
            video.srcObject = null;
    }
    async function detectFaceLoop(video, statusEl) {
        if (!isDetecting)
            return;
        try {
            statusEl.textContent = 'Procurando rosto...';
            const faceapi = window.faceapi;
            const detection = await faceapi.detectSingleFace(video).withFaceLandmarks().withFaceDescriptor();
            if (detection && isDetecting) {
                isDetecting = false;
                statusEl.textContent = 'Rosto identificado. Autenticando...';
                stopFaceCamera();
                const emailInput = document.getElementById('email');
                const email = emailInput?.value?.trim() || undefined;
                try {
                    const data = await api('/auth/login-by-face', {
                        method: 'POST',
                        body: JSON.stringify({
                            descriptor: Array.from(detection.descriptor),
                            email
                        })
                    });
                    const tokenSaved = Auth.setToken(data?.data?.token || data?.token);
                    if (!tokenSaved) {
                        throw new Error('Token inválido retornado pelo servidor.');
                    }
                    // Sincroniza preferências do servidor para o localStorage imediatamente antes de redirecionar
                    if (typeof window.syncUiPreferencesFromServer === 'function') {
                        try {
                            await window.syncUiPreferencesFromServer();
                        }
                        catch (err) {
                            console.error('Erro ao sincronizar preferências no login facial:', err);
                        }
                    }
                    statusEl.textContent = 'Sucesso! Entrando...';
                    const defaultPage = data?.data?.user?.default_page;
                    window.location.href = defaultPage || '/pages/dashboard.html';
                }
                catch (err) {
                    console.error(err);
                    document.getElementById('faceLoginModal')?.classList.add('hidden');
                    if (err?.status === 409 || err?.code === 'SESSION_CONFLICT') {
                        showSessionConflictModal(err?.data, {
                            type: 'face',
                            descriptor: Array.from(detection.descriptor),
                            email
                        });
                        return;
                    }
                    UI.showAlert('alertMessage', err?.message || 'Biometria não cadastrada ou rosto não reconhecido.');
                }
                return;
            }
        }
        catch (err) {
            console.error('Erro durante detecção facial:', err);
        }
        if (isDetecting) {
            setTimeout(() => detectFaceLoop(video, statusEl), 800);
        }
    }
    document.getElementById('btnFaceLoginStart')?.addEventListener('click', async () => {
        UI.hideAlert('alertMessage');
        const modal = document.getElementById('faceLoginModal');
        const statusEl = document.getElementById('faceLoginStatus');
        const video = document.getElementById('faceVideo');
        if (!modal || !statusEl || !video)
            return;
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        statusEl.textContent = 'Carregando biblioteca de biometria...';
        const loaded = await ensureFaceApiLoaded();
        if (!loaded) {
            statusEl.textContent = 'Erro ao carregar biblioteca facial.';
            setTimeout(() => {
                modal.classList.add('hidden');
                modal.classList.remove('flex');
            }, 2000);
            return;
        }
        statusEl.textContent = 'Iniciando câmera...';
        try {
            faceStream = await navigator.mediaDevices.getUserMedia({
                video: { width: 640, height: 480, facingMode: 'user' }
            });
            video.srcObject = faceStream;
            isDetecting = true;
            // Wait for video to start playing
            video.onloadedmetadata = () => {
                video.play();
                detectFaceLoop(video, statusEl);
            };
        }
        catch (err) {
            console.error('Erro ao acessar a câmera:', err);
            statusEl.textContent = 'Não foi possível acessar a câmera. Certifique-se de dar permissão.';
            setTimeout(() => {
                modal.classList.add('hidden');
                modal.classList.remove('flex');
            }, 3000);
        }
    });
    document.getElementById('btnCancelFaceLogin')?.addEventListener('click', () => {
        isDetecting = false;
        stopFaceCamera();
        const modal = document.getElementById('faceLoginModal');
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
    });
});
