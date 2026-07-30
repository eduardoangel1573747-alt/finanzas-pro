// --- V1.0 ---
// --- ESTADO INICIAL Y CONFIGURACIÓN ---
const today = new Date().toISOString().split('T')[0];

let currentLang = localStorage.getItem('finances_lang') || 'es';
let currencySymbol = localStorage.getItem('finances_currency') || '$';
const currentUser = localStorage.getItem('finances_session_user') || 'demo_user';
const usersDB = JSON.parse(localStorage.getItem('finances_users_db')) || {};

if (!usersDB[currentUser]) {
    usersDB[currentUser] = {
        state: { transactions: [], incomes: [], categories: [], savingsBoxes: [], debts: [], receivables: [] }
    };
}

let state = usersDB[currentUser].state;

// --- DICCIONARIOS Y TRADUCCIONES ---
const i18n = {
    es: { 
        appTitle: "Fin Flow FPR", closeMonth: "Cierre de Mes", closeShort: "Cierre", netBalance: "Balance Disponible", 
        totalIncome: "Ingresos Totales", totalSpent: "Gastos Acumulados", totalSavings: "Total Ahorrado", 
        totalReceivables: "Te Deben", totalDebts: "Deudas", regTransactionTitle: "Nueva Transacción", 
        saveBtn: "Guardar", txHistory: "Historial", budgetTitle: "Presupuesto", createCatBtn: "Crear Categoría", 
        directIncomeTitle: "Ingresos Directos", addBtn: "Añadir", receivablesTitle: "Cuentas por Cobrar", 
        regLoanBtn: "Registrar Préstamo", debtsTitle: "Mis Deudas", regDebtBtn: "Registrar Deuda", 
        savingsTitle: "Cajas de Ahorro", createBoxBtn: "Crear Caja", settingsTitle: "Configuración", 
        optionExpense: "Gasto (-)", optionIncome: "Ingreso (+)", thDate: "Fecha", thDesc: "Descripción", 
        thAmount: "Monto", thAction: "Acción", ftRec: "Recursos Educativos", ftTools: "Herramientas", 
        ftSupport: "Soporte", ftLink1: "Curso de Educación Financiera", ftLink2: "Guía de Inversiones e Inflación", 
        ftLink4: "Calculadora Interés Compuesto", ftLink7: "Centro de Asistencia", rights: "Todos los derechos reservados.", 
        secureData: "100% Privado y Seguro. Tus datos se guardan de forma local." 
    },
    en: { 
        appTitle: "Fin Flow FPR", closeMonth: "Month Close", closeShort: "Close", netBalance: "Available Balance", 
        totalIncome: "Total Income", totalSpent: "Total Spent", totalSavings: "Total Savings", 
        totalReceivables: "Owed to You", totalDebts: "My Debts", regTransactionTitle: "New Transaction", 
        saveBtn: "Save", txHistory: "History", budgetTitle: "Budget", createCatBtn: "Create Category", 
        directIncomeTitle: "Direct Income", addBtn: "Add", receivablesTitle: "Accounts Receivable", 
        regLoanBtn: "Log Loan", debtsTitle: "Pending Debts", regDebtBtn: "Log Debt", savingsTitle: "Savings Boxes", 
        createBoxBtn: "Create Box", settingsTitle: "Settings", optionExpense: "Expense (-)", 
        optionIncome: "Income (+)", thDate: "Date", thDesc: "Description", thAmount: "Amount", 
        thAction: "Action", ftRec: "Educational Resources", ftTools: "Tools", ftSupport: "Support", 
        ftLink1: "Financial Education Course", ftLink2: "Investment & Inflation Guide", 
        ftLink4: "Compound Interest Calculator", ftLink7: "Help Center", rights: "All rights reserved.", 
        secureData: "100% Private and Secure. Your data is stored locally." 
    }
};

// --- GUARDAR Y SINCRONIZAR ---
function saveData() {
    if (currentUser) {
        usersDB[currentUser].state = state;
        localStorage.setItem('finances_users_db', JSON.stringify(usersDB));
        render();
    }
}

// --- AJUSTES Y NAVEGACIÓN ---
function logout() {
    localStorage.removeItem('finances_session_user');
    window.location.href = 'login.html';
}

function changeLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('finances_lang', lang);
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (i18n[lang] && i18n[lang][key]) el.innerText = i18n[lang][key];
    });
    render();
}

