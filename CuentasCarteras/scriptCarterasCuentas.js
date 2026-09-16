//  V1.0
let currencySymbol = localStorage.getItem('finances_currency') || '$';

window.addEventListener('finances-settings-changed', event => {
    if (event.detail?.currency) {
        currencySymbol = event.detail.currency;
        renderAll();
    }
});

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

let currentUser = null;
let state = {
    wallets: [],
    bankAccounts: []
};

// Escuchar la inicialización de Firebase
window.addEventListener('firebaseReady', () => {
    initFirebaseListener();
});

if (window.auth && window.dbMethods) {
    initFirebaseListener();
}

function initFirebaseListener() {
    const { onAuthStateChanged } = window.dbMethods;
    onAuthStateChanged(window.auth, (user) => {
        if (user) {
            currentUser = user;
            const emailSpan = document.getElementById('userEmailDisplay');
            if (emailSpan) emailSpan.textContent = user.email;
            loadFirebaseData();
        } else {
            currentUser = null;
            const emailSpan = document.getElementById('userEmailDisplay');
            if (emailSpan) emailSpan.textContent = "No autenticado";
            window.location.href = '../login.html';
        }
    });
}

// Cargar Carteras y Cuentas de Firestore
async function loadFirebaseData() {
    if (!currentUser) return;

    const { doc, getDoc } = window.dbMethods;
    const userDocRef = doc(window.db, "users", currentUser.uid);

    try {
        const docSnap = await getDoc(userDocRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            state.wallets = data.wallets || [];
            state.bankAccounts = data.bankAccounts || [];
        } else {
            state.wallets = [];
            state.bankAccounts = [];
            await saveFirebaseData();
        }
    } catch (e) {
        console.error("Error cargando carteras/cuentas desde Firestore:", e);
    }
    renderAll();
}

// Guardar en Firestore fusionando los datos del usuario
async function saveFirebaseData() {
    if (!currentUser) {
        alert("Debes estar autenticado para realizar cambios.");
        return;
    }

    const { doc, setDoc } = window.dbMethods;
    const userDocRef = doc(window.db, "users", currentUser.uid);

    try {
        await setDoc(userDocRef, { 
            wallets: state.wallets,
            bankAccounts: state.bankAccounts
        }, { merge: true });
    } catch (e) {
        console.error("Error guardando en Firestore:", e);
    }
    renderAll();
}

function logoutUser() {
    const { signOut } = window.dbMethods;
    signOut(window.auth).then(() => {
        window.location.reload();
    }).catch(err => console.error("Error al cerrar sesión", err));
}

function toggleSidebar() {
    const sidebar = document.getElementById('slidingSidebar');
    const overlay = document.getElementById('sidebarOverlay');
    
    if (sidebar.classList.contains('-translate-x-full')) {
        sidebar.classList.remove('-translate-x-full');
        overlay.classList.remove('opacity-0', 'pointer-events-none');
    } else {
        sidebar.classList.add('-translate-x-full');
        overlay.classList.add('opacity-0', 'pointer-events-none');
    }
}

// CREAR CARTERA
async function createWallet(e) {
    e.preventDefault();
    const nameInput = document.getElementById('walletName');
    const amountInput = document.getElementById('walletInitialAmount');

    const name = nameInput.value.trim();
    const initialAmount = parseFloat(amountInput.value);

    if (name && !isNaN(initialAmount)) {
        state.wallets.push({
            id: Date.now(),
            name: name,
            balance: initialAmount,
            transactions: []
        });

        document.getElementById('walletForm').reset();
        await saveFirebaseData();
    }
}

// ELIMINAR CARTERA
async function deleteWallet(id) {
    if (confirm("¿Estás seguro de eliminar esta cartera y todos sus registros?")) {
        state.wallets = state.wallets.filter(w => w.id !== id);
        await saveFirebaseData();
    }
}

