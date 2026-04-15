const state = {
    currentPlatform: 'steam', 
    currentYear: 0,
    searchTerm: '',
    branchFilter: 'all', 
    isLoading: false,
    data: {
        'steam': window.steamData || [],
        'oculus-pc': [],
        'oculus-quest': []
    }
};

const APIS = {
    'oculus-pc': '3262063300561328',
    'oculus-quest': '4979055762136823'
};

const QUEST_GUIDE_URL = "https://oculusdb.rui2015.me/guide/quest/qavs";
const MINOR_KEYWORDS = ["patch", "minor", "fix", "standard", "stability", "cleanup", "maintenance", "public update"];

// --- Helpers ---
const formatUnixDate = (ts) => {
    const date = new Date(ts * 1000);
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${months[date.getUTCMonth()]} ${date.getUTCDate()}`;
};

const getActiveData = () => state.data[state.currentPlatform] || [];

const getYearsForPlatform = () => {
    const years = [...new Set(getActiveData().map(u => u.year))];
    return years.sort((a, b) => b - a);
};

// --- API Fetching ---
async function ensureDataFetched(platform) {
    if (platform === 'steam' || state.data[platform].length > 0) {
        const availableYears = getYearsForPlatform();
        if (availableYears.length > 0 && !availableYears.includes(state.currentYear)) {
            state.currentYear = availableYears[0];
        }
        return;
    }

    state.isLoading = true;
    render(); 

    try {
        const response = await fetch(`https://oculusdb.rui2015.me/api/v1/connected/${APIS[platform]}`);
        if (!response.ok) throw new Error("API Error");
        
        const json = await response.json();
        
        state.data[platform] = json.versions
            .filter(v => v.downloadable)
            .map(v => {
                const dt = new Date(v.created_date * 1000);
                return {
                    year: dt.getUTCFullYear(),
                    name: v.version.startsWith('v') ? v.version : `v${v.version}`,
                    date: formatUnixDate(v.created_date),
                    desc: `Build Code: ${v.versionCode}`,
                    id: v.id, 
                    branch: v.binary_release_channels?.nodes?.some(n => n.channel_name === 'LIVE') ? 'public' : 'beta',
                    code: v.versionCode 
                };
            })
            .sort((a, b) => b.code - a.code);

    } catch (err) {
        console.error(err);
        showToast("Failed to fetch from OculusDB.");
    } finally {
        state.isLoading = false;
        const availableYears = getYearsForPlatform();
        if (availableYears.length > 0) {
            state.currentYear = availableYears[0];
        }
        render();
    }
}

// --- GLOBAL ACTIONS ---

window.setPlatform = async function(platform) {
    state.currentPlatform = platform;
    state.currentYear = 0; 
    state.branchFilter = 'all';
    updatePlatformUI();
    await ensureDataFetched(platform);
    render();
};

window.setYear = function(year) {
    state.currentYear = year;
    render();
};

window.toggleBranch = function() {
    const cycleMap = { all: 'public', public: 'beta', beta: 'major', major: 'all' };
    let nextFilter = cycleMap[state.branchFilter];
    if (state.currentPlatform !== 'steam' && nextFilter === 'major') nextFilter = 'all';
    state.branchFilter = nextFilter;
    render();
};

window.handleCopyAction = async function(versionId, btnElement) {
    let commandText = "";
    if (state.currentPlatform === 'steam') {
        commandText = `download_depot 1533390 1533391 ${versionId}`;
    } else if (state.currentPlatform === 'oculus-pc') {
        commandText = `"Oculus Downgrader.exe" -nU d --appid 3262063300561328 --versionid ${versionId} --headset rift --TOKEN YOUR_TOKEN_HERE`;
    }

    try {
        await navigator.clipboard.writeText(commandText);
        showToast("Command copied!");
        if (btnElement) {
            const label = btnElement.querySelector('.copy-label');
            const origText = label.textContent;
            btnElement.classList.add('copy-btn-copied');
            if(label) label.textContent = 'Copied!';
            setTimeout(() => {
                btnElement.classList.remove('copy-btn-copied');
                if(label) label.textContent = origText;
            }, 1500);
        }
    } catch (err) {
        alert("Copy failed. Manually copy this:\n\n" + commandText);
    }
};

window.scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

// --- UI Rendering ---

function render() {
    renderYearTabs();
    renderList();
    updateBranchButtonUI();
    calculateStats();
}

function updatePlatformUI() {
    ['steam', 'oculus-pc', 'oculus-quest'].forEach(p => {
        const btn = document.getElementById(`platform-${p}`);
        if (!btn) return;
        const isActive = p === state.currentPlatform;
        btn.className = `platform-btn flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all uppercase tracking-widest relative z-10 ${
            isActive ? 'text-white bg-white/10 shadow-sm border border-white/10' : 'text-gray-500 hover:text-gray-200'
        }`;
    });
}

function updateBranchButtonUI() {
    const el = document.getElementById('branch-btn-text');
    const btn = document.getElementById('branch-btn');
    if (!el || !btn) return;
    const labels = { all: 'All Branches', public: 'Public Only', beta: 'Beta Only', major: 'Major Updates' };
    el.textContent = labels[state.branchFilter];
    if (state.branchFilter !== 'all') btn.classList.add('bg-emerald-600/20', 'text-emerald-400', 'border-emerald-500/50');
    else btn.classList.remove('bg-emerald-600/20', 'text-emerald-400', 'border-emerald-500/50');
}

