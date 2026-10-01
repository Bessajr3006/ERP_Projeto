(() => {
    // Leaflet global reference (declared on window)
    const L = window.L;
    async function initMap() {
        try {
            // 1. Initialize map centered on Rio de Janeiro
            const map = L.map('map').setView([-22.9, -43.2], 8);
            // 2. Add OpenStreetMap tile layer
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors'
            }).addTo(map);
            // 3. Fetch census data for RJ from our local database
            const localApi = window.api;
            const res = await localApi('/census/data?state=RJ');
            const censusData = (res && res.status === 'success') ? res.data : [];
            // 4. Fetch GeoJSON from IBGE
            const ibgeGeoJsonUrl = 'https://servicodados.ibge.gov.br/api/v3/malhas/estados/33?formato=application/vnd.geo+json&intrarregiao=municipio';
            const geoJsonRes = await fetch(ibgeGeoJsonUrl);
            const rjGeoJson = await geoJsonRes.json();
            // 5. Coloring logic
            const getColor = (renda, moradores) => {
                // Adaptive thresholds based on RJ census data ranges
                if (renda > 1500 && moradores < 150000)
                    return '#10b981'; // Emerald-500 (Better)
                if (renda > 1100 && moradores < 400000)
                    return '#eab308'; // Yellow-500 (Medium)
                return '#f43f5e'; // Rose-500 (Worse)
            };
            // 6. Merge and render GeoJSON layers
            L.geoJson(rjGeoJson, {
                style: (feature) => {
                    const munId = String(feature.properties.codarea || feature.properties.cod_ibge || feature.properties.id || '').trim();
                    const dbMatch = censusData.find(c => {
                        const dbId = String(c.municipality_id).trim();
                        return dbId.startsWith(munId) || munId.startsWith(dbId);
                    });
                    const renda = dbMatch ? dbMatch.value : 0;
                    const moradores = dbMatch && dbMatch.population ? dbMatch.population : 0;
                    return {
                        fillColor: getColor(renda, moradores),
                        weight: 1,
                        color: '#475569', // Slate-600 border
                        fillOpacity: 0.7
                    };
                },
                onEachFeature: (feature, layer) => {
                    const munName = feature.properties.nome || feature.properties.name || 'Município';
                    const munId = String(feature.properties.codarea || feature.properties.cod_ibge || feature.properties.id || '').trim();
                    const dbMatch = censusData.find(c => {
                        const dbId = String(c.municipality_id).trim();
                        return dbId.startsWith(munId) || munId.startsWith(dbId);
                    });
                    const renda = dbMatch ? dbMatch.value : 0;
                    const moradores = dbMatch && dbMatch.population ? dbMatch.population : 0;
                    const formattedRenda = renda > 0 ? `R$ ${renda.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'N/A';
                    const formattedMoradores = moradores > 0 ? moradores.toLocaleString('pt-BR') : 'N/A';
                    layer.bindPopup(`
                        <div class="p-2 space-y-1">
                            <h4 class="font-bold text-gray-900 text-sm border-b pb-1 mb-1">${munName}</h4>
                            <div class="text-xs text-gray-600 space-y-0.5">
                                <p><span class="font-semibold text-gray-800">Renda Média:</span> ${formattedRenda}</p>
                                <p><span class="font-semibold text-gray-800">Moradores (Censo 2022):</span> ${formattedMoradores}</p>
                            </div>
                        </div>
                    `);
                }
            }).addTo(map);
            // 7. Fetch PNAD Contínua historical data from local database
            const pnadRes = await localApi('/census/pnad');
            const pnadData = (pnadRes && pnadRes.status === 'success') ? pnadRes.data : [];
            // 8. Render RJ historical table (annual averages, quarter is null, state_uf === 'RJ')
            const rjPnadList = pnadData.filter(p => p.state_uf === 'RJ' && p.quarter === null);
            const pnadTableBody = document.getElementById('pnadTableBody');
            if (pnadTableBody) {
                pnadTableBody.innerHTML = rjPnadList.map(p => `
                    <tr class="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                        <td class="py-2.5 font-bold">${p.year}</td>
                        <td class="py-2.5 text-right font-mono font-bold text-indigo-600 dark:text-indigo-400">R$ ${p.average_income.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                        <td class="py-2.5 text-right font-mono text-gray-500 dark:text-gray-400">${p.unemployment_rate ? `${p.unemployment_rate.toFixed(1)}%` : '-'}</td>
                    </tr>
                `).join('');
            }
            // 9. Render state comparison (year 2024, quarter is null)
            const compList = pnadData.filter(p => p.year === 2024 && p.quarter === null);
            // Sort by income DESC
            compList.sort((a, b) => b.average_income - a.average_income);
            const stateComparisonBody = document.getElementById('stateComparisonBody');
            if (stateComparisonBody && compList.length > 0) {
                const maxVal = Math.max(...compList.map(c => c.average_income), 1);
                stateComparisonBody.innerHTML = compList.map(c => {
                    const widthPct = (c.average_income / maxVal) * 100;
                    const isRJ = c.state_uf === 'RJ';
                    return `
                        <div class="space-y-1">
                            <div class="flex items-center justify-between text-xs">
                                <span class="font-bold ${isRJ ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-700 dark:text-gray-300'}">${c.state_uf}</span>
                                <span class="font-bold text-gray-900 dark:text-white font-mono">R$ ${c.average_income.toLocaleString('pt-BR')} <span class="text-[10px] font-normal text-gray-400">(${c.unemployment_rate}% desemp.)</span></span>
                            </div>
                            <div class="w-full bg-gray-100 dark:bg-slate-700 rounded-lg h-2.5 overflow-hidden">
                                <div class="${isRJ ? 'bg-indigo-500' : 'bg-gray-400 dark:bg-slate-500'} h-full rounded-lg transition-all duration-500" style="width: ${widthPct}%"></div>
                            </div>
                        </div>
                    `;
                }).join('');
            }
        }
        catch (error) {
            console.error('Failed to load map data or PNAD statistics', error);
        }
    }
    document.addEventListener('DOMContentLoaded', () => {
        initMap();
    });
})();
