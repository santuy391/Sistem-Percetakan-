/* ============================================================ */
/* FILE: app.js (diperbarui dengan koneksi printer E470)       */
/* ============================================================ */

const STORE_KEY = 'printSystemProData';

let data = {
    jobs: [],
    printers: [],
    history: [],
    idCounter: 1,
};

function loadData() {
    try {
        const raw = localStorage.getItem(STORE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            data = parsed;
            if (!data.jobs) data.jobs = [];
            if (!data.printers) data.printers = [];
            if (!data.history) data.history = [];
            if (!data.idCounter) data.idCounter = 1;
        } else {
            seedData();
        }
    } catch (e) {
        seedData();
    }
}

function saveData() {
    localStorage.setItem(STORE_KEY, JSON.stringify(data));
}

function seedData() {
    data.jobs = [
        { id: 1, fileName: 'Brosur_A5.pdf', printer: 'Epson L120', copies: 50, status: 'completed', createdAt: new Date(Date.now() - 7200000).toISOString() },
        { id: 2, fileName: 'Poster_B1.png', printer: 'Canon PIXMA', copies: 10, status: 'processing', createdAt: new Date(Date.now() - 1800000).toISOString() },
        { id: 3, fileName: 'Kartu_Nama.ai', printer: 'HP LaserJet', copies: 100, status: 'pending', createdAt: new Date(Date.now() - 600000).toISOString() },
    ];
    data.printers = [
        { id: 1, name: 'Epson L120', model: 'L120', ssid: '', password: '', ip: '192.168.1.101', port: '80', status: 'online' },
        { id: 2, name: 'Canon PIXMA', model: 'PIXMA G1020', ssid: '', password: '', ip: '192.168.1.102', port: '80', status: 'online' },
        { id: 3, name: 'HP LaserJet', model: 'LaserJet Pro', ssid: '', password: '', ip: '192.168.1.103', port: '80', status: 'offline' },
        { 
            id: 4, 
            name: 'Epson E470 WiFi', 
            model: 'E470', 
            ssid: 'BFDAC1-E470series', 
            password: 'AGVY45046', 
            ip: '192.168.1.104', 
            port: '80',
            status: 'online' 
        },
    ];
    data.history = data.jobs.filter(j => j.status === 'completed' || j.status === 'failed').map(j => ({ ...j }));
    data.idCounter = 10;
    saveData();
}

function generateId() {
    return data.idCounter++;
}

