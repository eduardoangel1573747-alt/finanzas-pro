// V1.2
let budgetData = {
    months: {}
};

let currentMonthOffset = 0;
let currentMonthKey = "";
let currentUser = null;
let budgetChart = null;
let comparisonChart = null;
let selectedCategoryIcon = "fa-solid fa-folder";
let isSaving = false;
let appCurrency = localStorage.getItem('finances_currency') || '$';

window.addEventListener('finances-settings-changed', event => {
    if (event.detail?.currency) {
        appCurrency = event.detail.currency;
        renderEverything();
    }
});


/* ============================================================
   ICONOS PREDETERMINADOS
   ============================================================ */

const DEFAULT_ICONS = [
    "fa-solid fa-house",
    "fa-solid fa-utensils",
    "fa-solid fa-car",
    "fa-solid fa-gas-pump",
    "fa-solid fa-heart-pulse",
    "fa-solid fa-graduation-cap",
    "fa-solid fa-gamepad",
    "fa-solid fa-shirt",

    "fa-solid fa-bolt",
    "fa-solid fa-mobile-screen",
    "fa-solid fa-credit-card",
    "fa-solid fa-piggy-bank",
    "fa-solid fa-plane",
    "fa-solid fa-gift",
    "fa-solid fa-dumbbell",
    "fa-solid fa-paw",

    "fa-solid fa-laptop",
    "fa-solid fa-wrench",
    "fa-solid fa-basket-shopping",
    "fa-solid fa-mug-hot",
    "fa-solid fa-music",
    "fa-solid fa-book",
    "fa-solid fa-briefcase",
    "fa-solid fa-umbrella",

    "fa-solid fa-baby",
    "fa-solid fa-dog",
    "fa-solid fa-cat",
    "fa-solid fa-tv",
    "fa-solid fa-wifi",
    "fa-solid fa-scissors",
    "fa-solid fa-camera",
    "fa-solid fa-coins"
];


/* ============================================================
   INICIO
   ============================================================ */

document.addEventListener("DOMContentLoaded", async () => {
    renderIconSelector();
    setDefaultMovementDate();
    setupModalClose();
    await initializeBudget();
});


/* ============================================================
   OBTENER USUARIO ACTUAL
   ============================================================ */

async function getCurrentUser() {
    // 1. Si ya tenemos la variable guardada
    if (currentUser) return currentUser;

    // 2. Si Firebase auth ya tiene el usuario cargado
    if (window.auth && window.auth.currentUser) {
        currentUser = window.auth.currentUser;
        return currentUser;
    }

    // 3. Esperar activamente a que Firebase reporte el usuario si aún está cargando
    return await waitForAuthenticatedUser(3000);
}


/* ============================================================
   ESPERAR FIREBASE
   ============================================================ */

