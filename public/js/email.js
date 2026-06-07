/* ============================================================
   KEYSTONE - Cliente de E-mail (localStorage)
   Baseado no modelo Email Pro completo
   ============================================================ */
(function () {
    'use strict';

    // ─── Config ────────────────────────────────────────────────
    const STORAGE_KEY = 'keystone_email_pro_v4';
    const USER_KEY    = 'keystone_email_user_v1';

    const FOLDERS = [
        { id: 'inbox',    label: 'Entrada',   icon: '📥' },
        { id: 'starred',  label: 'Favoritos', icon: '⭐' },
        { id: 'sent',     label: 'Enviados',  icon: '📤' },
        { id: 'drafts',   label: 'Rascunhos', icon: '📝' },
        { id: 'spam',     label: 'Spam',      icon: '🚫' },
        { id: 'trash',    label: 'Lixeira',   icon: '🗑️' },
    ];

    // ─── State ─────────────────────────────────────────────────
    let state = {
        currentFolder: 'inbox',
        selectedId:    null,
        selectedIds:   new Set(),
        view:          'mail',
        account: {
            name: 'Você', email: '',
            signature: 'Atenciosamente,\nVocê',
            smtpHost: '', smtpPort: '587', smtpUser: '', smtpSecurity: 'TLS',
            imapHost: '', imapPort: '993',
        },
        mails: [],
    };

    // ─── Utils ─────────────────────────────────────────────────
    function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 9); }
    function now() { return new Date().toISOString(); }
    function isMobile() { return window.matchMedia('(max-width: 1100px)').matches; }

    function fmtDate(iso) {
        const d = new Date(iso), t = new Date();
        if (d.toDateString() === t.toDateString())
            return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
    }

    function esc(v) {
        return String(v ?? '')
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }

    function q(id) { return document.getElementById(id); }

    // ─── Sidebar ───────────────────────────────────────────────
    function openSidebar() {
        q('emSidebar')?.classList.add('open');
        q('emOverlay').style.display = 'block';
    }
    function closeSidebar() {
        q('emSidebar')?.classList.remove('open');
        q('emOverlay').style.display = 'none';
    }

    // ─── Persistence ───────────────────────────────────────────
    function save() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            currentFolder: state.currentFolder,
            selectedId:    state.selectedId,
            view:          state.view,
            account:       state.account,
            mails:         state.mails,
        }));
    }

    function load() {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) { seedDemo(false); return; }
        try {
            const d = JSON.parse(raw);
            state.currentFolder = d.currentFolder || 'inbox';
            state.selectedId    = d.selectedId    || null;
            state.view          = d.view          || 'mail';
            state.account       = Object.assign(state.account, d.account || {});
            state.mails         = d.mails         || [];
            state.selectedIds   = new Set();
            render();
        } catch (_) { seedDemo(false); }
    }

    async function fetchUser() {
        try {
            const cached = localStorage.getItem(USER_KEY);
            if (cached) {
                const u = JSON.parse(cached);
                if (!state.account.email) { state.account.name = u.name || state.account.name; state.account.email = u.email || ''; }
            }
        } catch (_) {}
        try {
            const res = await window.api('/auth/me');
            if (res?.data) {
                const u = res.data;
                localStorage.setItem(USER_KEY, JSON.stringify({ name: u.full_name || u.name || 'Você', email: u.email || '' }));
                if (!state.account.email) { state.account.name = u.full_name || u.name || state.account.name; state.account.email = u.email || ''; save(); }
            }
        } catch (_) {}
    }

    // ─── Demo data ─────────────────────────────────────────────
    function seedDemo(force) {
        if (force && !confirm('Restaurar dados de exemplo? Isso apagará os e-mails atuais.')) return;
        state.currentFolder = 'inbox'; state.selectedId = null; state.selectedIds = new Set(); state.view = 'mail';
        const me = state.account.email || 'voce@empresa.com.br';
        state.mails = [
            { id: uid(), folder: 'inbox', fromName: 'Maria Souza', fromEmail: 'maria@empresa.com.br', to: me,
              subject: 'Proposta comercial aprovada',
              body: 'Olá!\n\nA proposta comercial foi aprovada pela diretoria. Podemos seguir com a implantação do sistema na próxima semana.\n\nPor favor, envie o contrato e o cronograma atualizado.\n\nAtenciosamente,\nMaria Souza',
              date: new Date(Date.now() - 18*60000).toISOString(), unread: true, starred: true, attachments: ['proposta-aprovada.pdf'] },
            { id: uid(), folder: 'inbox', fromName: 'Suporte Técnico', fromEmail: 'suporte@sistema.com', to: me,
              subject: 'Chamado #2931 finalizado',
              body: 'Seu chamado foi finalizado com sucesso.\n\nResumo:\n- Ajuste no login\n- Correção da tela de cadastro\n- Atualização do relatório financeiro\n\nEquipe de suporte.',
              date: new Date(Date.now() - 3*3600000).toISOString(), unread: true, starred: false, attachments: [] },
            { id: uid(), folder: 'inbox', fromName: 'Carlos Lima', fromEmail: 'carlos@contabilidade.com', to: me,
              subject: 'Documentos para fechamento fiscal',
              body: 'Bom dia.\n\nSegue a lista de documentos necessários:\n1. Extratos bancários\n2. Notas fiscais emitidas\n3. Folha de pagamento\n4. Relatório de vendas\n\nFico no aguardo.',
              date: new Date(Date.now() - 26*3600000).toISOString(), unread: false, starred: false, attachments: ['lista-documentos.xlsx'] },
            { id: uid(), folder: 'sent', fromName: state.account.name || 'Você', fromEmail: state.account.email || '', to: 'cliente@empresa.com.br',
              subject: 'Envio de contrato de prestação de serviço',
              body: 'Prezado cliente,\n\nSegue o contrato de prestação de serviço para análise.\n\nQualquer ajuste, fico à disposição.\n\n' + (state.account.signature || ''),
              date: new Date(Date.now() - 30*3600000).toISOString(), unread: false, starred: false, attachments: ['contrato.pdf'] },
            { id: uid(), folder: 'drafts', fromName: state.account.name || 'Você', fromEmail: state.account.email || '', to: 'financeiro@empresa.com.br',
              subject: 'Pendência de pagamento',
              body: 'Olá,\n\nEstou verificando a pendência referente ao boleto de maio.\n\n',
              date: new Date(Date.now() - 48*3600000).toISOString(), unread: false, starred: false, attachments: [] },
            { id: uid(), folder: 'spam', fromName: 'Promoções Online', fromEmail: 'promo@ofertas.net', to: me,
              subject: 'Você ganhou um prêmio exclusivo',
              body: 'Clique agora para resgatar seu prêmio especial.',
              date: new Date(Date.now() - 55*3600000).toISOString(), unread: true, starred: false, attachments: [] },
        ];
        save(); render(); toast('Dados de exemplo carregados.');
    }

    function clearAllData() {
        if (!confirm('Limpar todos os dados?')) return;
        localStorage.removeItem(STORAGE_KEY);
        seedDemo(false);
        toast('Dados limpos e exemplo restaurado.');
    }

    function mergeSyncedInbox(messages) {
        const list = Array.isArray(messages) ? messages : [];
        if (!list.length) return 0;

        const byExternalId = new Map();
        state.mails.forEach((mail) => {
            if (mail.externalId) byExternalId.set(mail.externalId, mail);
        });

        let added = 0;
        for (const item of list) {
            const externalId = String(item.external_id || '').trim();
            if (!externalId) continue;

            const mapped = {
                id: byExternalId.get(externalId)?.id || uid(),
                externalId,
                folder: 'inbox',
                fromName: item.from_name || 'Sem nome',
                fromEmail: item.from_email || 'sem-email@local',
                to: item.to || (state.account.email || ''),
                subject: item.subject || '(Sem assunto)',
                body: item.body || 'Conteudo sincronizado da caixa de entrada.',
                date: item.date || now(),
                unread: Boolean(item.unread),
                starred: Boolean(item.starred),
                attachments: Array.isArray(item.attachments) ? item.attachments : [],
            };

            const existing = byExternalId.get(externalId);
            if (existing) {
                Object.assign(existing, mapped);
            } else {
                state.mails.push(mapped);
                added += 1;
            }
        }

        return added;
    }

    async function syncInbox() {
        const btn = q('emSyncBtn');
        if (!btn || btn.dataset.syncing === '1') return;

        btn.dataset.syncing = '1';
        btn.disabled = true;
        const originalText = btn.textContent;
        btn.textContent = 'Sincronizando...';

        try {
            const params = new URLSearchParams({ limit: '100' });
            const imapHost = String(state.account.imapHost || '').trim();
            const imapPortRaw = String(state.account.imapPort || '').trim();
            const imapPort = Number(imapPortRaw);

            if (imapHost) params.set('imap_host', imapHost);
            if (Number.isInteger(imapPort) && imapPort > 0) {
                params.set('imap_port', String(imapPort));
                params.set('imap_secure', imapPort === 143 ? 'false' : 'true');
            }

            const response = await window.api(`/email-config/sync-inbox?${params.toString()}`, { method: 'GET' });
            const synced = Array.isArray(response?.data) ? response.data : [];
            const added = mergeSyncedInbox(synced);

            state.view = 'mail';
            state.currentFolder = 'inbox';
            state.selectedId = null;
            state.selectedIds.clear();
            render();

            if (!synced.length) {
                toast('Sincronizacao concluida. Nenhum e-mail antigo encontrado.');
            } else if (added > 0) {
                toast(`Sincronizacao concluida. ${added} e-mail(s) antigo(s) importado(s).`);
            } else {
                toast('Sincronizacao concluida. Nenhum e-mail novo para importar.');
            }
        } catch (error) {
            toast(error?.message || 'Nao foi possivel sincronizar a caixa de e-mail.');
        } finally {
            btn.disabled = false;
            btn.dataset.syncing = '0';
            btn.textContent = originalText || 'Sincronizar';
        }
    }

    // ─── Queries ────────────────────────────────────────────────
    function getVisible() {
        const sq = (q('emSearchInput')?.value || '').trim().toLowerCase();
        let list = state.mails.filter(m =>
            state.currentFolder === 'starred' ? (m.starred && m.folder !== 'trash') : m.folder === state.currentFolder
        );
        if (sq) list = list.filter(m => [m.fromName, m.fromEmail, m.to, m.subject, m.body].join(' ').toLowerCase().includes(sq));
        return list.slice().sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    function folderCount(id) {
        if (id === 'starred') return state.mails.filter(m => m.starred && m.folder !== 'trash').length;
        if (id === 'inbox')   return state.mails.filter(m => m.folder === 'inbox' && m.unread).length;
        return state.mails.filter(m => m.folder === id).length;
    }

    // ─── CSS helpers ───────────────────────────────────────────
    const S = {
        btn: 'border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.06);color:#e2e8f0;padding:8px 12px;border-radius:10px;cursor:pointer;font-size:13px;white-space:nowrap',
        btnPrimary: 'background:#38bdf8;color:#00131e;border:none;padding:8px 14px;border-radius:10px;cursor:pointer;font-size:13px;font-weight:700',
        btnDanger: 'background:rgba(239,68,68,.12);color:#fca5a5;border:1px solid rgba(239,68,68,.22);padding:8px 12px;border-radius:10px;cursor:pointer;font-size:13px',
        btnSuccess: 'background:rgba(34,197,94,.12);color:#86efac;border:1px solid rgba(34,197,94,.22);padding:8px 12px;border-radius:10px;cursor:pointer;font-size:13px',
        field: (id, lbl, placeholder, type) =>
            `<div style="display:grid;gap:5px">
                <label style="color:#94a3b8;font-size:12px">${lbl}</label>
                <input id="${id}" type="${type||'text'}" placeholder="${placeholder}"
                    style="width:100%;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:10px 12px;color:#e2e8f0;outline:none;font-size:13px">
             </div>`,
    };

    // ─── Render ────────────────────────────────────────────────
    function render() { buildShell(); renderFolders(); renderMainContent(); save(); }

    function buildShell() {
        const app = q('emailApp');
        if (app.dataset.built) return;
        app.dataset.built = '1';
        app.style.cssText = `display:grid;grid-template-columns:256px 1fr;flex:1;min-height:0;overflow:hidden;background:#0f172a;color:#e2e8f0;border-radius:12px;border:1px solid rgba(255,255,255,.06)`;

        app.innerHTML = `
        <aside id="emSidebar" style="background:rgba(15,23,42,.97);border-right:1px solid rgba(255,255,255,.08);display:flex;flex-direction:column;overflow-y:auto;padding:14px;gap:2px;backdrop-filter:blur(12px);z-index:60">
            <button id="emComposeBtn" type="button" style="width:100%;border:none;background:linear-gradient(135deg,#38bdf8,#60a5fa);color:#00131e;padding:12px 16px;border-radius:999px;font-weight:800;cursor:pointer;margin-bottom:14px;font-size:14px">✍️ Novo E-mail</button>
            <div id="emFolderMenuTitle" style="color:#94a3b8;font-size:11px;text-transform:uppercase;letter-spacing:.12em;margin:12px 10px 6px">Pastas</div>
            <div id="emFolders"></div>
            <div style="color:#94a3b8;font-size:11px;text-transform:uppercase;letter-spacing:.12em;margin:12px 10px 6px">Sistema</div>
            <button id="emClearBtn" type="button" style="width:100%;border:1px solid transparent;background:transparent;color:#e2e8f0;display:flex;align-items:center;padding:10px 12px;border-radius:11px;cursor:pointer;font-size:14px">🧹 Limpar dados</button>
        </aside>
        <main id="emMain" style="min-width:0;display:grid;grid-template-rows:auto 1fr;overflow:hidden">
            <header id="emTopbar" style="padding:10px 16px;border-bottom:1px solid rgba(255,255,255,.08);background:rgba(15,23,42,.88);backdrop-filter:blur(10px);display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center;z-index:20">
                <button id="emMenuToggle" type="button" style="display:none;align-items:center;gap:6px;border:1px solid rgba(56,189,248,.30);background:rgba(56,189,248,.10);color:#38bdf8;padding:8px 12px;border-radius:10px;cursor:pointer;font-weight:700;font-size:13px">☰ Menu</button>
                <div style="display:flex;align-items:center;gap:8px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);border-radius:999px;padding:8px 14px;min-width:0">
                    <svg style="width:16px;height:16px;color:#94a3b8;flex-shrink:0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0"/></svg>
                    <input id="emSearchInput" placeholder="Pesquisar por remetente, assunto ou texto..." style="width:100%;border:none;outline:none;color:#e2e8f0;background:transparent;font-size:13px">
                </div>
                <div id="emTopActions" style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">
                    <button id="emSyncBtn" type="button" style="${S.btnSuccess}">Sincronizar</button>
                    <button id="emMarkReadBtn" type="button" style="${S.btn}">Marcar lido</button>
                    <button id="emMarkUnreadBtn" type="button" style="${S.btn}">Marcar não lido</button>
                    <button id="emDeleteSelectedBtn" type="button" style="${S.btnDanger}">Excluir</button>
                </div>
            </header>
            <section id="emContent" style="display:grid;grid-template-columns:minmax(290px,400px) 1fr;min-height:0;overflow:hidden"></section>
        </main>`;

        // Bind events (only once)
        bindEvents();
    }

    function renderFolders() {
        const container = q('emFolders');
        if (!container) return;
        container.innerHTML = FOLDERS.map(f => {
            const cnt = folderCount(f.id);
            const isActive = state.currentFolder === f.id && state.view === 'mail';
            const badgeStyle = (f.id === 'inbox' || f.id === 'starred') && cnt > 0
                ? 'min-width:22px;padding:2px 6px;border-radius:999px;background:#38bdf8;color:#00131e;font-size:11px;text-align:center;font-weight:700'
                : 'min-width:22px;padding:2px 6px;border-radius:999px;background:#1e293b;color:#94a3b8;font-size:11px;text-align:center';
            return `<button class="em-folder-btn-item ${isActive ? 'active' : ''}" data-folder="${f.id}" type="button"
                style="width:100%;border:1px solid transparent;background:${isActive ? 'rgba(56,189,248,.14)' : 'transparent'};color:${isActive ? '#38bdf8' : '#e2e8f0'};display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-radius:11px;cursor:pointer;text-align:left;font-size:14px;transition:background .14s;font-weight:${isActive ? '600' : 'normal'}">
                <span style="display:flex;align-items:center;gap:10px">${f.icon} ${f.label}</span>
                <span style="${badgeStyle}">${cnt}</span>
            </button>`;
        }).join('');

    }

    function renderMainContent() {
        const content = q('emContent');
        const topActions = q('emTopActions');
        if (!content || !topActions) return;

        if (state.view === 'settings') {
            topActions.style.display = 'none';
            content.style.cssText = 'display:block;overflow-y:auto;padding:16px';
            content.innerHTML = settingsHtml();
            fillSettings();
            return;
        }

        topActions.style.display = 'flex';
        content.style.cssText = 'display:grid;grid-template-columns:minmax(290px,400px) 1fr;min-height:0;overflow:hidden';
        content.innerHTML = `
            <div id="emMailListWrap" style="border-right:1px solid rgba(255,255,255,.08);overflow-y:auto;background:rgba(17,24,39,.40)">
                <div style="padding:12px 16px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,.08);background:rgba(17,24,39,.60);position:sticky;top:0;z-index:2">
                    <h2 id="emFolderTitle" style="margin:0;font-size:15px;color:#e2e8f0">Entrada</h2>
                    <label style="display:flex;align-items:center;gap:6px;color:#94a3b8;font-size:12px;cursor:pointer">
                        <input type="checkbox" id="emSelectAll"> Selecionar
                    </label>
                </div>
                <div id="emMailList"></div>
            </div>
            <div id="emReader" style="overflow-y:auto;background:rgba(15,23,42,.50)"></div>`;

        q('emSelectAll')?.addEventListener('change', e => toggleSelectAll(e.target.checked));
        renderList();
        renderReader();
    }

    function renderList() {
        const titleEl = q('emFolderTitle');
        const listEl  = q('emMailList');
        const selAll  = q('emSelectAll');
        if (!listEl) return;

        const folder = FOLDERS.find(f => f.id === state.currentFolder);
        if (titleEl) titleEl.textContent = folder?.label || 'E-mails';

        const list = getVisible();
        if (selAll) selAll.checked = list.length > 0 && list.every(m => state.selectedIds.has(m.id));

        if (!list.length) {
            listEl.innerHTML = `<div style="height:100%;min-height:300px;display:grid;place-items:center;color:#94a3b8;text-align:center;padding:24px">
                <div><p style="font-size:2.5rem;margin:0">📭</p><h3 style="color:#e2e8f0;margin:8px 0 4px">Nenhum e-mail</h3>
                <p style="font-size:13px">Esta pasta está vazia ou nada corresponde à busca.</p></div></div>`;
            return;
        }

        listEl.innerHTML = list.map(m => `
            <article class="em-mail-item-row ${state.selectedId === m.id ? 'active' : ''}"
                data-id="${esc(m.id)}"
                style="padding:12px 14px;display:grid;grid-template-columns:auto 1fr auto;gap:10px;border-bottom:1px solid rgba(255,255,255,.08);cursor:pointer;background:${m.unread ? 'rgba(56,189,248,.04)' : 'transparent'}">
                <input class="em-mail-check" type="checkbox" ${state.selectedIds.has(m.id) ? 'checked' : ''} data-check="${esc(m.id)}" style="margin-top:3px">
                <div style="min-width:0">
                    <div style="display:flex;align-items:center;gap:8px;min-width:0">
                        <button class="em-star ${m.starred ? 'on' : ''}" data-star="${esc(m.id)}" type="button"
                            style="border:none;background:transparent;color:${m.starred ? '#f59e0b' : '#475569'};font-size:16px;cursor:pointer;padding:0;line-height:1">★</button>
                        <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;color:#cbd5e1;flex:1;${m.unread ? 'font-weight:700;color:#f1f5f9' : ''}">${esc(m.fromName)} &lt;${esc(m.fromEmail)}&gt;</span>
                    </div>
                    <div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;color:#e2e8f0;margin-top:5px;${m.unread ? 'font-weight:700;color:#f1f5f9' : ''}">${esc(m.subject)}</div>
                    <div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#94a3b8;font-size:12px;margin-top:4px">${esc((m.body || '').replace(/\s+/g, ' ').slice(0, 110))}</div>
                    ${m.attachments?.length ? `<span style="display:inline-flex;border-radius:999px;padding:2px 6px;font-size:11px;background:rgba(148,163,184,.12);color:#94a3b8;margin-top:6px">📎 ${m.attachments.length} anexo(s)</span>` : ''}
                </div>
                <div style="color:#94a3b8;font-size:11px;white-space:nowrap">${fmtDate(m.date)}</div>
            </article>`).join('');
    }

    function renderReader() {
        const reader = q('emReader');
        if (!reader) return;
        const m = state.mails.find(x => x.id === state.selectedId);
        if (!m) {
            reader.innerHTML = `<div style="height:100%;min-height:300px;display:grid;place-items:center;color:#94a3b8;text-align:center;padding:24px">
                <div style="background:rgba(17,24,39,.72);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:28px 32px;max-width:380px">
                    <p style="font-size:2.5rem;margin:0 0 10px">✉️</p>
                    <h3 style="color:#e2e8f0;margin:0 0 8px">Selecione um e-mail</h3>
                    <p style="font-size:13px">Escolha uma mensagem na lista para ler, responder ou encaminhar.</p>
                </div></div>`;
            return;
        }
        const letter = (m.fromName || m.fromEmail || '?')[0].toUpperCase();
        reader.innerHTML = `
            <div style="background:rgba(17,24,39,.60);border:1px solid rgba(255,255,255,.08);border-radius:14px;overflow:hidden;margin:16px">
                <div style="padding:20px;border-bottom:1px solid rgba(255,255,255,.08)">
                    <h2 style="margin:0 0 12px;font-size:20px;color:#e2e8f0">${esc(m.subject)}</h2>
                    <div style="display:grid;grid-template-columns:40px 1fr auto;gap:10px;align-items:center">
                        <div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#60a5fa,#22c55e);display:grid;place-items:center;color:#00131e;font-weight:900;font-size:16px">${esc(letter)}</div>
                        <div>
                            <div style="font-weight:700;font-size:14px;color:#e2e8f0">${esc(m.fromName)}</div>
                            <div style="color:#94a3b8;font-size:12px">${esc(m.fromEmail)} → ${esc(m.to)}</div>
                        </div>
                        <div style="color:#94a3b8;font-size:12px">${new Date(m.date).toLocaleString('pt-BR')}</div>
                    </div>
                </div>
                <div style="padding:22px;color:#e2e8f0;line-height:1.65;white-space:pre-line;font-size:14px">${esc(m.body)}</div>
                ${m.attachments?.length ? `<div style="padding:0 20px 16px;display:flex;gap:8px;flex-wrap:wrap">${m.attachments.map(a => `<span style="border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.05);border-radius:10px;padding:7px 10px;color:#bfdbfe;font-size:12px">📎 ${esc(a)}</span>`).join('')}</div>` : ''}
                <div style="padding:14px 20px 20px;display:flex;gap:8px;flex-wrap:wrap;border-top:1px solid rgba(255,255,255,.08)">
                    ${m.folder !== 'drafts' ? `<button style="${S.btnPrimary}" data-action="reply">Responder</button><button style="${S.btn}" data-action="forward">Encaminhar</button>` : ''}
                    <button style="${S.btn}" data-action="star">${m.starred ? 'Remover favorito' : 'Favoritar'}</button>
                    ${m.folder === 'drafts' ? `<button style="${S.btnSuccess}" data-action="edit-draft">Editar rascunho</button>` : ''}
                    ${m.folder === 'trash'
                        ? `<button style="${S.btn}" data-action="restore">Restaurar</button><button style="${S.btnDanger}" data-action="delete-forever">Excluir definitivo</button>`
                        : `<button style="${S.btnDanger}" data-action="delete">Mover para Lixeira</button>`}
                </div>
            </div>`;
    }

    // ─── Settings ──────────────────────────────────────────────
    function settingsHtml() {
        const row2 = 'display:grid;grid-template-columns:1fr 1fr;gap:14px';
        return `<div style="background:rgba(17,24,39,.72);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:22px;max-width:900px;margin:0 auto">
            <h2 style="margin-top:0;color:#e2e8f0;font-size:18px">⚙️ Configurar E-mail</h2>
            <p style="color:#94a3b8;font-size:13px;margin-bottom:6px">As informações ficam salvas no navegador.</p>
            <div style="background:rgba(56,189,248,.08);border:1px solid rgba(56,189,248,.20);color:#bae6fd;padding:12px 14px;border-radius:12px;line-height:1.5;font-size:13px;margin:10px 0 18px">
                <strong>Importante:</strong> Esta tela salva a configuração visual. Para envio/recepção real de e-mails, conecte com backend Node.js/SMTP.
                A senha SMTP individual é configurada em <strong>Configuração → Usuários → aba E-mail</strong>.
            </div>
            <form id="emSettingsForm">
                <div style="${row2}">
                    ${S.field('cfgName', 'Nome do remetente', 'Ex: Sidney Junior')}
                    ${S.field('cfgEmail', 'E-mail', 'seunome@dominio.com.br', 'email')}
                    ${S.field('cfgSmtpHost', 'Servidor SMTP', 'smtp.dominio.com.br')}
                    ${S.field('cfgSmtpPort', 'Porta SMTP', '587')}
                    ${S.field('cfgSmtpUser', 'Usuário SMTP', 'normalmente seu e-mail')}
                    <div style="display:grid;gap:5px">
                        <label style="color:#94a3b8;font-size:12px">Segurança</label>
                        <select id="cfgSmtpSecurity" style="width:100%;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:10px 12px;color:#e2e8f0;outline:none;font-size:13px">
                            <option>TLS</option><option>SSL</option><option>Nenhuma</option>
                        </select>
                    </div>
                    ${S.field('cfgImapHost', 'Servidor IMAP', 'imap.dominio.com.br')}
                    ${S.field('cfgImapPort', 'Porta IMAP', '993')}
                    <div style="grid-column:1/-1;display:grid;gap:5px">
                        <label style="color:#94a3b8;font-size:12px">Assinatura automática</label>
                        <textarea id="cfgSignature" placeholder="Atenciosamente,&#10;Seu nome" style="width:100%;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:10px 12px;color:#e2e8f0;outline:none;font-size:13px;min-height:100px;resize:vertical;line-height:1.5"></textarea>
                    </div>
                    <div style="grid-column:1/-1;display:flex;gap:8px;flex-wrap:wrap">
                        <button type="submit" style="${S.btnPrimary}">Salvar configuração</button>
                        <button type="button" id="emTestSettingsBtn" style="${S.btn}">Testar configuração visual</button>
                    </div>
                </div>
            </form>
        </div>`;
    }

    function fillSettings() {
        const c = state.account;
        const sv = (id, v) => { const el = q(id); if (el) el.value = v || ''; };
        sv('cfgName', c.name); sv('cfgEmail', c.email); sv('cfgSignature', c.signature);
        sv('cfgSmtpHost', c.smtpHost); sv('cfgSmtpPort', c.smtpPort || '587');
        sv('cfgSmtpUser', c.smtpUser); sv('cfgImapHost', c.imapHost); sv('cfgImapPort', c.imapPort || '993');
        const sec = q('cfgSmtpSecurity'); if (sec) sec.value = c.smtpSecurity || 'TLS';

        q('emSettingsForm')?.addEventListener('submit', e => {
            e.preventDefault();
            const gv = id => q(id)?.value?.trim() || '';
            state.account = { name: gv('cfgName'), email: gv('cfgEmail'), signature: q('cfgSignature')?.value || '',
                smtpHost: gv('cfgSmtpHost'), smtpPort: gv('cfgSmtpPort'), smtpUser: gv('cfgSmtpUser'),
                smtpSecurity: q('cfgSmtpSecurity')?.value || 'TLS', imapHost: gv('cfgImapHost'), imapPort: gv('cfgImapPort') };
            save(); toast('Configuração salva com sucesso.'); render();
        });
        q('emTestSettingsBtn')?.addEventListener('click', () => {
            if (!q('cfgSmtpHost')?.value?.trim() || !q('cfgImapHost')?.value?.trim())
                return toast('Preencha SMTP e IMAP para simular o teste visual.');
            toast('Configuração visual validada. Para teste real, conecte com backend/API.');
        });
    }

    // ─── Navigation ────────────────────────────────────────────
    function setFolder(folder) {
        state.view = 'mail'; state.currentFolder = folder;
        state.selectedId = null; state.selectedIds.clear();
        closeSidebar(); render();
    }

    function openSettings() {
        state.view = 'settings'; state.selectedId = null; state.selectedIds.clear();
        closeSidebar(); render();
    }

    function openMail(id) {
        state.selectedId = id;
        const m = state.mails.find(x => x.id === id);
        if (m) m.unread = false;
        render();
    }

    function toggleSelectAll(checked) {
        const list = getVisible();
        if (checked) list.forEach(m => state.selectedIds.add(m.id));
        else list.forEach(m => state.selectedIds.delete(m.id));
        renderList();
    }

    function markSelectedRead(unread) {
        if (!state.selectedIds.size) { toast('Selecione pelo menos um e-mail.'); return; }
        state.mails.forEach(m => { if (state.selectedIds.has(m.id)) m.unread = unread; });
        state.selectedIds.clear();
        toast(unread ? 'Marcado(s) como não lido(s).' : 'Marcado(s) como lido(s).');
        render();
    }

    function moveSelectedToTrash() {
        if (!state.selectedIds.size) { toast('Selecione pelo menos um e-mail.'); return; }
        state.mails.forEach(m => {
            if (state.selectedIds.has(m.id)) { m.previousFolder = m.folder === 'trash' ? 'inbox' : m.folder; m.folder = 'trash'; }
        });
        if (state.selectedIds.has(state.selectedId)) state.selectedId = null;
        state.selectedIds.clear(); toast('Movido(s) para a lixeira.'); render();
    }

    function toggleStar(id) {
        const m = state.mails.find(x => x.id === id);
        if (!m) return;
        m.starred = !m.starred;
        toast(m.starred ? 'Adicionado aos favoritos.' : 'Removido dos favoritos.'); render();
    }

    function moveToTrash(id) {
        const m = state.mails.find(x => x.id === id);
        if (!m) return;
        m.previousFolder = m.folder === 'trash' ? 'inbox' : m.folder; m.folder = 'trash';
        state.selectedId = null; toast('E-mail movido para a lixeira.'); render();
    }

    function restoreMail(id) {
        const m = state.mails.find(x => x.id === id);
        if (!m) return;
        m.folder = m.previousFolder || 'inbox'; delete m.previousFolder;
        state.currentFolder = m.folder; state.view = 'mail'; state.selectedId = m.id;
        toast('E-mail restaurado.'); render();
    }

    function deleteForever(id) {
        if (!confirm('Excluir definitivamente este e-mail?')) return;
        state.mails = state.mails.filter(x => x.id !== id);
        state.selectedId = null; toast('E-mail excluído permanentemente.'); render();
    }

    // ─── Compose ───────────────────────────────────────────────
    function openCompose(data) {
        data = data || {};
        const sig = state.account.signature ? '\n\n' + state.account.signature : '';
        const modal = q('emComposeModal');
        q('emComposeTitle').textContent = data.title || 'Novo E-mail';
        q('emEditingDraftId').value     = data.draftId || '';
        q('emToInput').value            = data.to      || '';
        q('emSubjectInput').value       = data.subject || '';
        q('emBodyInput').value          = data.body !== undefined ? data.body : sig.trimStart();
        modal.style.display = 'grid';
        setTimeout(() => q('emToInput')?.focus(), 80);
    }

    function closeCompose() { q('emComposeModal').style.display = 'none'; }

    function sendMail(e) {
        e.preventDefault();
        const draftId = q('emEditingDraftId').value;
        const to = q('emToInput').value.trim();
        const subject = q('emSubjectInput').value.trim();
        const body = q('emBodyInput').value.trim();
        if (draftId) state.mails = state.mails.filter(m => m.id !== draftId);
        state.mails.unshift({ id: uid(), folder: 'sent', fromName: state.account.name || 'Você',
            fromEmail: state.account.email || '', to, subject, body,
            date: now(), unread: false, starred: false, attachments: [] });
        state.currentFolder = 'sent'; state.view = 'mail';
        closeCompose(); toast('E-mail enviado (armazenado localmente).'); render();
    }

    function saveDraftAction() {
        const draftId = q('emEditingDraftId').value;
        const to = q('emToInput').value.trim();
        const subject = q('emSubjectInput').value.trim() || 'Sem assunto';
        const body = q('emBodyInput').value.trim();
        if (!to && !body && subject === 'Sem assunto') { toast('Digite alguma informação antes de salvar.'); return; }
        if (draftId) {
            const m = state.mails.find(x => x.id === draftId);
            if (m) Object.assign(m, { to, subject, body, date: now(), fromName: state.account.name || 'Você', fromEmail: state.account.email || '' });
        } else {
            state.mails.unshift({ id: uid(), folder: 'drafts', fromName: state.account.name || 'Você',
                fromEmail: state.account.email || '', to, subject, body,
                date: now(), unread: false, starred: false, attachments: [] });
        }
        state.currentFolder = 'drafts'; state.view = 'mail';
        closeCompose(); toast('Rascunho salvo.'); render();
    }

    function replyMail(id) {
        const m = state.mails.find(x => x.id === id); if (!m) return;
        openCompose({ title: 'Responder E-mail', to: m.fromEmail,
            subject: m.subject.startsWith('Re:') ? m.subject : 'Re: ' + m.subject,
            body: `\n\n${state.account.signature || ''}\n\n----- Mensagem original -----\nDe: ${m.fromName} <${m.fromEmail}>\nData: ${new Date(m.date).toLocaleString('pt-BR')}\nAssunto: ${m.subject}\n\n${m.body}` });
    }

    function forwardMail(id) {
        const m = state.mails.find(x => x.id === id); if (!m) return;
        openCompose({ title: 'Encaminhar E-mail',
            subject: m.subject.startsWith('Enc:') ? m.subject : 'Enc: ' + m.subject,
            body: `\n\n${state.account.signature || ''}\n\n----- E-mail encaminhado -----\nDe: ${m.fromName} <${m.fromEmail}>\nPara: ${m.to}\nData: ${new Date(m.date).toLocaleString('pt-BR')}\nAssunto: ${m.subject}\n\n${m.body}` });
    }

    function editDraft(id) {
        const m = state.mails.find(x => x.id === id); if (!m) return;
        openCompose({ title: 'Editar Rascunho', draftId: id, to: m.to, subject: m.subject, body: m.body });
    }

    // ─── Toast ─────────────────────────────────────────────────
    function toast(msg) {
        const el = q('emToast'); if (!el) return;
        el.textContent = msg; el.style.display = 'block';
        clearTimeout(window._emToast);
        window._emToast = setTimeout(() => { el.style.display = 'none'; }, 2800);
    }

    // ─── Events ────────────────────────────────────────────────
    function bindEvents() {
        // Sidebar toggle
        q('emMenuToggle')?.addEventListener('click', openSidebar);
        q('emFloatingMenuBtn')?.addEventListener('click', openSidebar);
        q('emOverlay')?.addEventListener('click', closeSidebar);

        // Folder nav (delegation on #emFolders, but #emFolders is re-rendered — use document)
        document.addEventListener('click', e => {
            const folderBtn = e.target.closest('[data-folder]');
            if (folderBtn && q('emFolders')?.contains(folderBtn)) { setFolder(folderBtn.dataset.folder); return; }
        });

        // System
        q('emClearBtn')?.addEventListener('click', clearAllData);

        // Compose open
        q('emComposeBtn')?.addEventListener('click', () => openCompose());

        // Compose modal
        q('emComposeClose')?.addEventListener('click', closeCompose);
        q('emComposeModal')?.addEventListener('click', e => { if (e.target === q('emComposeModal')) closeCompose(); });
        q('emComposeForm')?.addEventListener('submit', sendMail);
        q('emSaveDraftBtn')?.addEventListener('click', saveDraftAction);

        // Top actions
        q('emSyncBtn')?.addEventListener('click', syncInbox);
        q('emMarkReadBtn')?.addEventListener('click', () => markSelectedRead(false));
        q('emMarkUnreadBtn')?.addEventListener('click', () => markSelectedRead(true));
        q('emDeleteSelectedBtn')?.addEventListener('click', moveSelectedToTrash);

        // Search
        document.addEventListener('input', e => { if (e.target.id === 'emSearchInput') renderList(); });

        // Content area (delegation for list + reader)
        document.addEventListener('click', e => {
            if (!q('emContent')?.contains(e.target)) return;

            const starBtn = e.target.closest('[data-star]');
            if (starBtn) { e.stopPropagation(); toggleStar(starBtn.dataset.star); return; }

            const chk = e.target.closest('[data-check]');
            if (chk && e.target.type === 'checkbox') {
                e.stopPropagation();
                if (e.target.checked) state.selectedIds.add(chk.dataset.check);
                else state.selectedIds.delete(chk.dataset.check);
                renderList(); return;
            }

            const actionBtn = e.target.closest('[data-action]');
            if (actionBtn) {
                const id = state.selectedId, act = actionBtn.dataset.action;
                if (act === 'reply')          replyMail(id);
                else if (act === 'forward')   forwardMail(id);
                else if (act === 'star')      toggleStar(id);
                else if (act === 'edit-draft') editDraft(id);
                else if (act === 'delete')    moveToTrash(id);
                else if (act === 'restore')   restoreMail(id);
                else if (act === 'delete-forever') deleteForever(id);
                return;
            }

            const item = e.target.closest('[data-id]');
            if (item) {
                const id = item.dataset.id;
                const m = state.mails.find(x => x.id === id);
                if (m?.folder === 'drafts') { editDraft(id); return; }
                openMail(id);
            }
        });

        // Keyboard
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape') { closeCompose(); closeSidebar(); }
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') { e.preventDefault(); openCompose(); }
        });

        window.addEventListener('resize', () => { if (!isMobile()) closeSidebar(); });
    }

    // ─── Init ──────────────────────────────────────────────────
    function init() { load(); fetchUser(); }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();

})();
