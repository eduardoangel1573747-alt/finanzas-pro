        // V1.0
        const usersDB = JSON.parse(localStorage.getItem('finances_users_db')) || {};
        const securityQuestionsMap = { mascota: "¿Cuál es el nombre de tu primera mascota?", ciudad: "¿En qué ciudad naciste?", colegio: "¿Cuál es el nombre de tu primera escuela?", comida: "¿Cuál es tu comida favorita?" };
        let isRegisterMode = false;

        // Redirigir si ya está logueado
        if(localStorage.getItem('finances_session_user')) window.location.href = 'index.html';

        function toggleAuthMode() {
            isRegisterMode = !isRegisterMode;
            document.getElementById('loginForm').classList.toggle('hidden', isRegisterMode);
            document.getElementById('registerForm').classList.toggle('hidden', !isRegisterMode);
            document.getElementById('authTitle').innerText = isRegisterMode ? 'Crear Cuenta' : 'Iniciar Sesión';
            document.getElementById('toggleAuthText').innerHTML = isRegisterMode ? '¿Ya tienes una cuenta? <button onclick="toggleAuthMode()" class="text-emerald-400 font-semibold hover:underline ml-1">Ingresar</button>' : '¿No tienes una cuenta? <button onclick="toggleAuthMode()" class="text-emerald-400 font-semibold hover:underline ml-1">Crear Cuenta</button>';
        }

        function handleLogin(e) {
            e.preventDefault();
            const inputVal = document.getElementById('loginUsername').value.trim().toLowerCase();
            const password = document.getElementById('loginPassword').value;
            let foundKey = Object.keys(usersDB).find(u => u === inputVal || usersDB[u].email === inputVal);
            if (!foundKey || usersDB[foundKey].password !== password) {
                const err = document.getElementById('loginError');
                err.innerText = 'Usuario o contraseña incorrectos.';
                err.classList.remove('hidden');
                return;
            }
            localStorage.setItem('finances_session_user', foundKey);
            window.location.href = 'index.html';
        }

        function handleRegister(e) {
            e.preventDefault();
            const username = document.getElementById('regUsername').value.trim().toLowerCase();
            const email = document.getElementById('regEmail').value.trim().toLowerCase();
            
            const usersDB = JSON.parse(localStorage.getItem('finances_users_db')) || {};

            if (usersDB[username] || Object.values(usersDB).some(u => u.email === email)) {
                alert('El usuario o correo ya existe.'); 
                return;
            }

            usersDB[username] = {
                firstName: document.getElementById('regFirstName').value,
                lastName: document.getElementById('regLastName').value,
                email: email,
                password: document.getElementById('regPassword').value,
                securityQuestion: document.getElementById('regSecurityQuestion').value,
                securityAnswer: document.getElementById('regSecurityAnswer').value.trim().toLowerCase(),
                state: { 
                    transactions: [], 
                    incomes: [], 
                    categories: [], 
                    savingsBoxes: [], 
                    debts: [], 
                    receivables: [],
                    globalHistory: [] 
                }
            };

            localStorage.setItem('finances_users_db', JSON.stringify(usersDB));
            alert('¡Cuenta creada! Ya puedes iniciar sesión.');
            location.reload();
        }

        function showForgotPasswordStep1() {
            document.getElementById('loginForm').classList.add('hidden');
            document.getElementById('forgotForm').classList.remove('hidden');
        }

        function cancelForgot() {
            document.getElementById('forgotForm').classList.add('hidden');
            document.getElementById('loginForm').classList.remove('hidden');
        }

        function verifyUserForRecovery() {
            const searchVal = document.getElementById('forgotSearchInput').value.trim().toLowerCase();
            let foundKey = Object.keys(usersDB).find(u => u === searchVal || usersDB[u].email === searchVal);
            if (!foundKey) { alert('Cuenta no encontrada.'); return; }
            document.getElementById('recoveryTargetUser').value = foundKey;
            document.getElementById('forgotQuestionLabel').innerText = securityQuestionsMap[usersDB[foundKey].securityQuestion];
            document.getElementById('forgotStep1').classList.add('hidden');
            document.getElementById('forgotStep2').classList.remove('hidden');
        }

        function handleForgotPassword(e) {
            e.preventDefault();
            const key = document.getElementById('recoveryTargetUser').value;
            if (usersDB[key].securityAnswer === document.getElementById('forgotAnswerInput').value.trim().toLowerCase()) {
                usersDB[key].password = document.getElementById('forgotNewPassword').value;
                localStorage.setItem('finances_users_db', JSON.stringify(usersDB));
                alert('Contraseña actualizada.');
                location.reload();
            } else { alert('Respuesta incorrecta.'); }
        }