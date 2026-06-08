(() => {
(window as any).initUserRoleDirectory({
    role: 'buyer',
    moduleId: 'buyers',
    singularLabel: 'Comprador',
    pluralLabel: 'Compradores',
    singularLower: 'comprador',
    pluralLower: 'compradores',
    summaryLabel: 'comprador(es) exibido(s)',
    badgeClass: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
    viewStorageKey: 'buyersView',
    filterStorageKey: 'buyers_filter_panel',
    pageTitle: 'Compradores',
    tableId: 'buyersTable',
    gridSectionId: 'buyersGridSection',
    tableSectionId: 'buyersSection',
    resultsFooterId: 'buyersResultsFooter',
    createdMessage: 'Comprador cadastrado com sucesso!',
    updatedMessage: 'Comprador atualizado com sucesso!',
    toggledMessage(active: boolean) {
        return `Comprador ${active ? 'ativado' : 'desativado'} com sucesso!`;
    },
});
})();
