const tableTranslations = {
    'accounting_auto_template_items': 'Itens de Modelo Automático de Contabilidade',
    'accounting_auto_templates': 'Modelos Automáticos de Contabilidade',
    'accounting_entries': 'Lançamentos Contábeis',
    'accounting_histories': 'Histórico de Contabilidade',
    'audit_logs': 'Logs de Auditoria',
    'auditoria_operacoes': 'Auditoria de Operações',
    'bank_accounts': 'Contas Bancárias',
    'categories': 'Categorias',
    'chart_of_accounts': 'Plano de Contas',
    'companies': 'Empresas',
    'contacts': 'Contatos',
    'contas': 'Contas',
    'controle_mei': 'Controle MEI',
    'controle_presumido': 'Controle Lucro Presumido',
    'controle_real': 'Controle Lucro Real',
    'controle_simples': 'Controle Simples Nacional',
    'customer_declarations': 'Declarações de Clientes',
    'customers': 'Clientes',
    'declaration_types': 'Tipos de Declaração',
    'email_config': 'Configuração de E-mail',
    'faturamento_dia': 'Faturamento Diário',
    'ibge_cities': 'Cidades IBGE',
    'ibge_states': 'Estados IBGE',
    'inventory_movements': 'Movimentações de Estoque',
    'manufacturers': 'Fabricantes',
    'measures': 'Unidades de Medida',
    'organizer_states': 'Estados Organizador',
    'pagamentos': 'Pagamentos',
    'pessoa_fisica': 'Pessoa Física',
    'pessoa_juridica': 'Pessoa Jurídica',
    'price_tables': 'Tabelas de Preços',
    'product_categories': 'Categorias de Produtos',
    'products': 'Produtos',
    'purchase_items': 'Itens de Compra',
    'purchase_orders': 'Pedidos de Compra',
    'recebimentos': 'Recebimentos',
    'role_permissions': 'Permissões de Cargos',
    'roles': 'Cargos',
    'sales_items': 'Itens de Venda',
    'sales_orders': 'Pedidos de Venda',
    'schema_migrations': 'Migrações do Banco de Dados',
    'sefaz_jobs': 'Processos da SEFAZ',
    'service_launches': 'Lançamentos de Serviços',
    'service_types': 'Tipos de Serviço',
    'services': 'Serviços',
    'stock_types': 'Tipos de Estoque',
    'suppliers': 'Fornecedores',
    'tasks': 'Tarefas',
    'tax_rules': 'Regras Tributárias',
    'transactions': 'Transações Financeiras',
    'ui_preferences': 'Preferências de Interface',
    'users': 'Usuários',
    'usuarios': 'Usuários Legados',
    'whatsapp_business_messages': 'Mensagens do WhatsApp Business',
    'whatsapp_business_phone_aliases': 'Aliases de Telefones do WhatsApp',
    'whatsapp_business_sessions': 'Sessões do WhatsApp Business',
    'whatsapp_jobs': 'Processos do WhatsApp'
};
function getTableDisplayName(table) {
    const translation = tableTranslations[table];
    return translation ? `(${table}) (${translation})` : `(${table})`;
}
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Página Backup e Restaurar carregada.');
    // --- ELEMENTOS DE BACKUP ---
    const startBackupBtn = document.getElementById('startBackupBtn');
    const backupProgressContainer = document.getElementById('backupProgressContainer');
    const backupProgressBar = document.getElementById('backupProgressBar');
    const backupProgressText = document.getElementById('backupProgressText');
    const backupSuccessContainer = document.getElementById('backupSuccessContainer');
    const backupDesc = document.getElementById('backupDesc');
    const downloadBackupBtn = document.getElementById('downloadBackupBtn');
    const backupTablesContainer = document.getElementById('backupTablesContainer');
    const selectAllBackup = document.getElementById('selectAllBackup');
    // Carregar tabelas do banco de dados na inicialização
    const loadBackupTables = async () => {
        try {
            // @ts-ignore
            const token = window.Auth?.getToken();
            const response = await fetch('/api/v1/backup/tables', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (!response.ok) {
                throw new Error('Falha ao carregar lista de tabelas do sistema.');
            }
            const data = await response.json();
            const tables = data.tables || [];
            if (backupTablesContainer) {
                if (tables.length === 0) {
                    backupTablesContainer.innerHTML = '<p class="text-xs text-gray-400 dark:text-gray-500 col-span-full">Nenhuma tabela encontrada no sistema.</p>';
                    return;
                }
                backupTablesContainer.innerHTML = tables.map(table => `
                    <label class="flex items-center space-x-2 text-xs text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700 p-1.5 rounded transition">
                        <input type="checkbox" checked value="${table}" class="table-backup-checkbox rounded border-gray-300 dark:border-slate-600 text-brand-600 focus:ring-brand-500 bg-white dark:bg-slate-800" />
                        <span class="truncate">${getTableDisplayName(table)}</span>
                    </label>
                `).join('');
                // Atualizar o checkbox "Selecionar Todas" de backup quando um checkbox individual mudar
                const checkBoxes = backupTablesContainer.querySelectorAll('.table-backup-checkbox');
                checkBoxes.forEach(cb => {
                    cb.addEventListener('change', () => {
                        if (selectAllBackup) {
                            const allChecked = Array.from(checkBoxes).every(c => c.checked);
                            const noneChecked = Array.from(checkBoxes).every(c => !c.checked);
                            selectAllBackup.checked = allChecked;
                            selectAllBackup.indeterminate = !allChecked && !noneChecked;
                        }
                    });
                });
            }
        }
        catch (error) {
            console.error('Erro ao carregar tabelas do sistema:', error);
            if (backupTablesContainer) {
                backupTablesContainer.innerHTML = '<p class="text-xs text-red-500 col-span-full">Erro ao carregar tabelas.</p>';
            }
        }
    };
    // Chamar função de listagem de backup
    await loadBackupTables();
    // Evento do checkbox de selecionar todos no backup
    if (selectAllBackup) {
        selectAllBackup.addEventListener('change', () => {
            const checkBoxes = document.querySelectorAll('.table-backup-checkbox');
            checkBoxes.forEach(cb => {
                cb.checked = selectAllBackup.checked;
            });
        });
    }
    if (startBackupBtn) {
        startBackupBtn.addEventListener('click', async () => {
            // Obter tabelas selecionadas
            const selectedTables = [];
            const checkBoxes = document.querySelectorAll('.table-backup-checkbox');
            checkBoxes.forEach(cb => {
                if (cb.checked)
                    selectedTables.push(cb.value);
            });
            if (selectedTables.length === 0) {
                alert('Por favor, selecione pelo menos uma tabela para incluir no backup.');
                return;
            }
            // Iniciar backup
            startBackupBtn.disabled = true;
            startBackupBtn.innerHTML = `
                <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processando arquivo .ZIP...
            `;
            if (backupDesc)
                backupDesc.classList.add('hidden');
            if (backupProgressContainer)
                backupProgressContainer.classList.remove('hidden');
            if (backupProgressBar)
                backupProgressBar.style.width = '50%';
            if (backupProgressText)
                backupProgressText.textContent = "Baixando dados do servidor...";
            try {
                // @ts-ignore
                const token = window.Auth?.getToken();
                const response = await fetch(`/api/v1/backup?tables=${encodeURIComponent(selectedTables.join(','))}`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                if (!response.ok) {
                    throw new Error('Falha ao gerar backup. Permissão negada ou erro interno.');
                }
                if (backupProgressBar)
                    backupProgressBar.style.width = '90%';
                if (backupProgressText)
                    backupProgressText.textContent = "Finalizando download...";
                const blob = await response.blob();
                const downloadUrl = URL.createObjectURL(blob);
                const dateStr = new Date().toISOString().split('T')[0];
                const filename = `backup-keystone-${dateStr}.zip`;
                if (downloadBackupBtn) {
                    downloadBackupBtn.href = downloadUrl;
                    downloadBackupBtn.download = filename;
                }
                if (backupProgressBar)
                    backupProgressBar.style.width = '100%';
                if (backupProgressText)
                    backupProgressText.textContent = "Concluído!";
                setTimeout(() => {
                    if (backupProgressContainer)
                        backupProgressContainer.classList.add('hidden');
                    if (startBackupBtn) {
                        startBackupBtn.classList.add('hidden');
                        startBackupBtn.innerHTML = 'Iniciar Backup Agora';
                        startBackupBtn.disabled = false;
                    }
                    if (backupSuccessContainer)
                        backupSuccessContainer.classList.remove('hidden');
                }, 800);
            }
            catch (error) {
                console.error('Erro no backup:', error);
                alert('Ocorreu um erro ao gerar o backup: ' + (error instanceof Error ? error.message : String(error)));
                startBackupBtn.disabled = false;
                startBackupBtn.innerHTML = 'Iniciar Backup Agora';
                if (backupProgressContainer)
                    backupProgressContainer.classList.add('hidden');
                if (backupDesc)
                    backupDesc.classList.remove('hidden');
            }
        });
    }
    // --- LÓGICA DE RESTAURAÇÃO ---
    const restoreFileInput = document.getElementById('restoreFileInput');
    const startRestoreBtn = document.getElementById('startRestoreBtn');
    const restoreProgressContainer = document.getElementById('restoreProgressContainer');
    const restoreProgressBar = document.getElementById('restoreProgressBar');
    const restoreProgressText = document.getElementById('restoreProgressText');
    const restoreSuccessContainer = document.getElementById('restoreSuccessContainer');
    const restoreDesc = document.getElementById('restoreDesc');
    const restoreTablesSelectionSection = document.getElementById('restoreTablesSelectionSection');
    const restoreTablesContainer = document.getElementById('restoreTablesContainer');
    const selectAllRestore = document.getElementById('selectAllRestore');
    // Atualizar o estado habilitado/desabilitado do botão Restaurar
    const updateRestoreBtnState = () => {
        if (!restoreFileInput.files || restoreFileInput.files.length === 0) {
            startRestoreBtn.disabled = true;
            return;
        }
        const checkedBoxes = document.querySelectorAll('.table-restore-checkbox:checked');
        startRestoreBtn.disabled = checkedBoxes.length === 0;
    };
    if (restoreFileInput && startRestoreBtn) {
        restoreFileInput.addEventListener('change', async () => {
            if (restoreFileInput.files && restoreFileInput.files.length > 0) {
                const file = restoreFileInput.files[0];
                // Mostrar a seção e animação de carregamento
                if (restoreTablesSelectionSection)
                    restoreTablesSelectionSection.classList.remove('hidden');
                if (restoreTablesContainer) {
                    restoreTablesContainer.innerHTML = '<p class="text-xs text-gray-400 dark:text-gray-500 col-span-full">Analisando conteúdo do arquivo zip...</p>';
                }
                startRestoreBtn.disabled = true;
                const formData = new FormData();
                formData.append('file', file);
                try {
                    // @ts-ignore
                    const token = window.Auth?.getToken();
                    const response = await fetch('/api/v1/backup/restore/list', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`
                        },
                        body: formData
                    });
                    if (!response.ok) {
                        throw new Error('Falha ao processar o arquivo zip para listar tabelas.');
                    }
                    const data = await response.json();
                    const tables = data.tables || [];
                    if (restoreTablesContainer) {
                        if (tables.length === 0) {
                            restoreTablesContainer.innerHTML = '<p class="text-xs text-red-500 col-span-full">Nenhuma tabela .csv encontrada no arquivo de backup.</p>';
                            return;
                        }
                        restoreTablesContainer.innerHTML = tables.map(table => `
                            <label class="flex items-center space-x-2 text-xs text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700 p-1.5 rounded transition">
                                <input type="checkbox" checked value="${table}" class="table-restore-checkbox rounded border-gray-300 dark:border-slate-600 text-red-600 focus:ring-red-500 bg-white dark:bg-slate-800" />
                                <span class="truncate">${getTableDisplayName(table)}</span>
                            </label>
                        `).join('');
                        // Ouvir alterações nos checkboxes individuais de restauração
                        const checkBoxes = restoreTablesContainer.querySelectorAll('.table-restore-checkbox');
                        checkBoxes.forEach(cb => {
                            cb.addEventListener('change', () => {
                                if (selectAllRestore) {
                                    const allChecked = Array.from(checkBoxes).every(c => c.checked);
                                    const noneChecked = Array.from(checkBoxes).every(c => !c.checked);
                                    selectAllRestore.checked = allChecked;
                                    selectAllRestore.indeterminate = !allChecked && !noneChecked;
                                }
                                updateRestoreBtnState();
                            });
                        });
                    }
                    if (selectAllRestore) {
                        selectAllRestore.checked = true;
                        selectAllRestore.indeterminate = false;
                    }
                    updateRestoreBtnState();
                }
                catch (error) {
                    console.error('Erro ao listar tabelas do zip:', error);
                    if (restoreTablesContainer) {
                        restoreTablesContainer.innerHTML = '<p class="text-xs text-red-500 col-span-full">Erro ao carregar conteúdo do backup.</p>';
                    }
                    startRestoreBtn.disabled = true;
                }
            }
            else {
                if (restoreTablesSelectionSection)
                    restoreTablesSelectionSection.classList.add('hidden');
                startRestoreBtn.disabled = true;
            }
        });
        // Evento do checkbox "Selecionar Todas" na restauração
        if (selectAllRestore) {
            selectAllRestore.addEventListener('change', () => {
                const checkBoxes = document.querySelectorAll('.table-restore-checkbox');
                checkBoxes.forEach(cb => {
                    cb.checked = selectAllRestore.checked;
                });
                updateRestoreBtnState();
            });
        }
        startRestoreBtn.addEventListener('click', async () => {
            const file = restoreFileInput.files?.[0];
            if (!file)
                return;
            // Obter tabelas selecionadas para restaurar
            const selectedTables = [];
            const checkBoxes = document.querySelectorAll('.table-restore-checkbox');
            checkBoxes.forEach(cb => {
                if (cb.checked)
                    selectedTables.push(cb.value);
            });
            if (selectedTables.length === 0) {
                alert('Por favor, selecione pelo menos uma tabela para restaurar.');
                return;
            }
            const confirmRestore = confirm("ATENÇÃO: Você está prestes a substituir todos os dados das tabelas selecionadas no sistema pelo conteúdo deste backup. Esta operação não pode ser desfeita. Deseja continuar?");
            if (!confirmRestore)
                return;
            startRestoreBtn.disabled = true;
            startRestoreBtn.innerHTML = `
                <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Restaurando...
            `;
            if (restoreDesc)
                restoreDesc.classList.add('hidden');
            if (restoreFileInput)
                restoreFileInput.classList.add('hidden');
            if (restoreTablesSelectionSection)
                restoreTablesSelectionSection.classList.add('hidden');
            if (restoreProgressContainer)
                restoreProgressContainer.classList.remove('hidden');
            if (restoreProgressBar)
                restoreProgressBar.style.width = '30%';
            if (restoreProgressText)
                restoreProgressText.textContent = "Enviando arquivo ZIP para o servidor...";
            const formData = new FormData();
            formData.append('file', file);
            formData.append('tables', selectedTables.join(','));
            try {
                // @ts-ignore
                const token = window.Auth?.getToken();
                const response = await fetch('/api/v1/backup/restore', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    },
                    body: formData
                });
                if (!response.ok) {
                    const errorMsg = await response.text();
                    throw new Error(errorMsg || 'Falha ao restaurar backup.');
                }
                if (restoreProgressBar)
                    restoreProgressBar.style.width = '100%';
                if (restoreProgressText)
                    restoreProgressText.textContent = "Concluído!";
                setTimeout(() => {
                    if (restoreProgressContainer)
                        restoreProgressContainer.classList.add('hidden');
                    if (startRestoreBtn) {
                        startRestoreBtn.classList.add('hidden');
                        startRestoreBtn.innerHTML = 'Restaurar Agora';
                        startRestoreBtn.disabled = false;
                    }
                    if (restoreSuccessContainer)
                        restoreSuccessContainer.classList.remove('hidden');
                }, 800);
            }
            catch (error) {
                console.error('Erro na restauração:', error);
                alert('Ocorreu um erro ao restaurar: ' + (error instanceof Error ? error.message : String(error)));
                startRestoreBtn.disabled = false;
                startRestoreBtn.innerHTML = 'Restaurar Agora';
                if (restoreProgressContainer)
                    restoreProgressContainer.classList.add('hidden');
                if (restoreDesc)
                    restoreDesc.classList.remove('hidden');
                if (restoreFileInput)
                    restoreFileInput.classList.remove('hidden');
                if (restoreTablesSelectionSection)
                    restoreTablesSelectionSection.classList.remove('hidden');
            }
        });
    }
});