function formatDate(iso) {
    if (!iso) return '-';
    const d = new Date(iso);
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function statusBadge(status) {
    const map = { pending: 'badge-pending', processing: 'badge-processing', completed: 'badge-completed', failed: 'badge-failed' };
    return `<span class="badge ${map[status] || 'badge-pending'}"><span class="status-dot ${status}"></span>${status.charAt(0).toUpperCase() + status.slice(1)}</span>`;
}

function wifiStatusHTML(status) {
    const dotClass = status === 'online' ? 'online' : status === 'connecting' ? 'connecting' : 'offline';
    const label = status === 'online' ? 'Online' : status === 'connecting' ? 'Menghubungkan...' : 'Offline';
    return `<span class="wifi-status"><span class="dot ${dotClass}"></span> ${label}</span>`;
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icons = { success: 'fa-check-circle', error: 'fa-xmark-circle', info: 'fa-info-circle' };
    toast.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i> ${message}`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(40px)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ===== NAVIGATION =====
function showLanding() {
    document.getElementById('landingPage').classList.remove('hidden');
    document.getElementById('loginPage').classList.add('hidden');
    document.getElementById('adminDashboard').classList.add('hidden');
    populatePublicPrinters();
    renderPublicJobs();
}

function showLogin() {
    document.getElementById('landingPage').classList.add('hidden');
    document.getElementById('loginPage').classList.remove('hidden');
    document.getElementById('adminDashboard').classList.add('hidden');
    document.getElementById('loginError').style.display = 'none';
}

function showAdmin() {
    document.getElementById('landingPage').classList.add('hidden');
    document.getElementById('loginPage').classList.add('hidden');
    document.getElementById('adminDashboard').classList.remove('hidden');
    navigateAdmin('admin-dashboard');
    startAutoScan();
}

// ===== LOGIN =====
function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value.trim();
    if (username === 'admin' && password === 'admin123') {
        document.getElementById('loginError').style.display = 'none';
        showAdmin();
    } else {
        document.getElementById('loginError').style.display = 'block';
    }
}

function handleLogout() {
    if (confirm('Yakin ingin keluar?')) {
        stopAutoScan();
        showLanding();
    }
}

// ===== AUTO SCAN =====
let autoScanInterval = null;

function startAutoScan() {
    if (autoScanInterval) clearInterval(autoScanInterval);
    autoScanInterval = setInterval(() => {
        if (!document.getElementById('adminDashboard').classList.contains('hidden')) {
            scanAllPrintersSilent();
        }
    }, 30000);
}

function stopAutoScan() {
    if (autoScanInterval) {
        clearInterval(autoScanInterval);
        autoScanInterval = null;
    }
}

// ===== ADMIN NAVIGATION =====
let currentAdminPage = 'admin-dashboard';

function navigateAdmin(page) {
    currentAdminPage = page;
    document.querySelectorAll('[id^="page-admin-"]').forEach(el => el.style.display = 'none');
    const target = document.getElementById(`page-${page}`);
    if (target) target.style.display = 'block';

    document.querySelectorAll('.admin-sidebar nav a').forEach(a => a.classList.remove('active'));
    const link = document.querySelector(`.admin-sidebar nav a[data-page="${page}"]`);
    if (link) link.classList.add('active');

    const titles = {
        'admin-dashboard': 'Dashboard',
        'admin-jobs': 'Manajemen Pesanan',
        'admin-printers': 'Printer & WiFi',
        'admin-edit-printer': 'Edit Printer',
        'admin-history': 'Riwayat'
    };
    document.getElementById('adminPageTitle').textContent = titles[page] || 'Dashboard';

    if (page === 'admin-dashboard') renderAdminDashboard();
    else if (page === 'admin-jobs') renderAdminJobs();
    else if (page === 'admin-printers') renderAdminPrinters();
    else if (page === 'admin-edit-printer') renderEditPrinter();
    else if (page === 'admin-history') renderAdminHistory();

    document.getElementById('adminSidebar').classList.remove('open');
}

document.querySelectorAll('.admin-sidebar nav a').forEach(a => {
    a.addEventListener('click', () => navigateAdmin(a.dataset.page));
});

document.getElementById('adminHamburger').addEventListener('click', () => {
    document.getElementById('adminSidebar').classList.toggle('open');
});

// ===== PUBLIC LANDING =====
function populatePublicPrinters() {
    const sel = document.getElementById('publicPrinter');
    sel.innerHTML = '';
    data.printers.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.name;
        const statusIcon = p.status === 'online' ? '✅' : '⛔';
        opt.textContent = `${p.name} (${p.model}) ${statusIcon}`;
        sel.appendChild(opt);
    });
    if (data.printers.length === 0) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = '-- Tidak ada printer --';
        sel.appendChild(opt);
    }
}

document.getElementById('publicFileInput').addEventListener('change', function(e) {
    const file = this.files[0];
    document.getElementById('publicFileNameDisplay').textContent = file ? file.name : 'Belum ada file dipilih';
});

function handlePublicUpload(e) {
    e.preventDefault();
    const fileName = document.getElementById('publicFileName').value.trim();
    const printer = document.getElementById('publicPrinter').value;
    const copies = parseInt(document.getElementById('publicCopies').value) || 1;
    const fileInput = document.getElementById('publicFileInput');
    const file = fileInput.files[0];

    if (!fileName) return showToast('Nama file wajib diisi', 'error');
    if (!printer) return showToast('Pilih printer', 'error');
    if (!file) return showToast('Pilih file untuk diupload', 'error');

    const printerObj = data.printers.find(p => p.name === printer);
    if (printerObj && printerObj.status !== 'online') {
        return showToast('Printer sedang offline, coba lagi nanti', 'error');
    }

    const newJob = {
        id: generateId(),
        fileName: fileName,
        printer: printer,
        copies: copies,
        status: 'pending',
        createdAt: new Date().toISOString(),
    };
    data.jobs.push(newJob);
    saveData();
    showToast('Pesanan berhasil dikirim!', 'success');
    document.getElementById('publicUploadForm').reset();
    document.getElementById('publicFileNameDisplay').textContent = 'Belum ada file dipilih';
    renderPublicJobs();
    populatePublicPrinters();
}

function renderPublicJobs() {
    const container = document.getElementById('publicJobList');
    const list = [...data.jobs].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);
    if (list.length === 0) {
        container.innerHTML = `<div class="empty-state"><i class="fas fa-inbox"></i><p>Belum ada pesanan dari publik</p></div>`;
        return;
    }
    container.innerHTML = list.map(j => `
        <div class="job-item">
            <div class="info">
                <span class="name">${j.fileName}</span>
                <span class="sub"><i class="fas fa-print"></i> ${j.printer} · ${j.copies} salinan · ${formatDate(j.createdAt)}</span>
            </div>
            <div>${statusBadge(j.status)}</div>
        </div>
    `).join('');
}

// ===== ADMIN DASHBOARD =====
function renderAdminDashboard() {
    const total = data.jobs.length;
    const processing = data.jobs.filter(j => j.status === 'processing').length;
    const completed = data.jobs.filter(j => j.status === 'completed').length;
    const failed = data.jobs.filter(j => j.status === 'failed').length;
    const online = data.printers.filter(p => p.status === 'online').length;

    document.getElementById('admStatTotal').textContent = total;
    document.getElementById('admStatProcessing').textContent = processing;
    document.getElementById('admStatCompleted').textContent = completed;
    document.getElementById('admStatFailed').textContent = failed;
    document.getElementById('admStatPrinters').textContent = `${online}/${data.printers.length}`;

    const recent = [...data.jobs].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);
    const tbody = document.getElementById('admRecentJobs');
    if (recent.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="empty-state"><i class="fas fa-inbox"></i><p>Belum ada pesanan</p></td></tr>`;
    } else {
        tbody.innerHTML = recent.map(j => `
            <tr>
                <td><strong>#${j.id}</strong></td>
                <td>${j.fileName}</td>
                <td><span class="badge badge-printer">${j.printer}</span></td>
                <td>${statusBadge(j.status)}</td>
                <td>${formatDate(j.createdAt)}</td>
            </tr>
        `).join('');
    }
}

