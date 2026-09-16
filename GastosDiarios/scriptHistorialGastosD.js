window.currencySymbol = window.currencySymbol || '$';

// ============================================================
// ESPERAR Y CARGAR DESDE FIRESTORE
// ============================================================
function waitForFirebase(timeout = 10000) {
    return new Promise((resolve) => {
        const start = Date.now();
        const check = () => {
            if (window.auth && window.db && window.dbMethods && typeof window.dbMethods.doc === 'function') {
                resolve(true);
                return;
            }
            if (Date.now() - start >= timeout) {
                resolve(false);
                return;
            }
            setTimeout(check, 100);
        };
        check();
    });
}

function waitForAuthenticatedUser(timeout = 10000) {
    return new Promise((resolve) => {
        if (!window.auth) return resolve(null);
        if (window.auth.currentUser) return resolve(window.auth.currentUser);

        let finished = false;
        const finish = (user) => {
            if (finished) return;
            finished = true;
            resolve(user || null);
        };

        if (window.dbMethods && typeof window.dbMethods.onAuthStateChanged === 'function') {
            window.dbMethods.onAuthStateChanged(window.auth, (user) => finish(user));
        } else {
            finish(null);
        }

        setTimeout(() => finish(window.auth.currentUser), timeout);
    });
}

// ============================================================
// INICIALIZACIÓN DE PÁGINA
// ============================================================
async function initDailyHistoryPage() {
    await waitForFirebase();
    const user = await waitForAuthenticatedUser();

    if (!user) {
        console.warn("Usuario no autenticado en Historial de Gastos Diarios.");
        return;
    }

    try {
        const userDocRef = window.dbMethods.doc(window.db, "users", user.uid);
        const snapshot = await window.dbMethods.getDoc(userDocRef);

        if (snapshot.exists()) {
            const data = snapshot.data();
            window.state = data.state || { transactions: [] };
        } else {
            window.state = { transactions: [] };
        }
    } catch (error) {
        console.error("Error al leer de Firestore:", error);
        window.state = { transactions: [] };
    }

    populateMonthSelector();
    renderDailyHistoryPage();
}

// ============================================================
// POBLAR SELECTOR DE MESES
// ============================================================
function populateMonthSelector() {
    const selector = document.getElementById('monthSelector');
    if (!selector) return;

    selector.innerHTML = '';
    const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    const now = new Date();

    // Generar opciones para los últimos 12 meses
    for (let i = 0; i < 12; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const label = `${months[d.getMonth()]} ${d.getFullYear()}`;
        
        const opt = document.createElement('option');
        opt.value = val;
        opt.innerText = label;
        selector.appendChild(opt);
    }
}