// CREAR CUENTA BANCARIA
async function createBankAccount(e) {
    e.preventDefault();
    const bankInput = document.getElementById('bankName');
    const typeInput = document.getElementById('accountType');
    const numberInput = document.getElementById('accountNumber');
    const amountInput = document.getElementById('accountInitialAmount');

    const bank = bankInput.value.trim();
    const type = typeInput.value;
    const number = numberInput.value.trim();
    const initialAmount = parseFloat(amountInput.value);

    if (bank && number && !isNaN(initialAmount)) {
        state.bankAccounts.push({
            id: Date.now(),
            bankName: bank,
            accountType: type,
            accountNumber: number,
            balance: initialAmount,
            transactions: []
        });

        document.getElementById('bankAccountForm').reset();
        await saveFirebaseData();
    }
}

// ELIMINAR CUENTA BANCARIA
async function deleteBankAccount(id) {
    if (confirm("¿Estás seguro de eliminar esta cuenta bancaria?")) {
        state.bankAccounts = state.bankAccounts.filter(b => b.id !== id);
        await saveFirebaseData();
    }
}

// RENDERIZAR TODO
function renderAll() {
    renderWallets();
    renderBankAccounts();
}

// RENDERIZAR CARTERAS
function renderWallets() {
    const container = document.getElementById('walletsContainer');
    if (!container) return;

    if (!currentUser) {
        container.innerHTML = `<div class="col-span-full py-8 text-center text-slate-500 text-xs">Inicia sesión para ver tus carteras.</div>`;
        return;
    }

    if (state.wallets.length === 0) {
        container.innerHTML = `<div class="col-span-full py-8 text-center text-slate-500 text-xs bg-slate-900/30 rounded-2xl border border-dashed border-slate-700/60">No tienes carteras creadas.</div>`;
        return;
    }

    container.innerHTML = state.wallets.map(w => {
        return `
            <div class="bg-slate-800/90 rounded-2xl border border-slate-700/80 p-4 space-y-4 shadow-xl relative">
                <div class="flex items-center justify-between border-b border-slate-700/50 pb-3">
                    <div class="flex items-center gap-2.5">
                        <div class="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                            <i class="fa-solid fa-wallet"></i>
                        </div>
                        <h3 class="font-bold text-white text-base">${escapeHtml(w.name)}</h3>
                    </div>
                    <button onclick="deleteWallet(${w.id})" class="text-slate-500 hover:text-rose-400 p-1.5 transition">
                        <i class="fa-solid fa-trash text-xs"></i>
                    </button>
                </div>

                <div>
                    <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Saldo Disponible</span>
                    <span class="text-2xl font-black text-emerald-400">${currencySymbol}${w.balance.toFixed(2)}</span>
                </div>

                <!-- Historial de Transacciones -->
                <div class="space-y-1.5">
                    <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Historial de Gestión</span>
                    <div class="max-h-28 overflow-y-auto space-y-1.5 custom-scroll text-xs bg-slate-900/60 p-2 rounded-xl border border-slate-700/50">
                        ${w.transactions && w.transactions.length > 0 ? w.transactions.map(t => `
                            <div class="flex justify-between items-center text-slate-300 border-b border-slate-800/80 pb-1.5 last:border-0">
                                <div class="truncate max-w-[160px]">
                                    <span class="block font-medium truncate">${escapeHtml(t.reason)}</span>
                                    <span class="text-[9px] text-slate-400">${escapeHtml(t.date)} • ${escapeHtml(t.description)}</span>
                                </div>
                                <div class="flex items-center gap-1.5">
                                    <span class="font-bold ${t.type === 'income' ? 'text-emerald-400' : 'text-rose-400'}">
                                        ${t.type === 'income' ? '+' : '-'}${currencySymbol}${t.amount.toFixed(2)}
                                    </span>
                                    <button onclick="deleteTransaction('wallet', ${w.id}, ${t.id})" class="text-slate-500 hover:text-rose-400 p-0.5 transition">
                                        <i class="fa-solid fa-xmark text-xs"></i>
                                    </button>
                                </div>
                            </div>
                        `).join('') : '<p class="text-[11px] text-slate-500 text-center italic py-1">Sin movimientos</p>'}
                    </div>
                </div>

                <button onclick="openTransactionModal('wallet', ${w.id})" class="w-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold py-2 rounded-xl text-xs transition flex items-center justify-center gap-2">
                    <i class="fa-solid fa-plus-circle"></i> Registrar Ingreso / Egreso
                </button>
            </div>
        `;
    }).join('');
}