// ===== ADMIN JOBS =====
function renderAdminJobs() {
    const filter = document.getElementById('adminFilterStatus').value;
    let list = [...data.jobs];
    if (filter !== 'all') list = list.filter(j => j.status === filter);
    list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    document.getElementById('adminJobCount').textContent = `${list.length} pesanan`;
    const tbody = document.getElementById('adminJobsBody');
    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="empty-state"><i class="fas fa-inbox"></i><p>Tidak ada pesanan</p></td></tr>`;
        return;
    }
    tbody.innerHTML = list.map(j => `
        <tr>
            <td><strong>#${j.id}</strong></td>
            <td>${j.fileName}</td>
            <td><span class="badge badge-printer">${j.printer}</span></td>
            <td>${j.copies}</td>
            <td>${statusBadge(j.status)}</td>
            <td>${formatDate(j.createdAt)}</td>
            <td>
                <div class="action-group">
                    <button class="btn btn-primary btn-xs" onclick="editAdminJob(${j.id})"><i class="fas fa-pen"></i></button>
                    <button class="btn btn-danger btn-xs" onclick="deleteAdminJob(${j.id})"><i class="fas fa-trash"></i></button>
                    ${j.status !== 'completed' && j.status !== 'failed' ? `<button class="btn btn-success btn-xs" onclick="completeAdminJob(${j.id})"><i class="fas fa-check"></i></button>` : ''}
                </div>
            </td>
        </tr>
    `).join('');
}

function editAdminJob(id) {
    const job = data.jobs.find(j => j.id === id);
    if (job) openAdminModal('job', job);
}

function deleteAdminJob(id) {
    if (!confirm('Hapus pesanan #' + id + '?')) return;
    data.jobs = data.jobs.filter(j => j.id !== id);
    data.history = data.history.filter(h => h.id !== id);
    saveData();
    showToast('Pesanan dihapus', 'info');
    navigateAdmin(currentAdminPage);
}

function completeAdminJob(id) {
    const job = data.jobs.find(j => j.id === id);
    if (!job) return;
    job.status = 'completed';
    if (!data.history.find(h => h.id === job.id)) {
        data.history.push({ ...job });
    }
    saveData();
    showToast('Pesanan #' + id + ' selesai', 'success');
    navigateAdmin(currentAdminPage);
}

// ===== ADMIN PRINTERS =====
function renderAdminPrinters() {
    document.getElementById('adminPrinterCount').textContent = `${data.printers.length} printer`;
    const tbody = document.getElementById('adminPrintersBody');
    if (data.printers.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="empty-state"><i class="fas fa-server"></i><p>Belum ada printer</p></td></tr>`;
        return;
    }
    tbody.innerHTML = data.printers.map(p => `
        <tr>
            <td><strong>${p.name}</strong></td>
            <td>${p.model}</td>
            <td>${p.ssid ? `<span title="SSID: ${p.ssid}">${p.ssid}</span>` : '-'}</td>
            <td><code style="background:#f1f5f9;padding:2px 10px;border-radius:6px;font-size:13px;">${p.ip}:${p.port || '80'}</code></td>
            <td>${wifiStatusHTML(p.status)}</td>
            <td>
                <div class="action-group">
                    <button class="btn btn-primary btn-xs" onclick="editAdminPrinterPage(${p.id})"><i class="fas fa-pen"></i> Edit</button>
                    <button class="btn btn-danger btn-xs" onclick="deleteAdminPrinter(${p.id})"><i class="fas fa-trash"></i></button>
                    <button class="btn btn-sm ${p.status === 'online' ? 'btn-warning' : 'btn-success'}" onclick="toggleAdminPrinter(${p.id})" style="font-size:11px;padding:4px 10px;">
                        ${p.status === 'online' ? 'Offline' : 'Online'}
                    </button>
                    <button class="btn btn-sm btn-outline" onclick="testPrinterConnection(${p.id})" style="font-size:11px;padding:4px 10px;">
                        <i class="fas fa-wifi"></i> Tes
                    </button>
                    <button class="btn btn-sm btn-success" onclick="testPrintJob(${p.id})" style="font-size:11px;padding:4px 10px;">
                        <i class="fas fa-print"></i> Cetak Uji
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

// ===== EDIT PRINTER PAGE =====
function editAdminPrinterPage(id) {
    const printer = data.printers.find(p => p.id === id);
    if (printer) {
        document.getElementById('editPrinterId').value = printer.id;
        document.getElementById('editPrinterName').value = printer.name || '';
        document.getElementById('editPrinterModel').value = printer.model || '';
        document.getElementById('editPrinterSSID').value = printer.ssid || '';
        document.getElementById('editPrinterPassword').value = printer.password || '';
        document.getElementById('editPrinterIP').value = printer.ip || '';
        document.getElementById('editPrinterPort').value = printer.port || '80';
        document.getElementById('editPrinterStatus').value = printer.status || 'online';
        navigateAdmin('admin-edit-printer');
    } else {
        showToast('Printer tidak ditemukan', 'error');
    }
}

function handleEditPrinterSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('editPrinterId').value;
    if (!id) return showToast('ID printer tidak valid', 'error');

    const name = document.getElementById('editPrinterName').value.trim();
    const model = document.getElementById('editPrinterModel').value.trim();
    const ssid = document.getElementById('editPrinterSSID').value.trim();
    const password = document.getElementById('editPrinterPassword').value.trim();
    const ip = document.getElementById('editPrinterIP').value.trim();
    const port = document.getElementById('editPrinterPort').value.trim() || '80';
    const status = document.getElementById('editPrinterStatus').value;

    if (!name) return showToast('Nama printer wajib diisi', 'error');
    if (!ip) return showToast('IP Address wajib diisi', 'error');

    const idx = data.printers.findIndex(p => p.id === parseInt(id));
    if (idx === -1) return showToast('Printer tidak ditemukan', 'error');

    data.printers[idx].name = name;
    data.printers[idx].model = model || '-';
    data.printers[idx].ssid = ssid || '';
    data.printers[idx].password = password || '';
    data.printers[idx].ip = ip;
    data.printers[idx].port = port;
    data.printers[idx].status = status;
    saveData();
    showToast('Printer berhasil diperbarui!', 'success');
    navigateAdmin('admin-printers');
}

function renderEditPrinter() {
    // Form sudah terisi saat navigasi
}

function deleteAdminPrinter(id) {
    if (!confirm('Hapus printer ini?')) return;
    data.printers = data.printers.filter(p => p.id !== id);
    saveData();
    showToast('Printer dihapus', 'info');
    navigateAdmin(currentAdminPage);
}

function toggleAdminPrinter(id) {
    const printer = data.printers.find(p => p.id === id);
    if (!printer) return;
    printer.status = printer.status === 'online' ? 'offline' : 'online';
    saveData();
    showToast(`Printer ${printer.name} sekarang ${printer.status}`, 'info');
    navigateAdmin(currentAdminPage);
}

// ===== KONEKSI PRINTER E470 (dengan coba beberapa port) =====
async function testPrinterConnection(id) {
    const printer = data.printers.find(p => p.id === id);
    if (!printer) return;
    if (!printer.ip || printer.ip === '-') {
        showToast('IP tidak valid untuk ' + printer.name, 'error');
        return;
    }

    // Coba beberapa port umum
    const portsToTry = [printer.port || '80', '631', '8080', '443'];
    const uniquePorts = [...new Set(portsToTry)];

    printer.status = 'connecting';
    saveData();
    renderAdminPrinters();

    let connected = false;
    let usedPort = null;

    for (const port of uniquePorts) {
        const url = `http://${printer.ip}:${port}`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2500);
        try {
            await fetch(url, { mode: 'no-cors', signal: controller.signal });
            clearTimeout(timeout);
            connected = true;
            usedPort = port;
            break;
        } catch (e) {
            clearTimeout(timeout);
            // lanjut ke port berikutnya
        }
    }

    if (connected) {
        printer.status = 'online';
        printer.port = usedPort; // simpan port yang berhasil
        saveData();
        showToast(`${printer.name} terhubung melalui port ${usedPort} ✅`, 'success');
    } else {
        printer.status = 'offline';
        saveData();
        showToast(`${printer.name} tidak terhubung ❌ (tidak ada port yang responsif)`, 'error');
    }
    renderAdminPrinters();
    populatePublicPrinters();
}

