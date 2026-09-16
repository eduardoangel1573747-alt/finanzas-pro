// V1.0
let currentPeriodOffset = 0;
let dailyExpensesLoaded = false;
let dailyExpensesLoading = false;

window.addEventListener('finances-settings-changed', event => {
    if (event.detail?.currency) window.currencySymbol = event.detail.currency;
    renderDailyView();
});

// ============================================================
// UTILIDADES
// ============================================================

function ensureDailyState() {
    if (!window.state || typeof window.state !== 'object') {
        window.state = {};
    }

    if (!Array.isArray(window.state.transactions)) {
        window.state.transactions = [];
    }

    return window.state;
}

function normalizeDailyTransactions(transactions) {
    if (!Array.isArray(transactions)) {
        return [];
    }

    return transactions
        .filter(t => t && typeof t === 'object')
        .map(t => ({
            ...t,
            amount: Number(t.amount) || 0
        }));
}


// ============================================================
// INICIALIZACIÓN
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
    const dateInput = document.getElementById('expenseDate');
    if (dateInput) {
        // CORRECCIÓN: Obtener la fecha local correctamente (evita saltos de día por zona horaria)
        const now = new Date();
        const localDate = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
        dateInput.value = localDate;
    }

    // Cargar información desde Firestore
    await initializeDailyExpenses();
});


// ============================================================
// CARGAR DATOS DESDE FIRESTORE
// ============================================================
async function initializeDailyExpenses() {

    if (dailyExpensesLoaded || dailyExpensesLoading) {
        renderDailyView();
        return;
    }

    dailyExpensesLoading = true;

    try {

        // Esperar a que Firebase esté disponible
        await waitForFirebase();

        if (
            !window.auth ||
            !window.db ||
            !window.dbMethods
        ) {
            console.warn(
                'Firebase todavía no está disponible.'
            );

            ensureDailyState();
            renderDailyView();

            return;
        }

        // Esperar usuario autenticado
        const user = await waitForAuthenticatedUser();

        if (!user) {

            console.warn(
                'No hay usuario autenticado para cargar los gastos.'
            );

            window.location.href = '../login.html';

            ensureDailyState();
            renderDailyView();

            return;
        }

        console.log(
            'Usuario autenticado:',
            user.uid
        );

        // Referencia al documento del usuario
        const userDocRef =
            window.dbMethods.doc(
                window.db,
                "users",
                user.uid
            );

        // Obtener documento
        const snapshot =
            await window.dbMethods.getDoc(
                userDocRef
            );

        if (snapshot.exists()) {

            const firestoreData =
                snapshot.data();

            console.log(
                'Datos recuperados desde Firestore:',
                firestoreData
            );

            if (
                firestoreData &&
                firestoreData.state
            ) {

                const currentState =
                    ensureDailyState();

                const firestoreState =
                    firestoreData.state;

                /*
                 * IMPORTANTE:
                 * Fusionamos el estado existente con
                 * el estado recuperado.
                 *
                 * Así no eliminamos otras propiedades
                 * utilizadas por scrip.js.
                 */

                Object.assign(currentState, firestoreState);
                window.state = currentState;

                // Recuperar transacciones
                window.state.transactions =
                    normalizeDailyTransactions(
                        firestoreState.transactions
                    );

                console.log(
                    'Transacciones recuperadas:',
                    window.state.transactions
                );

            } else {

                ensureDailyState();

            }

        } else {

            console.log(
                'El documento del usuario todavía no existe.'
            );

            ensureDailyState();
        }

        dailyExpensesLoaded = true;

        // Dibujar nuevamente la interfaz
        renderDailyView();

    } catch (error) {

        console.error(
            'Error al recuperar los gastos desde Firestore:',
            error
        );

        ensureDailyState();

        renderDailyView();

    } finally {

        dailyExpensesLoading = false;
    }
}


// ============================================================
// ESPERAR A FIREBASE
// ============================================================

function waitForFirebase(timeout = 10000) {

    return new Promise((resolve) => {

        const start = Date.now();

        const check = () => {

            if (
                window.auth &&
                window.db &&
                window.dbMethods &&
                typeof window.dbMethods.doc === 'function' &&
                typeof window.dbMethods.getDoc === 'function'
            ) {

                resolve(true);

                return;
            }

            if (
                Date.now() - start >= timeout
            ) {

                console.warn(
                    'Tiempo de espera agotado esperando Firebase.'
                );

                resolve(false);

                return;
            }

            setTimeout(check, 100);

        };

        check();

    });
}


// ============================================================
// ESPERAR USUARIO AUTENTICADO
// ============================================================

