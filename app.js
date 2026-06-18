import { auth, db } from './firebase-config.js';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js';
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
} from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js';

const PARROQUIAS = ['Olmedo', 'Ayora', 'Tupigachi', 'Tabacundo', 'La Esperanza', 'Tocachi', 'Malchingui'];

let cacheRamales = [];
let parroquiaSeleccionada = null;
let modoAuth = 'LOGIN';
let currentUser = null;
let filtroGlobalActivo = { tipo: 'parroquia', valor: null, etiqueta: 'Todas las parroquias' };

const $ = (id) => document.getElementById(id);

const authScreen = $('auth-screen');
const appScreen = $('app-screen');
const authForm = $('auth-form');
const btnPrimaryAuth = $('btn-primary-auth');
const btnToggleAuth = $('btn-toggle-auth');
const authSwitchText = $('auth-switch-text');
const userDisplay = $('user-display');
const btnLogout = $('btn-logout');
const viewParroquias = $('view-parroquias');
const viewRamales = $('view-ramales');
const viewFormRamal = $('view-form-ramal');
const parroquiasContainer = $('parroquias-container');
const ramalesTableBody = $('ramales-table-body');
const ramalDataForm = $('ramal-data-form');
const searchRamal = $('search-ramal');
const filterEstado = $('filter-estado');
const bcInicio = $('bc-inicio');
const bcParroquia = $('bc-parroquia');
const bcRamal = $('bc-ramal');

function showToast(message, type = 'success') {
  const toast = $('toast');
  toast.textContent = message;
  toast.className = `toast ${type}`;
  setTimeout(() => {
    toast.className = 'toast hidden';
  }, 4000);
}

function actualizarBreadcrumb() {
  bcParroquia.className = 'hidden';
  bcRamal.className = 'hidden';

  if (filtroGlobalActivo.tipo === 'parroquia' && filtroGlobalActivo.valor) {
    bcParroquia.textContent = filtroGlobalActivo.valor;
    bcParroquia.className = 'active-crumb';
  }

  if (filtroGlobalActivo.tipo === 'estado') {
    bcParroquia.textContent = filtroGlobalActivo.etiqueta;
    bcParroquia.className = 'active-crumb filter-crumb';
  }
}

function showView(viewName) {
  viewParroquias.classList.add('hidden');
  viewRamales.classList.add('hidden');
  viewFormRamal.classList.add('hidden');

  if (viewName === 'parroquias') viewParroquias.classList.remove('hidden');
  if (viewName === 'ramales') viewRamales.classList.remove('hidden');
  if (viewName === 'form') viewFormRamal.classList.remove('hidden');

  actualizarBreadcrumb();
}

function obtenerRamalesBase() {
  if (filtroGlobalActivo.tipo === 'estado') {
    return cacheRamales.filter((r) => r.estado === filtroGlobalActivo.valor);
  }
  if (filtroGlobalActivo.tipo === 'parroquia' && filtroGlobalActivo.valor) {
    return cacheRamales.filter((r) => r.parroquia === filtroGlobalActivo.valor);
  }
  return cacheRamales;
}

function abrirListadoPorParroquia(parroquia) {
  parroquiaSeleccionada = parroquia;
  filtroGlobalActivo = { tipo: 'parroquia', valor: parroquia, etiqueta: parroquia };
  searchRamal.value = '';
  filterEstado.value = 'Todos';
  renderTablaRamales();
  showView('ramales');
}

function abrirListadoGlobalPorEstado(estado, etiqueta) {
  parroquiaSeleccionada = null;
  filtroGlobalActivo = { tipo: 'estado', valor: estado, etiqueta };
  searchRamal.value = '';
  filterEstado.value = 'Todos';
  renderTablaRamales();
  showView('ramales');
}

function abrirTodosLosRamales() {
  parroquiaSeleccionada = null;
  filtroGlobalActivo = { tipo: 'parroquia', valor: null, etiqueta: 'Todas las parroquias' };
  searchRamal.value = '';
  filterEstado.value = 'Todos';
  renderTablaRamales();
  showView('ramales');
}

