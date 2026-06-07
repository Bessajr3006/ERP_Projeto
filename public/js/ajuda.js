(() => {
    async function loadBuildInfo() {
        try {
            const res = await fetch('/build.json', { cache: 'no-store' });
            if (!res.ok)
                return null;
            const data = (await res.json());
            if (!data || typeof data !== 'object')
                return null;
            return {
                version: typeof data.version === 'string' ? data.version : undefined,
                git: typeof data.git === 'string' ? data.git : undefined,
                generatedAt: typeof data.generatedAt === 'string' ? data.generatedAt : undefined,
            };
        }
        catch {
            return null;
        }
    }
    document.addEventListener('DOMContentLoaded', () => {
        const versionEl = document.getElementById('helpVersion');
        if (!versionEl)
            return;
        loadBuildInfo().then((info) => {
            const version = String(info?.version || '').trim();
            const git = String(info?.git || '').trim();
            if (!version) {
                versionEl.textContent = 'Indisponível';
                return;
            }
            versionEl.textContent = version;
            if (git) {
                versionEl.setAttribute('title', `git: ${git}`);
            }
        });
    });
})();