function waitForAuthenticatedUser(timeout = 10000) {

    return new Promise((resolve) => {

        if (!window.auth) {
            resolve(null);
            return;
        }

        // Si ya existe usuario, utilizarlo inmediatamente
        if (window.auth.currentUser) {

            resolve(
                window.auth.currentUser
            );

            return;
        }

        let finished = false;
        let unsubscribe = null;

        const finish = (user) => {

            if (finished) {
                return;
            }

            finished = true;

            if (
                typeof unsubscribe === 'function'
            ) {
                unsubscribe();
            }

            resolve(user || null);
        };

        if (
            window.dbMethods &&
            typeof window.dbMethods.onAuthStateChanged === 'function'
        ) {

            unsubscribe =
                window.dbMethods.onAuthStateChanged(
                    window.auth,
                    (user) => {

                        finish(user);

                    }
                );

        } else {

            finish(null);

            return;
        }

        setTimeout(() => {

            finish(
                window.auth.currentUser
            );

        }, timeout);

    });
}


// ============================================================
// RENDER GLOBAL
// ============================================================

const originalRender = window.render;

window.render = function () {

    if (
        typeof originalRender === 'function'
    ) {

        originalRender();

    }

    if (dailyExpensesLoaded) {

        renderDailyView();

    }

};


// ============================================================
// GUARDAR NUEVO GASTO
// ============================================================

async function saveDailyExpenseToFirestore(event) {

    event.preventDefault();

    const btn =
        document.getElementById(
            'btnSaveExpense'
        );

    const descInput =
        document.getElementById(
            'expenseDesc'
        );

    const amountInput =
        document.getElementById(
            'expenseAmount'
        );

    const dateInput =
        document.getElementById(
            'expenseDate'
        );

    const desc =
        descInput
            ? descInput.value.trim()
            : '';

    const amount =
        amountInput
            ? parseFloat(amountInput.value)
            : NaN;

    const date =
        dateInput
            ? dateInput.value
            : '';


    // Validar datos
    if (
        !desc ||
        isNaN(amount) ||
        amount <= 0 ||
        !date
    ) {

        alert(
            'Por favor completa todos los campos con datos válidos.'
        );

        return;
    }


    try {

        if (btn) {

            btn.disabled = true;

            btn.innerHTML =
                `<i class="fa-solid fa-spinner fa-spin"></i> Guardando...`;

        }


        await waitForFirebase();


        const user =
            window.auth
                ? window.auth.currentUser
                : null;


        if (!user) {

            alert(
                'No hay una sesión activa. Inicia sesión nuevamente.'
            );

            return;
        }


        // Asegurar estructura
        ensureDailyState();


        // Crear nuevo movimiento
        const newTransaction = {

            id: Date.now().toString(),

            desc: desc,

            amount: amount,

            type: 'expense',

            category: 'Gastos Diarios',

            date: date

        };


        // Agregar al estado local
        window.state.transactions.push(
            newTransaction
        );

        if (typeof logGlobalHistory === 'function') {
            logGlobalHistory('expense', desc, amount, date, 'Gastos Diarios');
        }


        console.log(
            'Guardando transacción:',
            newTransaction
        );


        // Documento del usuario
        const userDocRef =
            window.dbMethods.doc(
                window.db,
                "users",
                user.uid
            );


        // Guardar en Firestore
        await window.dbMethods.setDoc(

            userDocRef,

            {
                state: window.state
            },

            {
                merge: true
            }

        );


        console.log(
            'Estado guardado correctamente en Firestore.'
        );


        dailyExpensesLoaded = true;


        // Limpiar formulario
        if (descInput) {
            descInput.value = '';
        }

        if (amountInput) {
            amountInput.value = '';
        }


        // Actualizar interfaz
        renderDailyView();


        alert(
            '¡Gasto guardado en Firestore exitosamente!'
        );


    } catch (error) {

        console.error(
            'Error al guardar en Firestore:',
            error
        );


        alert(
            'Ocurrió un error al guardar en la base de datos: ' +
            error.message
        );


    } finally {

        if (btn) {

            btn.disabled = false;

            btn.innerHTML =
                `<i class="fa-solid fa-floppy-disk"></i> Guardar`;

        }

    }

}


// ============================================================
// CAMBIAR PERÍODO
// ============================================================

function shiftDailyPeriod(offset) {

    currentPeriodOffset += offset;

    renderDailyView();

}


// ============================================================
// RENDERIZAR VISTA DIARIA
// ============================================================

