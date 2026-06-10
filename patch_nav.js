const fs = require('fs');

const navHtmlPath = 'public/components/nav.html';
let navHtml = fs.readFileSync(navHtmlPath, 'utf8');

// Desktop
const desktopConfigMenuRegex = /(<div class="relative group h-full flex items-center">[\s\S]*?id="desktopConfigDropdownBtn"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*<\/div>)/;
const desktopControleMenu = `
                    <div class="relative group h-full flex items-center">
                        <button type="button"
                            class="nav-link border-transparent text-gray-300 hover:border-gray-300 dark:border-slate-600 hover:text-white inline-flex items-center px-2 pt-1 text-sm font-medium focus:outline-none"
                            aria-haspopup="true" aria-expanded="false" id="desktopControleDropdownBtn"
                            title="Controle">
                            <svg class="h-6 w-6 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                            </svg>
                            <svg class="ml-1 h-4 w-4 shrink-0" xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                <path fill-rule="evenodd"
                                    d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                                    clip-rule="evenodd" />
                            </svg>
                        </button>
                        <div class="absolute left-0 top-full pt-1 w-48 hidden group-hover:block transition-all z-10000 transform origin-top"
                            id="desktopControleDropdownWrapper">
                            <div class="rounded-md shadow-lg bg-white dark:bg-slate-800 ring-1 ring-black ring-opacity-5 divide-y divide-gray-100 dark:divide-slate-700"
                                id="desktopControleDropdown">
                                <div class="py-1" role="menu" aria-orientation="vertical"
                                    aria-labelledby="desktopControleDropdownBtn">
                                    <a href="#" class="group flex items-center px-4 py-3 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 hover:text-gray-900 dark:hover:text-white" role="menuitem">
                                        Em breve
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>`;
navHtml = navHtml.replace(desktopConfigMenuRegex, `$1${desktopControleMenu}`);

// Mobile
const mobileConfigMenuRegex = /(<button type="button" title="Configuração"[\s\S]*?id="mobileConfigDropdownBtn">[\s\S]*?<\/div>\s*<\/div>)/;
const mobileControleMenu = `
                <button type="button" title="Controle"
                    class="mobile-nav-link border-transparent text-gray-300 hover:bg-brand-800 hover:border-gray-300 dark:border-slate-600 hover:text-white w-full flex items-center justify-between pl-3 pr-4 py-3 border-l-4 text-base font-medium focus:outline-none"
                    aria-controls="mobileControleDropdown" aria-expanded="false" id="mobileControleDropdownBtn">
                    <div class="flex-1 flex justify-start">
                        <svg class="h-6 w-6 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                        </svg> <span class="ml-3">Controle</span>
                    </div>
                    <svg class="h-5 w-5 shrink-0 transform transition-transform duration-200"
                        id="mobileControleDropdownIcon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"
                        fill="currentColor" aria-hidden="true">
                        <path fill-rule="evenodd"
                            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                            clip-rule="evenodd" />
                    </svg>
                </button>
                <div class="hidden space-y-1" id="mobileControleDropdown">
                    <a href="#" class="flex pl-3 pr-4 items-center justify-start py-2 text-base font-medium text-gray-400 hover:bg-brand-800 hover:text-white">
                        Em breve
                    </a>
                </div>`;
// Wait, the mobile config menu block closes at the end of the items. I'll just use a safer regex.
navHtml = navHtml.replace(/(<button type="button" title="Configuração"[\s\S]*?id="mobileConfigDropdownBtn">[\s\S]*?id="mobileConfigDropdown">[\s\S]*?<\/div>)/, `$1${mobileControleMenu}`);

fs.writeFileSync(navHtmlPath, navHtml, 'utf8');
console.log('nav.html patched');

// patch navbar.ts
const navTsPath = 'public/ts/components/navbar.ts';
let navTs = fs.readFileSync(navTsPath, 'utf8');

navTs = navTs.replace(/const mobileConfigDropdownLinks =[^;]+;/, `$&
    const mobileControleDropdownLinks = document.querySelectorAll('#mobileControleDropdown a');`);

navTs = navTs.replace(/highlightMobileDropdown\(mobileConfigDropdownLinks, 'mobileConfigDropdownBtn', 'mobileConfigDropdown', 'mobileConfigDropdownIcon'\);/, `$&
    highlightMobileDropdown(mobileControleDropdownLinks, 'mobileControleDropdownBtn', 'mobileControleDropdown', 'mobileControleDropdownIcon');`);

navTs = navTs.replace(/setupMobileDropdown\('mobileConfigDropdownBtn', 'mobileConfigDropdown', 'mobileConfigDropdownIcon'\);/, `$&
    setupMobileDropdown('mobileControleDropdownBtn', 'mobileControleDropdown', 'mobileControleDropdownIcon');`);

navTs = navTs.replace(/'mobileConfigDropdownBtn',/, `$&
                        'mobileControleDropdownBtn',`);

navTs = navTs.replace(/\{ btn: 'mobileConfigDropdownBtn', menu: 'mobileConfigDropdown' \},/, `$&
                    { btn: 'mobileControleDropdownBtn', menu: 'mobileControleDropdown' },`);

fs.writeFileSync(navTsPath, navTs, 'utf8');
console.log('navbar.ts patched');

// patch roles.ts
const rolesTsPath = 'public/ts/roles.ts';
let rolesTs = fs.readFileSync(rolesTsPath, 'utf8');

rolesTs = rolesTs.replace(/(groupName:\s*'Configuração',\s*links:\s*\[[\s\S]*?\]\s*\})/, `$1,
            {
                groupName: 'Controle',
                links: []
            }`);

fs.writeFileSync(rolesTsPath, rolesTs, 'utf8');
console.log('roles.ts patched');

