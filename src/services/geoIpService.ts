import { Request } from 'express';
import logger from '../config/logger';

interface GeoIpCacheEntry {
    location: string;
    expiresAt: number;
}

const geoIpCache = new Map<string, GeoIpCacheEntry>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_CACHE_ENTRIES = 5000;

export class GeoIpService {
    /**
     * Extrai o IP real do cliente a partir da requisição Express
     */
    static extractClientIp(req: Request): string {
        let ip = '';
        const xForwardedFor = req.headers['x-forwarded-for'];
        if (typeof xForwardedFor === 'string' && xForwardedFor.trim()) {
            ip = xForwardedFor.split(',')[0]?.trim() || '';
        } else if (Array.isArray(xForwardedFor) && xForwardedFor.length > 0) {
            ip = String(xForwardedFor[0]).split(',')[0]?.trim() || '';
        }

        if (!ip) {
            const xRealIp = req.headers['x-real-ip'];
            if (typeof xRealIp === 'string' && xRealIp.trim()) {
                ip = xRealIp.trim();
            }
        }

        if (!ip && req.ip) {
            ip = req.ip.trim();
        }

        if (!ip && req.socket?.remoteAddress) {
            ip = req.socket.remoteAddress.trim();
        }

        // Remove prefixo IPv6-mapped IPv4
        if (ip.startsWith('::ffff:')) {
            ip = ip.substring(7);
        }

        return ip || '127.0.0.1';
    }

    /**
     * Verifica se um endereço IP é loopback ou de rede privada
     */
    static isPrivateOrLoopback(ip: string): boolean {
        if (!ip) return true;
        const normalized = ip.trim().toLowerCase();

        if (normalized === '127.0.0.1' || normalized === '::1' || normalized === 'localhost' || normalized === '0.0.0.0') {
            return true;
        }

        // Checagem de faixas IPv4 privadas (RFC 1918 e RFC 3927)
        const parts = normalized.split('.').map(Number);
        if (parts.length === 4 && parts.every(p => !isNaN(p) && p >= 0 && p <= 255)) {
            const [p0, p1] = parts;
            if (p0 === 10) return true; // 10.0.0.0/8
            if (p0 === 172 && p1 !== undefined && p1 >= 16 && p1 <= 31) return true; // 172.16.0.0/12
            if (p0 === 192 && p1 === 168) return true; // 192.168.0.0/16
            if (p0 === 169 && p1 === 254) return true; // 169.254.0.0/16 (link-local)
        }

        // Checagem de IPv6 local (fe80::, fc00::, fd00::)
        if (normalized.startsWith('fe80:') || normalized.startsWith('fc00:') || normalized.startsWith('fd00:')) {
            return true;
        }

        return false;
    }

    /**
     * Resolve a localização geográfica do IP (com cache e fallback sem travar requisição)
     */
    static async resolveLocation(ip: string): Promise<string> {
        if (!ip) return 'Localização não identificada';

        const cleanIp = ip.startsWith('::ffff:') ? ip.substring(7) : ip;

        if (cleanIp === '127.0.0.1' || cleanIp === '::1' || cleanIp === 'localhost') {
            return 'Servidor Local (Loopback)';
        }

        if (this.isPrivateOrLoopback(cleanIp)) {
            return 'Rede Local / Intranet';
        }

        // Verifica cache em memória
        const cached = geoIpCache.get(cleanIp);
        const now = Date.now();
        if (cached && cached.expiresAt > now) {
            return cached.location;
        }

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 1500);

            const url = `http://ip-api.com/json/${cleanIp}?fields=status,message,country,regionName,city`;
            const response = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (!response.ok) {
                return `Localização Externa (${cleanIp})`;
            }

            const data: any = await response.json();
            if (data && data.status === 'success') {
                const parts = [];
                if (data.city) parts.push(data.city);
                if (data.regionName) parts.push(data.regionName);
                if (data.country) parts.push(data.country);

                const resolved = parts.join(', ') || 'Localização Pública';

                if (geoIpCache.size >= MAX_CACHE_ENTRIES) {
                    const oldestKey = geoIpCache.keys().next().value;
                    if (oldestKey) geoIpCache.delete(oldestKey);
                }
                geoIpCache.set(cleanIp, { location: resolved, expiresAt: now + CACHE_TTL_MS });
                return resolved;
            }
        } catch (err: any) {
            logger.debug({ err: err?.message, ip: cleanIp }, '[GeoIpService] Não foi possível consultar geolocalização do IP');
        }

        return `Localização Externa (${cleanIp})`;
    }

    /**
     * Converte um User-Agent bruto em uma descrição amigável de dispositivo e navegador
     */
    static parseUserAgent(userAgentStr?: string | null): string {
        if (!userAgentStr || typeof userAgentStr !== 'string') {
            return 'Dispositivo não identificado';
        }

        const ua = userAgentStr.toLowerCase();

        // 1. Detectar SO
        let os = 'Dispositivo';
        if (ua.includes('windows nt 10.0')) os = 'Windows 10/11';
        else if (ua.includes('windows nt 6.3')) os = 'Windows 8.1';
        else if (ua.includes('windows nt 6.1')) os = 'Windows 7';
        else if (ua.includes('windows')) os = 'Windows';
        else if (ua.includes('iphone')) os = 'iPhone (iOS)';
        else if (ua.includes('ipad')) os = 'iPad (iPadOS)';
        else if (ua.includes('android')) os = 'Android';
        else if (ua.includes('macintosh') || ua.includes('mac os x')) os = 'macOS';
        else if (ua.includes('linux')) os = 'Linux';

        // 2. Detectar Navegador
        let browser = 'Navegador Web';
        if (ua.includes('edg/')) browser = 'Edge';
        else if (ua.includes('opr/') || ua.includes('opera')) browser = 'Opera';
        else if (ua.includes('samsungbrowser')) browser = 'Samsung Internet';
        else if (ua.includes('chrome') && !ua.includes('chromium')) browser = 'Chrome';
        else if (ua.includes('firefox')) browser = 'Firefox';
        else if (ua.includes('safari') && !ua.includes('chrome')) browser = 'Safari';

        return `${browser} em ${os}`;
    }
}