function renderDailyView() {

    if (
        !window.state ||
        !Array.isArray(
            window.state.transactions
        )
    ) {

        return;

    }


    const now = new Date();


    const targetMonth =
        new Date(
            now.getFullYear(),
            now.getMonth() +
            currentPeriodOffset,
            1
        );


    const year =
        targetMonth.getFullYear();

    const month =
        targetMonth.getMonth();


    const monthNames = [

        "Ene",
        "Feb",
        "Mar",
        "Abr",
        "May",
        "Jun",
        "Jul",
        "Ago",
        "Sept",
        "Oct",
        "Nov",
        "Dic"

    ];


    const fullMonthNames = [

        "Enero",
        "Febrero",
        "Marzo",
        "Abril",
        "Mayo",
        "Junio",
        "Julio",
        "Agosto",
        "Septiembre",
        "Octubre",
        "Noviembre",
        "Diciembre"

    ];


    const daysInMonth =
        new Date(
            year,
            month + 1,
            0
        ).getDate();


    const firstDayIndex =
        new Date(
            year,
            month,
            1
        ).getDay();


    // Texto del período
    const dateRangeElement =
        document.getElementById(
            'dailyDateRangeText'
        );


    const periodHeader =
        document.getElementById(
            'calendarPeriodHeader'
        );


    if (dateRangeElement) {

        dateRangeElement.innerText =
            `1 ${monthNames[month].toUpperCase()} - ` +
            `${daysInMonth} ${monthNames[month].toUpperCase()}`;

    }


    if (periodHeader) {

        periodHeader.innerText =
            `${fullMonthNames[month]} ${year}`;

    }


    // ========================================================
    // CALCULAR TOTALES
    // ========================================================

    const dailyTotals = {};

    let periodSpent = 0;


    window.state.transactions.forEach(
        (t) => {

            if (
                t &&
                t.type === 'expense' &&
                t.date
            ) {

                const dateParts =
                    String(t.date)
                        .split('-')
                        .map(Number);


                if (
                    dateParts.length !== 3
                ) {

                    return;

                }


                const [
                    tYear,
                    tMonth,
                    tDay
                ] = dateParts;


                if (
                    tYear === year &&
                    (tMonth - 1) === month
                ) {

                    const amount =
                        Number(t.amount) || 0;


                    dailyTotals[tDay] =
                        (
                            dailyTotals[tDay] || 0
                        ) + amount;


                    periodSpent += amount;

                }

            }

        }
    );


    // Total del período
    const totalElement =
        document.getElementById(
            'periodTotalSpent'
        );


    if (totalElement) {

        totalElement.innerText =
            `${window.currencySymbol || '$'}${periodSpent.toFixed(2)}`;

    }


    // ========================================================
    // CALENDARIO
    // ========================================================

    const grid =
        document.getElementById(
            'dailyGrid'
        );


    if (!grid) {

        return;

    }


    grid.innerHTML = '';


    // Espacios antes del primer día
    for (
        let i = 0;
        i < firstDayIndex;
        i++
    ) {

        grid.innerHTML +=
            `<div class="p-2"></div>`;

    }


    // Días
    for (
        let day = 1;
        day <= daysInMonth;
        day++
    ) {

        const spent =
            dailyTotals[day] || 0;


        const isSelected =
            spent > 0;


        const cellBg =
            isSelected

                ? 'bg-purple-600/30 border-purple-500/50 text-white'

                : 'bg-slate-900/50 border-slate-700/50 text-slate-400';


        grid.innerHTML += `

            <button

                onclick="selectDayDetails(${year}, ${month}, ${day})"

                class="
                    flex
                    flex-col
                    items-center
                    justify-center
                    p-2
                    rounded-xl
                    border
                    ${cellBg}
                    hover:border-purple-400
                    transition
                    cursor-pointer
                    aspect-square
                "

            >

                <span class="text-xs font-bold">
                    ${day}
                </span>

                <span class="
                    text-[10px]
                    ${
                        spent > 0
                            ? 'text-purple-300 font-bold'
                            : 'text-slate-500'
                    }
                ">

                    ${window.currencySymbol || '$'}${spent.toFixed(0)}

                </span>

            </button>

        `;

    }


    // Dibujar gráfico
    drawDailyChart(
        daysInMonth,
        dailyTotals
    );

}


// ============================================================
// DETALLE DEL DÍA
// ============================================================

