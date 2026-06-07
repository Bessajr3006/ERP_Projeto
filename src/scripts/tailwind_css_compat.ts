#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

type RGBA = { r: number; g: number; b: number; a: number };

const ROOT = path.resolve(__dirname, '../..');
const INPUT = path.join(ROOT, 'src', 'input.css');
const OUTPUT = path.join(ROOT, 'public', 'css', 'style.css');
const isWatchMode = process.argv.includes('--watch');
const explicitOutput = process.argv.find((arg) => arg.endsWith('.css'));
const outputFile = explicitOutput ? path.resolve(ROOT, explicitOutput) : OUTPUT;

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

function toByte(value: number): number {
    return Math.round(clamp(value, 0, 1) * 255);
}

function linearToSrgb(value: number): number {
    if (value <= 0.0031308) {
        return 12.92 * value;
    }

    return 1.055 * (value ** (1 / 2.4)) - 0.055;
}

function normalizeHex(hex: string): RGBA | null {
    const value = hex.trim().replace('#', '');

    if (value.length === 3) {
        const r = value.charAt(0);
        const g = value.charAt(1);
        const b = value.charAt(2);
        return {
            r: parseInt(r + r, 16),
            g: parseInt(g + g, 16),
            b: parseInt(b + b, 16),
            a: 255,
        };
    }

    if (value.length === 4) {
        const r = value.charAt(0);
        const g = value.charAt(1);
        const b = value.charAt(2);
        const a = value.charAt(3);
        return {
            r: parseInt(r + r, 16),
            g: parseInt(g + g, 16),
            b: parseInt(b + b, 16),
            a: parseInt(a + a, 16),
        };
    }

    if (value.length === 6) {
        return {
            r: parseInt(value.slice(0, 2), 16),
            g: parseInt(value.slice(2, 4), 16),
            b: parseInt(value.slice(4, 6), 16),
            a: 255,
        };
    }

    if (value.length === 8) {
        return {
            r: parseInt(value.slice(0, 2), 16),
            g: parseInt(value.slice(2, 4), 16),
            b: parseInt(value.slice(4, 6), 16),
            a: parseInt(value.slice(6, 8), 16),
        };
    }

    return null;
}

function rgbaToHex({ r, g, b, a }: RGBA): string {
    const alpha = clamp(a / 255, 0, 1);

    if (alpha >= 0.999) {
        return `#${[r, g, b].map((item) => item.toString(16).padStart(2, '0')).join('')}`;
    }

    return `#${[r, g, b, a].map((item) => item.toString(16).padStart(2, '0')).join('')}`;
}

function parseAlpha(alphaText?: string): number {
    if (!alphaText) {
        return 1;
    }

    const value = alphaText.trim();
    if (value.endsWith('%')) {
        return clamp(Number.parseFloat(value) / 100, 0, 1);
    }

    return clamp(Number.parseFloat(value), 0, 1);
}

function oklchToHex(oklch: string): string | null {
    const match = oklch
        .trim()
        .match(/^oklch\(\s*([0-9.]+)%\s+([0-9.]+)\s+([0-9.]+)(?:\s*\/\s*([0-9.]+%?))?\s*\)$/i);

    if (!match) {
        return null;
    }

    const l = Number.parseFloat(match[1]!) / 100;
    const c = Number.parseFloat(match[2]!);
    const h = (Number.parseFloat(match[3]!) * Math.PI) / 180;
    const alpha = parseAlpha(match[4]);

    const a = c * Math.cos(h);
    const b = c * Math.sin(h);

    const lPrime = l + 0.3963377774 * a + 0.2158037573 * b;
    const mPrime = l - 0.1055613458 * a - 0.0638541728 * b;
    const sPrime = l - 0.0894841775 * a - 1.291485548 * b;

    const lLinear = lPrime ** 3;
    const mLinear = mPrime ** 3;
    const sLinear = sPrime ** 3;

    const redLinear = 4.0767416621 * lLinear - 3.3077115913 * mLinear + 0.2309699292 * sLinear;
    const greenLinear = -1.2684380046 * lLinear + 2.6097574011 * mLinear - 0.3413193965 * sLinear;
    const blueLinear = -0.0041960863 * lLinear - 0.7034186147 * mLinear + 1.707614701 * sLinear;

    return rgbaToHex({
        r: toByte(linearToSrgb(clamp(redLinear, 0, 1))),
        g: toByte(linearToSrgb(clamp(greenLinear, 0, 1))),
        b: toByte(linearToSrgb(clamp(blueLinear, 0, 1))),
        a: toByte(alpha),
    });
}

