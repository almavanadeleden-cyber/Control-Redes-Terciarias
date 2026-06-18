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
    where, 
    orderBy,
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// --- PARROQUIAS OFICIALES ---
const PARROQUIAS = ["Olmedo", "Ayora", "Tupigachi", "Tabacundo", "La Esperanza", "Tocachi", "Malchingui"];

// --- ESTADO GLOBAL LOCAL ---
let cacheRamales = [];
let parroquiaSeleccionada = null;
let modoAuth = "LOGIN"; // O "REGISTRO"
let currentUser = null;

// --- ELEMENTOS DOM ---
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

// Breadcrumbs
const bcInicio = document.getElementById('bc-inicio');
const bcParroquia = document.getElementById('bc-parroquia');
const bcRamal = document.getElementById('bc-ramal');

// --- NOTIFICACIONES TOAST ---
function showToast(message, type = "success") {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type}`;
    setTimeout(() => toast.className = 'toast hidden', 4000);
}

// --- CONTROL DE FLUJO DE PANTALLAS (UX CON BREADCRUMBS) ---
function showView(viewName) {
    viewParroquias.classList.add('hidden');
    viewRamales.classList.add('hidden');
    viewFormRamal.classList.add('hidden');

    if (viewName === 'parroquias') {
        viewParroquias.classList.remove('hidden');
        bcParroquia.classList.add('hidden');
        bcRamal.classList.add('hidden');
    } else if (viewName === 'ramales') {
        viewRamales.classList.remove('hidden');
        bcParroquia.classList.remove('hidden');
        bcParroquia.textContent = parroquiaSeleccionada;
        bcParroquia.className = "active-crumb";
        bcRamal.classList.add('hidden');
    } else if (viewName === 'form') {
        viewFormRamal.classList.remove('hidden');
        bcParroquia.className = "";
        bcRamal.classList.remove('hidden');
    }
}

// --- REQUISITO 1: AUTENTICACIÓN (FIREBASE AUTH) ---
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

btnLogout.addEventListener('click', () => signOut(auth).then(() => showToast("Sesión cerrada")));

// --- REQUISITO 6 Y 7: DATOS Y PERSISTENCIA (FIRESTORE) ---
async function fetchRamalesDesdeFirestore() {
    try {
        const q = query(collection(db, "ramales"), orderBy("nombre", "asc"));
        const querySnapshot = await getDocs(q);
        cacheRamales = [];
        querySnapshot.forEach((docSnap) => {
            cacheRamales.push({ id: docSnap.id, ...docSnap.data() });
        });
        actualizarDashboardYParroquias();
        if (parroquiaSeleccionada) renderTablaRamales();
    } catch (error) {
        showToast("Error al cargar datos desde Cloud Firestore: " + error.message, "error");
    }
}

// --- RENDERIZADO REQUISITO 2: DASHBOARD Y CONTADORES ---
function actualizarDashboardYParroquias() {
    // Calcular Métricas Globales
    document.getElementById('m-total').textContent = cacheRamales.length;
    document.getElementById('m-construidos').textContent = cacheRamales.filter(r => r.estado === 'Construido').length;
    document.getElementById('m-construccion').textContent = cacheRamales.filter(r => r.estado === 'En construcción').length;
    document.getElementById('m-diseno').textContent = cacheRamales.filter(r => r.estado === 'Diseño').length;
    document.getElementById('m-na').textContent = cacheRamales.filter(r => r.estado === 'N/A').length;

    // Generar Tarjetas de Parroquias
    parroquiasContainer.innerHTML = "";
    PARROQUIAS.forEach(parroquia => {
        const conteo = cacheRamales.filter(r => r.parroquia === parroquia).length;
        const card = document.createElement('div');
        card.className = "parroquia-card";
        card.innerHTML = `
            <h3>${parroquia}</h3>
            <span class="parroquia-badge">${conteo} Ramales Terciarios</span>
        `;
        card.addEventListener('click', () => {
            parroquiaSeleccionada = parroquia;
            showView('ramales');
            renderTablaRamales();
        });
        parroquiasContainer.appendChild(card);
    });
}

// --- RENDERIZADO REQUISITO 3: TABLA DE RAMALES CON FILTROS ---
function renderTablaRamales() {
    ramalesTableBody.innerHTML = "";
    
    let itemsFiltrados = cacheRamales.filter(r => r.parroquia === parroquiaSeleccionada);

    // Aplicar Filtro de Búsqueda de Texto
    const txtBusqueda = searchRamal.value.toLowerCase().trim();
    if (txtBusqueda) {
        itemsFiltrados = itemsFiltrados.filter(r => r.nombre.toLowerCase().includes(txtBusqueda));
    }

    // Aplicar Filtro de Dropdown de Estado
    const estFiltrado = filterEstado.value;
    if (estFiltrado !== "Todos") {
        itemsFiltrados = itemsFiltrados.filter(r => r.estado === estFiltrado);
    }

    if (itemsFiltrados.length === 0) {
        ramalesTableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#94a3b8;">No se encontraron registros de ramales para esta selección.</td></tr>`;
        return;
    }

    itemsFiltrados.forEach(ramal => {
        const tr = document.createElement('tr');
        
        let badgeClass = ramal.estado === 'Construido' ? 'status-construido' : ramal.estado === 'En construcción' ? 'status-construccion' : ramal.estado === 'Diseño' ? 'status-diseno' : 'status-na';
        let iconAsBuilt = ramal.planosAsBuilt === 'Entregados' ? 'fa-square-check tech-ok' : 'fa-square-xmark tech-ko';
        let iconCronograma = ramal.cronogramaTurnados === 'Entregados' ? 'fa-square-check tech-ok' : 'fa-square-xmark tech-ko';
        let iconPeticion = ramal.peticionConexionSecundaria === 'Sí' ? 'fa-circle-check tech-ok' : 'fa-circle-minus tech-ko';

        tr.innerHTML = `
            <td><strong>${ramal.nombre}</strong></td>
    <td><span class="badge ${badgeClass}">${ramal.estado}</span></td>
    <td style="text-align:center;"><i class="fa-solid ${iconAsBuilt} tech-icon"></i></td>
    <td style="text-align:center;"><i class="fa-solid ${iconCronograma} tech-icon"></i></td>
    <td style="text-align:center;"><i class="fa-solid ${iconPeticion} tech-icon"></i></td>
    <td>
                <button class="btn btn-secondary btn-sm btn-edit" data-id="${ramal.id}"><i class="fa-solid fa-pen-to-square"></i> Ficha</button>
            </td>
        `;
       
    
  
        tr.querySelector('.btn-edit').addEventListener('click', () => abrirFichaTecnica(ramal));
        ramalesTableBody.appendChild(tr);
    });
}

