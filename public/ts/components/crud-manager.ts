/**
 * crud-manager.js
 * Fábrica central para gerenciar páginas de CRUD com Listagem/Grid,
 * chamadas à API, buscas, e renderizações automáticas.
 */
class CrudManager {
    [key: string]: any;
    constructor(config) {
        this.entityName = config.entityName || 'Registro';
        this.endpoint = config.endpoint;
        
        // Custom Callbacks
        this.renderTableFn = config.renderTable;
        this.renderGridFn = config.renderGrid;
        this.applyFiltersFn = config.applyFilters;
        this.onEdit = config.onEdit;
        this.onDuplicate = config.onDuplicate;
        this.onDelete = config.onDelete;
        
        // Element IDs
        this.tableId = config.tableId || `${this.entityName.toLowerCase()}Table`;
        this.gridSectionId = config.gridSectionId || `${this.entityName.toLowerCase()}GridSection`;
        this.tableSectionId = config.tableSectionId || `${this.entityName.toLowerCase()}Section`;
        this.modalId = config.modalId || `${this.entityName.toLowerCase()}Modal`;
        this.disableSummaryFooter = config.disableSummaryFooter || false;
        
        // State
        this.data = [];
        this.storageKey = `${this.entityName.toLowerCase()}_view`;
        this.currentView = localStorage.getItem(this.storageKey) || 'list';
        
        // Filtros
        this.filterConfig = config.filterConfig;
    }

    async init() {
        this._setupViewToggles();
        this._setupModals();
        
        const filterPanel = window.FilterPanel;

        if (this.filterConfig && filterPanel && typeof filterPanel.mount === 'function') {
            filterPanel.mount(this.filterConfig);

            // Auto bind event listeners to inputs
            (this.filterConfig.fields || []).forEach((f: any) => {
                const el = document.getElementById(f.id);
                if (el) {
                    el.addEventListener(f.type === 'select' ? 'change' : 'input', () => this.applyFilters());
                }
            });
        }
        await this.loadData();
    }
    
    async loadData() {
        try {
            const response = await api(this.endpoint);
            this.data = response.data || [];
            this.applyFilters();
        } catch (error) {
            console.error(`Falha ao carregar ${this.entityName}`, error);
            if (typeof UI !== 'undefined' && UI.showAlert) {
                UI.showAlert('alertMessage', 'Erro ao carregar dados. Verifique a conexão.');
            } else {
                console.warn('Erro ao carregar dados. Verifique a conexão.');
            }
        }
    }

    applyFilters() {
        const filterPanel = window.FilterPanel;
        const searchInput = document.getElementById('filterSearch') as HTMLInputElement | null;
        const rawSearch = searchInput?.value ?? '';

        const search = (filterPanel && typeof filterPanel.normalizeText === 'function')
            ? String(filterPanel.normalizeText(rawSearch) || '')
            : String(rawSearch || '').trim().toLowerCase();

        let filtered = this.data;

        if (this.applyFiltersFn) {
            filtered = this.applyFiltersFn(this.data);
        } else if (search) {
            if (filterPanel && typeof filterPanel.matchesSearch === 'function') {
                filtered = this.data.filter((item: any) => filterPanel.matchesSearch(item, ['name', 'description'], search));
            } else {
                filtered = this.data.filter((item: any) => {
                    const text = [item.name, item.description]
                        .map((v: any) => String(v || '').trim().toLowerCase())
                        .join(' ');
                    return text.includes(search);
                });
            }
        }
        
        if (this.renderTableFn) this.renderTableFn(filtered);
        if (this.renderGridFn) this.renderGridFn(filtered);
        
        if (window.GridSummaryFooter && !this.disableSummaryFooter) {
            window.GridSummaryFooter.update({
                footerId: this.filterConfig?.footerId || `${this.entityName.toLowerCase()}ResultsFooter`,
                anchorId: this.gridSectionId,
                count: filtered.length,
                label: `registro(s) exibido(s)`
            });
        }
        
        this._bindActionEvents();
    }
    
