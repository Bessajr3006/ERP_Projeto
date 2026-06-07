declare global {
  interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform?: string }>;
  }

  interface Navigator {
    standalone?: boolean;
  }

  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }

  interface Window {
    DateUtils: any;
    Auth: any;
    api: any;
    UI: any;
    CacheManager: any;
    SyncManager: any;

    FilterPanel: any;
    CrudManager: any;
    Paginator: any;
    SharedFooter: any;
    GridSummaryFooter: any;
    createMaskAdapter: any;
    IMask?: any;
    gNavbarAuthContext?: any;

    openModal?: any;
    closeModal?: any;
    loadProducts?: any;
    showAlert?: any;
    currentImageBase64?: string | null;
    currentImageUrl?: string | null;

    initUserRoleDirectory?: any;
  }
}

export {};
