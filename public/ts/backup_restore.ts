document.addEventListener('DOMContentLoaded', async () => {
    console.log('Página Backup e Restaurar carregada.');

    const startBackupBtn = document.getElementById('startBackupBtn') as HTMLButtonElement;
    const backupProgressContainer = document.getElementById('backupProgressContainer');
    const backupProgressBar = document.getElementById('backupProgressBar');
    const backupProgressText = document.getElementById('backupProgressText');
    const backupSuccessContainer = document.getElementById('backupSuccessContainer');
    const backupDesc = document.getElementById('backupDesc');
    const downloadBackupBtn = document.getElementById('downloadBackupBtn') as HTMLAnchorElement;

    if (startBackupBtn) {
        startBackupBtn.addEventListener('click', async () => {
            // Iniciar backup
            startBackupBtn.disabled = true;
            startBackupBtn.innerHTML = `
                <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processando arquivo .ZIP...
            `;
            
            if(backupDesc) backupDesc.classList.add('hidden');
            if(backupProgressContainer) backupProgressContainer.classList.remove('hidden');

            if(backupProgressBar) backupProgressBar.style.width = '50%';
            if(backupProgressText) backupProgressText.textContent = "Baixando dados do servidor...";

            try {
                // @ts-ignore
                const token = (window as any).Auth?.getToken();
                const response = await fetch('/api/v1/backup', { 
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                
                if (!response.ok) {
                    throw new Error('Falha ao gerar backup. Permissão negada ou erro interno.');
                }
                
                if(backupProgressBar) backupProgressBar.style.width = '90%';
                if(backupProgressText) backupProgressText.textContent = "Finalizando download...";
                
                const blob = await response.blob();
                const downloadUrl = URL.createObjectURL(blob);
                
                // Content-Disposition should have filename, but we can set it locally
                const dateStr = new Date().toISOString().split('T')[0];
                const filename = `backup-keystone-${dateStr}.zip`;
                
                if(downloadBackupBtn) {
                    downloadBackupBtn.href = downloadUrl;
                    downloadBackupBtn.download = filename;
                }
                
                if(backupProgressBar) backupProgressBar.style.width = '100%';
                if(backupProgressText) backupProgressText.textContent = "Concluído!";

                setTimeout(() => {
                    if(backupProgressContainer) backupProgressContainer.classList.add('hidden');
                    if(startBackupBtn) {
                        startBackupBtn.classList.add('hidden');
                        startBackupBtn.innerHTML = 'Iniciar Backup Agora';
                        startBackupBtn.disabled = false;
                    }
                    if(backupSuccessContainer) backupSuccessContainer.classList.remove('hidden');
                }, 800);
                
            } catch (error) {
                console.error('Erro no backup:', error);
                alert('Ocorreu um erro ao gerar o backup: ' + (error instanceof Error ? error.message : String(error)));
                // Restore button state
                startBackupBtn.disabled = false;
                startBackupBtn.innerHTML = 'Iniciar Backup Agora';
                if(backupProgressContainer) backupProgressContainer.classList.add('hidden');
                if(backupDesc) backupDesc.classList.remove('hidden');
            }
        });
    }

    // --- LÓGICA DE RESTAURAÇÃO ---
    const restoreFileInput = document.getElementById('restoreFileInput') as HTMLInputElement;
    const startRestoreBtn = document.getElementById('startRestoreBtn') as HTMLButtonElement;
    const restoreProgressContainer = document.getElementById('restoreProgressContainer');
    const restoreProgressBar = document.getElementById('restoreProgressBar');
    const restoreProgressText = document.getElementById('restoreProgressText');
    const restoreSuccessContainer = document.getElementById('restoreSuccessContainer');
    const restoreDesc = document.getElementById('restoreDesc');

    if (restoreFileInput && startRestoreBtn) {
        restoreFileInput.addEventListener('change', () => {
            if (restoreFileInput.files && restoreFileInput.files.length > 0) {
                startRestoreBtn.disabled = false;
            } else {
                startRestoreBtn.disabled = true;
            }
        });

        startRestoreBtn.addEventListener('click', async () => {
            const file = restoreFileInput.files?.[0];
            if (!file) return;

            const confirmRestore = confirm("ATENÇÃO: Você está prestes a substituir todos os dados atuais do sistema pelo conteúdo deste backup. Esta operação não pode ser desfeita. Deseja continuar?");
            if (!confirmRestore) return;

            startRestoreBtn.disabled = true;
            startRestoreBtn.innerHTML = `
                <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Restaurando...
            `;
            
            if(restoreDesc) restoreDesc.classList.add('hidden');
            if(restoreFileInput) restoreFileInput.classList.add('hidden');
            if(restoreProgressContainer) restoreProgressContainer.classList.remove('hidden');

            if(restoreProgressBar) restoreProgressBar.style.width = '30%';
            if(restoreProgressText) restoreProgressText.textContent = "Enviando arquivo ZIP para o servidor...";

            const formData = new FormData();
            formData.append('file', file);

            try {
                // @ts-ignore
                const token = (window as any).Auth?.getToken();
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
                
                if(restoreProgressBar) restoreProgressBar.style.width = '100%';
                if(restoreProgressText) restoreProgressText.textContent = "Concluído!";

                setTimeout(() => {
                    if(restoreProgressContainer) restoreProgressContainer.classList.add('hidden');
                    if(startRestoreBtn) {
                        startRestoreBtn.classList.add('hidden');
                        startRestoreBtn.innerHTML = 'Restaurar Agora';
                        startRestoreBtn.disabled = false;
                    }
                    if(restoreSuccessContainer) restoreSuccessContainer.classList.remove('hidden');
                }, 800);
                
            } catch (error) {
                console.error('Erro na restauração:', error);
                alert('Ocorreu um erro ao restaurar: ' + (error instanceof Error ? error.message : String(error)));
                // Restore button state
                startRestoreBtn.disabled = false;
                startRestoreBtn.innerHTML = 'Restaurar Agora';
                if(restoreProgressContainer) restoreProgressContainer.classList.add('hidden');
                if(restoreDesc) restoreDesc.classList.remove('hidden');
                if(restoreFileInput) restoreFileInput.classList.remove('hidden');
            }
        });
    }
});
