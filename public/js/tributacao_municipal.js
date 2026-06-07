(() => {
    const STORAGE_KEY = 'municipal_taxation_references';
    const LEGACY_STORAGE_KEY = 'municipal_taxation_form';
    const VIEW_STORAGE_KEY = 'municipal_taxation_view';
    const getById = (id) => document.getElementById(id);

    let entries = [];
    let filteredEntries = [];
    let currentView = localStorage.getItem(VIEW_STORAGE_KEY) || 'list';

    function showAlert(message, type = 'success') {
        const el = getById('alertMessage');
        if (!el) return;

        el.textContent = message;
        el.className = `mx-4 sm:mx-0 mb-4 p-4 rounded-xl text-sm ${type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`;
        el.classList.remove('hidden');

        setTimeout(() => {
            el.classList.add('hidden');
        }, 3500);
    }

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function parseNumber(value) {
        const normalized = String(value || '').trim().replace(',', '.');
        if (!normalized) return null;
        const numeric = Number(normalized);
        return Number.isFinite(numeric) ? numeric : null;
    }

    function formatCurrency(value) {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) return 'R$ 0,00';
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(numeric);
    }

    function formatPercent(value) {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) return '-';
        return `${numeric.toFixed(2)}%`;
    }

    function setRadioValue(name, value) {
        const radios = document.querySelectorAll(`input[name="${name}"]`);
        radios.forEach((radio) => {
            radio.checked = radio.value === value;
        });
    }

    function getRadioValue(name, fallback = 'nao') {
        const checked = document.querySelector(`input[name="${name}"]:checked`);
        return checked ? checked.value : fallback;
    }

    function loadEntries() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            entries = raw ? JSON.parse(raw) : [];
            if (!Array.isArray(entries)) entries = [];
        } catch (error) {
            entries = [];
            console.error('Falha ao carregar referências de tributação municipal', error);
        }
    }

    function saveEntries() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    }

    function migrateLegacyForm() {
        if (entries.length > 0) return;

        try {
            const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
            if (!raw) return;
            const legacy = JSON.parse(raw);
            if (!legacy || typeof legacy !== 'object') return;

            entries = [{
                id: String(Date.now()),
                referenceName: 'Referência importada',
                issqnTaxation: legacy.issqnTaxation || 'operacao_tributavel',
                specialTaxRegime: legacy.specialTaxRegime || 'nenhum',
                issqnSuspended: legacy.issqnSuspended || 'nao',
                issqnRetention: legacy.issqnRetention || 'nao',
                municipalBenefit: legacy.municipalBenefit || 'nao',
                issqnRate: parseNumber(legacy.issqnRate),
                issqnBase: parseNumber(legacy.issqnBase),
                issqnValue: parseNumber(legacy.issqnValue),
            }];

            saveEntries();
            localStorage.removeItem(LEGACY_STORAGE_KEY);
        } catch (error) {
            console.error('Falha ao migrar dados antigos de tributação municipal', error);
        }
    }

    function fillForm(data = {}) {
        getById('municipalTaxId').value = data.id || '';
        getById('referenceName').value = data.referenceName || '';
        getById('issqnTaxation').value = data.issqnTaxation || 'operacao_tributavel';
        getById('specialTaxRegime').value = data.specialTaxRegime || 'nenhum';
        setRadioValue('issqnSuspended', data.issqnSuspended || 'nao');
        setRadioValue('issqnRetention', data.issqnRetention || 'nao');
        setRadioValue('municipalBenefit', data.municipalBenefit || 'nao');
        getById('issqnRate').value = data.issqnRate ?? '';
        getById('issqnBase').value = data.issqnBase ?? '';
        getById('issqnValue').value = data.issqnValue ?? '';
    }

    function collectFormData() {
        return {
            id: getById('municipalTaxId').value || '',
            referenceName: String(getById('referenceName')?.value || '').trim(),
            issqnTaxation: getById('issqnTaxation')?.value || 'operacao_tributavel',
            specialTaxRegime: getById('specialTaxRegime')?.value || 'nenhum',
            issqnSuspended: getRadioValue('issqnSuspended', 'nao'),
            issqnRetention: getRadioValue('issqnRetention', 'nao'),
            municipalBenefit: getRadioValue('municipalBenefit', 'nao'),
            issqnRate: parseNumber(getById('issqnRate')?.value),
            issqnBase: parseNumber(getById('issqnBase')?.value),
            issqnValue: parseNumber(getById('issqnValue')?.value),
        };
    }

    function updateViewToggle() {
        const btnList = getById('btnListView');
        const btnGrid = getById('btnGridView');
        const tableSection = getById('municipalTaxSection');
        const gridSection = getById('municipalTaxGridSection');
        if (!btnList || !btnGrid || !tableSection || !gridSection) return;

        const activeClasses = 'flex items-center justify-center px-3 py-1.5 rounded-lg bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 shadow-sm transition-all focus:outline-none gap-1';
        const inactiveClasses = 'flex items-center justify-center px-3 py-1.5 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-all focus:outline-none gap-1';

        btnList.className = inactiveClasses;
        btnGrid.className = inactiveClasses;
        btnList.querySelector('.check-icon')?.classList.add('hidden');
        btnGrid.querySelector('.check-icon')?.classList.add('hidden');

        if (currentView === 'list') {
            btnList.className = activeClasses;
            btnList.querySelector('.check-icon')?.classList.remove('hidden');
            tableSection.classList.remove('hidden');
            tableSection.classList.add('flex');
            gridSection.classList.remove('grid');
            gridSection.classList.add('hidden');
        } else {
            btnGrid.className = activeClasses;
            btnGrid.querySelector('.check-icon')?.classList.remove('hidden');
            tableSection.classList.add('hidden');
            tableSection.classList.remove('flex');
            gridSection.classList.remove('hidden');
            gridSection.classList.add('grid');
        }
    }

    function updateResultsFooter() {
        const rangeEl = document.querySelector('[data-grid-footer-range]');
        const totalEl = document.querySelector('[data-grid-footer-total]');
        const total = filteredEntries.length;
        const range = total > 0 ? `1-${total}` : '0-0';

        if (rangeEl) rangeEl.textContent = range;
        if (totalEl) totalEl.textContent = String(total);
    }

    function openModal(id = null) {
        const modal = getById('municipalTaxModal');
        const title = getById('modalTitle');

        if (id) {
            const entry = entries.find((item) => String(item.id) === String(id));
            if (!entry) return;
            fillForm(entry);
            title.textContent = 'Editar Referência de Tributação Municipal';
        } else {
            fillForm({});
            title.textContent = 'Nova Referência de Tributação Municipal';
        }

        modal?.classList.remove('hidden');
        getById('referenceName')?.focus();
    }

    function closeModal() {
        getById('municipalTaxModal')?.classList.add('hidden');
    }

    function removeEntry(id) {
        const entry = entries.find((item) => String(item.id) === String(id));
        if (!entry) return;
        if (!window.confirm(`Deseja excluir a referência "${entry.referenceName}"?`)) return;

        entries = entries.filter((item) => String(item.id) !== String(id));
        saveEntries();
        applyFilters();
        showAlert('Referência excluída com sucesso!', 'success');
    }

    function renderTable() {
        const tbody = getById('municipalTaxTable');
        if (!tbody) return;

        if (filteredEntries.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">Nenhuma referência cadastrada.</td></tr>';
            return;
        }

        tbody.innerHTML = filteredEntries.map((item) => `
            <tr class="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                <td class="px-6 py-4 text-sm font-semibold text-gray-900 dark:text-gray-100">${escapeHtml(item.referenceName)}</td>
                <td class="px-6 py-4 text-sm text-gray-500 dark:text-gray-300">${escapeHtml(item.issqnTaxation)} / ${escapeHtml(item.specialTaxRegime)}</td>
                <td class="px-6 py-4 text-sm text-gray-500 dark:text-gray-300">${formatPercent(item.issqnRate)} | ${formatCurrency(item.issqnValue)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button type="button" title="Editar" class="text-brand-600 hover:text-brand-900 dark:hover:text-brand-400 mr-3 edit-btn" data-id="${item.id}">
                        <svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                    </button>
                    <button type="button" title="Excluir" class="text-red-600 hover:text-red-900 dark:hover:text-red-400 delete-btn" data-id="${item.id}">
                        <svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>
                </td>
            </tr>
        `).join('');

        document.querySelectorAll('.edit-btn').forEach((btn) => {
            btn.addEventListener('click', () => openModal(btn.dataset.id));
        });
        document.querySelectorAll('.delete-btn').forEach((btn) => {
            btn.addEventListener('click', () => removeEntry(btn.dataset.id));
        });
    }

    function renderGrid() {
        const grid = getById('municipalTaxGridSection');
        if (!grid) return;

        if (filteredEntries.length === 0) {
            grid.innerHTML = '<div class="col-span-full text-center py-8 text-sm text-gray-500 dark:text-gray-400 border-2 border-dashed border-gray-200 dark:border-slate-700 rounded-lg">Nenhuma referência encontrada.</div>';
            return;
        }

        grid.innerHTML = filteredEntries.map((item) => `
            <div class="bg-white dark:bg-slate-800 shadow rounded-lg p-5 flex flex-col border border-gray-100 dark:border-slate-700">
                <h4 class="text-lg font-bold text-gray-900 dark:text-gray-100">${escapeHtml(item.referenceName)}</h4>
                <p class="mt-2 text-sm text-gray-600 dark:text-gray-300">Tributação: <strong>${escapeHtml(item.issqnTaxation)}</strong></p>
                <p class="text-sm text-gray-600 dark:text-gray-300">Regime: <strong>${escapeHtml(item.specialTaxRegime)}</strong></p>
                <p class="text-sm text-gray-600 dark:text-gray-300">Alíquota: <strong>${formatPercent(item.issqnRate)}</strong></p>
                <p class="text-sm text-gray-600 dark:text-gray-300">BC ISSQN: <strong>${formatCurrency(item.issqnBase)}</strong></p>
                <p class="text-sm text-gray-600 dark:text-gray-300">Valor ISSQN: <strong>${formatCurrency(item.issqnValue)}</strong></p>
                <div class="mt-4 pt-3 border-t border-gray-100 dark:border-slate-700 flex justify-end gap-2">
                    <button type="button" title="Editar" class="text-brand-600 hover:bg-brand-50 p-1.5 rounded-full dark:hover:bg-brand-900/30 edit-btn" data-id="${item.id}">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                    </button>
                    <button type="button" title="Excluir" class="text-red-500 hover:bg-red-50 p-1.5 rounded-full dark:hover:bg-red-900/30 delete-btn" data-id="${item.id}">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>
                </div>
            </div>
        `).join('');

        document.querySelectorAll('#municipalTaxGridSection .edit-btn').forEach((btn) => {
            btn.addEventListener('click', () => openModal(btn.dataset.id));
        });
        document.querySelectorAll('#municipalTaxGridSection .delete-btn').forEach((btn) => {
            btn.addEventListener('click', () => removeEntry(btn.dataset.id));
        });
    }

    function applyFilters() {
        const search = String(getById('filterSearch')?.value || '').trim().toLowerCase();
        filteredEntries = entries.filter((item) => {
            if (!search) return true;
            return String(item.referenceName || '').toLowerCase().includes(search)
                || String(item.issqnTaxation || '').toLowerCase().includes(search)
                || String(item.specialTaxRegime || '').toLowerCase().includes(search);
        });

        renderTable();
        renderGrid();
        updateResultsFooter();
    }

    function renderAll() {
        applyFilters();
        updateViewToggle();
    }

    function handleSubmit(event) {
        event.preventDefault();
        const data = collectFormData();

        if (!data.referenceName) {
            showAlert('Informe a referência.', 'error');
            getById('referenceName')?.focus();
            return;
        }

        if (data.id) {
            entries = entries.map((item) => String(item.id) === String(data.id) ? data : item);
            showAlert('Referência atualizada com sucesso!', 'success');
        } else {
            data.id = (window.crypto && window.crypto.randomUUID)
                ? window.crypto.randomUUID()
                : `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
            entries.push(data);
            showAlert('Referência cadastrada com sucesso!', 'success');
        }

        saveEntries();
        closeModal();
        renderAll();
    }

    function resetFormFields() {
        fillForm({});
    }

    document.addEventListener('DOMContentLoaded', () => {
        if (!Auth.isAuthenticated()) {
            window.location.href = '/';
            return;
        }

        loadEntries();
        migrateLegacyForm();
        filteredEntries = [...entries];

        getById('btnOpenModal')?.addEventListener('click', () => openModal());
        getById('btnCancelModal')?.addEventListener('click', closeModal);
        getById('modalBackdrop')?.addEventListener('click', closeModal);
        getById('municipalTaxForm')?.addEventListener('submit', handleSubmit);
        getById('btnResetMunicipalTax')?.addEventListener('click', resetFormFields);
        getById('filterSearch')?.addEventListener('input', applyFilters);

        getById('btnListView')?.addEventListener('click', () => {
            currentView = 'list';
            localStorage.setItem(VIEW_STORAGE_KEY, 'list');
            updateViewToggle();
        });
        getById('btnGridView')?.addEventListener('click', () => {
            currentView = 'grid';
            localStorage.setItem(VIEW_STORAGE_KEY, 'grid');
            updateViewToggle();
        });

        renderAll();
    });
})();
