(() => {
  type ManifestationDoc = {
    chNFe: string;
    dhEmi?: string;
    xNome?: string;
    cnpj?: string;
    vNF?: string | number;
    xml?: string;
  };

  const state: {
    docs: ManifestationDoc[];
    lastNSU: string;
    loading: boolean;
  } = {
    docs: [],
    lastNSU: localStorage.getItem('last_nsu_manifestation') || '0',
    loading: false,
  };

  const DfeTable = {
    render(): void {
      const tbody = document.getElementById('dfeTableBody');
      if (!tbody) return;

      if (state.docs.length === 0) {
        tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="px-6 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                        Nenhuma nota encontrada nesta consulta. Utilize o botão "Sincronizar" para buscar na SEFAZ.
                    </td>
                </tr>
            `;
        return;
      }

      tbody.innerHTML = state.docs
        .map((doc) => {
          const dhEmi = doc.dhEmi
            ? new Date(doc.dhEmi).toLocaleString('pt-BR')
            : 'Data disponível após ciência';
          const emitente = doc.xNome || 'NOME INDISPONÍVEL';
          const valor = doc.vNF
            ? `R$ ${parseFloat(String(doc.vNF)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
            : '---';
          const hasXml = !!doc.xml;

          return `
                <tr class="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">${dhEmi}</td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <div class="text-sm font-bold text-gray-900 dark:text-gray-100">${emitente}</div>
                        <div class="text-xs text-gray-500">${doc.cnpj || ''}</div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-gray-100">${valor}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400 font-mono">
                        <span title="${doc.chNFe}">${doc.chNFe.substring(0, 20)}...</span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm">
                        <div class="flex justify-end gap-2 items-center">
                            ${hasXml
                              ? `<button onclick="downloadXml('${doc.chNFe}')" class="inline-flex items-center px-2.5 py-1.5 bg-brand-50 hover:bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300 rounded-lg text-xs font-semibold transition-colors" title="Baixar XML Completo">
                                    <span class="mr-1">📄</span> XML
                                 </button>`
                              : `<span class="text-gray-400 text-[10px] italic uppercase tracking-wider">Aguardando Ciência</span>`}
                            
                            <div class="relative group">
                                <button class="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors text-gray-500" title="Mais Ações">
                                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"></path></svg>
                                </button>
                                
                                <div class="hidden group-hover:block absolute right-0 bottom-full z-10 mb-2 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-gray-100 dark:border-slate-700 py-1 overflow-hidden transition-all">
                                    <button onclick="manifestNote('${doc.chNFe}', '210210')" class="w-full text-left px-4 py-2 text-xs hover:bg-gray-50 dark:hover:bg-slate-700/50 text-gray-700 dark:text-gray-200">Dar Ciência da Operação</button>
                                    <button onclick="manifestNote('${doc.chNFe}', '210200')" class="w-full text-left px-4 py-2 text-xs hover:bg-gray-50 dark:hover:bg-slate-700/50 text-emerald-600 font-bold">Confirmar Operação</button>
                                    <div class="border-t border-gray-100 dark:border-slate-700 my-1"></div>
                                    <button onclick="manifestNote('${doc.chNFe}', '210220')" class="w-full text-left px-4 py-2 text-xs hover:bg-gray-50 dark:hover:bg-slate-700/50 text-orange-600">Desconhecer Operação</button>
                                    <button onclick="manifestNote('${doc.chNFe}', '210240')" class="w-full text-left px-4 py-2 text-xs hover:bg-gray-50 dark:hover:bg-slate-700/50 text-red-600">Operação não Realizada</button>
                                </div>
                            </div>
                        </div>
                    </td>
                </tr>
            `;
        })
        .join('');
    },
  };

  async function pollJobStatus(jobId: string, type: 'consult' | 'manifest'): Promise<void> {
    const check = async (): Promise<boolean> => {
      try {
        const response = await (api as any)(`/manifestation/status/${jobId}`);
        const job = response.data || response;

        if (job.status === 'completed') {
          state.loading = false;
          const result = job.result;

          if (type === 'consult') {
            if (result.cStat === '137' || result.cStat === '138') {
              state.docs = result.docs || [];
              state.lastNSU = result.ultNSU || state.lastNSU;
              localStorage.setItem('last_nsu_manifestation', state.lastNSU);
              DfeTable.render();
              window.dispatchEvent(
                new CustomEvent('add-notification', {
                  detail: {
                    title: 'SEFAZ - Sincronização',
                    message: `${state.docs.length} novas notas encontradas contra o CNPJ.`,
                    type: 'success',
                  },
                })
              );
            } else {
              window.dispatchEvent(
                new CustomEvent('add-notification', {
                  detail: {
                    title: 'SEFAZ - Info',
                    message: result.xMotivo || 'Nenhum documento novo localizado.',
                    type: 'info',
                  },
                })
              );
            }
          } else {
            if (result.cStat === '128' || result.cStat === '135' || result.cStat === '136') {
              window.dispatchEvent(
                new CustomEvent('add-notification', {
                  detail: {
                    title: 'Manifesto Sucesso',
                    message: 'Evento registrado com sucesso na SEFAZ!',
                    type: 'success',
                  },
                })
              );
              setTimeout(() => syncSefaz(), 2000);
            } else {
              window.dispatchEvent(
                new CustomEvent('add-notification', {
                  detail: {
                    title: 'Erro SEFAZ',
                    message: result.xMotivo || 'Erro ao processar manifesto.',
                    type: 'danger',
                  },
                })
              );
            }
          }

          const btn = document.getElementById('btnConsult') as HTMLButtonElement | null;
          if (btn) {
            btn.innerHTML =
              '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg> Sincronizar com SEFAZ';
            btn.disabled = false;
          }
          return true;
        }

        if (job.status === 'failed') {
          state.loading = false;
          showAlert(`Erro no processamento: ${job.error || 'Erro desconhecido'}`, 'danger');
          const btn = document.getElementById('btnConsult') as HTMLButtonElement | null;
          if (btn) {
            btn.innerHTML = 'Sincronizar com SEFAZ';
            btn.disabled = false;
          }
          return true;
        }

        return false;
      } catch (err) {
        console.error('Erro ao consultar status do job:', err);
        return false;
      }
    };

    const interval = setInterval(async () => {
      const finished = await check();
      if (finished) clearInterval(interval);
    }, 2000);
  }

  async function syncSefaz(): Promise<void> {
    if (state.loading) return;
    state.loading = true;

    const btn = document.getElementById('btnConsult') as HTMLButtonElement | null;
    const originalText = btn ? btn.innerHTML : '';
    if (btn) {
      btn.innerHTML = '<span class="animate-spin text-xs">⌛</span> Em segundo plano...';
      btn.disabled = true;
    }

    try {
      const response = await (api as any)(`/manifestation/consult-destined?lastNSU=${state.lastNSU}`);
      const result = response.data || response;

      if (result.jobId) {
        showAlert('Sincronização iniciada em segundo plano. Aguarde a atualização automática...', 'info');
        void pollJobStatus(result.jobId, 'consult');
      } else if (result.status === 'success' && result.data) {
        // Resposta direta (Modo Sincrono)
        state.loading = false;
        if (btn) {
          btn.innerHTML = originalText;
          btn.disabled = false;
        }

        const consultData = result.data;
        if (consultData.cStat === '137' || consultData.cStat === '138') {
          state.docs = consultData.docs || [];
          state.lastNSU = consultData.ultNSU || state.lastNSU;
          localStorage.setItem('last_nsu_manifestation', state.lastNSU);
          DfeTable.render();

          window.dispatchEvent(
            new CustomEvent('add-notification', {
              detail: {
                title: 'SEFAZ - Sincronização',
                message: `${state.docs.length} novas notas encontradas contra o CNPJ.`,
                type: 'success',
              },
            })
          );
          showAlert(`Sincronização concluída! ${state.docs.length} documentos encontrados.`, 'success');
        } else {
          showAlert(`SEFAZ: ${consultData.xMotivo || 'Nenhum documento novo localizado.'}`, 'info');
          window.dispatchEvent(
            new CustomEvent('add-notification', {
              detail: {
                title: 'SEFAZ - Info',
                message: consultData.xMotivo || 'Consulta realizada sem novos documentos.',
                type: 'info',
              },
            })
          );
        }
      }
    } catch (error: any) {
      state.loading = false;
      if (btn) {
        btn.innerHTML = originalText;
        btn.disabled = false;
      }

      const msg = error?.message || 'Erro ao iniciar sincronização.';
      if (msg.includes('CNPJ ou Certificado Digital não configurado')) {
        showAlert(
          `
                <div class="flex items-center justify-between gap-4">
                    <span><strong>Configuração Necessária:</strong> Configure o Certificado Digital da empresa.</span>
                    <a href="/pages/company.html" class="bg-brand-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-brand-700 transition-colors shrink-0">Configurar</a>
                </div>
            `,
          'danger',
          true
        );
      } else {
        showAlert(msg, 'danger');
      }
    }
  }

  async function manifestNote(chNFe: string, tpEvento: string): Promise<void> {
    if (state.loading) return;

    const eventNames: Record<string, string> = {
      '210210': 'Ciência da Operação',
      '210200': 'Confirmação da Operação',
      '210220': 'Desconhecimento',
      '210240': 'Operação não Realizada',
    };

    if (!confirm(`Deseja enviar o evento de "${eventNames[tpEvento]}" para a nota ${chNFe}?`)) return;

    let xJust = '';
    if (tpEvento === '210240') {
      xJust = String(prompt('Informe a justificativa desta operação não realizada (mínimo 15 caracteres):') || '');
      if (!xJust || xJust.length < 15) {
        alert('A justificativa é obrigatória e deve ter pelo menos 15 caracteres.');
        return;
      }
    }

    state.loading = true;
    showAlert(`Iniciando ${eventNames[tpEvento]} em segundo plano...`, 'info');

    try {
      const response = await (api as any)('/manifestation/manifest', {
        method: 'POST',
        body: JSON.stringify({ chNFe, tpEvento, xJust }),
      });

      const result = response.data || response;
      if (result.jobId) {
        void pollJobStatus(result.jobId, 'manifest');
      }
    } catch (error: any) {
      state.loading = false;
      console.error('Erro ao manifestar:', error);
      showAlert(error?.message || 'Erro ao comunicar manifestação.', 'danger');
    }
  }

  function downloadXml(chNFe: string): void {
    const doc = state.docs.find((d) => d.chNFe === chNFe);
    if (!doc || !doc.xml) {
      showAlert('XML não disponível no cache local. Tente sincronizar novamente.', 'danger');
      return;
    }

    const blob = new Blob([doc.xml], { type: 'text/xml' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `NFe_${chNFe}.xml`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }

  function showAlert(msg: string, type: 'success' | 'danger' | 'info', isHtml = false): void {
    const alert = document.getElementById('alertMessage');
    if (!alert) return;
    alert.classList.remove(
      'hidden',
      'bg-emerald-100',
      'text-emerald-800',
      'bg-red-100',
      'text-red-800',
      'bg-blue-100',
      'text-blue-800'
    );

    if (type === 'success') alert.classList.add('bg-emerald-100', 'text-emerald-800');
    else if (type === 'danger') alert.classList.add('bg-red-100', 'text-red-800');
    else alert.classList.add('bg-blue-100', 'text-blue-800');

    if (isHtml) alert.innerHTML = msg;
    else alert.textContent = msg;

    alert.classList.remove('hidden');
    setTimeout(() => alert.classList.add('hidden'), 10000);
  }

  (window as any).manifestNote = manifestNote;
  (window as any).downloadXml = downloadXml;

  document.addEventListener('DOMContentLoaded', () => {
    const btnConsult = document.getElementById('btnConsult');
    if (btnConsult) btnConsult.addEventListener('click', syncSefaz);

    const btnReset = document.getElementById('btnReset');
    if (btnReset) {
      btnReset.addEventListener('click', async () => {
        if (!confirm('Deseja reiniciar a consulta do zero? Isso re-enviará notas antigas (dentro de 90 dias).')) return;
        state.lastNSU = '0';
        localStorage.setItem('last_nsu_manifestation', '0');
        state.docs = [];
        DfeTable.render();
        await syncSefaz();
      });
    }
  });
})();