function changeCurrency(sym) {
    currencySymbol = sym;
    localStorage.setItem('finances_currency', sym);
    render();
}

function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// --- MODALES ---
function openSettingsModal() { document.getElementById('settingsModal').classList.remove('hidden'); }
function closeSettingsModal() { document.getElementById('settingsModal').classList.add('hidden'); }

function openCloseMonthModal() {
    const ti = state.incomes.reduce((a, b) => a + b.amount, 0);
    const ts = state.categories.reduce((a, b) => a + b.spent, 0);
    const surplus = ti - ts;
    document.getElementById('surplusAmount').innerText = currencySymbol + surplus.toFixed(2);
    document.getElementById('closeMonthModal').classList.remove('hidden');
}
function closeCloseMonthModal() { document.getElementById('closeMonthModal').classList.add('hidden'); }

function openSavingsModal(boxId) {
    document.getElementById('modalBoxId').value = boxId;
    document.getElementById('modalDate').value = today;
    document.getElementById('savingsMovementModal').classList.remove('hidden');
}
function closeSavingsModal() { document.getElementById('savingsMovementModal').classList.add('hidden'); }

function openReceivableModal(id) {
    document.getElementById('modalReceivableId').value = id;
    document.getElementById('recPayDate').value = today;
    document.getElementById('receivableModal').classList.remove('hidden');
}
function closeReceivableModal() { document.getElementById('receivableModal').classList.add('hidden'); }

function openDebtModal(id) {
    document.getElementById('modalDebtId').value = id;
    document.getElementById('debtPayDate').value = today;
    document.getElementById('debtPaymentModal').classList.remove('hidden');
}
function closeDebtModal() { document.getElementById('debtPaymentModal').classList.add('hidden'); }

// --- LÓGICA DE REGISTRO / FORMULARIO ---
function addTransaction(e) {
    e.preventDefault();
    const categoryValue = document.getElementById('txCategoryInput').value.trim() || 'General';
    const tx = {
        id: Date.now(),
        type: document.getElementById('txType').value,
        desc: document.getElementById('txDesc').value,
        amount: parseFloat(document.getElementById('txAmount').value),
        date: document.getElementById('txDate').value,
        category: categoryValue
    };

    state.transactions.unshift(tx);

    if (tx.type === 'income') {
        state.incomes.push({ id: tx.id, desc: tx.desc, amount: tx.amount, date: tx.date, category: tx.category });
    } else {
        let cat = state.categories.find(c => c.name.toLowerCase() === tx.category.toLowerCase());
        if (!cat) {
            state.categories.push({ id: Date.now(), name: tx.category, limit: tx.amount, spent: tx.amount });
        } else {
            cat.spent += tx.amount;
        }
    }

    document.getElementById('txForm').reset();
    document.getElementById('txDate').value = today;
    saveData();
}

function addCategory(e) {
    e.preventDefault();
    const name = document.getElementById('catName').value.trim();
    const limit = parseFloat(document.getElementById('catLimit').value);
    if (name && !isNaN(limit)) {
        state.categories.push({ id: Date.now(), name, limit, spent: 0 });
        document.getElementById('budgetForm').reset();
        saveData();
    }
}

function addDirectIncome(e) {
    e.preventDefault();
    const desc = document.getElementById('incDesc').value.trim();
    const amount = parseFloat(document.getElementById('incAmount').value);
    const date = document.getElementById('incDate').value;
    if (desc && !isNaN(amount)) {
        state.incomes.push({ id: Date.now(), desc, amount, date });
        document.getElementById('incomeForm').reset();
        document.getElementById('incDate').value = today;
        saveData();
    }
}

function addReceivable(e) {
    e.preventDefault();
    const person = document.getElementById('recPerson').value.trim();
    const amount = parseFloat(document.getElementById('recAmount').value);
    const date = document.getElementById('recDate').value;
    if (person && !isNaN(amount)) {
        state.receivables.push({ id: Date.now(), person, amount, date });
        document.getElementById('receivableForm').reset();
        document.getElementById('recDate').value = today;
        saveData();
    }
}

function addDebt(e) {
    e.preventDefault();
    const title = document.getElementById('debtTitle').value.trim();
    const amount = parseFloat(document.getElementById('debtAmount').value);
    const date = document.getElementById('debtDate').value;
    if (title && !isNaN(amount)) {
        state.debts.push({ id: Date.now(), title, amount, date });
        document.getElementById('debtForm').reset();
        document.getElementById('debtDate').value = today;
        saveData();
    }
}