function selectDayDetails(
    year,
    month,
    day
) {

    const formattedDate =
        `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;


    const listContainer =
        document.getElementById(
            'selectedDayList'
        );


    const titleElement =
        document.getElementById(
            'selectedDayTitle'
        );


    if (titleElement) {

        titleElement.innerText =
            `Movimientos del ${day}/${month + 1}/${year}`;

    }


    if (!listContainer) {

        return;

    }


    if (
        !window.state ||
        !Array.isArray(
            window.state.transactions
        )
    ) {

        listContainer.innerHTML =
            `
            <p class="text-xs text-slate-500 italic">
                Sin registros de gastos en esta fecha.
            </p>
            `;

        return;

    }


    const dayExpenses =
        window.state.transactions.filter(

            (t) =>

                t &&
                t.type === 'expense' &&
                t.date === formattedDate

        );


    if (
        dayExpenses.length === 0
    ) {

        listContainer.innerHTML =
            `
            <p class="text-xs text-slate-500 italic">
                Sin registros de gastos en esta fecha.
            </p>
            `;

        return;

    }


    listContainer.innerHTML =

        dayExpenses

            .map(
                (t) => `

                    <div
                        class="
                            bg-slate-700/60
                            p-3
                            rounded-xl
                            border
                            border-slate-600
                            flex
                            justify-between
                            items-center
                            text-xs
                        "
                    >

                        <div>

                            <p class="font-bold text-white">
                                ${escapeDailyHtml(t.desc)}
                            </p>

                            <p class="text-slate-400 text-[10px]">
                                ${escapeDailyHtml(
                                    t.category || 'General'
                                )}
                            </p>

                        </div>

                        <span
                            class="
                                text-rose-400
                                font-bold
                                text-sm
                            "
                        >

                            -${window.currencySymbol || '$'}${(
                                Number(t.amount) || 0
                            ).toFixed(2)}

                        </span>

                    </div>

                `
            )

            .join('');

}


// ============================================================
// PROTECCIÓN HTML
// ============================================================

function escapeDailyHtml(value) {

    return String(
        value ?? ''
    )

        .replace(
            /&/g,
            '&amp;'
        )

        .replace(
            /</g,
            '&lt;'
        )

        .replace(
            />/g,
            '&gt;'
        )

        .replace(
            /"/g,
            '&quot;'
        )

        .replace(
            /'/g,
            '&#039;'
        );

}


// ============================================================
// GRÁFICO
// ============================================================

function drawDailyChart(
    daysInMonth,
    dailyTotals
) {

    const canvas =
        document.getElementById(
            'dailyExpenseCanvas'
        );


    if (!canvas) {

        return;

    }


    const parent =
        canvas.parentElement;


    if (!parent) {

        return;

    }


    const ctx =
        canvas.getContext('2d');


    if (!ctx) {

        return;

    }


    canvas.width =
        parent.clientWidth;


    canvas.height =
        parent.clientHeight;


    const w =
        canvas.width;


    const h =
        canvas.height;


    if (
        w <= 0 ||
        h <= 0
    ) {

        return;

    }


    ctx.clearRect(
        0,
        0,
        w,
        h
    );


    let cumulative = 0;

    const points = [];

    const avgPoints = [];


    for (
        let i = 1;
        i <= daysInMonth;
        i++
    ) {

        cumulative +=
            Number(
                dailyTotals[i] || 0
            );


        points.push(
            cumulative
        );


        avgPoints.push(
            (
                cumulative / i
            ) *
            (
                i * 0.85
            )
        );

    }


    const maxVal =
        Math.max(
            ...points,
            100
        );


    // ========================================================
    // LÍNEA DE MEDIA
    // ========================================================

    ctx.beginPath();

    ctx.setLineDash(
        [4, 4]
    );

    ctx.strokeStyle =
        '#94a3b8';

    ctx.lineWidth = 2;


    for (
        let i = 0;
        i < daysInMonth;
        i++
    ) {

        const x =

            daysInMonth === 1

                ? w / 2

                : (
                    i /
                    (
                        daysInMonth - 1
                    )
                ) * w;


        const y =

            h -

            (
                avgPoints[i] /
                maxVal
            ) *
            (
                h - 20
            ) -

            10;


        if (i === 0) {

            ctx.moveTo(
                x,
                y
            );

        } else {

            ctx.lineTo(
                x,
                y
            );

        }

    }


    ctx.stroke();


    // ========================================================
    // LÍNEA DEL PERÍODO
    // ========================================================

    ctx.beginPath();

    ctx.setLineDash(
        []
    );

    ctx.strokeStyle =
        '#a855f7';

    ctx.lineWidth = 3;


    for (
        let i = 0;
        i < daysInMonth;
        i++
    ) {

        const x =

            daysInMonth === 1

                ? w / 2

                : (
                    i /
                    (
                        daysInMonth - 1
                    )
                ) * w;


        const y =

            h -

            (
                points[i] /
                maxVal
            ) *
            (
                h - 20
            ) -

            10;


        if (i === 0) {

            ctx.moveTo(
                x,
                y
            );

        } else {

            ctx.lineTo(
                x,
                y
            );

        }

    }


    ctx.stroke();

}


// ============================================================
// HACER FUNCIONES DISPONIBLES PARA EL HTML
// ============================================================

window.saveDailyExpenseToFirestore =
    saveDailyExpenseToFirestore;

window.shiftDailyPeriod =
    shiftDailyPeriod;

window.selectDayDetails =
    selectDayDetails;

window.renderDailyView =
    renderDailyView;

window.initializeDailyExpenses =
    initializeDailyExpenses;