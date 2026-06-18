import { auth, db } from './firebase-config.js';
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

import {
    collection,
    addDoc,
    getDocs,
    doc,
    updateDoc,
    deleteDoc,
    query,
    orderBy,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const PARROQUIAS = ["Olmedo", "Ayora", "Tupigachi", "Tabacundo", "La Esperanza", "Tocachi", "Malchingui"];

let cacheRamales = [];
let parroquiaSeleccionada = null;
let modoAuth = "LOGIN";
let currentUser = null;
let filtroGlobalActivo = { tipo: 'parroquia', valor: null, etiqueta: 'Todas las parroquias' };

const authScreen = document.getElementById('auth-screen');
const appScreen = document.getElementById('app-screen');
const authForm = document.getElementById('auth-form');
const btnPrimaryAuth = document.getElementById('btn-primary-auth');
const btnToggleAuth = document.getElementById('btn-toggle-auth');
const authSwitchText = document.getElementById('auth-switch-text');
const userDisplay = document.getElementById('user-display');
const btnLogout = document.getElementById('btn-logout');

const viewParroquias = document.getElementById('view-parroquias');
const viewRamales = document.getElementById('view-ramales');
const viewFormRamal = document.getElementById('view-form-ramal');

const parroquiasContainer = document.getElementById('parroquias-container');
const ramalesTableBody = document.getElementById('ramales-table-body');
const ramalDataForm = document.getElementById('ramal-data-form');

const searchRamal = document.getElementById('search-ramal');
const filterEstado = document.getElementById('filter-estado');

const bcInicio = document.getElementById('bc-inicio');
const bcParroquia = document.getElementById('bc-parroquia');
const bcRamal = document.getElementById('bc-ramal');

function showToast(message, type = "success") {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type}`;
    setTimeout(() => {
        toast.className = 'toast hidden';
    }, 4000);
}

function actualizarBreadcrumb() {
    bcParroquia.classList.add('hidden');
    bcRamal.classList.add('hidden');

    if (filtroGlobalActivo.tipo === 'parroquia' && filtroGlobalActivo.valor) {
        bcParroquia.classList.remove('hidden');
        bcParroquia.textContent = filtroGlobalActivo.valor;
        bcParroquia.className = 'active-crumb';
    } else if (filtroGlobalActivo.tipo === 'estado') {
        bcParroquia.classList.remove('hidden');
        bcParroquia.textContent = filtroGlobalActivo.etiqueta;
        bcParroquia.className = 'active-crumb filter-crumb';
    }
}

function showView(viewName) {
    viewParroquias.classList.add('hidden');
    viewRamales.classList.add('hidden');
    viewFormRamal.classList.add('hidden');

    if (viewName === 'parroquias') {
        viewParroquias.classList.remove('hidden');
    } else if (viewName === 'ramales') {
        viewRamales.classList.remove('hidden');
    } else if (viewName === 'form') {
        viewFormRamal.classList.remove('hidden');
        bcRamal.classList.remove('hidden');
    }

    actualizarBreadcrumb();
}

function abrirListadoPorParroquia(parroquia) {
    parroquiaSeleccionada = parroquia;
    filtroGlobalActivo = {
        tipo: 'parroquia',
        valor: parroquia,
        etiqueta: parroquia
    };
    filterEstado.value = 'Todos';
    searchRamal.value = '';
    renderTablaRamales();
    showView('ramales');
}

function abrirListadoGlobalPorEstado(estado, etiqueta) {
    parroquiaSeleccionada = null;
    filtroGlobalActivo = {
        tipo: 'estado',
        valor: estado,
        etiqueta
    };
    filterEstado.value = 'Todos';
    searchRamal.value = '';
    renderTablaRamales();
    showView('ramales');
}

function abrirTodosLosRamales() {
    parroquiaSeleccionada = null;
    filtroGlobalActivo = {
        tipo: 'parroquia',
        valor: null,
        etiqueta: 'Todas las parroquias'
    };
    filterEstado.value = 'Todos';
    searchRamal.value = '';
    renderTablaRamales();
    showView('ramales');
}

function obtenerRamalesBase() {
    if (filtroGlobalActivo.tipo === 'estado') {
        return cacheRamales.filter(r => r.estado === filtroGlobalActivo.valor);
    }

    if (filtroGlobalActivo.tipo === 'parroquia' && filtroGlobalActivo.valor) {
        return cacheRamales.filter(r => r.parroquia === filtroGlobalActivo.valor);
    }

    return cacheRamales;
}

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        authScreen.classList.add('hidden');
        appScreen.classList.remove('hidden');
        userDisplay.innerHTML = `<i class="fa-solid fa-user-gear"></i> ${user.email}`;
        fetchRamalesDesdeFirestore();
    } else {
        currentUser = null;
        appScreen.classList.add('hidden');
        authScreen.classList.remove('hidden');
    }
});

authForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;

    try {
        if (modoAuth === "LOGIN") {
            await signInWithEmailAndPassword(auth, email, password);
            showToast("Acceso al sistema autorizado con éxito");
        } else {
            await createUserWithEmailAndPassword(auth, email, password);
            showToast("Usuario técnico registrado y conectado");
        }
    } catch (error) {
        showToast(`Error de Autenticación: ${error.message}`, "error");
    }
});

btnToggleAuth.addEventListener('click', () => {
    if (modoAuth === "LOGIN") {
        modoAuth = "REGISTRO";
        btnPrimaryAuth.textContent = "Registrar Nuevo Usuario";
        authSwitchText.textContent = "¿Ya tienes cuenta institucional?";
        btnToggleAuth.textContent = "Inicia sesión aquí";
    } else {
        modoAuth = "LOGIN";
        btnPrimaryAuth.textContent = "Iniciar Sesión";
        authSwitchText.textContent = "¿No tienes una cuenta?";
        btnToggleAuth.textContent = "Registrarse aquí";
    }
});

btnLogout.addEventListener('click', () => {
    signOut(auth).then(() => showToast("Sesión cerrada"));
});

async function fetchRamalesDesdeFirestore() {
    try {
        const q = query(collection(db, "ramales"), orderBy("nombre", "asc"));
        const querySnapshot = await getDocs(q);

        cacheRamales = [];
        querySnapshot.forEach((docSnap) => {
            cacheRamales.push({ id: docSnap.id, ...docSnap.data() });
        });

        actualizarDashboardYParroquias();

        if (!viewRamales.classList.contains('hidden')) {
            renderTablaRamales();
        }
    } catch (error) {
        showToast("Error al cargar datos desde Cloud Firestore: " + error.message, "error");
    }
}

function actualizarDashboardYParroquias() {
    document.getElementById('m-total').textContent = cacheRamales.length;
    document.getElementById('m-construidos').textContent = cacheRamales.filter(r => r.estado === 'Construido').length;
    document.getElementById('m-construccion').textContent = cacheRamales.filter(r => r.estado === 'En construcción').length;
    document.getElementById('m-diseno').textContent = cacheRamales.filter(r => r.estado === 'Diseño').length;
    document.getElementById('m-na').textContent = cacheRamales.filter(r => r.estado === 'N/A').length;

    parroquiasContainer.innerHTML = '';

    PARROQUIAS.forEach(parroquia => {
        const conteo = cacheRamales.filter(r => r.parroquia === parroquia).length;
        const card = document.createElement('div');
        card.className = 'parroquia-card';
        card.innerHTML = `
            <div class="parroquia-card-glow"></div>
            <div class="parroquia-card-header">
                <span class="parroquia-mini-icon">
                    <i class="fas fa-map-marked-alt"></i>
                </span>
                <h3>${parroquia}</h3>
            </div>
            <p class="parroquia-description">
                Consulta y administra los ramales terciarios registrados para esta parroquia.
            </p>
            <div class="parroquia-footer">
                <span class="parroquia-badge">${conteo} Ramales Terciarios</span>
                <span class="parroquia-link">Ver listado <i class="fas fa-arrow-right"></i></span>
            </div>
        `;
        card.addEventListener('click', () => abrirListadoPorParroquia(parroquia));
        parroquiasContainer.appendChild(card);
    });
}

function renderTablaRamales() {
    const terminoBusqueda = (searchRamal.value || '').toLowerCase().trim();
    const estadoFiltroTabla = filterEstado.value;

    let ramalesFiltrados = obtenerRamalesBase();

    if (estadoFiltroTabla && estadoFiltroTabla !== 'Todos') {
        ramalesFiltrados = ramalesFiltrados.filter(r => r.estado === estadoFiltroTabla);
    }

    if (terminoBusqueda) {
        ramalesFiltrados = ramalesFiltrados.filter(r =>
            (r.nombre || '').toLowerCase().includes(terminoBusqueda) ||
            (r.codigo || '').toLowerCase().includes(terminoBusqueda) ||
            (r.parroquia || '').toLowerCase().includes(terminoBusqueda)
        );
    }

    const titleEl = document.getElementById('ramales-title');
    const descEl = document.getElementById('ramales-description');

    if (titleEl) {
        titleEl.textContent = filtroGlobalActivo.tipo === 'estado'
            ? filtroGlobalActivo.etiqueta
            : (filtroGlobalActivo.valor
                ? `Ramales de ${filtroGlobalActivo.valor}`
                : 'Todos los ramales del sistema');
    }

    if (descEl) {
        descEl.textContent = `Se muestran ${ramalesFiltrados.length} registros según la selección actual.`;
    }

    ramalesTableBody.innerHTML = '';

    if (!ramalesFiltrados.length) {
        ramalesTableBody.innerHTML = `
            <tr>
                <td colspan="7">
                    <div class="empty-state-inline">
                        <i class="fas fa-circle-info"></i>
                        <span>No se encontraron ramales con los filtros aplicados.</span>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    ramalesFiltrados.forEach(ramal => {
        const tr = document.createElement('tr');

        const badgeClass =
            ramal.estado === 'Construido' ? 'status-construido' :
            ramal.estado === 'En construcción' ? 'status-construccion' :
            ramal.estado === 'Diseño' ? 'status-diseno' :
            'status-na';

        const tecnificado = ramal.tecnificado === true || ramal.tecnificado === 'Sí';

        tr.innerHTML = `
            <td><strong>${ramal.codigo || '-'}</strong></td>
            