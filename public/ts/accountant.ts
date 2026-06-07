(() => {
  let accountantsManager: any;
  let accountantDocMask: any = null;
  let accountantPhoneMask: any = null;
  let accountantZipMask: any = null;
  let accountantIbgeStates: any[] = [];

  const getById = (id: string): any => document.getElementById(id);

  const makeMask: any =
    window.createMaskAdapter || ((input: any, options: any) => window.IMask(input, options));

  const onlyDigits = (value: any): string => String(value || '').replace(/\D/g, '');

  const setMaskedValue = (maskInstance: any, inputId: string, value: any): void => {
    if (maskInstance) {
      maskInstance.unmaskedValue = onlyDigits(value);
      return;
    }
    const input = getById(inputId);
    if (input) input.value = value || '';
  };

  const getMaskedValue = (maskInstance: any, inputId: string): string => {
    if (maskInstance) return maskInstance.unmaskedValue || '';
    return onlyDigits(getById(inputId)?.value || '');
  };

  const getTrimmedValue = (inputId: string): string => String(getById(inputId)?.value || '').trim();

  const formatDoc = (doc: any): string => {
    if (!doc) return '-';
    const clean = String(doc).replace(/\D/g, '');
    if (clean.length === 11)
      return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    if (clean.length === 14)
      return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    return String(doc);
  };

  const formatPhone = (phone: any): string => {
    if (!phone) return '-';
    const clean = String(phone).replace(/\D/g, '');
    if (clean.length === 10) return clean.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    if (clean.length === 11) return clean.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    if (clean.length === 12)
      return clean.replace(/(\d{2})(\d{2})(\d{4})(\d{4})/, '+$1 ($2) $3-$4');
    if (clean.length === 13)
      return clean.replace(/(\d{2})(\d{2})(\d{5})(\d{4})/, '+$1 ($2) $3-$4');
    return String(phone);
  };

  const formatAccountantLocation = (item: any): string => {
    const city = String(item.city || '').trim();
    const state = String(item.state || '').trim();
    if (!city && !state) return 'Não informado';
    return [city, state].filter(Boolean).join(' / ');
  };

  const populateAccountantStateOptions = (selectedValue: any = ''): void => {
    const stateSelect = getById('accountantState');
    if (!stateSelect || !accountantIbgeStates.length) return;

    const normalizedSelectedValue = String(selectedValue || '').trim().toUpperCase();
    stateSelect.innerHTML = [
      '<option value="">Selecione...</option>',
      ...accountantIbgeStates.map(
        (state: any) => `<option value="${state.uf}">${state.uf} - ${state.name}</option>`
      ),
    ].join('');

    stateSelect.value = accountantIbgeStates.some((state: any) => state.uf === normalizedSelectedValue)
      ? normalizedSelectedValue
      : '';
  };

  const loadAccountantStateOptions = async (selectedValue: any = ''): Promise<void> => {
    try {
      if (!accountantIbgeStates.length) {
        const response = await (api as any)('/companies/states');
        accountantIbgeStates = response.data || [];
      }
      populateAccountantStateOptions(selectedValue);
    } catch (error) {
      console.error('Falha ao carregar UFs do IBGE para contadores', error);
    }
  };

  const lookupAddressByCep = async (cep: any): Promise<any | null> => {
    const normalizedCep = onlyDigits(cep);
    if (normalizedCep.length !== 8) return null;

    let data: any = null;
    let cepNotFound = false;

    try {
      const viaCepResponse = await fetch(`https://viacep.com.br/ws/${normalizedCep}/json/`);
      if (viaCepResponse.ok) {
        const viaCepData: any = await viaCepResponse.json();
        if (!viaCepData.erro) {
          data = {
            street: viaCepData.logradouro,
            neighborhood: viaCepData.bairro,
            city: viaCepData.localidade,
            state: viaCepData.uf,
            complement: viaCepData.complemento,
          };
        } else {
          cepNotFound = true;
        }
      }
    } catch (_error) {}

    if (!data && !cepNotFound) {
      try {
        const brasilApiResponse = await fetch(`https://brasilapi.com.br/api/cep/v1/${normalizedCep}`);
        if (brasilApiResponse.ok) {
          data = await brasilApiResponse.json();
        }
      } catch (_error) {}
    }

    return data;
  };

  const applyAccountantCepLookupResult = (data: any): void => {
    if (!data) return;
    getById('accountantStreet').value = data.street || '';
    getById('accountantNeighborhood').value = data.neighborhood || '';
    getById('accountantCity').value = data.city || '';
    getById('accountantComplement').value = data.complement || '';
    populateAccountantStateOptions(data.state || '');
  };

  const handleAccountantCepLookup = async (): Promise<void> => {
    const loader = getById('accountantCepLoading');
    const cep = getMaskedValue(accountantZipMask, 'accountantZipcode');
    if (cep.length !== 8) return;

    if (loader) loader.classList.remove('hidden');
    try {
      const data = await lookupAddressByCep(cep);
      if (data && (data.street || data.city)) {
        applyAccountantCepLookupResult(data);
      } else {
        (UI as any).showAlert('alertMessage', 'CEP do contador não encontrado ou inválido.', 'error');
      }
    } catch (error) {
      console.error('Falha ao consultar CEP', error);
    } finally {
      if (loader) loader.classList.add('hidden');
    }
  };

  const handleAccountantDocumentLookup = async (): Promise<void> => {
    const documentValue = getMaskedValue(accountantDocMask, 'accountantDocument');
    if (documentValue.length !== 14) return;

    try {
      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${documentValue}`);
      const data: any = await response.json();

      if (!response.ok || !data?.razao_social) {
        (UI as any).showAlert('alertMessage', 'CNPJ do contador não encontrado ou inválido.', 'error');
        return;
      }

      if (!getTrimmedValue('accountantName')) getById('accountantName').value = data.nome_fantasia || data.razao_social || '';
      if (!getTrimmedValue('accountantEmail')) getById('accountantEmail').value = data.email || '';
      if (!getMaskedValue(accountantPhoneMask, 'accountantPhone'))
        setMaskedValue(accountantPhoneMask, 'accountantPhone', data.ddd_telefone_1 || '');
      if (!getMaskedValue(accountantZipMask, 'accountantZipcode'))
        setMaskedValue(accountantZipMask, 'accountantZipcode', data.cep || '');
      if (!getTrimmedValue('accountantStreet')) getById('accountantStreet').value = data.logradouro || '';
      if (!getTrimmedValue('accountantNumber')) getById('accountantNumber').value = data.numero || '';
      if (!getTrimmedValue('accountantComplement')) getById('accountantComplement').value = data.complemento || '';
      if (!getTrimmedValue('accountantNeighborhood')) getById('accountantNeighborhood').value = data.bairro || '';
      if (!getTrimmedValue('accountantCity')) getById('accountantCity').value = data.municipio || '';
      populateAccountantStateOptions(data.uf || '');

      if (data.cep) {
        const cepData = await lookupAddressByCep(data.cep);
        if (cepData) {
          applyAccountantCepLookupResult({
            ...cepData,
            complement: cepData.complement || getTrimmedValue('accountantComplement') || data.complemento || '',
          });
        }
      }
    } catch (error) {
      console.error('Falha ao consultar documento', error);
    }
  };

  const setupAccountantFormEnhancements = (): void => {
    const documentInput = getById('accountantDocument');
    const phoneInput = getById('accountantPhone');
    const zipcodeInput = getById('accountantZipcode');

    if (documentInput && !accountantDocMask) {
      accountantDocMask = makeMask(documentInput, {
        mask: [{ mask: '000.000.000-00' }, { mask: '00.000.000/0000-00' }],
      });
      documentInput.addEventListener('blur', handleAccountantDocumentLookup);
    }

    if (phoneInput && !accountantPhoneMask) {
      accountantPhoneMask = makeMask(phoneInput, {
        mask: [{ mask: '(00) 0000-0000' }, { mask: '(00) 00000-0000' }],
      });
    }

    if (zipcodeInput && !accountantZipMask) {
      accountantZipMask = makeMask(zipcodeInput, { mask: '00000-000' });
      accountantZipMask.on('complete', handleAccountantCepLookup);
    }
  };

  const applyAccountantPrefillFromQuery = (): void => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('prefill') !== 'accountant') return;

    const prefillName = String(params.get('name') || '').trim();
    const prefillPhoneRaw = onlyDigits(params.get('phone') || '');
    const prefillPhone = (prefillPhoneRaw.length === 12 || prefillPhoneRaw.length === 13) && prefillPhoneRaw.startsWith('55')
      ? prefillPhoneRaw.slice(2)
      : prefillPhoneRaw;

    const openModalBtn = getById('btnOpenModal');
    if (openModalBtn) {
      openModalBtn.click();
    } else {
      getById('entityModal')?.classList.remove('hidden');
    }

    window.requestAnimationFrame(() => {
      const nameInput = getById('accountantName');
      const currentName = String(nameInput?.value || '').trim();
      if (nameInput && !currentName && prefillName) {
        nameInput.value = prefillName;
      }

      const currentPhone = getMaskedValue(accountantPhoneMask, 'accountantPhone');
      if (!currentPhone && prefillPhone) {
        setMaskedValue(accountantPhoneMask, 'accountantPhone', prefillPhone);
      }
    });

    (UI as any)?.showAlert?.('alertMessage', 'Preenchimento aplicado. Revise os dados e clique em Salvar.', 'success', 4500);

    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete('prefill');
    cleanUrl.searchParams.delete('name');
    cleanUrl.searchParams.delete('phone');
    window.history.replaceState({}, '', `${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash}`);
  };

  document.addEventListener('DOMContentLoaded', () => {
    if (!(Auth as any).isAuthenticated()) {
      window.location.href = '/';
      return;
    }

    setupAccountantFormEnhancements();
    loadAccountantStateOptions('');

    (api as any)('/auth/me')
      .then((res: any) => {
        const userGreeting = getById('userGreeting');
        if (userGreeting && res.data && res.data.user) {
          userGreeting.textContent = `Olá, ${res.data.user.full_name || 'Usuário'}`;
        } else if (userGreeting && res.data) {
          userGreeting.textContent = `Olá, ${res.data.full_name || 'Usuário'}`;
        }
      })
      .catch(console.error);

    const FilterPanel: any = window.FilterPanel;

    accountantsManager = new (window.CrudManager as any)({
      entityName: 'Contador',
      endpoint: '/users',
      tableId: 'accountantsTable',
      gridSectionId: 'accountantsGridSection',
      tableSectionId: 'accountantsSection',
      modalId: 'entityModal',
      disableSummaryFooter: true,

      filterConfig: {
        storageKey: 'accountants_filter_panel',
        fields: [
          { id: 'filterSearch', type: 'text', label: 'Busca', placeholder: 'Nome, documento, email...' },
          {
            id: 'filterStatus',
            type: 'select',
            label: 'Status',
            options: [
              { value: '', label: 'Todos' },
              { value: 'active', label: 'Ativos' },
              { value: 'inactive', label: 'Inativos' },
            ],
          },
        ],
      },

      applyFilters: (data: any[]) => {
        const search = FilterPanel.normalizeText(getById('filterSearch')?.value);
        const searchDigits = FilterPanel.onlyDigits(search);
        const status = getById('filterStatus')?.value || '';

        const filtered = data.filter((item: any) => {
          if (item.role !== 'accountant') return false;
          if (status === 'active' && !item.is_active) return false;
          if (status === 'inactive' && item.is_active) return false;
          if (!search) return true;

          if (FilterPanel.matchesSearch(item, ['full_name', 'email', 'cpf_cnpj', 'phone', 'city', 'state'], search))
            return true;
          if (!searchDigits) return false;

          return [item.cpf_cnpj, item.phone]
            .map((value: any) => FilterPanel.onlyDigits(value))
            .some((value: any) => String(value).includes(searchDigits));
        });

        window.GridSummaryFooter?.update({
          footerId: 'accountantsResultsFooter',
          anchorId: 'accountantsGridSection',
          count: filtered.length,
          label: 'contador(es) exibido(s)',
        });

        return filtered;
      },

      renderTable: (items: any[]) => {
        const tbody = getById('accountantsTable');
        if (items.length === 0) {
          tbody.innerHTML =
            '<tr><td colspan="8" class="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">Nenhum contador encontrado.</td></tr>';
          return;
        }

        tbody.innerHTML = items
          .map(
            (item: any, index: number) => `
                <tr class="${!item.is_active ? 'opacity-50' : ''}">
                    <td class="px-3 py-4 whitespace-nowrap text-left w-12">
                        <input type="checkbox" id="chk_tbl_${item.public_id}" name="accountantSelect[]" value="${item.public_id}" placeholder="" data-bwignore="true" class="item-checkbox cursor-pointer rounded border-gray-300 dark:border-slate-600 text-brand-600 shadow-sm focus:border-brand-300 focus:ring focus:ring-brand-200 focus:ring-opacity-50 dark:bg-slate-800">
                    </td>
                    <td class="px-3 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">#${String(index + 1).padStart(4, '0')}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">${item.full_name}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${formatDoc(item.cpf_cnpj)}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        <div class="truncate max-w-55" title="${item.email || ''}">${item.email || '-'}</div>
                        <div>${formatPhone(item.phone)}</div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${formatAccountantLocation(item)}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm">
                        ${
                          item.is_active
                            ? '<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">Ativo</span>'
                            : '<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">Inativo</span>'
                        }
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button type="button" title="Editar" class="text-brand-600 hover:text-brand-900 dark:hover:text-brand-400 mr-2 edit-btn" data-item='${JSON.stringify(item).replace(/'/g, '&#39;')}' data-id="${item.public_id}">
                            <svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                        </button>
                        ${
                          item.is_active
                            ? `<button type="button" title="Desativar" class="text-red-600 hover:text-red-900 dark:hover:text-red-400 mr-2 toggle-status-btn" data-id="${item.public_id}" data-action="false">
                                 <svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"></path></svg>
                               </button>`
                            : `<button type="button" title="Ativar" class="text-brand-600 hover:text-brand-900 dark:text-brand-400 dark:hover:text-brand-300 mr-2 toggle-status-btn" data-id="${item.public_id}" data-action="true">
                                 <svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                               </button>`
                        }
                    </td>
                </tr>
            `
          )
          .join('');
      },

      renderGrid: (items: any[]) => {
        const grid = getById('accountantsGridSection');
        if (items.length === 0) {
          grid.innerHTML =
            '<div class="col-span-full flex flex-col items-center justify-center py-12 gap-2"><svg class="w-10 h-10 text-gray-300 dark:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg><p class="text-sm text-gray-400 dark:text-gray-500">Nenhum contador encontrado.</p></div>';
          return;
        }

        grid.innerHTML = items
          .map(
            (item: any, index: number) => `
                <div class="bg-white dark:bg-slate-800 shadow rounded-lg p-5 flex flex-col relative border border-gray-100 dark:border-slate-700 ${
                  !item.is_active ? 'opacity-50' : ''
                }">
                    <div class="flex-1">
                        <div class="flex justify-between items-center mb-3">
                            <input type="checkbox" id="chk_crd_${item.public_id}" name="accountantSelect[]" value="${item.public_id}" placeholder="" data-bwignore="true" class="item-checkbox cursor-pointer rounded border-gray-300 dark:border-slate-600 text-brand-600 shadow-sm focus:border-brand-300 focus:ring focus:ring-brand-200 focus:ring-opacity-50 dark:bg-slate-800">
                            <span class="text-xs font-mono text-gray-400 dark:text-gray-500">#${String(index + 1).padStart(4, '0')}</span>
                        </div>
                        <div class="flex justify-between items-start gap-3">
                            <h4 class="text-lg font-bold text-gray-900 dark:text-gray-100 truncate">${item.full_name}</h4>
                            <span class="px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">Contador</span>
                        </div>

                        <div class="mt-4 space-y-2 text-sm text-gray-600 dark:text-gray-300">
                            <p>${formatDoc(item.cpf_cnpj)}</p>
                            <p class="truncate max-w-55" title="${item.email || ''}">${item.email || 'Sem email'}</p>
                            <p>${formatPhone(item.phone)}</p>
                            <p>${formatAccountantLocation(item)}</p>
                            <p>${
                              item.is_active
                                ? '<span class="w-2.5 h-2.5 bg-green-500 rounded-full inline-block mr-1"></span>Ativo'
                                : '<span class="w-2.5 h-2.5 bg-red-500 rounded-full inline-block mr-1"></span>Inativo'
                            }</p>
                        </div>
                    </div>

                    <div class="mt-5 pt-4 border-t border-gray-100 dark:border-slate-700 flex justify-end space-x-2">
                        <button type="button" title="Editar" class="text-brand-600 hover:bg-brand-50 p-1.5 rounded-full dark:hover:bg-brand-900/30 edit-btn" data-item='${JSON.stringify(item).replace(/'/g, '&#39;')}' data-id="${item.public_id}">
                            <svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                        </button>
                        ${
                          item.is_active
                            ? `<button type="button" title="Desativar" class="text-red-600 hover:bg-red-50 p-1.5 rounded-full dark:hover:bg-red-900/30 toggle-status-btn" data-id="${item.public_id}" data-action="false">
                                 <svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"></path></svg>
                               </button>`
                            : `<button type="button" title="Ativar" class="text-brand-600 hover:bg-brand-50 p-1.5 rounded-full dark:hover:bg-brand-900/30 toggle-status-btn" data-id="${item.public_id}" data-action="true">
                                 <svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                               </button>`
                        }
                    </div>
                </div>
            `
          )
          .join('');
      },

      onEdit: (data: any) => {
        getById('entityForm')?.reset();
        const accountantIdInput = getById('accountantId');
        const modalTitle = getById('modalTitle');
        const passwordInput = getById('accountantPassword');
        const passwordHint = getById('passwordHint');
        const statusSelect = getById('accountantStatus');

        if (data && data.public_id) {
          modalTitle.textContent = 'Editar Contador';
          accountantIdInput.value = data.public_id || '';
          getById('accountantName').value = data.full_name || '';
          getById('accountantEmail').value = data.email || '';
          getById('accountantStreet').value = data.street || '';
          getById('accountantNumber').value = data.number || '';
          getById('accountantComplement').value = data.complement || '';
          getById('accountantNeighborhood').value = data.neighborhood || '';
          getById('accountantCity').value = data.city || '';
          if (statusSelect) {
            statusSelect.value = data.is_active === false ? 'inactive' : 'active';
          }
          setMaskedValue(accountantDocMask, 'accountantDocument', data.cpf_cnpj || '');
          setMaskedValue(accountantPhoneMask, 'accountantPhone', data.phone || '');
          setMaskedValue(accountantZipMask, 'accountantZipcode', data.zipcode || '');
          loadAccountantStateOptions(data.state || '');
          passwordInput.removeAttribute('required');
          passwordHint.classList.remove('hidden');
        } else {
          modalTitle.textContent = 'Novo Contador';
          accountantIdInput.value = '';
          setMaskedValue(accountantDocMask, 'accountantDocument', '');
          setMaskedValue(accountantPhoneMask, 'accountantPhone', '');
          setMaskedValue(accountantZipMask, 'accountantZipcode', '');
          if (statusSelect) {
            statusSelect.value = 'active';
          }
          loadAccountantStateOptions('');
          passwordInput.setAttribute('required', 'true');
          passwordHint.classList.add('hidden');
        }
        getById('entityModal').classList.remove('hidden');
      },
    });

    accountantsManager.init();

    applyAccountantPrefillFromQuery();

    document.addEventListener('click', async (e: any) => {
      const btn = (e.target as HTMLElement | null)?.closest?.('.toggle-status-btn') as any;
      if (btn) {
        const id = btn.getAttribute('data-id');
        const action = btn.getAttribute('data-action') === 'true';
        if (!confirm(`Tem certeza que deseja ${action ? 'ativar' : 'desativar'} este contador?`)) return;

        try {
          await (api as any)(`/users/${id}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ is_active: action }),
          });
          (UI as any).showAlert(
            'alertMessage',
            `Contador ${action ? 'ativado' : 'desativado'} com sucesso!`,
            'success'
          );
          await accountantsManager.loadData();
        } catch (error: any) {
          (UI as any).showAlert('alertMessage', error.message || 'Erro ao atualizar status do contador.', 'error');
        }
      }
    });

    getById('entityForm')?.addEventListener('submit', async (event: any) => {
      event.preventDefault();

      const saveBtn = getById('saveBtn');
      const accountantId = getTrimmedValue('accountantId');
      const isEditing = Boolean(accountantId);

      const payload: any = {
        full_name: getTrimmedValue('accountantName'),
        email: getTrimmedValue('accountantEmail'),
        passwordRaw: getTrimmedValue('accountantPassword'),
        role: 'accountant',
        is_active: (getById('accountantStatus')?.value || 'active') !== 'inactive',
        cpf_cnpj: getMaskedValue(accountantDocMask, 'accountantDocument') || undefined,
        phone: getMaskedValue(accountantPhoneMask, 'accountantPhone') || undefined,
        zipcode: getMaskedValue(accountantZipMask, 'accountantZipcode') || undefined,
        street: getTrimmedValue('accountantStreet') || undefined,
        number: getTrimmedValue('accountantNumber') || undefined,
        complement: getTrimmedValue('accountantComplement') || undefined,
        neighborhood: getTrimmedValue('accountantNeighborhood') || undefined,
        city: getTrimmedValue('accountantCity') || undefined,
        state: getTrimmedValue('accountantState') || undefined,
      };

      if (isEditing && !payload.passwordRaw) {
        payload.passwordRaw = '';
      }

      saveBtn.disabled = true;
      saveBtn.textContent = 'Salvando...';

      const endpoint = isEditing ? `/users/${accountantId}` : '/users';
      const method = isEditing ? 'PATCH' : 'POST';

      try {
        await (api as any)(endpoint, {
          method,
          body: JSON.stringify(payload),
        });

        (UI as any).showAlert(
          'alertMessage',
          isEditing ? 'Contador atualizado com sucesso!' : 'Contador cadastrado com sucesso!',
          'success'
        );
        accountantsManager.closeModal();
        await accountantsManager.loadData();
      } catch (error: any) {
        (UI as any).showAlert('alertMessage', error.message || 'Erro ao salvar contador.', 'error');
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Salvar';
      }
    });
  });
})();