    _bindActionEvents() {
        document.querySelectorAll('.edit-btn').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                const target = e.currentTarget as HTMLElement;
                const id = target.getAttribute('data-id');
                const rawItem = target.getAttribute('data-item');
                const item = rawItem ? JSON.parse(rawItem) : this.data.find((x: any) => x.public_id === id);
                if (this.onEdit) this.onEdit(item);
            });
        });

        document.querySelectorAll('.duplicate-btn').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                const target = e.currentTarget as HTMLElement;
                const id = target.getAttribute('data-id');
                const rawItem = target.getAttribute('data-item');
                let item = rawItem ? JSON.parse(rawItem) : this.data.find((x: any) => x.public_id === id);
                item = { ...item, public_id: '' };
                if (this.onDuplicate) {
                    this.onDuplicate(item);
                } else if (this.onEdit) {
                    this.onEdit(item); // Fallback: duplicate just opens edit without ID
                }
            });
        });

        document.querySelectorAll('.delete-btn').forEach((btn) => {
            btn.addEventListener('click', async (e) => {
                if (confirm('Deseja realmente excluir este registro?')) {
                    const target = e.currentTarget as HTMLElement;
                    const id = target.getAttribute('data-id');
                    if (this.onDelete) {
                        await this.onDelete(id);
                    } else {
                        try {
                            await api(`${this.endpoint}/${id}`, { method: 'DELETE' });
                            if (typeof UI !== 'undefined' && UI.showAlert) {
                                UI.showAlert('alertMessage', 'Registro excluído com sucesso!', 'success');
                            }
                            await this.loadData();
                        } catch (error: any) {
                            alert('Erro ao excluir: ' + (error?.message || String(error)));
                        }
                    }
                }
            });
        });

        // Select All Logic Setup
        const selectAllBtn = document.getElementById('selectAll') as HTMLInputElement | null;
        if (selectAllBtn && selectAllBtn.parentNode) {
            const newSelectAll = selectAllBtn.cloneNode(true) as HTMLInputElement;
            selectAllBtn.parentNode.replaceChild(newSelectAll, selectAllBtn);

            newSelectAll.addEventListener('change', (e) => {
                const checkbox = e.currentTarget as HTMLInputElement;
                document.querySelectorAll<HTMLInputElement>('.item-checkbox').forEach((cb) => {
                    cb.checked = checkbox.checked;
                });
            });

            document.querySelectorAll<HTMLInputElement>('.item-checkbox').forEach((cb) => {
                cb.addEventListener('change', () => {
                    if (!cb.checked) newSelectAll.checked = false;
                });
            });
        }
    }
    
    _setupViewToggles() {
        const btnList = document.getElementById('btnListView');
        const btnGrid = document.getElementById('btnGridView');
        
        if (btnList) {
            btnList.addEventListener('click', () => {
                this.currentView = 'list';
                localStorage.setItem(this.storageKey, 'list');
                this._updateViewToggleUI();
            });
        }

        if (btnGrid) {
            btnGrid.addEventListener('click', () => {
                this.currentView = 'grid';
                localStorage.setItem(this.storageKey, 'grid');
                this._updateViewToggleUI();
            });
        }

        this._updateViewToggleUI();
    }
    
    _updateViewToggleUI() {
        const btnList = document.getElementById('btnListView');
        const btnGrid = document.getElementById('btnGridView');
        const tableSection = document.getElementById(this.tableSectionId);
        const gridSection = document.getElementById(this.gridSectionId);

        if (!btnList || !btnGrid || !tableSection || !gridSection) return;

        const activeClasses = "flex items-center justify-center px-3 py-1.5 rounded-lg bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 shadow-sm transition-all focus:outline-none gap-1";
        const inactiveClasses = "flex items-center justify-center px-3 py-1.5 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-all focus:outline-none gap-1";

        btnList.className = inactiveClasses;
        btnGrid.className = inactiveClasses;
        btnList.querySelector('.check-icon')?.classList.add('hidden');
        btnGrid.querySelector('.check-icon')?.classList.add('hidden');

        if (this.currentView === 'list') {
            btnList.className = activeClasses;
            btnList.querySelector('.check-icon')?.classList.remove('hidden');
            tableSection.style.display = '';
            tableSection.classList.remove('hidden');
            gridSection.style.display = 'none';
            gridSection.classList.add('hidden');
        } else {
            btnGrid.className = activeClasses;
            btnGrid.querySelector('.check-icon')?.classList.remove('hidden');
            tableSection.style.display = 'none';
            tableSection.classList.add('hidden');
            gridSection.style.display = '';
            gridSection.classList.remove('hidden');
        }
    }
    
    _setupModals() {
        const btnOpen = document.getElementById('btnOpenModal');
        if (btnOpen) {
            btnOpen.addEventListener('click', () => {
                if (this.onEdit) this.onEdit(null); // Pass null to signify new creation
            });
        }

        const btnCancel = document.getElementById('btnCancelModal');
        if (btnCancel) {
            btnCancel.addEventListener('click', () => this.closeModal());
        }

        const backdrop = document.getElementById('modalBackdrop');
        if (backdrop) {
            backdrop.addEventListener('click', (e) => {
                if (e.target === backdrop) this.closeModal();
            });
        }
    }
    
    closeModal() {
        const modal = document.getElementById(this.modalId);
        if (modal) modal.classList.add('hidden');
    }
}
window.CrudManager = CrudManager;
