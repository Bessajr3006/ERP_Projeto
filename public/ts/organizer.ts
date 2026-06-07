// @ts-nocheck
(() => {
document.addEventListener('DOMContentLoaded', async () => {
    if (typeof Auth !== 'undefined' && !Auth.isAuthenticated()) {
        window.location.href = '/';
        return;
    }

    // ===================== CONSTANTS =====================
    const STORAGE_KEY = '@Keystone:organizer';

    const LABEL_OPTIONS = [
        { id: 'green',  color: '#22c55e', name: 'Verde' },
        { id: 'yellow', color: '#eab308', name: 'Amarelo' },
        { id: 'orange', color: '#f97316', name: 'Laranja' },
        { id: 'red',    color: '#ef4444', name: 'Vermelho' },
        { id: 'purple', color: '#a855f7', name: 'Roxo' },
        { id: 'blue',   color: '#3b82f6', name: 'Azul' },
        { id: 'teal',   color: '#14b8a6', name: 'Ciano' },
        { id: 'pink',   color: '#ec4899', name: 'Rosa' },
    ];

    const HEADER_COLORS = [
        '#0ea5e9', '#22c55e', '#eab308', '#f97316',
        '#ef4444', '#a855f7', '#ec4899', '#6366f1',
        '#14b8a6', '#6b7280',
    ];

    const PRIORITY_CONFIG = {
        none:   { label: '',       class: '' },
        low:    { label: 'Baixa',  class: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' },
        medium: { label: 'Média',  class: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400' },
        high:   { label: 'Alta',   class: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' },
    };

    const COLUMN_COLORS = [
        'bg-blue-600', 'bg-violet-600', 'bg-emerald-600',
        'bg-rose-600', 'bg-amber-500', 'bg-cyan-600',
        'bg-pink-600', 'bg-indigo-600',
    ];

    const COLUMN_COLOR_CONFIG = [
        { cls: 'bg-blue-600',    hex: '#2563eb' },
        { cls: 'bg-violet-600',  hex: '#7c3aed' },
        { cls: 'bg-emerald-600', hex: '#059669' },
        { cls: 'bg-rose-600',    hex: '#e11d48' },
        { cls: 'bg-amber-500',   hex: '#f59e0b' },
        { cls: 'bg-cyan-600',    hex: '#0891b2' },
        { cls: 'bg-pink-600',    hex: '#db2777' },
        { cls: 'bg-indigo-600',  hex: '#4f46e5' },
    ];

    // ===================== STATE =====================
    let data = getDefaultData();
    let currentBoardId = data.lastBoardId || (data.boards.length > 0 ? data.boards[0].id : null);

    // drag state
    let draggedCardId = null;
    let draggedFromColumnId = null;

    // name modal callback
    let nameModalCallback = null;
    let nameModalColorEnabled = false;

    // card modal edit flag
    let editingCardId = null;

    // pending attachments while modal is open
    let pendingAttachments = [];

    // users list
    let usersData = [];

    // current view: 'kanban' | 'backlog'
    let currentView = 'kanban';

    // last used notify toggle state (persists across modal opens)
    let lastNotifyState = true;

    // ===================== PERSISTENCE =====================
    async function loadData() {
        try {
            const res = await api('/organizer', { cache: 'no-store' });
            if (res && res.data && res.data.state && Array.isArray(res.data.state.boards)) {
                return normalizeOrganizerData(res.data.state);
            }

            const localData = loadLocalData();
            if (localData) {
                await persistData(localData);
                localStorage.removeItem(STORAGE_KEY);
                return localData;
            }
        } catch (error) {
            console.error('Falha ao carregar organizador do banco', error);
            UI.showAlert('alertMessage', 'Não foi possível carregar o Organizador do banco de dados.', 'error');
        }

        return loadLocalData() || getDefaultData();
    }

    function loadLocalData() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return null;

            const parsed = JSON.parse(raw);
            if (parsed && Array.isArray(parsed.boards)) {
                return normalizeOrganizerData(parsed);
            }
        } catch (_error) {
            return null;
        }

        return null;
    }

    function normalizeOrganizerData(value) {
        const normalized = value && Array.isArray(value.boards) ? value : getDefaultData();
        normalized.boards.forEach(b => (b.columns || []).forEach(c => (c.cards || []).forEach(card => {
            if (card.assignee === 'undefined') card.assignee = 'all';
        })));

        return normalized;
    }

    async function persistData(nextData) {
        await api('/organizer', {
            method: 'PUT',
            body: JSON.stringify({ state: nextData }),
        });
    }

    function getDefaultData() {
        const boardId = uid();
        const col1 = uid(), col2 = uid(), col3 = uid();
        return {
            lastBoardId: boardId,
            boards: [{
                id: boardId,
                name: 'Meu Primeiro Quadro',
                columns: [
                    { id: col1, name: 'A Fazer',      colorClass: 'bg-blue-600',    colorHex: '#2563eb', cards: [] },
                    { id: col2, name: 'Em Andamento',  colorClass: 'bg-amber-500',   colorHex: '#f59e0b', cards: [] },
                    { id: col3, name: 'Concluído',     colorClass: 'bg-emerald-600', colorHex: '#059669', cards: [] },
                ],
            }],
        };
    }

    function saveData() {
        data.lastBoardId = currentBoardId;
        void persistData(data).catch(error => {
            console.error('Falha ao salvar organizador no banco', error);
            UI.showAlert('alertMessage', 'Falha ao salvar o Organizador no banco de dados.', 'error');
        });
    }

    function uid() {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    }

    // ===================== BOARD HELPERS =====================
    function getBoard(id) {
        return data.boards.find(b => b.id === id);
    }

    function getCurrentBoard() {
        return getBoard(currentBoardId);
    }

    function getColumn(board, colId) {
        return board.columns.find(c => c.id === colId);
    }

    function getCard(board, cardId) {
        for (const col of board.columns) {
            const card = col.cards.find(c => c.id === cardId);
            if (card) return { card, column: col };
        }
        return null;
    }

    function nextColumnColor(board) {
        const used = board.columns.map(c => c.colorClass);
        const unused = COLUMN_COLORS.filter(c => !used.includes(c));
        if (unused.length > 0) return unused[0];
        return COLUMN_COLORS[board.columns.length % COLUMN_COLORS.length];
    }

    function getColumnColorHex(colorClass) {
        const found = COLUMN_COLOR_CONFIG.find(c => c.cls === colorClass);
        return found ? found.hex : '#2563eb';
    }

    // ===================== RENDER =====================
    function renderBoardSelect() {
        const sel = document.getElementById('boardSelect');
        sel.innerHTML = data.boards.map(b =>
            `<option value="${b.id}" ${b.id === currentBoardId ? 'selected' : ''}>${escHtml(b.name)}</option>`
        ).join('');
        // Redimensiona o select para caber no texto da opção selecionada
        const tmp = document.createElement('select');
        tmp.style.cssText = 'visibility:hidden;position:absolute;font-size:0.875rem;padding-left:0.75rem;padding-right:2rem;';
        const opt = document.createElement('option');
        const selected = data.boards.find(b => b.id === currentBoardId);
        opt.textContent = selected ? selected.name : '';
        tmp.appendChild(opt);
        document.body.appendChild(tmp);
        sel.style.width = (tmp.offsetWidth + 4) + 'px';
        document.body.removeChild(tmp);
    }

    function renderBoard() {
        const board = getCurrentBoard();
        const container = document.getElementById('kanbanBoard');
        const addBtn = document.getElementById('addColumnBtn');

        // Remove existing columns (not the add button)
        container.querySelectorAll('.kanban-column').forEach(el => el.remove());

        if (!board) return;

        board.columns.forEach(col => {
            const colEl = buildColumnEl(col);
            container.insertBefore(colEl, addBtn);
        });

        setupDragAndDrop();
        if (currentView === 'backlog') renderBacklog();
    }

    function getBoardPrefix(board) {
        const words = (board.name || 'TASK').split(/\s+/).filter(Boolean);
        if (words.length === 1) return words[0].substring(0, 4).toUpperCase();
        return words.slice(0, 4).map(w => w[0] || '').join('').toUpperCase();
    }

    function renderBacklog() {
        const board = getCurrentBoard();
        const container = document.getElementById('backlogBoard');
        if (!container) return;
        if (!board || board.columns.length === 0) {
            container.innerHTML = '<p style="text-align:center;padding:2rem;color:#9ca3af;font-size:.875rem">Nenhuma lista neste quadro.</p>';
            return;
        }
        const TIPO_COLORS = {
            'Funcionalidade': { bg: '#0d9488', text: '#fff' },
            'Bug':            { bg: '#ef4444', text: '#fff' },
            'Melhoria':       { bg: '#3b82f6', text: '#fff' },
            'Tarefa':         { bg: '#6b7280', text: '#fff' },
            'Outro':          { bg: '#8b5cf6', text: '#fff' },
        };
        const prefix = getBoardPrefix(board);
        let taskNum = 1;
        const cardTaskIds = {};
        board.columns.forEach(col => {
            col.cards.forEach(card => {
                cardTaskIds[card.id] = prefix + '-' + String(taskNum++).padStart(3, '0');
            });
        });
        let totalSP = 0;
        board.columns.forEach(col => col.cards.forEach(c => { totalSP += parseInt(c.sp || 0) || 0; }));
        const dash = '<span style="color:#9ca3af">\u2014</span>';
        const sectionsHtml = board.columns.map(col => {
            const headerBg = col.colorHex || getColumnColorHex(col.colorClass);
            const colSP = col.cards.reduce((s, c) => s + (parseInt(c.sp || 0) || 0), 0);
            const rowsHtml = col.cards.map(card => {
                const taskId = cardTaskIds[card.id];
                const assigneeHtml = (() => {
                    if (!card.assignee || card.assignee === 'all') return dash;
                    const u = usersData.find(u => String(u.public_id) === String(card.assignee));
                    const name = u ? (u.full_name || u.email || String(card.assignee)) : String(card.assignee);
                    const initials = name.split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase() || '?';
                    return '<span class="backlog-avatar" title="' + escHtml(name) + '">' + escHtml(initials) + '</span>';
                })();
                const statusHtml = '<span class="backlog-badge" style="background:' + headerBg + '20;color:' + headerBg + ';border:1px solid ' + headerBg + '50">' + escHtml(col.name) + '</span>';
                const tipoHtml = (() => {
                    if (!card.tipo) return dash;
                    const tc = TIPO_COLORS[card.tipo] || { bg: '#6b7280', text: '#fff' };
                    return '<span class="backlog-tipo-badge" style="background:' + tc.bg + ';color:' + tc.text + '">' + escHtml(card.tipo) + '</span>';
                })();
                const epicHtml = (() => {
                    const labels = card.labels || [];
                    if (labels.length === 0) return dash;
                    const l = LABEL_OPTIONS.find(o => o.id === labels[0]);
                    if (!l) return dash;
                    return '<span class="backlog-badge" style="background:' + l.color + '20;color:' + l.color + ';border:1px solid ' + l.color + '50">' + escHtml(l.name) + '</span>';
                })();
                const dueHtml = (() => {
                    if (!card.dueDate) return dash;
                    const today = new Date();
                    const d = new Date(card.dueDate);
                    const ov = d < today;
                    const hasTime = card.dueDate.includes('T') && !card.dueDate.endsWith('T00:00');
                    const txt = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                        + (hasTime ? ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '');
                    return '<span style="font-size:.8125rem;color:' + (ov ? '#ef4444' : '#6b7280') + '">' + txt + '</span>';
                })();
                const stripHtml = card.headerColor
                    ? '<span style="flex-shrink:0;display:inline-block;width:.25rem;height:1.25rem;border-radius:9999px;background:' + card.headerColor + '"></span>'
                    : '';
                return '<tr class="backlog-row" data-card-id="' + card.id + '" data-col-id="' + col.id + '">'
                    + '<td style="width:2.5rem;padding:.5rem .75rem;text-align:center;vertical-align:middle"><input type="checkbox" class="backlog-check" onclick="event.stopPropagation()" title="Selecionar tarefa" aria-label="Selecionar tarefa"></td>'
                    + '<td style="padding:.5rem .75rem;vertical-align:middle;max-width:22rem"><div style="display:flex;align-items:center;gap:.4rem;min-width:0">' + stripHtml + '<span style="font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1">' + escHtml(card.title) + '</span>'
                    + (card.description ? '<span style="font-size:.75rem;color:#9ca3af;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:8rem;flex-shrink:0">' + escHtml(card.description) + '</span>' : '')
                    + '</div></td>'
                    + '<td style="padding:.5rem .75rem;vertical-align:middle;text-align:center;width:5rem">' + assigneeHtml + '</td>'
                    + '<td style="padding:.5rem .75rem;vertical-align:middle;white-space:nowrap;width:9rem">' + statusHtml + '</td>'
                    + '<td style="padding:.5rem .75rem;vertical-align:middle;white-space:nowrap;width:8rem">' + tipoHtml + '</td>'
                    + '<td style="padding:.5rem .75rem;vertical-align:middle;white-space:nowrap;width:7.5rem"><span style="font-family:monospace;font-size:.75rem;color:#6366f1">' + taskId + '</span></td>'
                    + '<td style="padding:.5rem .75rem;vertical-align:middle;white-space:nowrap;width:5.5rem">' + (card.sp ? '<span style="font-size:.8125rem;font-weight:500">' + escHtml(String(card.sp)) + ' SP</span>' : dash) + '</td>'
                    + '<td style="padding:.5rem .75rem;vertical-align:middle;white-space:nowrap;width:8rem">' + epicHtml + '</td>'
                    + '<td style="padding:.5rem .75rem;vertical-align:middle;white-space:nowrap;width:7rem">' + dueHtml + '</td>'
                    + '</tr>';
            }).join('');
            const emptyRow = col.cards.length === 0
                ? '<tr class="backlog-empty-row"><td colspan="9" style="padding:.75rem;text-align:center;font-size:.8125rem;color:#9ca3af">Nenhum card nesta lista.</td></tr>'
                : '';
            return '<tbody>'
                + '<tr><td colspan="9" style="padding:0"><div style="display:flex;align-items:center;justify-content:space-between;padding:.5rem .75rem;background:' + headerBg + '">'
                + '<div style="display:flex;align-items:center;gap:.5rem">'
                + '<svg style="width:.875rem;height:.875rem;flex-shrink:0;color:rgba(255,255,255,.8)" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>'
                + '<span style="color:#fff;font-weight:600;font-size:.875rem">' + escHtml(col.name) + '</span>'
                + '<span style="color:rgba(255,255,255,.75);font-size:.75rem;background:rgba(255,255,255,.2);padding:.1rem .45rem;border-radius:9999px">' + col.cards.length + '</span>'
                + '</div>'
                + (colSP > 0 ? '<span style="color:rgba(255,255,255,.8);font-size:.75rem">' + colSP + ' SP</span>' : '')
                + '</div></td></tr>'
                + rowsHtml
                + emptyRow
                + '<tr class="backlog-addrow" data-col-id="' + col.id + '"><td colspan="9" style="padding:.4rem .75rem">+ Adicionar tarefa</td></tr>'
                + '</tbody>';
        }).join('');
        const totalFooter = totalSP > 0
            ? '<tfoot><tr class="backlog-totalrow"><td colspan="5" style="padding:.5rem .75rem"></td><td style="padding:.5rem .75rem">' + totalSP + ' SP<br><small style="font-weight:400;opacity:.7">Total</small></td><td colspan="3" style="padding:.5rem .75rem"></td></tr></tfoot>'
            : '';
        container.innerHTML = '<div class="backlog-table-wrapper"><table class="backlog-table">'
            + '<thead><tr class="backlog-thead-row">'
            + '<th style="width:2.5rem"></th>'
            + '<th>Tarefa</th>'
            + '<th style="width:5rem;text-align:center">Resp.</th>'
            + '<th style="width:9rem">Status</th>'
            + '<th style="width:8rem">Tipo</th>'
            + '<th style="width:7.5rem">ID da tarefa</th>'
            + '<th style="width:5.5rem">SP est.</th>'
            + '<th style="width:8rem">Épico</th>'
            + '<th style="width:7rem">Vencimento</th>'
            + '</tr></thead>'
            + sectionsHtml
            + totalFooter
            + '</table></div>';
        container.querySelectorAll('.backlog-row').forEach(row => {
            row.addEventListener('click', () => openCardModal(row.dataset.cardId, row.dataset.colId));
        });
        container.querySelectorAll('.backlog-addrow').forEach(row => {
            row.addEventListener('click', () => openCardModal(null, row.dataset.colId));
        });
    }

    function setView(view) {
        currentView = view;
        const vk = document.getElementById('viewKanban');
        const vb = document.getElementById('viewBacklog');
        const btnK = document.getElementById('btnViewKanban');
        const btnB = document.getElementById('btnViewBacklog');
        if (view === 'kanban') {
            vk.classList.remove('hidden');
            vb.classList.add('hidden');
            btnK.classList.add('view-btn-active');
            btnB.classList.remove('view-btn-active');
        } else {
            vk.classList.add('hidden');
            vb.classList.remove('hidden');
            btnB.classList.add('view-btn-active');
            btnK.classList.remove('view-btn-active');
            renderBacklog();
        }
    }

    function buildColumnEl(col) {
        const wrapper = document.createElement('div');
        wrapper.className = 'kanban-column';
        wrapper.dataset.columnId = col.id;

        const headerBg = col.colorHex || getColumnColorHex(col.colorClass);

        wrapper.innerHTML = `
            <div class="flex items-center justify-between px-3 py-2.5 rounded-t-xl select-none" style="background:${headerBg}">
                <h3 class="text-white font-semibold text-sm truncate flex-1 mr-2">${escHtml(col.name)}</h3>
                <div class="flex items-center gap-1 shrink-0">
                    <span class="text-white/80 text-xs font-medium bg-white/20 px-1.5 py-0.5 rounded-full col-count">${col.cards.length}</span>
                    <button type="button" class="btnColRename text-white/80 hover:text-white p-0.5 rounded transition-colors" title="Renomear lista">
                        <svg class="h-3.5 w-3.5 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                        </svg>
                    </button>
                    <button type="button" class="btnColDelete text-white/80 hover:text-white p-0.5 rounded transition-colors" title="Excluir lista">
                        <svg class="h-3.5 w-3.5 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                    </button>
                </div>
            </div>
            <div class="kanban-cards kanban-col-body px-2 py-2 space-y-2" data-column-id="${col.id}">
                ${col.cards.map(card => buildCardHTML(card)).join('')}
            </div>
            <div class="kanban-col-body px-2 pb-2 rounded-b-xl">
                <button type="button" class="btnAddCard kanban-col-addbtn">
                    <svg class="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                    </svg>
                    Adicionar card
                </button>
            </div>
        `;

        // Events for column
        wrapper.querySelector('.btnColRename').addEventListener('click', () => onRenameColumn(col.id));
        wrapper.querySelector('.btnColDelete').addEventListener('click', () => onDeleteColumn(col.id));
        wrapper.querySelector('.btnAddCard').addEventListener('click', () => openCardModal(null, col.id));

        // Events for cards
        wrapper.querySelectorAll('.kanban-card').forEach(cardEl => {
            cardEl.addEventListener('click', e => {
                if (e.target.closest('.btnCardEdit')) return; // handled separately
                const cardId = cardEl.dataset.cardId;
                openCardModal(cardId, col.id);
            });
        });

        return wrapper;
    }

    function buildCardHTML(card) {
        const labels = (card.labels || []).map(lId => {
            const l = LABEL_OPTIONS.find(o => o.id === lId);
            return l ? `<span class="label-chip" style="background:${l.color}" title="${l.name}"></span>` : '';
        }).join('');

        const priority = card.priority && card.priority !== 'none' ? PRIORITY_CONFIG[card.priority] : null;

        const assigneeHtml = (() => {
            if (!card.assignee || card.assignee === 'all') return '';
            const user = usersData.find(u => String(u.public_id) === String(card.assignee));
            const label = user ? (user.full_name || user.email || card.assignee) : card.assignee;
            return `<span class="inline-flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-1.5 py-0.5 rounded-full">
                <svg class="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
                ${escHtml(label)}
            </span>`;
        })();

        const dueDateHtml = card.dueDate ? (() => {
            const today = new Date();
            const due = new Date(card.dueDate);
            const overdue = due < today;
            const hasTime = card.dueDate.includes('T') && !card.dueDate.endsWith('T00:00');
            const formatted = due.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                + (hasTime ? ' ' + due.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '');
            return `<span class="inline-flex items-center gap-1 text-xs ${overdue ? 'text-red-500 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}">
                <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                ${formatted}
            </span>`;
        })() : '';

        return `
            <div class="kanban-card" draggable="true" data-card-id="${card.id}">
            <div class="kanban-card-inner">
                ${card.headerColor ? `<div class="card-header-strip" style="background:${card.headerColor}"></div>` : ''}
                <div class="px-3 py-3">
                    ${labels ? `<div class="flex flex-wrap gap-1 mb-2">${labels}</div>` : ''}
                    <p class="text-sm font-medium text-gray-800 dark:text-gray-100 leading-snug">${escHtml(card.title)}</p>
                    ${card.description ? `<p class="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">${escHtml(card.description)}</p>` : ''}
                    ${priority || dueDateHtml || assigneeHtml ? `
                    <div class="flex items-center gap-2 mt-2 flex-wrap">
                        ${priority ? `<span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${priority.class}">${priority.label}</span>` : ''}
                        ${dueDateHtml}
                        ${assigneeHtml}
                    </div>` : ''}
                    ${(card.attachments || []).length > 0 ? `
                    <div class="flex items-center gap-1 mt-2 text-xs text-gray-400 dark:text-gray-500">
                        <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/></svg>
                        ${card.attachments.length}
                    </div>` : ''}
                </div>
            </div>
            </div>`;
    }

    // ===================== DRAG AND DROP =====================
    function setupDragAndDrop() {
        document.querySelectorAll('.kanban-card').forEach(card => {
            card.addEventListener('dragstart', onCardDragStart);
            card.addEventListener('dragend', onCardDragEnd);
        });

        document.querySelectorAll('.kanban-cards').forEach(zone => {
            zone.addEventListener('dragover', onZoneDragOver);
            zone.addEventListener('dragleave', onZoneDragLeave);
            zone.addEventListener('drop', onZoneDrop);
        });
    }

    function onCardDragStart(e) {
        draggedCardId = e.currentTarget.dataset.cardId;
        draggedFromColumnId = e.currentTarget.closest('.kanban-cards').dataset.columnId;
        e.currentTarget.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
    }

    function onCardDragEnd(e) {
        e.currentTarget.classList.remove('dragging');
        document.querySelectorAll('.drop-placeholder').forEach(el => el.remove());
        document.querySelectorAll('.kanban-column').forEach(el => el.classList.remove('drag-over'));
    }

    function onZoneDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const zone = e.currentTarget;
        zone.closest('.kanban-column').classList.add('drag-over');

        // Insert placeholder near cursor
        const existing = zone.querySelector('.drop-placeholder');
        const afterEl = getDragAfterElement(zone, e.clientY);
        if (!existing) {
            const ph = document.createElement('div');
            ph.className = 'drop-placeholder';
            if (!afterEl) zone.appendChild(ph);
            else zone.insertBefore(ph, afterEl);
        } else {
            if (!afterEl) zone.appendChild(existing);
            else zone.insertBefore(existing, afterEl);
        }
    }

    function onZoneDragLeave(e) {
        const zone = e.currentTarget;
        if (!zone.contains(e.relatedTarget)) {
            zone.closest('.kanban-column').classList.remove('drag-over');
            zone.querySelectorAll('.drop-placeholder').forEach(el => el.remove());
        }
    }

    function onZoneDrop(e) {
        e.preventDefault();
        const zone = e.currentTarget;
        zone.closest('.kanban-column').classList.remove('drag-over');
        zone.querySelectorAll('.drop-placeholder').forEach(el => el.remove());

        const toColumnId = zone.dataset.columnId;
        if (!draggedCardId) return;

        const board = getCurrentBoard();
        const fromCol = getColumn(board, draggedFromColumnId);
        const toCol = getColumn(board, toColumnId);
        if (!fromCol || !toCol) return;

        const cardIdx = fromCol.cards.findIndex(c => c.id === draggedCardId);
        if (cardIdx === -1) return;
        const [card] = fromCol.cards.splice(cardIdx, 1);

        // Determine insert position
        const afterEl = getDragAfterElement(zone, e.clientY);
        if (!afterEl) {
            toCol.cards.push(card);
        } else {
            const afterIdx = toCol.cards.findIndex(c => c.id === afterEl.dataset.cardId);
            toCol.cards.splice(afterIdx, 0, card);
        }

        saveData();
        renderBoard();
        draggedCardId = null;
        draggedFromColumnId = null;
    }

    function getDragAfterElement(zone, y) {
        const draggable = [...zone.querySelectorAll('.kanban-card:not(.dragging)')];
        return draggable.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset, element: child };
            }
            return closest;
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    // ===================== CARD MODAL =====================
    function openCardModal(cardId, columnId) {
        editingCardId = cardId;
        const modal = document.getElementById('cardModal');
        const titleEl = document.getElementById('cardModalTitle');
        const deleteBtn = document.getElementById('btnDeleteCard');

        document.getElementById('cardId').value = cardId || '';
        document.getElementById('cardColumnId').value = columnId;

        renderLabelPicker(cardId);
        renderHeaderColorPicker(cardId);
        renderAssigneePicker(cardId);

        // Load attachments
        if (cardId) {
            const board = getCurrentBoard();
            const result = getCard(board, cardId);
            pendingAttachments = result ? [...(result.card.attachments || [])] : [];
        } else {
            pendingAttachments = [];
        }
        renderAttachmentList();

        if (cardId) {
            const board = getCurrentBoard();
            const result = getCard(board, cardId);
            if (!result) return;
            const { card } = result;
            titleEl.textContent = 'Editar Card';
            document.getElementById('cardTitle').value = card.title || '';
            document.getElementById('cardDescription').value = card.description || '';
            document.getElementById('cardDueDate').value = card.dueDate || '';
            document.getElementById('cardPriority').value = card.priority || 'none';
            document.getElementById('cardAssignee').value = card.assignee || 'all';
            document.getElementById('cardTipo').value = card.tipo || '';
            document.getElementById('cardSP').value = card.sp || '';
            deleteBtn.classList.remove('hidden');
            deleteBtn.classList.add('flex');
        } else {
            titleEl.textContent = 'Novo Card';
            document.getElementById('cardTitle').value = '';
            document.getElementById('cardDescription').value = '';
            const now = new Date();
            now.setSeconds(0, 0);
            document.getElementById('cardDueDate').value = now.toISOString().slice(0, 16);
            document.getElementById('cardPriority').value = 'none';
            document.getElementById('cardAssignee').value = 'all';
            document.getElementById('cardTipo').value = '';
            document.getElementById('cardSP').value = '';
            deleteBtn.classList.add('hidden');
            deleteBtn.classList.remove('flex');
        }

        modal.classList.remove('hidden');
        document.getElementById('cardTitle').focus();

        // Restore notify toggle: use saved card value (edit) or last used state (new)
        if (cardId) {
            const board2 = getCurrentBoard();
            const res2 = getCard(board2, cardId);
            setNotifyToggle(res2 ? !!res2.card.notify : lastNotifyState);
        } else {
            setNotifyToggle(lastNotifyState);
        }
    }

    function closeCardModal() {
        document.getElementById('cardModal').classList.add('hidden');
        editingCardId = null;
        pendingAttachments = [];
    }

    function renderLabelPicker(cardId) {
        const board = getCurrentBoard();
        let activeLabels = [];
        if (cardId) {
            const result = getCard(board, cardId);
            if (result) activeLabels = result.card.labels || [];
        }

        const container = document.getElementById('labelPicker');
        container.innerHTML = LABEL_OPTIONS.map(l => {
            const active = activeLabels.includes(l.id);
            return `
                <button type="button" data-label-id="${l.id}"
                    class="label-picker-btn flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border-2 transition-all ${active ? 'border-gray-800 dark:border-white opacity-100' : 'border-transparent opacity-70 hover:opacity-100'}"
                    style="background:${l.color}20; color:${l.color}; border-color: ${active ? l.color : 'transparent'}">
                    <span class="w-3 h-3 rounded-full shrink-0" style="background:${l.color}"></span>
                    ${l.name}
                </button>`;
        }).join('');

        container.querySelectorAll('.label-picker-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const isActive = btn.style.borderColor !== 'transparent' && btn.style.borderColor !== '';
                const labelId = btn.dataset.labelId;
                const l = LABEL_OPTIONS.find(o => o.id === labelId);
                if (isActive) {
                    btn.style.borderColor = 'transparent';
                    btn.classList.remove('border-gray-800', 'dark:border-white');
                } else {
                    btn.style.borderColor = l.color;
                }
            });
        });
    }

    function setNotifyToggle(on) {
        const btn = document.getElementById('cardNotifyToggle');
        if (!btn) return;
        btn.setAttribute('aria-checked', on ? 'true' : 'false');
        btn.style.backgroundColor = on ? '#6366f1' : '';
        const knob = btn.querySelector('span');
        if (knob) knob.style.transform = on ? 'translateX(16px)' : 'translateX(0)';
    }

    function getNotifyToggle() {
        const btn = document.getElementById('cardNotifyToggle');
        return btn ? btn.getAttribute('aria-checked') === 'true' : false;
    }

    function renderAttachmentList() {
        const container = document.getElementById('attachmentList');
        if (!container) return;
        if (pendingAttachments.length === 0) {
            container.innerHTML = '';
            return;
        }
        container.innerHTML = pendingAttachments.map((att, i) => `
            <div class="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-gray-50 dark:bg-slate-700/50 border border-gray-200 dark:border-slate-600">
                <svg class="h-4 w-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/>
                </svg>
                <a href="${att.data}" download="${escHtml(att.name)}" class="text-xs text-brand-600 dark:text-brand-400 hover:underline truncate flex-1" title="${escHtml(att.name)}">${escHtml(att.name)}</a>
                <span class="text-xs text-gray-400 shrink-0">${formatBytes(att.size)}</span>
                <button type="button" class="btnRemoveAttachment text-gray-400 hover:text-red-500 shrink-0 transition-colors" data-idx="${i}" title="Remover">
                    <svg class="h-3.5 w-3.5 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                </button>
            </div>`).join('');

        container.querySelectorAll('.btnRemoveAttachment').forEach(btn => {
            btn.addEventListener('click', () => {
                pendingAttachments.splice(parseInt(btn.dataset.idx), 1);
                renderAttachmentList();
            });
        });
    }

    function formatBytes(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    function renderAssigneePicker(cardId) {
        const sel = document.getElementById('cardAssignee');
        // Preserve current value before rebuilding options
        const preserve = sel.value || 'all';
        const current = (() => {
            if (cardId) {
                const board = getCurrentBoard();
                const result = getCard(board, cardId);
                return result ? (result.card.assignee || 'all') : preserve;
            }
            return preserve;
        })();

        sel.innerHTML = '<option value="all">Todos</option>' +
            usersData.filter(u => u.public_id).map(u =>
                `<option value="${u.public_id}">${escHtml(u.full_name || u.email || u.public_id)}</option>`
            ).join('');
        sel.value = current;
        // If the option doesn't exist yet (usersData empty), store for later
        if (sel.value !== current) sel.dataset.pending = current;
        else delete sel.dataset.pending;
    }

    function getSelectedLabels() {
        return [...document.querySelectorAll('.label-picker-btn')]
            .filter(btn => btn.style.borderColor && btn.style.borderColor !== 'transparent' && btn.style.borderColor !== '')
            .map(btn => btn.dataset.labelId);
    }

    function renderHeaderColorPicker(cardId) {
        const board = getCurrentBoard();
        let activeColor = '';
        if (cardId) {
            const result = getCard(board, cardId);
            if (result) activeColor = result.card.headerColor || '';
        }
        document.getElementById('cardHeaderColor').value = activeColor;

        const container = document.getElementById('headerColorPicker');
        const noneHtml = `<button type="button" class="hcolor-btn w-7 h-7 rounded-full border border-gray-300 dark:border-slate-500 flex items-center justify-center bg-white dark:bg-slate-700 hover:border-gray-400 transition-all shrink-0" data-hcolor="" title="Sem cor" ${activeColor === '' ? 'data-selected' : ''}>
            <svg class="h-3 w-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/>
            </svg>
        </button>`;

        const colorHtml = HEADER_COLORS.map(hex =>
            `<button type="button" class="hcolor-btn w-7 h-7 rounded-full shrink-0 transition-all" data-hcolor="${hex}" title="${hex}" style="background:${hex}" ${activeColor === hex ? 'data-selected' : ''}></button>`
        ).join('');

        container.innerHTML = noneHtml + colorHtml;

        container.querySelectorAll('.hcolor-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                container.querySelectorAll('.hcolor-btn').forEach(b => b.removeAttribute('data-selected'));
                btn.setAttribute('data-selected', '1');
                document.getElementById('cardHeaderColor').value = btn.dataset.hcolor;
            });
        });
    }

    function saveCard() {
        const title = document.getElementById('cardTitle').value.trim();
        if (!title) {
            document.getElementById('cardTitle').focus();
            document.getElementById('cardTitle').classList.add('ring-2', 'ring-red-500');
            return;
        }
        document.getElementById('cardTitle').classList.remove('ring-2', 'ring-red-500');

        const columnId = document.getElementById('cardColumnId').value;
        const cardId = document.getElementById('cardId').value;
        const board = getCurrentBoard();
        const col = getColumn(board, columnId);
        if (!col) return;

        const cardData = {
            title,
            description: document.getElementById('cardDescription').value.trim(),
            dueDate: document.getElementById('cardDueDate').value || '',
            priority: document.getElementById('cardPriority').value,
            labels: getSelectedLabels(),
            headerColor: document.getElementById('cardHeaderColor').value,
            assignee: document.getElementById('cardAssignee').value || 'all',
            tipo: document.getElementById('cardTipo').value || '',
            sp: document.getElementById('cardSP').value ? parseInt(document.getElementById('cardSP').value) : 0,
            attachments: pendingAttachments,
            notify: getNotifyToggle(),
        };

        // Persist last notify state
        lastNotifyState = cardData.notify;

        const isNew = !cardId;

        if (!isNew) {
            // edit
            const result = getCard(board, cardId);
            if (result) Object.assign(result.card, cardData);
        } else {
            // new
            col.cards.push({ id: uid(), ...cardData });
        }

        // Notificar pelo sino se toggle ativo
        if (getNotifyToggle()) {
            const assigneeId = cardData.assignee;
            let assigneeName = 'Todos';
            if (assigneeId && assigneeId !== 'all') {
                const user = usersData.find(u => String(u.public_id) === String(assigneeId));
                assigneeName = user ? (user.full_name || user.email || assigneeId) : assigneeId;
            }
            const actionLabel = isNew ? 'Novo card criado' : 'Card atualizado';
            const msgParts = [`"${cardData.title}"`];
            if (assigneeId && assigneeId !== 'all') msgParts.push(`Responsável: ${assigneeName}`);
            if (cardData.dueDate) {
                const d = new Date(cardData.dueDate);
                const hasTime = cardData.dueDate.includes('T') && !cardData.dueDate.endsWith('T00:00');
                const dtStr = d.toLocaleDateString('pt-BR') + (hasTime ? ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '');
                msgParts.push(`Vence em ${dtStr}`);
            }
            window.dispatchEvent(new CustomEvent('add-notification', {
                detail: {
                    title: `${actionLabel}: ${cardData.title}`,
                    message: msgParts.slice(1).join(' · ') || col.name,
                    type: 'success'
                }
            }));
        }

        saveData();
        renderBoard();
        closeCardModal();
    }

    function deleteCard() {
        const cardId = document.getElementById('cardId').value;
        if (!cardId) return;
        const board = getCurrentBoard();
        for (const col of board.columns) {
            const idx = col.cards.findIndex(c => c.id === cardId);
            if (idx !== -1) { col.cards.splice(idx, 1); break; }
        }
        saveData();
        renderBoard();
        closeCardModal();
    }

    // ===================== COLUMN OPERATIONS =====================
    function onRenameColumn(colId) {
        const board = getCurrentBoard();
        const col = getColumn(board, colId);
        openNameModal('Renomear Lista', col.name, (newName, colorClass) => {
            col.name = newName;
            if (colorClass) {
                col.colorClass = colorClass;
                col.colorHex = getColumnColorHex(colorClass);
            }
            saveData();
            renderBoard();
        }, { showColors: true, activeColor: col.colorClass });
    }

    function onDeleteColumn(colId) {
        if (!confirm('Excluir esta lista e todos os seus cards?')) return;
        const board = getCurrentBoard();
        board.columns = board.columns.filter(c => c.id !== colId);
        saveData();
        renderBoard();
    }

    function addColumn() {
        openNameModal('Nova Lista', '', (name, colorClass) => {
            const board = getCurrentBoard();
            const cls = colorClass || nextColumnColor(board);
            board.columns.push({
                id: uid(),
                name,
                colorClass: cls,
                colorHex: getColumnColorHex(cls),
                cards: [],
            });
            saveData();
            renderBoard();
        }, { showColors: true });
    }

    // ===================== BOARD OPERATIONS =====================
    function addBoard() {
        openNameModal('Novo Quadro', '', name => {
            const boardId = uid();
            data.boards.push({
                id: boardId,
                name,
                columns: [],
            });
            currentBoardId = boardId;
            saveData();
            renderBoardSelect();
            renderBoard();
        });
    }

    function renameBoard() {
        const board = getCurrentBoard();
        if (!board) return;
        openNameModal('Renomear Quadro', board.name, newName => {
            board.name = newName;
            saveData();
            renderBoardSelect();
        });
    }

    function deleteBoard() {
        if (data.boards.length <= 1) {
            alert('Não é possível excluir o único quadro.');
            return;
        }
        if (!confirm('Excluir este quadro e todos os seus dados?')) return;
        data.boards = data.boards.filter(b => b.id !== currentBoardId);
        currentBoardId = data.boards[0].id;
        saveData();
        renderBoardSelect();
        renderBoard();
    }

    // ===================== NAME MODAL =====================
    function openNameModal(title, defaultValue, callback, options = {}) {
        const { showColors = false, activeColor = '' } = options;
        nameModalColorEnabled = showColors;

        document.getElementById('nameModalTitle').textContent = title;
        document.getElementById('nameInput').value = defaultValue;

        const colorSection = document.getElementById('nameModalColorSection');
        if (showColors) {
            colorSection.classList.remove('hidden');
            renderColumnColorPicker(activeColor);
        } else {
            colorSection.classList.add('hidden');
        }

        document.getElementById('nameModal').classList.remove('hidden');
        setTimeout(() => {
            const inp = document.getElementById('nameInput');
            inp.focus();
            inp.select();
        }, 50);
        nameModalCallback = callback;
    }

    function renderColumnColorPicker(activeColorClass) {
        document.getElementById('nameModalColorValue').value = activeColorClass || '';
        const container = document.getElementById('nameModalColorPicker');
        container.innerHTML = COLUMN_COLOR_CONFIG.map(({ cls, hex }) =>
            `<button type="button" class="col-color-btn w-8 h-8 rounded-full shrink-0 transition-all" data-cls="${cls}" title="${cls}" style="background:${hex}" ${activeColorClass === cls ? 'data-selected' : ''}></button>`
        ).join('');

        container.querySelectorAll('.col-color-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                container.querySelectorAll('.col-color-btn').forEach(b => b.removeAttribute('data-selected'));
                btn.setAttribute('data-selected', '1');
                document.getElementById('nameModalColorValue').value = btn.dataset.cls;
            });
        });
    }

    function confirmNameModal() {
        const value = document.getElementById('nameInput').value.trim();
        if (!value) {
            document.getElementById('nameInput').focus();
            return;
        }
        const colorClass = nameModalColorEnabled
            ? (document.getElementById('nameModalColorValue').value || '')
            : '';
        document.getElementById('nameModal').classList.add('hidden');
        if (nameModalCallback) nameModalCallback(value, colorClass);
        nameModalCallback = null;
    }

    function closeNameModal() {
        document.getElementById('nameModal').classList.add('hidden');
        nameModalCallback = null;
    }

    // ===================== UTIL =====================
    function escHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // ===================== EVENT LISTENERS =====================
    document.getElementById('boardSelect').addEventListener('change', e => {
        currentBoardId = e.target.value;
        saveData();
        renderBoard();
    });

    document.getElementById('btnNewBoard').addEventListener('click', addBoard);
    document.getElementById('btnRenameBoard').addEventListener('click', renameBoard);
    document.getElementById('btnDeleteBoard').addEventListener('click', deleteBoard);
    document.getElementById('btnAddColumn').addEventListener('click', addColumn);

    // View toggle
    document.getElementById('btnViewKanban').addEventListener('click', () => setView('kanban'));
    document.getElementById('btnViewBacklog').addEventListener('click', () => setView('backlog'));

    // Card modal
    // File input handler
    document.getElementById('cardFileInput').addEventListener('change', async e => {
        const MAX = 500 * 1024;
        for (const file of [...e.target.files]) {
            if (file.size > MAX) {
                alert(`"${file.name}" excede o limite de 500 KB e não foi adicionado.`);
                continue;
            }
            const fileData = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
            pendingAttachments.push({ name: file.name, size: file.size, type: file.type, data: fileData });
        }
        e.target.value = '';
        renderAttachmentList();
    });

    // Notify toggle click (also fires when label is clicked via JS)
    document.getElementById('cardNotifyToggle').addEventListener('click', () => {
        const current = getNotifyToggle();
        setNotifyToggle(!current);
    });
    document.getElementById('cardNotifyLabel').addEventListener('click', () => {
        const current = getNotifyToggle();
        setNotifyToggle(!current);
    });

    document.getElementById('btnSaveCard').addEventListener('click', saveCard);
    document.getElementById('btnDeleteCard').addEventListener('click', deleteCard);
    document.getElementById('btnCloseCardModal').addEventListener('click', closeCardModal);
    document.getElementById('btnCancelCardModal').addEventListener('click', closeCardModal);
    document.getElementById('cardModalBackdrop').addEventListener('click', closeCardModal);
    document.getElementById('cardTitle').addEventListener('keydown', e => {
        if (e.key === 'Enter') saveCard();
    });

    // Name modal
    document.getElementById('btnConfirmNameModal').addEventListener('click', confirmNameModal);
    document.getElementById('btnCancelNameModal').addEventListener('click', closeNameModal);
    document.getElementById('nameModalBackdrop').addEventListener('click', closeNameModal);
    document.getElementById('nameInput').addEventListener('keydown', e => {
        if (e.key === 'Enter') confirmNameModal();
        if (e.key === 'Escape') closeNameModal();
    });

    // ===================== INIT =====================
    data = await loadData();
    currentBoardId = data.lastBoardId || (data.boards.length > 0 ? data.boards[0].id : null);

    // Ensure at least one board
    if (data.boards.length === 0) {
        const defaultData = getDefaultData();
        data.boards = defaultData.boards;
        currentBoardId = defaultData.lastBoardId;
        saveData();
    }

    renderBoardSelect();
    renderBoard();

    // Load users for assignee picker
    (async () => {
        try {
            const res = await api('/users');
            usersData = (res && res.data) ? res.data : [];
        } catch (_) {
            usersData = [];
        }
        // Re-render board so assignee names appear correctly
        renderBoard();
        // If modal is open with a pending assignee value, restore it now
        const sel = document.getElementById('cardAssignee');
        if (sel && sel.dataset.pending) {
            const opts = '<option value="all">Todos</option>' +
                usersData.filter(u => u.public_id).map(u =>
                    `<option value="${u.public_id}">${escHtml(u.full_name || u.email || u.public_id)}</option>`
                ).join('');
            const current = sel.dataset.pending;
            sel.innerHTML = opts;
            sel.value = current;
            delete sel.dataset.pending;
        }
    })();
});
})();