// --- REQUISITO 4 Y 5: GESTIÓN DE FICHA TÉCNICA (CRUD FORM) ---
function abrirFichaTecnica(ramal = null) {
    ramalDataForm.reset();
    document.getElementById('btn-eliminar-ramal').classList.add('hidden');

    if (ramal) {
        // Modo Edición
        document.getElementById('form-title').textContent = `Ficha Técnica: ${ramal.nombre}`;
        bcRamal.textContent = ramal.nombre;
        
        document.getElementById('ramal-id').value = ramal.id;
        document.getElementById('ramal-nombre').value = ramal.nombre;
        document.getElementById('ramal-parroquia').value = ramal.parroquia;
        document.getElementById('ramal-estado').value = ramal.estado;
        document.getElementById('ramal-fecha-contrato').value = ramal.fechaContrato || "";
        document.getElementById('ramal-fecha-provisional').value = ramal.fechaEntregaProvisional || "";
        document.getElementById('ramal-fecha-definitiva').value = ramal.fechaEntregaDefinitiva || "";
        document.getElementById('ramal-planos').value = ramal.planosAsBuilt;
        document.getElementById('ramal-cronograma').value = ramal.cronogramaTurnados;
        document.getElementById('ramal-peticion').value = ramal.peticionConexionSecundaria;
        
        document.getElementById('btn-eliminar-ramal').classList.remove('hidden');
    } else {
        // Modo Creación Manual (Requerimiento 5)
        document.getElementById('form-title').textContent = "Nueva Ficha Técnica de Ramal";
        bcRamal.textContent = "Nuevo Ramal";
        document.getElementById('ramal-id').value = "";
        document.getElementById('ramal-parroquia').value = parroquiaSeleccionada || "";
    }
    showView('form');
}