function actualizarDashboardYParroquias() {
  $('m-total').textContent = cacheRamales.length;
  $('m-construidos').textContent = cacheRamales.filter((r) => r.estado === 'Construido').length;
  $('m-construccion').textContent = cacheRamales.filter((r) => r.estado === 'En construcción').length;
  $('m-diseno').textContent = cacheRamales.filter((r) => r.estado === 'Diseño').length;
  $('m-na').textContent = cacheRamales.filter((r) => r.estado === 'N/A').length;

  parroquiasContainer.innerHTML = '';
  PARROQUIAS.forEach((parroquia) => {
    const conteo = cacheRamales.filter((r) => r.parroquia === parroquia).length;
    const card = document.createElement('article');
    card.className = 'parroquia-card';
    card.innerHTML = `
      <div class="parroquia-card-glow"></div>
      <div class="parroquia-card-header">
        <span class="parroquia-mini-icon"><i class="fas fa-map-marked-alt"></i></span>
        <h3>${parroquia}</h3>
      </div>
      <p class="parroquia-description">Consulta y administra los ramales terciarios registrados para esta parroquia.</p>
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
  const termino = searchRamal.value.trim().toLowerCase();
  const estadoTabla = filterEstado.value;
  let ramalesFiltrados = obtenerRamalesBase();

  if (estadoTabla !== 'Todos') {
    ramalesFiltrados = ramalesFiltrados.filter((r) => r.estado === estadoTabla);
  }

  if (termino) {
    ramalesFiltrados = ramalesFiltrados.filter((r) =>
      (r.nombre || '').toLowerCase().includes(termino) ||
      (r.codigo || '').toLowerCase().includes(termino) ||
      (r.parroquia || '').toLowerCase().includes(termino)
    );
  }

  $('ramales-title').textContent = filtroGlobalActivo.tipo === 'estado'
    ? filtroGlobalActivo.etiqueta
    : (filtroGlobalActivo.valor ? `Ramales de ${filtroGlobalActivo.valor}` : 'Todos los ramales del sistema');

  $('ramales-description').textContent = `Se muestran ${ramalesFiltrados.length} registros según la selección actual.`;

  ramalesTableBody.innerHTML = '';

  if (!ramalesFiltrados.length) {
    ramalesTableBody.innerHTML = '<tr><td colspan="7"><div class="empty-state-inline"><i class="fas fa-circle-info"></i><span>No se encontraron ramales con los filtros aplicados.</span></div></td></tr>';
    return;
  }

  ramalesFiltrados.forEach((ramal) => {
    const tr = document.createElement('tr');
    const badgeClass = ramal.estado === 'Construido'
      ? 'status-construido'
      : ramal.estado === 'En construcción'
      ? 'status-construccion'
      : ramal.estado === 'Diseño'
      ? 'status-diseno'
      : 'status-na';

    const tecnificado = ramal.tecnificado === true || ramal.tecnificado === 'Sí';

    tr.innerHTML = `
      <td><strong>${ramal.codigo || '-'}</strong></td>
      <td>${ramal.nombre || '-'}</td>
      <td>${ramal.parroquia || '-'}</td>
      <td><span class="badge ${badgeClass}">${ramal.estado || 'N/A'}</span></td>
      <td>${ramal.longitud || '-'}</td>
      <td><i class="fas ${tecnificado ? 'fa-circle-check tech-ok' : 'fa-circle-xmark tech-ko'} tech-icon"></i></td>
      <td><button class="btn btn-primary btn-sm" data-id="${ramal.id}"><i class="fas fa-file-lines"></i> Abrir</button></td>
    `;

    tr.querySelector('button').addEventListener('click', () => abrirFichaTecnica(ramal));
    ramalesTableBody.appendChild(tr);
  });
}

function abrirFichaTecnica(ramal = null) {
  ramalDataForm.reset();
  $('btn-eliminar-ramal').classList.add('hidden');

  if (ramal) {
    $('form-title').textContent = `Ficha Técnica: ${ramal.nombre || 'Ramal'}`;
    bcRamal.textContent = ramal.nombre || 'Ramal';
    bcRamal.className = 'active-crumb';
    $('ramal-id').value = ramal.id || '';
    $('ramal-nombre').value = ramal.nombre || '';
    $('ramal-codigo').value = ramal.codigo || '';
    $('ramal-parroquia').value = ramal.parroquia || '';
    $('ramal-estado').value = ramal.estado || 'Diseño';
    $('ramal-longitud').value = ramal.longitud || '';
    $('ramal-tecnificado').value = (ramal.tecnificado === true || ramal.tecnificado === 'Sí') ? 'Sí' : 'No';
    $('ramal-fecha-contrato').value = ramal.fechaContrato || '';
    $('ramal-fecha-provisional').value = ramal.fechaEntregaProvisional || '';
    $('ramal-fecha-definitiva').value = ramal.fechaEntregaDefinitiva || '';
    $('ramal-planos').value = ramal.planosAsBuilt || 'No entregados';
    $('ramal-cronograma').value = ramal.cronogramaTurnados || 'No entregados';
    $('ramal-peticion').value = ramal.peticionConexionSecundaria || 'No';
    $('btn-eliminar-ramal').classList.remove('hidden');
  } else {
    $('form-title').textContent = 'Nueva Ficha Técnica de Ramal';
    bcRamal.textContent = 'Nuevo Ramal';
    bcRamal.className = 'active-crumb';
    $('ramal-id').value = '';
    $('ramal-parroquia').value = parroquiaSeleccionada || '';
    $('ramal-tecnificado').value = 'No';
  }

  showView('form');
}

async function fetchRamalesDesdeFirestore() {
  try {
    const q = query(collection(db, 'ramales'), orderBy('nombre', 'asc'));
    const querySnapshot = await getDocs(q);
    cacheRamales = [];
    querySnapshot.forEach((docSnap) => cacheRamales.push({ id: docSnap.id, ...docSnap.data() }));
    actualizarDashboardYParroquias();
    if (!viewRamales.classList.contains('hidden')) renderTablaRamales();
  } catch (error) {
    showToast(`Error al cargar datos: ${error.message}`, 'error');
  }
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
  const email = $('auth-email').value.trim();
  const password = $('auth-password').value;

  try {
    if (modoAuth === 'LOGIN') {
      await signInWithEmailAndPassword(auth, email, password);
      showToast('Acceso al sistema autorizado con éxito');
    } else {
      await createUserWithEmailAndPassword(auth, email, password);
      showToast('Usuario técnico registrado y conectado');
    }
  } catch (error) {
    showToast(`Error de autenticación: ${error.message}`, 'error');
  }
});

btnToggleAuth.addEventListener('click', () => {
  if (modoAuth === 'LOGIN') {
    modoAuth = 'REGISTRO';
    btnPrimaryAuth.textContent = 'Registrar Nuevo Usuario';
    authSwitchText.textContent = '¿Ya tienes cuenta institucional?';
    btnToggleAuth.textContent = 'Inicia sesión aquí';
  } else {
    modoAuth = 'LOGIN';
    btnPrimaryAuth.textContent = 'Iniciar Sesión';
    authSwitchText.textContent = '¿No tienes una cuenta?';
    btnToggleAuth.textContent = 'Registrarse aquí';
  }
});

btnLogout.addEventListener('click', async () => {
  await signOut(auth);
  showToast('Sesión cerrada');
});

ramalDataForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = $('ramal-id').value;

  const data = {
    nombre: $('ramal-nombre').value.trim(),
    codigo: $('ramal-codigo').value.trim(),
    parroquia: $('ramal-parroquia').value,
    estado: $('ramal-estado').value,
    longitud: $('ramal-longitud').value.trim(),
    tecnificado: $('ramal-tecnificado').value === 'Sí',
    fechaContrato: $('ramal-fecha-contrato').value,
    fechaEntregaProvisional: $('ramal-fecha-provisional').value,
    fechaEntregaDefinitiva: $('ramal-fecha-definitiva').value,
    planosAsBuilt: $('ramal-planos').value,
    cronogramaTurnados: $('ramal-cronograma').value,
    peticionConexionSecundaria: $('ramal-peticion').value,
    fechaActualizacion: serverTimestamp()
  };

  try {
    if (id) {
      await updateDoc(doc(db, 'ramales', id), data);
      showToast('Ficha técnica actualizada correctamente');
    } else {
      data.creadoPor = currentUser?.email || 'sistema';
      data.fechaCreacion = serverTimestamp();
      await addDoc(collection(db, 'ramales'), data);
      showToast('Nuevo ramal ingresado y guardado con éxito');
    }

    parroquiaSeleccionada = data.parroquia;
    await fetchRamalesDesdeFirestore();
    showView('ramales');
  } catch (error) {
    showToast(`Error al guardar: ${error.message}`, 'error');
  }
});

$('btn-eliminar-ramal').addEventListener('click', async () => {
  const id = $('ramal-id').value;
  if (!id) return;
  if (!confirm('¿Está seguro de que desea eliminar este ramal del sistema?')) return;

  try {
    await deleteDoc(doc(db, 'ramales', id));
    showToast('Registro eliminado correctamente', 'error');
    await fetchRamalesDesdeFirestore();
    showView('ramales');
  } catch (error) {
    showToast(`Error al eliminar: ${error.message}`, 'error');
  }
});

bcInicio.addEventListener('click', () => {
  filtroGlobalActivo = { tipo: 'parroquia', valor: null, etiqueta: 'Todas las parroquias' };
  parroquiaSeleccionada = null;
  searchRamal.value = '';
  filterEstado.value = 'Todos';
  showView('parroquias');
});

bcParroquia.addEventListener('click', () => showView('ramales'));
$('btn-back-parroquias').addEventListener('click', () => showView('parroquias'));
$('btn-cancel-form').addEventListener('click', () => showView('ramales'));
$('btn-nuevo-ramal').addEventListener('click', () => abrirFichaTecnica(null));
searchRamal.addEventListener('input', renderTablaRamales);
filterEstado.addEventListener('change', renderTablaRamales);
$('metric-total').addEventListener('click', abrirTodosLosRamales);
$('metric-construidos').addEventListener('click', () => abrirListadoGlobalPorEstado('Construido', 'Ramales construidos'));
$('metric-construccion').addEventListener('click', () => abrirListadoGlobalPorEstado('En construcción', 'Ramales en construcción'));
$('metric-diseno').addEventListener('click', () => abrirListadoGlobalPorEstado('Diseño', 'Ramales en diseño'));
$('metric-na').addEventListener('click', () => abrirListadoGlobalPorEstado('N/A', 'Ramales N/A'));