function waitForFirebase(timeout = 10000) {
    return new Promise(resolve => {
        const start = Date.now();

        const check = () => {
            if (
                window.auth &&
                window.db &&
                window.dbMethods &&
                typeof window.dbMethods.doc === "function" &&
                typeof window.dbMethods.getDoc === "function" &&
                typeof window.dbMethods.setDoc === "function"
            ) {
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


/* ============================================================
   ESPERAR USUARIO
   ============================================================ */

function waitForAuthenticatedUser(timeout = 10000) {
    return new Promise(resolve => {
        if (!window.auth) {
            resolve(null);
            return;
        }

        if (window.auth.currentUser) {
            resolve(window.auth.currentUser);
            return;
        }

        let finished = false;
        let unsubscribe = null;

        const finish = user => {
            if (finished) return;
            finished = true;
            if (typeof unsubscribe === "function") {
                unsubscribe();
            }
            resolve(user || null);
        };

        if (
            window.dbMethods &&
            typeof window.dbMethods.onAuthStateChanged === "function"
        ) {
            unsubscribe = window.dbMethods.onAuthStateChanged(
                window.auth,
                user => finish(user)
            );
        }

        setTimeout(() => {
            finish(window.auth.currentUser);
        }, timeout);
    });
}


// INICIALIZAR PRESUPUESTO
async function initializeBudget() {
    try {
        const firebaseReady = await waitForFirebase();

        if (!firebaseReady) {
            console.error("Firebase no está disponible.");
            showNotification(
                "No se pudo conectar con Firebase.",
                "error"
            );
            return;
        }

        currentUser = await waitForAuthenticatedUser();

        if (!currentUser) {
            window.location.href = "../login.html";
            showNotification(
                "No hay una sesión activa. Por favor inicia sesión.",
                "error"
            );
            return;
        }

        await loadBudgetFromFirestore();

        currentMonthOffset = 0;
        renderEverything();
    } catch (error) {
        console.error("Error inicializando Presupuesto:", error);
        showNotification(
            "No fue posible cargar el presupuesto.",
            "error"
        );
    }
}


/* ============================================================
   CARGAR FIRESTORE
   ============================================================ */

async function loadBudgetFromFirestore() {
    const user = await getCurrentUser();
    if (!user) {
        console.warn("No hay usuario detectado al cargar datos.");
        return;
    }

    try {
        const userRef = window.dbMethods.doc(
            window.db,
            "users",
            user.uid
        );

        const snapshot = await window.dbMethods.getDoc(userRef);

        if (!snapshot.exists()) {
            console.log("El usuario no tiene presupuesto previo. Creando estructura vacía.");
            budgetData = { months: {} };
            return;
        }

        const data = snapshot.data();

        if (data && data.budgetData && typeof data.budgetData === "object") {
            budgetData = normalizeBudgetData(data.budgetData);
        } else {
            budgetData = { months: {} };
        }
    } catch (error) {
        console.error("Error detallado al leer Firestore:", error);
        throw error; // Lanza el error para que initializeBudget informe
    }
}


/* ============================================================
   NORMALIZAR DATOS
   ============================================================ */

function normalizeBudgetData(data) {
    const normalized = {
        months: {}
    };

    if (!data || typeof data !== "object") {
        return normalized;
    }

    if (data.months && typeof data.months === "object") {
        normalized.months = data.months;
    }

    Object.keys(normalized.months).forEach(monthKey => {
        const month = normalized.months[monthKey];

        if (!month || typeof month !== "object") {
            normalized.months[monthKey] = {
                categories: [],
                movements: []
            };
            return;
        }

        if (!Array.isArray(month.categories)) {
            month.categories = [];
        }

        if (!Array.isArray(month.movements)) {
            month.movements = [];
        }

        month.categories = month.categories.map(category => ({
            id: category.id || generateId(),
            name: String(category.name || "Sin nombre"),
            description: String(category.description || ""),
            budget: Number(category.budget) || 0,
            icon: category.icon || "fa-solid fa-folder"
        }));

        month.movements = month.movements.map(movement => ({
            id: movement.id || generateId(),
            type: movement.type === "income" ? "income" : "expense",
            description: String(movement.description || "Movimiento"),
            amount: Number(movement.amount) || 0,
            date: movement.date || `${monthKey}-01`,
            categoryId: movement.categoryId || "",
            note: String(movement.note || "")
        }));
    });

    return normalized;
}


/* ============================================================
   OBTENER MES ACTUAL
   ============================================================ */

function getTargetDate() {
    const now = new Date();
    return new Date(
        now.getFullYear(),
        now.getMonth() + currentMonthOffset,
        1
    );
}

function getMonthKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
}

function getCurrentMonthData() {
    currentMonthKey = getMonthKey(getTargetDate());

    if (!budgetData.months[currentMonthKey]) {
        budgetData.months[currentMonthKey] = {
            categories: [],
            movements: []
        };
    }

    return budgetData.months[currentMonthKey];
}


/* ============================================================
   GUARDAR FIRESTORE
   ============================================================ */

async function saveBudgetToFirestore() {
    const user = await getCurrentUser();

    if (!user) {
        showNotification("No hay sesión activa para guardar los datos.", "error");
        throw new Error("No existe un usuario autenticado.");
    }

    if (isSaving) return;
    isSaving = true;

    try {
        const userRef = window.dbMethods.doc(
            window.db,
            "users",
            user.uid
        );

        // Guardar explícitamente en la colección users / {uid}
        await window.dbMethods.setDoc(
            userRef,
            { budgetData: budgetData },
            { merge: true }
        );
        console.log("Presupuesto guardado correctamente en Firestore.");
    } catch (error) {
        console.error("Error detallado al guardar en Firestore:", error);
        showNotification("Error al guardar en la base de datos.", "error");
        throw error;
    } finally {
        isSaving = false;
    }
}


/* ============================================================
   RENDER GENERAL
   ============================================================ */

function renderEverything() {
    const monthData = getCurrentMonthData();

    renderMonthTitle();
    renderSummary(monthData);
    renderCategories(monthData);
    renderMovements();
    renderCharts(monthData);
    renderRecommendations(monthData);
}


/* ============================================================
   TITULO DEL MES
   ============================================================ */

function renderMonthTitle() {
    const date = getTargetDate();
    const title = date.toLocaleDateString("es-ES", {
        month: "long",
        year: "numeric"
    });

    const element = document.getElementById("monthTitle");
    if (element) {
        element.textContent = title;
    }
}


/* ============================================================
   CAMBIAR MES
   ============================================================ */

function changeMonth(offset) {
    currentMonthOffset += offset;
    renderEverything();
}

function goCurrentMonth() {
    currentMonthOffset = 0;
    renderEverything();
}


/* ============================================================
   RESUMEN
   ============================================================ */

function calculateTotals(monthData) {
    const totalIncome = monthData.movements
        .filter(m => m.type === "income")
        .reduce((sum, m) => sum + Number(m.amount || 0), 0);

    const totalSpent = monthData.movements
        .filter(m => m.type === "expense")
        .reduce((sum, m) => sum + Number(m.amount || 0), 0);

    const totalBudget = monthData.categories.reduce(
        (sum, c) => sum + Number(c.budget || 0),
        0
    );

    return {
        totalIncome,
        totalSpent,
        totalBudget,
        totalAvailable: totalBudget - totalSpent,
        balance: totalIncome - totalSpent
    };
}

function renderSummary(monthData) {
    const totals = calculateTotals(monthData);

    setText("totalIncome", formatMoney(totals.totalIncome));
    setText("totalBudget", formatMoney(totals.totalBudget));
    setText("totalSpent", formatMoney(totals.totalSpent));
    setText("totalAvailable", formatMoney(totals.totalAvailable));
    setText("balanceAmount", formatMoney(totals.balance));

    const available = document.getElementById("totalAvailable");
    if (available) {
        available.className =
            "text-xl font-black mt-2 " +
            (totals.totalAvailable >= 0
                ? "text-emerald-400"
                : "text-rose-400");
    }

    const balance = document.getElementById("balanceAmount");
    if (balance) {
        balance.className =
            "text-xl font-black mt-2 " +
            (totals.balance >= 0
                ? "text-emerald-400"
                : "text-rose-400");
    }
}


// CATEGORÍAS
function renderCategories() {
    const container = document.getElementById("categoriesContainer");
    const emptyState = document.getElementById("emptyCategories");
    const countBadge = document.getElementById("categoryCount");

    if (!container) return;

    const monthData = getCurrentMonthData();
    const categories = monthData.categories || [];

    if (countBadge) {
        countBadge.textContent = `${categories.length} categoría${categories.length === 1 ? '' : 's'}`;
    }

    if (categories.length === 0) {
        container.innerHTML = "";
        if (emptyState) emptyState.classList.remove("hidden");
        return;
    }

    if (emptyState) emptyState.classList.add("hidden");

    // Calcular consumo total por categoría en base a los movimientos
    const categorySpentMap = {};
    (monthData.movements || []).forEach(m => {
        if (m.type === 'expense' && m.category) {
            categorySpentMap[m.category] = (categorySpentMap[m.category] || 0) + Number(m.amount);
        }
    });

    container.innerHTML = categories.map(cat => {
        const spent = categorySpentMap[cat.name] || 0;
        const budget = Number(cat.budget) || 0;
        const percent = budget > 0 ? Math.min(Math.round((spent / budget) * 100), 100) : 0;
        
        let progressColor = "bg-purple-500";
        if (percent > 90) progressColor = "bg-rose-500";
        else if (percent > 75) progressColor = "bg-amber-500";

        return `
            <div class="bg-slate-900/60 border border-slate-700/80 hover:border-slate-600 rounded-xl p-4 transition-all duration-200">
                <!-- Encabezado Tarjeta -->
                <div class="flex items-center justify-between mb-3">
                    <div class="flex items-center space-x-2.5 truncate pr-2">
                        <div class="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
                            <i class="${cat.icon || 'fa-solid fa-folder'}"></i>
                        </div>
                        <span class="font-bold text-white text-sm truncate" title="${cat.name}">${cat.name}</span>
                    </div>

                    <div class="flex items-center space-x-2 shrink-0">
                        <span class="text-xs font-semibold text-slate-300">
                            ${formatMoney(spent)} / ${formatMoney(budget)}
                        </span>
                        <button onclick="deleteCategory('${cat.id}')" class="text-slate-500 hover:text-rose-400 p-1 transition" title="Eliminar">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </div>

                <!-- Barra de Progreso -->
                <div class="w-full bg-slate-800 rounded-full h-2 overflow-hidden mb-4 border border-slate-700/50">
                    <div class="${progressColor} h-full transition-all duration-300" style="width: ${percent}%"></div>
                </div>

                <!-- FORMULARIO DE CONSUMO RÁPIDO (+ Gastado y + Consumir) -->
                <form onsubmit="quickConsume(event, '${cat.id}', '${cat.name}')" class="flex items-center gap-2">
                    <div class="relative flex-1">
                        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-medium pointer-events-none">+</span>
                        <input 
                            type="number" 
                            step="0.01" 
                            min="0.01" 
                            required 
                            placeholder="Gastado" 
                            class="w-full bg-slate-800/90 border border-slate-700 text-white rounded-lg pl-6 pr-3 py-1.5 text-xs focus:ring-2 focus:ring-purple-500 outline-none transition"
                        >
                    </div>
                    <button 
                        type="submit" 
                        class="bg-purple-600 hover:bg-purple-500 active:scale-95 text-white font-semibold text-xs px-3 py-1.5 rounded-lg transition flex items-center justify-center gap-1 shrink-0"
                    >
                        <i class="fa-solid fa-plus text-[10px]"></i> Consumir
                    </button>
                </form>
            </div>
        `;
    }).join("");
}

// FUNCION DE CONSUMO RAPIDO
async function quickConsume(event, categoryId, categoryName) {
    event.preventDefault();

    const form = event.target;
    const input = form.querySelector('input');
    const amount = parseFloat(input.value);

    if (isNaN(amount) || amount <= 0) {
        showNotification("Ingresa un monto válido.", "error");
        return;
    }

    const user = await getCurrentUser();
    if (!user) {
        showNotification("Debes iniciar sesión para guardar.", "error");
        return;
    }

    // Fecha actual formateada YYYY-MM-DD
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const movementId = Date.now();

    // 1. Objeto de movimiento para Presupuesto.html
    const newMovement = {
        id: movementId,
        type: "expense",
        description: `Consumo en ${categoryName}`,
        amount: amount,
        date: todayStr,
        category: categoryName,
        categoryId: categoryId,
        note: "Registrado vía consumo rápido"
    };

    const monthData = getCurrentMonthData();
    if (!monthData.movements) monthData.movements = [];
    monthData.movements.push(newMovement);

    // 2. Obtener documento del usuario para sincronizar 'state' (Historial)
    const userRef = window.dbMethods.doc(window.db, "users", user.uid);
    let currentState = { logs: [], categories: [] };

    try {
        const docSnap = await window.dbMethods.getDoc(userRef);
        if (docSnap.exists() && docSnap.data().state) {
            currentState = docSnap.data().state;
        }

        if (!currentState.globalHistory) currentState.globalHistory = [];
        if (!currentState.categories) currentState.categories = [];

        // Actualizar gasto 'spent' en las categorías si existen
        const catIndex = currentState.categories.findIndex(c => c.id == categoryId || c.name === categoryName);
        if (catIndex !== -1) {
            currentState.categories[catIndex].spent = (Number(currentState.categories[catIndex].spent) || 0) + amount;
        }

        // 3. Crear el objeto exactamente como lo interpreta Historial.html / scrip.js
        const historyLog = {
            id: movementId,
            date: todayStr,
            type: "expense",               // Tipo: gasto
            desc: `Consumo en ${categoryName}`, // Descripción en la tabla
            category: categoryName,        // Columna Categoría / Origen
            amount: amount                 // Monto numérico
        };

        currentState.globalHistory.push(historyLog);

        // 4. Guardar en Firestore tanto budgetData como state
        await window.dbMethods.setDoc(
            userRef,
            { 
                budgetData: budgetData,
                state: currentState 
            },
            { merge: true }
        );

        // También guardar copia en localStorage como respaldo local
        localStorage.setItem("finflow_state", JSON.stringify(currentState));
        localStorage.setItem("finflow_budget_data", JSON.stringify(budgetData));

        input.value = "";
        renderEverything(); // Refresca vista actual
        showNotification(`${formatMoney(amount)} consumidos en ${categoryName}`, "success");

    } catch (error) {
        console.error("Error al registrar consumo rápido:", error);
        showNotification("No se pudo guardar el consumo.", "error");
    }
}

// GASTOS POR CATEGORÍA
function getCategorySpent(monthData, categoryId) {
    return monthData.movements
        .filter(
            movement =>
                movement.type === "expense" &&
                movement.categoryId === categoryId
        )
        .reduce(
            (sum, movement) => sum + Number(movement.amount || 0),
            0
        );
}


/* ============================================================
   MODAL CATEGORÍA
   ============================================================ */

function openCategoryModal(categoryId = null) {
    const modal = document.getElementById("categoryModal");
    const form = document.getElementById("categoryForm");

    form.reset();

    document.getElementById("categoryEditId").value = "";
    selectedCategoryIcon = "fa-solid fa-folder";
    document.getElementById("categoryIcon").value = selectedCategoryIcon;

    renderIconSelector();

    if (categoryId) {
        const monthData = getCurrentMonthData();
        const category = monthData.categories.find(c => c.id === categoryId);

        if (!category) return;

        document.getElementById("categoryModalTitle").textContent =
            "Editar Categoría";
        document.getElementById("categoryEditId").value = category.id;
        document.getElementById("categoryName").value = category.name;
        document.getElementById("categoryDescription").value =
            category.description || "";
        document.getElementById("categoryBudget").value = category.budget;
        selectedCategoryIcon = category.icon || "fa-solid fa-folder";
        document.getElementById("categoryIcon").value = selectedCategoryIcon;

        renderIconSelector();
    } else {
        document.getElementById("categoryModalTitle").textContent =
            "Nueva Categoría";
    }

    modal.classList.remove("hidden");
    modal.classList.add("flex");
}

function closeCategoryModal() {
    const modal = document.getElementById("categoryModal");
    modal.classList.add("hidden");
    modal.classList.remove("flex");
}


/* ============================================================
   GUARDAR CATEGORÍA
   ============================================================ */

async function saveCategory(event) {
    event.preventDefault();

    const user = await getCurrentUser();
    if (!user) {
        showNotification("Debes iniciar sesión para realizar cambios.", "error");
        return;
    }

    const name = document.getElementById("categoryName").value.trim();
    const description = document.getElementById("categoryDescription").value.trim();
    const budget = Number(document.getElementById("categoryBudget").value);
    const editId = document.getElementById("categoryEditId").value;

    if (!name || isNaN(budget) || budget < 0) {
        showNotification("Completa los datos correctamente.", "error");
        return;
    }

    const monthData = getCurrentMonthData();

    // 1. Cargar el estado global existente para no sobrescribir otras listas
    const userRef = window.dbMethods.doc(window.db, "users", user.uid);
    const docSnap = await window.dbMethods.getDoc(userRef);
    let currentState = docSnap.exists() && docSnap.data().state ? docSnap.data().state : { categories: [] };
    if (!currentState.categories) currentState.categories = [];

    if (editId) {
        // Actualizar en Presupuesto
        const category = monthData.categories.find(c => c.id === editId);
        if (category) {
            category.name = name;
            category.description = description;
            category.budget = budget;
            category.icon = selectedCategoryIcon;
        }
        
        // Actualizar en index (state.categories)
        const globalCat = currentState.categories.find(c => c.id == editId || c.name === name);
        if (globalCat) {
            globalCat.name = name;
            globalCat.limit = budget;
        }
    } else {
        const newId = Date.now();
        // Agregar a Presupuesto
        monthData.categories.push({
            id: newId,
            name,
            description,
            budget,
            icon: selectedCategoryIcon
        });

        // Agregar a index (state.categories)
        currentState.categories.push({
            id: newId,
            name: name,
            limit: budget,
            spent: 0,
            pendingLogs: []
        });
    }

    // 2. Guardar ambas estructuras en Firestore simultáneamente
    try {
        await window.dbMethods.setDoc(
            userRef,
            { 
                budgetData: budgetData,
                state: currentState 
            },
            { merge: true }
        );

        closeCategoryModal();
        renderEverything();
        showNotification(editId ? "Categoría actualizada." : "Categoría creada.", "success");
    } catch (error) {
        console.error(error);
        showNotification("No se pudo guardar la categoría.", "error");
    }
}


/* ============================================================
   EDITAR CATEGORÍA
   ============================================================ */

function editCategory(id) {
    openCategoryModal(id);
}


// ELIMINAR CATEGORIA
async function deleteCategory(id) {
    const user = await getCurrentUser();
    if (!user) return;

    const monthData = getCurrentMonthData();
    const category = monthData.categories.find(c => c.id === id);
    if (!category) return;

    if (!confirm(`¿Eliminar la categoría "${category.name}"?`)) return;

    // Eliminar de budgetData
    monthData.categories = monthData.categories.filter(c => c.id !== id);

    // Obtener estado actual y eliminar de state.categories
    const userRef = window.dbMethods.doc(window.db, "users", user.uid);
    const docSnap = await window.dbMethods.getDoc(userRef);
    let currentState = docSnap.exists() && docSnap.data().state ? docSnap.data().state : { categories: [] };
    
    if (currentState.categories) {
        currentState.categories = currentState.categories.filter(c => c.id != id && c.name !== category.name);
    }

    try {
        await window.dbMethods.setDoc(
            userRef,
            { budgetData: budgetData, state: currentState },
            { merge: true }
        );
        renderEverything();
        showNotification("Categoría eliminada.", "success");
    } catch (error) {
        console.error(error);
        showNotification("Error al eliminar.", "error");
    }
}


/* ============================================================
   ICONOS
   ============================================================ */

function renderIconSelector() {
    const container = document.getElementById("iconSelector");

    if (!container) return;

    container.innerHTML = "";

    DEFAULT_ICONS.forEach(icon => {
        const button = document.createElement("button");

        button.type = "button";
        button.className =
            "icon-option w-full aspect-square rounded-xl border border-slate-700 bg-slate-900 text-slate-400 flex items-center justify-center";

        if (icon === selectedCategoryIcon) {
            button.classList.add("selected");
        }

        button.innerHTML = `<i class="${icon}"></i>`;

        button.onclick = () => {
            selectedCategoryIcon = icon;
            document.getElementById("categoryIcon").value = icon;
            renderIconSelector();
        };

        container.appendChild(button);
    });
}


/* ============================================================
   MOVIMIENTOS
   ============================================================ */

function openMovementModal(type = "expense") {
    const modal = document.getElementById("movementModal");

    document.getElementById("movementForm").reset();
    document.getElementById("movementType").value = type;
    document.getElementById("movementDate").value = getDefaultDateForCurrentMonth();

    const title = document.getElementById("movementModalTitle");
    const subtitle = document.getElementById("movementModalSubtitle");
    const button = document.getElementById("movementSaveButton");
    const categoryWrapper = document.getElementById("movementCategoryWrapper");

    if (type === "income") {
        title.textContent = "Registrar Ingreso";
        subtitle.textContent = "Entrada de dinero";
        button.className =
            "flex-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl p-3 font-bold text-sm";
        categoryWrapper.classList.add("hidden");
    } else {
        title.textContent = "Registrar Gasto";
        subtitle.textContent = "Gasto del mes";
        button.className =
            "flex-1 bg-blue-600 hover:bg-blue-500 text-white rounded-xl p-3 font-bold text-sm";
        categoryWrapper.classList.remove("hidden");
        populateCategorySelect();
    }

    modal.classList.remove("hidden");
    modal.classList.add("flex");
}

function closeMovementModal() {
    const modal = document.getElementById("movementModal");
    modal.classList.add("hidden");
    modal.classList.remove("flex");
}


/* ============================================================
   CATEGORÍAS SELECT
   ============================================================ */

function populateCategorySelect() {
    const select = document.getElementById("movementCategory");
    const monthData = getCurrentMonthData();

    select.innerHTML = "";

    if (monthData.categories.length === 0) {
        const option = document.createElement("option");
        option.value = "";
        option.textContent = "Sin categorías — crea una primero";
        select.appendChild(option);
        return;
    }

    monthData.categories.forEach(category => {
        const option = document.createElement("option");
        option.value = category.id;
        option.textContent = category.name;
        select.appendChild(option);
    });
}


/* ============================================================
   GUARDAR MOVIMIENTO
   ============================================================ */

async function saveMovement(event) {
    event.preventDefault();

    const user = await getCurrentUser();
    if (!user) {
        showNotification("Debes iniciar sesión para realizar cambios.", "error");
        return;
    }

    const type = document.getElementById("movementType").value;
    const description = document.getElementById("movementDescription").value.trim();
    const amount = Number(document.getElementById("movementAmount").value);
    const date = document.getElementById("movementDate").value;
    const categoryId = document.getElementById("movementCategory").value;
    const note = document.getElementById("movementNote").value.trim();

    if (!description) {
        showNotification("Escribe una descripción.", "error");
        return;
    }

    if (!amount || amount <= 0) {
        showNotification("Introduce un monto válido.", "error");
        return;
    }

    if (!date) {
        showNotification("Selecciona una fecha.", "error");
        return;
    }

    if (type === "expense" && !categoryId) {
        showNotification("Selecciona una categoría para el gasto.", "error");
        return;
    }

    const monthData = getCurrentMonthData();

    monthData.movements.push({
        id: generateId(),
        type: type === "income" ? "income" : "expense",
        description,
        amount,
        date,
        categoryId: type === "income" ? "" : categoryId,
        note
    });

    try {
        await saveBudgetToFirestore();
        closeMovementModal();
        renderEverything();
        showNotification(
            type === "income" ? "Ingreso registrado." : "Gasto registrado.",
            "success"
        );
    } catch (error) {
        console.error(error);
        showNotification("No se pudo guardar el movimiento.", "error");
    }
}


/* ============================================================
   MOVIMIENTOS
   ============================================================ */

function renderMovements() {
    const container = document.getElementById("movementsContainer");

    if (!container) return;

    const monthData = getCurrentMonthData();
    const filter = document.getElementById("movementFilter")?.value || "all";

    let movements = [...monthData.movements];

    if (filter !== "all") {
        movements = movements.filter(movement => movement.type === filter);
    }

    movements.sort((a, b) => String(b.date).localeCompare(String(a.date)));

    container.innerHTML = "";

    if (movements.length === 0) {
        container.innerHTML = `
            <div class="text-center py-10">
                <i class="fa-solid fa-receipt text-3xl text-slate-600"></i>
                <p class="text-sm font-semibold text-slate-400 mt-3">
                    No hay movimientos registrados.
                </p>
                <p class="text-xs text-slate-500 mt-1">
                    Los ingresos y gastos que registres aparecerán aquí.
                </p>
            </div>
        `;
        return;
    }

    movements.forEach(movement => {
        const category = monthData.categories.find(
            c => c.id === movement.categoryId
        );

        const isIncome = movement.type === "income";

        const icon = isIncome
            ? "fa-solid fa-arrow-trend-up"
            : category
                ? category.icon
                : "fa-solid fa-receipt";

        const iconColor = isIncome ? "text-emerald-400" : "text-blue-400";
        const amountColor = isIncome ? "text-emerald-400" : "text-rose-400";
        const sign = isIncome ? "+" : "-";

        const row = document.createElement("div");

        row.className =
            "bg-slate-900/60 border border-slate-700 rounded-xl p-3 flex items-center gap-3";

        row.innerHTML = `
            <div class="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center shrink-0">
                <i class="${escapeHtml(icon)} ${iconColor}"></i>
            </div>

            <div class="flex-1 min-w-0">
                <p class="font-semibold text-sm text-white truncate">
                    ${escapeHtml(movement.description)}
                </p>

                <div class="flex flex-wrap items-center gap-2 mt-1">
                    <span class="text-[10px] text-slate-500">
                        ${formatDate(movement.date)}
                    </span>

                    ${
                        category
                            ? `
                                <span class="text-[10px] text-purple-300 bg-purple-500/10 border border-purple-500/10 rounded-full px-2 py-0.5">
                                    ${escapeHtml(category.name)}
                                </span>
                            `
                            : ""
                    }
                </div>

                ${
                    movement.note
                        ? `
                            <p class="text-[10px] text-slate-600 mt-1 truncate">
                                ${escapeHtml(movement.note)}
                            </p>
                        `
                        : ""
                }
            </div>

            <div class="text-right shrink-0">
                <p class="font-black ${amountColor}">
                    ${sign}${formatMoney(movement.amount)}
                </p>

                <button
                    onclick="deleteMovement('${movement.id}')"
                    class="text-[10px] text-slate-600 hover:text-rose-400 mt-1">
                    Eliminar
                </button>
            </div>
        `;

        container.appendChild(row);
    });
}


/* ============================================================
   ELIMINAR MOVIMIENTO
   ============================================================ */

async function deleteMovement(id) {
    const user = await getCurrentUser();
    if (!user) {
        showNotification("Debes iniciar sesión para realizar cambios.", "error");
        return;
    }

    const monthData = getCurrentMonthData();
    const movement = monthData.movements.find(m => m.id === id);

    if (!movement) return;

    if (!confirm(`¿Eliminar "${movement.description}"?`)) {
        return;
    }

    monthData.movements = monthData.movements.filter(m => m.id !== id);

    try {
        await saveBudgetToFirestore();
        renderEverything();
        showNotification("Movimiento eliminado.", "success");
    } catch (error) {
        console.error(error);
        showNotification("No se pudo eliminar el movimiento.", "error");
    }
}


/* ============================================================
   GRÁFICOS
   ============================================================ */

function renderCharts(monthData) {
    renderBudgetChart(monthData);
    renderComparisonChart(monthData);
}


/* ============================================================
   GRÁFICO PRESUPUESTO
   ============================================================ */

function renderBudgetChart(monthData) {
    const canvas = document.getElementById("budgetChart");

    if (!canvas) return;

    if (budgetChart) {
        budgetChart.destroy();
    }

    if (monthData.categories.length === 0) {
        return;
    }

    const labels = monthData.categories.map(category => category.name);
    const values = monthData.categories.map(
        category => Number(category.budget) || 0
    );

    budgetChart = new Chart(canvas, {
        type: "doughnut",
        data: {
            labels,
            datasets: [
                {
                    data: values,
                    backgroundColor: [
                        "#a855f7",
                        "#3b82f6",
                        "#10b981",
                        "#f59e0b",
                        "#ef4444",
                        "#06b6d4",
                        "#6366f1",
                        "#ec4899",
                        "#14b8a6",
                        "#f97316",
                        "#84cc16",
                        "#8b5cf6"
                    ],
                    borderWidth: 2,
                    borderColor: "#1e293b"
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: "bottom",
                    labels: {
                        color: "#cbd5e1",
                        padding: 14,
                        font: {
                            size: 10
                        }
                    }
                }
            },
            cutout: "65%"
        }
    });
}


/* ============================================================
   GRÁFICO COMPARACIÓN
   ============================================================ */

function renderComparisonChart(monthData) {
    const canvas = document.getElementById("comparisonChart");

    if (!canvas) return;

    if (comparisonChart) {
        comparisonChart.destroy();
    }

    if (monthData.categories.length === 0) {
        return;
    }

    const labels = monthData.categories.map(category => category.name);
    const budgets = monthData.categories.map(
        category => Number(category.budget) || 0
    );
    const spent = monthData.categories.map(category =>
        getCategorySpent(monthData, category.id)
    );

    comparisonChart = new Chart(canvas, {
        type: "bar",
        data: {
            labels,
            datasets: [
                {
                    label: "Presupuesto",
                    data: budgets,
                    backgroundColor: "rgba(168,85,247,.55)",
                    borderColor: "#a855f7",
                    borderWidth: 1
                },
                {
                    label: "Gastado",
                    data: spent,
                    backgroundColor: "rgba(59,130,246,.55)",
                    borderColor: "#3b82f6",
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    ticks: {
                        color: "#94a3b8",
                        font: {
                            size: 9
                        }
                    },
                    grid: {
                        color: "rgba(71,85,105,.25)"
                    }
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        color: "#94a3b8",
                        font: {
                            size: 9
                        },
                        callback: value => "$" + value
                    },
                    grid: {
                        color: "rgba(71,85,105,.25)"
                    }
                }
            },
            plugins: {
                legend: {
                    labels: {
                        color: "#cbd5e1",
                        font: {
                            size: 10
                        }
                    }
                }
            }
        }
    });
}


/* ============================================================
   RECOMENDACIONES
   ============================================================ */

function renderRecommendations(monthData) {
    const container = document.getElementById("recommendationsContainer");

    if (!container) return;

    container.innerHTML = "";

    const recommendations = [];
    const totals = calculateTotals(monthData);

    if (totals.totalBudget === 0 && monthData.categories.length > 0) {
        recommendations.push({
            icon: "fa-solid fa-circle-info",
            color: "text-blue-400",
            text: "Todavía no tienes presupuesto asignado. Define un monto para cada categoría."
        });
    }

    monthData.categories.forEach(category => {
        const spent = getCategorySpent(monthData, category.id);
        const budget = Number(category.budget) || 0;

        if (budget > 0 && spent > budget) {
            recommendations.push({
                icon: "fa-solid fa-triangle-exclamation",
                color: "text-rose-400",
                text: `${category.name} ha superado su presupuesto por ${formatMoney(spent - budget)}.`
            });
        } else if (budget > 0 && spent / budget >= 0.8) {
            recommendations.push({
                icon: "fa-solid fa-bell",
                color: "text-amber-400",
                text: `${category.name} ya utilizó el ${((spent / budget) * 100).toFixed(0)}% de su presupuesto.`
            });
        }
    });

    if (totals.totalIncome > 0 && totals.totalSpent > totals.totalIncome) {
        recommendations.push({
            icon: "fa-solid fa-arrow-trend-down",
            color: "text-rose-400",
            text: "Tus gastos superan tus ingresos registrados este mes."
        });
    }

    if (
        totals.totalIncome > 0 &&
        totals.totalSpent < totals.totalIncome * 0.7
    ) {
        recommendations.push({
            icon: "fa-solid fa-piggy-bank",
            color: "text-emerald-400",
            text: "Tu gasto está por debajo del 70% de tus ingresos registrados. Buen control financiero."
        });
    }

    if (recommendations.length === 0) {
        recommendations.push({
            icon: "fa-solid fa-check-circle",
            color: "text-emerald-400",
            text: "Todo parece estar bajo control. Continúa registrando tus movimientos para mantener una visión precisa."
        });
    }

    recommendations.slice(0, 6).forEach(item => {
        const element = document.createElement("div");

        element.className =
            "bg-slate-900/60 border border-slate-700 rounded-xl p-3 flex items-start gap-3";

        element.innerHTML = `
            <i class="${item.icon} ${item.color} mt-0.5"></i>
            <p class="text-xs text-slate-300 leading-relaxed">
                ${escapeHtml(item.text)}
            </p>
        `;

        container.appendChild(element);
    });
}


/* ============================================================
   SIDEBAR
   ============================================================ */

function toggleSidebar() {
    const sidebar = document.getElementById("sidebar");
    const backdrop = document.getElementById("sidebarBackdrop");
    const isClosed = sidebar.classList.contains("-translate-x-full");

    if (isClosed) {
        sidebar.classList.remove("-translate-x-full");
        backdrop.classList.remove("hidden");
        setTimeout(() => {
            backdrop.classList.remove("opacity-0");
        }, 10);
    } else {
        sidebar.classList.add("-translate-x-full");
        backdrop.classList.add("opacity-0");
        setTimeout(() => {
            backdrop.classList.add("hidden");
        }, 300);
    }
}


/* ============================================================
   LOGOUT
   ============================================================ */

async function logout() {
    if (!window.auth) return;

    try {
        await window.dbMethods.signOut(window.auth);
        window.location.href = "login.html";
    } catch (error) {
        console.error("Error cerrando sesión:", error);
        showNotification("No se pudo cerrar la sesión.", "error");
    }
}


/* ============================================================
   MODALES
   ============================================================ */

function setupModalClose() {
    document.getElementById("categoryModal")?.addEventListener("click", event => {
        if (event.target.id === "categoryModal") {
            closeCategoryModal();
        }
    });

    document.getElementById("movementModal")?.addEventListener("click", event => {
        if (event.target.id === "movementModal") {
            closeMovementModal();
        }
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape") {
            closeCategoryModal();
            closeMovementModal();
        }
    });
}


/* ============================================================
   FECHAS
   ============================================================ */

function setDefaultMovementDate() {
    const input = document.getElementById("movementDate");

    if (input) {
        input.value = getDefaultDateForCurrentMonth();
    }
}

function getDefaultDateForCurrentMonth() {
    const date = getTargetDate();
    const today = new Date();

    if (
        date.getFullYear() === today.getFullYear() &&
        date.getMonth() === today.getMonth()
    ) {
        return toDateInputValue(today);
    }

    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}


/* ============================================================
   UTILIDADES
   ============================================================ */

function generateId() {
    return (
        Date.now().toString(36) +
        Math.random().toString(36).substring(2, 8)
    );
}

function formatMoney(value) {
    const amount = Number(value) || 0;
    const currencyMap = { '$': 'USD', '€': 'EUR', 'Q': 'GTQ', '£': 'GBP' };

    return new Intl.NumberFormat("es-GT", {
        style: "currency",
        currency: currencyMap[appCurrency] || 'USD',
        minimumFractionDigits: 2
    }).format(amount);
}

function formatDate(dateString) {
    if (!dateString) return "---";

    const date = new Date(`${dateString}T12:00:00`);

    if (isNaN(date.getTime())) {
        return dateString;
    }

    return date.toLocaleDateString("es-GT", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
}

function toDateInputValue(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function setText(id, value) {
    const element = document.getElementById(id);

    if (element) {
        element.textContent = value;
    }
}


/* ============================================================
   ESCAPAR HTML
   ============================================================ */

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


/* ============================================================
   NOTIFICACIONES
   ============================================================ */

function showNotification(message, type = "success") {
    const existing = document.getElementById("budgetNotification");

    if (existing) {
        existing.remove();
    }

    const notification = document.createElement("div");
    notification.id = "budgetNotification";

    const icon =
        type === "success"
            ? "fa-circle-check"
            : "fa-circle-exclamation";

    const color =
        type === "success"
            ? "border-emerald-500/30 text-emerald-300"
            : "border-rose-500/30 text-rose-300";

    notification.className = `fixed bottom-4 right-4 left-4 sm:left-auto z-[200] max-w-sm bg-slate-800 border ${color} rounded-xl shadow-2xl px-4 py-3 flex items-center gap-3`;

    notification.innerHTML = `
        <i class="fa-solid ${icon}"></i>
        <p class="text-xs font-semibold">
            ${escapeHtml(message)}
        </p>
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.remove();
    }, 3500);
}