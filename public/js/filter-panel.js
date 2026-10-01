(function initFilterPanelHelper() {
    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
    function normalizeText(value) {
        return String(value ?? '').trim().toLowerCase();
    }
    function onlyDigits(value) {
        return String(value ?? '').replace(/\D/g, '');
    }
    function resolveValue(item, resolver) {
        if (typeof resolver === 'function')
            return resolver(item);
        if (typeof resolver !== 'string')
            return '';
        return resolver.split('.').reduce((acc, key) => {
            if (acc == null)
                return '';
            return acc[key];
        }, item);
    }
    function matchesSearch(item, resolvers, term) {
        const normalizedTerm = normalizeText(term);
        if (!normalizedTerm)
            return true;
        const haystack = (resolvers || [])
            .map((resolver) => normalizeText(resolveValue(item, resolver)))
            .join(' ');
        return haystack.includes(normalizedTerm);
    }
    function buildFieldMarkup(field, savedValue) {
        const label = escapeHtml(field.label || 'Filtro');
        const baseClass = 'block w-full bg-gray-50 dark:bg-slate-900/60 border border-gray-200 dark:border-slate-600 rounded-lg py-2 px-3 text-sm min-h-[42px] focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500 dark:text-white transition-colors';
        if (field.type === 'select') {
            const options = (field.options || [])
                .map((option) => {
                const isSelected = option.value === savedValue ? ' selected' : '';
                return `<option value="${escapeHtml(option.value)}"${isSelected}>${escapeHtml(option.label)}</option>`;
            })
                .join('');
            return `
                <div>
                    <label for="${escapeHtml(field.id)}" class="block text-[11px] text-gray-500 uppercase font-bold tracking-wider dark:text-gray-400 mb-1.5">${label}</label>
                    <select id="${escapeHtml(field.id)}" name="${escapeHtml(field.id)}" data-bwignore="true" data-lpignore="true" class="${baseClass}">
                        ${options}
                    </select>
                </div>
            `;
        }
        const type = escapeHtml(field.type || 'text');
        const placeholder = field.placeholder ? ` placeholder="${escapeHtml(field.placeholder)}"` : ' placeholder=""';
        const inputMode = field.inputMode ? ` inputmode="${escapeHtml(field.inputMode)}"` : '';
        const valueAttr = savedValue ? ` value="${escapeHtml(savedValue)}"` : '';
        return `
            <div>
                <label for="${escapeHtml(field.id)}" class="block text-[11px] text-gray-500 uppercase font-bold tracking-wider dark:text-gray-400 mb-1.5">${label}</label>
                <input type="${type}" id="${escapeHtml(field.id)}" name="${escapeHtml(field.id)}"${placeholder}${inputMode}${valueAttr} data-bwignore="true" data-lpignore="true" class="${baseClass}">
            </div>
        `;
    }
    function mount(config) {
        const afterElement = document.getElementById(config.afterElementId || 'alertMessage');
        if (!afterElement || !Array.isArray(config.fields) || config.fields.length === 0) {
            return null;
        }
        const panelId = config.panelId || `${config.storageKey || 'page'}-filter-panel`;
        const bodyId = `${panelId}-body`;
        const chevronId = `${panelId}-chevron`;
        const toggleId = `${panelId}-toggle`;
        const storageKey = `${config.storageKey || panelId}_open`;
        const gridClass = config.gridClass || 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 items-end';
        const valuesKey = config.storageKey ? `${config.storageKey}_values` : null;
        const savedValuesRaw = valuesKey ? (window.CompanyStorage?.getItem(valuesKey) ?? localStorage.getItem(valuesKey)) : null;
        const savedValues = savedValuesRaw ? JSON.parse(savedValuesRaw || '{}') : {};
        if (!document.getElementById(panelId)) {
            const fieldsHtml = config.fields.map((field) => {
                const savedValue = savedValues[field.id];
                return buildFieldMarkup(field, savedValue);
            }).join('');
            afterElement.insertAdjacentHTML('afterend', `
                <div id="${panelId}" class="px-4 sm:px-0 mb-4">
                    <div class="bg-white dark:bg-slate-800 shadow-sm rounded-xl border border-gray-200 dark:border-slate-700">
                        <button type="button" id="${toggleId}" class="w-full px-4 py-3 flex items-center justify-between min-h-11 hover:bg-gray-50 dark:hover:bg-slate-700/40 transition-colors rounded-xl">
                            <div class="flex items-center gap-2">
                                <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
                                </svg>
                                <h3 class="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">${escapeHtml(config.title || 'Filtro')}</h3>
                            </div>
                            <svg id="${chevronId}" class="w-4 h-4 text-gray-400 dark:text-gray-500 transition-transform duration-300 -rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>
                        <div id="${bodyId}" class="overflow-hidden" style="max-height: 0px; transition: max-height 0.3s ease, opacity 0.3s ease;">
                            <div class="border-t border-gray-100 dark:border-slate-700/60 px-4 py-3.5">
                                <div class="${gridClass}">
                                    ${fieldsHtml}
                                </div>
                                <div class="flex justify-end mt-3.5">
                                    <button type="button" id="${panelId}-clear" class="px-4 py-2 text-xs font-semibold min-h-9.5 inline-flex items-center justify-center text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 bg-gray-50 hover:bg-gray-100 dark:bg-slate-700 dark:hover:bg-slate-600 border border-gray-200 dark:border-slate-600 rounded-lg shadow-sm transition-colors cursor-pointer">
                                        Limpar Filtros
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `);
        }
        const body = document.getElementById(bodyId);
        const chevron = document.getElementById(chevronId);
        const toggle = document.getElementById(toggleId);
        if (!body || !chevron || !toggle)
            return null;
        const savedOpenState = window.CompanyStorage?.getItem(storageKey) ?? localStorage.getItem(storageKey);
        let isOpen = savedOpenState === null ? Boolean(config.defaultOpen) : savedOpenState === 'true';
        body.style.transition = 'none';
        body.style.maxHeight = isOpen ? `${body.scrollHeight}px` : '0px';
        chevron.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(-90deg)';
        requestAnimationFrame(() => {
            body.style.transition = 'max-height 0.3s ease, opacity 0.3s ease';
        });
        if (!toggle.dataset.filterBound) {
            toggle.addEventListener('click', () => {
                isOpen = !isOpen;
                if (window.CompanyStorage) {
                    window.CompanyStorage.setItem(storageKey, String(isOpen));
                }
                else {
                    localStorage.setItem(storageKey, String(isOpen));
                }
                body.style.maxHeight = isOpen ? `${body.scrollHeight}px` : '0px';
                chevron.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(-90deg)';
            });
            toggle.dataset.filterBound = 'true';
        }
        const clearBtn = document.getElementById(`${panelId}-clear`);
        if (clearBtn && !clearBtn.dataset.bound) {
            clearBtn.addEventListener('click', () => {
                config.fields.forEach((field) => {
                    const el = document.getElementById(field.id);
                    if (el) {
                        if (el instanceof HTMLSelectElement) {
                            el.selectedIndex = 0;
                            el.dispatchEvent(new Event('change'));
                        }
                        else if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
                            el.value = '';
                            el.dispatchEvent(new Event('input'));
                        }
                    }
                });
                if (config.storageKey) {
                    if (window.CompanyStorage) {
                        window.CompanyStorage.removeItem(`${config.storageKey}_values`);
                    }
                    else {
                        localStorage.removeItem(`${config.storageKey}_values`);
                    }
                }
            });
            clearBtn.dataset.bound = 'true';
        }
        // Auto-save values to localStorage if storageKey is configured
        if (config.storageKey && !toggle.dataset.saveListenersBound) {
            const saveValues = () => {
                const values = {};
                config.fields.forEach((field) => {
                    const el = document.getElementById(field.id);
                    if (el) {
                        values[field.id] = el.value || '';
                    }
                });
                if (window.CompanyStorage) {
                    window.CompanyStorage.setItem(`${config.storageKey}_values`, JSON.stringify(values));
                }
                else {
                    localStorage.setItem(`${config.storageKey}_values`, JSON.stringify(values));
                }
            };
            config.fields.forEach((field) => {
                const el = document.getElementById(field.id);
                if (el) {
                    el.addEventListener(field.type === 'select' ? 'change' : 'input', saveValues);
                }
            });
            toggle.dataset.saveListenersBound = 'true';
        }
        return {
            panelId,
            storageKey,
            fields: config.fields,
            getValues() {
                return config.fields.reduce((acc, field) => {
                    const el = document.getElementById(field.id);
                    acc[field.id] = el?.value || '';
                    return acc;
                }, {});
            },
        };
    }
    window.FilterPanel = {
        mount,
        normalizeText,
        onlyDigits,
        matchesSearch,
        resolveValue,
    };
})();
