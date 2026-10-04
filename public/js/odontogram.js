// @ts-nocheck
(() => {
    const getById = (id) => document.getElementById(id);
    const qs = (sel) => document.querySelector(sel);
    const qsa = (sel) => document.querySelectorAll(sel);
    // State
    let customersList = [];
    let servicesList = [];
    let professionalsList = [];
    let currentPatient = null;
    let currentChart = null;
    let activeFilter = 'all';
    let selectedPlannedIds = new Set();
    let selectedFacesForNewProc = new Set();
    function formatCurrency(val) {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
    }
    function formatDate(dateStr) {
        if (!dateStr)
            return '-';
        const d = new Date(dateStr);
        return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }
    function showAlert(msg, type = 'success', timeoutMs = 4000) {
        const el = getById('alertMessage');
        if (!el)
            return;
        el.textContent = msg;
        el.className = `mb-3 p-3.5 rounded-xl text-sm shadow-sm ${type === 'success'
            ? 'bg-green-50 text-green-800 dark:bg-green-950/40 dark:text-green-300 border border-green-200 dark:border-green-800'
            : 'bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300 border border-red-200 dark:border-red-800'}`;
        el.classList.remove('hidden');
        setTimeout(() => el.classList.add('hidden'), timeoutMs);
    }
    // ── Carregamento Inicial de Entidades ─────────────────────────────────────────
    async function loadCustomers() {
        try {
            const res = await api('/entities/customers');
            customersList = res.data || [];
            const select = getById('selectCustomer');
            if (select) {
                select.innerHTML = '<option value="">Selecione o paciente para carregar o odontograma...</option>' +
                    customersList.map(c => `<option value="${c.public_id}">${c.name}${c.cnpj_cpf ? ' (' + c.cnpj_cpf + ')' : ''}</option>`).join('');
            }
        }
        catch (e) {
            console.error('Erro ao carregar pacientes', e);
        }
    }
    async function loadServices() {
        try {
            const res = await api('/estoque/services');
            servicesList = res.data || [];
            const select = getById('procService');
            if (select) {
                select.innerHTML = '<option value="">Selecione o serviço...</option>' +
                    servicesList.map(s => `<option value="${s.public_id}" data-price="${s.price || 0}">${s.name} - ${formatCurrency(Number(s.price || 0))}</option>`).join('');
            }
        }
        catch (e) {
            console.error('Erro ao carregar serviços', e);
        }
    }
    async function loadProfessionals() {
        try {
            const res = await api('/users');
            professionalsList = res.data || [];
            const selectProc = getById('procProfessional');
            const selectPerf = getById('performProfessional');
            const opts = '<option value="">Selecione o profissional...</option>' +
                professionalsList.map(u => `<option value="${u.public_id}">${u.full_name || u.name || 'Dentista'}</option>`).join('');
            if (selectProc)
                selectProc.innerHTML = opts;
            if (selectPerf)
                selectPerf.innerHTML = opts;
        }
        catch (e) {
            console.error('Erro ao carregar profissionais', e);
        }
    }
    // ── Carregar Odontograma do Paciente ─────────────────────────────────────────
    async function loadPatientChart(customerPublicId) {
        if (!customerPublicId) {
            currentPatient = null;
            currentChart = null;
            getById('patientSummaryBar')?.classList.add('hidden');
            getById('odontogramEmptyState')?.classList.remove('hidden');
            getById('odontogramSvgContainer')?.classList.add('hidden');
            renderProcedures();
            return;
        }
        try {
            currentPatient = customersList.find(c => c.public_id === customerPublicId) || null;
            if (currentPatient) {
                getById('patientDoc').textContent = currentPatient.cnpj_cpf ? `CPF/CNPJ: ${currentPatient.cnpj_cpf}` : 'Sem documento';
                getById('patientPhone').textContent = currentPatient.phone ? `Tel: ${currentPatient.phone}` : 'Sem telefone';
                getById('patientEmail').textContent = currentPatient.email ? `Email: ${currentPatient.email}` : 'Sem email';
                getById('patientSummaryBar')?.classList.remove('hidden');
            }
            const res = await api(`/dental/charts?customer_public_id=${customerPublicId}`);
            currentChart = res.data;
            selectedPlannedIds.clear();
            updateDentitionToggleUI(currentChart.dentition || 'permanent');
            renderOdontogramSvg();
            renderProcedures();
        }
        catch (e) {
            console.error('Erro ao carregar odontograma', e);
            showAlert('Erro ao carregar odontograma do paciente.', 'error');
        }
    }
    function updateDentitionToggleUI(dentition) {
        qsa('.dentition-toggle-btn').forEach(btn => {
            const isMatch = btn.getAttribute('data-dentition') === dentition;
            if (isMatch) {
                btn.className = 'dentition-toggle-btn px-2.5 py-1 rounded-md bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-300 shadow-sm font-semibold transition-all';
            }
            else {
                btn.className = 'dentition-toggle-btn px-2.5 py-1 rounded-md text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-all';
            }
        });
    }
    // ── FDI Tooth Geometry & SVG Generator ───────────────────────────────────────
    // Dentes FDI Permanentes:
    // Superior Q1 (18..11), Superior Q2 (21..28)
    // Inferior Q4 (48..41), Inferior Q3 (31..38)
    // Dentes FDI Decíduos:
    // Superior Q5 (55..51), Superior Q6 (61..65)
    // Inferior Q8 (85..81), Inferior Q7 (71..75)
    function renderToothSvgElement(toothCode, isUpper, toothData, procsForTooth = []) {
        const isRightQuadrant = [18, 17, 16, 15, 14, 13, 12, 11, 48, 47, 46, 45, 44, 43, 42, 41, 55, 54, 53, 52, 51, 85, 84, 83, 82, 81].includes(toothCode);
        // Determina cores das faces com base nos procedimentos existentes ou selecionados
        const getFaceFillClass = (faceLetter) => {
            // M, D dependem de qual lado é mesial e qual é distal em relação à linha média
            // No quadrante direito (1, 4, 5, 8), a mesial fica voltada para a linha média (lado direito do dente no SVG).
            // No quadrante esquerdo (2, 3, 6, 7), a mesial fica para a linha média (lado esquerdo do dente no SVG).
            let actualLetter = faceLetter;
            if (faceLetter === 'V')
                actualLetter = 'V';
            else if (faceLetter === 'L')
                actualLetter = isUpper ? 'P' : 'L';
            else if (faceLetter === 'O')
                actualLetter = [11, 12, 13, 21, 22, 23, 31, 32, 33, 41, 42, 43, 51, 52, 53, 61, 62, 63, 71, 72, 73, 81, 82, 83].includes(toothCode) ? 'I' : 'O';
            const matchProc = procsForTooth.find(p => {
                if (!p.faces)
                    return false;
                const facesArr = p.faces.split(',').map(f => f.trim());
                return facesArr.includes(actualLetter) || facesArr.includes(faceLetter);
            });
            if (matchProc) {
                if (matchProc.status === 'done')
                    return 'face-done fill-emerald-500 stroke-emerald-600';
                if (matchProc.status === 'approved')
                    return 'face-approved fill-amber-500 stroke-amber-600';
                if (matchProc.status === 'quoted')
                    return 'face-quoted fill-indigo-400 stroke-indigo-500';
                if (matchProc.status === 'planned')
                    return 'face-planned fill-sky-400 stroke-sky-500';
                if (matchProc.status === 'existing')
                    return 'face-existing fill-slate-400 stroke-slate-500';
            }
            return 'fill-white dark:fill-slate-800 stroke-gray-300 dark:stroke-slate-600';
        };
        const condition = toothData?.condition || 'present';
        let conditionBadge = '';
        let toothOpacity = '1';
        if (condition === 'extracted') {
            conditionBadge = `
                <line x1="2" y1="2" x2="38" y2="38" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round" />
                <line x1="38" y1="2" x2="2" y2="38" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round" />
            `;
            toothOpacity = '0.7';
        }
        else if (condition === 'implant') {
            conditionBadge = `
                <circle cx="20" cy="20" r="7" fill="#3b82f6" fill-opacity="0.8" />
                <path d="M16 20h8M20 16v8" stroke="#ffffff" stroke-width="2" />
            `;
        }
        else if (condition === 'absent') {
            toothOpacity = '0.35';
        }
        else if (condition === 'unerupted') {
            conditionBadge = `
                <rect x="2" y="2" width="36" height="36" fill="none" stroke="#f59e0b" stroke-width="1.5" stroke-dasharray="3,2" rx="4" />
            `;
        }
        else if (condition === 'retained') {
            conditionBadge = `
                <rect x="2" y="2" width="36" height="36" fill="#a855f7" fill-opacity="0.2" stroke="#a855f7" stroke-width="1.5" rx="4" />
            `;
        }
        // Mapeamento anatômico das faces:
        // Vestibular: Face superior (em dentes superiores) ou face inferior (em dentes inferiores)
        // Lingual/Palatina: Face inferior (em dentes superiores) ou face superior (em dentes inferiores)
        const topFaceLetter = isUpper ? 'V' : (isUpper ? 'P' : 'L');
        const bottomFaceLetter = isUpper ? 'P' : 'V';
        const leftFaceLetter = isRightQuadrant ? 'D' : 'M';
        const rightFaceLetter = isRightQuadrant ? 'M' : 'D';
        const centerFaceLetter = [11, 12, 13, 21, 22, 23, 31, 32, 33, 41, 42, 43, 51, 52, 53, 61, 62, 63, 71, 72, 73, 81, 82, 83].includes(toothCode) ? 'I' : 'O';
        return `
            <div class="flex flex-col items-center tooth-item" data-tooth="${toothCode}">
                ${isUpper ? `<span class="text-[11px] font-bold font-mono text-gray-700 dark:text-gray-300 mb-1 select-none">${toothCode}</span>` : ''}
                <div class="tooth-group relative" style="opacity: ${toothOpacity};">
                    <svg viewBox="0 0 40 40" width="36" height="36" class="select-none overflow-visible">
                        <!-- Face Top -->
                        <polygon points="2,2 38,2 28,12 12,12" class="tooth-face ${getFaceFillClass(topFaceLetter)}" data-tooth="${toothCode}" data-face="${topFaceLetter}" stroke-width="1"></polygon>
                        <!-- Face Bottom -->
                        <polygon points="12,28 28,28 38,38 2,38" class="tooth-face ${getFaceFillClass(bottomFaceLetter)}" data-tooth="${toothCode}" data-face="${bottomFaceLetter}" stroke-width="1"></polygon>
                        <!-- Face Left -->
                        <polygon points="2,2 12,12 12,28 2,38" class="tooth-face ${getFaceFillClass(leftFaceLetter)}" data-tooth="${toothCode}" data-face="${leftFaceLetter}" stroke-width="1"></polygon>
                        <!-- Face Right -->
                        <polygon points="38,2 38,38 28,28 28,12" class="tooth-face ${getFaceFillClass(rightFaceLetter)}" data-tooth="${toothCode}" data-face="${rightFaceLetter}" stroke-width="1"></polygon>
                        <!-- Face Center (Oclusal / Incisal) -->
                        <rect x="12" y="12" width="16" height="16" class="tooth-face ${getFaceFillClass(centerFaceLetter)}" data-tooth="${toothCode}" data-face="${centerFaceLetter}" stroke-width="1"></rect>
                        ${conditionBadge}
                    </svg>
                </div>
                ${!isUpper ? `<span class="text-[11px] font-bold font-mono text-gray-700 dark:text-gray-300 mt-1 select-none">${toothCode}</span>` : ''}
            </div>
        `;
    }
    function renderOdontogramSvg() {
        const container = getById('odontogramSvgContainer');
        const emptyState = getById('odontogramEmptyState');
        if (!container)
            return;
        if (!currentChart) {
            container.classList.add('hidden');
            emptyState?.classList.remove('hidden');
            return;
        }
        emptyState?.classList.add('hidden');
        container.classList.remove('hidden');
        const teethMap = new Map((currentChart.teeth || []).map(t => [t.tooth_code, t]));
        const procs = currentChart.procedures || [];
        const dentition = currentChart.dentition || 'permanent';
        const renderTeethRow = (codes, isUpper) => {
            return codes.map(code => {
                const toothData = teethMap.get(code);
                const procsForTooth = procs.filter(p => p.tooth_code === code && p.status !== 'cancelled');
                return renderToothSvgElement(code, isUpper, toothData, procsForTooth);
            }).join('');
        };
        // Quadrantes
        const q1 = [18, 17, 16, 15, 14, 13, 12, 11];
        const q2 = [21, 22, 23, 24, 25, 26, 27, 28];
        const q4 = [48, 47, 46, 45, 44, 43, 42, 41];
        const q3 = [31, 32, 33, 34, 35, 36, 37, 38];
        const q5 = [55, 54, 53, 52, 51];
        const q6 = [61, 62, 63, 64, 65];
        const q8 = [85, 84, 83, 82, 81];
        const q7 = [71, 72, 73, 74, 75];
        let html = '<div class="flex flex-col items-center gap-4 w-full select-none py-2">';
        // 1. Arcada Superior Permanente (se permanente ou mista)
        if (dentition === 'permanent' || dentition === 'mixed') {
            html += `
                <div class="flex flex-col items-center w-full">
                    <span class="text-[10px] uppercase font-bold text-gray-400 dark:text-gray-500 mb-1">Arcada Superior (Maxila)</span>
                    <div class="flex items-center justify-center gap-2 sm:gap-4 w-full overflow-x-auto pb-1">
                        <div class="flex items-center gap-1 sm:gap-1.5">${renderTeethRow(q1, true)}</div>
                        <div class="w-px h-12 bg-gray-300 dark:bg-slate-700 mx-1"></div>
                        <div class="flex items-center gap-1 sm:gap-1.5">${renderTeethRow(q2, true)}</div>
                    </div>
                </div>
            `;
        }
        // 2. Arcada Superior Decídua (se decídua ou mista)
        if (dentition === 'deciduous' || dentition === 'mixed') {
            html += `
                <div class="flex flex-col items-center w-full my-1">
                    <span class="text-[9px] uppercase font-bold text-amber-500/80 mb-0.5">Superior Decídua</span>
                    <div class="flex items-center justify-center gap-2 sm:gap-3 w-full overflow-x-auto pb-1">
                        <div class="flex items-center gap-1">${renderTeethRow(q5, true)}</div>
                        <div class="w-px h-10 bg-amber-300 dark:bg-amber-900/50 mx-1"></div>
                        <div class="flex items-center gap-1">${renderTeethRow(q6, true)}</div>
                    </div>
                </div>
            `;
        }
        // 3. Linha Divisória de Arcadas
        html += '<div class="w-full max-w-2xl border-t border-dashed border-gray-300 dark:border-slate-700 my-0.5"></div>';
        // 4. Arcada Inferior Decídua (se decídua ou mista)
        if (dentition === 'deciduous' || dentition === 'mixed') {
            html += `
                <div class="flex flex-col items-center w-full my-1">
                    <span class="text-[9px] uppercase font-bold text-amber-500/80 mb-0.5">Inferior Decídua</span>
                    <div class="flex items-center justify-center gap-2 sm:gap-3 w-full overflow-x-auto pb-1">
                        <div class="flex items-center gap-1">${renderTeethRow(q8, false)}</div>
                        <div class="w-px h-10 bg-amber-300 dark:bg-amber-900/50 mx-1"></div>
                        <div class="flex items-center gap-1">${renderTeethRow(q7, false)}</div>
                    </div>
                </div>
            `;
        }
        // 5. Arcada Inferior Permanente (se permanente ou mista)
        if (dentition === 'permanent' || dentition === 'mixed') {
            html += `
                <div class="flex flex-col items-center w-full">
                    <div class="flex items-center justify-center gap-2 sm:gap-4 w-full overflow-x-auto pb-1">
                        <div class="flex items-center gap-1 sm:gap-1.5">${renderTeethRow(q4, false)}</div>
                        <div class="w-px h-12 bg-gray-300 dark:bg-slate-700 mx-1"></div>
                        <div class="flex items-center gap-1 sm:gap-1.5">${renderTeethRow(q3, false)}</div>
                    </div>
                    <span class="text-[10px] uppercase font-bold text-gray-400 dark:text-gray-500 mt-1">Arcada Inferior (Mandíbula)</span>
                </div>
            `;
        }
        html += '</div>';
        container.innerHTML = html;
        // Attach Click Listeners to Tooth Numbers and Faces
        container.querySelectorAll('.tooth-item').forEach(item => {
            const toothCode = parseInt(item.getAttribute('data-tooth'), 10);
            item.addEventListener('click', (e) => {
                const faceEl = e.target.closest('.tooth-face');
                if (faceEl) {
                    const face = faceEl.getAttribute('data-face');
                    openNewProcedureModalForTooth(toothCode, face);
                }
                else {
                    openToothDetailModal(toothCode);
                }
            });
        });
    }
    // ── Modal de Detalhes do Dente / Condição ────────────────────────────────────
    function openToothDetailModal(toothCode) {
        if (!currentChart)
            return;
        const teethMap = new Map((currentChart.teeth || []).map(t => [t.tooth_code, t]));
        const toothData = teethMap.get(toothCode);
        getById('modalToothCode').value = toothCode;
        getById('toothModalTitle').textContent = `Dente ${toothCode}`;
        getById('toothNotesInput').value = toothData?.notes || '';
        const currentCond = toothData?.condition || 'present';
        qsa('.tooth-cond-btn').forEach(btn => {
            const cond = btn.getAttribute('data-condition');
            if (cond === currentCond) {
                btn.className = 'tooth-cond-btn px-2.5 py-2 rounded-xl border border-brand-500 bg-brand-50 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 font-bold text-xs shadow-sm text-center';
            }
            else {
                btn.className = 'tooth-cond-btn px-2.5 py-2 rounded-xl border border-gray-200 dark:border-slate-700 text-xs font-medium hover:bg-gray-50 dark:hover:bg-slate-700 transition-all text-center';
            }
        });
        getById('toothDetailModal')?.classList.remove('hidden');
    }
    function closeToothDetailModal() {
        getById('toothDetailModal')?.classList.add('hidden');
    }
    // ── Procedimentos: Modal e Criação ───────────────────────────────────────────
    function openNewProcedureModalForTooth(toothCode, initialFace) {
        if (!currentChart) {
            showAlert('Selecione um paciente primeiro.', 'error');
            return;
        }
        getById('procEditPublicId').value = '';
        getById('procedureModalTitle').textContent = 'Novo Procedimento Odontológico';
        getById('procRegion').value = toothCode ? 'tooth' : 'tooth';
        getById('procToothCode').value = toothCode || '';
        getById('procService').value = '';
        getById('procUnitPrice').value = '';
        getById('procProfessional').value = '';
        getById('procStatus').value = 'planned';
        getById('procNotes').value = '';
        selectedFacesForNewProc.clear();
        if (initialFace) {
            selectedFacesForNewProc.add(initialFace);
        }
        updateFacePillsUI();
        getById('procedureModal')?.classList.remove('hidden');
    }
    function updateFacePillsUI() {
        qsa('.face-pill').forEach(btn => {
            const face = btn.getAttribute('data-face');
            if (selectedFacesForNewProc.has(face)) {
                btn.className = 'face-pill px-3 py-1 rounded-lg border border-brand-500 bg-brand-600 text-white text-xs font-bold shadow-sm';
            }
            else {
                btn.className = 'face-pill px-3 py-1 rounded-lg border border-gray-200 dark:border-slate-700 text-xs font-bold hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300';
            }
        });
    }
    function closeProcedureModal() {
        getById('procedureModal')?.classList.add('hidden');
    }
    // ── Renderização da Lista de Procedimentos ───────────────────────────────────
    function renderProcedures() {
        const container = getById('proceduresListContainer');
        const badge = getById('proceduresCountBadge');
        if (!container)
            return;
        const procedures = (currentChart?.procedures || []).filter(p => {
            if (activeFilter === 'all')
                return p.status !== 'cancelled';
            return p.status === activeFilter;
        });
        if (badge)
            badge.textContent = String(procedures.length);
        if (procedures.length === 0) {
            container.innerHTML = `
                <div class="text-center text-xs text-gray-400 dark:text-gray-500 py-8">
                    Nenhum procedimento ${activeFilter !== 'all' ? `com status "${activeFilter}"` : ''} encontrado.
                </div>
            `;
            updateSelectedProceduresSummary();
            return;
        }
        container.innerHTML = procedures.map(proc => {
            const isPlanned = proc.status === 'planned';
            const isQuoted = proc.status === 'quoted';
            const isApproved = proc.status === 'approved';
            const isDone = proc.status === 'done';
            let statusBadgeClass = 'bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-gray-300';
            let statusLabel = proc.status;
            if (isPlanned) {
                statusBadgeClass = 'bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300 border border-sky-200 dark:border-sky-800/60';
                statusLabel = 'Planejado';
            }
            else if (isQuoted) {
                statusBadgeClass = 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60';
                statusLabel = proc.sales_order_id ? `Cotado #${String(proc.sales_order_id).padStart(4, '0')}` : 'Cotado';
            }
            else if (isApproved) {
                statusBadgeClass = 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60';
                statusLabel = 'Aprovado';
            }
            else if (isDone) {
                statusBadgeClass = 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60';
                statusLabel = 'Realizado';
            }
            let locationDesc = '';
            if (proc.tooth_code) {
                locationDesc = `Dente ${proc.tooth_code}`;
                if (proc.faces)
                    locationDesc += ` (${proc.faces.replace(/,/g, '/')})`;
            }
            else if (proc.region) {
                const regLabels = {
                    upper_arch: 'Arcada Superior',
                    lower_arch: 'Arcada Inferior',
                    quadrant: 'Quadrante',
                    mouth: 'Boca Toda'
                };
                locationDesc = regLabels[proc.region] || proc.region;
            }
            const isChecked = selectedPlannedIds.has(proc.public_id);
            return `
                <div class="p-3 bg-white dark:bg-slate-850 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm flex flex-col gap-2 hover:border-brand-300 dark:hover:border-slate-600 transition-colors">
                    <div class="flex items-start justify-between gap-2">
                        <div class="flex items-start gap-2">
                            ${isPlanned ? `
                                <input type="checkbox" value="${proc.public_id}" ${isChecked ? 'checked' : ''}
                                    class="proc-select-checkbox mt-0.5 rounded border-gray-300 dark:border-slate-600 text-brand-600 focus:ring-brand-500">
                            ` : ''}
                            <div>
                                <div class="flex items-center gap-1.5 flex-wrap">
                                    <span class="text-xs font-bold text-gray-900 dark:text-gray-100">${locationDesc}</span>
                                    <span class="px-2 py-0.5 rounded-md text-[10px] font-bold ${statusBadgeClass}">${statusLabel}</span>
                                </div>
                                <p class="text-xs text-gray-600 dark:text-gray-300 font-medium mt-0.5">${proc.service_name || 'Serviço Odontológico'}</p>
                            </div>
                        </div>
                        <span class="text-xs font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">${formatCurrency(Number(proc.unit_price))}</span>
                    </div>

                    ${proc.notes ? `<p class="text-[11px] text-gray-500 dark:text-gray-400 italic bg-gray-50 dark:bg-slate-900/40 p-1.5 rounded-md">${proc.notes}</p>` : ''}

                    <div class="flex items-center justify-between pt-1 border-t border-gray-100 dark:border-slate-700/60 text-[11px] text-gray-500 dark:text-gray-400">
                        <span>${proc.professional_user_name ? `Dr(a). ${proc.professional_user_name}` : 'Sem profissional'}</span>
                        <div class="flex items-center gap-1">
                            ${!isDone && proc.status !== 'cancelled' ? `
                                <button type="button" class="btn-perform-proc px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 font-semibold transition-all text-[11px]" data-id="${proc.public_id}">
                                    Realizar
                                </button>
                            ` : ''}
                            <button type="button" class="btn-delete-proc p-1 text-red-500 hover:text-red-700 dark:hover:text-red-400 transition-colors" data-id="${proc.public_id}" title="Excluir Procedimento">
                                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        // Attach listeners to checkboxes and buttons
        container.querySelectorAll('.proc-select-checkbox').forEach(cb => {
            cb.addEventListener('change', (e) => {
                const id = e.target.value;
                if (e.target.checked)
                    selectedPlannedIds.add(id);
                else
                    selectedPlannedIds.delete(id);
                updateSelectedProceduresSummary();
            });
        });
        container.querySelectorAll('.btn-perform-proc').forEach(btn => {
            btn.addEventListener('click', () => {
                const procId = btn.getAttribute('data-id');
                openPerformProcedureModal(procId);
            });
        });
        container.querySelectorAll('.btn-delete-proc').forEach(btn => {
            btn.addEventListener('click', async () => {
                const procId = btn.getAttribute('data-id');
                if (confirm('Deseja realmente remover este procedimento?')) {
                    try {
                        await api(`/dental/procedures/${procId}`, { method: 'DELETE' });
                        showAlert('Procedimento removido com sucesso!');
                        if (currentPatient)
                            await loadPatientChart(currentPatient.public_id);
                    }
                    catch (e) {
                        showAlert(e.message || 'Erro ao remover procedimento', 'error');
                    }
                }
            });
        });
        updateSelectedProceduresSummary();
    }
    function updateSelectedProceduresSummary() {
        const procedures = currentChart?.procedures || [];
        let total = 0;
        selectedPlannedIds.forEach(id => {
            const proc = procedures.find(p => p.public_id === id);
            if (proc)
                total += Number(proc.unit_price || 0);
        });
        const display = getById('selectedTotalAmountDisplay');
        if (display)
            display.textContent = formatCurrency(total);
        const btnGen = getById('btnGenerateQuote');
        if (btnGen) {
            btnGen.disabled = selectedPlannedIds.size === 0;
            btnGen.querySelector('span').textContent = selectedPlannedIds.size > 0
                ? `Gerar Orçamento (${selectedPlannedIds.size})`
                : 'Gerar Orçamento';
        }
    }
    // ── Modal de Realização de Procedimento ──────────────────────────────────────
    function openPerformProcedureModal(procPublicId) {
        const proc = (currentChart?.procedures || []).find(p => p.public_id === procPublicId);
        if (!proc)
            return;
        getById('performProcPublicId').value = proc.public_id;
        getById('performProcedureDesc').textContent = `${proc.tooth_code ? 'Dente ' + proc.tooth_code + ' - ' : ''}${proc.service_name || 'Procedimento'}`;
        getById('performProfessional').value = proc.professional_user_public_id || '';
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        getById('performDate').value = now.toISOString().slice(0, 16);
        getById('performProcedureModal')?.classList.remove('hidden');
    }
    function closePerformProcedureModal() {
        getById('performProcedureModal')?.classList.add('hidden');
    }
    // ── DOM Ready Initialization ────────────────────────────────────────────────
    document.addEventListener('DOMContentLoaded', async () => {
        if (!Auth.isAuthenticated()) {
            window.location.href = '/';
            return;
        }
        await Promise.all([loadCustomers(), loadServices(), loadProfessionals()]);
        // Patient Selector Listener
        getById('selectCustomer')?.addEventListener('change', (e) => {
            loadPatientChart(e.target.value);
        });
        // Dentition Toggle Buttons
        qsa('.dentition-toggle-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (!currentChart) {
                    showAlert('Selecione um paciente primeiro.', 'error');
                    return;
                }
                const dentition = btn.getAttribute('data-dentition');
                try {
                    await api(`/dental/charts/${currentChart.public_id}`, {
                        method: 'PUT',
                        body: JSON.stringify({ dentition })
                    });
                    currentChart.dentition = dentition;
                    updateDentitionToggleUI(dentition);
                    renderOdontogramSvg();
                }
                catch (e) {
                    showAlert('Erro ao alterar dentição.', 'error');
                }
            });
        });
        // Face pills click handler in procedure modal
        qsa('.face-pill').forEach(btn => {
            btn.addEventListener('click', () => {
                const face = btn.getAttribute('data-face');
                if (selectedFacesForNewProc.has(face)) {
                    selectedFacesForNewProc.delete(face);
                }
                else {
                    selectedFacesForNewProc.add(face);
                }
                updateFacePillsUI();
            });
        });
        // Service selector in procedure modal auto-fills price
        getById('procService')?.addEventListener('change', (e) => {
            const opt = e.target.options[e.target.selectedIndex];
            if (opt && opt.value) {
                const price = parseFloat(opt.getAttribute('data-price') || '0');
                getById('procUnitPrice').value = formatCurrency(price);
            }
            else {
                getById('procUnitPrice').value = '';
            }
        });
        // Format unit price input as BRL
        getById('procUnitPrice')?.addEventListener('input', (e) => {
            let digits = e.target.value.replace(/\D/g, '');
            if (digits === '')
                digits = '0';
            const num = parseInt(digits, 10) / 100;
            e.target.value = formatCurrency(num);
        });
        // Open procedure modal button
        getById('btnOpenNewProcedureModal')?.addEventListener('click', () => {
            openNewProcedureModalForTooth();
        });
        // Save procedure form
        getById('procedureForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!currentChart)
                return;
            const toothCodeVal = getById('procToothCode')?.value;
            const region = getById('procRegion')?.value || 'tooth';
            const servicePublicId = getById('procService')?.value;
            const unitPriceRaw = getById('procUnitPrice')?.value.replace(/[^\d]/g, '');
            const unitPrice = parseFloat(unitPriceRaw || '0') / 100;
            const professionalPublicId = getById('procProfessional')?.value || null;
            const status = getById('procStatus')?.value || 'planned';
            const notes = getById('procNotes')?.value || null;
            if (status === 'planned' && !servicePublicId) {
                alert('Selecione um serviço para o procedimento planejado.');
                return;
            }
            const payload = {
                tooth_code: toothCodeVal ? parseInt(toothCodeVal, 10) : null,
                region,
                faces: Array.from(selectedFacesForNewProc),
                service_public_id: servicePublicId || null,
                unit_price: unitPrice,
                status,
                professional_user_public_id: professionalPublicId,
                notes
            };
            const saveBtn = getById('btnSaveProcedure');
            saveBtn.disabled = true;
            saveBtn.textContent = 'Salvando...';
            try {
                await api(`/dental/charts/${currentChart.public_id}/procedures`, {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });
                closeProcedureModal();
                showAlert('Procedimento adicionado com sucesso!');
                if (currentPatient)
                    await loadPatientChart(currentPatient.public_id);
            }
            catch (err) {
                console.error(err);
                alert(err.message || 'Erro ao salvar procedimento.');
            }
            finally {
                saveBtn.disabled = false;
                saveBtn.textContent = 'Salvar Procedimento';
            }
        });
        // Tooth Detail Modal Actions
        qsa('.tooth-cond-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                qsa('.tooth-cond-btn').forEach(b => {
                    b.className = 'tooth-cond-btn px-2.5 py-2 rounded-xl border border-gray-200 dark:border-slate-700 text-xs font-medium hover:bg-gray-50 dark:hover:bg-slate-700 transition-all text-center';
                });
                btn.className = 'tooth-cond-btn px-2.5 py-2 rounded-xl border border-brand-500 bg-brand-50 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 font-bold text-xs shadow-sm text-center';
            });
        });
        getById('btnSaveToothCondition')?.addEventListener('click', async () => {
            if (!currentChart)
                return;
            const toothCode = parseInt(getById('modalToothCode').value, 10);
            const activeBtn = qs('.tooth-cond-btn.border-brand-500');
            const condition = activeBtn ? activeBtn.getAttribute('data-condition') : 'present';
            const notes = getById('toothNotesInput').value || null;
            try {
                await api(`/dental/charts/${currentChart.public_id}/teeth/${toothCode}`, {
                    method: 'PUT',
                    body: JSON.stringify({ condition, notes })
                });
                closeToothDetailModal();
                showAlert(`Condição do dente ${toothCode} atualizada com sucesso!`);
                if (currentPatient)
                    await loadPatientChart(currentPatient.public_id);
            }
            catch (e) {
                alert(e.message || 'Erro ao atualizar condição do dente.');
            }
        });
        getById('btnQuickAddProcedureForTooth')?.addEventListener('click', () => {
            const toothCode = parseInt(getById('modalToothCode').value, 10);
            closeToothDetailModal();
            openNewProcedureModalForTooth(toothCode);
        });
        getById('closeToothModalCross')?.addEventListener('click', closeToothDetailModal);
        getById('btnCancelToothModal')?.addEventListener('click', closeToothDetailModal);
        getById('toothDetailBackdrop')?.addEventListener('click', closeToothDetailModal);
        getById('closeProcedureModalCross')?.addEventListener('click', closeProcedureModal);
        getById('btnCancelProcedureModal')?.addEventListener('click', closeProcedureModal);
        getById('procedureBackdrop')?.addEventListener('click', closeProcedureModal);
        // Perform Procedure Submission
        getById('performProcedureForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const procId = getById('performProcPublicId')?.value;
            const professionalPublicId = getById('performProfessional')?.value || null;
            const performedAtVal = getById('performDate')?.value;
            try {
                await api(`/dental/procedures/${procId}/perform`, {
                    method: 'PATCH',
                    body: JSON.stringify({
                        professional_user_public_id: professionalPublicId,
                        performed_at: performedAtVal ? new Date(performedAtVal).toISOString() : new Date().toISOString()
                    })
                });
                closePerformProcedureModal();
                showAlert('Procedimento realizado com sucesso!');
                if (currentPatient)
                    await loadPatientChart(currentPatient.public_id);
            }
            catch (err) {
                alert(err.message || 'Erro ao registrar realização do procedimento.');
            }
        });
        getById('closePerformModalCross')?.addEventListener('click', closePerformProcedureModal);
        getById('btnCancelPerformModal')?.addEventListener('click', closePerformProcedureModal);
        getById('performBackdrop')?.addEventListener('click', closePerformProcedureModal);
        // Chart Notes Modal
        getById('btnChartNotes')?.addEventListener('click', () => {
            if (!currentChart) {
                showAlert('Selecione um paciente primeiro.', 'error');
                return;
            }
            getById('chartNotesTextarea').value = currentChart.notes || '';
            getById('chartNotesModal')?.classList.remove('hidden');
        });
        getById('chartNotesForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!currentChart)
                return;
            const notes = getById('chartNotesTextarea')?.value || null;
            try {
                await api(`/dental/charts/${currentChart.public_id}`, {
                    method: 'PUT',
                    body: JSON.stringify({ notes })
                });
                currentChart.notes = notes;
                getById('chartNotesModal')?.classList.add('hidden');
                showAlert('Notas clínicas salvas com sucesso!');
            }
            catch (err) {
                alert(err.message || 'Erro ao salvar notas clínicas.');
            }
        });
        getById('closeChartNotesCross')?.addEventListener('click', () => getById('chartNotesModal')?.classList.add('hidden'));
        getById('btnCancelChartNotes')?.addEventListener('click', () => getById('chartNotesModal')?.classList.add('hidden'));
        getById('chartNotesBackdrop')?.addEventListener('click', () => getById('chartNotesModal')?.classList.add('hidden'));
        // Select All Planned Procedures
        getById('selectAllPlannedProcedures')?.addEventListener('change', (e) => {
            const checked = e.target.checked;
            selectedPlannedIds.clear();
            if (checked) {
                (currentChart?.procedures || []).forEach(p => {
                    if (p.status === 'planned')
                        selectedPlannedIds.add(p.public_id);
                });
            }
            renderProcedures();
        });
        // Filter Tabs for Procedures
        qsa('.proc-filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                qsa('.proc-filter-btn').forEach(b => {
                    b.className = 'proc-filter-btn px-2 py-0.5 rounded-md text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white';
                });
                btn.className = 'proc-filter-btn px-2 py-0.5 rounded-md font-semibold bg-brand-50 dark:bg-brand-900/40 text-brand-600 dark:text-brand-300 border border-brand-200 dark:border-brand-800/60';
                activeFilter = btn.getAttribute('data-filter') || 'all';
                renderProcedures();
            });
        });
        // Generate Quote Button
        getById('btnGenerateQuote')?.addEventListener('click', async () => {
            if (!currentChart || selectedPlannedIds.size === 0)
                return;
            if (!confirm(`Deseja gerar um Orçamento com os ${selectedPlannedIds.size} procedimento(s) selecionado(s)?`)) {
                return;
            }
            const btn = getById('btnGenerateQuote');
            btn.disabled = true;
            try {
                const res = await api(`/dental/charts/${currentChart.public_id}/quote`, {
                    method: 'POST',
                    body: JSON.stringify({
                        procedure_public_ids: Array.from(selectedPlannedIds),
                        observation: `Orçamento odontológico do paciente ${currentPatient?.name || ''}`
                    })
                });
                showAlert('Orçamento gerado com sucesso! Redirecionando para a tela de Orçamentos...');
                selectedPlannedIds.clear();
                if (currentPatient)
                    await loadPatientChart(currentPatient.public_id);
                setTimeout(() => {
                    window.location.href = '/pages/quotes.html';
                }, 1500);
            }
            catch (err) {
                console.error(err);
                alert(err.message || 'Erro ao gerar orçamento a partir dos procedimentos.');
            }
            finally {
                btn.disabled = false;
            }
        });
    });
})();
