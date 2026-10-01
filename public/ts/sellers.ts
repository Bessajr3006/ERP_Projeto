(() => {
  type AnyRecord = Record<string, any>;

  const AuthRef: any = (window as any).Auth;
  const api: any = (window as any).api;
  const UI: any = (window as any).UI;
  const CrudManager: any = (window as any).CrudManager;
  const FilterPanel: any = (window as any).FilterPanel;
  const GridSummaryFooter: any = (window as any).GridSummaryFooter;

  const makeMask: any =
    (window as any).createMaskAdapter || ((input: HTMLInputElement, options: AnyRecord) => (window as any).IMask(input, options));

  let sellersManager: any;

  let sellerDocMask: any = null;
  let sellerPhoneMask: any = null;
  let sellerZipMask: any = null;
  let sellerIbgeStates: AnyRecord[] = [];

  let allCustomers: AnyRecord[] = [];
  let sellerClients: AnyRecord[] = [];
  let currentSellerId: string | null = null;
  let companyPublicId: string = '';
  let sendLinkTargetSellerId: string | null = null;
  let sendLinkTargetSellerName: string = '';
  let sendLinkMask: any = null;

  const getEl = <T extends HTMLElement = HTMLElement>(id: string): T | null =>
    document.getElementById(id) as T | null;

  const onlyDigits = (value: any): string => String(value || '').replace(/\D/g, '');

  function setMaskedValue(maskInstance: any, inputId: string, value: any): void {
    if (maskInstance) {
      if (inputId === 'sellerDocument') {
        maskInstance.unmaskedValue = String(value || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      } else {
        maskInstance.unmaskedValue = onlyDigits(value);
      }
      return;
    }
    const input = getEl<HTMLInputElement>(inputId);
    if (input) input.value = value || '';
  }

  function getMaskedValue(maskInstance: any, inputId: string): string {
    if (maskInstance) return maskInstance.unmaskedValue || '';
    const val = getEl<HTMLInputElement>(inputId)?.value || '';
    if (inputId === 'sellerDocument') {
      return String(val).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    }
    return onlyDigits(val);
  }

  function getTrimmedValue(inputId: string): string {
    return String(getEl<HTMLInputElement | HTMLSelectElement>(inputId)?.value || '').trim();
  }

  function formatDoc(doc: any): string {
    if (!doc) return '-';
    const clean = String(doc).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    if (clean.length === 11) return clean.replace(/([a-zA-Z0-9]{3})([a-zA-Z0-9]{3})([a-zA-Z0-9]{3})([a-zA-Z0-9]{2})/, '$1.$2.$3-$4');
    if (clean.length === 14) return clean.replace(/([a-zA-Z0-9]{2})([a-zA-Z0-9]{3})([a-zA-Z0-9]{3})([a-zA-Z0-9]{4})([a-zA-Z0-9]{2})/, '$1.$2.$3/$4-$5');
    return String(doc);
  }

  function formatPhone(phone: any): string {
    if (!phone) return '-';
    const clean = String(phone).replace(/\D/g, '');
    if (clean.length === 10) return clean.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    if (clean.length === 11) return clean.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    if (clean.length === 12) return clean.replace(/(\d{2})(\d{2})(\d{4})(\d{4})/, '+$1 ($2) $3-$4');
    if (clean.length === 13) return clean.replace(/(\d{2})(\d{2})(\d{5})(\d{4})/, '+$1 ($2) $3-$4');
    return String(phone);
  }

  function formatSellerLocation(item: AnyRecord): string {
    const city = String(item.city || '').trim();
    const state = String(item.state || '').trim();
    if (!city && !state) return 'Não informado';
    return [city, state].filter(Boolean).join(' / ');
  }

  function populateSellerStateOptions(selectedValue = ''): void {
    const stateSelect = getEl<HTMLSelectElement>('sellerState');
    if (!stateSelect || !sellerIbgeStates.length) return;

    const normalizedSelectedValue = String(selectedValue || '').trim().toUpperCase();
    stateSelect.innerHTML = [
      '<option value="">Selecione...</option>',
      ...sellerIbgeStates.map((state) => `<option value="${state.uf}">${state.uf} - ${state.name}</option>`),
    ].join('');

    stateSelect.value = sellerIbgeStates.some((state) => state.uf === normalizedSelectedValue) ? normalizedSelectedValue : '';
  }

  async function loadSellerStateOptions(selectedValue = ''): Promise<void> {
    try {
      if (!sellerIbgeStates.length) {
        const response = await api('/companies/states');
        sellerIbgeStates = response.data || [];
      }
      populateSellerStateOptions(selectedValue);
    } catch (error) {
      console.error('Falha ao carregar UFs do IBGE para vendedores', error);
    }
  }

  async function lookupAddressByCep(cep: string): Promise<AnyRecord | null> {
    const normalizedCep = onlyDigits(cep);
    if (normalizedCep.length !== 8) return null;

    let data: AnyRecord | null = null;
    let cepNotFound = false;

    try {
      const viaCepResponse = await fetch(`https://viacep.com.br/ws/${normalizedCep}/json/`);
      if (viaCepResponse.ok) {
        const viaCepData: AnyRecord = await viaCepResponse.json();
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
    } catch {
      // ignore
    }

    if (!data && !cepNotFound) {
      try {
        const brasilApiResponse = await fetch(`https://brasilapi.com.br/api/cep/v1/${normalizedCep}`);
        if (brasilApiResponse.ok) {
          data = (await brasilApiResponse.json()) as AnyRecord;
        }
      } catch {
        // ignore
      }
    }

    return data;
  }

  function applySellerCepLookupResult(data: AnyRecord | null): void {
    if (!data) return;
    const street = getEl<HTMLInputElement>('sellerStreet');
    const neighborhood = getEl<HTMLInputElement>('sellerNeighborhood');
    const city = getEl<HTMLInputElement>('sellerCity');
    const complement = getEl<HTMLInputElement>('sellerComplement');

    if (street) street.value = data.street || '';
    if (neighborhood) neighborhood.value = data.neighborhood || '';
    if (city) city.value = data.city || '';
    if (complement) complement.value = data.complement || '';

    populateSellerStateOptions(data.state || '');
  }

  async function handleSellerCepLookup(): Promise<void> {
    const loader = getEl('sellerCepLoading');
    const cep = getMaskedValue(sellerZipMask, 'sellerZipcode');
    if (cep.length !== 8) return;

    if (loader) loader.classList.remove('hidden');
    try {
      const data = await lookupAddressByCep(cep);
      if (data && (data.street || data.city)) {
        applySellerCepLookupResult(data);
      } else {
        UI?.showAlert?.('alertMessage', 'CEP do vendedor não encontrado ou inválido.', 'error');
      }
    } catch (error) {
      console.error('Falha ao consultar CEP', error);
    } finally {
      if (loader) loader.classList.add('hidden');
    }
  }

  async function handleSellerDocumentLookup(): Promise<void> {
    const documentValue = getMaskedValue(sellerDocMask, 'sellerDocument');
    if (documentValue.length !== 14) return;

    try {
      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${documentValue}`);
      const data: AnyRecord = await response.json();

      if (!response.ok || !data?.razao_social) {
        UI?.showAlert?.('alertMessage', 'CNPJ do vendedor não encontrado ou inválido.', 'error');
        return;
      }

      const name = getEl<HTMLInputElement>('sellerName');
      const email = getEl<HTMLInputElement>('sellerEmail');
      const street = getEl<HTMLInputElement>('sellerStreet');
      const number = getEl<HTMLInputElement>('sellerNumber');
      const complement = getEl<HTMLInputElement>('sellerComplement');
      const neighborhood = getEl<HTMLInputElement>('sellerNeighborhood');
      const city = getEl<HTMLInputElement>('sellerCity');

      if (name && !getTrimmedValue('sellerName')) name.value = data.nome_fantasia || data.razao_social || '';
      if (email && !getTrimmedValue('sellerEmail')) email.value = data.email || '';
      if (!getMaskedValue(sellerPhoneMask, 'sellerPhone')) setMaskedValue(sellerPhoneMask, 'sellerPhone', data.ddd_telefone_1 || '');
      if (!getMaskedValue(sellerZipMask, 'sellerZipcode')) setMaskedValue(sellerZipMask, 'sellerZipcode', data.cep || '');
      if (street && !getTrimmedValue('sellerStreet')) street.value = data.logradouro || '';
      if (number && !getTrimmedValue('sellerNumber')) number.value = data.numero || '';
      if (complement && !getTrimmedValue('sellerComplement')) complement.value = data.complemento || '';
      if (neighborhood && !getTrimmedValue('sellerNeighborhood')) neighborhood.value = data.bairro || '';
      if (city && !getTrimmedValue('sellerCity')) city.value = data.municipio || '';
      populateSellerStateOptions(data.uf || '');

      if (data.cep) {
        const cepData = await lookupAddressByCep(data.cep);
        if (cepData) {
          applySellerCepLookupResult({
            ...cepData,
            complement: cepData.complement || getTrimmedValue('sellerComplement') || data.complemento || '',
          });
        }
      }
    } catch (error) {
      console.error('Falha ao consultar documento', error);
    }
  }

  function setupSellerFormEnhancements(): void {
    const documentInput = getEl<HTMLInputElement>('sellerDocument');
    const phoneInput = getEl<HTMLInputElement>('sellerPhone');
    const zipcodeInput = getEl<HTMLInputElement>('sellerZipcode');
    const btnSearchSellerCep = getEl<HTMLButtonElement>('btnSearchSellerCep');

    if (documentInput && !sellerDocMask) {
      sellerDocMask = makeMask(documentInput, {
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
      documentInput.addEventListener('blur', () => void handleSellerDocumentLookup());
    }

    if (phoneInput && !sellerPhoneMask) {
      sellerPhoneMask = makeMask(phoneInput, {
        mask: [{ mask: '(00) 0000-0000' }, { mask: '(00) 00000-0000' }],
      });
    }

    if (zipcodeInput && !sellerZipMask) {
      sellerZipMask = makeMask(zipcodeInput, { mask: '00000-000' });
      sellerZipMask.on('complete', () => void handleSellerCepLookup());
    }

    if (btnSearchSellerCep) {
      btnSearchSellerCep.addEventListener('click', () => void handleSellerCepLookup());
    }
  }

  function applySellerPrefillFromQuery(): void {
    const params = new URLSearchParams(window.location.search);
    if (params.get('prefill') !== 'seller') return;

    const prefillName = String(params.get('name') || '').trim();
    const prefillPhoneRaw = onlyDigits(params.get('phone') || '');
    const prefillPhone = (prefillPhoneRaw.length === 12 || prefillPhoneRaw.length === 13) && prefillPhoneRaw.startsWith('55')
      ? prefillPhoneRaw.slice(2)
      : prefillPhoneRaw;

    const openModalBtn = getEl<HTMLButtonElement>('btnOpenModal');
    if (openModalBtn) {
      openModalBtn.click();
    } else {
      getEl('entityModal')?.classList.remove('hidden');
    }

    window.requestAnimationFrame(() => {
      const nameInput = getEl<HTMLInputElement>('sellerName');
      const currentName = String(nameInput?.value || '').trim();
      if (nameInput && !currentName && prefillName) {
        nameInput.value = prefillName;
      }

      const currentPhone = getMaskedValue(sellerPhoneMask, 'sellerPhone');
      if (!currentPhone && prefillPhone) {
        setMaskedValue(sellerPhoneMask, 'sellerPhone', prefillPhone);
      }
    });

    UI?.showAlert?.('alertMessage', 'Preenchimento aplicado. Revise os dados e clique em Salvar.', 'success', 4500);

    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete('prefill');
    cleanUrl.searchParams.delete('name');
    cleanUrl.searchParams.delete('phone');
    window.history.replaceState({}, '', `${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash}`);
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (!AuthRef?.isAuthenticated?.()) {
      window.location.href = '/';
      return;
    }

    setupSellerFormEnhancements();
    void loadSellerStateOptions('');
    setupDetailsModalTabs();

    function updateGeneratedLinkUrl(): void {
      if (!sendLinkTargetSellerId) return;
      const stockType = getEl<HTMLSelectElement>('sendLinkStockType')?.value || '';
      let catalogLink = `${window.location.origin}/pages/catalog.html?company=${companyPublicId}&seller=${sendLinkTargetSellerId}`;
      if (stockType) {
        catalogLink += `&stock_type=${stockType}`;
      }
      const urlInput = getEl<HTMLInputElement>('sendLinkGeneratedUrl');
      if (urlInput) {
        urlInput.value = catalogLink;
      }
    }

    const sendLinkStockType = getEl<HTMLSelectElement>('sendLinkStockType');
    if (sendLinkStockType) {
      sendLinkStockType.addEventListener('change', () => {
        updateGeneratedLinkUrl();
      });
    }

    async function loadStockTypesForSendLinkModal(): Promise<void> {
      const select = getEl<HTMLSelectElement>('sendLinkStockType');
      if (!select) return;

      try {
        const response = await api('/estoque/stock-types');
        const stockTypes = response.data || [];

        select.innerHTML = '<option value="">Todos os estoques...</option>' + stockTypes.map((st: any) =>
          `<option value="${st.public_id}">${st.name}</option>`
        ).join('');
      } catch (error) {
        console.error('Erro ao carregar tipos de estoque', error);
        select.innerHTML = '<option value="">Erro ao carregar estoques...</option>';
      } finally {
        updateGeneratedLinkUrl();
      }
    }

    function openClientsModal(sellerId: string) {
      currentSellerId = sellerId;
      const modal = getEl('clientsModal');
      if (modal) {
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        void loadCustomersForSeller(sellerId);
      }
    }

    function closeClientsModal() {
      currentSellerId = null;
      const modal = getEl('clientsModal');
      if (modal) {
        modal.classList.add('hidden');
        document.body.style.overflow = '';
      }
    }

    getEl('btnCancelClientsModal')?.addEventListener('click', closeClientsModal);
    getEl('clientsModalBackdrop')?.addEventListener('click', closeClientsModal);

    function renderClientSelect() {
      const select = getEl<HTMLSelectElement>('clientSelect');
      if (!select) return;
      
      const available = allCustomers.filter((c: any) => c.seller_public_id !== currentSellerId);
      select.innerHTML = '<option value="">Selecione um cliente...</option>' + available.map(c => 
        `<option value="${c.public_id}">${c.name} (${formatDoc(c.cnpj_cpf)})</option>`
      ).join('');
    }

    function renderSellerClientsList() {
      const tbody = getEl('sellerClientsList');
      if (!tbody) return;

      if (sellerClients.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="px-4 py-4 text-center text-sm text-gray-500">Nenhum cliente vinculado.</td></tr>';
        return;
      }

      tbody.innerHTML = sellerClients.map(c => `
        <tr>
          <td class="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">${c.name}</td>
          <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${formatDoc(c.cnpj_cpf)}</td>
          <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
            <div class="flex items-center gap-1">
              <input type="number" step="0.01" min="0" class="discount-value w-20 px-2 py-1 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-sm focus:ring-brand-500 focus:border-brand-500 dark:text-gray-100" placeholder="0,00" value="${c.discount_value || ''}" data-id="${c.public_id}">
              <select class="discount-type px-1 py-1 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-sm focus:ring-brand-500 focus:border-brand-500 dark:text-gray-100" data-id="${c.public_id}">
                <option value="percentage" ${c.discount_type === 'percentage' ? 'selected' : ''}>%</option>
                <option value="fixed" ${c.discount_type === 'fixed' ? 'selected' : ''}>R$</option>
              </select>
              <button type="button" class="ml-1 text-brand-600 hover:text-brand-900 dark:hover:text-brand-400 save-discount-btn" data-id="${c.public_id}" title="Salvar comissão">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
              </button>
            </div>
          </td>
          <td class="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
            <button type="button" class="text-brand-600 hover:text-brand-900 dark:hover:text-brand-400 mr-3 copy-catalog-link-btn" data-customer-public-id="${c.public_id}">
              Copiar Link
            </button>
            <button type="button" class="text-emerald-600 hover:text-emerald-900 dark:hover:text-emerald-400 mr-3 send-catalog-whatsapp-btn" data-customer-public-id="${c.public_id}" data-phone="${c.phone || ''}">
              Enviar WhatsApp
            </button>
            <button type="button" class="text-red-600 hover:text-red-900 remove-client-btn" data-id="${c.public_id}">
              Remover
            </button>
          </td>
        </tr>
      `).join('');
    }

    async function loadCustomersForSeller(sellerId: string) {
      try {
        const res = await api('/entities/customers');
        allCustomers = res.data || [];
        sellerClients = allCustomers.filter((c: any) => c.seller_public_id === sellerId);
        
        renderSellerClientsList();
        renderClientSelect();
      } catch (e) {
        console.error('Erro ao carregar clientes', e);
      }
    }

    getEl('btnAssignClient')?.addEventListener('click', async () => {
      const select = getEl<HTMLSelectElement>('clientSelect');
      const clientId = select?.value;
      if (!clientId || !currentSellerId) return;

      const commValueInput = getEl<HTMLInputElement>('newClientCommissionValue');
      const commTypeSelect = getEl<HTMLSelectElement>('newClientCommissionType');
      
      const discount_value = commValueInput?.value ? parseFloat(commValueInput.value) : null;
      const discount_type = commTypeSelect?.value || null;

      try {
        await api(`/entities/customers/${clientId}`, {
          method: 'PUT',
          body: JSON.stringify({ 
            seller_public_id: currentSellerId,
            discount_value,
            discount_type
          })
        });

        if (commValueInput) commValueInput.value = '';
        if (select) select.value = '';

        UI?.showAlert?.('alertMessage', 'Cliente vinculado com sucesso!', 'success');
        await loadCustomersForSeller(currentSellerId);
      } catch (e: any) {
        UI?.showAlert?.('alertMessage', e.message || 'Erro ao vincular cliente', 'error');
      }
    });

    document.addEventListener('click', async (e: Event) => {
      const target = e.target as HTMLElement;

      const openSendLinkBtn = target.closest('.send-link-seller-btn');
      if (openSendLinkBtn) {
        const id = openSendLinkBtn.getAttribute('data-id');
        const name = openSendLinkBtn.getAttribute('data-name') || '';
        const phone = openSendLinkBtn.getAttribute('data-phone') || '';
        if (id) {
          sendLinkTargetSellerId = id;
          sendLinkTargetSellerName = name;
          const modal = getEl('sendLinkModal');
          if (modal) {
            modal.classList.remove('hidden');
            document.body.style.overflow = 'hidden';

            void loadStockTypesForSendLinkModal();

            const phoneInput = getEl<HTMLInputElement>('sendLinkPhone');
            if (phoneInput) {
              try {
                if (!sendLinkMask) {
                  sendLinkMask = makeMask(phoneInput, { mask: '(00) 00000-0000' });
                }
                if (sendLinkMask) {
                  sendLinkMask.unmaskedValue = phone.replace(/\D/g, '');
                } else {
                  phoneInput.value = phone;
                }
              } catch (maskError) {
                console.error('[SendLinkModal] Error applying mask to phone input:', maskError);
                phoneInput.value = phone;
              }
            }
          }
        }
        return;
      }

      if (target.id === 'btnCopyGeneratedUrl' || target.closest('#btnCopyGeneratedUrl')) {
        const urlInput = getEl<HTMLInputElement>('sendLinkGeneratedUrl');
        if (urlInput && urlInput.value) {
          navigator.clipboard.writeText(urlInput.value).then(() => {
            const copyBtn = getEl('btnCopyGeneratedUrl');
            if (copyBtn) {
              const origText = copyBtn.innerHTML;
              copyBtn.innerHTML = 'Copiado!';
              copyBtn.classList.add('bg-emerald-100', 'text-emerald-800', 'dark:bg-emerald-950/30', 'dark:text-emerald-400');
              setTimeout(() => {
                copyBtn.innerHTML = origText;
                copyBtn.classList.remove('bg-emerald-100', 'text-emerald-800', 'dark:bg-emerald-950/30', 'dark:text-emerald-400');
              }, 2000);
            }
          }).catch(err => {
            console.error('Erro ao copiar link', err);
          });
        }
        return;
      }

      if (target.closest('#btnCancelSendLink') || target.id === 'sendLinkModalBackdrop') {
        const modal = getEl('sendLinkModal');
        if (modal) {
          modal.classList.add('hidden');
          document.body.style.overflow = '';
        }
        sendLinkTargetSellerId = null;
        sendLinkTargetSellerName = '';
        return;
      }

      if (target.closest('#btnConfirmSendLink')) {
        if (!sendLinkTargetSellerId) return;
        
        let phoneValue = '';
        try {
          phoneValue = sendLinkMask ? sendLinkMask.unmaskedValue : (getEl<HTMLInputElement>('sendLinkPhone')?.value || '');
        } catch (e) {
          console.error('[SendLinkModal] Error reading unmasked value:', e);
          phoneValue = getEl<HTMLInputElement>('sendLinkPhone')?.value || '';
        }
        
        const cleanPhone = phoneValue.replace(/\D/g, '');
        const stockType = getEl<HTMLSelectElement>('sendLinkStockType')?.value || '';

        let sellerClients: any[] = [];
        try {
          const res = await api('/entities/customers');
          const allCustomers = res.data || [];
          sellerClients = allCustomers.filter((c: any) => c.seller_public_id === sendLinkTargetSellerId);
        } catch (err) {
          console.error('[SendLinkModal] Error loading customers for seller:', err);
        }

        let catalogLink = `${window.location.origin}/pages/catalog.html?company=${companyPublicId}&seller=${sendLinkTargetSellerId}`;
        if (stockType) {
          catalogLink += `&stock_type=${stockType}`;
        }

        let messageText = `Olá, ${sendLinkTargetSellerName}! Aqui está o link do seu catálogo de vendas personalizado. Compartilhe-o com os seus clientes para receber pedidos vinculados a você:\n\n${catalogLink}`;

        if (sellerClients.length > 0) {
          messageText += `\n\nE aqui estão os links personalizados para cada um de seus clientes:`;
          for (const client of sellerClients) {
            let clientLink = `${window.location.origin}/pages/catalog.html?company=${companyPublicId}&seller=${sendLinkTargetSellerId}&customer=${client.public_id}`;
            if (stockType) {
              clientLink += `&stock_type=${stockType}`;
            }

            let discountText = '';
            if (client.discount_value && Number(client.discount_value) > 0) {
              if (client.discount_type === 'percentage') {
                discountText = ` (Desconto: ${client.discount_value}%)`;
              } else if (client.discount_type === 'fixed') {
                discountText = ` (Desconto: R$ ${Number(client.discount_value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`;
              }
            }

            messageText += `\n- ${client.name}${discountText}:\n${clientLink}`;
          }
        }

        const message = encodeURIComponent(messageText);

        let url = `https://api.whatsapp.com/send?text=${message}`;
        if (cleanPhone) {
          let targetPhone = cleanPhone;
          if (!targetPhone.startsWith('55')) {
            targetPhone = '55' + targetPhone;
          }
          url = `https://api.whatsapp.com/send?phone=${targetPhone}&text=${message}`;
        }

        window.open(url, '_blank');

        const modal = getEl('sendLinkModal');
        if (modal) {
          modal.classList.add('hidden');
          document.body.style.overflow = '';
        }
        sendLinkTargetSellerId = null;
        sendLinkTargetSellerName = '';
        return;
      }
      
      const openBtn = target.closest('.open-clients-btn');
      if (openBtn) {
        const id = openBtn.getAttribute('data-id');
        if (id) openClientsModal(id);
        return;
      }

      if (target.classList.contains('copy-catalog-link-btn') || target.closest('.copy-catalog-link-btn')) {
        const btn = target.classList.contains('copy-catalog-link-btn') ? target : target.closest('.copy-catalog-link-btn');
        const customerPublicId = btn?.getAttribute('data-customer-public-id');
        if (!customerPublicId || !currentSellerId) return;

        const catalogLink = `${window.location.origin}/pages/catalog.html?company=${companyPublicId}&seller=${currentSellerId}&customer=${customerPublicId}`;

        navigator.clipboard.writeText(catalogLink)
          .then(() => {
            UI?.showAlert?.('alertMessage', 'Link do catálogo copiado com sucesso!', 'success');
          })
          .catch(() => {
            UI?.showAlert?.('alertMessage', 'Erro ao copiar o link.', 'error');
          });
        return;
      }

      if (target.classList.contains('send-catalog-whatsapp-btn') || target.closest('.send-catalog-whatsapp-btn')) {
        const btn = target.classList.contains('send-catalog-whatsapp-btn') ? target : target.closest('.send-catalog-whatsapp-btn');
        const customerPublicId = btn?.getAttribute('data-customer-public-id');
        const phone = btn?.getAttribute('data-phone') || '';
        if (!customerPublicId || !currentSellerId) return;

        const catalogLink = `${window.location.origin}/pages/catalog.html?company=${companyPublicId}&seller=${currentSellerId}&customer=${customerPublicId}`;
        const message = encodeURIComponent(`Olá! Segue o link do nosso catálogo digital personalizado para você realizar os seus pedidos:\n\n${catalogLink}`);

        let url = `https://api.whatsapp.com/send?text=${message}`;
        if (phone) {
          let cleanPhone = phone.replace(/\D/g, '');
          if (cleanPhone.length > 0 && !cleanPhone.startsWith('55')) {
            cleanPhone = '55' + cleanPhone;
          }
          url = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${message}`;
        }
        window.open(url, '_blank');
        return;
      }

      if (target.classList.contains('remove-client-btn') || target.closest('.remove-client-btn')) {
        const btn = target.classList.contains('remove-client-btn') ? target : target.closest('.remove-client-btn');
        const clientId = btn?.getAttribute('data-id');
        if (!clientId || !currentSellerId) return;

        if (!confirm('Deseja remover este cliente do vendedor?')) return;

        try {
          await api(`/entities/customers/${clientId}`, {
            method: 'PUT',
            body: JSON.stringify({ seller_public_id: null })
          });
          UI?.showAlert?.('alertMessage', 'Cliente removido com sucesso!', 'success');
          await loadCustomersForSeller(currentSellerId);
        } catch (e: any) {
          UI?.showAlert?.('alertMessage', e.message || 'Erro ao remover cliente', 'error');
        }
      } else if (target.classList.contains('save-discount-btn') || target.closest('.save-discount-btn')) {
        const btn = target.classList.contains('save-discount-btn') ? target : target.closest('.save-discount-btn');
        const clientId = btn?.getAttribute('data-id');
        if (!clientId || !currentSellerId) return;

        const row = btn?.closest('tr');
        if (!row) return;

        const discountValueInput = row.querySelector('.discount-value') as HTMLInputElement;
        const discountTypeSelect = row.querySelector('.discount-type') as HTMLSelectElement;

        const discount_value = discountValueInput?.value ? parseFloat(discountValueInput.value) : null;
        const discount_type = discountTypeSelect?.value || null;

        try {
          await api(`/entities/customers/${clientId}`, {
            method: 'PUT',
            body: JSON.stringify({ discount_type, discount_value })
          });
          UI?.showAlert?.('alertMessage', 'Comissão salva com sucesso!', 'success');
          await loadCustomersForSeller(currentSellerId);
        } catch (e: any) {
          UI?.showAlert?.('alertMessage', e.message || 'Erro ao salvar desconto', 'error');
        }
      }
    });

    api('/auth/me')
      .then((res: AnyRecord) => {
        if (res.data && res.data.company) {
          companyPublicId = res.data.company.public_id;
        }
        const userGreeting = getEl('userGreeting');
        if (userGreeting && res.data && res.data.user) {
          userGreeting.textContent = `Olá, ${res.data.user.full_name || 'Usuário'}`;
        } else if (userGreeting && res.data) {
          userGreeting.textContent = `Olá, ${res.data.full_name || 'Usuário'}`;
        }
      })
      .catch(console.error);

    sellersManager = new CrudManager({
      entityName: 'Vendedor',
      endpoint: '/users',
      tableId: 'sellersTable',
      tableSectionId: 'sellersSection',
      modalId: 'entityModal',
      disableSummaryFooter: true,

      filterConfig: {
        storageKey: 'sellers_filter_panel',
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

      applyFilters: (data: AnyRecord[]) => {
        const search = FilterPanel.normalizeText(getEl<HTMLInputElement>('filterSearch')?.value);
        const searchDigits = FilterPanel.onlyDigits(search);
        const status = getEl<HTMLSelectElement>('filterStatus')?.value || '';

        const filtered = data.filter((item: AnyRecord) => {
          if (item.role !== 'seller') return false;
          if (status === 'active' && !item.is_active) return false;
          if (status === 'inactive' && item.is_active) return false;
          if (!search) return true;

          if (FilterPanel.matchesSearch(item, ['full_name', 'email', 'cpf_cnpj', 'phone', 'city', 'state'], search)) return true;
          if (!searchDigits) return false;

          return [item.cpf_cnpj, item.phone]
            .map((value: any) => FilterPanel.onlyDigits(value))
            .some((value: string) => value.includes(searchDigits));
        });

        (window as any).GridSummaryFooter?.update?.({
          footerId: 'sellersResultsFooter',
          anchorId: 'sellersSection',
          count: filtered.length,
          label: 'vendedor(es) exibido(s)',
        });

        return filtered;
      },

      renderTable: (items: AnyRecord[]) => {
        const tbody = getEl('sellersTable');
        if (!tbody) return;

        if (items.length === 0) {
          tbody.innerHTML =
            '<tr><td colspan="8" class="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">Nenhum vendedor encontrado.</td></tr>';
          return;
        }

        tbody.innerHTML = items
          .map(
            (item: AnyRecord, index: number) => `
                <tr class="${!item.is_active ? 'opacity-50' : ''}">
                    <td class="px-3 py-4 whitespace-nowrap text-left w-12">
                        <input type="checkbox" value="${item.public_id}" class="item-checkbox cursor-pointer rounded border-gray-300 dark:border-slate-600 text-brand-600 shadow-sm focus:border-brand-300 focus:ring focus:ring-brand-200 focus:ring-opacity-50 dark:bg-slate-800" data-bwignore="true" data-lpignore="true" placeholder="">
                    </td>
                    <td class="px-3 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">#${String(index + 1).padStart(4, '0')}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">${item.full_name}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${formatDoc(item.cpf_cnpj)}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        <div class="block w-56 max-w-full truncate" title="${item.email || ''}">${item.email || '-'}</div>
                        <div>${formatPhone(item.phone)}</div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${formatSellerLocation(item)}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm">
                        ${
                          item.is_active
                            ? '<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">Ativo</span>'
                            : '<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">Inativo</span>'
                        }
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button type="button" title="Detalhes" class="text-indigo-600 hover:text-indigo-900 dark:hover:text-indigo-400 mr-2 open-details-btn" data-id="${item.public_id}" data-name="${item.full_name}">
                            <svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                        </button>
                        <button type="button" title="Clientes" class="text-indigo-600 hover:text-indigo-900 dark:hover:text-indigo-400 mr-2 open-clients-btn" data-id="${item.public_id}">
                            <svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                        </button>
                        <button type="button" title="Enviar Catálogo" class="text-emerald-600 hover:text-emerald-900 dark:hover:text-emerald-400 mr-2 send-link-seller-btn" data-id="${item.public_id}" data-name="${item.full_name}" data-phone="${item.phone || ''}">
                            <svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
                        </button>
                        <button type="button" title="Editar" class="text-brand-600 hover:text-brand-900 dark:hover:text-brand-400 mr-2 edit-btn" data-item='${JSON.stringify(
                          item
                        ).replace(/'/g, '&#39;')}'>
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

      onEdit: (data: AnyRecord | null) => {
        getEl<HTMLFormElement>('entityForm')?.reset();
        const sellerIdInput = getEl<HTMLInputElement>('sellerId');
        const modalTitle = getEl('modalTitle');
        const passwordInput = getEl<HTMLInputElement>('sellerPassword');
        const passwordHint = getEl('passwordHint');

        if (data && data.public_id) {
          if (modalTitle) modalTitle.textContent = 'Editar Vendedor';
          if (sellerIdInput) sellerIdInput.value = data.public_id || '';

          const name = getEl<HTMLInputElement>('sellerName');
          const email = getEl<HTMLInputElement>('sellerEmail');
          const street = getEl<HTMLInputElement>('sellerStreet');
          const number = getEl<HTMLInputElement>('sellerNumber');
          const complement = getEl<HTMLInputElement>('sellerComplement');
          const neighborhood = getEl<HTMLInputElement>('sellerNeighborhood');
          const city = getEl<HTMLInputElement>('sellerCity');

          if (name) name.value = data.full_name || '';
          if (email) email.value = data.email || '';
          if (street) street.value = data.street || '';
          if (number) number.value = data.number || '';
          if (complement) complement.value = data.complement || '';
          if (neighborhood) neighborhood.value = data.neighborhood || '';
          if (city) city.value = data.city || '';

          setMaskedValue(sellerDocMask, 'sellerDocument', data.cpf_cnpj || '');
          setMaskedValue(sellerPhoneMask, 'sellerPhone', data.phone || '');
          setMaskedValue(sellerZipMask, 'sellerZipcode', data.zipcode || '');
          void loadSellerStateOptions(data.state || '');

          passwordInput?.removeAttribute('required');
          passwordHint?.classList.remove('hidden');
        } else {
          if (modalTitle) modalTitle.textContent = 'Novo Vendedor';
          if (sellerIdInput) sellerIdInput.value = '';
          setMaskedValue(sellerDocMask, 'sellerDocument', '');
          setMaskedValue(sellerPhoneMask, 'sellerPhone', '');
          setMaskedValue(sellerZipMask, 'sellerZipcode', '');
          void loadSellerStateOptions('');

          passwordInput?.setAttribute('required', 'true');
          passwordHint?.classList.add('hidden');
        }

        getEl('entityModal')?.classList.remove('hidden');
      },
    });

    sellersManager.init();

    applySellerPrefillFromQuery();

    // Custom toggle status action delegated globally
    document.addEventListener('click', async (e: Event) => {
      const target = e.target as HTMLElement | null;
      const btn = target?.closest('.toggle-status-btn') as HTMLElement | null;
      if (!btn) return;

      const id = btn.getAttribute('data-id');
      const action = btn.getAttribute('data-action') === 'true';
      if (!confirm(`Tem certeza que deseja ${action ? 'ativar' : 'desativar'} este vendedor?`)) return;

      try {
        await api(`/users/${id}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ is_active: action }),
        });
        UI?.showAlert?.('alertMessage', `Vendedor ${action ? 'ativado' : 'desativado'} com sucesso!`, 'success');
        await sellersManager.loadData();
      } catch (error: any) {
        UI?.showAlert?.('alertMessage', error?.message || 'Erro ao atualizar status do vendedor.', 'error');
      }
    });

    getEl<HTMLFormElement>('entityForm')?.addEventListener('submit', async (event: Event) => {
      event.preventDefault();

      const saveBtn = getEl<HTMLButtonElement>('saveBtn');
      const sellerId = getTrimmedValue('sellerId');
      const isEditing = Boolean(sellerId);

      const payload: AnyRecord = {
        full_name: getTrimmedValue('sellerName'),
        email: getTrimmedValue('sellerEmail'),
        passwordRaw: getTrimmedValue('sellerPassword'),
        role: 'seller',
        cpf_cnpj: getMaskedValue(sellerDocMask, 'sellerDocument') || undefined,
        phone: getMaskedValue(sellerPhoneMask, 'sellerPhone') || undefined,
        zipcode: getMaskedValue(sellerZipMask, 'sellerZipcode') || undefined,
        street: getTrimmedValue('sellerStreet') || undefined,
        number: getTrimmedValue('sellerNumber') || undefined,
        complement: getTrimmedValue('sellerComplement') || undefined,
        neighborhood: getTrimmedValue('sellerNeighborhood') || undefined,
        city: getTrimmedValue('sellerCity') || undefined,
        state: getTrimmedValue('sellerState') || undefined,
      };

      if (isEditing && !payload.passwordRaw) {
        payload.passwordRaw = '';
      }

      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Salvando...';
      }

      const endpoint = isEditing ? `/users/${sellerId}` : '/users';
      const method = isEditing ? 'PATCH' : 'POST';

      try {
        await api(endpoint, {
          method,
          body: JSON.stringify(payload),
        });

        UI?.showAlert?.(
          'alertMessage',
          isEditing ? 'Vendedor atualizado com sucesso!' : 'Vendedor cadastrado com sucesso!',
          'success'
        );
        sellersManager.closeModal();
        await sellersManager.loadData();
      } catch (error: any) {
        UI?.showAlert?.('alertMessage', error?.message || 'Erro ao salvar vendedor.', 'error');
      } finally {
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.textContent = 'Salvar';
        }
      }
    });

    // Custom details modal action
    document.addEventListener('click', (e: Event) => {
      const target = e.target as HTMLElement | null;
      const btn = target?.closest('.open-details-btn');
      if (btn) {
        const id = btn.getAttribute('data-id');
        const name = btn.getAttribute('data-name') || '';
        if (id) {
          void openViewDetailsModal(id, name);
        }
      }
    });

    function setupDetailsModalTabs() {
        const tabButtons = document.querySelectorAll('#viewSellerDetailsModal .details-modal-tab');
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
                document.querySelectorAll('#viewSellerDetailsModal .details-modal-tab-panel').forEach((panel: any) => {
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
        const tabButtons = Array.from(document.querySelectorAll('#viewSellerDetailsModal .details-modal-tab'));
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

        document.querySelectorAll('#viewSellerDetailsModal .details-modal-tab-panel').forEach((panel: any) => {
            const panelId = panel.getAttribute('id');
            const correspondingBtn = tabButtons.find((btn: any) => btn.getAttribute('aria-controls') === panelId);
            const shouldBeVisible = correspondingBtn && visibleButtons.length > 0 && correspondingBtn === visibleButtons[0];
            if (shouldBeVisible) {
                panel.classList.remove('hidden');
            } else {
                panel.classList.add('hidden');
            }
        });
    }

    async function openViewDetailsModal(sellerId: string, sellerName: string) {
        const modal = getEl('viewSellerDetailsModal');
        const closeBtn = getEl('btnCloseViewDetailsModal');
        const cancelBtn = getEl('btnCancelViewDetailsModal');
        const backdrop = getEl('viewDetailsModalBackdrop');
        
        if (!modal) return;

        // Close modal actions
        const closeModal = () => {
            modal.classList.add('hidden');
        };
        closeBtn?.addEventListener('click', closeModal, { once: true });
        cancelBtn?.addEventListener('click', closeModal, { once: true });
        backdrop?.addEventListener('click', closeModal, { once: true });

        modal.classList.remove('hidden');

        // Populate basic seller details
        const seller = sellersManager?.data?.find((c: any) => c.public_id === sellerId);
        
        const docEl = getEl('viewDetailsDocument');
        const emailEl = getEl('viewDetailsEmail');
        const phoneEl = getEl('viewDetailsPhone');
        const locEl = getEl('viewDetailsLocation');
        const titleNameEl = getEl('viewDetailsSellerName');

        if (titleNameEl) titleNameEl.textContent = sellerName;
        if (docEl) docEl.textContent = formatDoc(seller?.cpf_cnpj);
        if (emailEl) {
            emailEl.textContent = seller?.email || 'Não informado';
            emailEl.title = seller?.email || '';
        }
        if (phoneEl) phoneEl.textContent = formatPhone(seller?.phone);
        if (locEl) locEl.textContent = formatSellerLocation(seller || {});

        // Map configuration
        const mapSellerAddressSpan = getEl('mapSellerAddress');
        const googleMapsIframe = getEl('googleMapsIframe') as HTMLIFrameElement | null;
        const btnOpenWaze = getEl('btnOpenWaze') as HTMLAnchorElement | null;
        const btnOpenGoogleMaps = getEl('btnOpenGoogleMaps') as HTMLAnchorElement | null;

        if (seller) {
            const sellerAddressParts = [
                seller.street,
                seller.number,
                seller.neighborhood,
                seller.city,
                seller.state,
                seller.zipcode
            ].filter(Boolean);
            const sellerAddressStr = sellerAddressParts.join(', ');

            if (mapSellerAddressSpan) {
                mapSellerAddressSpan.textContent = sellerAddressStr || 'Endereço não cadastrado';
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

            if (sellerAddressStr) {
                let embedUrl = '';
                let mapsUrl = '';
                let wazeUrl = '';

                if (companyAddressStr) {
                    embedUrl = `https://maps.google.com/maps?saddr=${encodeURIComponent(companyAddressStr)}&daddr=${encodeURIComponent(sellerAddressStr)}&output=embed`;
                    mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(companyAddressStr)}&destination=${encodeURIComponent(sellerAddressStr)}`;
                    wazeUrl = `https://waze.com/ul?q=${encodeURIComponent(sellerAddressStr)}&navigate=yes`;
                } else {
                    embedUrl = `https://maps.google.com/maps?q=${encodeURIComponent(sellerAddressStr)}&output=embed`;
                    mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(sellerAddressStr)}`;
                    wazeUrl = `https://waze.com/ul?q=${encodeURIComponent(sellerAddressStr)}&navigate=yes`;
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
            if (mapSellerAddressSpan) mapSellerAddressSpan.textContent = 'Vendedor não encontrado';
            if (googleMapsIframe) googleMapsIframe.removeAttribute('src');
            if (btnOpenWaze) btnOpenWaze.classList.add('hidden');
            if (btnOpenGoogleMaps) btnOpenGoogleMaps.classList.add('hidden');
        }

        resetDetailsModalTabs();

        const docContainer = getEl('viewDetailsDocumentContainer');
        let docsList: { name: string; url: string; attachedAt?: string }[] = [];
        
        const parseCnpjDocuments = (val: any): { name: string; url: string; attachedAt?: string }[] => {
            if (!val) return [];
            let list: any[] = [];
            if (Array.isArray(val)) {
                list = val;
            } else {
                try {
                    if (typeof val === 'string' && val.trim().startsWith('[')) {
                        list = JSON.parse(val);
                    } else if (typeof val === 'string' && val.trim() !== '') {
                        list = [val];
                    }
                } catch (e) {}
            }
            return list.map(item => {
                if (typeof item === 'string') {
                    const fileName = item.substring(item.lastIndexOf('/') + 1);
                    return { name: fileName, url: item, attachedAt: new Date(2026, 0, 1).toISOString() };
                }
                if (item && typeof item === 'object' && item.url) {
                    return {
                        name: item.name || item.url.substring(item.url.lastIndexOf('/') + 1),
                        url: item.url,
                        attachedAt: item.attachedAt || new Date().toISOString()
                    };
                }
                return null;
            }).filter(Boolean) as { name: string; url: string; attachedAt: string }[];
        };

        docsList = parseCnpjDocuments(seller?.cnpj_document_url);

        const getBase64 = (file: File) => {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = () => resolve(reader.result);
                reader.onerror = error => reject(error);
            });
        };

        const renderDetailsDocsList = () => {
            if (!docContainer) return;
            docsList.sort((a: any, b: any) => new Date(b.attachedAt || 0).getTime() - new Date(a.attachedAt || 0).getTime());
            if (docsList.length === 0) {
                docContainer.innerHTML = `
                    <div class="flex flex-col items-center justify-center py-12 gap-2 text-gray-400 dark:text-gray-500 w-full font-sans">
                        <svg class="w-12 h-12 text-gray-300 dark:text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                        </svg>
                        <p class="text-sm font-medium">Nenhum documento anexado.</p>
                    </div>
                `;
                return;
            }
            docContainer.innerHTML = docsList.map((doc, idx) => {
                const fileName = doc.url.substring(doc.url.lastIndexOf('/') + 1);
                const d = doc.attachedAt ? new Date(doc.attachedAt) : null;
                const dateStr = d ? `Anexado em ${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : '';
                return `
                    <div class="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm hover:border-brand-300 dark:hover:border-brand-700 transition-all font-sans mb-3">
                        <a href="${doc.url}" target="_blank" class="flex items-center gap-3 flex-1 min-w-0 mr-4 group text-left cursor-pointer decoration-none">
                            <div class="p-2 rounded bg-brand-50 dark:bg-brand-950/40 text-brand-600 dark:text-brand-400 group-hover:bg-brand-100 dark:group-hover:bg-brand-900/60 transition-colors">
                                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                                </svg>
                            </div>
                            <div class="flex-1 min-w-0 font-sans">
                                <p class="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">${doc.name}</p>
                                <p class="text-[11px] text-gray-500 dark:text-gray-400 truncate mt-0.5">${fileName}</p>
                                ${dateStr ? `
                                    <p class="text-[10px] text-gray-400 dark:text-gray-500 font-mono mt-1 flex items-center gap-1">
                                        <svg class="w-3.5 h-3.5 shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                                        ${dateStr}
                                    </p>
                                ` : ''}
                            </div>
                        </a>
                        <div class="flex items-center gap-1.5 shrink-0">
                            <button type="button" class="btn-rename-doc p-1.5 rounded text-gray-500 hover:text-brand-600 hover:bg-brand-50 dark:text-gray-400 dark:hover:text-brand-400 dark:hover:bg-brand-950/30 transition-colors" data-index="${idx}" title="Renomear documento">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path>
                                </svg>
                            </button>
                            <button type="button" class="btn-delete-doc p-1.5 rounded text-gray-500 hover:text-red-600 hover:bg-red-50 dark:text-gray-400 dark:hover:text-red-400 dark:hover:bg-red-950/30 transition-colors" data-index="${idx}" title="Excluir documento">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                                </svg>
                            </button>
                        </div>
                    </div>
                `;
            }).join('');
        };

        renderDetailsDocsList();

        // Bind upload input
        const detailCnpjFileInput = modal.querySelector('#detailCnpjFile') as HTMLInputElement | null;
        if (detailCnpjFileInput) {
            const newFileInput = detailCnpjFileInput.cloneNode(true) as HTMLInputElement;
            detailCnpjFileInput.parentNode?.replaceChild(newFileInput, detailCnpjFileInput);
            newFileInput.addEventListener('change', async (e: any) => {
                const files = Array.from(newFileInput.files || []);
                if (files.length === 0) return;
                
                const uploads: { name: string; base64: string; attachedAt: string; filename?: string }[] = [];
                for (const file of files) {
                    try {
                        const b64 = (await getBase64(file)) as string;
                        const defaultName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
                        uploads.push({
                            name: defaultName,
                            base64: b64,
                            attachedAt: new Date().toISOString(),
                            filename: file.name
                        });
                    } catch (err) {
                        console.error(err);
                    }
                }
                
                if (uploads.length > 0) {
                    try {
                        newFileInput.disabled = true;
                        if (docContainer) docContainer.innerHTML = '<p class="text-sm text-gray-500 dark:text-gray-400 animate-pulse font-sans">Enviando documentos...</p>';
                        await api(`/users/${sellerId}`, {
                            method: 'PUT',
                            body: JSON.stringify({
                                cnpj_document_uploads: uploads
                            })
                        });
                        UI.showAlert('alertMessage', 'Documentos anexados com sucesso!', 'success');
                        
                        await sellersManager.loadData();
                        const updatedSeller = sellersManager?.data?.find((c: any) => c.public_id === sellerId);
                        docsList = parseCnpjDocuments(updatedSeller?.cnpj_document_url);
                        renderDetailsDocsList();
                    } catch (err: any) {
                        console.error(err);
                        UI.showAlert('alertMessage', err.message || 'Erro ao enviar documentos.', 'error');
                        renderDetailsDocsList();
                    } finally {
                        newFileInput.disabled = false;
                        newFileInput.value = '';
                    }
                }
            });
        }

        // Bind clicks for rename and delete within document container
        if (docContainer) {
            const newDocContainer = docContainer.cloneNode(true);
            docContainer.parentNode?.replaceChild(newDocContainer, docContainer);
            
            newDocContainer.addEventListener('click', async (e: Event) => {
                const target = e.target as HTMLElement | null;
                const renameBtn = target?.closest('.btn-rename-doc');
                const deleteBtn = target?.closest('.btn-delete-doc');
                
                if (renameBtn) {
                    const idx = parseInt(renameBtn.getAttribute('data-index') || '0', 10);
                    const doc = docsList[idx];
                    if (doc) {
                        const newName = prompt('Digite o novo nome para o documento:', doc.name);
                        if (newName && newName.trim()) {
                            docsList[idx].name = newName.trim();
                            try {
                                await api(`/users/${sellerId}`, {
                                    method: 'PUT',
                                    body: JSON.stringify({
                                        cnpj_document_url: JSON.stringify(docsList)
                                    })
                                });
                                UI.showAlert('alertMessage', 'Documento renomeado com sucesso!', 'success');
                                await sellersManager.loadData();
                                renderDetailsDocsList();
                            } catch (err: any) {
                                console.error(err);
                                UI.showAlert('alertMessage', 'Erro ao renomear documento.', 'error');
                            }
                        }
                    }
                }
                
                if (deleteBtn) {
                    const idx = parseInt(deleteBtn.getAttribute('data-index') || '0', 10);
                    if (confirm('Deseja realmente excluir este documento?')) {
                        docsList.splice(idx, 1);
                        try {
                            await api(`/users/${sellerId}`, {
                                    method: 'PUT',
                                    body: JSON.stringify({
                                        cnpj_document_url: JSON.stringify(docsList)
                                    })
                                });
                                UI.showAlert('alertMessage', 'Documento excluído com sucesso!', 'success');
                                await sellersManager.loadData();
                                renderDetailsDocsList();
                        } catch (err: any) {
                            console.error(err);
                            UI.showAlert('alertMessage', 'Erro ao excluir documento.', 'error');
                        }
                    }
                }
            });
        }

        // ── Loader / API calls ──
        const salesTable = getEl('viewDetailsSalesTable');
        const financialsTable = getEl('viewDetailsFinancialsTable');
        const tasksTable = getEl('viewDetailsTasksTable');

        if (salesTable) salesTable.innerHTML = '<tr><td colspan="5" class="px-4 py-3 text-center text-sm text-gray-500 dark:text-gray-400 font-sans animate-pulse">Carregando...</td></tr>';
        if (financialsTable) financialsTable.innerHTML = '<tr><td colspan="4" class="px-4 py-3 text-center text-sm text-gray-500 dark:text-gray-400 font-sans animate-pulse">Carregando...</td></tr>';
        if (tasksTable) tasksTable.innerHTML = '<tr><td colspan="3" class="px-4 py-3 text-center text-sm text-gray-500 dark:text-gray-400 font-sans animate-pulse">Carregando...</td></tr>';

        try {
            const [salesRes, revenuesRes, expensesRes, tasksRes] = await Promise.all([
                api(`/sales?seller_public_id=${sellerId}`).catch(() => ({ data: [] })),
                api('/finance/revenues').catch(() => ({ data: [] })),
                api('/finance/expenses').catch(() => ({ data: [] })),
                api('/tasks').catch(() => ({ data: [] }))
            ]);

            // Filter sales orders
            const sales = salesRes.data || [];
            if (salesTable) {
                if (sales.length === 0) {
                    salesTable.innerHTML = '<tr><td colspan="5" class="px-4 py-3 text-center text-sm text-gray-500 dark:text-gray-400 font-sans">Nenhuma venda encontrada.</td></tr>';
                } else {
                    salesTable.innerHTML = sales.map((o: any) => `
                        <tr>
                            <td class="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100 font-mono">${o.public_id.substring(0, 8).toUpperCase()}</td>
                            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-sans">${new Date(o.date).toLocaleDateString('pt-BR')}</td>
                            <td class="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 font-sans">${o.customer_name || 'Venda manual'}</td>
                            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-sans">${o.status}</td>
                            <td class="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-900 dark:text-gray-100 font-mono">${Number(o.total_amount || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                        </tr>
                    `).join('');
                }
            }

            // Filter transactions
            const revenues = (revenuesRes.data || []).filter((item: any) => item.related_user_public_id === sellerId);
            const expenses = (expensesRes.data || []).filter((item: any) => item.related_user_public_id === sellerId);
            const transactions = [...revenues, ...expenses].sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

            if (financialsTable) {
                if (transactions.length === 0) {
                    financialsTable.innerHTML = '<tr><td colspan="4" class="px-4 py-3 text-center text-sm text-gray-500 dark:text-gray-400 font-sans">Nenhum lançamento financeiro encontrado.</td></tr>';
                } else {
                    financialsTable.innerHTML = transactions.map((t: any) => `
                        <tr>
                            <td class="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100 font-sans">${t.description}</td>
                            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-sans">${new Date(t.date).toLocaleDateString('pt-BR')}</td>
                            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-sans">${t.status === 'paid' ? 'Pago' : 'Pendente'}</td>
                            <td class="px-4 py-3 whitespace-nowrap text-sm text-right font-mono ${t.type === 'revenue' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}">
                                ${t.type === 'revenue' ? '+' : '-'}${Number(t.amount || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </td>
                        </tr>
                    `).join('');
                }
            }

            // Filter tasks
            const tasks = (tasksRes.data || []).filter((t: any) => t.personType === 'seller' && t.personId === sellerId);
            if (tasksTable) {
                if (tasks.length === 0) {
                    tasksTable.innerHTML = '<tr><td colspan="3" class="px-4 py-3 text-center text-sm text-gray-500 dark:text-gray-400 font-sans">Nenhuma tarefa encontrada.</td></tr>';
                } else {
                    tasksTable.innerHTML = tasks.map((t: any) => `
                        <tr>
                            <td class="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100 font-sans">${t.title}</td>
                            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-sans">${t.dueDate ? new Date(t.dueDate).toLocaleDateString('pt-BR') : '-'}</td>
                            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-sans">${t.status}</td>
                        </tr>
                    `).join('');
                }
            }
        } catch (error) {
            console.error('Erro ao buscar dados do vendedor:', error);
        }
    }
  });
})();
