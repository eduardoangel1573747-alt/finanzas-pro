(function () {
    const SETTINGS_KEYS = {
        language: 'finances_lang',
        currency: 'finances_currency'
    };

    const allowedCurrencies = new Set(['$', '€', 'Q', '£']);
    const allowedLanguages = new Set(['es', 'en']);
    const translations = {
        'Dashboard Principal': 'Main Dashboard',
        'Presupuesto Mes a Mes': 'Monthly Budget',
        'Vistas de Gastos Diariamente': 'Daily Expenses',
        'Objetivos de Ahorro': 'Savings Goals',
        'Carteras & Cuentas': 'Wallets & Accounts',
        'Historial Mes a Mes': 'Monthly History',
        'Historial': 'History',
        'Configuración': 'Settings',
        'Idioma / Language': 'Language',
        'Moneda / Currency': 'Currency',
        'Aceptar y cerrar': 'Apply and close',
        'Cerrar Sesión': 'Log out',
        'Módulos': 'Modules',
        'Presupuesto seleccionado': 'Selected budget',
        'Ingresos': 'Income',
        'Presupuesto': 'Budget',
        'Gastado': 'Spent',
        'Disponible': 'Available',
        'Balance': 'Balance',
        'Nueva Categoría': 'New Category',
        'Registrar Gasto': 'Log Expense',
        'Registrar Ingreso': 'Log Income',
        'Mis Categorías': 'My Categories',
        'Movimientos del mes': 'Monthly movements',
        'Recomendaciones': 'Recommendations'
    };

    function applyBasicTranslations(language) {
        const reverseTranslations = Object.fromEntries(
            Object.entries(translations).map(([spanish, english]) => [english, spanish])
        );
        const dictionary = language === 'en' ? translations : reverseTranslations;
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        const nodes = [];
        while (walker.nextNode()) nodes.push(walker.currentNode);
        nodes.forEach(node => {
            const text = node.nodeValue.trim();
            if (!text || !dictionary[text]) return;
            node.nodeValue = node.nodeValue.replace(text, dictionary[text]);
        });
    }

    function getSettings() {
        const language = localStorage.getItem(SETTINGS_KEYS.language);
        const currency = localStorage.getItem(SETTINGS_KEYS.currency);
        return {
            language: allowedLanguages.has(language) ? language : 'es',
            currency: allowedCurrencies.has(currency) ? currency : '$'
        };
    }

    function applySettingsControls() {
        const settings = getSettings();
        const languageSelect = document.getElementById('settingLanguage') || document.getElementById('langSelect');
        const currencySelect = document.getElementById('settingCurrency') || document.getElementById('currencySelect');
        if (languageSelect) languageSelect.value = settings.language;
        if (currencySelect) currencySelect.value = settings.currency;
        document.documentElement.lang = settings.language;
        window.currencySymbol = settings.currency;
        window.currentLang = settings.language;
        applyBasicTranslations(settings.language);
    }

    function ensureSettingsModal() {
        if (document.getElementById('settingsModal')) return;
        const modal = document.createElement('div');
        modal.id = 'settingsModal';
        modal.className = 'hidden fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[100]';
        modal.innerHTML = `
            <div class="bg-slate-800 border border-slate-700 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
                <div class="flex justify-between items-center border-b border-slate-700 pb-3">
                    <h3 class="font-bold text-slate-100 flex items-center gap-2"><i class="fa-solid fa-gear text-emerald-400"></i> Configuración</h3>
                    <button type="button" onclick="closeSettingsModal()" class="text-slate-400 hover:text-white p-1" aria-label="Cerrar configuración"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div class="space-y-3">
                    <div>
                        <label for="settingLanguage" class="block text-xs font-semibold text-slate-400 mb-1">Idioma / Language</label>
                        <select id="settingLanguage" onchange="changeLanguage(this.value)" class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200">
                            <option value="es">Español</option>
                            <option value="en">English</option>
                        </select>
                    </div>
                    <div>
                        <label for="settingCurrency" class="block text-xs font-semibold text-slate-400 mb-1">Moneda / Currency</label>
                        <select id="settingCurrency" onchange="changeCurrency(this.value)" class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200">
                            <option value="$">USD / Peso ($)</option>
                            <option value="€">Euro (€)</option>
                            <option value="Q">Quetzal (Q)</option>
                            <option value="£">Libra (£)</option>
                        </select>
                    </div>
                </div>
                <button type="button" onclick="closeSettingsModal()" class="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2 rounded-lg">Aceptar y cerrar</button>
            </div>`;
        document.body.appendChild(modal);
    }

    function notifySettingsChanged() {
        applySettingsControls();
        window.dispatchEvent(new CustomEvent('finances-settings-changed', {
            detail: getSettings()
        }));
    }

    window.getFinancesSettings = getSettings;
    window.openSettingsModal = function () {
        ensureSettingsModal();
        applySettingsControls();
        document.getElementById('settingsModal')?.classList.remove('hidden');
    };
    window.closeSettingsModal = function () {
        document.getElementById('settingsModal')?.classList.add('hidden');
    };
    window.changeLanguage = function (language) {
        if (!allowedLanguages.has(language)) return;
        localStorage.setItem(SETTINGS_KEYS.language, language);
        notifySettingsChanged();
    };
    window.changeCurrency = function (currency) {
        if (!allowedCurrencies.has(currency)) return;
        localStorage.setItem(SETTINGS_KEYS.currency, currency);
        notifySettingsChanged();
    };

    window.addEventListener('storage', event => {
        if (event.key === SETTINGS_KEYS.language || event.key === SETTINGS_KEYS.currency) {
            notifySettingsChanged();
        }
    });

    window.addEventListener('DOMContentLoaded', () => {
        ensureSettingsModal();
        applySettingsControls();
    });
    if (document.body) {
        ensureSettingsModal();
        applySettingsControls();
    }
}());
