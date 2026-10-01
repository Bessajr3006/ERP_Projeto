(() => {
  type AnyRecord = Record<string, any>;

  type Supplier = {
    public_id: string;
    name?: string;
    email?: string;
    phone?: string;
    cnpj_cpf?: string;
    zipcode?: string;
    street?: string;
    number?: string;
    complement?: string;
    neighborhood?: string;
    city?: string;
    state?: string;

    certificate_base64?: any;
    certificate_password?: string;
    certificate_expiration?: string;
    social_contract_base64?: any;
    cnpj_document_base64?: any;
  };

  type IbgeState = { uf: string; name: string };

  type CepLookupData = {
    street?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
    complement?: string;
  };

  const api: any = (window as any).api;
  const Auth: any = (window as any).Auth;
  const UI: any = (window as any).UI;
  const DateUtils: any = (window as any).DateUtils;
  const CrudManager: any = (window as any).CrudManager;
  const FilterPanel: any = (window as any).FilterPanel;
  const Paginator: any = (window as any).Paginator;
  const forge: any = (window as any).forge;

  let suppliersData: Supplier[] = [];
  let suppliersManager: any;

  let renameDocIdx: number | null = null;
  let renameDocsList: any[] = [];
  let renameEntityId: string | null = null;
  let activeRenderDetailsDocsList: (() => void) | null = null;

  let deleteDocIdx: number | null = null;
  let deleteDocsList: any[] = [];
  let deleteEntityId: string | null = null;

  document.addEventListener('DOMContentLoaded', () => {
    if (!Auth.isAuthenticated()) {
      window.location.href = '/';
      return;
    }

    // Load User info for the navbar
    api('/auth/me')
      .then((res: any) => {
        const userGreeting = document.getElementById('userGreeting');
        if (userGreeting && res.data && res.data.user) {
          userGreeting.textContent = `Olá, ${res.data.user.full_name || 'Usuário'}`;
        } else if (userGreeting && res.data) {
          userGreeting.textContent = `Olá, ${res.data.full_name || 'Usuário'}`;
        }

        const company = res?.data?.company || res?.data?.user?.company || res?.data?.user?.company_info || res?.data;
        if (company) {
          (window as any).currentSolidconUrls = [
            company.solidcon_url_1 || '',
            company.solidcon_url_2 || '',
            company.solidcon_url_3 || '',
            company.solidcon_url_4 || '',
            company.solidcon_url_5 || '',
          ];
          const showSolidcon = company.show_solidcon !== false && company.show_solidcon !== 0;
          const btn = document.getElementById('btnOpenSolidconModal');
          if (btn) {
            if (!showSolidcon) {
              btn.classList.add('hidden');
              btn.classList.remove('inline-flex');
              btn.style.setProperty('display', 'none', 'important');
            } else {
              btn.classList.remove('hidden');
              btn.classList.add('inline-flex');
              btn.style.display = '';
            }
          }
        }
      })
      .catch((err: any) => {
        console.error('Falha ao carregar usuário', err);
      });

    document.title = 'KEYSTONE - Fornecedores';

    suppliersManager = new CrudManager({
      entityName: 'Fornecedor',
      endpoint: '/entities/suppliers',
      tableId: 'suppliersTable',
      gridSectionId: 'suppliersGridSection',
      tableSectionId: 'suppliersSection',
      modalId: 'entityModal',

      filterConfig: {
        storageKey: 'suppliers_filter_panel',
        footerId: 'suppliersResultsFooter',
        fields: [{ id: 'filterSearch', type: 'text', label: 'Busca', placeholder: 'Nome, documento, e-mail ou telefone' }],
      },

      renderTable: null,
      renderGrid: null,

      applyFilters: (data: Supplier[]) => {
        const search = FilterPanel.normalizeText((document.getElementById('filterSearch') as HTMLInputElement | null)?.value);
        const searchDigits = FilterPanel.onlyDigits(search);

        const filtered = data.filter((item: any) => {
          if (!search) return true;
          if (FilterPanel.matchesSearch(item, ['name', 'email', 'phone', 'cnpj_cpf'], search)) return true;
          if (!searchDigits) return false;
          return [item.phone, item.cnpj_cpf]
            .map((value: any) => FilterPanel.onlyDigits(value))
            .some((value: string) => value.includes(searchDigits));
        });

        renderTable('suppliersTable', filtered, 0);
        suppliersManager._bindActionEvents();

        if ((window as any).GridSummaryFooter) {
            (window as any).GridSummaryFooter.update({
                footerId: 'suppliersResultsFooter',
                anchorId: 'suppliersSection',
                count: filtered.length,
                label: 'fornecedor(es) exibido(s)'
            });
        }

        return filtered;
      },

      onEdit: (data: Supplier) => {
        (window as any).openModal('supplier', data);
      },
    });

    suppliersManager.loadData = async function (this: any) {
      try {
        const response = await api('/entities/suppliers');
        this.data = (response.data || []).map((item: any) => {
          const safe = { ...item };
          if (safe.certificate_base64) safe.certificate_base64 = true;
          if (safe.social_contract_base64) safe.social_contract_base64 = true;
          if (safe.cnpj_document_base64) safe.cnpj_document_base64 = true;
          return safe;
        });
        suppliersData = this.data;

        this.applyFilters();
      } catch (error) {
        console.error('Failed to load entities', error);
        UI.showAlert('alertMessage', 'Erro ao carregar dados. Verifique a conexão.');
      }
    };

    suppliersManager.init();
    setupDetailsModalTabs();

    // Setup Rename Document Modal
    const renameModal = document.getElementById('renameDocumentModal');
    const renameForm = document.getElementById('renameDocumentForm');
    const renameInput = document.getElementById('renameDocumentInput') as HTMLInputElement | null;
    const closeRenameModalBtn = document.getElementById('closeRenameDocumentModal');
    const cancelRenameModalBtn = document.getElementById('btnCancelRenameDocument');
    const renameModalBackdrop = document.getElementById('renameDocumentModalBackdrop');

    const closeRenameModal = () => {
        renameModal?.classList.add('hidden');
        renameDocIdx = null;
    };

    closeRenameModalBtn?.addEventListener('click', closeRenameModal);
    cancelRenameModalBtn?.addEventListener('click', closeRenameModal);
    if (renameModalBackdrop) {
        renameModalBackdrop.addEventListener('click', (e: any) => {
            if (e.target === renameModalBackdrop) closeRenameModal();
        });
    }

    renameForm?.addEventListener('submit', async (e: Event) => {
        e.preventDefault();
        if (renameDocIdx === null || !renameInput || !renameEntityId) return;

        const newName = renameInput.value.trim();
        if (!newName) {
            alert('O nome do documento não pode ser vazio.');
            return;
        }

        const doc = renameDocsList[renameDocIdx];
        if (newName === doc.name) {
            closeRenameModal();
            return;
        }

        doc.name = newName;

        const submitBtn = renameForm.querySelector('button[type="submit"]') as HTMLButtonElement | null;
        try {
            if (submitBtn) submitBtn.disabled = true;

            await api(`/entities/suppliers/${renameEntityId}`, {
                method: 'PUT',
                body: JSON.stringify({
                    cnpj_document_url: JSON.stringify(renameDocsList)
                })
            });

            UI.showAlert('alertMessage', 'Documento renomeado com sucesso!', 'success');
            await suppliersManager.loadData();
            closeRenameModal();
            if (activeRenderDetailsDocsList) {
                activeRenderDetailsDocsList();
            }
        } catch (err: any) {
            console.error('Erro ao renomear documento', err);
            alert(err.message || 'Erro ao renomear documento.');
        } finally {
            if (submitBtn) submitBtn.disabled = false;
        }
    });

    // Setup Delete Document Modal
    const deleteModal = document.getElementById('deleteDocumentModal');
    const cancelDeleteModalBtn = document.getElementById('btnCancelDeleteDocument');
    const confirmDeleteModalBtn = document.getElementById('btnConfirmDeleteDocument') as HTMLButtonElement | null;
    const deleteModalBackdrop = document.getElementById('deleteDocumentModalBackdrop');

    const closeDeleteModal = () => {
        deleteModal?.classList.add('hidden');
        deleteDocIdx = null;
    };

    cancelDeleteModalBtn?.addEventListener('click', closeDeleteModal);
    if (deleteModalBackdrop) {
        deleteModalBackdrop.addEventListener('click', (e: any) => {
            if (e.target === deleteModalBackdrop) closeDeleteModal();
        });
    }

    confirmDeleteModalBtn?.addEventListener('click', async () => {
        if (deleteDocIdx === null || !deleteEntityId) return;

        deleteDocsList.splice(deleteDocIdx, 1);
        try {
            if (confirmDeleteModalBtn) confirmDeleteModalBtn.disabled = true;

            await api(`/entities/suppliers/${deleteEntityId}`, {
                method: 'PUT',
                body: JSON.stringify({
                    cnpj_document_url: JSON.stringify(deleteDocsList)
                })
            });

            UI.showAlert('alertMessage', 'Documento excluído com sucesso!', 'success');
            await suppliersManager.loadData();
            closeDeleteModal();
            if (activeRenderDetailsDocsList) {
                activeRenderDetailsDocsList();
            }
        } catch (err: any) {
            console.error('Erro ao excluir documento', err);
            alert(err.message || 'Erro ao excluir documento.');
        } finally {
            if (confirmDeleteModalBtn) confirmDeleteModalBtn.disabled = false;
        }
    });

    const btnOpen = document.getElementById('btnOpenModal');
    if (btnOpen) {
      btnOpen.addEventListener('click', () => {
        (window as any).openModal('supplier');
      });
    }

    applySupplierPrefillFromQuery();
  });

  const makeMask: any = (window as any).createMaskAdapter || ((input: any, options: any) => (window as any).IMask(input, options));

  let docMask: any = null;
  let phoneMask: any = null;
  let zipMask: any = null;
  let entityIbgeStates: IbgeState[] = [];

  function onlyDigits(value: any): string {
    return String(value || '').replace(/\D/g, '');
  }

  function setMaskedValue(maskInstance: any, inputId: string, value: any): void {
    if (maskInstance) {
      if (inputId === 'entityDoc') {
        maskInstance.unmaskedValue = String(value || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      } else {
        maskInstance.unmaskedValue = onlyDigits(value);
      }
      return;
    }

    const input = document.getElementById(inputId) as HTMLInputElement | null;
    if (input) {
      input.value = value || '';
    }
  }

  function applySupplierPrefillFromQuery(): void {
    const params = new URLSearchParams(window.location.search);
    if (params.get('prefill') !== 'supplier') return;

    const prefillName = String(params.get('name') || '').trim();
    const prefillPhoneRaw = onlyDigits(params.get('phone') || '');
    const prefillPhone = (prefillPhoneRaw.length === 12 || prefillPhoneRaw.length === 13) && prefillPhoneRaw.startsWith('55')
      ? prefillPhoneRaw.slice(2)
      : prefillPhoneRaw;

    const openModalBtn = document.getElementById('btnOpenModal') as HTMLButtonElement | null;
    if (openModalBtn) {
      openModalBtn.click();
    } else {
      openModal('supplier');
    }

    window.requestAnimationFrame(() => {
      const nameInput = document.getElementById('entityName') as HTMLInputElement | null;
      const currentName = String(nameInput?.value || '').trim();
      if (nameInput && !currentName && prefillName) {
        nameInput.value = prefillName;
      }

      const currentPhone = phoneMask
        ? String(phoneMask.unmaskedValue || '')
        : onlyDigits((document.getElementById('entityPhone') as HTMLInputElement | null)?.value || '');
      if (!currentPhone && prefillPhone) {
        setMaskedValue(phoneMask, 'entityPhone', prefillPhone);
      }
    });

    if (typeof UI !== 'undefined' && UI.showAlert) {
      UI.showAlert('alertMessage', 'Preenchimento aplicado. Revise os dados e clique em Salvar.', 'success', 4500);
    }

    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete('prefill');
    cleanUrl.searchParams.delete('name');
    cleanUrl.searchParams.delete('phone');
    window.history.replaceState({}, '', `${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash}`);
  }

  function populateEntityStateOptions(selectedValue = ''): void {
    const stateSelect = document.getElementById('entityState') as HTMLSelectElement | null;
    if (!stateSelect || !entityIbgeStates.length) return;

    const normalizedSelectedValue = String(selectedValue || '').trim().toUpperCase();
    stateSelect.innerHTML = [
      '<option value="">Selecione...</option>',
      ...entityIbgeStates.map((state) => `<option value="${state.uf}">${state.uf} - ${state.name}</option>`),
    ].join('');
    stateSelect.value = entityIbgeStates.some((state) => state.uf === normalizedSelectedValue) ? normalizedSelectedValue : '';
  }

  async function loadEntityStateOptions(selectedValue = ''): Promise<void> {
    try {
      if (!entityIbgeStates.length) {
        const response = await api('/companies/states');
        entityIbgeStates = response.data || [];
      }

      populateEntityStateOptions(selectedValue);
    } catch (error) {
      console.error('Falha ao carregar UFs do IBGE para fornecedores', error);
    }
  }

  async function lookupAddressByCep(cep: any): Promise<CepLookupData | null> {
    const normalizedCep = onlyDigits(cep);
    if (normalizedCep.length !== 8) return null;

    let data: CepLookupData | null = null;
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
    } catch (_error) {
      // Fallback para BrasilAPI abaixo.
    }

    if (!data && !cepNotFound) {
      try {
        const brasilApiResponse = await fetch(`https://brasilapi.com.br/api/cep/v1/${normalizedCep}`);
        if (brasilApiResponse.ok) {
          data = (await brasilApiResponse.json()) as CepLookupData;
        }
      } catch (_error) {
        // Mantém null para o chamador tratar.
      }
    }

    return data;
  }

  function applyEntityCepLookupResult(data: CepLookupData | null): void {
    if (!data) return;

    const street = document.getElementById('entityStreet') as HTMLInputElement | null;
    const neighborhood = document.getElementById('entityNeighborhood') as HTMLInputElement | null;
    const city = document.getElementById('entityCity') as HTMLInputElement | null;
    const complement = document.getElementById('entityComplement') as HTMLInputElement | null;

    if (street) street.value = data.street || '';
    if (neighborhood) neighborhood.value = data.neighborhood || '';
    if (city) city.value = data.city || '';
    if (complement) complement.value = data.complement || '';
    populateEntityStateOptions(data.state || '');
  }

  async function handleEntityCepLookup(): Promise<void> {
    const loader = document.getElementById('cepLoading');
    const cep = zipMask
      ? zipMask.unmaskedValue
      : onlyDigits((document.getElementById('entityZipcode') as HTMLInputElement | null)?.value || '');
    if (cep.length !== 8) return;

    if (loader) loader.classList.remove('hidden');

    try {
      const data = await lookupAddressByCep(cep);
      if (data && (data.street || data.city)) {
        applyEntityCepLookupResult(data);
      } else {
        UI.showAlert('alertMessage', 'CEP não encontrado ou inválido.', 'error');
      }
    } catch (error) {
      console.error('Falha ao consultar CEP do fornecedor', error);
    } finally {
      if (loader) loader.classList.add('hidden');
    }
  }

  async function handleEntityCnpjLookup(): Promise<void> {
    const documentValue = docMask
      ? docMask.unmaskedValue
      : onlyDigits((document.getElementById('entityDoc') as HTMLInputElement | null)?.value || '');
    if (documentValue.length !== 14) return;

    try {
      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${documentValue}`);
      const data: any = await response.json();

      if (!response.ok || !data?.razao_social) {
        UI.showAlert('alertMessage', 'CNPJ não encontrado ou inválido.', 'error');
        return;
      }

      const nameInput = document.getElementById('entityName') as HTMLInputElement | null;
      if (nameInput && !nameInput.value.trim()) {
        nameInput.value = data.nome_fantasia || data.razao_social || '';
      }

      const emailEl = document.getElementById('entityEmail') as HTMLInputElement | null;
      const streetEl = document.getElementById('entityStreet') as HTMLInputElement | null;
      const numberEl = document.getElementById('entityNumber') as HTMLInputElement | null;
      const complementEl = document.getElementById('entityComplement') as HTMLInputElement | null;
      const neighborhoodEl = document.getElementById('entityNeighborhood') as HTMLInputElement | null;
      const cityEl = document.getElementById('entityCity') as HTMLInputElement | null;

      if (emailEl) emailEl.value = data.email || emailEl.value || '';
      setMaskedValue(phoneMask, 'entityPhone', data.ddd_telefone_1 || '');
      setMaskedValue(zipMask, 'entityZipcode', data.cep || '');
      if (streetEl) streetEl.value = data.logradouro || streetEl.value || '';
      if (numberEl) numberEl.value = data.numero || numberEl.value || '';
      if (complementEl) complementEl.value = data.complemento || complementEl.value || '';
      if (neighborhoodEl) neighborhoodEl.value = data.bairro || neighborhoodEl.value || '';
      if (cityEl) cityEl.value = data.municipio || cityEl.value || '';
      populateEntityStateOptions(data.uf || '');

      if (data.cep) {
        const cepData = await lookupAddressByCep(data.cep);
        if (cepData) {
          applyEntityCepLookupResult({
            ...cepData,
            complement: cepData.complement || data.complemento || '',
          });
        }
      }
    } catch (error) {
      console.error('Falha ao consultar CNPJ do fornecedor', error);
    }
  }

  // Modal Logic
  function openModal(type: string, data: Supplier | null = null): void {
    setValue('entityType', type);
    const isEdit = !!(data && data.public_id);

    const modalTitle = document.getElementById('modalTitle');
    if (modalTitle)
      modalTitle.textContent = isEdit ? 'Editar Fornecedor' : data ? 'Duplicar Fornecedor' : 'Novo Fornecedor';

    const saveBtn = document.getElementById('saveBtn');
    if (saveBtn)
      saveBtn.className =
        'w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-brand-600 text-base font-medium text-white hover:bg-brand-700 focus:outline-none sm:ml-3 sm:w-auto sm:text-sm';

    if (data) {
      setValue('entityId', isEdit ? data.public_id : '');
      setValue('entityName', data.name || '');
      setValue('entityEmail', data.email || '');
      setValue('entityStreet', data.street || '');
      setValue('entityNumber', data.number || '');
      setValue('entityComplement', data.complement || '');
      setValue('entityNeighborhood', data.neighborhood || '');
      setValue('entityCity', data.city || '');

      setText(
        'entityCertFileName',
        data.certificate_base64 ? 'Documento salvo. Selecione outro para substituir.' : 'Nenhum arquivo selecionado'
      );
      setValue('entityCertPassword', data.certificate_password || '');
      setValue(
        'entityCertExpiration',
        data.certificate_expiration ? String(data.certificate_expiration).split('T')[0] : ''
      );
      setText(
        'entityContractFileName',
        data.social_contract_base64 ? 'Documento salvo. Selecione outro para substituir.' : 'Nenhum arquivo selecionado'
      );
      setText(
        'entityCnpjFileName',
        data.cnpj_document_base64 ? 'Documento salvo. Selecione outro para substituir.' : 'Nenhum arquivo selecionado'
      );
    } else {
      (document.getElementById('entityForm') as HTMLFormElement | null)?.reset();
      setValue('entityId', '');
      setText('entityCertFileName', 'Nenhum arquivo selecionado');
      setValue('entityCertPassword', '');
      setValue('entityCertExpiration', '');
      setText('entityContractFileName', 'Nenhum arquivo selecionado');
      setText('entityCnpjFileName', 'Nenhum arquivo selecionado');
      void loadEntityStateOptions('');
    }

    // Initialize or Update Masks
    // Masks must be initialized BEFORE setting values so IMask can format them
    const docInput = document.getElementById('entityDoc') as HTMLInputElement | null;
    const phoneInput = document.getElementById('entityPhone') as HTMLInputElement | null;
    const zipInput = document.getElementById('entityZipcode') as HTMLInputElement | null;

    if (docInput && !docMask) {
      docMask = makeMask(docInput, {
        mask: [
          { mask: '000.000.000-00' },
          { 
            mask: 'XX.XXX.XXX/XXXX-XX',
            definitions: {
              'X': /[a-zA-Z0-9]/
            }
          }
        ],
        prepare: (str: string) => str.toUpperCase()
      });
      docInput.addEventListener('blur', () => {
        void handleEntityCnpjLookup();
      });
    }

    if (phoneInput && !phoneMask) {
      phoneMask = makeMask(phoneInput, {
        mask: [{ mask: '(00) 0000-0000' }, { mask: '(00) 00000-0000' }],
      });
    }

    if (zipInput && !zipMask) {
      zipMask = makeMask(zipInput, { mask: '00000-000' });
      if (zipMask?.on) {
        zipMask.on('complete', () => {
          void handleEntityCepLookup();
        });
      }
    }

    void loadEntityStateOptions(data ? data.state || '' : '');
    setMaskedValue(docMask, 'entityDoc', data ? data.cnpj_cpf || '' : '');
    setMaskedValue(phoneMask, 'entityPhone', data ? data.phone || '' : '');
    setMaskedValue(zipMask, 'entityZipcode', data ? data.zipcode || '' : '');

    if ((window as any).switchEntityTab) (window as any).switchEntityTab('data');
    document.getElementById('entityModal')?.classList.remove('hidden');
  }

  function setValue(id: string, value: string): void {
    const el = document.getElementById(id) as HTMLInputElement | HTMLSelectElement | null;
    if (el) el.value = value;
  }

  function setText(id: string, value: string): void {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  (window as any).openModal = openModal;

  const setupFileInput = (inputId: string, displayId: string) => {
    const input = document.getElementById(inputId) as HTMLInputElement | null;
    const display = document.getElementById(displayId);
    if (input && display) {
      input.addEventListener('change', (e) => {
        const target = e.target as HTMLInputElement | null;
        const files = target?.files;
        if (files && files.length > 0) {
          display.textContent = files[0].name;
        } else {
          display.textContent = 'Nenhum arquivo selecionado';
        }
      });
    }
  };

  setupFileInput('entityCertFile', 'entityCertFileName');
  setupFileInput('entityContractFile', 'entityContractFileName');
  setupFileInput('entityCnpjFile', 'entityCnpjFileName');

  const tryExtractCertDate = () => {
    const fileInput = document.getElementById('entityCertFile') as HTMLInputElement | null;
    const passInput = document.getElementById('entityCertPassword') as HTMLInputElement | null;
    const expInput = document.getElementById('entityCertExpiration') as HTMLInputElement | null;

    if (!fileInput || !passInput || !expInput) return;
    if (!forge || !fileInput.files || fileInput.files.length === 0) return;

    const password = passInput.value;
    if (!password) return;

    const file = fileInput.files[0];
    const ext = file.name.toLowerCase();
    if (!ext.endsWith('.pfx') && !ext.endsWith('.p12')) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const arrayBuffer = (e.target as FileReader | null)?.result as ArrayBuffer | null;
        if (!arrayBuffer) return;

        const bytes = new Uint8Array(arrayBuffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);

        const p12Asn1 = forge.asn1.fromDer(binary);
        const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, password);

        for (const safeBag of p12.safeContents) {
          if (safeBag.safeBags) {
            for (const bag of safeBag.safeBags) {
              if (bag.type === forge.pki.oids.certBag && bag.cert) {
                expInput.value = DateUtils.toDateInputValue(bag.cert.validity.notAfter);
                return;
              }
            }
          }
        }
      } catch (err: any) {
        console.warn(
          'Autoparse PKCS12 failed (possibly wrong password or incompatible format)',
          err?.message || String(err)
        );
      }
    };
    reader.readAsArrayBuffer(file);
  };

  if (document.getElementById('entityCertFile')) {
    document.getElementById('entityCertFile')?.addEventListener('change', tryExtractCertDate);
  }
  if (document.getElementById('entityCertPassword')) {
    // try whenever typing stops or changes
    document.getElementById('entityCertPassword')?.addEventListener('input', () => {
      clearTimeout((window as any).certParseTimer);
      (window as any).certParseTimer = setTimeout(tryExtractCertDate, 800);
    });
  }

  // Form Logic
  document.getElementById('entityForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const type = (document.getElementById('entityType') as HTMLInputElement | null)?.value;
    const entityId = (document.getElementById('entityId') as HTMLInputElement | null)?.value;
    const isEdit = !!entityId;

    const payload: AnyRecord = {
      name: (document.getElementById('entityName') as HTMLInputElement | null)?.value.trim(),
      cnpj_cpf: docMask
        ? docMask.unmaskedValue
        : (document.getElementById('entityDoc') as HTMLInputElement | null)?.value.trim(),
      email: (document.getElementById('entityEmail') as HTMLInputElement | null)?.value.trim(),
      phone: phoneMask
        ? phoneMask.unmaskedValue
        : (document.getElementById('entityPhone') as HTMLInputElement | null)?.value.trim(),
      zipcode:
        (zipMask
          ? zipMask.unmaskedValue
          : (document.getElementById('entityZipcode') as HTMLInputElement | null)?.value.trim()) || null,
      street: (document.getElementById('entityStreet') as HTMLInputElement | null)?.value.trim() || null,
      number: (document.getElementById('entityNumber') as HTMLInputElement | null)?.value.trim() || null,
      complement: (document.getElementById('entityComplement') as HTMLInputElement | null)?.value.trim() || null,
      neighborhood: (document.getElementById('entityNeighborhood') as HTMLInputElement | null)?.value.trim() || null,
      city: (document.getElementById('entityCity') as HTMLInputElement | null)?.value.trim() || null,
      state: (document.getElementById('entityState') as HTMLSelectElement | null)?.value.trim() || null,
      certificate_password: (document.getElementById('entityCertPassword') as HTMLInputElement | null)?.value.trim() || null,
      certificate_expiration: (document.getElementById('entityCertExpiration') as HTMLInputElement | null)?.value || null,
    };

    if (!payload.name) {
      UI.showAlert('alertMessage', 'O Nome / Razão Social é obrigatório', 'error');
      if ((window as any).switchEntityTab) (window as any).switchEntityTab('data');
      setTimeout(() => (document.getElementById('entityName') as HTMLInputElement | null)?.focus(), 100);
      return;
    }

    const fileInputs = [
      { id: 'entityCertFile', key: 'certificate_base64' },
      { id: 'entityContractFile', key: 'social_contract_base64' },
      { id: 'entityCnpjFile', key: 'cnpj_document_base64' },
    ];

    const getBase64 = (file: File) =>
      new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(String(reader.result).split(',')[1]);
        reader.onerror = (error) => reject(error);
      });

    for (const input of fileInputs) {
      const fileElement = document.getElementById(input.id) as HTMLInputElement | null;
      if (fileElement?.files && fileElement.files.length > 0) {
        payload[input.key] = await getBase64(fileElement.files[0]);
      }
    }

    const saveBtn = document.getElementById('saveBtn') as HTMLButtonElement | null;
    const originalText = saveBtn?.textContent || '';
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Salvando...';
    }

    const endpoint = isEdit ? `/entities/suppliers/${entityId}` : '/entities/suppliers';
    const method = isEdit ? 'PUT' : 'POST';

    try {
      await api(endpoint, {
        method,
        body: JSON.stringify(payload),
      });

      UI.showAlert('alertMessage', `Fornecedor ${isEdit ? 'atualizado' : 'cadastrado'} com sucesso!`, 'success');
      suppliersManager.closeModal();
      void suppliersManager.loadData(); // Reload tables
    } catch (error: any) {
      alert(error?.message); // Usar alert nativo para erros do modal pra simplificar
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = originalText || 'Salvar';
      }
    }
  });

  function formatDoc(doc: string): string {
    if (!doc) return '';
    const clean = doc.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    if (clean.length === 11) {
      return clean.replace(/([a-zA-Z0-9]{3})([a-zA-Z0-9]{3})([a-zA-Z0-9]{3})([a-zA-Z0-9]{2})/, '$1.$2.$3-$4');
    } else if (clean.length === 14) {
      return clean.replace(/([a-zA-Z0-9]{2})([a-zA-Z0-9]{3})([a-zA-Z0-9]{3})([a-zA-Z0-9]{4})([a-zA-Z0-9]{2})/, '$1.$2.$3/$4-$5');
    }
    return doc;
  }

  function formatPhone(phone: any): string {
    if (!phone) return '-';
    const clean = String(phone).replace(/\D/g, '');

    if (clean.length === 10) {
      return clean.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    }

    if (clean.length === 11) {
      return clean.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    }

    if (clean.length === 12) {
      return clean.replace(/(\d{2})(\d{2})(\d{4})(\d{4})/, '+$1 ($2) $3-$4');
    }

    if (clean.length === 13) {
      return clean.replace(/(\d{2})(\d{2})(\d{5})(\d{4})/, '+$1 ($2) $3-$4');
    }

    return String(phone);
  }

  function renderTable(elementId: string, items: Supplier[], offset = 0): void {
    const tbody = document.getElementById(elementId);
    if (!tbody) return;

    if (items.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="6" class="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">Nenhum fornecedor encontrado.</td></tr>';
      return;
    }

    tbody.innerHTML = items
      .map(
        (item: any, index: number) => `
        <tr class="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors group">
            <td class="px-3 py-4 whitespace-nowrap text-left w-12">
                <input type="checkbox" value="${item.public_id}" class="item-checkbox cursor-pointer rounded border-gray-300 dark:border-slate-600 text-brand-600 shadow-sm focus:border-brand-300 focus:ring focus:ring-brand-200 focus:ring-opacity-50 dark:bg-slate-800" data-bwignore="true" data-lpignore="true" placeholder="">
            </td>
            <td class="px-3 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-mono">
                #${String(offset + index + 1).padStart(4, '0')}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">${item.name}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${formatDoc(item.cnpj_cpf) || '-'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                ${item.email ? `<div class="truncate w-32" title="${item.email}">${item.email}</div>` : ''}
                ${item.phone ? `<div>${formatPhone(item.phone)}</div>` : '-'}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <button type="button" title="Visualizar" class="text-blue-600 hover:text-blue-900 dark:hover:text-blue-400 mr-3 view-details-btn" data-id="${item.public_id}" data-name="${item.name}">
                    <svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                </button>
                <button type="button" title="Editar" class="text-brand-600 hover:text-brand-900 dark:hover:text-brand-400 mr-3 edit-btn" data-item='${JSON.stringify(item).replace(/'/g, '&#39;')}'>
                    <svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                </button>
                <button type="button" title="Duplicar" class="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 mr-3 duplicate-btn" data-item='${JSON.stringify(item).replace(/'/g, '&#39;')}'>
                    <svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                </button>
                <button type="button" title="Excluir" class="text-red-600 hover:text-red-900 dark:hover:text-red-400 delete-btn" data-id="${item.public_id}">
                    <svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                </button>
            </td>
        </tr>
    `
      )
      .join('');
  }


  document.addEventListener('DOMContentLoaded', () => {
    const tabBtnData = document.getElementById('tabBtn-data');
    const tabBtnDocs = document.getElementById('tabBtn-docs');

    if (tabBtnData) {
      tabBtnData.addEventListener('click', () => switchEntityTab('data'));
    }
    if (tabBtnDocs) {
      tabBtnDocs.addEventListener('click', () => switchEntityTab('docs'));
    }

    const btnToggleCertPassword = document.getElementById('btnToggleCertPassword');
    if (btnToggleCertPassword) {
      btnToggleCertPassword.addEventListener('click', () => {
        if ((window as any).togglePasswordVisibility) {
          (window as any).togglePasswordVisibility('entityCertPassword');
        }
      });
    }

    const btnSearchEntityCep = document.getElementById('btnSearchEntityCep');
    if (btnSearchEntityCep) {
      btnSearchEntityCep.addEventListener('click', () => {
        void handleEntityCepLookup();
      });
    }

    const btnSearchCnpj = document.getElementById('btnSearchCnpj');
    if (btnSearchCnpj) {
      btnSearchCnpj.addEventListener('click', () => {
        void handleEntityCnpjLookup();
      });
    }
  });

  // UI function to toggle tabs
  function switchEntityTab(tabName: string): void {
    const tabs = ['data', 'docs'];

    tabs.forEach((tab) => {
      const btn = document.getElementById(`tabBtn-${tab}`);
      const content = document.getElementById(`tabContent-${tab}`);

      if (!btn || !content) return;

      if (tab === tabName) {
        btn.classList.add('border-brand-500', 'text-brand-600', 'dark:text-brand-300');
        btn.classList.remove('border-transparent', 'text-gray-500', 'dark:text-gray-400', 'hover:text-gray-700', 'hover:border-gray-300', 'dark:hover:text-gray-300');
        content.classList.remove('hidden');
        content.classList.add('block');
      } else {
        btn.classList.remove('border-brand-500', 'text-brand-600', 'dark:text-brand-300');
        btn.classList.add('border-transparent', 'text-gray-500', 'dark:text-gray-400', 'hover:text-gray-700', 'hover:border-gray-300', 'dark:hover:text-gray-300');
        content.classList.add('hidden');
        content.classList.remove('block');
      }
    });
  }

  // Expose
  (window as any).switchEntityTab = switchEntityTab;

  function togglePasswordVisibility(inputId: string): void {
    const input = document.getElementById(inputId) as HTMLInputElement | null;
    if (!input) return;

    // Find the SVG paths inside the button that toggle the visibility
    const button = input.nextElementSibling as HTMLElement | null;
    const svg = button?.querySelector('svg');
    if (!svg) return;

    if (input.type === 'password') {
      input.type = 'text';
      svg.innerHTML = `
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
        `;
    } else {
      input.type = 'password';
      svg.innerHTML = `
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        `;
    }
  }

  (window as any).togglePasswordVisibility = togglePasswordVisibility;

  // ── DETAILS MODAL CONTROL ──
  const getById = (id: string): any => document.getElementById(id);
  const qsa = (selector: string): any => document.querySelectorAll(selector);

  document.addEventListener('click', (e) => {
      const btn = (e.target as any)?.closest('.view-details-btn');
      if (btn) {
          const supplierId = btn.getAttribute('data-id');
          const supplierName = btn.getAttribute('data-name');
          if (supplierId && supplierName) {
              openViewDetailsModal(supplierId, supplierName);
          }
      }
  });

  // PDF Viewer Modal setup
  const pdfViewerModal = getById('pdfViewerModal');
  const pdfIframe = getById('pdfIframe') as HTMLIFrameElement | null;
  const pdfViewerModalTitle = getById('pdfViewerModalTitle');
  const downloadPdfModal = getById('downloadPdfModal') as HTMLAnchorElement | null;
  const closePdfModalBtn = getById('closePdfModal');
  const pdfViewerModalBackdrop = getById('pdfViewerModalBackdrop');

  const openPdfViewer = (url: string, title: string) => {
      if (!pdfViewerModal || !pdfIframe) return;
      pdfIframe.src = url;
      if (downloadPdfModal) {
          downloadPdfModal.href = url;
          downloadPdfModal.download = title || 'documento';
      }
      if (pdfViewerModalTitle) {
          pdfViewerModalTitle.textContent = title || 'Visualizar Documento';
      }
      pdfViewerModal.classList.remove('hidden');
  };

  const closePdfViewer = () => {
      if (!pdfViewerModal) return;
      pdfViewerModal.classList.add('hidden');
      if (pdfIframe) pdfIframe.src = '';
      if (downloadPdfModal) downloadPdfModal.href = '';
  };

  closePdfModalBtn?.addEventListener('click', closePdfViewer);
  if (pdfViewerModalBackdrop) {
      pdfViewerModalBackdrop.addEventListener('click', (e: any) => {
          if (e.target === pdfViewerModalBackdrop) closePdfViewer();
      });
  }

  document.addEventListener('click', (e) => {
      const btn = (e.target as any)?.closest('.btn-view-pdf-modal');
      if (btn) {
          e.preventDefault();
          const url = btn.getAttribute('data-url');
          const name = btn.getAttribute('data-name');
          if (url) {
              openPdfViewer(url, name || 'Visualizar Documento');
          }
      }
  });

  function formatSupplierLocation(item: any) {
      const city = String(item.city || '').trim();
      const state = String(item.state || '').trim();
      if (!city && !state) return 'Não informado';
      return [city, state].filter(Boolean).join(' / ');
  }

  async function openViewDetailsModal(supplierId: string, supplierName: string) {
      const modal = getById('viewSupplierDetailsModal');
      const closeBtn = getById('btnCloseViewDetailsModal');
      const cancelBtn = getById('btnCancelViewDetailsModal');
      const backdrop = getById('viewDetailsModalBackdrop');
      
      if (!modal) return;

      // Close modal actions
      const closeModal = () => {
          modal.classList.add('hidden');
      };
      closeBtn?.addEventListener('click', closeModal, { once: true });
      cancelBtn?.addEventListener('click', closeModal, { once: true });
      backdrop?.addEventListener('click', closeModal, { once: true });

      modal.classList.remove('hidden');

      // Populate basic supplier details
      const supplier = suppliersManager?.data?.find((c: any) => c.public_id === supplierId);
      
      const docEl = getById('viewDetailsDocument');
      const emailEl = getById('viewDetailsEmail');
      const phoneEl = getById('viewDetailsPhone');
      const locEl = getById('viewDetailsLocation');
      const titleNameEl = getById('viewDetailsSupplierName');

      if (titleNameEl) titleNameEl.textContent = supplierName;
      if (docEl) docEl.textContent = formatDoc(supplier?.cnpj_cpf);
      if (emailEl) {
          emailEl.textContent = supplier?.email || 'Não informado';
          emailEl.title = supplier?.email || '';
      }
      if (phoneEl) phoneEl.textContent = formatPhone(supplier?.phone);
      if (locEl) locEl.textContent = formatSupplierLocation(supplier);

      // Map configuration
      const mapSupplierAddressSpan = getById('mapSupplierAddress');
      const googleMapsIframe = getById('googleMapsIframe') as HTMLIFrameElement | null;
      const btnOpenWaze = getById('btnOpenWaze') as HTMLAnchorElement | null;
      const btnOpenGoogleMaps = getById('btnOpenGoogleMaps') as HTMLAnchorElement | null;

      if (supplier) {
          const supplierAddressParts = [
              supplier.street,
              supplier.number,
              supplier.neighborhood,
              supplier.city,
              supplier.state,
              supplier.zipcode
          ].filter(Boolean);
          const supplierAddressStr = supplierAddressParts.join(', ');

          if (mapSupplierAddressSpan) {
              mapSupplierAddressSpan.textContent = supplierAddressStr || 'Endereço não cadastrado';
          }

          const authCtx = (window as any).gNavbarAuthContext;
          const company = authCtx?.company;
          const companyAddressParts = company ? [
              company.street,
              company.number,
              company.neighborhood,
              company.city,
              company.state,
              company.zipcode
          ].filter(Boolean) : [];
          const companyAddressStr = companyAddressParts.join(', ');

          if (supplierAddressStr) {
              let embedUrl = '';
              let mapsUrl = '';
              let wazeUrl = '';

              if (companyAddressStr) {
                  embedUrl = `https://maps.google.com/maps?saddr=${encodeURIComponent(companyAddressStr)}&daddr=${encodeURIComponent(supplierAddressStr)}&output=embed`;
                  mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(companyAddressStr)}&destination=${encodeURIComponent(supplierAddressStr)}`;
                  wazeUrl = `https://waze.com/ul?q=${encodeURIComponent(supplierAddressStr)}&navigate=yes`;
              } else {
                  embedUrl = `https://maps.google.com/maps?q=${encodeURIComponent(supplierAddressStr)}&output=embed`;
                  mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(supplierAddressStr)}`;
                  wazeUrl = `https://waze.com/ul?q=${encodeURIComponent(supplierAddressStr)}&navigate=yes`;
              }

              if (googleMapsIframe) {
                  googleMapsIframe.src = embedUrl;
              }
              if (btnOpenWaze) {
                  btnOpenWaze.href = wazeUrl;
                  btnOpenWaze.classList.remove('hidden');
              }
              if (btnOpenGoogleMaps) {
                  btnOpenGoogleMaps.href = mapsUrl;
                  btnOpenGoogleMaps.classList.remove('hidden');
              }
          } else {
              if (googleMapsIframe) googleMapsIframe.removeAttribute('src');
              if (btnOpenWaze) btnOpenWaze.classList.add('hidden');
              if (btnOpenGoogleMaps) btnOpenGoogleMaps.classList.add('hidden');
          }
      } else {
          if (mapSupplierAddressSpan) mapSupplierAddressSpan.textContent = 'Fornecedor não encontrado';
          if (googleMapsIframe) googleMapsIframe.removeAttribute('src');
          if (btnOpenWaze) btnOpenWaze.classList.add('hidden');
          if (btnOpenGoogleMaps) btnOpenGoogleMaps.classList.add('hidden');
      }

        // Check permissions and hide tabs accordingly
        const tabConfig = [
            { id: 'tabButtonFinanceiro', module: 'revenues' },
            { id: 'tabButtonDocumento', module: 'suppliers' },
            { id: 'tabButtonAnotacoes', module: 'suppliers' },
            { id: 'tabButtonTarefas', module: 'tasks' },
            { id: 'tabButtonMapa', module: 'suppliers' }
        ];

        tabConfig.forEach(conf => {
            const btn = getById(conf.id);
            if (btn) {
                if (!hasViewPermission(conf.module)) {
                    btn.classList.add('hidden');
                } else {
                    btn.classList.remove('hidden');
                }
            }
        });

        resetDetailsModalTabs();

      // ── Loader / API calls ──
      const financialsTable = getById('viewDetailsFinancialsTable');
      const tasksTable = getById('viewDetailsTasksTable');
      const notesList = getById('viewDetailsNotesList');
      const docContainer = getById('viewDetailsDocumentContainer');

      if (financialsTable) financialsTable.innerHTML = '<tr><td colspan="5" class="px-4 py-3 text-center text-sm text-gray-500 dark:text-gray-400 font-sans animate-pulse">Carregando...</td></tr>';
      if (tasksTable) tasksTable.innerHTML = '<tr><td colspan="3" class="px-4 py-3 text-center text-sm text-gray-500 dark:text-gray-400 font-sans animate-pulse">Carregando...</td></tr>';
      if (notesList) notesList.innerHTML = '<p class="text-sm text-gray-500 dark:text-gray-400 font-sans animate-pulse">Carregando...</p>';
      if (docContainer) docContainer.innerHTML = '<p class="text-sm text-gray-500 dark:text-gray-400 font-sans animate-pulse">Carregando...</p>';

      try {
          const [revenuesRes, expensesRes, tasksRes] = await Promise.all([
              api('/finance/revenues').catch(() => ({ data: [] })),
              api('/finance/expenses').catch(() => ({ data: [] })),
              api('/tasks').catch(() => ({ data: [] }))
          ]);

          const revenues = (revenuesRes.data || []).filter((item: any) => item.entity_public_id === supplierId);
          const expenses = (expensesRes.data || []).filter((item: any) => item.entity_public_id === supplierId);
          
          const allTransactions = [
              ...revenues.map((r: any) => ({ ...r, txType: 'Receita' })),
              ...expenses.map((e: any) => ({ ...e, txType: 'Despesa' }))
          ];

          allTransactions.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());

          if (financialsTable) {
              if (allTransactions.length === 0) {
                  financialsTable.innerHTML = '<tr><td colspan="5" class="px-4 py-3 text-center text-sm text-gray-500 dark:text-gray-400 font-sans">Nenhum lançamento financeiro encontrado.</td></tr>';
              } else {
                  financialsTable.innerHTML = allTransactions.map((tx: any) => {
                      let dateStr = '-';
                      if (tx.date) {
                          try {
                              const d = new Date(tx.date);
                              if (!isNaN(d.getTime())) {
                                  const str = typeof tx.date === 'string' ? tx.date : d.toISOString();
                                  const matches = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
                                  if (matches) {
                                      dateStr = `${matches[3]}/${matches[2]}/${matches[1]}`;
                                  } else {
                                      dateStr = d.toLocaleDateString('pt-BR');
                                  }
                              }
                          } catch (e) {}
                      }
                      const formattedVal = Number(tx.amount || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                      const statusColor = tx.status === 'paid' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200' : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200';
                      const statusText = tx.status === 'paid' ? 'Pago' : 'Pendente';
                      const typeColor = tx.txType === 'Receita' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';

                      return `
                          <tr class="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                              <td class="px-4 py-3 text-sm font-semibold ${typeColor} font-sans">${tx.txType}</td>
                              <td class="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 font-sans">${tx.description || '-'}</td>
                              <td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 font-mono">${dateStr}</td>
                              <td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 font-sans">
                                  <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColor}">${statusText}</span>
                              </td>
                              <td class="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 text-right font-mono">${formattedVal}</td>
                          </tr>
                      `;
                  }).join('');
              }
          }

          const tasks = (tasksRes.data || []).filter((t: any) => t.personType === 'supplier' && t.personId === supplierId);
          if (tasksTable) {
              if (tasks.length === 0) {
                  tasksTable.innerHTML = '<tr><td colspan="3" class="px-4 py-3 text-center text-sm text-gray-500 dark:text-gray-400 font-sans">Nenhuma tarefa encontrada.</td></tr>';
              } else {
                  tasksTable.innerHTML = tasks.map((tk: any) => {
                      let dateStr = '-';
                      if (tk.due_date) {
                          try {
                              const d = new Date(tk.due_date);
                              if (!isNaN(d.getTime())) {
                                  dateStr = d.toLocaleDateString('pt-BR');
                              }
                          } catch (e) {}
                      }
                      const statusColor = tk.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200';
                      const statusText = tk.status === 'completed' ? 'Concluída' : 'Pendente';

                      return `
                          <tr class="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                              <td class="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 font-sans">${tk.title}</td>
                              <td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 font-mono">${dateStr}</td>
                              <td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 font-sans">
                                  <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColor}">${statusText}</span>
                              </td>
                          </tr>
                      `;
                  }).join('');
              }
          }

          const fetchAndRenderNotes = async () => {
              if (!notesList) return;
              try {
                  const res = await api(`/entities/suppliers/${supplierId}/notes`);
                  const notes = res.data || [];
                  if (notes.length === 0) {
                      notesList.innerHTML = '<p class="text-sm text-gray-500 dark:text-gray-400 font-sans text-center py-4">Nenhuma anotação registrada.</p>';
                      return;
                  }
                  notesList.innerHTML = notes.map((n: any) => {
                      const dateStr = n.created_at ? formatNoteDate(n.created_at) : '';
                      return `
                          <div class="p-3 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-sm flex justify-between items-start gap-4">
                              <div class="flex-1 min-w-0">
                                  <p class="text-xs font-semibold text-brand-600 dark:text-brand-400 font-sans mb-1">
                                      ${n.user_name || 'Usuário'} · <span class="text-gray-400 dark:text-gray-500 font-normal font-mono text-[10px]">${dateStr}</span>
                                  </p>
                                  <p class="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap font-sans">${n.note}</p>
                              </div>
                              <button type="button" class="btn-delete-supplier-note text-gray-400 hover:text-red-500 p-1 rounded transition-colors" data-id="${n.public_id}" title="Excluir anotação">
                                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                                  </svg>
                              </button>
                          </div>
                      `;
                  }).join('');

                  notesList.querySelectorAll('.btn-delete-supplier-note').forEach((btn: any) => {
                      btn.addEventListener('click', async () => {
                          const noteId = btn.dataset.id;
                          if (!noteId) return;
                          if (!confirm('Deseja realmente excluir esta anotação?')) return;
                          try {
                              btn.disabled = true;
                              await api(`/entities/suppliers/${supplierId}/notes/${noteId}`, { method: 'DELETE' });
                              UI.showAlert('alertMessage', 'Anotação excluída com sucesso!', 'success');
                              await fetchAndRenderNotes();
                          } catch (err: any) {
                              alert(err.message || 'Erro ao excluir anotação.');
                              btn.disabled = false;
                          }
                      });
                  });
              } catch (err) {
                  notesList.innerHTML = '<p class="text-sm text-red-500 font-sans">Erro ao carregar anotações.</p>';
              }
          };

          await fetchAndRenderNotes();

          const notesForm = getById('viewDetailsNotesForm');
          if (notesForm) {
              const newForm = notesForm.cloneNode(true);
              notesForm.parentNode.replaceChild(newForm, notesForm);
              newForm.addEventListener('submit', async (e: any) => {
                  e.preventDefault();
                  const txtInput = getById('detailNoteText');
                  const val = txtInput?.value?.trim();
                  if (!val) return;
                  const submitBtn = getById('btnSubmitDetailNote');
                  try {
                    if (submitBtn) submitBtn.disabled = true;
                    await api(`/entities/suppliers/${supplierId}/notes`, {
                        method: 'POST',
                        body: JSON.stringify({ note: val })
                    });
                    if (txtInput) txtInput.value = '';
                    UI.showAlert('alertMessage', 'Anotação adicionada!', 'success');
                    await fetchAndRenderNotes();
                  } catch (err: any) {
                      alert(err.message || 'Erro ao criar anotação.');
                  } finally {
                      if (submitBtn) submitBtn.disabled = false;
                  }
              });
          }

          let docUrlField = supplier?.cnpj_document_url;
          let docsList: { name: string; url: string; attachedAt?: string }[] = [];
          if (docUrlField) {
              try {
                  let parsed: any[] = [];
                  if (docUrlField.trim().startsWith('[')) {
                      parsed = JSON.parse(docUrlField);
                  } else {
                      parsed = [docUrlField];
                  }
                  docsList = parsed.map(item => {
                      if (typeof item === 'string') {
                          return { name: item.substring(item.lastIndexOf('/') + 1), url: item, attachedAt: new Date().toISOString() };
                      }
                      return {
                          name: item.name || item.url.substring(item.url.lastIndexOf('/') + 1),
                          url: item.url,
                          attachedAt: item.attachedAt || new Date().toISOString()
                      };
                  }).filter(d => d && d.url);
              } catch (e) {
                  docsList = [{ name: docUrlField.substring(docUrlField.lastIndexOf('/') + 1), url: docUrlField, attachedAt: new Date().toISOString() }];
              }
          }

          const renderDetailsDocsList = () => {
              if (!docContainer) return;
              docsList.sort((a, b) => new Date(b.attachedAt || 0).getTime() - new Date(a.attachedAt || 0).getTime());
              if (docsList.length === 0) {
                  docContainer.innerHTML = `
                      <div class="flex flex-col items-center justify-center py-12 gap-2 text-gray-400 dark:text-gray-500 w-full font-sans">
                          <svg class="w-12 h-12 text-gray-300 dark:text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                          </svg>
                          <p class="text-sm font-medium">Nenhum documento anexado para este fornecedor.</p>
                      </div>
                  `;
                  return;
              }

              const cardsHtml = docsList.map((doc, idx) => {
                  const fileName = doc.url.substring(doc.url.lastIndexOf('/') + 1);
                  const attachedDateStr = formatAttachedDate(doc.attachedAt);
                  return `
                      <div class="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm hover:border-brand-300 dark:hover:border-brand-700 transition-all font-sans font-medium">
                          <button type="button" class="btn-view-pdf-modal flex items-center gap-3 flex-1 min-w-0 mr-4 group text-left cursor-pointer" data-url="${doc.url}" data-name="${doc.name || fileName}">
                              <div class="p-2 rounded bg-brand-50 dark:bg-brand-950/40 text-brand-600 dark:text-brand-400 group-hover:bg-brand-100 dark:group-hover:bg-brand-900/60 transition-colors">
                                  <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                                  </svg>
                              </div>
                              <div class="flex-1 min-w-0">
                                  <p class="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">${doc.name}</p>
                                  <p class="text-[11px] text-gray-500 dark:text-gray-400 truncate mt-0.5">${fileName}</p>
                                  ${attachedDateStr ? `
                                      <p class="text-[10px] text-gray-400 dark:text-gray-500 font-mono mt-1 flex items-center gap-1">
                                          <svg class="w-3.5 h-3.5 shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                                          ${attachedDateStr}
                                      </p>
                                  ` : ''}
                              </div>
                          </button>
                          <div class="flex items-center gap-1.5 shrink-0">
                              <button type="button" class="btn-rename-detail-doc p-1.5 rounded text-gray-500 hover:text-brand-600 hover:bg-brand-50 dark:text-gray-400 dark:hover:text-brand-400 dark:hover:bg-brand-950/30 transition-colors" data-index="${idx}" title="Renomear documento">
                                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path>
                                  </svg>
                              </button>
                              <button type="button" class="btn-delete-detail-doc p-1.5 rounded text-gray-500 hover:text-red-600 hover:bg-red-50 dark:text-gray-400 dark:hover:text-red-400 dark:hover:bg-red-950/30 transition-colors" data-index="${idx}" title="Excluir documento">
                                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                                  </svg>
                              </button>
                          </div>
                      </div>
                  `;
              }).join('');

              docContainer.innerHTML = `
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
                      ${cardsHtml}
                  </div>
              `;

              docContainer.querySelectorAll('.btn-rename-detail-doc').forEach((btn: any) => {
                  btn.addEventListener('click', async (e: Event) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const idx = parseInt(btn.dataset.index);
                      if (isNaN(idx)) return;
                      
                      renameDocIdx = idx;
                      renameDocsList = docsList;
                      renameEntityId = supplierId;
                      activeRenderDetailsDocsList = renderDetailsDocsList;

                      const renameModal = document.getElementById('renameDocumentModal');
                      const renameInput = document.getElementById('renameDocumentInput') as HTMLInputElement | null;
                      if (renameInput) {
                          renameInput.value = docsList[idx].name || '';
                      }
                      renameModal?.classList.remove('hidden');
                      renameInput?.focus();
                  });
              });

              docContainer.querySelectorAll('.btn-delete-detail-doc').forEach((btn: any) => {
                  btn.addEventListener('click', async (e: Event) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const idx = parseInt(btn.dataset.index);
                      if (isNaN(idx)) return;
                      
                      deleteDocIdx = idx;
                      deleteDocsList = docsList;
                      deleteEntityId = supplierId;
                      activeRenderDetailsDocsList = renderDetailsDocsList;

                      const deleteModal = document.getElementById('deleteDocumentModal');
                      const docNameSpan = document.getElementById('deleteDocumentName');
                      if (docNameSpan) {
                          docNameSpan.textContent = docsList[idx].name || '';
                      }
                      deleteModal?.classList.remove('hidden');
                  });
              });
          };

          renderDetailsDocsList();

          const detailCnpjFileInput = getById('detailCnpjFile') as HTMLInputElement | null;
          if (detailCnpjFileInput) {
              const newFileInput = detailCnpjFileInput.cloneNode(true) as HTMLInputElement;
              detailCnpjFileInput.parentNode?.replaceChild(newFileInput, detailCnpjFileInput);
              newFileInput.addEventListener('change', async (e: any) => {
                  const input = e.target as HTMLInputElement;
                  const files = Array.from(input.files || []);
                  if (files.length === 0) return;
                  const uploads: { name: string; base64: string; attachedAt: string; filename?: string }[] = [];
                  for (const file of files) {
                      const f = file as any;
                      try {
                          const b64 = (await getBase64(f)) as string;
                          const defaultName = f.name.substring(0, f.name.lastIndexOf('.')) || f.name;
                          uploads.push({
                              name: defaultName,
                              base64: b64,
                              attachedAt: new Date().toISOString(),
                              filename: f.name
                          });
                      } catch (err) {
                          console.error('Erro ao ler arquivo para upload', err);
                      }
                  }
                  if (uploads.length > 0) {
                      try {
                          newFileInput.disabled = true;
                          if (docContainer) {
                              docContainer.innerHTML = '<p class="text-sm text-gray-500 dark:text-gray-400">Enviando documentos...</p>';
                          }
                          await api(`/entities/suppliers/${supplierId}`, {
                              method: 'PUT',
                              body: JSON.stringify({
                                  cnpj_document_url: JSON.stringify(docsList),
                                  cnpj_document_uploads: uploads
                              })
                          });
                          UI.showAlert('alertMessage', 'Documentos anexados com sucesso!', 'success');
                          await suppliersManager.loadData();
                          const updatedSupplier = suppliersManager?.data?.find((c: any) => c.public_id === supplierId);
                          const updatedField = updatedSupplier?.cnpj_document_url;
                          docsList = [];
                          if (updatedField) {
                              try {
                                  let parsed: any[] = [];
                                  if (updatedField.trim().startsWith('[')) {
                                      parsed = JSON.parse(updatedField);
                                  } else {
                                      parsed = [updatedField];
                                  }
                                  docsList = parsed.map(item => {
                                      if (typeof item === 'string') {
                                          return { name: item.substring(item.lastIndexOf('/') + 1), url: item, attachedAt: new Date().toISOString() };
                                      }
                                      return {
                                          name: item.name || item.url.substring(item.url.substring.lastIndexOf('/') + 1),
                                          url: item.url,
                                          attachedAt: item.attachedAt || new Date().toISOString()
                                      };
                                  }).filter(d => d && d.url);
                              } catch (e) {
                                  docsList = [{ name: updatedField.substring(updatedField.lastIndexOf('/') + 1), url: updatedField, attachedAt: new Date().toISOString() }];
                              }
                          }
                          renderDetailsDocsList();
                      } catch (err: any) {
                          alert(err.message || 'Erro ao anexar documentos.');
                      } finally {
                          newFileInput.disabled = false;
                          newFileInput.value = '';
                      }
                  }
              });
          }

      } catch (error) {
          console.error('Erro ao carregar detalhes do fornecedor:', error);
          UI.showAlert('alertMessage', 'Falha ao carregar detalhes.', 'error');
      }
  }

  function getBase64(file: File): Promise<string | ArrayBuffer | null> {
      return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = () => resolve(reader.result);
          reader.onerror = error => reject(error);
      });
  }

  function formatAttachedDate(isoStr?: string) {
      if (!isoStr) return '';
      try {
          const d = new Date(isoStr);
          if (isNaN(d.getTime())) return '';
          const day = String(d.getDate()).padStart(2, '0');
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const year = d.getFullYear();
          const hour = String(d.getHours()).padStart(2, '0');
          const min = String(d.getMinutes()).padStart(2, '0');
          return `${day}/${month}/${year} às ${hour}:${min}`;
      } catch (e) {
          return '';
      }
  }

  function formatNoteDate(isoStr?: string) {
      if (!isoStr) return '';
      try {
          const d = new Date(isoStr);
          if (isNaN(d.getTime())) return '';
          const day = String(d.getDate()).padStart(2, '0');
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const year = d.getFullYear();
          const hour = String(d.getHours()).padStart(2, '0');
          const min = String(d.getMinutes()).padStart(2, '0');
          return `${day}/${month}/${year} às ${hour}:${min}`;
      } catch (e) {
          return '';
      }
  }

  const hasViewPermission = (moduleName: string): boolean => {
      const authCtx = (window as any).gNavbarAuthContext;
      if (!authCtx) return true;
      const role = authCtx.user?.role || '';
      if (role === 'super_admin' || role === 'admin' || role === 'supervisor') return true;
      const permissions: any[] = authCtx.permissions || [];
      if (permissions.length === 0) return true;
      return permissions.some((p: any) => p.module === moduleName && p.can_view);
  };

  function setupDetailsModalTabs() {
      const tabButtons = document.querySelectorAll('#viewSupplierDetailsModal .details-modal-tab');
      tabButtons.forEach((btn: any) => {
          btn.addEventListener('click', () => {
              const targetId = btn.getAttribute('data-details-tab-target');
              if (!targetId) return;
              tabButtons.forEach((b: any) => {
                  const isActive = b === btn;
                  b.setAttribute('aria-selected', String(isActive));
                  b.classList.toggle('border-brand-500', isActive);
                  b.classList.toggle('text-brand-600', isActive);
                  b.classList.toggle('dark:text-brand-300', isActive);
                  b.classList.toggle('border-transparent', !isActive);
                  b.classList.toggle('text-gray-500', !isActive);
                  b.classList.toggle('dark:text-gray-400', !isActive);
              });
              document.querySelectorAll('#viewSupplierDetailsModal .details-modal-tab-panel').forEach((panel: any) => {
                  if (panel.id === targetId) {
                      panel.classList.remove('hidden');
                  } else {
                      panel.classList.add('hidden');
                  }
              });
          });
      });
  }

  function resetDetailsModalTabs() {
      const tabButtons = Array.from(document.querySelectorAll('#viewSupplierDetailsModal .details-modal-tab'));
      const visibleButtons = tabButtons.filter((btn: any) => !btn.classList.contains('hidden'));
      
      tabButtons.forEach((btn: any) => {
          const isSelected = visibleButtons.length > 0 && btn === visibleButtons[0];
          btn.setAttribute('aria-selected', String(isSelected));
          btn.classList.toggle('border-brand-500', isSelected);
          btn.classList.toggle('text-brand-600', isSelected);
          btn.classList.toggle('dark:text-brand-300', isSelected);
          btn.classList.toggle('border-transparent', !isSelected);
          btn.classList.toggle('text-gray-500', !isSelected);
          btn.classList.toggle('dark:text-gray-400', !isSelected);
      });

      document.querySelectorAll('#viewSupplierDetailsModal .details-modal-tab-panel').forEach((panel: any) => {
          const panelId = panel.getAttribute('id');
          const correspondingBtn = tabButtons.find((btn: any) => btn.getAttribute('data-details-tab-target') === panelId);
          const shouldBeVisible = correspondingBtn && visibleButtons.length > 0 && correspondingBtn === visibleButtons[0];
          
          if (shouldBeVisible) {
              panel.classList.remove('hidden');
          } else {
              panel.classList.add('hidden');
          }
      });
  }

  (window as any).togglePasswordVisibility = togglePasswordVisibility;

  // ── Solidcon Modal & Import Handlers ──────────────────────────────
  let solidconFetchedPayload: any = null;

  const setSolidconStatus = (message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    const statusEl = document.getElementById('solidconImportStatus');
    if (!statusEl) return;
    const colors: Record<string, string> = {
      info: 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
      success: 'bg-green-50 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800',
      warning: 'bg-yellow-50 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800',
      error: 'bg-red-50 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800'
    };
    statusEl.className = `mt-3 text-sm rounded-md px-3 py-2 border ${colors[type] || colors.info}`;
    statusEl.textContent = message;
    statusEl.classList.remove('hidden');
  };

  const clearSolidconStatus = () => {
    const statusEl = document.getElementById('solidconImportStatus');
    if (statusEl) {
      statusEl.textContent = '';
      statusEl.classList.add('hidden');
    }
    const detailsEl = document.getElementById('solidconImportDetails');
    if (detailsEl) {
      detailsEl.innerHTML = '';
      detailsEl.classList.add('hidden');
    }
  };

  const openSolidconModal = () => {
    const modal = document.getElementById('solidconModal');
    if (!modal) return;
    solidconFetchedPayload = null;
    clearSolidconStatus();

    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const startEl = document.getElementById('solidconStartDate') as HTMLInputElement | null;
    const endEl = document.getElementById('solidconEndDate') as HTMLInputElement | null;
    if (startEl && !startEl.value) {
      startEl.value = firstDay.toISOString().split('T')[0];
    }
    if (endEl && !endEl.value) {
      endEl.value = lastDay.toISOString().split('T')[0];
    }

    modal.classList.remove('hidden');
  };

  const closeSolidconModal = () => {
    const modal = document.getElementById('solidconModal');
    if (modal) modal.classList.add('hidden');
    solidconFetchedPayload = null;
    clearSolidconStatus();
  };

  const showSolidconIgnoredDetails = (errors: Array<{ index: number; reason: string }>) => {
    const detailsEl = document.getElementById('solidconImportDetails');
    if (!detailsEl) return;
    if (!errors || errors.length === 0) {
      detailsEl.classList.add('hidden');
      detailsEl.innerHTML = '';
      return;
    }

    const reasonsMap = new Map<string, number>();
    errors.forEach((item: any) => {
      const key = String(item?.reason || 'Motivo não informado').trim();
      reasonsMap.set(key, (reasonsMap.get(key) || 0) + 1);
    });

    const reasonSummary = Array.from(reasonsMap.entries())
      .map(([reason, count]) => `• ${reason}: <strong>${count}</strong> item(ns)`)
      .join('<br>');

    const examples = errors.slice(0, 20)
      .map((item: any) => `Item #${Number(item?.index || 0) + 1}: ${item?.reason || 'Motivo não informado.'}`)
      .join('<br>');

    detailsEl.innerHTML = `<div class="font-semibold">Por que foi ignorado</div><div class="mt-1">${reasonSummary}</div><div class="mt-2 font-semibold">Exemplos</div><div class="mt-1">${examples}${errors.length > 20 ? `<br>... mais ${errors.length - 20} item(ns)` : ''}</div>`;
    detailsEl.classList.remove('hidden');
  };

  const getSelectedSolidconUrl = () => {
    const urls = (window as any).currentSolidconUrls || [];
    return urls.find((url: string) => String(url || '').trim()) || '';
  };

  const btnOpenSolidconModal = document.getElementById('btnOpenSolidconModal');
  if (btnOpenSolidconModal) btnOpenSolidconModal.addEventListener('click', openSolidconModal);

  const btnCloseSolidconModal = document.getElementById('btnCloseSolidconModal');
  if (btnCloseSolidconModal) btnCloseSolidconModal.addEventListener('click', closeSolidconModal);

  const btnCancelSolidconModal = document.getElementById('btnCancelSolidconModal');
  if (btnCancelSolidconModal) btnCancelSolidconModal.addEventListener('click', closeSolidconModal);

  const solidconModalBackdrop = document.getElementById('solidconModalBackdrop');
  if (solidconModalBackdrop) {
    solidconModalBackdrop.addEventListener('click', (e) => {
      if (e.target === solidconModalBackdrop) closeSolidconModal();
    });
  }

  const btnFetchSolidconJson = document.getElementById('btnFetchSolidconJson') as HTMLButtonElement | null;
  if (btnFetchSolidconJson) {
    btnFetchSolidconJson.addEventListener('click', async () => {
      clearSolidconStatus();

      const connectionType = (document.getElementById('solidconConnectionType') as HTMLSelectElement | null)?.value || 'api';
      const startVal = (document.getElementById('solidconStartDate') as HTMLInputElement | null)?.value;
      const endVal = (document.getElementById('solidconEndDate') as HTMLInputElement | null)?.value;

      if (!startVal || !endVal) {
        setSolidconStatus('Preencha as datas Inicial e Final.', 'warning');
        return;
      }

      btnFetchSolidconJson.disabled = true;
      const originalHtml = btnFetchSolidconJson.innerHTML;
      btnFetchSolidconJson.textContent = 'Consultando...';

      const reqBody: any = { connectionType, startDate: startVal, endDate: endVal, target: 'suppliers' };

      if (connectionType === 'api') {
        const url = getSelectedSolidconUrl();
        if (!url) {
          setSolidconStatus('URL Solidcon não configurada. Salve na tela Minha Empresa > API/Solidcon.', 'warning');
          btnFetchSolidconJson.innerHTML = originalHtml;
          btnFetchSolidconJson.disabled = false;
          return;
        }
        let fullUrl = url;
        try {
          const urlObj = new URL(url);
          urlObj.searchParams.set('dataInicial', startVal);
          urlObj.searchParams.set('dataFinal', endVal);
          fullUrl = urlObj.toString();
        } catch {
          const separator = url.includes('?') ? '&' : '?';
          fullUrl = `${url}${separator}dataInicial=${startVal}&dataFinal=${endVal}`;
        }
        reqBody.url = fullUrl;
      }

      try {
        const response = await api('/companies/proxy-consulta', {
          method: 'POST',
          body: JSON.stringify(reqBody)
        });
        const payload = response?.data ?? response;
        solidconFetchedPayload = payload;

        const items = Array.isArray(payload) ? payload : (payload?.data || payload?.items || payload?.rows || payload?.suppliers || payload?.fornecedores || []);
        const count = Array.isArray(items) ? items.length : 0;
        setSolidconStatus(`Dados carregados com sucesso (${count} registros). Clique em "Importar" para salvar.`, 'success');
      } catch (err: any) {
        const msg = String(err?.message || '').trim();
        if (
          msg.toLowerCase().includes('fora') ||
          msg.toLowerCase().includes('timeout') ||
          msg.toLowerCase().includes('failed to connect') ||
          msg.toLowerCase().includes('inacessivel') ||
          msg.toLowerCase().includes('inacessível') ||
          msg.toLowerCase().includes('conexão') ||
          msg.toLowerCase().includes('conexao') ||
          msg.toLowerCase().includes('refused') ||
          msg.toLowerCase().includes('network') ||
          msg.toLowerCase().includes('fetch failed')
        ) {
          setSolidconStatus(msg || 'Não foi possível conectar ao banco de dados Solidcon. O servidor está fora do ar ou inacessível no momento.', 'error');
        } else {
          setSolidconStatus(msg || 'Não foi possível conectar ao banco de dados Solidcon. O servidor está fora do ar.', 'error');
        }
      } finally {
        btnFetchSolidconJson.innerHTML = originalHtml;
        btnFetchSolidconJson.disabled = false;
      }
    });
  }

  const solidconImportForm = document.getElementById('solidconImportForm');
  if (solidconImportForm) {
    solidconImportForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearSolidconStatus();

      if (!solidconFetchedPayload) {
        setSolidconStatus('Nenhum dado carregado. Por favor, clique em "Consulta" antes de importar.', 'warning');
        return;
      }

      const submitBtn = document.getElementById('btnExecuteSolidconImport') as HTMLButtonElement | null;
      const cancelBtn = document.getElementById('btnCancelSolidconModal') as HTMLButtonElement | null;
      const closeBtn = document.getElementById('btnCloseSolidconModal') as HTMLButtonElement | null;

      if (submitBtn) submitBtn.disabled = true;
      if (cancelBtn) cancelBtn.disabled = true;
      if (closeBtn) closeBtn.disabled = true;

      const originalBtnText = submitBtn ? submitBtn.textContent : 'Importar';
      if (submitBtn) submitBtn.textContent = 'Importando...';

      try {
        const result = await api('/entities/suppliers/solidcon-import', {
          method: 'POST',
          body: JSON.stringify({
            payload: solidconFetchedPayload
          })
        });

        const data = result?.data || {};
        const created = data.created ?? 0;
        const updated = data.updated ?? 0;
        const skipped = data.skipped ?? 0;
        const errors = Array.isArray(data.errors) ? data.errors : [];
        const message = `Importação concluída: ${created} novos, ${updated} atualizados, ${skipped} ignorados.`;
        setSolidconStatus(message, created || updated ? 'success' : 'warning');
        showSolidconIgnoredDetails(errors);

        // Refresh suppliers list
        await suppliersManager.loadData();
      } catch (err: any) {
        setSolidconStatus(err.message || 'Erro ao importar fornecedores da Solidcon.', 'error');
      } finally {
        if (submitBtn) {
          submitBtn.textContent = originalBtnText;
          submitBtn.disabled = false;
        }
        if (cancelBtn) cancelBtn.disabled = false;
        if (closeBtn) closeBtn.disabled = false;
      }
    });
  }

  (window as any).openSolidconModal = openSolidconModal;
  (window as any).closeSolidconModal = closeSolidconModal;
})();
