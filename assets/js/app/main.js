// ============================================
//  Gorilla Tag Depot — Main Application Logic
// ============================================

(() => {
    'use strict';

    // --- State Management ---
    const state = {
        currentPlatform: 'steam', // 'steam' | 'oculus-pc' | 'oculus-quest'
        currentYear: 0,
        searchTerm: '',
        hideGeneric: false,
        branchFilter: 'all', // 'all' | 'public' | 'beta'
        debounceTimer: null,
    };

    const dataSources = {
        'steam': window.steamData || [],
        'oculus-pc': window.oculusPcData || [],
        'oculus-quest': window.oculusQuestData || [],
    };

    const GENERIC_NAMES = new Set([
        'public update', 'public patch', 'beta build', 'beta2 build',
        'patch', 'boring update', 'minor fixes'
    ]);

    // --- Utility Functions ---
    const esc = (str) => {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    };
    const isGeneric = (update) => GENERIC_NAMES.has(update.name.toLowerCase());
    const getActiveData = () => dataSources[state.currentPlatform] || [];
    
    const debounce = (fn, delay = 200) => (...args) => {
        clearTimeout(state.debounceTimer);
        state.debounceTimer = setTimeout(() => fn(...args), delay);
    };

    // --- Core Logic: Rendering & State ---
    function render() {
        renderYearTabs();
        renderList();
        updateFilterButton();
        updateBranchButton();
        calculateStats();
        updateSearchClear();
    }
    
    function saveState() {
        const params = new URLSearchParams();
        params.set('platform', state.currentPlatform);
        if (state.currentYear) params.set('year', state.currentYear);
        if (state.searchTerm) params.set('q', state.searchTerm);
        if (state.hideGeneric) params.set('filter', 'major');
        if (state.branchFilter !== 'all') params.set('branch', state.branchFilter);
        const newUrl = params.toString() ? `${window.location.pathname}?${params.toString()}` : window.location.pathname;
        history.replaceState(null, '', newUrl);
    }

    function loadState() {
        const params = new URLSearchParams(window.location.search);
        state.currentPlatform = ['steam', 'oculus-pc', 'oculus-quest'].includes(params.get('platform')) ? params.get('platform') : 'steam';
        
        const years = getYearsForPlatform();
        state.currentYear = years.includes(parseInt(params.get('year'))) ? parseInt(params.get('year')) : years[0] || 0;

        state.searchTerm = params.get('q') || '';
        document.getElementById('search-input').value = state.searchTerm;

        state.hideGeneric = params.get('filter') === 'major';
        
        const branch = params.get('branch');
        if (['all', 'public', 'beta'].includes(branch)) {
            state.branchFilter = branch;
        }

        updatePlatformButtons();
    }

    // --- Component & UI Updates ---
    function calculateStats() {
        const activeData = getActiveData();
        document.getElementById('total-updates-count').textContent = activeData.length;
        const years = getYearsForPlatform();
        if (years.length) {
            document.getElementById('year-range').textContent = `(${Math.min(...years)}–${Math.max(...years)})`;
        } else {
            document.getElementById('year-range').textContent = '';
        }
    }

    const getYearsForPlatform = () => [...new Set(getActiveData().map(u => u.year))].sort((a, b) => b - a);

    function renderYearTabs() {
        const container = document.getElementById('year-tabs-container');
        const years = getYearsForPlatform();
        if (!years.includes(state.currentYear)) {
            state.currentYear = years[0] || 0;
        }

        container.innerHTML = years.map(year => {
            const isActive = year === state.currentYear;
            return `<button onclick="setYear(${year})" role="tab" aria-selected="${isActive}"
                class="px-5 py-2 rounded-xl text-sm font-semibold transition-all duration-200 border ${
                    isActive ? 'bg-emerald-600 text-white border-emerald-500 year-tab-active' : 'bg-black/20 text-gray-400 border-white/5 hover:border-white/20 hover:text-gray-200'
                }">${year}</button>`;
        }).join('');
    }

    function updateFilterButton() {
        const btn = document.getElementById('filter-btn');
        const textEl = document.getElementById('filter-btn-text');
        const activeClasses = ['bg-emerald-900/50', 'text-emerald-300', 'border-emerald-500/30'];
        btn.classList.toggle(activeClasses[0], state.hideGeneric);
        btn.classList.toggle(activeClasses[1], state.hideGeneric);
        btn.classList.toggle(activeClasses[2], state.hideGeneric);
        textEl.textContent = state.hideGeneric ? 'Major Updates' : 'All Builds';
    }

    function updateBranchButton() {
        const btn = document.getElementById('branch-btn');
        const textEl = document.getElementById('branch-btn-text');
        const labels = { all: 'All Branches', public: 'Public Only', beta: 'Beta Only' };
        const activeClasses = ['bg-emerald-900/50', 'text-emerald-300', 'border-emerald-500/30'];

        Object.values(labels).forEach(label => btn.classList.remove(...activeClasses));
        if (state.branchFilter !== 'all') {
             btn.classList.add(...activeClasses);
        }
        textEl.textContent = labels[state.branchFilter];
    }
    
    function updatePlatformButtons() {
        const platforms = ['steam', 'oculus-pc', 'oculus-quest'];
        platforms.forEach(p => {
            const btn = document.getElementById(`platform-${p}`);
            const isActive = p === state.currentPlatform;
            btn.className = `platform-btn flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all uppercase tracking-widest relative z-10 ${
                isActive ? 'text-white bg-white/10 shadow-sm border border-white/10' : 'text-gray-500 hover:text-gray-200 hover:bg-white/5'
            }`;
        });
        document.getElementById('branch-btn').style.display = state.currentPlatform === 'steam' ? 'flex' : 'none';
    }

    function renderList() {
        const container = document.getElementById('update-list-container');
        const activeData = getActiveData();

        const filteredData = activeData.filter(u => {
            const matchesYear = u.year === state.currentYear;
            const searchTermLower = state.searchTerm.toLowerCase();
            const matchesSearch = !state.searchTerm || 
                u.name.toLowerCase().includes(searchTermLower) || 
                u.desc.toLowerCase().includes(searchTermLower) || 
                u.id.includes(state.searchTerm);
            const matchesFilter = state.hideGeneric ? !isGeneric(u) : true;
            const matchesBranch = state.currentPlatform !== 'steam' || state.branchFilter === 'all' || 
                (state.branchFilter === 'beta' && u.branch.startsWith('beta')) ||
                (state.branchFilter === 'public' && u.branch === 'public');

            return matchesYear && matchesSearch && matchesFilter && matchesBranch;
        });

        document.getElementById('filtered-count').textContent = (filteredData.length !== activeData.filter(u => u.year === state.currentYear).length || state.searchTerm) ? `${filteredData.length} shown` : '';

        if (filteredData.length === 0) {
            container.innerHTML = `<div class="empty-state flex flex-col items-center justify-center py-20 text-gray-600"><svg class="w-16 h-16 mb-4 opacity-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg><p class="text-lg font-semibold mb-1 text-gray-500">No Builds Found</p><p class="text-sm text-gray-700">Try adjusting your filters or search term.</p></div>`;
            return;
        }

        container.innerHTML = filteredData.map((u, i) => {
            let command = '';
            if (state.currentPlatform === 'steam') {
                command = `download_depot 1533390 1533391 ${u.id}`;
            } else {
                const headset = state.currentPlatform === 'oculus-pc' ? 'rift' : 'quest';
                command = `"Oculus Downgrader.exe" -nU d --appid 3262063300561328 --versionid ${u.id} --headset ${headset} --token YOUR_TOKEN_HERE`;
            }

            const isBeta = u.branch?.startsWith('beta');
            const branchBadge = isBeta ? 'bg-orange-500/10 border-orange-500/20 text-orange-400' : 'bg-gray-800 border-gray-700/80 text-gray-400';
            const isMajor = !isGeneric(u);
            const idLabel = state.currentPlatform === 'steam' ? 'Manifest' : 'Version ID';
            
            return `
            <div class="monke-card border border-white/5 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-5 group" role="listitem" style="animation-delay: ${Math.min(i * 35, 500)}ms">
                <div class="flex-grow space-y-2">
                    <div class="flex items-center gap-3 flex-wrap">
                        <h3 class="text-lg font-bold text-white group-hover:text-emerald-400 transition-colors">${esc(u.name)}</h3>
                        <span class="px-2.5 py-1 ${branchBadge} text-xs font-semibold rounded-lg border">${esc(u.date)}</span>
                        ${isBeta ? `<span class="text-[10px] bg-orange-500/80 text-white px-2 py-0.5 rounded-md font-bold uppercase tracking-wider">Beta</span>` : ''}
                        ${isMajor && !isBeta ? `<span class="text-[10px] bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded-md font-semibold uppercase tracking-wider border border-emerald-500/30">Major</span>` : ''}
                    </div>
                    <p class="text-gray-400 text-sm leading-relaxed">${esc(u.desc)}</p>
                    <p class="text-gray-600 text-xs font-mono tracking-wide pt-1 select-all" title="Click to select ID">${idLabel}: ${esc(u.id)}</p>
                </div>

                <div class="flex-shrink-0 w-full sm:w-auto">
                    <button onclick="copyToClipboard('${command}', this)" class="copy-btn w-full sm:w-auto flex items-center justify-center gap-2.5 bg-gray-800/50 hover:bg-gray-800 px-4 py-3 rounded-xl text-sm font-bold transition-all active:scale-95 border border-white/10 group-hover:border-emerald-500/50 text-gray-300 group-hover:text-emerald-300 shadow-sm">
                        <span class="copy-label">Copy Command</span>
                        <svg class="w-4 h-4 text-gray-500 group-hover:text-emerald-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path></svg>
                    </button>
                </div>
            </div>`;
        }).join('');
    }

    function updateSearchClear() {
        document.getElementById('search-clear').classList.toggle('hidden', !state.searchTerm);
    }

    // --- Global Event Handlers ---
    window.setPlatform = (platform) => {
        state.currentPlatform = platform;
        updatePlatformButtons();
        render();
        saveState();
    };
    
    window.setYear = (year) => {
        state.currentYear = year;
        render();
        saveState();
    };

    window.toggleFilter = () => {
        state.hideGeneric = !state.hideGeneric;
        render();
        saveState();
    };

    window.toggleBranch = () => {
        const cycle = { all: 'public', public: 'beta', beta: 'all' };
        state.branchFilter = cycle[state.branchFilter];
        render();
        saveState();
    };

    window.clearSearch = () => {
        state.searchTerm = '';
        const input = document.getElementById('search-input');
        input.value = '';
        render();
        saveState();
        input.focus();
    };

    window.copyToClipboard = async (text, btnElement) => {
        await navigator.clipboard.writeText(text);
        showToast('Command copied to clipboard');
        if (btnElement) {
            const label = btnElement.querySelector('.copy-label');
            const origText = label.textContent;
            btnElement.classList.add('copy-btn-copied');
            label.textContent = 'Copied!';
            setTimeout(() => {
                btnElement.classList.remove('copy-btn-copied');
                label.textContent = origText;
            }, 1500);
        }
    };
    
    window.scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

    function showToast(message) {
        const toast = document.getElementById('toast');
        document.getElementById('toast-message').textContent = message;
        toast.classList.add('toast-visible');
        clearTimeout(toast._timer);
        toast._timer = setTimeout(() => toast.classList.remove('toast-visible'), 2500);
    }
    
    // --- Initialization ---
    function init() {
        loadState();
        render();

        const searchInput = document.getElementById('search-input');
        searchInput.addEventListener('input', debounce((e) => {
            state.searchTerm = e.target.value;
            render();
            saveState();
        }, 180));

        window.addEventListener('scroll', () => {
            const btn = document.getElementById('back-to-top');
            btn.classList.toggle('visible', window.scrollY > 400);
        }, { passive: true });

        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                searchInput.focus();
                searchInput.select();
            }
            if (e.key === 'Escape' && document.act