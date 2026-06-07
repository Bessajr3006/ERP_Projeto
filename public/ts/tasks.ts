// @ts-nocheck
(() => {
document.addEventListener('DOMContentLoaded', async () => {
    if (!Auth.isAuthenticated()) {
        window.location.href = '/';
        return;
    }
    
    // Core Elements
    const form = document.getElementById('taskForm');
    const inputId = document.getElementById('taskId');
    const inputTitle = document.getElementById('taskTitle');
    const inputDueDate = document.getElementById('taskDueDate');
    const selectUser = document.getElementById('taskUserId');
    const selectStatus = document.getElementById('taskStatus');
    const selectPersonType = document.getElementById('taskPersonType');
    const wrapperPersonId = document.getElementById('taskPersonIdWrapper');
    const selectPersonId = document.getElementById('taskPersonId');
    const btnSave = document.getElementById('btnSaveTask');
    const btnCancel = document.getElementById('btnCancelEdit');
    const taskModal = document.getElementById('taskModal');
    const taskModalTitle = document.getElementById('taskModalTitle');
    const btnOpenTaskModal = document.getElementById('btnOpenTaskModal');
    const btnCloseTaskModal = document.getElementById('btnCloseTaskModal');
    const btnCancelModal = document.getElementById('btnCancelModal');
    const taskModalBackdrop = document.getElementById('taskModalBackdrop');
    const tasksList = document.getElementById('tasksList');
    const tasksListContainer = document.getElementById('tasksListContainer');
    const filterBtns = document.querySelectorAll('.task-filter-btn');
    const viewModeBtns = document.querySelectorAll('.view-mode-btn');

    const btnAttachFile = document.getElementById('btnAttachFile');
    const taskFileInput = document.getElementById('taskFileInput');
    const btnRecordAudio = document.getElementById('btnRecordAudio');
    const audioRecordText = document.getElementById('audioRecordText');
    const attachmentsPreview = document.getElementById('attachmentsPreview');

    let allTasks = [];
    let currentAttachments = [];
    let mediaRecorder = null;
    let audioChunks = [];
    let isRecording = false;
    let users = [];
    let currentFilter = 'pending';
    let currentViewMode = 'list';
    let calendarDate = new Date(); // Start at current month
    let agendaDayDate = new Date();
    
    let customersList = [];
    let suppliersList = [];
    let companiesList = [];

    // 1. Carregar Usuários Reais
    async function loadUsers() {
        try {
            const res = await api('/users');
            if (res && res.data) {
                users = res.data;
                
                selectUser.innerHTML = '<option value="" selected>Todos</option>' + 
                    users.map(u => `<option value="${u.public_id || u.id}">${u.full_name || u.name || 'Usuário Sem Nome'}</option>`).join('');
            }
        } catch (e) {
            console.error('Falha ao carregar usuários para as tarefas', e);
        }
    }

    // 1b. Carregar Entidades Vinculáveis
    async function loadLinkableEntities() {
        try {
            const [custRes, suppRes, authRes] = await Promise.all([
                api('/entities/customers').catch(() => ({ data: [] })),
                api('/entities/suppliers').catch(() => ({ data: [] })),
                api('/auth/me').catch(() => (null))
            ]);
            customersList = custRes.data || [];
            suppliersList = suppRes.data || [];
            
            if (authRes && authRes.data) {
                if (authRes.data.companies && authRes.data.companies.length > 0) {
                    companiesList = authRes.data.companies;
                } else if (authRes.data.company) {
                    companiesList = [authRes.data.company];
                } else {
                    companiesList = [];
                }
            }
        } catch(e) { console.error("Falha carregar entidades", e); }
    }

    // Resolutor de Nomes
    function resolvePersonName(type, id) {
        if (!type || !id) return 'Desconhecido';
        if (type === 'customer') {
            const p = customersList.find(x => x.public_id === id);
            return p ? p.name : 'Desconhecido';
        } else if (type === 'supplier') {
            const p = suppliersList.find(x => x.public_id === id);
            return p ? p.name : 'Desconhecido';
        } else if (type === 'company') {
            const p = companiesList.find(x => (x.public_id || x.id) === id);
            return p ? (p.legal_name || p.name || 'Empresa') : 'Desconhecido';
        } else if (['seller', 'buyer', 'service_provider', 'user'].includes(type)) {
            const p = users.find(x => (x.public_id || x.id) === id);
            return p ? (p.full_name || p.name || 'Usuário') : 'Desconhecido';
        }
        return 'Desconhecido';
    }

    if (selectPersonType) {
        selectPersonType.addEventListener('change', () => {
            const type = selectPersonType.value;
            if (!type) {
                wrapperPersonId.classList.add('hidden');
                selectPersonId.innerHTML = '<option value="">Selecione o tipo primeiro...</option>';
                selectPersonId.value = '';
                return;
            }
            
            wrapperPersonId.classList.remove('hidden');
            let options = '<option value="">Selecione a pessoa vinculada...</option>';
            
            if (type === 'customer') {
                customersList.forEach(c => options += `<option value="${c.public_id}">${c.name}</option>`);
            } else if (type === 'supplier') {
                suppliersList.forEach(s => options += `<option value="${s.public_id}">${s.name}</option>`);
            } else if (type === 'company') {
                companiesList.forEach(c => options += `<option value="${c.public_id || c.id}">${c.legal_name || c.name || 'Empresa'}</option>`);
            } else if (['seller', 'buyer', 'service_provider'].includes(type)) {
                users.filter(u => u.role === type).forEach(u => options += `<option value="${u.public_id || u.id}">${u.full_name || u.name}</option>`);
            } else {
                users.forEach(u => options += `<option value="${u.public_id || u.id}">${u.full_name || u.name}</option>`);
            }
            selectPersonId.innerHTML = options;
        });
    }

    // Render Attachments Preview
    function renderAttachmentsPreview() {
        if (currentAttachments.length === 0) {
            attachmentsPreview.innerHTML = '';
            return;
        }
        
        attachmentsPreview.innerHTML = currentAttachments.map((att, idx) => {
            if (att.type === 'audio') {
                return `
                <div class="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-3 py-1.5 rounded-md text-xs font-medium border border-blue-200 dark:border-blue-800">
                    <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
                    Áudio Gravado
                    <button type="button" data-action="remove" data-idx="${idx}" class="ml-1 text-blue-400 hover:text-blue-600 focus:outline-none">&times;</button>
                </div>`;
            } else {
                return `
                <div class="flex items-center gap-2 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 px-3 py-1.5 rounded-md text-xs font-medium border border-gray-200 dark:border-slate-600">
                    <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                    <span class="truncate max-w-30">${att.name}</span>
                    <button type="button" data-action="remove" data-idx="${idx}" class="ml-1 text-gray-400 hover:text-gray-600 focus:outline-none">&times;</button>
                </div>`;
            }
        }).join('');
    }

    attachmentsPreview.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action="remove"]');
        if (btn) {
            const idx = btn.dataset.idx;
            currentAttachments.splice(idx, 1);
            renderAttachmentsPreview();
        }
    });

    // Logica Arquivo
    btnAttachFile.addEventListener('click', () => taskFileInput.click());
    taskFileInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        files.forEach(file => {
            const reader = new FileReader();
            reader.onload = (ev) => {
                currentAttachments.push({ type: 'file', name: file.name, data: ev.target.result });
                renderAttachmentsPreview();
            };
            reader.readAsDataURL(file);
        });
        taskFileInput.value = '';
    });

    // Logica Audio
    btnRecordAudio.addEventListener('click', async () => {
        if (isRecording && mediaRecorder) {
            mediaRecorder.stop();
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];

            mediaRecorder.ondataavailable = e => { if (e.data.size > 0) audioChunks.push(e.data); };
            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                const reader = new FileReader();
                reader.onload = (ev) => {
                    currentAttachments.push({ type: 'audio', name: 'audio.webm', data: ev.target.result });
                    renderAttachmentsPreview();
                };
                reader.readAsDataURL(audioBlob);

                // reset UI
                isRecording = false;
                btnRecordAudio.classList.remove('bg-red-50', 'dark:bg-red-900/30', 'border-red-300', 'text-red-700');
                audioRecordText.textContent = 'Gravar Áudio';
                document.getElementById('iconMic').classList.remove('animate-pulse', 'text-red-500');
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            isRecording = true;
            btnRecordAudio.classList.add('bg-red-50', 'dark:bg-red-900/30', 'border-red-300', 'text-red-700');
            audioRecordText.textContent = 'Parar Gravação...';
            document.getElementById('iconMic').classList.add('animate-pulse', 'text-red-500');
        } catch (err) {
            console.error(err);
            UI.showAlert('alertMessage', 'Não foi possível acessar o microfone.', 'error');
        }
    });

    async function loadTasks() {
        try {
            const res = await api('/tasks', { cache: 'no-store' });
            allTasks = res && Array.isArray(res.data) ? res.data : [];

            const localTasks = JSON.parse(localStorage.getItem('@Keystone:tasks') || '[]');
            if (Array.isArray(localTasks) && localTasks.length > 0 && allTasks.length === 0) {
                const migrated = [];
                for (const task of localTasks) {
                    const created = await api('/tasks', {
                        method: 'POST',
                        body: JSON.stringify(buildTaskPayload(task)),
                    });
                    if (created && created.data) migrated.push(created.data);
                }
                allTasks = migrated;
                localStorage.removeItem('@Keystone:tasks');
            }
        } catch (e) {
            console.error('Falha ao carregar tarefas do banco', e);
            UI.showAlert('alertMessage', 'Não foi possível carregar as tarefas do banco de dados.', 'error');
            allTasks = [];
        }
    }

    function buildTaskPayload(task) {
        return {
            title: task.title,
            dueDate: task.dueDate || null,
            userId: task.userId || null,
            status: task.status || 'pending',
            personType: task.personType || null,
            personId: task.personId || null,
            attachments: Array.isArray(task.attachments) ? task.attachments : [],
            completedAt: task.completedAt || null,
        };
    }

    // 2. Salvar Tarefa
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const title = inputTitle.value.trim();
        const dueDate = inputDueDate.value;
        const userId = selectUser.value;
        const status = selectStatus.value;
        const personType = selectPersonType ? selectPersonType.value : '';
        const personId = selectPersonId && !wrapperPersonId.classList.contains('hidden') ? selectPersonId.value : '';
        const id = inputId.value;

        if (!title) return;

        let currentCompletedAt = id ? allTasks.find(t => t.id === id)?.completedAt : null;
        if (status === 'completed' && !currentCompletedAt) currentCompletedAt = new Date().toISOString();
        else if (status !== 'completed') currentCompletedAt = null;

        const payload = buildTaskPayload({
                title,
                dueDate,
                userId,
                status,
                personType,
                personId,
                attachments: [...currentAttachments],
                completedAt: currentCompletedAt
        });

        try {
            const res = await api(id ? `/tasks/${id}` : '/tasks', {
                method: id ? 'PUT' : 'POST',
                body: JSON.stringify(payload),
            });

            if (res && res.data) {
                if (id) {
                    allTasks = allTasks.map(t => t.id === id ? res.data : t);
                } else {
                    allTasks.push(res.data);
                }
            }

            closeTaskModal();
            renderTasks();
            UI.showAlert('alertMessage', id ? 'Tarefa atualizada!' : 'Tarefa criada com sucesso!', 'success');
        } catch (error) {
            console.error('Falha ao salvar tarefa', error);
            UI.showAlert('alertMessage', error.message || 'Falha ao salvar tarefa no banco de dados.', 'error');
        }
    });

    // 3. Renderizar Lista
    function renderTasks() {
        let filtered = allTasks.filter(t => currentFilter === 'all' || t.status === currentFilter);

        // Sort by Date (Agenda approach) - tasks without date go to the end
        filtered.sort((a, b) => {
            if (!a.dueDate && !b.dueDate) return new Date(b.createdAt) - new Date(a.createdAt);
            if (!a.dueDate) return 1;
            if (!b.dueDate) return -1;
            return new Date(a.dueDate) - new Date(b.dueDate);
        });

        // If list is completely empty AND mode is not calendar
        if (filtered.length === 0 && currentViewMode !== 'calendar') {
            tasksListContainer.innerHTML = `
            <ul id="tasksList" class="grid grid-cols-1 lg:grid-cols-2 gap-3 pb-8">
                <li class="lg:col-span-2 bg-white dark:bg-slate-800 rounded-2xl p-8 text-center border border-gray-200 dark:border-slate-700 shadow-sm transition-all hover:bg-gray-50 dark:hover:bg-slate-750">
                    <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 dark:bg-brand-900/30 mb-4 text-brand-600 dark:text-brand-400">
                        <svg class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                    </div>
                    <p class="text-gray-500 dark:text-gray-400 text-sm">A agenda de tarefas está limpa.</p>
                </li>
            </ul>`;
            return;
        }

        const todayStr = new Date().toISOString().split('T')[0];

        if (currentViewMode === 'day') {
            const dy = agendaDayDate.getFullYear();
            const dm = String(agendaDayDate.getMonth() + 1).padStart(2, '0');
            const dd = String(agendaDayDate.getDate()).padStart(2, '0');
            const dateStr = `${dy}-${dm}-${dd}`;

            const fullDateStr = agendaDayDate.toLocaleString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

            const tasksForDay = filtered.filter(t => (t.dueDate ? t.dueDate.split('T')[0] : null) === dateStr);

            let html = `
                <div class="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm p-4">
                    <div class="flex items-center justify-between mb-4">
                        <button type="button" data-action="prev-day" class="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 transition">
                            <svg class="h-5 w-5 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>
                        </button>
                        <div class="text-center">
                            <h2 class="text-lg font-bold text-gray-900 dark:text-gray-100 capitalize leading-tight">${fullDateStr}</h2>
                            <p class="text-xs text-brand-600 dark:text-brand-400 font-medium">Lista por Horário</p>
                        </div>
                        <button type="button" data-action="next-day" class="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 transition">
                            <svg class="h-5 w-5 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
                        </button>
                    </div>
                    
                    <div class="flex flex-col border border-gray-100 dark:border-slate-700 rounded-xl overflow-y-auto custom-scrollbar max-h-[65vh] mt-4">
            `;

            for (let h = 6; h <= 23; h++) {
                const hourStr = String(h).padStart(2, '0');
                const hourTasks = tasksForDay.filter(t => {
                    if(!t.dueDate || !t.dueDate.includes('T')) return false;
                    const timePart = t.dueDate.split('T')[1];
                    if(!timePart) return false;
                    return timePart.split(':')[0] === hourStr;
                });

                let tasksHtml = '';
                if(hourTasks.length > 0) {
                    tasksHtml = hourTasks.map(t => {
                        const isDone = t.status === 'completed';
                        let bgClass = 'bg-brand-50 border border-brand-200 text-brand-800 dark:bg-brand-900/40 dark:border-brand-800 dark:text-brand-300 hover:shadow-md cursor-pointer';
                        if (isDone) bgClass = 'bg-emerald-50 border border-emerald-200 text-emerald-800 dark:bg-emerald-900/40 dark:border-emerald-800 dark:text-emerald-300 opacity-60';
                        else if (dateStr < todayStr) bgClass = 'bg-red-50 border border-red-200 text-red-800 dark:bg-red-900/40 dark:border-red-800 dark:text-red-300 hover:shadow-md cursor-pointer';
                        
                        const circleClass = isDone ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-current bg-transparent text-transparent hover:opacity-75';
                        const timeText = t.dueDate.split('T')[1] || '';

                        let linkHtml = '';
                        if (t.personType && t.personId) {
                            let personName = resolvePersonName(t.personType, t.personId);
                            linkHtml = `
                            <div class="mt-1.5 text-[10px] font-semibold text-gray-600 dark:text-gray-300 flex items-center gap-1 bg-white/40 dark:bg-slate-900/40 p-1 rounded border border-gray-100/50 dark:border-slate-700/50 w-fit shrink-0 truncate">
                                <svg class="h-3 w-3 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path></svg>
                                ${personName}
                            </div>`;
                        }

                        return `
                        <div class="p-2 rounded-lg transition shadow-sm flex flex-col gap-1 ${bgClass} w-full" title="${t.title}">
                            <div class="flex items-start justify-between gap-2">
                                <div class="flex items-center gap-1 flex-1 min-w-0">
                                    <button type="button" data-action="toggle" data-id="${t.id}" class="shrink-0 h-4 w-4 rounded-full border flex items-center justify-center transition-colors focus:outline-none ${circleClass}">
                                        <svg class="h-3 w-3 pointer-events-none" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path></svg>
                                    </button>
                                    <span data-action="edit" data-id="${t.id}" class="text-xs truncate flex-1 font-medium ${isDone ? 'line-through' : ''}">${t.title}</span>
                                </div>
                                <span class="text-[10px] opacity-70 font-semibold shrink-0">${timeText}</span>
                            </div>
                            ${linkHtml}
                        </div>`;
                    }).join('');
                } else {
                    tasksHtml = `<span class="text-[10px] text-gray-400 dark:text-gray-500 font-medium ml-2">---</span>`;
                }

                const isCurrentHour = new Date().getHours() === h && dateStr === todayStr;

                html += `
                <div class="flex border-b border-gray-100 dark:border-slate-700 min-h-11 last:border-0 hover:bg-gray-50/50 dark:hover:bg-slate-800/50 transition">
                    <div class="w-16 shrink-0 flex items-center justify-end pr-3 text-xs font-semibold ${isCurrentHour ? 'text-brand-600 dark:text-brand-400 bg-brand-50/50 dark:bg-brand-900/20' : 'text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-slate-900/30'} border-r border-gray-100 dark:border-slate-700">${hourStr}:00</div>
                    <div class="flex-1 p-1.5 flex flex-col gap-1.5 justify-center ${isCurrentHour ? 'bg-brand-50/10' : ''}">
                        ${tasksHtml}
                    </div>
                </div>
                `;
            }

            html += `</div></div>`;
            tasksListContainer.innerHTML = html;
        } else if (currentViewMode === 'calendar') {
            const year = calendarDate.getFullYear();
            const month = calendarDate.getMonth();
            const firstDay = new Date(year, month, 1).getDay();
            const lastDate = new Date(year, month + 1, 0).getDate();
            const monthName = calendarDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });

            let calendarGrid = `
                <div class="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm p-4">
                    <div class="flex items-center justify-between mb-4">
                        <button type="button" data-action="prev-month" class="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 transition">
                            <svg class="h-5 w-5 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>
                        </button>
                        <h2 class="text-lg font-bold text-gray-900 dark:text-gray-100 capitalize">${monthName}</h2>
                        <button type="button" data-action="next-month" class="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 transition">
                            <svg class="h-5 w-5 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
                        </button>
                    </div>
                    
                    <div class="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">
                        <div>Dom</div><div>Seg</div><div>Ter</div><div>Qua</div><div>Qui</div><div>Sex</div><div>Sáb</div>
                    </div>
                    <div class="grid grid-cols-7 gap-1 auto-rows-fr">
            `;

            for (let i = 0; i < firstDay; i++) {
                calendarGrid += `<div class="p-2 bg-gray-50/50 dark:bg-slate-800/50 rounded-lg border border-transparent min-h-20"></div>`;
            }

            for (let d = 1; d <= lastDate; d++) {
                const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
                
                const tasksForDay = filtered.filter(t => (t.dueDate ? t.dueDate.split('T')[0] : null) === dateStr);
                const isToday = dateStr === todayStr;

                const dayBadge = isToday 
                    ? `<span class="inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-white font-bold cursor-pointer hover:opacity-80 transition" data-action="go-to-day" data-date="${dateStr}" title="Ver Dia">${d}</span>`
                    : `<span class="inline-block px-1 text-gray-700 dark:text-gray-300 font-medium cursor-pointer hover:text-brand-600 transition" data-action="go-to-day" data-date="${dateStr}" title="Ver Dia">${d}</span>`;

                let tasksListHtml = tasksForDay.map(t => {
                    const isDone = t.status === 'completed';
                    let bgClass = 'bg-brand-100 text-brand-700 dark:bg-brand-900/50 dark:text-brand-300';
                    const datePart = t.dueDate ? t.dueDate.split('T')[0] : '';
                    if (isDone) bgClass = 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300 opacity-70';
                    else if (datePart && datePart < todayStr) bgClass = 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300';
                    
                    const circleClass = isDone 
                        ? 'bg-emerald-500 border-emerald-500 text-white' 
                        : 'border-current bg-transparent text-transparent hover:opacity-75';

                    let linkIcon = '';
                    if (t.personType && t.personId) {
                        linkIcon = '<svg class="h-2.5 w-2.5 shrink-0 ml-0.5 text-current opacity-75" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path></svg>';
                    }

                    return `
                    <div class="mt-1 flex items-center gap-1 px-1.5 py-1 rounded transition ${bgClass}" title="${t.title}">
                        <button type="button" data-action="toggle" data-id="${t.id}" class="shrink-0 h-3 w-3 rounded-full border flex items-center justify-center transition-colors focus:outline-none ${circleClass}">
                            <svg class="h-2 w-2 pointer-events-none" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path></svg>
                        </button>
                        <span data-action="edit" data-id="${t.id}" class="truncate cursor-pointer hover:underline flex-1 text-[10px] leading-tight font-medium ${isDone ? 'line-through' : ''}">${t.title}</span>
                        ${linkIcon}
                    </div>`;
                }).join('');

                calendarGrid += `
                <div class="p-1 sm:p-2 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-lg min-h-20 sm:min-h-25 flex flex-col ${isToday ? 'ring-2 ring-brand-500 ring-inset' : ''}">
                    <div class="text-right mb-1 text-xs">${dayBadge}</div>
                    <div class="flex-1 flex flex-col gap-0.5 overflow-y-auto custom-scrollbar">
                        ${tasksListHtml}
                    </div>
                </div>`;
            }

            calendarGrid += `</div></div>`;
            
            // Add unscheduled tasks below calendar
            const unassigned = filtered.filter(t => !t.dueDate);
            if(unassigned.length > 0) {
                calendarGrid += `
                <div class="mt-6">
                    <h3 class="flex items-center gap-2 mb-3 px-1 text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Sem Data Definida
                    </h3>
                    <ul class="space-y-3">
                        ${unassigned.map(t => createTaskCardHTML(t, todayStr)).join('')}
                    </ul>
                </div>`;
            }

            tasksListContainer.innerHTML = calendarGrid;
        } else {
            // Normal List
            tasksListContainer.innerHTML = `
            <ul id="tasksList" class="grid grid-cols-1 lg:grid-cols-2 gap-3 pb-8">
                ${filtered.map(t => createTaskCardHTML(t, todayStr)).join('')}
            </ul>`;
        }
    }

    function formatDuration(ms) {
        if (ms < 0) return '0m';
        const mins = Math.floor(ms / 60000);
        const hours = Math.floor(mins / 60);
        const m = mins % 60;
        const days = Math.floor(hours / 24);
        const h = hours % 24;

        let res = [];
        if (days > 0) res.push(`${days}d`);
        if (h > 0) res.push(`${h}h`);
        if (m > 0) res.push(`${m}m`);
        if (res.length === 0) return 'Menos de 1m';
        return res.join(' ');
    }

    function createTaskCardHTML(t, todayStr) {
            const isDone = t.status === 'completed';
            const user = users.find(u => (u.public_id || u.id) === t.userId);
            const userName = user ? (user.full_name || user.name) : 'Todos';
            
            let statusBadge = '';
            if (t.status === 'pending') statusBadge = '<span class="inline-flex items-center rounded-full bg-gray-100 dark:bg-slate-700 px-2 py-0.5 text-xs font-medium text-gray-800 dark:text-gray-200 shadow-sm border border-gray-200 dark:border-slate-600">A Fazer</span>';
            if (t.status === 'progress') statusBadge = '<span class="inline-flex items-center rounded-full bg-blue-100 dark:bg-blue-900/50 px-2 py-0.5 text-xs font-medium text-blue-800 dark:text-blue-300 shadow-sm border border-blue-200 dark:border-blue-800">Em Andamento</span>';
            if (t.status === 'completed') statusBadge = '<span class="inline-flex items-center rounded-full bg-emerald-100 dark:bg-emerald-900/50 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:text-emerald-300 shadow-sm border border-emerald-200 dark:border-emerald-800">Concluída</span>';

            let completedBadge = '';
            if (isDone && t.completedAt && t.createdAt) {
                const diffMs = new Date(t.completedAt) - new Date(t.createdAt);
                const durationStr = formatDuration(diffMs);
                
                const compDate = new Date(t.completedAt);
                const cy = compDate.getFullYear();
                const cm = String(compDate.getMonth() + 1).padStart(2, '0');
                const cd = String(compDate.getDate()).padStart(2, '0');
                const ch = String(compDate.getHours()).padStart(2, '0');
                const cmin = String(compDate.getMinutes()).padStart(2, '0');

                completedBadge = `
                <div class="flex items-center text-[11px] text-emerald-600 dark:text-emerald-400 gap-1 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full border border-emerald-100 dark:border-emerald-800/50 sm:ml-2" title="Tempo de execução">
                    <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <span>Finalizada em ${cd}/${cm}/${cy} às ${ch}:${cmin} - Levou ${durationStr}</span>
                </div>`;
            }

            let dueBadge = '';
            if (t.dueDate) {
                const parts = t.dueDate.split('T');
                const datePart = parts[0];
                const timePart = parts.length > 1 ? parts[1] : '';
                const [y, m, d] = datePart.split('-');
                let colorClass = 'text-gray-500 dark:text-gray-400';
                
                if (!isDone) {
                    if (datePart < todayStr) colorClass = 'text-red-500 font-semibold'; // Atrasado
                    else if (datePart === todayStr) colorClass = 'text-orange-500 font-semibold'; // Hoje
                    else colorClass = 'text-brand-600 dark:text-brand-400'; // Futuro
                }
                
                const timeDisplay = timePart ? ` às ${timePart}` : '';
                
                dueBadge = `
                <div class="flex items-center text-xs ${colorClass} gap-1" title="Vencimento Agendado">
                    <svg class="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    <span>${d}/${m}/${y}${timeDisplay}</span>
                </div>`;
            }

            let attachmentsHtml = '';
            if (t.attachments && t.attachments.length > 0) {
                attachmentsHtml = '<div class="mt-3 flex flex-wrap gap-2 w-full">';
                t.attachments.forEach(att => {
                    if (att.type === 'audio') {
                        attachmentsHtml += `
                        <div class="w-full sm:w-auto mt-1 rounded-xl bg-gray-50 dark:bg-slate-900/50 border border-gray-200 dark:border-slate-700 p-2 shadow-sm">
                            <audio controls src="${att.data}" class="h-8 w-full sm:w-64 outline-none"></audio>
                        </div>`;
                    } else {
                        // File / Image
                        const isImage = att.data.startsWith('data:image/');
                        if (isImage) {
                            attachmentsHtml += `
                            <a href="${att.data}" target="_blank" class="block shrink-0 mt-1 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                                <div class="h-20 w-24 bg-gray-100 dark:bg-slate-900 bg-cover bg-center" style="background-image: url('${att.data}')"></div>
                            </a>`;
                        } else {
                            attachmentsHtml += `
                            <a href="${att.data}" download="${att.name}" class="mt-1 flex shrink-0 items-center justify-center gap-2 rounded-xl bg-gray-50 dark:bg-slate-900/50 border border-gray-200 dark:border-slate-700 px-3 py-2 text-xs font-medium text-brand-600 dark:text-brand-400 shadow-sm hover:shadow-md transition-shadow">
                                <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                                <span class="truncate max-w-25">${att.name}</span>
                            </a>`;
                        }
                    }
                });
                attachmentsHtml += '</div>';
            }

            let linkHtml = '';
            if (t.personType && t.personId) {
                let personName = resolvePersonName(t.personType, t.personId);
                linkHtml = `
                <div class="mt-3 flex items-center text-sm font-semibold text-gray-700 dark:text-gray-300 gap-1.5 bg-gray-50 dark:bg-slate-900/40 px-2.5 py-1.5 rounded-lg border border-gray-100 dark:border-slate-700 w-fit shrink-0">
                    <svg class="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path></svg>
                    Pessoa Vinculada: <span class="text-brand-700 dark:text-brand-400 uppercase tracking-tight ml-1 font-bold">${personName}</span>
                </div>`;
            }

            return `
                <li class="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-gray-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all group flex flex-col sm:flex-row gap-4 items-start">
                    
                    <div class="flex items-center gap-4 w-full">
                        <!-- Checkbox Circular (Clickable) -->
                        <button type="button" data-action="toggle" data-id="${t.id}" class="mt-1 sm:mt-0 shrink-0 h-6 w-6 rounded-full border-2 flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 ${isDone ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-gray-300 dark:border-slate-500 bg-transparent text-transparent hover:border-emerald-400 dark:hover:border-emerald-500'}">
                            <svg class="h-4 w-4 pointer-events-none" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path></svg>
                        </button>

                        <!-- Content -->
                        <div class="flex-1 min-w-0">
                            <p class="text-base font-medium transition-all ${isDone ? 'text-gray-400 dark:text-gray-500 line-through' : 'text-gray-900 dark:text-gray-100'} cursor-pointer" data-action="edit" data-id="${t.id}">${t.title}</p>
                            <div class="mt-2 flex flex-wrap items-center gap-2 sm:gap-3">
                                ${statusBadge}
                                ${dueBadge}
                                <div class="flex items-center text-xs text-gray-500 dark:text-gray-400 gap-1" title="Responsável">
                                    <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                    <span>${userName}</span>
                                </div>
                                ${completedBadge}
                            </div>
                            
                            ${attachmentsHtml}
                            ${linkHtml}
                        </div>

                        <!-- Actions -->
                        <div class="flex flex-col sm:flex-row items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button type="button" data-action="edit" data-id="${t.id}" class="text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors" title="Editar">
                            <svg class="h-5 w-5 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                        <button type="button" data-action="delete" data-id="${t.id}" class="text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors" title="Excluir">
                            <svg class="h-5 w-5 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                    </div>
                    </div>
            `;
    }

    tasksListContainer.addEventListener('click', async (e) => {
        const target = e.target.closest('[data-action]');
        if (!target) return;

        const action = target.dataset.action;
        const id = target.dataset.id;

        if (action === 'toggle') {
            const task = allTasks.find(t => t.id === id);
            if (task) {
                const nextTask = { ...task };
                if (task.status === 'completed') {
                    nextTask.status = 'pending';
                    nextTask.completedAt = null;
                } else {
                    nextTask.status = 'completed';
                    nextTask.completedAt = new Date().toISOString();
                }

                try {
                    const res = await api(`/tasks/${id}`, {
                        method: 'PUT',
                        body: JSON.stringify(buildTaskPayload(nextTask)),
                    });
                    if (res && res.data) allTasks = allTasks.map(t => t.id === id ? res.data : t);
                    renderTasks();
                } catch (error) {
                    console.error('Falha ao atualizar tarefa', error);
                    UI.showAlert('alertMessage', error.message || 'Falha ao atualizar tarefa no banco de dados.', 'error');
                }
            }
        }
        else if (action === 'delete') {
            if (confirm('Deseja realmente excluir esta tarefa?')) {
                try {
                    await api(`/tasks/${id}`, { method: 'DELETE' });
                    allTasks = allTasks.filter(t => t.id !== id);
                    renderTasks();
                    resetForm();
                } catch (error) {
                    console.error('Falha ao excluir tarefa', error);
                    UI.showAlert('alertMessage', error.message || 'Falha ao excluir tarefa no banco de dados.', 'error');
                }
            }
        }
        else if (action === 'edit') {
            const task = allTasks.find(t => t.id === id);
            if (task) {
                inputId.value = task.id;
                inputTitle.value = task.title;
                inputDueDate.value = task.dueDate || '';
                selectUser.value = task.userId || '';
                selectStatus.value = task.status || 'pending';
                
                if (selectPersonType) {
                    selectPersonType.value = task.personType || '';
                    if (task.personType) {
                        // trigger change to load options
                        selectPersonType.dispatchEvent(new Event('change'));
                        setTimeout(() => { selectPersonId.value = task.personId || ''; }, 50);
                    } else {
                        selectPersonType.dispatchEvent(new Event('change'));
                    }
                }
                
                currentAttachments = task.attachments ? [...task.attachments] : [];
                renderAttachmentsPreview();
                
                btnSave.textContent = 'Salvar Edição';

                openTaskModal('Editar Tarefa');
            }
        }
        else if (action === 'prev-month') {
            calendarDate.setMonth(calendarDate.getMonth() - 1);
            renderTasks();
        }
        else if (action === 'next-month') {
            calendarDate.setMonth(calendarDate.getMonth() + 1);
            renderTasks();
        }
        else if (action === 'prev-day') {
            agendaDayDate.setDate(agendaDayDate.getDate() - 1);
            renderTasks();
        }
        else if (action === 'next-day') {
            agendaDayDate.setDate(agendaDayDate.getDate() + 1);
            renderTasks();
        }
        else if (action === 'go-to-day') {
            const dateStr = target.dataset.date;
            if (dateStr) {
                const [y, m, d] = dateStr.split('-');
                agendaDayDate = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
                
                const dayBtn = document.querySelector('.view-mode-btn[data-view="day"]');
                if (dayBtn) {
                    dayBtn.click(); // Autotriggers the view mode switch and renderTasks
                } else {
                    currentViewMode = 'day';
                    renderTasks();
                }
            }
        }
    });

    function resetForm() {
        inputId.value = '';
        inputTitle.value = '';
        inputDueDate.value = '';
        selectUser.value = '';
        selectStatus.value = 'pending';
        currentAttachments = [];
        renderAttachmentsPreview();
        btnSave.textContent = 'Adicionar Tarefa';
        if (btnCancel) btnCancel.classList.add('hidden');
    }

    if (btnCancel) btnCancel.addEventListener('click', resetForm);

    // Modal helpers
    function openTaskModal(titleText) {
        if (taskModalTitle) taskModalTitle.textContent = titleText || 'Nova Tarefa';
        taskModal.classList.remove('hidden');
        document.body.classList.add('overflow-hidden');
        setTimeout(() => { if (inputTitle) inputTitle.focus(); }, 50);
    }

    function closeTaskModal() {
        taskModal.classList.add('hidden');
        document.body.classList.remove('overflow-hidden');
        resetForm();
    }

    if (btnOpenTaskModal) btnOpenTaskModal.addEventListener('click', () => openTaskModal('Nova Tarefa'));
    if (btnCloseTaskModal) btnCloseTaskModal.addEventListener('click', closeTaskModal);
    if (btnCancelModal) btnCancelModal.addEventListener('click', closeTaskModal);
    if (taskModalBackdrop) taskModalBackdrop.addEventListener('click', closeTaskModal);

    // Fechar com Esc
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && taskModal && !taskModal.classList.contains('hidden')) {
            closeTaskModal();
        }
    });

    // 5. Filtros e Visão
    filterBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            currentFilter = e.target.dataset.filter;
            filterBtns.forEach(b => {
                b.classList.remove('text-brand-600', 'dark:text-brand-400', 'bg-brand-50', 'dark:bg-brand-900/30');
                b.classList.add('text-gray-500');
            });
            e.target.classList.remove('text-gray-500');
            e.target.classList.add('text-brand-600', 'dark:text-brand-400', 'bg-brand-50', 'dark:bg-brand-900/30');
            renderTasks();
        });
    });

    viewModeBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const btnTgt = e.target.closest('.view-mode-btn');
            if(!btnTgt) return;
            currentViewMode = btnTgt.dataset.view;
            
            viewModeBtns.forEach(b => {
                b.classList.remove('active', 'text-brand-700', 'dark:text-brand-300', 'bg-white', 'dark:bg-slate-700');
                b.classList.add('text-gray-500', 'dark:text-gray-400');
            });
            
            btnTgt.classList.remove('text-gray-500', 'dark:text-gray-400');
            btnTgt.classList.add('active', 'text-brand-700', 'dark:text-brand-300', 'bg-white', 'dark:bg-slate-700');
            
            renderTasks();
        });
    });

    // Boot
    await loadUsers();
    await loadLinkableEntities();
    await loadTasks();
    renderTasks();
});
})();
