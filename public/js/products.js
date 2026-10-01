// @ts-nocheck
(function initProductsPage() {
    const getById = (id) => document.getElementById(id);
    const qs = (selector) => document.querySelector(selector);
    const qsa = (selector) => document.querySelectorAll(selector);
    let productsData = [];
    let g_allLoadedProducts = [];
    let priceTablesData = [];
    const PRODUCTS_FILTER_STORAGE_KEY = 'products_filter_open';
    const PRODUCT_IMAGE_MAX_BYTES = 2 * 1024 * 1024;
    const PRODUCT_IMAGE_ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']);
    let filterSearchTimer = null;
    let g_filtersRestored = false;
    const FiltersStorage = {
        save() {
            if (!g_filtersRestored)
                return;
            const filters = {
                search: getById('filterSearch')?.value || '',
                category: getById('filterCategory')?.value || '',
                manufacturer: getById('filterManufacturer')?.value || '',
                stock: getById('filterStock')?.value || '',
                image: getById('filterImage')?.value || '',
                status: getById('filterStatus')?.value || '',
                posControl: getById('filterPosControl')?.value || '',
            };
            if (window.CompanyStorage) {
                window.CompanyStorage.setItem('keystone_products_filters_v1', JSON.stringify(filters));
            }
            else {
                localStorage.setItem('keystone_products_filters_v1', JSON.stringify(filters));
            }
        },
        load() {
            try {
                const raw = window.CompanyStorage?.getItem('keystone_products_filters_v1') ?? localStorage.getItem('keystone_products_filters_v1');
                if (raw)
                    return JSON.parse(raw);
            }
            catch (e) {
                console.error('Failed to load saved filters', e);
            }
            return null;
        },
        restoreStatic() {
            const saved = this.load();
            if (!saved)
                return;
            const staticIds = {
                filterSearch: saved.search,
                filterStock: saved.stock,
                filterImage: saved.image,
                filterStatus: saved.status,
                filterPosControl: saved.posControl
            };
            Object.entries(staticIds).forEach(([id, value]) => {
                const el = getById(id);
                if (el && value !== undefined) {
                    el.value = value;
                }
            });
        },
        restoreDynamic() {
            const saved = this.load();
            if (!saved)
                return;
            const dynamicIds = {
                filterCategory: saved.category,
                filterManufacturer: saved.manufacturer
            };
            Object.entries(dynamicIds).forEach(([id, value]) => {
                const el = getById(id);
                if (el && value !== undefined) {
                    el.value = value;
                }
            });
        }
    };
    const toggleRowSelection = (cb) => {
        let parentRow = cb.closest('tr');
        if (!parentRow)
            parentRow = cb.closest('[data-product-card]');
        if (parentRow) {
            if (cb.checked) {
                parentRow.classList.add('bg-orange-50', 'dark:bg-orange-900/20', 'border-orange-200');
                parentRow.classList.remove('bg-white', 'dark:bg-slate-800', 'border-gray-100');
            }
            else {
                parentRow.classList.remove('bg-orange-50', 'dark:bg-orange-900/20', 'border-orange-200');
                parentRow.classList.add('bg-white', 'dark:bg-slate-800', 'border-gray-100');
            }
        }
    };
    const updateBulkActionsButton = () => {
        const checkedCount = qsa('.product-checkbox:checked').length;
        const btnBulk = getById('btnBulkUpdate');
        const countSpan = getById('bulkCount');
        const btnBulkDelete = getById('btnBulkDelete');
        const bulkDeleteCountSpan = getById('bulkDeleteCount');
        if (btnBulk) {
            if (checkedCount > 0) {
                btnBulk.classList.remove('hidden');
                btnBulk.classList.add('inline-flex', 'items-center', 'justify-center');
                if (countSpan)
                    countSpan.textContent = String(checkedCount);
            }
            else {
                btnBulk.classList.add('hidden');
                btnBulk.classList.remove('inline-flex', 'items-center', 'justify-center');
            }
        }
        if (btnBulkDelete) {
            if (bulkDeleteCountSpan)
                bulkDeleteCountSpan.textContent = String(checkedCount);
        }
        const btnPosControl = getById('btnPosControl');
        const posControlCountSpan = getById('posControlCount');
        if (btnPosControl) {
            if (checkedCount > 0) {
                btnPosControl.classList.remove('hidden');
                btnPosControl.classList.add('inline-flex', 'items-center', 'justify-center');
                if (posControlCountSpan)
                    posControlCountSpan.textContent = String(checkedCount);
            }
            else {
                btnPosControl.classList.add('hidden');
                btnPosControl.classList.remove('inline-flex', 'items-center', 'justify-center');
            }
        }
    };
    function hasProductImage(product) {
        return Boolean(product?.image_url || product?.image_base64);
    }
    function getProductBase64ImageSrc(imageBase64) {
        if (!imageBase64)
            return '';
        const value = String(imageBase64);
        return value.startsWith('data:') ? value : `data:image/jpeg;base64,${value}`;
    }
    function getProductImageSrc(product) {
        return getProductBase64ImageSrc(product?.image_base64) || product?.image_url || '';
    }
    function getProductImageMarkup(product, sizeClass = 'w-12 h-12') {
        const imageSrc = getProductImageSrc(product);
        if (imageSrc) {
            return `<div class="${sizeClass} rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 overflow-hidden flex items-center justify-center"><img src="${imageSrc}" alt="${product.name || 'Produto'}" class="w-full h-full object-contain p-1" /></div>`;
        }
        return `<div class="${sizeClass} rounded-lg border border-dashed border-gray-300 dark:border-slate-600 bg-gray-50 dark:bg-slate-900 flex items-center justify-center text-xs font-semibold text-gray-400 dark:text-gray-500">IMG</div>`;
    }
    function isLowStock(product) {
        return Number(product?.current_stock || 0) <= 5;
    }
    function normalizeFilterText(value) {
        return String(value || '').trim().toLowerCase();
    }
    function getProductImageFileName(source) {
        if (!source)
            return '';
        const normalized = String(source).split('?')[0];
        const parts = normalized.split('/');
        return parts[parts.length - 1] || '';
    }
    function setProductImagePreviewState({ src = '', fileName = '', showPreview = false } = {}) {
        const preview = getById('productImagePreview');
        const container = getById('productImagePreviewContainer');
        const actions = getById('productImageActions');
        const fileNameLabel = getById('productImageFileName');
        if (!preview || !container || !actions || !fileNameLabel)
            return;
        preview.src = src;
        preview.classList.toggle('hidden', !showPreview);
        container.classList.toggle('hidden', showPreview);
        actions.classList.toggle('hidden', !showPreview);
        actions.classList.toggle('flex', showPreview);
        fileNameLabel.textContent = fileName;
    }
    function setProductImageDropzoneActive(isActive) {
        const dropzone = getById('productImageDropzone');
        if (!dropzone)
            return;
        dropzone.classList.toggle('border-brand-500', isActive);
        dropzone.classList.toggle('bg-brand-50', isActive);
        dropzone.classList.toggle('dark:border-brand-400', isActive);
        dropzone.classList.toggle('ring-2', isActive);
        dropzone.classList.toggle('ring-brand-100', isActive);
    }
    function handleProductImageFile(file) {
        if (!file)
            return;
        if (!PRODUCT_IMAGE_ALLOWED_TYPES.has(file.type)) {
            alert('Formato de imagem inválido. Use PNG, JPG, JPEG ou WEBP.');
            const imageInput = getById('productImageFile');
            if (imageInput)
                imageInput.value = '';
            return;
        }
        if (file.size > PRODUCT_IMAGE_MAX_BYTES) {
            alert('A imagem deve ter no máximo 2MB.');
            const imageInput = getById('productImageFile');
            if (imageInput)
                imageInput.value = '';
            return;
        }
        const reader = new FileReader();
        reader.onload = (evt) => {
            const result = String(evt.target?.result || '');
            if (!result.includes(',')) {
                alert('Não foi possível processar a imagem selecionada.');
                return;
            }
            window.currentImageBase64 = result.split(',')[1];
            window.currentImageUrl = null;
            setProductImagePreviewState({
                src: result,
                fileName: file.name,
                showPreview: true,
            });
        };
        reader.readAsDataURL(file);
    }
    document.addEventListener('DOMContentLoaded', () => {
        if (!Auth.isAuthenticated()) {
            window.location.href = '/';
            return;
        }
        // Load User info for the navbar
        api('/auth/me').then(res => {
            const userGreeting = getById('userGreeting');
            if (userGreeting && res.data && res.data.user) {
                userGreeting.textContent = `Olá, ${res.data.user.full_name || 'Usuário'}`;
            }
            else if (userGreeting && res.data) {
                userGreeting.textContent = `Olá, ${res.data.full_name || 'Usuário'}`;
            }
            const company = res?.data?.company || res?.data?.user?.company || res?.data?.user?.company_info;
            if (company) {
                window.currentSolidconUrls = [
                    company.solidcon_url_1 || '',
                    company.solidcon_url_2 || '',
                    company.solidcon_url_3 || '',
                    company.solidcon_url_4 || '',
                    company.solidcon_url_5 || '',
                ];
                const showSolidcon = company.show_solidcon !== false && company.show_solidcon !== 0;
                const btn = getById('btnOpenSolidconModal');
                if (btn) {
                    if (!showSolidcon) {
                        btn.classList.add('hidden');
                        btn.classList.remove('inline-flex');
                        btn.style.setProperty('display', 'none', 'important');
                    }
                    else {
                        btn.classList.remove('hidden');
                        btn.classList.add('inline-flex');
                        btn.style.display = '';
                    }
                }
            }
        }).catch(err => {
            console.error('Falha ao carregar usuário', err);
        });
        let currentView = 'list';
        localStorage.setItem('productsView', 'list');
        function updateViewToggle() {
            const tableSection = getById('productsSection');
            const gridSection = getById('productsGridSection');
            if (!tableSection || !gridSection)
                return;
            currentView = 'list';
            localStorage.setItem('productsView', 'list');
            tableSection.classList.remove('hidden');
            gridSection.classList.add('products-grid-section--hidden');
            gridSection.classList.remove('grid');
        }
        // Bind Modal Events (CSP Fix)
        const btnOpen = getById('btnOpenModal');
        if (btnOpen) {
            btnOpen.addEventListener('click', () => window.openModal?.());
        }
        const btnCancel = getById('btnCancelModal');
        if (btnCancel)
            btnCancel.addEventListener('click', () => window.closeModal?.());
        const backdrop = getById('modalBackdrop');
        if (backdrop)
            backdrop.addEventListener('click', (e) => { if (e.target === backdrop)
                window.closeModal?.(); });
        const openSolidconModal = () => getById('solidconModal')?.classList.remove('hidden');
        const closeSolidconModal = () => getById('solidconModal')?.classList.add('hidden');
        const btnOpenSolidconModal = getById('btnOpenSolidconModal');
        if (btnOpenSolidconModal)
            btnOpenSolidconModal.addEventListener('click', openSolidconModal);
        const btnCloseSolidconModal = getById('btnCloseSolidconModal');
        if (btnCloseSolidconModal)
            btnCloseSolidconModal.addEventListener('click', closeSolidconModal);
        // Setup Solidcon query mode toggles
        const setupSolidconQueryModeToggles = () => {
            const eanContainer = getById('solidconEanInputContainer');
            const updateQueryModeUI = () => {
                const isEan = document.querySelector('input[name="solidconQueryMode"]:checked')?.value === 'ean';
                if (isEan) {
                    eanContainer?.classList.remove('hidden');
                }
                else {
                    eanContainer?.classList.add('hidden');
                }
            };
            document.querySelectorAll('input[name="solidconQueryMode"]').forEach(radio => {
                radio.addEventListener('change', updateQueryModeUI);
            });
            // Initialize UI state
            updateQueryModeUI();
        };
        setupSolidconQueryModeToggles();
        // Modal Tabs logic
        const tabBtnData = getById('tabBtn-data');
        const tabBtnComplemento = getById('tabBtn-complemento');
        const tabBtnImage = getById('tabBtn-image');
        const tabBtnSolidcon = getById('tabBtn-solidcon');
        if (tabBtnData && tabBtnImage) {
            tabBtnData.addEventListener('click', () => switchTab('data'));
            if (tabBtnComplemento)
                tabBtnComplemento.addEventListener('click', () => switchTab('complemento'));
            tabBtnImage.addEventListener('click', () => switchTab('image'));
            if (tabBtnSolidcon)
                tabBtnSolidcon.addEventListener('click', () => switchTab('solidcon'));
        }
        // Image Upload Logic
        const imageInput = getById('productImageFile');
        const imageDropzone = getById('productImageDropzone');
        const btnRemoveImage = getById('btnRemoveProductImage');
        if (imageInput) {
            imageInput.addEventListener('change', (e) => {
                const file = e.target.files?.[0];
                handleProductImageFile(file);
            });
        }
        if (imageDropzone) {
            ['dragenter', 'dragover', 'dragleave', 'drop'].forEach((eventName) => {
                imageDropzone.addEventListener(eventName, (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                });
            });
            ['dragenter', 'dragover'].forEach((eventName) => {
                imageDropzone.addEventListener(eventName, () => setProductImageDropzoneActive(true));
            });
            ['dragleave', 'drop'].forEach((eventName) => {
                imageDropzone.addEventListener(eventName, () => setProductImageDropzoneActive(false));
            });
            imageDropzone.addEventListener('drop', (event) => {
                const file = event.dataTransfer?.files?.[0];
                handleProductImageFile(file);
            });
        }
        if (btnRemoveImage) {
            btnRemoveImage.addEventListener('click', () => {
                window.currentImageBase64 = null;
                window.currentImageUrl = null;
                if (imageInput)
                    imageInput.value = '';
                resetImagePreview();
            });
        }
        // Markup Calculation logic
        const costPriceInput = getById('costPrice');
        const sellingPriceInput = getById('sellingPrice');
        const markupInput = getById('markupPercentage');
        if (costPriceInput && sellingPriceInput && markupInput) {
            const updateSellingFromMarkup = () => {
                const cost = parseFloat(costPriceInput.value) || 0;
                const markup = parseFloat(markupInput.value) || 0;
                if (cost >= 0 && markup >= 0) {
                    sellingPriceInput.value = (cost * (1 + (markup / 100))).toFixed(2);
                }
            };
            const updateMarkupFromSelling = () => {
                const cost = parseFloat(costPriceInput.value) || 0;
                const sell = parseFloat(sellingPriceInput.value) || 0;
                if (cost > 0) {
                    markupInput.value = (((sell / cost) - 1) * 100).toFixed(2);
                }
                else {
                    markupInput.value = '0.00';
                }
            };
            markupInput.addEventListener('input', updateSellingFromMarkup);
            costPriceInput.addEventListener('input', updateSellingFromMarkup);
            sellingPriceInput.addEventListener('input', updateMarkupFromSelling);
            const applyPriceTableSelect = getById('applyPriceTable');
            if (applyPriceTableSelect) {
                applyPriceTableSelect.addEventListener('change', () => {
                    const selectedId = applyPriceTableSelect.value;
                    if (!selectedId)
                        return;
                    const pt = (priceTablesData || []).find(p => String(p.id) === String(selectedId));
                    if (pt) {
                        markupInput.value = Number(pt.markup_percentage || 0).toFixed(2);
                        updateSellingFromMarkup();
                    }
                });
                markupInput.addEventListener('input', () => {
                    applyPriceTableSelect.value = '';
                });
                sellingPriceInput.addEventListener('input', () => {
                    applyPriceTableSelect.value = '';
                });
            }
        }
        // Bulk Markup Logic
        const bulkCostPriceInput = getById('bulkCostPrice');
        const bulkSellingPriceInput = getById('bulkSellingPrice');
        const bulkMarkupInput = getById('bulkMarkup');
        if (bulkCostPriceInput && bulkSellingPriceInput && bulkMarkupInput) {
            const updateBulkSelling = () => {
                const cost = parseFloat(bulkCostPriceInput.value) || 0;
                const markup = parseFloat(bulkMarkupInput.value) || 0;
                if (cost >= 0 && markup >= 0) {
                    bulkSellingPriceInput.value = (cost * (1 + (markup / 100))).toFixed(2);
                }
            };
            const updateBulkMarkup = () => {
                const cost = parseFloat(bulkCostPriceInput.value) || 0;
                const sell = parseFloat(bulkSellingPriceInput.value) || 0;
                if (cost > 0) {
                    bulkMarkupInput.value = (((sell / cost) - 1) * 100).toFixed(2);
                }
                else {
                    bulkMarkupInput.value = '';
                }
            };
            bulkMarkupInput.addEventListener('input', updateBulkSelling);
            bulkCostPriceInput.addEventListener('input', updateBulkSelling);
            bulkSellingPriceInput.addEventListener('input', updateBulkMarkup);
        }
        const solidconJsonInput = getById('solidconJsonInput');
        const btnFetchSolidconJson = getById('btnFetchSolidconJson');
        const btnImportSolidconJson = getById('btnImportSolidconJson');
        const solidconImportStatus = getById('solidconImportStatus');
        const solidconImportDetails = getById('solidconImportDetails');
        const setSolidconStatus = (message, type = 'info') => {
            if (!solidconImportStatus)
                return;
            solidconImportStatus.classList.remove('hidden');
            let classes = 'text-gray-700 bg-gray-100 dark:bg-slate-700 dark:text-gray-200';
            if (type === 'success') {
                classes = 'text-green-700 bg-green-50 dark:bg-green-900/30 dark:text-green-200';
            }
            else if (type === 'error') {
                classes = 'text-red-700 bg-red-50 dark:bg-red-900/30 dark:text-red-200';
            }
            else if (type === 'warning') {
                classes = 'text-yellow-700 bg-yellow-50 dark:bg-yellow-900/30 dark:text-yellow-200';
            }
            solidconImportStatus.className = `mt-3 text-sm rounded-md px-3 py-2 ${classes}`;
            solidconImportStatus.textContent = message;
        };
        const clearSolidconStatus = () => {
            if (solidconImportStatus) {
                solidconImportStatus.classList.add('hidden');
                solidconImportStatus.textContent = '';
                solidconImportStatus.className = 'hidden mt-3 text-sm rounded-md px-3 py-2';
            }
            if (solidconImportDetails) {
                solidconImportDetails.classList.add('hidden');
                solidconImportDetails.innerHTML = '';
            }
        };
        const showSolidconIgnoredDetails = (errors) => {
            if (!solidconImportDetails || !errors.length)
                return;
            const reasonCounts = errors.reduce((acc, item) => {
                const reason = String(item?.reason || 'Motivo nao informado.');
                acc[reason] = (acc[reason] || 0) + 1;
                return acc;
            }, {});
            const reasonSummary = Object.entries(reasonCounts)
                .map(([reason, count]) => `${count}x ${reason}`)
                .join('<br>');
            const examples = errors.slice(0, 20)
                .map((item) => `Item #${Number(item?.index || 0) + 1}: ${item?.reason || 'Motivo nao informado.'}`)
                .join('<br>');
            solidconImportDetails.innerHTML = `<div class="font-semibold">Por que foi ignorado</div><div class="mt-1">${reasonSummary}</div><div class="mt-2 font-semibold">Exemplos</div><div class="mt-1">${examples}${errors.length > 20 ? `<br>... mais ${errors.length - 20} item(ns)` : ''}</div>`;
            solidconImportDetails.classList.remove('hidden');
        };
        const getSelectedSolidconUrl = () => {
            const urls = window.currentSolidconUrls || [];
            return urls.find((url) => String(url || '').trim()) || '';
        };
        const normalizeItems = (value, depth = 0) => {
            if (depth > 4)
                return [];
            if (Array.isArray(value))
                return value;
            if (typeof value === 'object' && value !== null) {
                const containers = ['body', 'items', 'data', 'products', 'produtos', 'registros', 'resultado', 'results', 'rows'];
                for (const key of containers) {
                    if (value[key] !== undefined && value[key] !== null) {
                        const nestedItems = normalizeItems(value[key], depth + 1);
                        if (nestedItems.length)
                            return nestedItems;
                    }
                }
            }
            return [];
        };
        const pickUniqueKey = (item) => {
            const eanKeys = ['codigo_ean', 'ean', 'gtin', 'barcode', 'codigo_barras', 'cod_barra', 'cod_barras'];
            for (const key of eanKeys) {
                if (item?.[key])
                    return 'ean_' + String(item[key]).trim();
            }
            const idKeys = ['codigo', 'id', 'id_produto', 'idproduto', 'idprodutopos'];
            for (const key of idKeys) {
                if (item?.[key])
                    return 'id_' + String(item[key]).trim();
            }
            const nameKeys = ['descricao', 'description', 'nome', 'name'];
            for (const key of nameKeys) {
                if (item?.[key])
                    return 'name_' + String(item[key]).trim();
            }
            return '';
        };
        if (btnFetchSolidconJson && solidconJsonInput) {
            btnFetchSolidconJson.addEventListener('click', async () => {
                clearSolidconStatus();
                const queryMode = document.querySelector('input[name="solidconQueryMode"]:checked')?.value || 'all';
                const urls = window.currentSolidconUrls || [];
                if (queryMode === 'all') {
                    const url = urls[0] || '';
                    if (!url) {
                        setSolidconStatus('URL de Integração Produto não configurada na tela Minha Empresa > API/Solidcon.', 'warning');
                        return;
                    }
                    btnFetchSolidconJson.disabled = true;
                    const originalText = btnFetchSolidconJson.textContent;
                    btnFetchSolidconJson.textContent = 'Buscando...';
                    try {
                        const response = await api('/companies/proxy-consulta', {
                            method: 'POST',
                            body: JSON.stringify({ url })
                        });
                        const payload = response?.data ?? response;
                        const responseBody = payload?.body ?? payload;
                        const pageItems = normalizeItems(responseBody);
                        solidconJsonInput.value = JSON.stringify(pageItems, null, 2);
                        setSolidconStatus('JSON carregado com sucesso.', 'success');
                    }
                    catch (err) {
                        setSolidconStatus(err.message || 'Erro ao buscar JSON da Solidcon.', 'error');
                    }
                    finally {
                        btnFetchSolidconJson.textContent = originalText;
                        btnFetchSolidconJson.disabled = false;
                    }
                }
                else {
                    const url = urls[2] || '';
                    if (!url) {
                        setSolidconStatus('URL de Integração Produto por EAN não configurada na tela Minha Empresa > API/Solidcon.', 'warning');
                        return;
                    }
                    const eanInputEl = document.getElementById('solidconEanInput');
                    const eanText = eanInputEl?.value || '';
                    const eans = eanText.split('\n').map(e => e.trim()).filter(Boolean);
                    if (eans.length === 0) {
                        setSolidconStatus('Por favor, digite pelo menos um código EAN.', 'warning');
                        return;
                    }
                    btnFetchSolidconJson.disabled = true;
                    const originalText = btnFetchSolidconJson.textContent;
                    const allItems = [];
                    const seenKeys = new Set();
                    let successCount = 0;
                    let failCount = 0;
                    try {
                        for (let i = 0; i < eans.length; i++) {
                            const ean = eans[i];
                            btnFetchSolidconJson.textContent = `Buscando (${i + 1}/${eans.length})...`;
                            let eanUrl = url;
                            const lowerUrl = eanUrl.toLowerCase();
                            if (lowerUrl.includes('{ean}')) {
                                eanUrl = eanUrl.replace(/\{ean\}/gi, ean);
                            }
                            else if (eanUrl.includes('?')) {
                                eanUrl = `${eanUrl}&ean=${ean}`;
                            }
                            else {
                                if (eanUrl.endsWith('/')) {
                                    eanUrl = `${eanUrl}${ean}`;
                                }
                                else {
                                    eanUrl = `${eanUrl}/${ean}`;
                                }
                            }
                            try {
                                let responseBody = null;
                                try {
                                    const response = await api('/companies/proxy-consulta', {
                                        method: 'POST',
                                        body: JSON.stringify({ url: eanUrl })
                                    });
                                    const payload = response?.data ?? response;
                                    if (payload && (payload.statusCode === 400 || payload.ok === false) && urls[0]) {
                                        throw new Error('EAN specific endpoint returned 400 or failed. Triggering fallback.');
                                    }
                                    responseBody = payload?.body ?? payload;
                                }
                                catch (err) {
                                    if (urls[0]) {
                                        console.log(`EAN endpoint failed, trying general products URL fallback for EAN ${ean}...`);
                                        let fallbackUrl = urls[0];
                                        if (fallbackUrl.toLowerCase().includes('{ean}')) {
                                            fallbackUrl = fallbackUrl.replace(/\{ean\}/gi, ean);
                                        }
                                        else if (fallbackUrl.includes('?')) {
                                            fallbackUrl = `${fallbackUrl}&ean=${ean}`;
                                        }
                                        else {
                                            if (fallbackUrl.endsWith('/')) {
                                                fallbackUrl = `${fallbackUrl}${ean}`;
                                            }
                                            else {
                                                fallbackUrl = `${fallbackUrl}/${ean}`;
                                            }
                                        }
                                        try {
                                            const fallbackResponse = await api('/companies/proxy-consulta', {
                                                method: 'POST',
                                                body: JSON.stringify({ url: fallbackUrl })
                                            });
                                            const fallbackPayload = fallbackResponse?.data ?? fallbackResponse;
                                            responseBody = fallbackPayload?.body ?? fallbackPayload;
                                        }
                                        catch (fallbackErr) {
                                            console.error(`Erro ao consultar fallback EAN ${ean}:`, fallbackErr);
                                            throw err;
                                        }
                                    }
                                    else {
                                        throw err;
                                    }
                                }
                                const pageItems = normalizeItems(responseBody);
                                if (pageItems.length === 0 && responseBody && typeof responseBody === 'object' && !Array.isArray(responseBody)) {
                                    const hasProductKeys = ['descricao', 'description', 'nome', 'name', 'codigo_ean', 'ean'].some(k => responseBody[k] !== undefined);
                                    if (hasProductKeys) {
                                        pageItems.push(responseBody);
                                    }
                                }
                                if (pageItems.length > 0) {
                                    for (const item of pageItems) {
                                        const key = pickUniqueKey(item);
                                        if (key) {
                                            if (seenKeys.has(key))
                                                continue;
                                            seenKeys.add(key);
                                        }
                                        allItems.push(item);
                                    }
                                    successCount++;
                                }
                                else {
                                    failCount++;
                                }
                            }
                            catch (err) {
                                console.error(`Erro ao consultar EAN ${ean}:`, err);
                                failCount++;
                            }
                        }
                        if (allItems.length === 0) {
                            setSolidconStatus('Nenhum produto correspondente aos EANs informados foi encontrado.', 'warning');
                        }
                        else {
                            solidconJsonInput.value = JSON.stringify(allItems, null, 2);
                            setSolidconStatus(`JSON carregado com sucesso (${allItems.length} produtos carregados sem duplicidade, ${successCount} EANs encontrados, ${failCount} falhas).`, 'success');
                        }
                    }
                    catch (err) {
                        setSolidconStatus(err.message || 'Erro ao processar busca por EAN.', 'error');
                    }
                    finally {
                        btnFetchSolidconJson.textContent = originalText;
                        btnFetchSolidconJson.disabled = false;
                    }
                }
            });
        }
        if (btnImportSolidconJson && solidconJsonInput) {
            btnImportSolidconJson.addEventListener('click', async () => {
                clearSolidconStatus();
                const raw = String(solidconJsonInput?.value || '').trim();
                if (!raw) {
                    setSolidconStatus('Cole o JSON ou clique em "Buscar JSON" antes de importar.', 'warning');
                    return;
                }
                let parsed = null;
                try {
                    parsed = JSON.parse(raw);
                }
                catch (_error) {
                    setSolidconStatus('JSON invalido. Verifique o conteudo e tente novamente.', 'error');
                    return;
                }
                btnImportSolidconJson.disabled = true;
                const originalText = btnImportSolidconJson.textContent;
                btnImportSolidconJson.textContent = 'Importando...';
                try {
                    const result = await api('/products/solidcon-import', {
                        method: 'POST',
                        body: JSON.stringify({ payload: parsed })
                    });
                    const data = result?.data || {};
                    const created = data.created ?? 0;
                    const updated = data.updated ?? 0;
                    const skipped = data.skipped ?? 0;
                    const errors = Array.isArray(data.errors) ? data.errors : [];
                    const message = `Importacao concluida: ${created} novos, ${updated} atualizados, ${skipped} ignorados.`;
                    setSolidconStatus(message, created || updated ? 'success' : 'warning');
                    showSolidconIgnoredDetails(errors);
                    window.loadProducts();
                }
                catch (err) {
                    setSolidconStatus(err.message || 'Erro ao importar produtos da Solidcon.', 'error');
                }
                finally {
                    btnImportSolidconJson.textContent = originalText;
                    btnImportSolidconJson.disabled = false;
                }
            });
        }
        updateViewToggle();
        // ==========================================
        // Bulk Modal Logic
        // ==========================================
        const btnCancelBulkModal = getById('btnCancelBulkModal');
        if (btnCancelBulkModal) {
            btnCancelBulkModal.addEventListener('click', () => {
                getById('bulkUpdateModal').classList.add('hidden');
            });
        }
        const bulkModalBackdrop = getById('bulkModalBackdrop');
        if (bulkModalBackdrop) {
            bulkModalBackdrop.addEventListener('click', (e) => {
                if (e.target === bulkModalBackdrop)
                    getById('bulkUpdateModal').classList.add('hidden');
            });
        }
        const btnBulkUpdate = getById('btnBulkUpdate');
        if (btnBulkUpdate) {
            btnBulkUpdate.addEventListener('click', () => {
                const selected = Array.from(qsa('.product-checkbox:checked')).map((cb) => cb.value);
                if (selected.length === 0)
                    return;
                const bulkForm = getById('bulkUpdateForm');
                if (bulkForm)
                    bulkForm.reset();
                const countSpan = getById('bulkModalCount');
                if (countSpan)
                    countSpan.textContent = selected.length;
                const modal = getById('bulkUpdateModal');
                if (modal)
                    modal.classList.remove('hidden');
            });
        }
        const btnBulkDelete = getById('btnBulkDelete');
        if (btnBulkDelete) {
            btnBulkDelete.addEventListener('click', async () => {
                const selectedIds = Array.from(qsa('.product-checkbox:checked')).map((cb) => cb.value);
                if (selectedIds.length === 0)
                    return;
                if (confirm(`Deseja realmente excluir ${selectedIds.length} produto(s) selecionado(s) em lote?`)) {
                    const originalText = btnBulkDelete.textContent || '';
                    btnBulkDelete.disabled = true;
                    btnBulkDelete.textContent = 'Excluindo...';
                    try {
                        const response = await api('/products/bulk-delete', {
                            method: 'POST',
                            body: JSON.stringify({ productIds: selectedIds })
                        });
                        UI.showAlert('alertMessage', response.message || 'Produtos excluídos com sucesso!', 'success');
                        // Hide bulk buttons and modal
                        getById('bulkUpdateModal')?.classList.add('hidden');
                        getById('btnBulkUpdate')?.classList.add('hidden');
                        await loadProducts();
                    }
                    catch (error) {
                        UI.showAlert('alertMessage', error.message || 'Erro ao excluir produtos em lote.', 'error');
                    }
                    finally {
                        btnBulkDelete.disabled = false;
                        btnBulkDelete.textContent = originalText;
                    }
                }
            });
        }
        const bulkNcmInput = getById('bulkNcm');
        if (bulkNcmInput) {
            bulkNcmInput.addEventListener('input', function () {
                this.value = this.value.replace(/\D/g, '');
            });
        }
        const bulkUpdateForm = getById('bulkUpdateForm');
        if (bulkUpdateForm) {
            bulkUpdateForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const btn = getById('bulkSaveBtn');
                const selectedIds = Array.from(qsa('.product-checkbox:checked')).map((cb) => cb.value);
                if (selectedIds.length === 0)
                    return;
                const parseNumber = (val) => val ? parseFloat(String(val).replace(',', '.')) : undefined;
                const category_id = getById('bulkCategory').value ? parseInt(getById('bulkCategory').value) : undefined;
                const stock_type_id = getById('bulkStockType')?.value ? parseInt(getById('bulkStockType').value) : undefined;
                const product_type_id = getById('bulkProductType')?.value ? parseInt(getById('bulkProductType').value) : undefined;
                const manufacturer_id = getById('bulkManufacturer').value ? parseInt(getById('bulkManufacturer').value) : undefined;
                const tax_rule_id = getById('bulkTaxRule').value ? parseInt(getById('bulkTaxRule').value) : undefined;
                const measure_id = getById('bulkMeasure').value ? parseInt(getById('bulkMeasure').value) : undefined;
                const selling_price = getById('bulkSellingPrice').value ? parseNumber(getById('bulkSellingPrice').value) : undefined;
                const cost_price = getById('bulkCostPrice') && getById('bulkCostPrice').value ? parseNumber(getById('bulkCostPrice').value) : undefined;
                const min_stock = getById('bulkMinStock') && getById('bulkMinStock').value ? parseInt(getById('bulkMinStock').value) : undefined;
                const max_stock = getById('bulkMaxStock') && getById('bulkMaxStock').value ? parseInt(getById('bulkMaxStock').value) : undefined;
                const ncm = getById('bulkNcm') && getById('bulkNcm').value ? getById('bulkNcm').value.replace(/\D/g, '') : undefined;
                const activeVal = getById('bulkActive') ? getById('bulkActive').value : '';
                const active = activeVal === 'true' ? true : (activeVal === 'false' ? false : undefined);
                const payload = {
                    productIds: selectedIds,
                    category_id,
                    stock_type_id,
                    product_type_id,
                    manufacturer_id,
                    tax_rule_id,
                    measure_id,
                    selling_price,
                    cost_price,
                    min_stock,
                    max_stock,
                    ncm,
                    active
                };
                // Remove undefined values
                Object.keys(payload).forEach(key => payload[key] === undefined && delete payload[key]);
                btn.disabled = true;
                btn.textContent = 'Aplicando...';
                try {
                    const res = await api('/products/bulk-update', {
                        method: 'POST',
                        body: JSON.stringify(payload)
                    });
                    getById('bulkUpdateModal').classList.add('hidden');
                    UI.showAlert('alertMessage', res.message || 'Produtos atualizados com sucesso!', 'success');
                    const bulkBtn = getById('btnBulkUpdate');
                    if (bulkBtn)
                        bulkBtn.classList.add('hidden');
                    const selectAll = getById('selectAllCheckbox');
                    if (selectAll)
                        selectAll.checked = false;
                    window.loadProducts();
                }
                catch (error) {
                    alert(error.message);
                }
                finally {
                    btn.disabled = false;
                    btn.textContent = 'Aplicar a todos';
                }
            });
        }
        const toggleFilterBtn = getById('toggleFilterBtn');
        const filterBody = getById('filterBody');
        const filterChevron = getById('filterChevron');
        let filterIsOpen = (window.CompanyStorage?.getItem(PRODUCTS_FILTER_STORAGE_KEY) ?? localStorage.getItem(PRODUCTS_FILTER_STORAGE_KEY)) === 'true';
        if (filterBody && filterChevron) {
            filterBody.style.transition = 'none';
            filterBody.style.maxHeight = filterIsOpen ? `${filterBody.scrollHeight}px` : '0px';
            filterChevron.style.transform = filterIsOpen ? 'rotate(0deg)' : 'rotate(-90deg)';
            requestAnimationFrame(() => {
                filterBody.style.transition = '';
            });
            if (toggleFilterBtn) {
                toggleFilterBtn.addEventListener('click', () => {
                    filterIsOpen = !filterIsOpen;
                    if (window.CompanyStorage) {
                        window.CompanyStorage.setItem(PRODUCTS_FILTER_STORAGE_KEY, String(filterIsOpen));
                    }
                    else {
                        localStorage.setItem(PRODUCTS_FILTER_STORAGE_KEY, String(filterIsOpen));
                    }
                    filterBody.style.maxHeight = filterIsOpen ? `${filterBody.scrollHeight}px` : '0px';
                    filterChevron.style.transform = filterIsOpen ? 'rotate(0deg)' : 'rotate(-90deg)';
                });
            }
        }
        const btnClearFilters = getById('btnClearFilters');
        if (btnClearFilters) {
            btnClearFilters.addEventListener('click', () => {
                const fs = getById('filterSearch');
                if (fs)
                    fs.value = '';
                ['filterCategory', 'filterManufacturer', 'filterStock', 'filterImage', 'filterStatus', 'filterPosControl'].forEach(id => {
                    const el = getById(id);
                    if (el)
                        el.value = '';
                });
                applyFilters();
            });
        }
        const filterSelectors = ['filterSearch', 'filterCategory', 'filterManufacturer', 'filterStock', 'filterImage', 'filterStatus', 'filterPosControl'];
        filterSelectors.forEach((id) => {
            const el = getById(id);
            if (!el)
                return;
            if (id === 'filterSearch') {
                el.addEventListener('input', () => {
                    if (filterSearchTimer)
                        clearTimeout(filterSearchTimer);
                    filterSearchTimer = setTimeout(applyFilters, 180);
                });
                return;
            }
            el.addEventListener('change', applyFilters);
        });
        // Initialize Master Checkbox once
        const selectAllCheckbox = getById('selectAllCheckbox');
        if (selectAllCheckbox) {
            selectAllCheckbox.addEventListener('change', (e) => {
                qsa('.product-checkbox').forEach((cb) => {
                    cb.checked = e.target.checked;
                    toggleRowSelection(cb);
                });
                updateBulkActionsButton();
            });
        }
        // Static Pos-Control modal events registered once
        const btnPosControlEl = getById('btnPosControl');
        if (btnPosControlEl) {
            btnPosControlEl.addEventListener('click', () => {
                const selectedCheckboxValues = Array.from(qsa('.product-checkbox:checked')).map((cb) => String(cb.value));
                const selectedProducts = g_allLoadedProducts.filter(p => selectedCheckboxValues.includes(String(p.public_id)) || selectedCheckboxValues.includes(String(p.id)));
                if (selectedProducts.length === 0) {
                    alert('Nenhum produto selecionado.');
                    return;
                }
                const posControlFormatted = selectedProducts.map(p => {
                    const prod = {
                        ProductID: p.idprodutopos ? String(p.idprodutopos) : "",
                        StatusID: p.status_pos_id || ((p.active !== 0 && p.active !== false && p.active !== '0')
                            ? 'ABCDEABC-ABCD-ABCD-ABCD-ABCED1758966'
                            : 'ABCDEABC-ABCD-ABCD-ABCD-ABCED1457822'),
                        ProductGroupID: p.category_pos_id ? String(p.category_pos_id) : "",
                        ProductTypeID: p.product_type_pos_id ? String(p.product_type_pos_id) : "55550E77-10D1-40DA-A067-075CB2124577",
                        UnitTypeID: p.measure_pos_id ? String(p.measure_pos_id) : "55550E77-10D1-40DA-A067-075CB2124ACC",
                        Name: String(p.name || '').substring(0, 50),
                        NameEng: String(p.name_eng || p.name || '').substring(0, 50),
                        InternalCode: String(p.sku || p.external_code || ''),
                        BarCode: String(p.ean || ''),
                        BarCodeJS: p.ean ? [{ BarCode: String(p.ean) }] : [],
                        ImageBase64: String(p.image_base64 || ''),
                        NFCeNCM: String(p.ncm || ''),
                        NFCeCFOP: String(p.cfop || p.nfce_cfop || ''),
                        NFCeCST: String(p.cst || p.cst_icms || p.csosn || ''),
                        NFCeAliqICMS: String(p.icms_percentage ?? p.aliq_icms ?? '0.00'),
                        NFCeCEST: String(p.cest || ''),
                        NFCeCSTPIS: String(p.cst_pis || ''),
                        NFCeAliqPIS: String(p.pis_percentage ?? p.aliq_pis ?? '0.00'),
                        NFCeCSTCOFINS: String(p.cst_cofins || ''),
                        NFCeAliqCOFINS: String(p.cofins_percentage ?? p.aliq_cofins ?? '0.00'),
                        NFCeCodANP: "",
                        NFCeBaseRedICMS: "",
                        NFCeCodBenef: "",
                        NFCecBenef: "",
                        NFCeMotBenef: "",
                        SalePrice: String((p.is_promotional && Number(p.promotional_price) > 0 ? p.promotional_price : p.selling_price) ?? '0.00'),
                        NFCeIBS_CBS_CST: "",
                        NFCeIBS_AliqUF: "",
                        NFCeIBS_AliqMUN: "",
                        NFCeIBS_PercRedBase: "",
                        NFCeIBS_PercRedAliq: "",
                        NFCeCBS_Aliq: "",
                        NFCeCBS_PercRedBase: "",
                        NFCeCBS_PercRedAliq: ""
                    };
                    return { Product: prod };
                });
                const textarea = getById('posControlJsonTextarea');
                const modalCount = getById('posControlModalCount');
                if (textarea) {
                    textarea.value = JSON.stringify(posControlFormatted, null, 4);
                }
                if (modalCount) {
                    modalCount.textContent = selectedProducts.length;
                }
                const endpointInput = getById('posControlEndpointInput');
                const jwtInput = getById('posControlJwtInput');
                if (endpointInput)
                    endpointInput.value = 'Carregando...';
                if (jwtInput)
                    jwtInput.value = 'Carregando...';
                api('/auth/me')
                    .then(userRes => {
                    const companyPublicId = userRes.data?.company?.public_id || userRes.data?.user?.company?.public_id;
                    if (!companyPublicId)
                        throw new Error('Empresa do usuário não identificada.');
                    return api(`/companies/${companyPublicId}/poscontrol-sync/debug-info`);
                })
                    .then(debugRes => {
                    if (debugRes && debugRes.data) {
                        let url = debugRes.data.endpoint || '';
                        if (url.includes('/productgroups')) {
                            url = url.replace('/productgroups', '/products');
                        }
                        if (endpointInput)
                            endpointInput.value = url;
                        if (jwtInput)
                            jwtInput.value = debugRes.data.jwt || '';
                    }
                })
                    .catch(err => {
                    if (endpointInput)
                        endpointInput.value = 'Erro ao carregar';
                    if (jwtInput)
                        jwtInput.value = 'Erro ao carregar';
                    console.error('Erro ao carregar info de debug do Pos-Control:', err);
                });
                const modal = getById('posControlModal');
                if (modal)
                    modal.classList.remove('hidden');
            });
        }
        const closePosControlModal = () => {
            const modal = getById('posControlModal');
            if (modal)
                modal.classList.add('hidden');
        };
        const showPosControlErrorModal = (errorText) => {
            const modal = getById('posControlErrorModal');
            const textarea = getById('posControlErrorTextarea');
            if (textarea) {
                try {
                    const parsed = JSON.parse(errorText);
                    textarea.value = JSON.stringify(parsed, null, 4);
                }
                catch {
                    textarea.value = errorText;
                }
            }
            if (modal)
                modal.classList.remove('hidden');
        };
        const closePosControlErrorModal = () => {
            const modal = getById('posControlErrorModal');
            if (modal)
                modal.classList.add('hidden');
        };
        getById('btnCancelPosControlModal')?.addEventListener('click', closePosControlModal);
        getById('btnClosePosControlModalX')?.addEventListener('click', closePosControlModal);
        getById('posControlModalBackdrop')?.addEventListener('click', closePosControlModal);
        getById('btnClosePosControlErrorModalX')?.addEventListener('click', closePosControlErrorModal);
        getById('btnClosePosControlErrorModal')?.addEventListener('click', closePosControlErrorModal);
        getById('posControlErrorModalBackdrop')?.addEventListener('click', closePosControlErrorModal);
        const closePosControlSyncResultModal = () => {
            const modal = getById('posControlSyncResultModal');
            if (modal)
                modal.classList.add('hidden');
        };
        getById('btnClosePosControlSyncResultModalX')?.addEventListener('click', closePosControlSyncResultModal);
        getById('btnClosePosControlSyncResultModal')?.addEventListener('click', closePosControlSyncResultModal);
        getById('posControlSyncResultModalBackdrop')?.addEventListener('click', closePosControlSyncResultModal);
        getById('btnCopyPosControlJson')?.addEventListener('click', () => {
            const textarea = getById('posControlJsonTextarea');
            if (textarea && textarea.value) {
                navigator.clipboard.writeText(textarea.value).then(() => {
                    const btn = getById('btnCopyPosControlJson');
                    if (btn) {
                        const originalText = btn.innerHTML;
                        btn.innerHTML = `
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                        Copiado!
                    `;
                        setTimeout(() => {
                            btn.innerHTML = originalText;
                        }, 2000);
                    }
                }).catch(() => {
                    alert('Erro ao copiar JSON.');
                });
            }
        });
        getById('btnCopyPosControlEndpoint')?.addEventListener('click', () => {
            const input = getById('posControlEndpointInput');
            if (input && input.value && input.value !== 'Carregando...' && input.value !== 'Erro ao carregar') {
                navigator.clipboard.writeText(input.value).then(() => {
                    const btn = getById('btnCopyPosControlEndpoint');
                    if (btn) {
                        const originalText = btn.textContent;
                        btn.textContent = 'Copiado!';
                        setTimeout(() => { btn.textContent = originalText; }, 2000);
                    }
                });
            }
        });
        getById('btnCopyPosControlJwt')?.addEventListener('click', () => {
            const input = getById('posControlJwtInput');
            if (input && input.value && input.value !== 'Carregando...' && input.value !== 'Erro ao carregar') {
                navigator.clipboard.writeText(input.value).then(() => {
                    const btn = getById('btnCopyPosControlJwt');
                    if (btn) {
                        const originalText = btn.textContent;
                        btn.textContent = 'Copiado!';
                        setTimeout(() => { btn.textContent = originalText; }, 2000);
                    }
                });
            }
        });
        getById('btnSyncPosControl')?.addEventListener('click', async () => {
            const btn = getById('btnSyncPosControl');
            const originalText = btn.innerHTML;
            try {
                btn.disabled = true;
                btn.innerHTML = `<svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Sincronizando...`;
                const userRes = await api('/auth/me');
                const companyPublicId = userRes.data?.company?.public_id;
                if (!companyPublicId) {
                    throw new Error('Empresa do usuário não identificada.');
                }
                const configRes = await api(`/companies/${companyPublicId}/poscontrol-configs`);
                const configs = configRes.data || [];
                if (configs.length === 0) {
                    throw new Error('Nenhuma credencial do Pos-Controll configurada. Cadastre-a no menu Minha Empresa > API/Pos-Controll.');
                }
                const activeConfig = configs[0];
                const textarea = getById('posControlJsonTextarea');
                if (!textarea || !textarea.value) {
                    throw new Error('Nenhum JSON de produto gerado.');
                }
                const products = JSON.parse(textarea.value);
                const selectedIds = Array.from(qsa('.product-checkbox:checked')).map((cb) => String(cb.value));
                const response = await api(`/companies/${companyPublicId}/poscontrol-sync/products`, {
                    method: 'POST',
                    body: JSON.stringify({
                        configId: activeConfig.id,
                        products,
                        productIds: selectedIds
                    })
                });
                // Reload the local products data dynamically to refresh grid statuses
                await loadProducts();
                const resData = response.data || {};
                const sentCount = resData.sentCount || 0;
                const failedCount = resData.failedCount || 0;
                const failures = resData.failures || [];
                // Open the new result modal
                const resultModal = getById('posControlSyncResultModal');
                const successCountEl = getById('syncResultSuccessCount');
                const failedCountEl = getById('syncResultFailedCount');
                const failuresContainer = getById('syncResultFailuresContainer');
                const failuresList = getById('syncResultFailuresList');
                if (successCountEl)
                    successCountEl.textContent = String(sentCount);
                if (failedCountEl)
                    failedCountEl.textContent = String(failedCount);
                if (failuresList) {
                    failuresList.innerHTML = '';
                    if (failures.length > 0) {
                        failures.forEach((f) => {
                            const itemDiv = document.createElement('div');
                            itemDiv.className = 'p-3 bg-red-50 dark:bg-red-950/10 text-red-900 dark:text-red-300 flex flex-col gap-1';
                            const titleSpan = document.createElement('span');
                            titleSpan.className = 'font-bold';
                            titleSpan.textContent = `Produto: ${f.name} (SKU: ${f.sku})`;
                            const errorSpan = document.createElement('span');
                            errorSpan.className = 'text-gray-600 dark:text-gray-400 font-mono text-[10px] break-all';
                            errorSpan.textContent = `Erro: ${f.error}`;
                            itemDiv.appendChild(titleSpan);
                            itemDiv.appendChild(errorSpan);
                            failuresList.appendChild(itemDiv);
                        });
                        if (failuresContainer)
                            failuresContainer.classList.remove('hidden');
                    }
                    else {
                        if (failuresContainer)
                            failuresContainer.classList.add('hidden');
                    }
                }
                if (resultModal)
                    resultModal.classList.remove('hidden');
                closePosControlModal();
            }
            catch (err) {
                showPosControlErrorModal(err.message || 'Erro ao sincronizar produtos.');
            }
            finally {
                btn.disabled = false;
                btn.innerHTML = originalText;
            }
        });
        let g_importCompanyPublicId = null;
        let g_importConfigId = null;
        getById('btnImportPosControl')?.addEventListener('click', async () => {
            const btn = getById('btnImportPosControl');
            const originalText = btn.innerHTML;
            try {
                btn.disabled = true;
                btn.innerHTML = `<svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-700 dark:text-gray-300" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Buscando...`;
                const userRes = await api('/auth/me');
                const companyPublicId = userRes.data?.company?.public_id;
                if (!companyPublicId) {
                    throw new Error('Empresa do usuário não identificada.');
                }
                const configRes = await api(`/companies/${companyPublicId}/poscontrol-configs`);
                const configs = configRes.data || [];
                if (configs.length === 0) {
                    throw new Error('Nenhuma credencial do Pos-Controll configurada. Cadastre-a no menu Minha Empresa > API/Pos-Controll.');
                }
                const activeConfig = configs[0];
                g_importCompanyPublicId = companyPublicId;
                g_importConfigId = activeConfig.id;
                const res = await api(`/companies/${companyPublicId}/poscontrol-sync/fetch-products`, {
                    method: 'POST',
                    body: JSON.stringify({
                        configId: activeConfig.id
                    })
                });
                const importTextarea = getById('posControlImportJsonTextarea');
                if (importTextarea) {
                    importTextarea.value = JSON.stringify(res.data, null, 4);
                }
                const importModal = getById('posControlImportModal');
                if (importModal)
                    importModal.classList.remove('hidden');
            }
            catch (err) {
                alert(err.message || 'Erro ao buscar produtos do Pos-Controll.');
            }
            finally {
                btn.disabled = false;
                btn.innerHTML = originalText;
            }
        });
        const closePosControlImportModal = () => {
            const modal = getById('posControlImportModal');
            if (modal)
                modal.classList.add('hidden');
        };
        getById('btnCancelPosControlImportModal')?.addEventListener('click', closePosControlImportModal);
        getById('btnClosePosControlImportModalX')?.addEventListener('click', closePosControlImportModal);
        getById('posControlImportModalBackdrop')?.addEventListener('click', closePosControlImportModal);
        getById('btnConfirmPosControlImport')?.addEventListener('click', async () => {
            const btn = getById('btnConfirmPosControlImport');
            const originalText = btn.innerHTML;
            try {
                btn.disabled = true;
                btn.innerHTML = `<svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Importando...`;
                if (!g_importCompanyPublicId || !g_importConfigId) {
                    throw new Error('Estado de importação inválido.');
                }
                const textarea = getById('posControlImportJsonTextarea');
                if (!textarea || !textarea.value) {
                    throw new Error('Nenhum JSON de produtos fornecido.');
                }
                const products = JSON.parse(textarea.value);
                const res = await api(`/companies/${g_importCompanyPublicId}/poscontrol-sync/import-products`, {
                    method: 'POST',
                    body: JSON.stringify({
                        configId: g_importConfigId,
                        products
                    })
                });
                alert(`Importação concluída com sucesso!\n\nProdutos Importados: ${res.data.imported}\nProdutos Atualizados: ${res.data.updated}\nFalhas (ex: SKU duplicado): ${res.data.failed || 0}`);
                closePosControlImportModal();
                window.location.reload();
            }
            catch (err) {
                alert(err.message || 'Erro ao importar produtos.');
            }
            finally {
                btn.disabled = false;
                btn.innerHTML = originalText;
            }
        });
        FiltersStorage.restoreStatic();
        loadRelations(); // Load categories, manufacturers, etc
        window.loadProducts();
    });
    function switchTab(tabId) {
        const tabs = {
            data: { btn: getById('tabBtn-data'), content: getById('tabContent-data') },
            complemento: { btn: getById('tabBtn-complemento'), content: getById('tabContent-complemento') },
            image: { btn: getById('tabBtn-image'), content: getById('tabContent-image') },
            solidcon: { btn: getById('tabBtn-solidcon'), content: getById('tabContent-solidcon') }
        };
        if (!tabs.data.btn || !tabs.image.btn)
            return;
        for (const key in tabs) {
            const t = tabs[key];
            if (!t.btn || !t.content)
                continue;
            if (key === tabId) {
                t.btn.className = 'inline-block px-4 py-3 border-b-2 rounded-t-lg active text-brand-600 border-brand-600 dark:text-brand-500 dark:border-brand-500';
                t.content.classList.remove('hidden');
                t.content.classList.add('block');
            }
            else {
                t.btn.className = 'inline-block px-4 py-3 border-b-2 border-transparent rounded-t-lg hover:text-gray-600 hover:border-gray-300 dark:hover:text-gray-300 text-gray-500 dark:text-gray-400';
                t.content.classList.add('hidden');
                t.content.classList.remove('block');
            }
        }
    }
    function resetImagePreview() {
        const imageInput = getById('productImageFile');
        setProductImagePreviewState();
        setProductImageDropzoneActive(false);
        if (imageInput)
            imageInput.value = '';
    }
    // Helpers
    const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    // Modal Logic
    window.openModal = (data = null) => {
        const isEdit = data && data.public_id;
        getById('modalTitle').textContent = isEdit ? 'Editar Produto' : (data ? 'Duplicar Produto' : 'Novo Produto');
        const form = getById('productForm');
        if (data) {
            const cPrice = parseFloat(data.cost_price) || 0;
            const sPrice = parseFloat(data.selling_price) || 0;
            getById('productName').value = data.name || '';
            getById('productSku').value = data.sku || '';
            getById('productEan').value = data.ean || '';
            getById('productExternalCode').value = data.external_code || '';
            getById('productNcm').value = data.ncm || '';
            getById('productCest').value = data.cest || '';
            getById('productDesc').value = data.description || '';
            getById('costPrice').value = cPrice.toFixed(2) || '0.00';
            getById('sellingPrice').value = sPrice.toFixed(2) || '0.00';
            getById('promotionalActive').checked = Boolean(data.is_promotional);
            getById('productImported').checked = Boolean(data.is_imported);
            getById('promotionalPrice').value = (parseFloat(data.promotional_price) || 0).toFixed(2);
            getById('initialStock').value = data.current_stock || '0';
            getById('minStock').value = data.min_stock || '0';
            getById('maxStock').value = data.max_stock || '0';
            if (cPrice > 0) {
                getById('markupPercentage').value = (((sPrice / cPrice) - 1) * 100).toFixed(2);
            }
            else {
                getById('markupPercentage').value = '0.00';
            }
            getById('productCategory').value = data.category_id || '';
            const stockTypeEl = getById('productStockType');
            if (stockTypeEl)
                stockTypeEl.value = data.stock_type_id || '';
            const productTypeEl = getById('productProductType');
            if (productTypeEl)
                productTypeEl.value = data.product_type_id || '';
            getById('productManufacturer').value = data.manufacturer_id || '';
            getById('productTaxRule').value = data.tax_rule_id || '';
            getById('productMeasure').value = data.measure_id || '';
            getById('productIdprodutopos').value = data.idprodutopos || '';
            getById('productActive').checked = Boolean(data.active ?? true);
            const applyPriceTableEl = getById('applyPriceTable');
            if (applyPriceTableEl)
                applyPriceTableEl.value = '';
            form.dataset.id = data.public_id;
            // Setup Image — base64 no banco é a fonte principal; image_url fica como fallback.
            window.currentImageBase64 = null;
            window.currentImageUrl = null;
            if (data.image_base64) {
                window.currentImageBase64 = data.image_url ? null : data.image_base64;
                window.currentImageUrl = data.image_url || null;
                setProductImagePreviewState({
                    src: getProductBase64ImageSrc(data.image_base64),
                    fileName: data.image_url ? getProductImageFileName(data.image_url) : 'imagem-salva.jpg',
                    showPreview: true,
                });
            }
            else if (data.image_url) {
                window.currentImageUrl = data.image_url;
                setProductImagePreviewState({
                    src: data.image_url,
                    fileName: getProductImageFileName(data.image_url),
                    showPreview: true,
                });
            }
            else {
                resetImagePreview();
            }
        }
        else {
            form.reset();
            getById('productDesc').value = '';
            getById('costPrice').value = '0.00';
            getById('sellingPrice').value = '0.00';
            getById('promotionalActive').checked = false;
            getById('productImported').checked = false;
            getById('promotionalPrice').value = '0.00';
            getById('markupPercentage').value = '0.00';
            getById('initialStock').value = '0';
            getById('minStock').value = '0';
            getById('maxStock').value = '0';
            getById('productIdprodutopos').value = '';
            getById('productActive').checked = true;
            const applyPriceTableEl = getById('applyPriceTable');
            if (applyPriceTableEl)
                applyPriceTableEl.value = '';
            delete form.dataset.id;
            window.currentImageBase64 = null;
            window.currentImageUrl = null;
            resetImagePreview();
        }
        // Default to 'data' tab
        switchTab('data');
        const solidconJsonInput = getById('solidconJsonInput');
        if (solidconJsonInput) {
            solidconJsonInput.value = '';
        }
        const solidconImportStatus = getById('solidconImportStatus');
        if (solidconImportStatus) {
            solidconImportStatus.classList.add('hidden');
            solidconImportStatus.textContent = '';
        }
        getById('productModal').classList.remove('hidden');
    };
    window.closeModal = () => {
        getById('productModal').classList.add('hidden');
        resetImagePreview();
    };
    // Form Logic
    getById('productForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const saveBtn = getById('saveBtn');
        const form = getById('productForm');
        // Convert comma to dot if user types Brazilian format manually although it's a number field
        const parseNumber = (val) => parseFloat(String(val).replace(',', '.')) || 0;
        // Monta payload de imagem:
        //  - Nova imagem selecionada pelo usuário → envia image_base64 (base64 puro, sem data URI)
        //  - Imagem existente preservada          → envia image_url atual
        //  - Usuário removeu a imagem             → ambos null (apaga do banco)
        const imagePayload = {};
        if (window.currentImageBase64) {
            // Nova imagem capturada via FileReader (já é base64 puro sem prefixo data URI)
            imagePayload.image_base64 = window.currentImageBase64;
            imagePayload.image_url = undefined; // não sobrescreve com url antiga
        }
        else if (window.currentImageUrl) {
            // Imagem existente — preserva sem reprocessar
            imagePayload.image_url = window.currentImageUrl;
            imagePayload.image_base64 = null;
        }
        else {
            // Sem imagem (novo produto ou usuário removeu)
            imagePayload.image_base64 = null;
            imagePayload.image_url = null;
        }
        const payload = {
            name: getById('productName').value,
            sku: getById('productSku').value || null,
            ean: getById('productEan').value || null,
            external_code: getById('productExternalCode').value || null,
            ncm: getById('productNcm').value || '00000000',
            cest: getById('productCest').value || null,
            description: getById('productDesc').value || null,
            cost_price: parseNumber(getById('costPrice').value),
            selling_price: parseNumber(getById('sellingPrice').value),
            is_promotional: getById('promotionalActive').checked,
            is_imported: getById('productImported').checked,
            promotional_price: parseNumber(getById('promotionalPrice').value),
            initial_stock: parseInt(getById('initialStock').value) || 0,
            min_stock: parseInt(getById('minStock').value) || 0,
            max_stock: parseInt(getById('maxStock').value) || 0,
            category_id: parseInt(getById('productCategory').value) || null,
            stock_type_id: parseInt(getById('productStockType')?.value) || null,
            product_type_id: parseInt(getById('productProductType')?.value) || null,
            manufacturer_id: parseInt(getById('productManufacturer').value) || null,
            tax_rule_id: parseInt(getById('productTaxRule').value) || null,
            measure_id: parseInt(getById('productMeasure').value) || null,
            idprodutopos: getById('productIdprodutopos').value || null,
            active: getById('productActive').checked,
            ...imagePayload
        };
        saveBtn.disabled = true;
        saveBtn.textContent = 'Salvando...';
        try {
            if (form.dataset.id) {
                // Edit Mode
                await api(`/products/${form.dataset.id}`, {
                    method: 'PUT',
                    body: JSON.stringify(payload)
                });
                UI.showAlert('alertMessage', 'Produto atualizado com sucesso!', 'success');
            }
            else {
                // Create Mode
                await api('/products', {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });
                UI.showAlert('alertMessage', 'Produto cadastrado com sucesso!', 'success');
            }
            window.closeModal();
            window.loadProducts(); // Reload tables
        }
        catch (error) {
            alert(error.message);
        }
        finally {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Salvar';
        }
    });
    // Data Loading Logic
    async function loadProducts() {
        try {
            const response = await api('/products');
            productsData = response.data || [];
            g_allLoadedProducts = productsData;
            applyFilters();
        }
        catch (error) {
            console.error('Failed to load products', error);
            UI.showAlert('alertMessage', 'Erro ao carregar dados. Verifique a conexão.');
        }
    }
    window.loadProducts = loadProducts;
    function applyFilters() {
        FiltersStorage.save();
        const search = normalizeFilterText(getById('filterSearch')?.value);
        const categoryId = getById('filterCategory')?.value || '';
        const manufacturerId = getById('filterManufacturer')?.value || '';
        const stockFilter = getById('filterStock')?.value || '';
        const imageFilter = getById('filterImage')?.value || '';
        const statusFilter = getById('filterStatus')?.value || '';
        const posControlFilter = getById('filterPosControl')?.value || '';
        const filteredProducts = productsData.filter((product) => {
            if (search) {
                const searchableContent = [
                    product.name,
                    product.sku,
                    product.ean,
                    product.external_code,
                    product.category_name,
                    product.manufacturer_name
                ].map(normalizeFilterText).join(' ');
                if (!searchableContent.includes(search)) {
                    return false;
                }
            }
            if (categoryId && String(product.category_id || '') !== String(categoryId)) {
                return false;
            }
            if (manufacturerId && String(product.manufacturer_id || '') !== String(manufacturerId)) {
                return false;
            }
            if (stockFilter === 'low' && !isLowStock(product)) {
                return false;
            }
            if (stockFilter === 'in' && Number(product.current_stock || 0) <= 0) {
                return false;
            }
            if (stockFilter === 'out' && Number(product.current_stock || 0) > 0) {
                return false;
            }
            if (imageFilter === 'with' && !hasProductImage(product)) {
                return false;
            }
            if (imageFilter === 'without' && hasProductImage(product)) {
                return false;
            }
            if (statusFilter === 'active' && !product.active) {
                return false;
            }
            if (statusFilter === 'inactive' && product.active) {
                return false;
            }
            if (posControlFilter === 'synced') {
                const isSynced = Boolean(product.poscontrol_synced) && Boolean(product.idprodutopos);
                if (!isSynced)
                    return false;
            }
            if (posControlFilter === 'pending') {
                const isPending = !product.poscontrol_synced && Boolean(product.idprodutopos);
                if (!isPending)
                    return false;
            }
            if (posControlFilter === 'not_registered') {
                const isNotRegistered = !product.idprodutopos;
                if (!isNotRegistered)
                    return false;
            }
            return true;
        });
        const gridSection = getById('productsGridSection');
        const isGridVisible = gridSection && !gridSection.classList.contains('products-grid-section--hidden');
        if (!isGridVisible) {
            renderTable('productsTable', filteredProducts);
        }
        else {
            renderGrid('productsGridSection', filteredProducts);
        }
        window.GridSummaryFooter?.update({
            footerId: 'productsResultsFooter',
            anchorId: 'productsGridSection',
            count: filteredProducts.length,
            label: 'produto(s) exibido(s)',
            extraHtml: `
            <div class="hidden lg:flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                <div class="flex items-center gap-1.5">
                    <span class="text-gray-400 dark:text-gray-500 font-medium">Estoque:</span>
                    <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">Baixo</span>
                </div>
                <div class="flex items-center gap-1.5">
                    <span class="text-gray-400 dark:text-gray-500 font-medium">Origem:</span>
                    <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">Importado</span>
                    <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-gray-300">Manual</span>
                </div>
                <div class="flex items-center gap-1.5">
                    <span class="text-gray-400 dark:text-gray-500 font-medium">Pos-Controll:</span>
                    <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">Sincronizado</span>
                    <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">Pendente</span>
                    <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">Não Cadastrado</span>
                </div>
            </div>
        `
        });
        bindActionEvents();
    }
    function renderTable(elementId, items) {
        const tbody = getById(elementId);
        if (items.length === 0) {
            tbody.innerHTML = `<tr><td colspan="22" class="px-6 py-4 text-center text-sm text-gray-500">Nenhum registro encontrado.</td></tr>`;
            return;
        }
        tbody.innerHTML = items.map(p => `
        <tr class="hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors">
            <td class="px-6 py-4 whitespace-nowrap w-12 text-center text-sm">
                <input type="checkbox" value="${p.public_id}" class="product-checkbox rounded border-gray-300 text-brand-600 shadow-sm focus:border-brand-300 focus:ring focus:ring-brand-200 focus:ring-opacity-50 dark:bg-slate-800 dark:border-slate-600">
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-mono">#${String(p.id).padStart(4, '0')}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-mono">${p.idprodutopos || '-'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-mono">${p.sku || '-'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-mono">${p.ean || '-'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-mono">${p.ncm || '-'}</td>
            <td class="px-6 py-4 whitespace-nowrap">${getProductImageMarkup(p)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">${p.name}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-mono">${p.category_name || '-'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-mono">${p.manufacturer_name || '-'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-mono">${p.stock_type_name || '-'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-mono">${p.product_type_name || '-'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-mono">${formatCurrency(p.cost_price || 0)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-mono text-center">${p.cost_price > 0 ? (((p.selling_price / p.cost_price) - 1) * 100).toFixed(2) + '%' : '0.00%'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 font-bold">${formatCurrency(p.selling_price)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-gray-100">
                ${p.is_promotional && Number(p.promotional_price) > 0 ? `
                    <div class="flex flex-col">
                        <span class="text-emerald-600 dark:text-emerald-400">${formatCurrency(p.promotional_price)}</span>
                        <span class="text-[10px] line-through text-gray-400 font-normal">${formatCurrency(p.selling_price)}</span>
                    </div>
                ` : `
                    <span>${formatCurrency(p.selling_price)}</span>
                `}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-mono text-left">
                <div class="space-y-0.5">
                    ${(priceTablesData || []).filter(pt => pt.status === 'active').map(pt => `
                        <div class="flex items-center gap-1 text-[11px] whitespace-nowrap">
                            <span class="text-gray-400 dark:text-gray-500">${pt.name}:</span>
                            <span class="font-semibold text-gray-700 dark:text-gray-300">${formatCurrency(Number(p.cost_price || 0) * (1 + Number(pt.markup_percentage || 0) / 100))}</span>
                        </div>
                    `).join('') || '<span class="text-gray-400 dark:text-gray-500 text-xs">-</span>'}
                </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-mono text-center">${p.min_stock || 0}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-mono text-center">${p.max_stock || 0}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-bold ${isLowStock(p) ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}">
                ${p.current_stock} <span class="text-xs font-normal text-gray-400 ml-1">${p.measure_abbreviation || 'UN'}</span>
                ${isLowStock(p) ? '<span class="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">Baixo</span>' : ''}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-mono text-center">${p.external_code || '-'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-center">
                ${p.is_imported
            ? '<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">Importado</span>'
            : '<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-gray-300">Manual</span>'}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-center">
                ${(p.poscontrol_synced && p.idprodutopos)
            ? '<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">Sincronizado</span>'
            : (!p.idprodutopos
                ? '<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">Não Cadastrado</span>'
                : '<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">Pendente</span>')}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-center">
                ${p.active
            ? '<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">Ativo</span>'
            : '<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">Inativo</span>'}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <button type="button" title="Editar" class="text-brand-600 hover:text-brand-900 dark:hover:text-brand-400 mr-3 edit-btn" data-item='${JSON.stringify(p).replace(/'/g, "&#39;")}'>
                    <svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                </button>
                <button type="button" title="Duplicar" class="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 mr-3 duplicate-btn" data-item='${JSON.stringify(p).replace(/'/g, "&#39;")}'>
                    <svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                </button>
                <button type="button" title="Excluir" class="text-red-600 hover:text-red-900 dark:hover:text-red-400 delete-btn" data-id="${p.public_id}">
                    <svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                </button>
            </td>
        </tr>
    `).join('');
    }
    function renderGrid(elementId, items) {
        const grid = getById(elementId);
        if (items.length === 0) {
            grid.innerHTML = `<div class="col-span-full text-center py-8 text-sm text-gray-500 dark:text-gray-400 border-2 border-dashed border-gray-200 dark:border-slate-700 rounded-lg">Nenhum registro encontrado.</div>`;
            return;
        }
        grid.innerHTML = items.map((product) => {
            const imageSrc = getProductImageSrc(product);
            const markup = Number(product.cost_price || 0) > 0
                ? (((Number(product.selling_price || 0) / Number(product.cost_price || 0)) - 1) * 100).toFixed(2) + '%'
                : '0.00%';
            const productJson = JSON.stringify(product).replace(/'/g, "&#39;");
            return `
        <div data-product-card class="bg-white dark:bg-slate-800 shadow-sm rounded-lg overflow-hidden flex flex-col relative border border-gray-200 dark:border-slate-700 hover:border-brand-200 dark:hover:border-brand-700 transition-colors group min-w-0 h-full">
            <div class="w-full h-36 bg-gray-50 dark:bg-slate-900/60 border-b border-gray-100 dark:border-slate-700 flex items-center justify-center overflow-hidden shrink-0">
                ${imageSrc
                ? `<img src="${imageSrc}" alt="${product.name}" class="w-full h-full object-contain p-2" onerror="this.parentElement.innerHTML='<div class=\'w-full h-full flex items-center justify-center text-gray-300 dark:text-slate-600\'><svg class=\'w-12 h-12\' fill=\'none\' stroke=\'currentColor\' viewBox=\'0 0 24 24\'><path stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'1\' d=\'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z\'></path></svg></div>'">`
                : `<div class="flex flex-col items-center justify-center text-gray-300 dark:text-slate-600">
                        <svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                        <span class="mt-1 text-xs">Sem imagem</span>
                    </div>`}
            </div>

            <div class="p-4 flex flex-col flex-1 min-w-0">
                <div class="flex justify-between items-start gap-3 mb-3">
                    <label class="flex items-center min-w-0">
                        <input type="checkbox" value="${product.public_id}" class="product-checkbox rounded border-gray-300 text-brand-600 shadow-sm focus:border-brand-300 focus:ring focus:ring-brand-200 focus:ring-opacity-50 dark:bg-slate-800 dark:border-slate-600">
                        <span class="ml-2 text-xs font-mono font-medium text-gray-500 dark:text-gray-400 truncate">#${String(product.id).padStart(4, '0')}</span>
                    </label>
                    <div class="flex gap-1 shrink-0">
                        <button type="button" title="Editar" class="p-1.5 text-gray-500 hover:text-brand-600 hover:bg-brand-50 dark:hover:text-brand-300 dark:hover:bg-brand-900/30 rounded-md transition-colors edit-btn" data-item='${productJson}'>
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                        </button>
                        <button type="button" title="Duplicar" class="p-1.5 text-gray-500 hover:text-brand-600 hover:bg-brand-50 dark:hover:text-brand-300 dark:hover:bg-brand-900/30 rounded-md transition-colors duplicate-btn" data-item='${productJson}'>
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                        </button>
                        <button type="button" title="Excluir" class="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-900/30 rounded-md transition-colors delete-btn" data-id="${product.public_id}">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                        </button>
                    </div>
                </div>

                <div class="min-w-0 flex-1">
                    <h4 class="text-base font-bold leading-tight text-gray-900 dark:text-gray-100 wrap-break-word">${product.name}</h4>
                    <div class="mt-2 flex flex-wrap gap-1.5">
                        <span class="max-w-full truncate text-xs text-brand-600 dark:text-brand-300 bg-brand-50 dark:bg-brand-900/30 px-2 py-0.5 rounded font-medium">${product.category_name || 'Sem Categoria'}</span>
                        <span class="max-w-full truncate text-xs font-mono text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded">${product.stock_type_name || 'Sem Tipo de Estoque'}</span>
                        <span class="max-w-full truncate text-xs font-mono text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 px-2 py-0.5 rounded">${product.product_type_name || 'Sem Tipo de Produto'}</span>
                        <span class="max-w-full truncate text-xs font-mono text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-slate-700 px-2 py-0.5 rounded">SKU: ${product.sku || 'N/A'}</span>
                        ${product.ean ? `<span class="max-w-full truncate text-xs font-mono text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-slate-700 px-2 py-0.5 rounded">EAN: ${product.ean}</span>` : ''}
                        ${product.external_code ? `<span class="max-w-full truncate text-xs font-mono text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-slate-700 px-2 py-0.5 rounded">Ext: ${product.external_code}</span>` : ''}
                        <span class="max-w-full truncate text-xs font-medium ${product.active ? 'text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/30' : 'text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/30'} px-2 py-0.5 rounded">${product.active ? 'Ativo' : 'Inativo'}</span>
                        <span class="max-w-full truncate text-xs font-medium ${product.is_imported ? 'text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30' : 'text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-slate-700'} px-2 py-0.5 rounded">${product.is_imported ? 'Importado' : 'Manual'}</span>
                        ${(product.poscontrol_synced && product.idprodutopos)
                ? `<span class="max-w-full truncate text-xs font-semibold text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/30 px-2 py-0.5 rounded">POS: Sincronizado</span>`
                : (!product.idprodutopos
                    ? `<span class="max-w-full truncate text-xs font-semibold text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/30 px-2 py-0.5 rounded">POS: Não Cadastrado</span>`
                    : `<span class="max-w-full truncate text-xs font-semibold text-yellow-700 dark:text-yellow-300 bg-yellow-50 dark:bg-yellow-900/30 px-2 py-0.5 rounded">POS: Pendente</span>`)}
                        <span class="max-w-full truncate text-xs font-mono text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/30 px-2 py-0.5 rounded">ID POS: ${product.idprodutopos || 'N/A'}</span>
                    </div>

                    <div class="mt-4 grid grid-cols-2 gap-2 text-sm">
                        <div class="bg-gray-50 dark:bg-slate-900/50 rounded p-2 border border-gray-100 dark:border-slate-700/50 min-w-0">
                            <p class="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">Custo</p>
                            <p class="font-medium text-gray-700 dark:text-gray-300 truncate">${formatCurrency(product.cost_price || 0)}</p>
                        </div>
                        <div class="bg-gray-50 dark:bg-slate-900/50 rounded p-2 border border-gray-100 dark:border-slate-700/50 min-w-0">
                            <p class="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">Venda</p>
                            <p class="font-bold text-brand-600 dark:text-brand-400 truncate">${formatCurrency(product.selling_price || 0)}</p>
                        </div>
                        <div class="bg-gray-50 dark:bg-slate-900/50 rounded p-2 border border-gray-100 dark:border-slate-700/50 min-w-0">
                            <p class="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">Promoção</p>
                            ${product.is_promotional && Number(product.promotional_price) > 0
                ? `<p class="font-bold text-emerald-600 dark:text-emerald-400 truncate">${formatCurrency(product.promotional_price)}</p>`
                : '<p class="font-medium text-gray-500 dark:text-gray-400">Não</p>'}
                        </div>
                        <div class="bg-gray-50 dark:bg-slate-900/50 rounded p-2 border border-gray-100 dark:border-slate-700/50 min-w-0">
                            <p class="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">Markup</p>
                            <p class="font-medium text-gray-700 dark:text-gray-300 truncate">${markup}</p>
                        </div>
                        <div class="bg-gray-50 dark:bg-slate-900/50 rounded p-2 border border-gray-100 dark:border-slate-700/50 min-w-0 col-span-2">
                            <p class="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">Tabelas de Preço</p>
                            <div class="space-y-0.5 text-xs font-mono">
                                ${(priceTablesData || []).filter(pt => pt.status === 'active').map(pt => `
                                    <div class="flex justify-between">
                                        <span class="text-gray-400 dark:text-gray-500">${pt.name}:</span>
                                        <span class="font-semibold text-gray-900 dark:text-gray-100">${formatCurrency(Number(product.cost_price || 0) * (1 + Number(pt.markup_percentage || 0) / 100))}</span>
                                    </div>
                                `).join('') || '<span class="text-gray-400">-</span>'}
                            </div>
                        </div>
                    </div>
                </div>

                <div class="mt-auto pt-4 border-t border-gray-100 dark:border-slate-700 flex justify-between items-center gap-3">
                    <div class="text-xs text-gray-500 dark:text-gray-400">
                        Min ${product.min_stock || 0} / Max ${product.max_stock || 0}
                    </div>
                    <div class="flex items-center gap-2 shrink-0">
                        <span class="text-lg font-bold text-green-600 dark:text-green-400">${product.current_stock || 0} <span class="text-xs font-normal text-gray-400 ml-0.5">${product.measure_abbreviation || 'UN'}</span></span>
                    </div>
                </div>
            </div>
        </div>`;
        }).join('');
    }
    function bindActionEvents() {
        // Bind Edit
        qsa('.edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const item = JSON.parse(e.currentTarget.getAttribute('data-item'));
                window.openModal(item);
            });
        });
        // Bind Duplicate
        qsa('.duplicate-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const item = JSON.parse(e.currentTarget.getAttribute('data-item'));
                item.public_id = ''; // Clear ID so it initiates a new POST operation
                window.openModal(item);
            });
        });
        // Bind Delete
        qsa('.delete-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                if (confirm('Deseja realmente excluir este produto?')) {
                    const id = e.currentTarget.getAttribute('data-id');
                    try {
                        await api(`/products/${id}`, { method: 'DELETE' });
                        UI.showAlert('alertMessage', 'Produto excluído com sucesso!', 'success');
                        window.loadProducts();
                    }
                    catch (error) {
                        alert('Erro ao excluir: ' + error.message);
                    }
                }
            });
        });
        // Monitorar Checkboxes individuais para ajustar o master checkbox
        qsa('.product-checkbox').forEach(cb => {
            cb.addEventListener('change', () => {
                toggleRowSelection(cb);
                const allBoxes = qsa('.product-checkbox');
                const allChecked = Array.from(allBoxes).every((c) => c.checked);
                const selectAllCheckbox = getById('selectAllCheckbox');
                if (selectAllCheckbox)
                    selectAllCheckbox.checked = allBoxes.length > 0 && allChecked;
                updateBulkActionsButton();
            });
        });
        updateBulkActionsButton();
    }
    // Loads Categories, Manufacturers, and TaxRules into the selects
    async function loadRelations() {
        try {
            const [catsRes, manufsRes, taxesRes, measuresRes, stockTypesRes, pricesRes, productTypesRes] = await Promise.all([
                api('/estoque/categories'),
                api('/estoque/manufacturers'),
                api('/estoque/taxes'),
                api('/estoque/measures'),
                api('/estoque/stock-types'),
                api('/estoque/prices'),
                api('/products/product-types')
            ]);
            const categories = catsRes.data || [];
            const manufacturers = manufsRes.data || [];
            priceTablesData = pricesRes.data || [];
            populateSelect('productCategory', categories, 'Nenhuma');
            populateSelect('productStockType', stockTypesRes.data, 'Nenhum');
            populateSelect('productProductType', productTypesRes.data, 'Nenhum');
            populateSelect('productManufacturer', manufacturers, 'Nenhum');
            populateSelect('productTaxRule', taxesRes.data, 'Nenhuma');
            populateSelect('productMeasure', measuresRes.data, 'Nenhuma');
            populateSelect('applyPriceTable', priceTablesData, 'Nenhuma');
            populateSelect('filterCategory', categories, 'Todas as Categorias');
            populateSelect('filterManufacturer', manufacturers, 'Todos os Fabricantes');
            FiltersStorage.restoreDynamic();
            g_filtersRestored = true;
            // Also populate bulk update modal dropdowns
            populateSelect('bulkCategory', categories, '-- Não alterar --');
            populateSelect('bulkStockType', stockTypesRes.data, '-- Não alterar --');
            populateSelect('bulkProductType', productTypesRes.data, '-- Não alterar --');
            populateSelect('bulkManufacturer', manufacturers, '-- Não alterar --');
            populateSelect('bulkTaxRule', taxesRes.data, '-- Não alterar --');
            populateSelect('bulkMeasure', measuresRes.data, '-- Não alterar --');
            applyFilters();
        }
        catch (e) {
            console.warn('Erro ao carregar relações.', e);
        }
    }
    function populateSelect(elementId, items, defaultLabel) {
        const el = getById(elementId);
        if (!el)
            return;
        el.innerHTML = `<option value="">${defaultLabel}</option>` +
            (items || []).map(i => `<option value="${i.id}">${i.name}</option>`).join('');
    }
    // ==========================================
    // NFe XML Import Logic
    // ==========================================
    let sequentialQueue = [];
    async function handleNfeXmlImport(e) {
        const file = e.target?.files?.[0];
        if (!file)
            return;
        // Reset input for later
        e.target.value = '';
        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const parser = new DOMParser();
                const xmlText = String(evt.target?.result || '');
                const xmlDoc = parser.parseFromString(xmlText, "text/xml");
                // Check for parsing errors
                if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
                    throw new Error("Invalid XML file");
                }
                const detList = xmlDoc.getElementsByTagName("det");
                if (!detList || detList.length === 0) {
                    window.showAlert?.("Nenhum produto encontrado neste XML da NFe.", "warning", 3000);
                    return;
                }
                const newProducts = [];
                for (let i = 0; i < detList.length; i++) {
                    const prod = detList[i].getElementsByTagName("prod")[0];
                    if (!prod)
                        continue;
                    const cProd = prod.getElementsByTagName("cProd")[0]?.textContent || '';
                    const cEAN = prod.getElementsByTagName("cEAN")[0]?.textContent || '';
                    const xProd = prod.getElementsByTagName("xProd")[0]?.textContent || '';
                    const uCom = prod.getElementsByTagName("uCom")[0]?.textContent || 'UN';
                    const vUnCom = parseFloat(prod.getElementsByTagName("vUnCom")[0]?.textContent || '0');
                    // Tratar "SEM GTIN"
                    const ean = (cEAN === 'SEM GTIN' || !cEAN) ? '' : cEAN;
                    newProducts.push({
                        name: xProd,
                        sku: cProd,
                        ean: ean,
                        cost_price: vUnCom,
                        description: `Importado via NFe. Medida original: ${uCom}`
                    });
                }
                if (newProducts.length === 0) {
                    window.showAlert?.("Não foi possível extrair dados dos produtos.", "error");
                    return;
                }
                if (confirm(`Encontrados ${newProducts.length} produtos na NFe.\nDeseja iniciar a importação em sequência?`)) {
                    startSequentialImport(newProducts);
                }
            }
            catch (error) {
                console.error("NFe Parse Error", error);
                window.showAlert?.("Erro ao processar arquivo XML.", "error");
            }
        };
        reader.readAsText(file);
    }
    function startSequentialImport(productsArray) {
        // Filter out items already perfectly exact in DB by SKU or EAN to avoid duplicates
        const uniqueToImport = productsArray.filter(np => {
            return !g_allLoadedProducts.some(dbP => (np.sku && dbP.sku === np.sku) ||
                (np.ean && dbP.ean === np.ean));
        });
        if (uniqueToImport.length === 0) {
            window.showAlert?.("Todos os produtos desta NFe já constam no banco de dados!", "info", 4000);
            return;
        }
        if (uniqueToImport.length < productsArray.length) {
            if (!confirm(`${productsArray.length - uniqueToImport.length} produtos já existem e serão ignorados.\nDeseja importar os ${uniqueToImport.length} restantes?`))
                return;
        }
        sequentialQueue = uniqueToImport;
        openNextFromQueue();
    }
    function openNextFromQueue() {
        if (sequentialQueue.length === 0) {
            window.showAlert?.("Todos os produtos da NFe foram importados!", "success", 4000);
            // Reset default behavior
            const saveSpan = qs('#productForm button[type="submit"] span');
            if (saveSpan)
                saveSpan.textContent = "Salvar Produto";
            return;
        }
        const nextProduct = sequentialQueue.shift();
        // Change modal Save button style/text temporarily to reflect queued execution
        const saveSpan = qs('#productForm button[type="submit"] span');
        if (saveSpan) {
            saveSpan.textContent = `Salvar & Próximo da NFe (${sequentialQueue.length} restando)`;
        }
        window.openModal(nextProduct);
    }
    // We intercept closeModal to check if we are dropping a queue
    const originalCloseModal = window.closeModal;
    window.closeModal = () => {
        if (sequentialQueue.length > 0) {
            if (!confirm(`Existem mais ${sequentialQueue.length} produtos na fila da NFe. Deseja cancelar o restante da importação?`)) {
                return; // Abort the close
            }
            sequentialQueue = [];
            const saveSpan = qs('#productForm button[type="submit"] span');
            if (saveSpan)
                saveSpan.textContent = "Salvar Produto";
        }
        originalCloseModal();
    };
    // We intercept loadProducts success callback to check for queue triggers after a save
    const originalLoadProducts = window.loadProducts;
    window.loadProducts = async () => {
        await originalLoadProducts();
        if (sequentialQueue && sequentialQueue.length > 0) {
            setTimeout(() => {
                openNextFromQueue();
            }, 500); // slight delay to show the grid update before opening next modal
        }
    };
})();
