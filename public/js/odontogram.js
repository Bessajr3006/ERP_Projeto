/// <reference path="./api.ts" />
// Módulo Odontograma (numeração FDI).
(() => {
    const SVG_NS = 'http://www.w3.org/2000/svg';
    const TOOTH = 40;
    const GAP = 6;
    const MID_GAP = 22;
    const ROW_GAP = 26;
    const LABEL_H = 16;
    const PERMANENT_UPPER = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
    const PERMANENT_LOWER = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];
    const DECIDUOUS_UPPER = [55, 54, 53, 52, 51, 61, 62, 63, 64, 65];
    const DECIDUOUS_LOWER = [85, 84, 83, 82, 81, 71, 72, 73, 74, 75];
    const STATUS_LABELS = {
        existing: 'Existente',
        planned: 'Planejado',
        quoted: 'Orçado',
        approved: 'Aprovado',
        done: 'Realizado',
        cancelled: 'Cancelado',
    };
    const STATUS_COLORS = {
        existing: '#3b82f6',
        planned: '#ef4444',
        quoted: '#f59e0b',
        approved: '#8b5cf6',
        done: '#22c55e',
        cancelled: '#9ca3af',
    };
    const STATUS_BADGES = {
        existing: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
        planned: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
        quoted: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
        approved: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300',
        done: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
        cancelled: 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-gray-300',
    };
    // Prioridade de exibição da cor na face quando há mais de um procedimento.
    const STATUS_PRIORITY = ['planned', 'quoted', 'approved', 'done', 'existing'];
    const CONDITION_LABELS = {
        present: 'Presente',
        absent: 'Ausente',
        extracted: 'Extraído',
        implant: 'Implante',
        unerupted: 'Não erupcionado',
        retained: 'Retido',
    };
    const REGION_LABELS = {
        tooth: 'Dente',
        upper_arch: 'Arcada superior',
        lower_arch: 'Arcada inferior',
        quadrant: 'Quadrante',
        mouth: 'Boca toda',
    };
    const FACE_NAMES = {
        M: 'Mesial', D: 'Distal', O: 'Oclusal', I: 'Incisal', V: 'Vestibular', L: 'Lingual', P: 'Palatina',
    };
    const state = {
        customers: [],
        services: [],
        users: [],
        chart: null,
        customerId: '',
        dentition: 'permanent',
        selectedTooth: null,
        selectedFaces: new Set(),
        selectedProcs: new Set(),
        performTarget: null,
    };
    const $ = (id) => document.getElementById(id);
    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
    function formatCurrency(value) {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0);
    }
    function formatDateTime(value) {
        if (!value)
            return '';
        const d = new Date(value);
        if (isNaN(d.getTime()))
            return String(value);
        return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }
    function todayPlus(days) {
        const d = new Date();
        d.setDate(d.getDate() + days);
        d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
        return d.toISOString().slice(0, 10);
    }
    function nowLocalInput() {
        const d = new Date();
        d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
        return d.toISOString().slice(0, 16);
    }
    function showAlert(message, type = 'success', html = false) {
        const el = $('alertMessage');
        if (!el)
            return;
        if (html)
            el.innerHTML = message;
        else
            el.textContent = message;
        el.className = `mx-4 sm:mx-0 mb-4 p-4 rounded-xl text-sm ${type === 'success'
            ? 'bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-400'
            : 'bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-400'}`;
        el.classList.remove('hidden');
        window.clearTimeout(showAlert._t);
        showAlert._t = window.setTimeout(() => el.classList.add('hidden'), type === 'success' ? 6000 : 8000);
    }
    // ── Geometria FDI ─────────────────────────────────────────────────────────
    function quadrantOf(code) { return Math.floor(code / 10); }
    function isUpper(code) { return [1, 2, 5, 6].includes(quadrantOf(code)); }
    function isDisplayedLeft(code) { return [1, 4, 5, 8].includes(quadrantOf(code)); }
    function isAnterior(code) { return code % 10 <= 3; }
    function faceAt(code, position) {
        switch (position) {
            case 'center': return isAnterior(code) ? 'I' : 'O';
            case 'top': return isUpper(code) ? 'V' : 'L';
            case 'bottom': return isUpper(code) ? 'P' : 'V';
            case 'left': return isDisplayedLeft(code) ? 'D' : 'M';
            case 'right': return isDisplayedLeft(code) ? 'M' : 'D';
        }
    }
    function facesForTooth(code) {
        const positions = ['left', 'center', 'right', 'top', 'bottom'];
        return positions.map((p) => faceAt(code, p));
    }
    function toothData(code) {
        return (state.chart?.teeth || []).find((t) => Number(t.tooth_code) === code) || null;
    }
    function activeProcedures() {
        return (state.chart?.procedures || []).filter((p) => p.status !== 'cancelled');
    }
    function pickStatus(statuses) {
        for (const s of STATUS_PRIORITY)
            if (statuses.includes(s))
                return s;
        return null;
    }
    function faceStatus(code, face) {
        const statuses = activeProcedures()
            .filter((p) => p.region === 'tooth' && Number(p.tooth_code) === code && (p.faces || []).includes(face))
            .map((p) => p.status);
        return pickStatus(statuses);
    }
    function wholeToothStatus(code) {
        const statuses = activeProcedures()
            .filter((p) => p.region === 'tooth' && Number(p.tooth_code) === code && (!p.faces || p.faces.length === 0))
            .map((p) => p.status);
        return pickStatus(statuses);
    }
    // ── SVG ───────────────────────────────────────────────────────────────────
    function svgEl(tag, attrs) {
        const el = document.createElementNS(SVG_NS, tag);
        Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, String(v)));
        return el;
    }
    function facePolygon(position, s) {
        const a = s * 0.3, b = s * 0.7;
        switch (position) {
            case 'top': return `0,0 ${s},0 ${b},${a} ${a},${a}`;
            case 'bottom': return `0,${s} ${s},${s} ${b},${b} ${a},${b}`;
            case 'left': return `0,0 ${a},${a} ${a},${b} 0,${s}`;
            case 'right': return `${s},0 ${b},${a} ${b},${b} ${s},${s}`;
            case 'center': return `${a},${a} ${b},${a} ${b},${b} ${a},${b}`;
        }
    }
    function drawTooth(svg, code, x, y, labelAbove) {
        const g = svgEl('g', { class: 'tooth-group', transform: `translate(${x},${y})`, 'data-tooth': code });
        if (state.selectedTooth === code)
            g.classList.add('tooth-selected');
        const tooth = toothData(code);
        const condition = tooth?.condition || 'present';
        const missing = condition === 'absent' || condition === 'extracted';
        const label = svgEl('text', {
            class: 'tooth-label', x: TOOTH / 2, y: labelAbove ? -5 : TOOTH + 13, 'text-anchor': 'middle', 'data-tooth': code,
        });
        label.textContent = String(code);
        g.appendChild(label);
        ['top', 'bottom', 'left', 'right', 'center'].forEach((pos) => {
            const face = faceAt(code, pos);
            const status = faceStatus(code, face);
            let fill = missing ? '#e5e7eb' : '#ffffff';
            if (status)
                fill = STATUS_COLORS[status] || fill;
            const poly = svgEl('polygon', {
                class: 'tooth-face', points: facePolygon(pos, TOOTH), fill, 'data-tooth': code, 'data-face': face,
            });
            const title = svgEl('title', {});
            title.textContent = `Dente ${code} – ${FACE_NAMES[face]} (${face})${status ? ' – ' + STATUS_LABELS[status] : ''}`;
            poly.appendChild(title);
            if (state.selectedTooth === code && state.selectedFaces.has(face))
                poly.classList.add('face-selected');
            g.appendChild(poly);
        });
        const whole = wholeToothStatus(code);
        const outline = svgEl('rect', { class: 'tooth-outline', x: -3, y: -3, width: TOOTH + 6, height: TOOTH + 6, rx: 4 });
        if (whole) {
            outline.setAttribute('style', `stroke:${STATUS_COLORS[whole]};stroke-width:3`);
        }
        g.appendChild(outline);
        if (missing) {
            g.appendChild(svgEl('line', { class: 'tooth-mark', x1: 2, y1: 2, x2: TOOTH - 2, y2: TOOTH - 2, stroke: '#dc2626', 'stroke-width': 3 }));
            g.appendChild(svgEl('line', { class: 'tooth-mark', x1: TOOTH - 2, y1: 2, x2: 2, y2: TOOTH - 2, stroke: '#dc2626', 'stroke-width': 3 }));
        }
        else if (condition === 'implant' || condition === 'retained' || condition === 'unerupted') {
            const mark = svgEl('text', {
                class: 'tooth-mark', x: TOOTH / 2, y: TOOTH / 2 + 4, 'text-anchor': 'middle',
                'font-size': 11, 'font-weight': 700, fill: '#1e3a5f',
            });
            mark.textContent = condition === 'implant' ? 'IMP' : (condition === 'retained' ? 'R' : 'NE');
            g.appendChild(mark);
            if (condition === 'unerupted') {
                g.appendChild(svgEl('rect', { class: 'tooth-mark', x: -1, y: -1, width: TOOTH + 2, height: TOOTH + 2, fill: 'none', stroke: '#64748b', 'stroke-dasharray': '4 3' }));
            }
        }
        svg.appendChild(g);
    }
    function drawRow(svg, teeth, y, labelAbove, totalWidth) {
        const half = teeth.length / 2;
        const rowWidth = teeth.length * (TOOTH + GAP) - GAP + MID_GAP;
        const offset = (totalWidth - rowWidth) / 2;
        teeth.forEach((code, i) => {
            const x = offset + i * (TOOTH + GAP) + (i >= half ? MID_GAP : 0);
            drawTooth(svg, code, x, y, labelAbove);
        });
    }
    function renderSvg() {
        const svg = $('odontogramSvg');
        if (!svg)
            return;
        while (svg.firstChild)
            svg.removeChild(svg.firstChild);
        const rows = [];
        if (state.dentition === 'permanent') {
            rows.push({ teeth: PERMANENT_UPPER, above: true }, { teeth: PERMANENT_LOWER, above: false });
        }
        else if (state.dentition === 'deciduous') {
            rows.push({ teeth: DECIDUOUS_UPPER, above: true }, { teeth: DECIDUOUS_LOWER, above: false });
        }
        else {
            rows.push({ teeth: PERMANENT_UPPER, above: true }, { teeth: DECIDUOUS_UPPER, above: true }, { teeth: DECIDUOUS_LOWER, above: false }, { teeth: PERMANENT_LOWER, above: false });
        }
        const width = 16 * (TOOTH + GAP) - GAP + MID_GAP + 8;
        let y = LABEL_H + 4;
        rows.forEach((row, idx) => {
            if (idx > 0 && rows[idx - 1].above && !row.above)
                y += ROW_GAP; // separa arcadas
            drawRow(svg, row.teeth, y, row.above, width);
            y += TOOTH + LABEL_H + 8;
        });
        const height = y + 4;
        // linha média
        svg.appendChild(svgEl('line', { x1: width / 2, y1: 0, x2: width / 2, y2: height, stroke: '#94a3b8', 'stroke-dasharray': '3 4' }));
        svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
        svg.setAttribute('width', String(width));
        svg.setAttribute('height', String(height));
    }
    function renderLegend() {
        const el = $('legend');
        if (!el)
            return;
        el.innerHTML = ['existing', 'planned', 'quoted', 'approved', 'done']
            .map((s) => `<span class="inline-flex items-center gap-1"><span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:${STATUS_COLORS[s]}"></span>${STATUS_LABELS[s]}</span>`)
            .join('') + '<span class="inline-flex items-center gap-1"><span style="color:#dc2626;font-weight:700">✕</span>Ausente/Extraído</span>';
    }
    function renderDentitionToggle() {
        document.querySelectorAll('.dentition-btn').forEach((btn) => {
            const active = btn.dataset.dentition === state.dentition;
            btn.className = `dentition-btn px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${active
                ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-400 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`;
        });
    }
    // ── Painel do dente ───────────────────────────────────────────────────────
    function renderToothPanel() {
        const code = state.selectedTooth;
        $('selectedToothLabel').textContent = code ? String(code) : '—';
        const tooth = code ? toothData(code) : null;
        $('toothCondition').value = tooth?.condition || 'present';
        $('toothNotes').value = tooth?.notes || '';
        $('toothCondition').disabled = !code;
        $('toothNotes').disabled = !code;
        $('btnSaveTooth').disabled = !code;
        const facesBox = $('procFaces');
        const region = $('procRegion').value;
        $('procFacesWrapper').classList.toggle('hidden', region !== 'tooth');
        if (!code) {
            facesBox.innerHTML = '<span class="text-gray-400">Selecione um dente no odontograma.</span>';
            return;
        }
        const faces = facesForTooth(code);
        facesBox.innerHTML = faces.map((f) => {
            const active = state.selectedFaces.has(f);
            return `<button type="button" data-face-toggle="${f}" title="${FACE_NAMES[f]}"
                class="px-2 py-1 rounded-md border text-xs font-semibold ${active
                ? 'bg-sky-500 border-sky-500 text-white'
                : 'border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-200'}">${f}</button>`;
        }).join('');
    }
    function selectTooth(code, face) {
        if (state.selectedTooth !== code) {
            state.selectedTooth = code;
            state.selectedFaces = new Set();
        }
        if (face) {
            if (state.selectedFaces.has(face))
                state.selectedFaces.delete(face);
            else
                state.selectedFaces.add(face);
            if ($('procRegion').value !== 'tooth')
                $('procRegion').value = 'tooth';
        }
        renderSvg();
        renderToothPanel();
    }
    // ── Procedimentos ─────────────────────────────────────────────────────────
    function procLocation(p) {
        if (p.region === 'tooth') {
            return `Dente ${p.tooth_code}${p.faces && p.faces.length ? ` <span class="text-xs text-gray-500 dark:text-gray-400">(${p.faces.join('/')})</span>` : ''}`;
        }
        if (p.region === 'quadrant')
            return `Quadrante ${p.tooth_code ? Math.floor(Number(p.tooth_code) / 10) : ''}`;
        return REGION_LABELS[p.region] || p.region;
    }
    function renderProcedures() {
        const tbody = $('proceduresTable');
        const procs = state.chart?.procedures || [];
        // remove seleções que não são mais planejadas
        const plannedIds = new Set(procs.filter((p) => p.status === 'planned').map((p) => p.public_id));
        Array.from(state.selectedProcs).forEach((id) => { if (!plannedIds.has(id))
            state.selectedProcs.delete(id); });
        if (procs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="px-3 py-6 text-center text-gray-500 dark:text-gray-400">Nenhum procedimento registrado.</td></tr>';
        }
        else {
            tbody.innerHTML = procs.map((p) => {
                const actions = [];
                if (p.status === 'planned' || p.status === 'approved') {
                    actions.push(`<button type="button" class="text-emerald-600 hover:text-emerald-800 font-medium" data-action="perform" data-id="${p.public_id}">Realizar</button>`);
                }
                if (p.status === 'planned') {
                    actions.push(`<button type="button" class="text-gray-600 hover:text-gray-800 dark:text-gray-300" data-action="cancel" data-id="${p.public_id}">Cancelar</button>`);
                }
                if (p.status === 'cancelled') {
                    actions.push(`<button type="button" class="text-brand-600 hover:text-brand-800" data-action="reactivate" data-id="${p.public_id}">Reativar</button>`);
                }
                if (p.status === 'planned' || p.status === 'existing' || p.status === 'cancelled') {
                    actions.push(`<button type="button" class="text-red-600 hover:text-red-800" data-action="delete" data-id="${p.public_id}">Excluir</button>`);
                }
                const quote = p.sales_order_public_id
                    ? `<a href="/pages/quotes.html" class="text-brand-600 hover:underline">#${String(p.sales_order_number).padStart(4, '0')}</a>`
                    : '—';
                const performed = p.status === 'done' && p.performed_at ? `<div class="text-xs text-gray-500 dark:text-gray-400">${escapeHtml(formatDateTime(p.performed_at))}</div>` : '';
                return `
                    <tr class="${p.status === 'cancelled' ? 'opacity-60' : ''}">
                        <td class="px-3 py-2">${p.status === 'planned'
                    ? `<input type="checkbox" class="proc-checkbox rounded border-gray-300" data-id="${p.public_id}" ${state.selectedProcs.has(p.public_id) ? 'checked' : ''}>`
                    : ''}</td>
                        <td class="px-3 py-2 whitespace-nowrap">${procLocation(p)}</td>
                        <td class="px-3 py-2">${escapeHtml(p.service_name || '—')}${p.notes ? `<div class="text-xs text-gray-500 dark:text-gray-400">${escapeHtml(p.notes)}</div>` : ''}</td>
                        <td class="px-3 py-2 text-right whitespace-nowrap">${formatCurrency(p.unit_price)}</td>
                        <td class="px-3 py-2"><span class="px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGES[p.status] || ''}">${STATUS_LABELS[p.status] || p.status}</span></td>
                        <td class="px-3 py-2">${escapeHtml(p.professional_name || '—')}${performed}</td>
                        <td class="px-3 py-2">${quote}</td>
                        <td class="px-3 py-2 text-right whitespace-nowrap space-x-2">${actions.join('')}</td>
                    </tr>`;
            }).join('');
        }
        updateSelectionSummary();
    }
    function selectedProcedures() {
        return (state.chart?.procedures || []).filter((p) => state.selectedProcs.has(p.public_id));
    }
    function updateSelectionSummary() {
        const sel = selectedProcedures();
        const total = sel.reduce((sum, p) => sum + Number(p.unit_price || 0), 0);
        $('selectedProcCount').textContent = String(sel.length);
        $('selectedProcTotal').textContent = formatCurrency(total);
        $('btnGenerateQuote').disabled = sel.length === 0;
        const planned = (state.chart?.procedures || []).filter((p) => p.status === 'planned');
        const all = $('procSelectAll');
        all.checked = planned.length > 0 && planned.every((p) => state.selectedProcs.has(p.public_id));
        all.disabled = planned.length === 0;
    }
    // ── Carregamento ─────────────────────────────────────────────────────────
    function renderPatientOptions(filter = '') {
        const select = $('patientSelect');
        const term = filter.trim().toLowerCase();
        const list = state.customers.filter((c) => !term
            || String(c.name || '').toLowerCase().includes(term)
            || String(c.cnpj_cpf || '').replace(/\D/g, '').includes(term.replace(/\D/g, '') || '\u0000'));
        select.innerHTML = '<option value="">Selecione o paciente...</option>' + list
            .map((c) => `<option value="${escapeHtml(c.public_id)}" ${c.public_id === state.customerId ? 'selected' : ''}>${escapeHtml(c.name)}${c.cnpj_cpf ? ' — ' + escapeHtml(c.cnpj_cpf) : ''}</option>`)
            .join('');
    }
    function renderUsersOptions(selectId, emptyLabel) {
        const select = $(selectId);
        if (!select)
            return;
        select.innerHTML = (emptyLabel !== null ? `<option value="">${emptyLabel}</option>` : '') + state.users
            .map((u) => `<option value="${escapeHtml(u.public_id)}">${escapeHtml(u.full_name || u.name || u.email || 'Usuário')}</option>`)
            .join('');
    }
    async function loadDependencies() {
        const [customersRes, servicesRes, usersRes] = await Promise.all([
            api('/entities/customers').catch(() => ({ data: [] })),
            api('/estoque/services').catch(() => ({ data: [] })),
            api('/users').catch(() => ({ data: [] })),
        ]);
        state.customers = (customersRes?.data || []).slice().sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR'));
        state.services = (servicesRes?.data || []).slice().sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR'));
        state.users = (usersRes?.data || []).filter((u) => u.public_id && u.is_active !== 0 && u.is_active !== false);
        renderPatientOptions();
        $('procService').innerHTML = '<option value="">Selecione...</option>' + state.services
            .map((s) => `<option value="${escapeHtml(s.public_id)}" data-price="${Number(s.price || 0)}">${escapeHtml(s.name)} — ${formatCurrency(Number(s.price || 0))}</option>`)
            .join('');
        renderUsersOptions('procProfessional', '—');
        renderUsersOptions('performProfessional', null);
    }
    function showSection(which) {
        $('emptyState').classList.toggle('hidden', which !== 'empty');
        $('createChartState').classList.toggle('hidden', which !== 'create');
        $('chartSection').classList.toggle('hidden', which !== 'chart');
    }
    function renderChart() {
        renderDentitionToggle();
        renderLegend();
        renderSvg();
        renderToothPanel();
        renderProcedures();
    }
    async function loadChart() {
        if (!state.customerId) {
            state.chart = null;
            showSection('empty');
            return;
        }
        try {
            const res = await api(`/dental/charts/customer/${encodeURIComponent(state.customerId)}`, { cache: 'no-store' });
            state.chart = res?.data || null;
            if (!state.chart) {
                showSection('create');
                return;
            }
            state.dentition = state.chart.dentition || 'permanent';
            showSection('chart');
            renderChart();
        }
        catch (error) {
            showAlert(error?.message || 'Erro ao carregar odontograma.', 'error');
        }
    }
    async function reloadChart() {
        if (!state.chart)
            return loadChart();
        const res = await api(`/dental/charts/${state.chart.public_id}`, { cache: 'no-store' });
        state.chart = res?.data || state.chart;
        renderChart();
    }
    // ── Ações ────────────────────────────────────────────────────────────────
    async function createChart() {
        try {
            await api('/dental/charts', { method: 'POST', body: JSON.stringify({ customer_public_id: state.customerId, dentition: 'permanent' }) });
            await loadChart();
            showAlert('Odontograma criado.');
        }
        catch (error) {
            showAlert(error?.message || 'Erro ao criar odontograma.', 'error');
        }
    }
    async function changeDentition(dentition) {
        if (!state.chart || dentition === state.dentition)
            return;
        state.dentition = dentition;
        renderChart();
        try {
            await api(`/dental/charts/${state.chart.public_id}`, { method: 'PATCH', body: JSON.stringify({ dentition }) });
            state.chart.dentition = dentition;
        }
        catch (error) {
            showAlert(error?.message || 'Erro ao salvar a dentição.', 'error');
        }
    }
    async function saveTooth() {
        if (!state.chart || !state.selectedTooth)
            return;
        try {
            await api(`/dental/charts/${state.chart.public_id}/teeth`, {
                method: 'PUT',
                body: JSON.stringify({ teeth: [{ tooth_code: state.selectedTooth, condition: $('toothCondition').value, notes: $('toothNotes').value || null }] }),
            });
            await reloadChart();
            showAlert(`Dente ${state.selectedTooth}: ${CONDITION_LABELS[$('toothCondition').value]}.`);
        }
        catch (error) {
            showAlert(error?.message || 'Erro ao salvar condição do dente.', 'error');
        }
    }
    async function addProcedure(e) {
        e.preventDefault();
        if (!state.chart)
            return;
        const region = $('procRegion').value;
        const status = $('procStatus').value;
        const serviceId = $('procService').value;
        if ((region === 'tooth' || region === 'quadrant') && !state.selectedTooth) {
            showAlert('Selecione um dente no odontograma.', 'error');
            return;
        }
        if (status === 'planned' && !serviceId) {
            showAlert('Selecione o serviço do procedimento planejado.', 'error');
            return;
        }
        const priceRaw = $('procPrice').value;
        const payload = {
            region,
            tooth_code: region === 'tooth' || region === 'quadrant' ? state.selectedTooth : null,
            faces: region === 'tooth' ? Array.from(state.selectedFaces) : [],
            service_public_id: serviceId || null,
            unit_price: priceRaw === '' ? null : Number(priceRaw),
            status,
            professional_user_id: $('procProfessional').value || null,
            planned_at: $('procPlannedAt').value || null,
            notes: $('procNotes').value || null,
        };
        const btn = $('btnAddProcedure');
        btn.disabled = true;
        try {
            await api(`/dental/charts/${state.chart.public_id}/procedures`, { method: 'POST', body: JSON.stringify(payload) });
            state.selectedFaces = new Set();
            $('procNotes').value = '';
            await reloadChart();
            showAlert('Procedimento adicionado.');
        }
        catch (error) {
            showAlert(error?.message || 'Erro ao adicionar procedimento.', 'error');
        }
        finally {
            btn.disabled = false;
        }
    }
    async function updateProcedureStatus(id, status) {
        try {
            await api(`/dental/procedures/${id}`, { method: 'PUT', body: JSON.stringify({ status }) });
            await reloadChart();
        }
        catch (error) {
            showAlert(error?.message || 'Erro ao atualizar procedimento.', 'error');
        }
    }
    async function deleteProcedure(id) {
        if (!confirm('Excluir este procedimento?'))
            return;
        try {
            await api(`/dental/procedures/${id}`, { method: 'DELETE' });
            state.selectedProcs.delete(id);
            await reloadChart();
            showAlert('Procedimento excluído.');
        }
        catch (error) {
            showAlert(error?.message || 'Erro ao excluir procedimento.', 'error');
        }
    }
    function openPerform(id) {
        const proc = (state.chart?.procedures || []).find((p) => p.public_id === id);
        if (!proc)
            return;
        state.performTarget = id;
        $('performProcLabel').innerHTML = `${procLocation(proc)} — ${escapeHtml(proc.service_name || '')}`;
        const select = $('performProfessional');
        const current = proc.professional_user_public_id || window.gNavbarAuthContext?.user?.public_id || '';
        if (current)
            select.value = current;
        $('performAt').value = nowLocalInput();
        $('performModal').classList.remove('hidden');
    }
    async function confirmPerform() {
        if (!state.performTarget)
            return;
        const at = $('performAt').value;
        const payload = {
            professional_user_id: $('performProfessional').value || null,
            performed_at: at ? new Date(at).toISOString() : null,
        };
        const btn = $('btnConfirmPerform');
        btn.disabled = true;
        try {
            const res = await api(`/dental/procedures/${state.performTarget}/perform`, { method: 'PATCH', body: JSON.stringify(payload) });
            $('performModal').classList.add('hidden');
            state.performTarget = null;
            await reloadChart();
            showAlert(res?.data?.order_completed
                ? 'Procedimento realizado. Todos os procedimentos do pedido foram concluídos — pedido marcado como concluído.'
                : 'Procedimento marcado como realizado.');
        }
        catch (error) {
            showAlert(error?.message || 'Erro ao marcar procedimento como realizado.', 'error');
        }
        finally {
            btn.disabled = false;
        }
    }
    function openQuoteModal() {
        const sel = selectedProcedures();
        if (sel.length === 0)
            return;
        const total = sel.reduce((sum, p) => sum + Number(p.unit_price || 0), 0);
        $('quoteSummary').textContent = `${sel.length} procedimento(s) — total ${formatCurrency(total)}`;
        $('quoteValidity').value = todayPlus(15);
        $('quoteObservation').value = 'Orçamento gerado a partir do odontograma.';
        $('quotePaymentTerms').value = '';
        $('quoteModal').classList.remove('hidden');
    }
    async function confirmQuote() {
        if (!state.chart)
            return;
        const ids = selectedProcedures().map((p) => p.public_id);
        if (ids.length === 0)
            return;
        const btn = $('btnConfirmQuote');
        btn.disabled = true;
        try {
            const res = await api(`/dental/charts/${state.chart.public_id}/quote`, {
                method: 'POST',
                body: JSON.stringify({
                    procedure_public_ids: ids,
                    validity_date: $('quoteValidity').value || null,
                    observation: $('quoteObservation').value || null,
                    payment_terms: $('quotePaymentTerms').value || null,
                }),
            });
            $('quoteModal').classList.add('hidden');
            state.selectedProcs.clear();
            await reloadChart();
            const number = String(res?.data?.quote_number || '').padStart(4, '0');
            showAlert(`Orçamento #${escapeHtml(number)} gerado (${escapeHtml(formatCurrency(res?.data?.total_amount))}). <a href="/pages/quotes.html" class="underline font-semibold">Abrir orçamentos</a>`, 'success', true);
        }
        catch (error) {
            showAlert(error?.message || 'Erro ao gerar orçamento.', 'error');
        }
        finally {
            btn.disabled = false;
        }
    }
    // ── Eventos ──────────────────────────────────────────────────────────────
    document.addEventListener('DOMContentLoaded', async () => {
        if (!Auth.isAuthenticated()) {
            window.location.href = '/';
            return;
        }
        await loadDependencies();
        const params = new URLSearchParams(window.location.search);
        const preselected = params.get('customer');
        if (preselected) {
            state.customerId = preselected;
            renderPatientOptions();
            await loadChart();
        }
        $('patientFilter').addEventListener('input', (e) => renderPatientOptions(e.target.value || ''));
        $('patientSelect').addEventListener('change', async (e) => {
            state.customerId = e.target.value || '';
            state.selectedTooth = null;
            state.selectedFaces = new Set();
            state.selectedProcs.clear();
            const url = new URL(window.location.href);
            if (state.customerId)
                url.searchParams.set('customer', state.customerId);
            else
                url.searchParams.delete('customer');
            window.history.replaceState(null, '', url.toString());
            await loadChart();
        });
        $('btnCreateChart').addEventListener('click', createChart);
        $('dentitionToggle').addEventListener('click', (e) => {
            const btn = e.target.closest('[data-dentition]');
            if (btn)
                changeDentition(btn.dataset.dentition);
        });
        $('odontogramSvg').addEventListener('click', (e) => {
            const target = e.target;
            const code = Number(target.getAttribute('data-tooth') || target.parentElement?.getAttribute('data-tooth'));
            if (!code)
                return;
            const face = target.getAttribute('data-face');
            selectTooth(code, face || undefined);
        });
        $('procFaces').addEventListener('click', (e) => {
            const btn = e.target.closest('[data-face-toggle]');
            if (btn && state.selectedTooth)
                selectTooth(state.selectedTooth, btn.dataset.faceToggle);
        });
        $('procRegion').addEventListener('change', renderToothPanel);
        $('procService').addEventListener('change', (e) => {
            const opt = e.target.options[e.target.selectedIndex];
            const price = opt?.getAttribute('data-price');
            $('procPrice').value = price !== null && price !== undefined && opt.value ? Number(price).toFixed(2) : '';
        });
        $('btnSaveTooth').addEventListener('click', saveTooth);
        $('procedureForm').addEventListener('submit', addProcedure);
        $('proceduresTable').addEventListener('click', (e) => {
            const checkbox = e.target.closest('.proc-checkbox');
            if (checkbox) {
                const id = checkbox.dataset.id;
                if (checkbox.checked)
                    state.selectedProcs.add(id);
                else
                    state.selectedProcs.delete(id);
                updateSelectionSummary();
                return;
            }
            const btn = e.target.closest('[data-action]');
            if (!btn)
                return;
            const id = btn.dataset.id;
            switch (btn.dataset.action) {
                case 'perform':
                    openPerform(id);
                    break;
                case 'cancel':
                    updateProcedureStatus(id, 'cancelled');
                    break;
                case 'reactivate':
                    updateProcedureStatus(id, 'planned');
                    break;
                case 'delete':
                    deleteProcedure(id);
                    break;
            }
        });
        $('procSelectAll').addEventListener('change', (e) => {
            const planned = (state.chart?.procedures || []).filter((p) => p.status === 'planned');
            if (e.target.checked)
                planned.forEach((p) => state.selectedProcs.add(p.public_id));
            else
                state.selectedProcs.clear();
            renderProcedures();
        });
        $('btnGenerateQuote').addEventListener('click', openQuoteModal);
        $('btnConfirmQuote').addEventListener('click', confirmQuote);
        $('btnConfirmPerform').addEventListener('click', confirmPerform);
        document.querySelectorAll('[data-close-modal]').forEach((el) => {
            el.addEventListener('click', () => $(el.dataset.closeModal)?.classList.add('hidden'));
        });
    });
})();
