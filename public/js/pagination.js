/**
 * Paginator — utilitário de paginação client-side reutilizável
 *
 * Uso:
 *   const pager = new Paginator({
 *     containerId : 'paginationContainer',   // elemento onde o controle é renderizado
 *     pageSize    : 20,                       // itens por página (padrão 20)
 *     onChange    : (pageItems, state) => { renderTable(pageItems); }
 *   });
 *
 *   pager.setData(fullArray);   // chama onChange automaticamente para a pg 1
 *   pager.currentPage           // página atual (1-based)
 *   pager.totalItems            // total de itens
 */
class Paginator {
    constructor({ containerId, pageSize = 20, onChange }) {
        if (!containerId || typeof onChange !== 'function') {
            throw new Error('Paginator: containerId e onChange são obrigatórios.');
        }
        this.containerId = containerId;
        this.pageSize = pageSize;
        this._onChange = onChange;
        this._data = [];
        this.currentPage = 1;
    }
    get totalItems() { return this._data.length; }
    get totalPages() { return Math.max(1, Math.ceil(this._data.length / this.pageSize)); }
    /** Substitui o dataset completo e vai para a página 1 */
    setData(data) {
        this._data = data || [];
        this.currentPage = 1;
        this._emit();
    }
    /** Vai para uma página específica */
    goTo(page) {
        page = Math.max(1, Math.min(page, this.totalPages));
        if (page === this.currentPage)
            return;
        this.currentPage = page;
        this._emit();
    }
    /** Retorna os itens da página atual */
    currentItems() {
        const start = (this.currentPage - 1) * this.pageSize;
        return this._data.slice(start, start + this.pageSize);
    }
    /** Dispara o callback e re-renderiza o controle */
    _emit() {
        this._onChange(this.currentItems(), {
            currentPage: this.currentPage,
            totalPages: this.totalPages,
            totalItems: this.totalItems,
            pageSize: this.pageSize,
        });
        this._render();
    }
    /** Renderiza o bloco de paginação no containerId */
    _render() {
        const container = document.getElementById(this.containerId);
        if (!container)
            return;
        const total = this.totalItems;
        const pages = this.totalPages;
        const current = this.currentPage;
        const start = Math.min((current - 1) * this.pageSize + 1, total);
        const end = Math.min(current * this.pageSize, total);
        // Se só há 1 página e menos de pageSize+1 itens, esconde o controle
        if (pages <= 1 && total <= this.pageSize) {
            container.innerHTML = '';
            return;
        }
        const btn = (label, page, disabled = false, active = false) => `
            <button
                ${disabled ? 'disabled' : ''}
                data-page="${page}"
                class="paginator-btn inline-flex items-center justify-center min-w-8 h-8 px-2 rounded text-xs font-medium transition-colors
                    ${active
            ? 'bg-brand-600 text-white shadow-sm cursor-default pointer-events-none'
            : disabled
                ? 'text-gray-300 dark:text-slate-600 cursor-not-allowed'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 cursor-pointer'}"
            >${label}</button>`;
        // Algoritmo de janela de páginas (máx 7 botões visíveis)
        const pageButtons = [];
        const range = (from, to) => {
            for (let i = from; i <= to; i++)
                pageButtons.push(i);
        };
        if (pages <= 7) {
            range(1, pages);
        }
        else if (current <= 4) {
            range(1, 5);
            pageButtons.push('...');
            pageButtons.push(pages);
        }
        else if (current >= pages - 3) {
            pageButtons.push(1);
            pageButtons.push('...');
            range(pages - 4, pages);
        }
        else {
            pageButtons.push(1);
            pageButtons.push('...');
            range(current - 1, current + 1);
            pageButtons.push('...');
            pageButtons.push(pages);
        }
        const pagesBtns = pageButtons.map(p => {
            if (p === '...') {
                return `<span class="inline-flex items-center justify-center min-w-8 h-8 px-1 text-xs text-gray-400 dark:text-slate-500">…</span>`;
            }
            return btn(p, p, false, p === current);
        }).join('');
        container.innerHTML = `
            <div class="flex items-center justify-between gap-2 flex-wrap py-2">
                <span class="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    Exibindo <span class="font-medium text-gray-700 dark:text-gray-200">${start}–${end}</span>
                    de <span class="font-medium text-gray-700 dark:text-gray-200">${total}</span>
                </span>
                <div class="flex items-center gap-1 flex-wrap">
                    ${btn('‹', current - 1, current === 1)}
                    ${pagesBtns}
                    ${btn('›', current + 1, current === pages)}
                </div>
            </div>`;
        // Eventos
        container.querySelectorAll('.paginator-btn:not([disabled])').forEach((b) => {
            const button = b;
            button.addEventListener('click', () => this.goTo(Number(button.dataset.page)));
        });
    }
}
// Exporta globalmente para uso sem bundler
window.Paginator = Paginator;
