let currencySymbol = localStorage.getItem('finances_currency') || '$';

window.addEventListener('finances-settings-changed', event => {
    if (event.detail?.currency) {
        currencySymbol = event.detail.currency;
        renderSavingsGoals();
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
let savingsState = {
    savingsBoxes: []
};

// Escuchar inicio de Firebase
window.addEventListener('firebaseReady', () => {
    initFirebaseListener();
});

// Respaldar si Firebase ya estaba disponible antes del event handler
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

// Cargar datos desde Firestore
async function loadFirebaseData() {
    if (!currentUser) return;

    const { doc, getDoc } = window.dbMethods;
    const userDocRef = doc(window.db, "users", currentUser.uid);

    try {
        const docSnap = await getDoc(userDocRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            savingsState.savingsBoxes = data.savingsBoxes || [];
        } else {
            // Meta inicial por defecto en caso de usuario nuevo
            savingsState.savingsBoxes = [
                {
                    id: 1711002000000,
                    title: 'KTM HARD ENDURO',
                    targetAmount: 70000,
                    total: 0,
                    image: 'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?auto=format&fit=crop&w=1000&q=80',
                    history: []
                }
            ];
            await saveFirebaseData();
        }
    } catch (e) {
        console.error("Error al cargar datos desde Firestore:", e);
    }
    renderSavingsGoals();
}

// Guardar datos en Firestore
async function saveFirebaseData() {
    if (!currentUser) {
        alert("Debes estar autenticado para guardar información.");
        return;
    }

    const { doc, setDoc } = window.dbMethods;
    const userDocRef = doc(window.db, "users", currentUser.uid);

    try {
        await setDoc(userDocRef, { savingsBoxes: savingsState.savingsBoxes }, { merge: true });
    } catch (e) {
        console.error("Error al guardar en Firestore:", e);
    }
    renderSavingsGoals();
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

function convertFileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

async function createNewSavingsGoal(e) {
    e.preventDefault();
    const titleInput = document.getElementById('goalTitle');
    const targetInput = document.getElementById('goalTargetAmount');
    const imageInput = document.getElementById('goalImageInput');

    const title = titleInput.value.trim();
    const targetAmount = parseFloat(targetInput.value);

    let imageBase64 = null;
    if (imageInput.files && imageInput.files[0]) {
        try {
            imageBase64 = await convertFileToBase64(imageInput.files[0]);
        } catch (err) {
            console.error("Error al procesar la imagen", err);
        }
    }

    if (title && !isNaN(targetAmount) && targetAmount > 0) {
        savingsState.savingsBoxes.push({
            id: Date.now(),
            title: title,
            targetAmount: targetAmount,
            total: 0,
            image: imageBase64,
            history: []
        });

        document.getElementById('savingsGoalForm').reset();
        await saveFirebaseData();
    }
}

async function removeSavingsGoal(id) {
    if (confirm("¿Deseas eliminar esta meta de ahorro?")) {
        savingsState.savingsBoxes = savingsState.savingsBoxes.filter(item => item.id !== id);
        await saveFirebaseData();
    }
}

function renderSavingsGoals() {
    const container = document.getElementById('savingsGoalsContainer');
    if (!container) return;

    if (!currentUser) {
        container.innerHTML = `
            <div class="col-span-full py-12 text-center text-slate-500 text-xs bg-slate-900/30 rounded-2xl border border-dashed border-slate-700/60">
                <i class="fa-solid fa-lock text-3xl mb-2 block text-slate-600"></i>
                Por favor inicia sesión para ver y guardar tus metas de ahorro.
            </div>`;
        return;
    }

    if (!savingsState.savingsBoxes || savingsState.savingsBoxes.length === 0) {
        container.innerHTML = `
            <div class="col-span-full py-12 text-center text-slate-500 text-xs bg-slate-900/30 rounded-2xl border border-dashed border-slate-700/60">
                <i class="fa-solid fa-bullseye text-3xl mb-2 block text-slate-600"></i>
                No tienes objetivos de ahorro activos. ¡Crea el primero arriba!
            </div>`;
        return;
    }

    container.innerHTML = savingsState.savingsBoxes.map(b => {
        const currentTotal = b.total || 0;
        const target = b.targetAmount || 1;
        const percentage = Math.min(100, Math.round((currentTotal / target) * 100));
        const strokeDashoffset = 100 - percentage;
        const bgImage = b.image || 'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?auto=format&fit=crop&w=1000&q=80';

        return `
            <div class="bg-slate-800/90 rounded-2xl border border-slate-700/80 overflow-hidden flex flex-col justify-between shadow-xl relative group">
                
                <div class="relative h-48 w-full overflow-hidden bg-slate-900">
                    <img src="${escapeHtml(bgImage)}" alt="${escapeHtml(b.title)}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">
                    
                    <div class="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/30 to-black/40"></div>
                    
                    <button onclick="removeSavingsGoal(${b.id})" class="absolute top-3 right-3 bg-slate-900/80 hover:bg-rose-600 text-slate-300 hover:text-white p-2 rounded-xl text-xs backdrop-blur transition shadow">
                        <i class="fa-solid fa-trash"></i>
                    </button>

                    <div class="absolute bottom-3 left-4 right-4">
                        <h4 class="font-extrabold text-white text-base sm:text-lg tracking-wide drop-shadow-md">${escapeHtml(b.title)}</h4>
                    </div>
                </div>

                <div class="p-4 space-y-4">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-[10px] uppercase font-bold text-slate-400 tracking-wider">AHORRADO / META</p>
                            <p class="text-lg sm:text-xl font-black text-amber-400">
                                ${currencySymbol}${currentTotal.toFixed(2)} 
                                <span class="text-xs text-slate-400 font-normal">/ ${currencySymbol}${target.toFixed(2)}</span>
                            </p>
                        </div>

                        <div class="relative w-12 h-12 flex items-center justify-center shrink-0">
                            <svg class="w-full h-full -rotate-90" viewBox="0 0 36 36">
                                <path class="text-slate-700" stroke-width="3.5" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                <path class="text-amber-400 transition-all duration-700 ease-out" stroke-dasharray="100, 100" stroke-dashoffset="${strokeDashoffset}" stroke-linecap="round" stroke-width="3.5" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                            </svg>
                            <span class="absolute text-[10px] font-bold text-white">${percentage}%</span>
                        </div>
                    </div>

                    <div class="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-700/80">
                        <div class="bg-gradient-to-r from-amber-500 to-yellow-400 h-full rounded-full transition-all duration-500" style="width: ${percentage}%"></div>
                    </div>

                    ${b.history && b.history.length > 0 ? `
                        <div class="max-h-24 overflow-y-auto space-y-1.5 custom-scroll text-[11px] bg-slate-900/60 p-2 rounded-xl border border-slate-700/50">
                            ${b.history.map(h => `
                                <div class="flex justify-between items-center text-slate-300 border-b border-slate-800/80 pb-1 last:border-0">
                                    <div class="truncate max-w-[130px]">
                                        <span class="block font-medium truncate">${escapeHtml(h.reason)}</span>
                                        <span class="text-[9px] text-slate-400">${escapeHtml(h.date)} • ${escapeHtml(h.source)}</span>
                                    </div>
                                    <div class="flex items-center gap-1.5">
                                        <span class="font-bold ${h.type === 'add' ? 'text-emerald-400' : 'text-rose-400'}">
                                            ${h.type === 'add' ? '+' : '-'}${currencySymbol}${h.amount.toFixed(2)}
                                        </span>
                                        <button onclick="removeSavingsHistoryItem(${b.id}, ${h.id})" class="text-slate-500 hover:text-rose-400 p-0.5 transition">
                                            <i class="fa-solid fa-xmark"></i>
                                        </button>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    ` : '<p class="text-[11px] text-slate-500 text-center italic py-1">Sin aportes registrados aún</p>'}

                    <button onclick="openSavingsModal(${b.id})" class="w-full bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold py-2.5 rounded-xl text-xs sm:text-sm transition flex items-center justify-center gap-2 active:scale-[0.98]">
                        <i class="fa-solid fa-circle-plus text-amber-400"></i> Agregar Aporte / Retiro
                    </button>

                </div>
            </div>`;
    }).join('');
}

function openSavingsModal(boxId) {
    document.getElementById('modalBoxId').value = boxId;
    document.getElementById('savingsMovementForm').reset();
    document.getElementById('modalDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('savingsMovementModal').classList.remove('hidden');
}

function closeSavingsModal() {
    document.getElementById('savingsMovementModal').classList.add('hidden');
}

async function processSavingsMovement(e) {
    e.preventDefault();
    const boxId = parseInt(document.getElementById('modalBoxId').value);
    const actionType = document.getElementById('modalActionType').value;
    const source = document.getElementById('modalSource').value;
    const amount = parseFloat(document.getElementById('modalAmount').value);
    const date = document.getElementById('modalDate').value;
    const reason = document.getElementById('modalReason').value.trim();

    if (isNaN(amount) || amount <= 0) return;

    const box = savingsState.savingsBoxes.find(b => b.id === boxId);
    if (!box) return;

    if (!box.history) box.history = [];

    if (actionType === 'add') {
        box.total = (box.total || 0) + amount;
    } else {
        if ((box.total || 0) < amount) {
            alert("No puedes retirar más del dinero ahorrado en esta meta.");
            return;
        }
        box.total -= amount;
    }

    box.history.unshift({
        id: Date.now(),
        type: actionType,
        amount: amount,
        source: source,
        reason: reason,
        date: date
    });

    closeSavingsModal();
    await saveFirebaseData();
}

async function removeSavingsHistoryItem(boxId, historyId) {
    const box = savingsState.savingsBoxes.find(b => b.id === boxId);
    if (!box || !box.history) return;

    const itemIndex = box.history.findIndex(h => h.id === historyId);
    if (itemIndex === -1) return;

    const item = box.history[itemIndex];
    if (item.type === 'add') {
        box.total -= item.amount;
    } else {
        box.total += item.amount;
    }

    box.history.splice(itemIndex, 1);
    await saveFirebaseData();
}