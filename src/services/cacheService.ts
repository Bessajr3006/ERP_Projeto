export class CacheService {
    private static cache = new Map<string, { value: any; expiry: number }>();

    /**
     * Define um valor no cache em memória.
     * @param key Chave de acesso única
     * @param value Dados a serem cacheados
     * @param ttlSeconds Tempo de vida em segundos (padrão: 60s)
     */
    static set(key: string, value: any, ttlSeconds: number = 60): void {
        const expiry = Date.now() + ttlSeconds * 1000;
        this.cache.set(key, { value, expiry });
    }

    /**
     * Resgata um valor do cache se ainda for válido.
     */
    static get<T>(key: string): T | null {
        const item = this.cache.get(key);
        if (!item) return null;

        if (Date.now() > item.expiry) {
            this.cache.delete(key);
            return null;
        }

        return item.value as T;
    }

    /**
     * Invalida (deleta) uma chave de cache.
     */
    static invalidate(key: string): void {
        this.cache.delete(key);
    }

    /**
     * Invalida todas as chaves que começam com um prefixo (Bom para limpar cache por tenant).
     */
    static invalidatePrefix(prefix: string): void {
        for (const key of this.cache.keys()) {
            if (key.startsWith(prefix)) {
                this.cache.delete(key);
            }
        }
    }

    /**
     * Limpa todo o cache (Em caso de testes ou reset global).
     */
    static flush(): void {
        this.cache.clear();
    }
}