function createNewSavingsBox(e) {
    e.preventDefault();
    const title = document.getElementById('boxTitle').value.trim();
    const initialAmount = parseFloat(document.getElementById('boxInitialAmount').value);
    const date = document.getElementById('boxDate').value;
    if (title && !isNaN(initialAmount)) {
        state.savingsBoxes.push({
            id: Date.now(),
            title,
            total: initialAmount,
            history: initialAmount > 0 ? [{ id: Date.now(), type: 'add', amount: initialAmount, reason: 'Monto inicial', date, source: 'Inicial' }] : []
        });
        document.getElementById('savingsBoxForm').reset();
        document.getElementById('boxDate').value = today;
        saveData();
    }
}

// --- FUNCIÓN AGREGADA DE SISI.HTML ---
function addSpentManual(id, inputElement) {
    const val = parseFloat(inputElement.value);
    if (!isNaN(val) && val !== 0) {
        const cat = state.categories.find(c => c.id === id);
        if (cat) {
            cat.spent = Math.max(0, cat.spent + val);
            inputElement.value = '';
            saveData();
        }
    }
}

// --- FUNCIÓN ACTUALIZADA CON LÓGICA SISI.HTML ---
function processSavingsMovement(e) {
    e.preventDefault();
    const boxId = parseInt(document.getElementById('modalBoxId').value);
    const action = document.getElementById('modalActionType').value;
    const source = document.getElementById('modalSource').value;
    const amt = parseFloat(document.getElementById('modalAmount').value);
    const date = document.getElementById('modalDate').value;
    const reason = document.getElementById('modalReason').value;

    const box = state.savingsBoxes.find(b => b.id === boxId);
    if (box) {
        if (action === 'subtract' && amt > box.total) return alert("Saldo insuficiente");
        box.total = action === 'add' ? box.total + amt : box.total - amt;
        if (!box.history) box.history = [];
        box.history.unshift({ id: Date.now(), type: action, source: source, amount: amt, date: date, reason: reason });
        closeSavingsModal();
        saveData();
    }
}

// --- FUNCIÓN AGREGADA DE SISI.HTML ---
function removeSavingsHistoryItem(boxId, historyId) {
    const box = state.savingsBoxes.find(b => b.id === boxId);
    if (box) {
        box.history = box.history.filter(h => h.id !== historyId);
        box.total = box.history.reduce((acc, curr) => curr.type === 'add' ? acc + curr.amount : acc - curr.amount, 0);
        saveData();
    }
}

function processReceivablePayment(e) {
    e.preventDefault();
    const id = parseInt(document.getElementById('modalReceivableId').value);
    const amount = parseFloat(document.getElementById('recPayAmount').value);
    const rec = state.receivables.find(r => r.id === id);
    if (rec && !isNaN(amount)) {
        rec.amount -= amount;
        if (rec.amount <= 0) state.receivables = state.receivables.filter(r => r.id !== id);
        closeReceivableModal();
        saveData();
    }
}

function processDebtPayment(e) {
    e.preventDefault();
    const id = parseInt(document.getElementById('modalDebtId').value);
    const amount = parseFloat(document.getElementById('debtPayAmount').value);
    const debt = state.debts.find(d => d.id === id);
    if (debt && !isNaN(amount)) {
        debt.amount -= amount;
        if (debt.amount <= 0) state.debts = state.debts.filter(d => d.id !== id);
        closeDebtModal();
        saveData();
    }
}

function handleSurplus(option) {
    if (option === 'nextMonth') {
        state.transactions = [];
        state.incomes = [];
        state.categories.forEach(c => c.spent = 0);
    } else if (option === 'savings') {
        const ti = state.incomes.reduce((a, b) => a + b.amount, 0);
        const ts = state.categories.reduce((a, b) => a + b.spent, 0);
        const surplus = Math.max(0, ti - ts);
        if (surplus > 0) {
            if (state.savingsBoxes.length === 0) {
                state.savingsBoxes.push({ id: Date.now(), title: "Ahorro General", total: surplus, history: [{ id: Date.now(), type: 'add', amount: surplus, reason: 'Excedente de mes', date: today, source: 'Cierre' }] });
            } else {
                state.savingsBoxes[0].total += surplus;
                if (!state.savingsBoxes[0].history) state.savingsBoxes[0].history = [];
                state.savingsBoxes[0].history.unshift({ id: Date.now(), type: 'add', amount: surplus, reason: 'Excedente de mes', date: today, source: 'Cierre' });
            }
        }
        state.transactions = [];
        state.incomes = [];
        state.categories.forEach(c => c.spent = 0);
    }
    closeCloseMonthModal();
    saveData();
}

