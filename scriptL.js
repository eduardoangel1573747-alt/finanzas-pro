// V2.1 + Firebase Integration
// scriptL.js - Manejo de Autenticación con Firebase Auth
let isRegisterMode = false;
// Redirigir a index.html si ya hay una sesión activa
function checkExistingAuth() {
    if (window.dbMethods && window.dbMethods.onAuthStateChanged && window.auth) {
        window.dbMethods.onAuthStateChanged(window.auth, (user) => {
            if (user && (window.location.pathname.includes('login.html') || window.location.pathname.endsWith('/') || window.location.pathname === '')) {
                window.location.href = 'index.html';
            }
        });
    }
}
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkExistingAuth);
} else {
    checkExistingAuth();
}
// Alternar interfaz entre Iniciar Sesión y Crear Cuenta
function toggleAuthMode() {
    isRegisterMode = !isRegisterMode;
    document.getElementById('loginForm')?.classList.toggle('hidden', isRegisterMode);
    document.getElementById('registerForm')?.classList.toggle('hidden', !isRegisterMode);
    
    const authTitle = document.getElementById('authTitle');
    if (authTitle) authTitle.innerText = isRegisterMode ? 'Crear Cuenta' : 'Iniciar Sesión';
    const toggleText = document.getElementById('toggleAuthText');
    if (toggleText) {
        toggleText.innerHTML = isRegisterMode 
            ? '¿Ya tienes una cuenta? <button onclick="toggleAuthMode()" class="text-emerald-400 font-semibold hover:underline ml-1">Ingresar</button>' 
            : '¿No tienes una cuenta? <button onclick="toggleAuthMode()" class="text-emerald-400 font-semibold hover:underline ml-1">Crear Cuenta</button>';
    }
}
// Iniciar sesión con Firebase
async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('loginUsername').value.trim().toLowerCase();
    const password = document.getElementById('loginPassword').value;
    const err = document.getElementById('loginError');
    const submitBtn = e.target.querySelector('button[type="submit"]');
    if (err) err.classList.add('hidden');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerText = 'Ingresando...';
    }
    try {
        const userSnapshot = await window.dbMethods.getDocs(
            window.dbMethods.query(
                window.dbMethods.collection(window.db),
                window.dbMethods.where('username', '==', username)
            )
        );
        if (userSnapshot.empty) throw { code: 'auth/user-not-found' };
        const profile = userSnapshot.docs[0].data();
        await window.dbMethods.signInWithEmailAndPassword(window.auth, profile.email, password);
        window.location.href = 'index.html';
    } catch (error) {
        if (err) {
            let msg = 'Usuario o contraseña incorrectos.';
            if (error.code === 'auth/user-not-found') msg = 'No existe ninguna cuenta con este usuario.';
            if (error.code === 'auth/wrong-password') msg = 'Contraseña incorrecta.';
            if (error.code === 'auth/invalid-credential') msg = 'Correo o contraseña incorrectos.';
            err.innerText = msg;
            err.classList.remove('hidden');
        }
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerText = 'Ingresar';
        }
    }
}
// Registrar usuario en Firebase Auth y crear su registro en Firestore
async function handleRegister(e) {
    e.preventDefault();
    const firstName = document.getElementById('regFirstName')?.value.trim() || '';
    const lastName = document.getElementById('regLastName')?.value.trim() || '';
    const username = document.getElementById('regUsername').value.trim().toLowerCase();
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value;
    const err = document.getElementById('registerError');
    const submitBtn = e.target.querySelector('button[type="submit"]');
    if (err) err.classList.add('hidden');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerText = 'Creando cuenta...';
    }
    try {
        const existingUser = await window.dbMethods.getDocs(
            window.dbMethods.query(
                window.dbMethods.collection(window.db),
                window.dbMethods.where('username', '==', username)
            )
        );
        if (!existingUser.empty) {
            if (err) {
                err.innerText = 'Este usuario ya está registrado.';
                err.classList.remove('hidden');
            }
            return;
        }
        // 1. Crear usuario en Firebase Authentication
        const userCredential = await window.dbMethods.createUserWithEmailAndPassword(window.auth, email, password);
        const user = userCredential.user;
        // 2. Crear documento de estado inicial en Cloud Firestore
        const defaultState = {
            transactions: [],
            incomes: [],
            categories: [],
            savingsBoxes: [],
            debts: [],
            receivables: [],
            globalHistory: []
        };
        const userDocRef = window.dbMethods.doc(window.db, "users", user.uid);
        await window.dbMethods.setDoc(userDocRef, {
            username: username,
            firstName: firstName,
            lastName: lastName,
            email: email,
            state: defaultState
        });
        window.location.href = 'index.html';
    } catch (error) {
        if (err) {
            let msg = 'Error al registrar: ' + error.message;
            if (error.code === 'auth/email-already-in-use') msg = 'Este correo ya está registrado.';
            if (error.code === 'auth/weak-password') msg = 'La contraseña debe tener al menos 6 caracteres.';
            err.innerText = msg;
            err.classList.remove('hidden');
        } else {
            alert('Error al registrar: ' + error.message);
        }
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerText = 'Crear Cuenta';
        }
    }
}
// Recuperar contraseña enviando correo oficial desde Firebase
async function handleForgotPassword(e) {
    e.preventDefault();
    const email = document.getElementById('forgotSearchInput').value.trim();
    const err = document.getElementById('forgotError');
    const submitBtn = e.target.querySelector('button[type="submit"]');
    if (err) err.classList.add('hidden');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerText = 'Enviando...';
    }
    try {
        await window.dbMethods.sendPasswordResetEmail(window.auth, email);
        alert('Se ha enviado un enlace de recuperación a tu correo electrónico.');
        cancelForgot();
    } catch (error) {
        if (err) {
            err.innerText = 'Error al enviar correo: ' + error.message;
            err.classList.remove('hidden');
        } else {
            alert('Error al enviar correo: ' + error.message);
        }
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerText = 'Enviar Enlace de Recuperación';
        }
    }
}
function showForgotPasswordStep1() {
    document.getElementById('loginForm')?.classList.add('hidden');
    document.getElementById('forgotForm')?.classList.remove('hidden');
}
function cancelForgot() {
    document.getElementById('forgotForm')?.classList.add('hidden');
    document.getElementById('loginForm')?.classList.remove('hidden');
}
