#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function updateHtmlVersions(dir: string, version: string): void {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      updateHtmlVersions(filePath, version);
    } else if (file.endsWith('.html')) {
      let content = fs.readFileSync(filePath, 'utf8');
      content = content.replace(/\?v=[a-zA-Z0-9_]+/g, `?v=${version}`);
      content = content.replace(/(src|href)="(\/(js|css)\/[^"?#]+)(?:\?v=[a-zA-Z0-9_]+)?"/g, `$1="$2?v=${version}"`);
      fs.writeFileSync(filePath, content, 'utf8');
    }
  }
}

function makeBuildVersion(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = pad2(now.getMonth() + 1);
  const d = pad2(now.getDate());
  const hh = pad2(now.getHours());
  const mm = pad2(now.getMinutes());
  const ss = pad2(now.getSeconds());
  return `${y}${m}${d}${hh}${mm}${ss}`;
}

function tryExec(cmd: string): string {
  try {
    return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return '';
  }
}

function updateSwCacheName(swText: string, version: string): string {
  return swText.replace(
    /const CACHE_NAME = 'keystone-pwa-v[^']*';/,
    `const CACHE_NAME = 'keystone-pwa-v${version}';`,
  );
}

const version = makeBuildVersion();
const git = tryExec('git rev-parse --short HEAD');

const buildInfo: { version: string; git?: string; generatedAt: string } = {
  version,
  generatedAt: new Date().toISOString(),
};
if (git) {
  buildInfo.git = git;
}

fs.writeFileSync('public/build.json', JSON.stringify(buildInfo, null, 2) + '\n');

updateHtmlVersions('public', version);

const swTsPath = 'src/public/sw.ts';
let swTs = fs.readFileSync(swTsPath, 'utf8');
swTs = updateSwCacheName(swTs, version);
fs.writeFileSync(swTsPath, swTs);

console.log(`[build] version=${version}${git ? ` git=${git}` : ''}`);