// ============================================================
// RENDERIZAR TABLA Y TARJETAS
// ============================================================
function renderDailyHistoryPage() {
    const tableBody = document.getElementById('historyTableBody');
    const monthSelector = document.getElementById('monthSelector');
    const searchInput = document.getElementById('searchInput');

    if (!tableBody || !window.state || !Array.isArray(window.state.transactions)) return;

    const selectedMonth = monthSelector ? monthSelector.value : '';
    const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';

    // Filtrar solo las transacciones del módulo de gastos diarios
    const expenses = window.state.transactions.filter(t => {
        if (!t || t.type !== 'expense') return false;
        
        const matchCategory = !t.category || t.category === 'Gastos Diarios' || t.category === 'General';
        const matchMonth = selectedMonth ? t.date && t.date.startsWith(selectedMonth) : true;
        const matchSearch = searchTerm ? (t.desc && t.desc.toLowerCase().includes(searchTerm)) : true;

        return matchCategory && matchMonth && matchSearch;
    });

    // Ordenar fechas de más reciente a más antigua
    expenses.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Cálculos para tarjetas
    let totalSpent = 0;
    let maxExpense = 0;
    const daysWithExpenses = new Set();

    expenses.forEach(t => {
        const amt = Number(t.amount) || 0;
        totalSpent += amt;
        if (amt > maxExpense) maxExpense = amt;
        if (t.date) daysWithExpenses.add(t.date);
    });

    const avgDaily = daysWithExpenses.size > 0 ? (totalSpent / daysWithExpenses.size) : 0;

    // Actualizar Tarjetas
    document.getElementById('histMonthExpense').innerText = `${window.currencySymbol}${totalSpent.toFixed(2)}`;
    document.getElementById('histDailyAvg').innerText = `${window.currencySymbol}${avgDaily.toFixed(2)}`;
    document.getElementById('histTotalCount').innerText = expenses.length;
    document.getElementById('histMaxExpense').innerText = `${window.currencySymbol}${maxExpense.toFixed(2)}`;

    // Dibujar Tabla
    if (expenses.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="5" class="py-8 text-center text-slate-500 italic">
                    No se encontraron gastos registrados para los criterios seleccionados.
                </td>
            </tr>
        `;
        return;
    }

    tableBody.innerHTML = expenses.map(t => `
        <tr class="hover:bg-slate-700/30 transition">
            <td class="py-3 px-4 font-mono text-slate-300">${escapeHtml(t.date || '---')}</td>
            <td class="py-3 px-4 font-bold text-white">${escapeHtml(t.desc || 'Gasto Sin Nombre')}</td>
            <td class="py-3 px-4">
                <span class="bg-purple-950/60 text-purple-300 border border-purple-800/50 px-2 py-0.5 rounded-md text-[10px] font-medium">
                    ${escapeHtml(t.category || 'Gastos Diarios')}
                </span>
            </td>
            <td class="py-3 px-4 text-right font-bold text-rose-400">
                -${window.currencySymbol}${(Number(t.amount) || 0).toFixed(2)}
            </td>
            <td class="py-3 px-4 text-center">
                <button onclick="deleteDailyExpense('${t.id}')" title="Eliminar Gasto" class="text-slate-500 hover:text-rose-400 p-1.5 transition">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

// ============================================================
// ELIMINAR GASTO Y ACTUALIZAR FIRESTORE
// ============================================================
async function deleteDailyExpense(id) {
    if (!confirm("¿Estás seguro de que deseas eliminar este gasto del historial?")) return;

    if (!window.state || !Array.isArray(window.state.transactions)) return;

    // Filtrar localmente
    window.state.transactions = window.state.transactions.filter(t => t.id !== id);

    try {
        const user = window.auth ? window.auth.currentUser : null;
        if (user) {
            const userDocRef = window.dbMethods.doc(window.db, "users", user.uid);
            await window.dbMethods.setDoc(userDocRef, { state: window.state }, { merge: true });
        }

        renderDailyHistoryPage();
        alert("Gasto eliminado exitosamente.");
    } catch (err) {
        console.error("Error al borrar el registro en Firestore:", err);
        alert("Ocurrió un error al intentar eliminar el registro.");
    }
}

// ============================================================
// UTILIDADES DE MODAL Y HTML ESCAPE
// ============================================================
function escapeHtml(str) {
    return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function openSettingsModal() {
    const modal = document.getElementById('settingsModal');
    if (modal) modal.classList.remove('hidden');
}

function closeSettingsModal() {
    const modal = document.getElementById('settingsModal');
    if (modal) modal.classList.add('hidden');
}

function changeCurrency(symbol) {
    window.currencySymbol = symbol;
    localStorage.setItem('finances_currency', symbol);
    renderDailyHistoryPage();
}

window.addEventListener('finances-settings-changed', event => {
    if (event.detail?.currency) changeCurrency(event.detail.currency);
});

window.initDailyHistoryPage = initDailyHistoryPage;
window.renderDailyHistoryPage = renderDailyHistoryPage;
window.deleteDailyExpense = deleteDailyExpense;
window.openSettingsModal = openSettingsModal;
window.closeSettingsModal = closeSettingsModal;
window.changeCurrency = changeCurrency;