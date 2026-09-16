// V1.0
// Variable global o de sesión para almacenar transacciones
let currentTransactions = [];
let currentLang = localStorage.getItem('finances_lang') || 'es';
let currencySymbol = localStorage.getItem('finances_currency') || '$';

window.addEventListener('finances-settings-changed', event => {
    if (event.detail?.language) currentLang = event.detail.language;
    if (event.detail?.currency) currencySymbol = event.detail.currency;
    renderHistoryPage();
});

// --- FUNCIÓN PARA REGISTRAR UN NUEVO MOVIMIENTO ---
async function addMovement(type, description, amount, categoryOrSource) {
    const user = window.auth?.currentUser;
    if (!user) {
        alert("Debes iniciar sesión para realizar esta acción.");
        return;
    }

    const today = new Date();
    const newTransaction = {
        id: Date.now().toString(),
        type: type, // 'income', 'expense', 'receivable_payment', 'debt_payment'
        description: description,
        amount: parseFloat(amount),
        category: categoryOrSource || 'General',
        date: today.toISOString().split('T')[0], // YYYY-MM-DD
        month: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`, // YYYY-MM
        createdAt: new Date()
    };

    try {
        // Guardar la nueva transacción en la base de datos de Firebase
        currentTransactions.push(newTransaction);
        
        const userRef = window.dbMethods.doc(window.db, "users", user.uid);
        await window.dbMethods.setDoc(userRef, { 
            transactions: currentTransactions 
        }, { merge: true });

        alert("Movimiento registrado con éxito.");
        
        // Si estamos en historial.html, renderizamos nuevamente los datos
        if (typeof renderHistoryPage === "function") {
            renderHistoryPage();
        }
    } catch (error) {
        console.error("Error al guardar en Firebase:", error);
    }
}

// --- FUNCIÓN PARA INICIALIZAR Y RENDERIZAR HISTORIAL ---
async function initHistoryPage() {
    const user = window.auth?.currentUser;
    if (!user) {
        window.dbMethods.onAuthStateChanged(window.auth, async (u) => {
            if (u) loadUserHistoryData(u.uid);
        });
    } else {
        await loadUserHistoryData(user.uid);
    }
}

async function loadUserHistoryData(uid) {
    try {
        const userRef = window.dbMethods.doc(window.db, "users", uid);
        const docSnap = await window.dbMethods.getDoc(userRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            let allTransactions = data.transactions || [];

            // Recuperar movimientos antiguos anidados en Carteras
            if (data.wallets && Array.isArray(data.wallets)) {
                data.wallets.forEach(w => {
                    if (w.transactions) {
                        w.transactions.forEach(t => {
                            if (!allTransactions.some(x => x.id === t.id)) {
                                allTransactions.push({
                                    ...t,
                                    category: t.category || `Cartera: ${w.name}`,
                                    description: t.description || t.reason || 'Sin descripción',
                                    month: t.month || (t.date ? t.date.slice(0, 7) : new Date().toISOString().slice(0, 7))
                                });
                            }
                        });
                    }
                });
            }

            // Recuperar movimientos antiguos anidados en Cuentas Bancarias
            if (data.bankAccounts && Array.isArray(data.bankAccounts)) {
                data.bankAccounts.forEach(b => {
                    if (b.transactions) {
                        b.transactions.forEach(t => {
                            if (!allTransactions.some(x => x.id === t.id)) {
                                allTransactions.push({
                                    ...t,
                                    category: t.category || `Banco: ${b.bankName}`,
                                    description: t.description || t.reason || 'Sin descripción',
                                    month: t.month || (t.date ? t.date.slice(0, 7) : new Date().toISOString().slice(0, 7))
                                });
                            }
                        });
                    }
                });
            }

            // Ordenar de más reciente a más antiguo
            currentTransactions = allTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));
        } else {
            currentTransactions = [];
        }

        populateMonthSelector();
        renderHistoryPage();
    } catch (err) {
        console.error("Error cargando el historial:", err);
    }
}

// Poblar selector de meses en base a las transacciones registradas
function populateMonthSelector() {
    const monthSelector = document.getElementById('monthSelector');
    if (!monthSelector) return;

    const monthsSet = new Set(currentTransactions.map(t => t.month));
    const currentMonth = new Date().toISOString().slice(0, 7);
    monthsSet.add(currentMonth);

    const sortedMonths = Array.from(monthsSet).sort().reverse();
    monthSelector.innerHTML = sortedMonths.map(m => `<option value="${m}">${m}</option>`).join('');
}

// Renderizar la tabla e indicadores según filtros
function renderHistoryPage() {
    const selectedMonth = document.getElementById('monthSelector')?.value;
    const selectedType = document.getElementById('typeFilter')?.value || 'all';
    const tbody = document.getElementById('historyTableBody');

    if (!tbody) return;

    // Filtrar los movimientos
    let filtered = currentTransactions.filter(t => {
        const matchMonth = selectedMonth ? t.month === selectedMonth : true;
        const matchType = selectedType === 'all' ? true : t.type === selectedType;
        return matchMonth && matchType;
    });

    // Calcular acumulados mensuales
    let monthInc = 0, monthExp = 0, monthRec = 0, monthDebts = 0;
    
    currentTransactions.filter(t => t.month === selectedMonth).forEach(t => {
        if (t.type === 'income') monthInc += t.amount;
        if (t.type === 'expense') monthExp += t.amount;
        if (t.type === 'receivable_payment') monthRec += t.amount;
        if (t.type === 'debt_payment') monthDebts += t.amount;
    });

    // Actualizar Totales en Tarjetas
    if (document.getElementById('histMonthIncome')) document.getElementById('histMonthIncome').innerText = `${currencySymbol}${monthInc.toFixed(2)}`;
    if (document.getElementById('histMonthExpense')) document.getElementById('histMonthExpense').innerText = `${currencySymbol}${monthExp.toFixed(2)}`;
    if (document.getElementById('histMonthReceivables')) document.getElementById('histMonthReceivables').innerText = `${currencySymbol}${monthRec.toFixed(2)}`;
    if (document.getElementById('histMonthDebts')) document.getElementById('histMonthDebts').innerText = `${currencySymbol}${monthDebts.toFixed(2)}`;

    // Limpiar tabla
    tbody.innerHTML = '';

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="py-6 text-center text-slate-500">No hay movimientos registrados para este periodo.</td></tr>`;
        return;
    }

    // Dibujar filas
    filtered.forEach(item => {
        const row = document.createElement('tr');
        row.className = "hover:bg-slate-800/40 transition";

        let badgeClass = "bg-slate-700 text-slate-300";
        let typeLabel = item.type;

        if (item.type === 'income') { badgeClass = "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"; typeLabel = "Ingreso"; }
        else if (item.type === 'expense') { badgeClass = "bg-rose-500/10 text-rose-400 border border-rose-500/20"; typeLabel = "Gasto"; }
        else if (item.type === 'receivable_payment') { badgeClass = "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"; typeLabel = "Cobro"; }
        else if (item.type === 'debt_payment') { badgeClass = "bg-purple-500/10 text-purple-400 border border-purple-500/20"; typeLabel = "Pago Deuda"; }

        row.innerHTML = `
            <td class="py-3 px-4 font-mono text-xs text-slate-400">${item.date}</td>
            <td class="py-3 px-4"><span class="px-2 py-1 text-[10px] font-semibold rounded-md ${badgeClass}">${typeLabel}</span></td>
            <td class="py-3 px-4 font-medium text-slate-200">${item.description}</td>
            <td class="py-3 px-4 text-slate-400">${item.category}</td>
            <td class="py-3 px-4 text-right font-bold ${item.type === 'expense' || item.type === 'debt_payment' ? 'text-rose-400' : 'text-emerald-400'}">
                ${item.type === 'expense' || item.type === 'debt_payment' ? '-' : '+'}${currencySymbol}${item.amount.toFixed(2)}
            </td>
        `;
        tbody.appendChild(row);
    });
}

function changeLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('finances_lang', lang);
}

function changeCurrency(curr) {
    currencySymbol = curr;
    localStorage.setItem('finances_currency', curr);
    renderHistoryPage();
}

function openSettingsModal() {
    document.getElementById('settingsModal')?.classList.remove('hidden');
}

function closeSettingsModal() {
    document.getElementById('settingsModal')?.classList.add('hidden');
}