// RENDERIZAR CUENTAS BANCARIAS
function renderBankAccounts() {
    const container = document.getElementById('bankAccountsContainer');
    if (!container) return;

    if (!currentUser) {
        container.innerHTML = `<div class="col-span-full py-8 text-center text-slate-500 text-xs">Inicia sesión para ver tus cuentas bancarias.</div>`;
        return;
    }

    if (state.bankAccounts.length === 0) {
        container.innerHTML = `<div class="col-span-full py-8 text-center text-slate-500 text-xs bg-slate-900/30 rounded-2xl border border-dashed border-slate-700/60">No tienes cuentas bancarias registradas.</div>`;
        return;
    }

    container.innerHTML = state.bankAccounts.map(b => {
        return `
            <div class="bg-slate-800/90 rounded-2xl border border-slate-700/80 p-4 space-y-4 shadow-xl relative">
                <div class="flex items-center justify-between border-b border-slate-700/50 pb-3">
                    <div class="flex items-center gap-2.5">
                        <div class="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold">
                            <i class="fa-solid fa-building-columns"></i>
                        </div>
                        <div>
                            <h3 class="font-bold text-white text-base">${escapeHtml(b.bankName)}</h3>
                            <p class="text-[10px] text-slate-400">${escapeHtml(b.accountType)} • No. ${escapeHtml(b.accountNumber)}</p>
                        </div>
                    </div>
                    <button onclick="deleteBankAccount(${b.id})" class="text-slate-500 hover:text-rose-400 p-1.5 transition">
                        <i class="fa-solid fa-trash text-xs"></i>
                    </button>
                </div>

                <div>
                    <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Saldo Disponible</span>
                    <span class="text-2xl font-black text-cyan-400">${currencySymbol}${b.balance.toFixed(2)}</span>
                </div>

                <!-- Historial de Transacciones -->
                <div class="space-y-1.5">
                    <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Historial de Gestión</span>
                    <div class="max-h-28 overflow-y-auto space-y-1.5 custom-scroll text-xs bg-slate-900/60 p-2 rounded-xl border border-slate-700/50">
                        ${b.transactions && b.transactions.length > 0 ? b.transactions.map(t => `
                            <div class="flex justify-between items-center text-slate-300 border-b border-slate-800/80 pb-1.5 last:border-0">
                                <div class="truncate max-w-[160px]">
                                    <span class="block font-medium truncate">${escapeHtml(t.reason)}</span>
                                    <span class="text-[9px] text-slate-400">${escapeHtml(t.date)} • ${escapeHtml(t.description)}</span>
                                </div>
                                <div class="flex items-center gap-1.5">
                                    <span class="font-bold ${t.type === 'income' ? 'text-emerald-400' : 'text-rose-400'}">
                                        ${t.type === 'income' ? '+' : '-'}${currencySymbol}${t.amount.toFixed(2)}
                                    </span>
                                    <button onclick="deleteTransaction('bank', ${b.id}, ${t.id})" class="text-slate-500 hover:text-rose-400 p-0.5 transition">
                                        <i class="fa-solid fa-xmark text-xs"></i>
                                    </button>
                                </div>
                            </div>
                        `).join('') : '<p class="text-[11px] text-slate-500 text-center italic py-1">Sin movimientos</p>'}
                    </div>
                </div>

                <button onclick="openTransactionModal('bank', ${b.id})" class="w-full bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-semibold py-2 rounded-xl text-xs transition flex items-center justify-center gap-2">
                    <i class="fa-solid fa-plus-circle"></i> Registrar Ingreso / Egreso
                </button>
            </div>
        `;
    }).join('');
}