function removeItem(type, id) {
    state[type] = state[type].filter(i => i.id !== id);
    saveData();
}

// --- RENDERIZADO DE LA VISTA ---
function render() {
    const ti = state.incomes.reduce((a, b) => a + b.amount, 0);
    const ts = state.categories.reduce((a, b) => a + b.spent, 0);

    if (document.getElementById('totalIncome')) document.getElementById('totalIncome').innerText = currencySymbol + ti.toFixed(2);
    if (document.getElementById('totalSpent')) document.getElementById('totalSpent').innerText = currencySymbol + ts.toFixed(2);
    if (document.getElementById('netBalance')) document.getElementById('netBalance').innerText = currencySymbol + (ti - ts).toFixed(2);
    if (document.getElementById('totalSavings')) document.getElementById('totalSavings').innerText = currencySymbol + state.savingsBoxes.reduce((a, b) => a + b.total, 0).toFixed(2);
    if (document.getElementById('totalDebts')) document.getElementById('totalDebts').innerText = currencySymbol + state.debts.reduce((a, b) => a + b.amount, 0).toFixed(2);
    if (document.getElementById('totalReceivables')) document.getElementById('totalReceivables').innerText = currencySymbol + state.receivables.reduce((a, b) => a + b.amount, 0).toFixed(2);

    // Historial
    const historyList = document.getElementById('transactionHistoryList');
    if (historyList) {
        historyList.innerHTML = state.transactions.map(t => `
            <div class="bg-slate-700/60 p-2.5 rounded-lg border border-slate-600 flex justify-between items-center text-xs gap-2">
                <div class="truncate">
                    <span class="font-bold ${t.type === 'income' ? 'text-emerald-400' : 'text-rose-400'}">${t.type.toUpperCase()}</span> - <span class="text-slate-200">${t.desc}</span>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                    <b>${currencySymbol}${t.amount}</b>
                    <button onclick="removeItem('transactions', ${t.id})" class="text-rose-400 p-1"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>`).join('');
    }

    // Categorías (Actualizado para permitir agregar gasto manualmente mediante addSpentManual)
    const catList = document.getElementById('categoryList');
    if (catList) {
        catList.innerHTML = state.categories.map(c => `
            <div class="bg-slate-700/50 p-3 rounded-lg border border-slate-600 space-y-2">
                <div class="flex justify-between items-center text-xs font-medium">
                    <span>${c.name}</span>
                    <div class="flex items-center gap-2">
                        <span>${currencySymbol}${c.spent.toFixed(2)} / ${currencySymbol}${c.limit.toFixed(2)}</span>
                        <button onclick="removeItem('categories', ${c.id})" class="text-rose-400 p-1"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>
                <div class="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div class="bg-purple-500 h-full rounded-full transition-all duration-300" style="width:${Math.min(100, (c.spent / c.limit) * 100)}%"></div>
                </div>
                <div class="flex items-center gap-2 pt-1">
                    <input type="number" id="manualSpentInput_${c.id}" placeholder="+ Gastado" step="1" class="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-purple-400">
                    <button onclick="addSpentManual(${c.id}, document.getElementById('manualSpentInput_${c.id}'))" class="bg-purple-600 hover:bg-purple-500 text-white text-xs px-2.5 py-1 rounded transition shrink-0"><i class="fa-solid fa-plus"></i></button>
                </div>
            </div>`).join('');
    }

    // Ingresos Tabla
    const incList = document.getElementById('incomeList');
    if (incList) {
        incList.innerHTML = state.incomes.map(i => `
            <tr class="text-xs border-b border-slate-700/60">
                <td class="p-2.5 whitespace-nowrap">${i.date}</td>
                <td class="p-2.5">${i.desc}</td>
                <td class="p-2.5 text-emerald-400 font-semibold whitespace-nowrap">${currencySymbol}${i.amount}</td>
                <td class="p-2.5 text-right"><button onclick="removeItem('incomes', ${i.id})" class="text-rose-400 p-1"><i class="fa-solid fa-trash"></i></button></td>
            </tr>`).join('');
    }

    // Cuentas por cobrar
    const recList = document.getElementById('receivablesList');
    if (recList) {
        recList.innerHTML = state.receivables.map(r => `
            <div class="bg-slate-800 p-3.5 rounded-xl border border-slate-700 flex justify-between items-center">
                <div>
                    <div class="font-bold text-sm text-slate-100">${r.person}</div>
                    <div class="text-xs text-slate-400">${r.date}</div>
                    <div class="text-cyan-400 text-base font-bold">${currencySymbol}${r.amount.toFixed(2)}</div>
                </div>
                <div class="flex gap-2">
                    <button onclick="openReceivableModal(${r.id})" class="bg-cyan-600 hover:bg-cyan-500 text-white text-xs px-2.5 py-1.5 rounded-lg"><i class="fa-solid fa-hand-holding-dollar"></i> Cobrar</button>
                    <button onclick="removeItem('receivables', ${r.id})" class="text-rose-400 p-1"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>`).join('');
    }

    // Deudas
    const dList = document.getElementById('debtList');
    if (dList) {
        dList.innerHTML = state.debts.map(d => `
            <div class="bg-slate-800 p-3.5 rounded-xl border border-slate-700 flex justify-between items-center">
                <div>
                    <div class="font-bold text-sm text-slate-100">${d.title}</div>
                    <div class="text-xs text-slate-400">${d.date || 'Sin fecha'}</div>
                    <div class="text-rose-400 text-base font-bold">${currencySymbol}${d.amount.toFixed(2)}</div>
                </div>
                <div class="flex gap-2">
                    <button onclick="openDebtModal(${d.id})" class="bg-rose-600 hover:bg-rose-500 text-white text-xs px-2.5 py-1.5 rounded-lg"><i class="fa-solid fa-credit-card"></i> Abonar</button>
                    <button onclick="removeItem('debts', ${d.id})" class="text-rose-400 p-1"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>`).join('');
    }

    // Cajas de Ahorro (con renderizado de historial y opción de eliminar ítems del historial con removeSavingsHistoryItem)
    const savContainer = document.getElementById('savingsBoxesContainer');
    if (savContainer) {
        savContainer.innerHTML = state.savingsBoxes.map(b => `
            <div class="bg-slate-800 p-4 rounded-xl border border-slate-700 flex flex-col justify-between space-y-3">
                <div class="flex justify-between items-center font-bold">
                    <span class="truncate text-slate-100">${b.title}</span>
                    <button onclick="removeItem('savingsBoxes', ${b.id})" class="text-rose-400 text-xs p-1"><i class="fa-solid fa-trash"></i></button>
                </div>
                <div class="text-amber-400 text-2xl font-black">${currencySymbol}${b.total.toFixed(2)}</div>
                
                ${b.history && b.history.length > 0 ? `
                    <div class="max-h-24 overflow-y-auto space-y-1 custom-scroll text-[11px] bg-slate-900/60 p-2 rounded">
                        ${b.history.map(h => `
                            <div class="flex justify-between items-center text-slate-300 border-b border-slate-800 pb-0.5">
                                <span class="truncate max-w-[120px]">${h.reason} (${h.source || 'N/A'})</span>
                                <div class="flex items-center gap-1">
                                    <span class="${h.type === 'add' ? 'text-emerald-400' : 'text-rose-400'}">${h.type === 'add' ? '+' : '-'}${currencySymbol}${h.amount}</span>
                                    <button onclick="removeSavingsHistoryItem(${b.id}, ${h.id})" class="text-rose-400 hover:text-rose-300 ml-1"><i class="fa-solid fa-xmark"></i></button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}

                <button onclick="openSavingsModal(${b.id})" class="w-full bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 font-semibold py-2 rounded-lg text-xs transition"><i class="fa-solid fa-right-left"></i> Gestionar Movimiento</button>
            </div>`).join('');
    }
}

// --- EVENTOS INICIALES AL CARGAR LA PÁGINA ---
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('input[type="date"]').forEach(input => {
        if (!input.value) input.value = today;
    });

    changeLanguage(currentLang);
    changeCurrency(currencySymbol);
});