function resolveColorToken(token: string, colorVars: Map<string, string>): string | null {
    const value = token.trim();

    if (/^#[0-9a-f]{3,8}$/i.test(value)) {
        return value;
    }

    if (/^oklch\(/i.test(value)) {
        return oklchToHex(value);
    }

    const varMatch = value.match(/^var\((--color-[^)]+)\)$/i);
    if (varMatch) {
        return colorVars.get(varMatch[1]!) || null;
    }

    return null;
}

function applyOpacity(color: string, opacity: number): string {
    const rgba = normalizeHex(color);
    if (!rgba) {
        return color;
    }

    return rgbaToHex({
        r: rgba.r,
        g: rgba.g,
        b: rgba.b,
        a: Math.round(rgba.a * clamp(opacity, 0, 1)),
    });
}

function sanitizeCssFile(filePath: string): boolean {
    if (!fs.existsSync(filePath)) {
        return false;
    }

    const originalCss = fs.readFileSync(filePath, 'utf8');
    let nextCss = originalCss;

    const colorVars = new Map<string, string>();
    for (const match of originalCss.matchAll(/(--color-[\w-]+)\s*:\s*([^;]+);/g)) {
        const variableName = match[1];
        const rawValue = match[2];
        if (!variableName || !rawValue) {
            continue;
        }
        const resolved = resolveColorToken(rawValue, colorVars);
        if (resolved) {
            colorVars.set(variableName, resolved);
        }
    }

    nextCss = nextCss.replace(
        /color-mix\(in srgb,\s*([^,]+?)\s+([0-9.]+)%,\s*transparent\s*\)/gi,
        (fullMatch: string, colorToken: string, percentText: string) => {
            const resolvedColor = resolveColorToken(colorToken, colorVars);
            if (!resolvedColor) {
                return fullMatch;
            }

            const opacity = Number.parseFloat(percentText) / 100;
            return applyOpacity(resolvedColor, opacity);
        },
    );

    nextCss = nextCss.replace(/^\s*scrollbar-width:\s*none;\n?/gm, '');
    nextCss = nextCss.replace(/^\s*-webkit-text-size-adjust:\s*100%;\n?/gm, '');
    nextCss = nextCss.replace(/^\s*text-size-adjust:\s*100%;\n?/gm, '');
    nextCss = nextCss.replace(/text-wrap:\s*balance;/g, 'overflow-wrap: break-word;');

    if (nextCss === originalCss) {
        return false;
    }

    fs.writeFileSync(filePath, nextCss, 'utf8');
    return true;
}

function getTailwindBinary(): string {
    return process.platform === 'win32'
        ? path.join(ROOT, 'node_modules', '.bin', 'tailwindcss.cmd')
        : path.join(ROOT, 'node_modules', '.bin', 'tailwindcss');
}

function runBuild({ watch }: { watch: boolean }): void {
    const args = ['-i', INPUT, '-o', outputFile];
    if (watch) {
        args.push('--watch');
    }

    const child = spawn(getTailwindBinary(), args, {
        cwd: ROOT,
        stdio: 'inherit',
    });

    if (watch) {
        let debounceHandle: NodeJS.Timeout | null = null;
        const outputDir = path.dirname(outputFile);
        const outputBase = path.basename(outputFile);

        fs.watch(outputDir, (eventType, filename) => {
            void eventType;
            const name = filename ? filename.toString() : '';
            if (!name || name !== outputBase) {
                return;
            }

            if (debounceHandle) {
                clearTimeout(debounceHandle);
            }

            debounceHandle = setTimeout(() => {
                try {
                    sanitizeCssFile(outputFile);
                } catch (error) {
                    console.error('[tailwind-css-compat] Falha ao sanitizar CSS:', error);
                }
            }, 75);
        });
    }

    child.on('exit', (code) => {
        if (!watch) {
            try {
                sanitizeCssFile(outputFile);
            } catch (error) {
                console.error('[tailwind-css-compat] Falha ao sanitizar CSS:', error);
                process.exit(1);
                return;
            }
        }

        process.exit(code ?? 0);
    });
}

if (isWatchMode) {
    runBuild({ watch: true });
} else {
    runBuild({ watch: false });
}