// ===== CETAK UJI (IPP) =====
async function testPrintJob(id) {
    const printer = data.printers.find(p => p.id === id);
    if (!printer) return showToast('Printer tidak ditemukan', 'error');
    if (printer.status !== 'online') {
        return showToast('Printer offline, tidak bisa mencetak', 'error');
    }

    const port = printer.port || '80';
    const url = `http://${printer.ip}:${port}/ipp/print`;

    // Buat data PDF sederhana (dummy) dalam base64
    // Ini hanya simulasi, seharusnya dikirim file PDF asli
    const dummyPdf = '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>\nendobj\n4 0 obj\n<< /Length 44 >>\nstream\nBT /F1 24 Tf 100 700 Td (Halaman Uji) Tj ET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f\n0000000009 00000 n\n0000000053 00000 n\n0000000100 00000 n\n0000000160 00000 n\ntrailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n236\n%%EOF';

    const byteArray = new TextEncoder().encode(dummyPdf);
    const blob = new Blob([byteArray], { type: 'application/pdf' });

    try {
        const response = await fetch(url, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'application/ipp',
            },
            body: blob,
        });
        // Karena no-cors, kita tidak bisa membaca response, tapi jika tidak error, kita anggap berhasil
        showToast(`Perintah cetak uji dikirim ke ${printer.name} ✅`, 'success');
    } catch (error) {
        showToast(`Gagal mengirim cetak uji: ${error.message}`, 'error');
    }
}