// ENVÍO Y GUARDADO DE FORMULARIO (CREATE / UPDATE)
ramalDataForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const id = document.getElementById('ramal-id').value;
    const data = {
        nombre: document.getElementById('ramal-nombre').value.trim(),
        parroquia: document.getElementById('ramal-parroquia').value,
        estado: document.getElementById('ramal-estado').value,
        fechaContrato: document.getElementById('ramal-fecha-contrato').value,
        fechaEntregaProvisional: document.getElementById('ramal-fecha-provisional').value,
        fechaEntregaDefinitiva: document.getElementById('ramal-fecha-definitiva').value,
        planosAsBuilt: document.getElementById('ramal-planos').value,
        cronogramaTurnados: document.getElementById('ramal-cronograma').value,
        peticionConexionSecundaria: document.getElementById('ramal-peticion').value,
        fechaActualizacion: serverTimestamp()
    };

    try {
        if (id) {
            // Actualización en Firestore
            const docRef = doc(db, "ramales", id);
            await updateDoc(docRef, data);
            showToast("Ficha técnica actualizada correctamente en Firestore");
        } else {
            // Creación en Firestore
            data.creadoPor = currentUser.email;
            data.fechaCreacion = serverTimestamp();
            await addDoc(collection(db, "ramales"), data);
            showToast("Nuevo ramal terciario ingresado y guardado con éxito");
        }
        
        parroquiaSeleccionada = data.parroquia; // Ajustar por si cambió de parroquia en el select
        await fetchRamalesDesdeFirestore();
        showView('ramales');
    } catch (error) {
        showToast("Error al guardar datos: " + error.message, "error");
    }
});

// ACCIÓN ELIMINAR REGISTRO
document.getElementById('btn-eliminar-ramal').addEventListener('click', async () => {
    const id = document.getElementById('ramal-id').value;
    if (confirm("¿Está seguro de que desea eliminar de forma permanente este ramal del sistema?")) {
        try {
            await deleteDoc(doc(db, "ramales", id));
            showToast("Registro eliminado del servidor institucional", "error");
            await fetchRamalesDesdeFirestore();
            showView('ramales');
        } catch (error) {
            showToast("Error al eliminar: " + error.message, "error");
        }
    }
});

// --- ACCIONES GENERALES DE NAVEGACIÓN ---
bcInicio.addEventListener('click', () => showView('parroquias'));
bcParroquia.addEventListener('click', () => showView('ramales'));
document.getElementById('btn-back-parroquias').addEventListener('click', () => showView('parroquias'));
document.getElementById('btn-cancel-form').addEventListener('click', () => showView('ramales'));
document.getElementById('btn-nuevo-ramal').addEventListener('click', () => abrirFichaTecnica(null));

// Eventos de Búsqueda dinámica en tiempo real
searchRamal.addEventListener('input', renderTablaRamales);
filterEstado.addEventListener('change', renderTablaRamales);

// Clics en métricas actúan como filtros instantáneos
document.querySelectorAll('.metric-card').forEach(card => {
    card.addEventListener('click', () => {
        const filterVal = card.getAttribute('data-filter');
        if (parroquiaSeleccionada) {
            filterEstado.value = filterVal;
            renderTablaRamales();
            showView('ramales');
        } else {
            showToast("Por favor, seleccione primero una parroquia para aplicar el filtro.");
        }
    });
});