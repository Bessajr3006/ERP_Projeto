(() => {
window.initUserRoleDirectory({
    role: 'service_provider',
    moduleId: 'service_providers',
    singularLabel: 'Prestador de Serviço',
    pluralLabel: 'Prestadores de Serviço',
    singularLower: 'prestador de serviço',
    pluralLower: 'prestadores de serviço',
    summaryLabel: 'prestador(es) de serviço exibido(s)',
    badgeClass: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300',
    viewStorageKey: 'serviceProvidersView',
    filterStorageKey: 'service_providers_filter_panel',
    pageTitle: 'Prestadores de Serviço',
    tableId: 'serviceProvidersTable',
    gridSectionId: 'serviceProvidersGridSection',
    tableSectionId: 'serviceProvidersSection',
    resultsFooterId: 'serviceProvidersResultsFooter',
    createdMessage: 'Prestador de serviço cadastrado com sucesso!',
    updatedMessage: 'Prestador de serviço atualizado com sucesso!',
    toggledMessage(active) {
        return `Prestador de serviço ${active ? 'ativado' : 'desativado'} com sucesso!`;
    },
});
})();