// ===== SCAN SEMUA PRINTER =====
async function scanAllPrintersSilent() {
    for (const p of data.printers) {
        if (!p.ip || p.ip === '-') continue;
        const ports = [p.port || '80', '631', '8080'];
        let connected = false;
        for (const port of ports) {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 2000);
            try {
                await fetch(`http://${p.ip}:${port}`, { mode: 'no-cors', signal: controller.signal });
                clearTimeout(timeout);
                connected = true;
                p.port = port;
                break;
            } catch (e) {
                clearTimeout(timeout);
            }
        }
        p.status = connected ? 'online' : 'offline';
    }
    saveData();
    if (currentAdminPage === 'admin-printers') renderAdminPrinters();
    if (currentAdminPage === 'admin-dashboard') renderAdminDashboard();
    populatePublicPrinters();
}

async function scanAllPrinters() {
    showToast('Memindai semua printer...', 'info');
    let onlineCount = 0;
    for (const p of data.printers) {
        if (!p.ip || p.ip === '-') continue;
        const ports = [p.port || '80', '631', '8080'];
        let connected = false;
        for (const port of ports) {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 2000);
            try {
                await fetch(`http://${p.ip}:${port}`, { mode: 'no-cors', signal: controller.signal });
                clearTimeout(timeout);
                connected = true;
                p.port = port;
                break;
            } catch (e) {
                clearTimeout(timeout);
            }
        }
        p.status = connected ? 'online' : 'offline';
        if (connected) onlineCount++;
    }
    saveData();
    showToast(`Pindai selesai: ${onlineCount} printer online`, 'success');
    renderAdminPrinters();
    populatePublicPrinters();
}