// MODAL DE REGISTRO
function openTransactionModal(category, targetId) {
    document.getElementById('modalTargetCategory').value = category;
    document.getElementById('modalTargetId').value = targetId;
    document.getElementById('transactionForm').reset();
    document.getElementById('modalDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('transactionModal').classList.remove('hidden');
}

function closeTransactionModal() {
    document.getElementById('transactionModal').classList.add('hidden');
}

// PROCESAR INGRESO / EGRESO
// PROCESAR INGRESO / EGRESO
async function processTransaction(e) {
    e.preventDefault();
    const category = document.getElementById('modalTargetCategory').value;
    const targetId = parseInt(document.getElementById('modalTargetId').value);
    const txType = document.getElementById('modalTxType').value;
    const reason = document.getElementById('modalReason').value.trim();
    const amount = parseFloat(document.getElementById('modalAmount').value);
    const description = document.getElementById('modalDescription').value.trim();
    const date = document.getElementById('modalDate').value;

    if (isNaN(amount) || amount <= 0) return;

    let targetItem = null;
    let sourceName = "";
    if (category === 'wallet') {
        targetItem = state.wallets.find(w => w.id === targetId);
        if (targetItem) sourceName = `Cartera: ${targetItem.name}`;
    } else if (category === 'bank') {
        targetItem = state.bankAccounts.find(b => b.id === targetId);
        if (targetItem) sourceName = `Banco: ${targetItem.bankName}`;
    }

    if (!targetItem) return;
    if (!targetItem.transactions) targetItem.transactions = [];

    if (txType === 'income') {
        targetItem.balance += amount;
    } else {
        if (targetItem.balance < amount) {
            alert("No dispones de suficiente saldo para realizar este egreso.");
            return;
        }
        targetItem.balance -= amount;
    }

    const txDate = date || new Date().toISOString().split('T')[0];
    const txMonth = txDate.slice(0, 7); // Genera 'YYYY-MM'

    const newTx = {
        id: Date.now(),
        type: txType,
        reason: reason,
        description: reason + (description ? ` - ${description}` : ''),
        amount: amount,
        category: sourceName,
        date: txDate,
        month: txMonth
    };

    targetItem.transactions.unshift(newTx);

    // Guardar en Firestore fusionando tanto las carteras como el arreglo global de transacciones
    if (currentUser) {
        const { doc, setDoc, getDoc } = window.dbMethods;
        const userDocRef = doc(window.db, "users", currentUser.uid);

        try {
            const docSnap = await getDoc(userDocRef);
            let currentGlobalTxs = [];
            if (docSnap.exists() && docSnap.data().transactions) {
                currentGlobalTxs = docSnap.data().transactions;
            }

            currentGlobalTxs.unshift(newTx);

            await setDoc(userDocRef, { 
                wallets: state.wallets,
                bankAccounts: state.bankAccounts,
                transactions: currentGlobalTxs
            }, { merge: true });

        } catch (e) {
            console.error("Error guardando en Firestore:", e);
        }
    }

    closeTransactionModal();
    renderAll();
}

// ELIMINAR TRANSACCIÓN Y REVERTIR SALDO
async function deleteTransaction(category, targetId, txId) {
    let targetItem = null;
    if (category === 'wallet') {
        targetItem = state.wallets.find(w => w.id === targetId);
    } else if (category === 'bank') {
        targetItem = state.bankAccounts.find(b => b.id === targetId);
    }

    if (!targetItem || !targetItem.transactions) return;

    const index = targetItem.transactions.findIndex(t => t.id === txId);
    if (index === -1) return;

    const tx = targetItem.transactions[index];

    // Revertir el saldo
    if (tx.type === 'income') {
        targetItem.balance -= tx.amount;
    } else {
        targetItem.balance += tx.amount;
    }

    targetItem.transactions.splice(index, 1);
    await saveFirebaseData();
}