function renderYearTabs() {
    const container = document.getElementById('year-tabs-container');
    const years = getYearsForPlatform();
    if (state.isLoading) {
        container.innerHTML = `<div class="h-10 w-32 animate-pulse bg-white/5 rounded-xl"></div>`;
        return;
    }
    container.innerHTML = years.map(year => {
        const isActive = year === state.currentYear;
        return `<button onclick="setYear(${year})" 
            class="px-5 py-2 rounded-xl text-sm font-semibold transition-all border ${
                isActive ? 'bg-emerald-600 text-white border-emerald-500 year-tab-active' : 'bg-black/20 text-gray-400 border-white/5 hover:text-gray-200'
            }">${year}</button>`;
    }).join('');
}

function renderList() {
    const container = document.getElementById('update-list-container');
    if (state.isLoading) {
        container.innerHTML = `<div class="flex flex-col items-center py-20 text-gray-500 gap-4"><div class="w-10 h-10 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div><p class="animate-pulse">Fetching latest builds...</p></div>`;
        return;
    }

    const filteredData = getActiveData().filter(u => {
        const matchesYear = u.year === state.currentYear;
        const searchTermLower = state.searchTerm.toLowerCase();
        const matchesSearch = !state.searchTerm || u.name.toLowerCase().includes(searchTermLower) || u.id.includes(state.searchTerm);
        let matchesFilter = true;
        if (state.branchFilter === 'public') matchesFilter = (u.branch === 'public');
        else if (state.branchFilter === 'beta') matchesFilter = (u.branch === 'beta');
        else if (state.branchFilter === 'major') {
            const isMinor = MINOR_KEYWORDS.some(word => u.name.toLowerCase().includes(word));
            matchesFilter = !isMinor;
        }
        return matchesYear && matchesSearch && matchesFilter;
    });

    if (filteredData.length === 0) {
        container.innerHTML = `<div class="text-center py-20 text-gray-600">No builds found.</div>`;
        return;
    }

    container.innerHTML = filteredData.map((u, i) => {
        const isQuest = state.currentPlatform === 'oculus-quest';
        const idLabel = state.currentPlatform === 'steam' ? 'Manifest ID' : 'Version ID';

        return `
        <div class="monke-card border border-white/5 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-5 group">
            <div class="flex-grow space-y-1">
                <div class="flex items-center gap-3">
                    <h3 class="text-lg font-bold text-white group-hover:text-emerald-400 transition-colors">${u.name}</h3>
                    <span class="px-2 py-0.5 bg-gray-800 text-[10px] font-bold rounded text-gray-400 border border-white/5 uppercase">${u.date}</span>
                    ${u.branch === 'beta' ? `<span class="text-[10px] bg-orange-500/10 text-orange-400 px-2 py-0.5 rounded font-bold uppercase tracking-wider">Beta</span>` : ''}
                </div>
                <p class="text-gray-400 text-sm">${u.desc}</p>
                <p class="text-gray-600 text-[10px] font-mono select-all uppercase opacity-60">${idLabel}: ${u.id}</p>
            </div>
            <div>
                ${isQuest ? `
                    <button onclick="window.open('${QUEST_GUIDE_URL}', '_blank')" class="copy-btn w-full sm:w-auto flex items-center justify-center gap-2 bg-emerald-600/10 hover:bg-emerald-600 text-emerald-400 hover:text-white px-5 py-3 rounded-xl text-sm font-bold border border-emerald-500/30 transition-all active:scale-95">
                        <span>Install Guide</span>
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                    </button>
                ` : `
                    <button onclick="handleCopyAction('${u.id}', this)" class="copy-btn w-full sm:w-auto flex items-center justify-center gap-2 bg-gray-800/50 hover:bg-gray-800 px-5 py-3 rounded-xl text-sm font-bold border border-white/10 group-hover:border-emerald-500/50 transition-all active:scale-95 shadow-sm">
                        <span class="copy-label">Copy Command</span>
                        <svg class="w-4 h-4 text-emerald-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .415.162.787.428 1.062.263.27.629.438 1.034.438.405 0 .771-.168 1.034-.438.266-.275.428-.647.428-1.062 0-.231-.035-.454-.1-.664m-5.801 0A4.992 4.992 0 0110.125 3h1.5a4.992 4.992 0 014.676 3.08m-11.176 0c-1.132.094-1.976 1.057-1.976 2.192V16.5A2.25 2.25 0 005.25 18.75h3m7.5-13.5v12" /></svg>
                    </button>
                `}
            </div>
        </div>`;
    }).join('');
}

function calculateStats() {
    const countEl = document.getElementById('total-updates-count');
    if(countEl) countEl.textContent = getActiveData().length;
}

function showToast(msg) {
    const toast = document.getElementById('toast');
    const toastMsg = document.getElementById('toast-message');
    if(!toast || !toastMsg) return;
    toastMsg.textContent = msg;
    toast.classList.add('toast-visible');
    setTimeout(() => toast.classList.remove('toast-visible'), 2500);
}

document.getElementById('search-input').addEventListener('input', (e) => {
    state.searchTerm = e.target.value;
    render();
});

window.addEventListener('scroll', () => {
    const btn = document.getElementById('back-to-top');
    if (btn) btn.classList.toggle('visible', window.scrollY > 400);
}, { passive: true });

// Initial Load
window.setPlatform('steam');