// ===== ADMIN HISTORY =====
function renderAdminHistory() {
    const list = [...data.history].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const tbody = document.getElementById('adminHistoryBody');
    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="empty-state"><i class="fas fa-clock"></i><p>Belum ada riwayat</p></td></tr>`;
        return;
    }
    tbody.innerHTML = list.map(j => `
        <tr>
            <td><strong>#${j.id}</strong></td>
            <td>${j.fileName}</td>
            <td><span class="badge badge-printer">${j.printer}</span></td>
            <td>${statusBadge(j.status)}</td>
            <td>${formatDate(j.createdAt)}</td>
        </tr>
    `).join('');
}

function clearAdminHistory() {
    if (!confirm('Hapus semua riwayat?')) return;
    data.history = [];
    saveData();
    showToast('Riwayat dibersihkan', 'info');
    navigateAdmin(currentAdminPage);
}

// ===== ADMIN MODAL =====
let adminModalMode = 'job';
let adminEditingId = null;

function openAdminModal(type, item = null) {
    adminModalMode = type;
    adminEditingId = item ? item.id : null;
    const overlay = document.getElementById('adminModalOverlay');
    const title = document.getElementById('adminModalTitle');
    const submitBtn = document.getElementById('adminModalSubmitBtn');

    document.getElementById('admFgFileName').style.display = 'none';
    document.getElementById('admFgPrinter').style.display = 'none';
    document.getElementById('admFgCopies').style.display = 'none';
    document.getElementById('admFgStatus').style.display = 'none';
    document.getElementById('admFgPrinterName').style.display = 'none';
    document.getElementById('admFgPrinterModel').style.display = 'none';
    document.getElementById('admFgPrinterSSID').style.display = 'none';
    document.getElementById('admFgPrinterPassword').style.display = 'none';
    document.getElementById('admFgPrinterIP').style.display = 'none';
    document.getElementById('admFgPrinterPort').style.display = 'none';

    document.getElementById('adminFormType').value = type;

    if (type === 'job') {
        title.textContent = adminEditingId ? 'Edit Pesanan' : 'Tambah Pesanan';
        submitBtn.textContent = adminEditingId ? 'Update' : 'Simpan';
        document.getElementById('admFgFileName').style.display = 'block';
        document.getElementById('admFgPrinter').style.display = 'block';
        document.getElementById('admFgCopies').style.display = 'block';
        document.getElementById('admFgStatus').style.display = 'block';

        const sel = document.getElementById('admFormPrinter');
        sel.innerHTML = '';
        data.printers.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.name;
            opt.textContent = `${p.name} (${p.model})`;
            sel.appendChild(opt);
        });
        if (data.printers.length === 0) {
            const opt = document.createElement('option');
            opt.value = '';
            opt.textContent = '-- Tidak ada printer --';
            sel.appendChild(opt);
        }

        if (item) {
            document.getElementById('adminFormId').value = item.id;
            document.getElementById('admFormFileName').value = item.fileName || '';
            document.getElementById('admFormPrinter').value = item.printer || '';
            document.getElementById('admFormCopies').value = item.copies || 1;
            document.getElementById('admFormStatus').value = item.status || 'pending';
        } else {
            document.getElementById('adminFormId').value = '';
            document.getElementById('admFormFileName').value = '';
            document.getElementById('admFormCopies').value = 1;
            document.getElementById('admFormStatus').value = 'pending';
            if (data.printers.length > 0) {
                document.getElementById('admFormPrinter').value = data.printers[0].name;
            }
        }
    } else {
        title.textContent = adminEditingId ? 'Edit Printer' : 'Tambah Printer';
        submitBtn.textContent = adminEditingId ? 'Update' : 'Simpan';
        document.getElementById('admFgPrinterName').style.display = 'block';
        document.getElementById('admFgPrinterModel').style.display = 'block';
        document.getElementById('admFgPrinterSSID').style.display = 'block';
        document.getElementById('admFgPrinterPassword').style.display = 'block';
        document.getElementById('admFgPrinterIP').style.display = 'block';
        document.getElementById('admFgPrinterPort').style.display = 'block';

        if (item) {
            document.getElementById('adminFormId').value = item.id;
            document.getElementById('admFormPrinterName').value = item.name || '';
            document.getElementById('admFormPrinterModel').value = item.model || '';
            document.getElementById('admFormPrinterSSID').value = item.ssid || '';
            document.getElementById('admFormPrinterPassword').value = item.password || '';
            document.getElementById('admFormPrinterIP').value = item.ip || '';
            document.getElementById('admFormPrinterPort').value = item.port || '80';
        } else {
            document.getElementById('adminFormId').value = '';
            document.getElementById('admFormPrinterName').value = '';
            document.getElementById('admFormPrinterModel').value = '';
            document.getElementById('admFormPrinterSSID').value = '';
            document.getElementById('admFormPrinterPassword').value = '';
            document.getElementById('admFormPrinterIP').value = '';
            document.getElementById('admFormPrinterPort').value = '80';
        }
    }

    overlay.classList.add('show');
}

function closeAdminModal() {
    document.getElementById('adminModalOverlay').classList.remove('show');
    document.getElementById('adminModalForm').reset();
    document.getElementById('adminFormId').value = '';
    adminEditingId = null;
}

document.getElementById('adminModalOverlay').addEventListener('click', function(e) {
    if (e.target === this) closeAdminModal();
});

function handleAdminModalSubmit(e) {
    e.preventDefault();
    const type = document.getElementById('adminFormType').value;
    const id = document.getElementById('adminFormId').value;

    if (type === 'job') {
        const fileName = document.getElementById('admFormFileName').value.trim();
        const printer = document.getElementById('admFormPrinter').value;
        const copies = parseInt(document.getElementById('admFormCopies').value) || 1;
        const status = document.getElementById('admFormStatus').value;

        if (!fileName) return showToast('Nama file wajib diisi', 'error');
        if (!printer) return showToast('Pilih printer', 'error');

        if (id) {
            const idx = data.jobs.findIndex(j => j.id === parseInt(id));
            if (idx !== -1) {
                const oldStatus = data.jobs[idx].status;
                data.jobs[idx].fileName = fileName;
                data.jobs[idx].printer = printer;
                data.jobs[idx].copies = copies;
                data.jobs[idx].status = status;
                if ((status === 'completed' || status === 'failed') && oldStatus !== 'completed' && oldStatus !== 'failed') {
                    data.history.push({ ...data.jobs[idx] });
                }
                saveData();
                showToast('Pesanan diperbarui', 'success');
            } else {
                showToast('Pesanan tidak ditemukan', 'error');
            }
        } else {
            const newJob = {
                id: generateId(),
                fileName,
                printer,
                copies,
                status,
                createdAt: new Date().toISOString(),
            };
            data.jobs.push(newJob);
            if (status === 'completed' || status === 'failed') {
                data.history.push({ ...newJob });
            }
            saveData();
            showToast('Pesanan berhasil ditambahkan', 'success');
        }
    } else {
        const name = document.getElementById('admFormPrinterName').value.trim();
        const model = document.getElementById('admFormPrinterModel').value.trim();
        const ssid = document.getElementById('admFormPrinterSSID').value.trim();
        const password = document.getElementById('admFormPrinterPassword').value.trim();
        const ip = document.getElementById('admFormPrinterIP').value.trim();
        const port = document.getElementById('admFormPrinterPort').value.trim() || '80';

        if (!name) return showToast('Nama printer wajib diisi', 'error');
        if (!ip) return showToast('IP Address wajib diisi', 'error');

        if (id) {
            const idx = data.printers.findIndex(p => p.id === parseInt(id));
            if (idx !== -1) {
                data.printers[idx].name = name;
                data.printers[idx].model = model || '-';
                data.printers[idx].ssid = ssid || '';
                data.printers[idx].password = password || '';
                data.printers[idx].ip = ip;
                data.printers[idx].port = port;
                saveData();
                showToast('Printer diperbarui', 'success');
            } else {
                showToast('Printer tidak ditemukan', 'error');
            }
        } else {
            data.printers.push({
                id: generateId(),
                name,
                model: model || '-',
                ssid: ssid || '',
                password: password || '',
                ip: ip,
                port: port,
                status: 'online',
            });
            saveData();
            showToast('Printer berhasil ditambahkan', 'success');
        }
    }

    closeAdminModal();
    navigateAdmin(currentAdminPage);
    populatePublicPrinters();
}

// ===== INIT =====
loadData();
showLanding();

setInterval(() => {
    loadData();
    if (!document.getElementById('landingPage').classList.contains('hidden')) {
        renderPublicJobs();
        populatePublicPrinters();
    }
    if (!document.getElementById('adminDashboard').classList.contains('hidden')) {
        navigateAdmin(currentAdminPage);
    }
}, 20000);

window.addEventListener('resize', () => {
    if (window.innerWidth > 820) {
        document.getElementById('adminSidebar').classList.remove('open');
    }
});

console.log('🖨️ Sistem Percetakan + WiFi E470 siap!');
console.log('🔑 Login: admin / admin123');
console.log('📡 Printer E470: SSID=BFDAC1-E470series, Password=AGVY45046');
console.log('💡 Pastikan printer terhubung ke WiFi yang sama dan IP address benar.');