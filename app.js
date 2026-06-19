import { auth, db } from './firebase-config.js';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserSessionPersistence
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
  serverTimestamp,
  where
} from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js';

const PARROQUIAS = ['Olmedo', 'Ayora', 'Tupigachi', 'Tabacundo', 'La Esperanza', 'Tocachi', 'Malchingui'];

let cacheRamales = [];
let cacheInspecciones = [];
let parroquiaSeleccionada = null;
let modoAuth = 'LOGIN';
let currentUser = null;
let ramalInspeccionActual = null;
let imagenesInspeccion = [];
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
const viewInspeccion = $('view-inspeccion');

const parroquiasContainer = $('parroquias-container');
const ramalesTableBody = $('ramales-table-body');
const ramalDataForm = $('ramal-data-form');
const searchRamal = $('search-ramal');
const filterEstado = $('filter-estado');
const bcInicio = $('bc-inicio');
const bcParroquia = $('bc-parroquia');
const bcRamal = $('bc-ramal');
const inspectionForm = $('inspection-form');
const inspectionHistoryBody = $('inspection-history-body');
const inspectionTitle = $('inspection-title');
const photoInput = $('inspection-photo');
const photoPreview = $('photo-preview');

function showToast(message, type = 'success') {
  const toast = $('toast');
  toast.textContent = message;
  toast.className = `toast ${type}`;
  setTimeout(() => {
    toast.className = 'toast hidden';
  }, 3500);
}

function showView(viewName) {
  viewParroquias.classList.add('hidden');
  viewRamales.classList.add('hidden');
  viewFormRamal.classList.add('hidden');
  viewInspeccion.classList.add('hidden');

  if (viewName === 'parroquias') viewParroquias.classList.remove('hidden');
  if (viewName === 'ramales') viewRamales.classList.remove('hidden');
  if (viewName === 'form') viewFormRamal.classList.remove('hidden');
  if (viewName === 'inspeccion') viewInspeccion.classList.remove('hidden');

  actualizarBreadcrumb();
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
        <span class="parroquia-mini-icon"><i class="fa-solid fa-map-location-dot"></i></span>
        <h3>${parroquia}</h3>
      </div>
      <p class="parroquia-description">Consulta la red terciaria, abre documentos y registra inspecciones con evidencia fotográfica.</p>
      <div class="parroquia-footer">
        <span class="parroquia-badge">${conteo} ramales</span>
        <span class="parroquia-link">Ver listado <i class="fa-solid fa-arrow-right"></i></span>
      </div>
    `;
    card.addEventListener('click', () => abrirListadoPorParroquia(parroquia));
    parroquiasContainer.appendChild(card);
  });
}

function obtenerClaseEstado(estado) {
  if (estado === 'Construido') return 'status-construido';
  if (estado === 'En construcción') return 'status-construccion';
  if (estado === 'Diseño') return 'status-diseno';
  return 'status-na';
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
    ramalesTableBody.innerHTML = '<tr><td colspan="8"><div class="empty-state-inline"><i class="fa-solid fa-circle-info"></i><span>No se encontraron ramales con los filtros aplicados.</span></div></td></tr>';
    return;
  }

  ramalesFiltrados.forEach((ramal) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${ramal.codigo || '-'}</strong></td>
      <td>${ramal.nombre || '-'}</td>
      <td>${ramal.parroquia || '-'}</td>
      <td><span class="badge ${obtenerClaseEstado(ramal.estado)}">${ramal.estado || 'N/A'}</span></td>
      <td>${ramal.longitud || '-'}</td>
      <td>
        ${ramal.driveLink
          ? `<a class="btn btn-secondary btn-sm" href="${ramal.driveLink}" target="_blank" rel="noopener noreferrer"><i class="fa-solid fa-folder-open"></i> Drive</a>`
          : '<span class="text-muted">Sin link</span>'}
      </td>
      <td><button type="button" class="btn btn-success btn-sm btn-inspeccion"><i class="fa-solid fa-clipboard-check"></i> Realizar inspección</button></td>
      <td><button type="button" class="btn btn-primary btn-sm btn-ficha"><i class="fa-solid fa-file-lines"></i> Abrir</button></td>
    `;

    tr.querySelector('.btn-ficha').addEventListener('click', () => abrirFichaTecnica(ramal));
    tr.querySelector('.btn-inspeccion').addEventListener('click', () => abrirInspeccion(ramal));
    ramalesTableBody.appendChild(tr);
  });
}

function abrirFichaTecnica(ramal = null) {
  ramalDataForm.reset();
  $('btn-eliminar-ramal').classList.add('hidden');

  if (ramal) {
    $('form-title').textContent = `Ficha técnica - ${ramal.nombre}`;
    bcRamal.textContent = ramal.nombre;
    bcRamal.className = 'active-crumb';

    $('ramal-id').value = ramal.id || '';
    $('ramal-nombre').value = ramal.nombre || '';
    $('ramal-codigo').value = ramal.codigo || '';
    $('ramal-parroquia').value = ramal.parroquia || '';
    $('ramal-estado').value = ramal.estado || 'Diseño';
    $('ramal-longitud').value = ramal.longitud || '';
    $('ramal-tecnificado').value = ramal.tecnificado || 'No';
    $('ramal-drive-link').value = ramal.driveLink || '';
    $('btn-eliminar-ramal').classList.remove('hidden');
  } else {
    $('form-title').textContent = 'Nueva ficha técnica de ramal';
    bcRamal.textContent = 'Nuevo ramal';
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
    renderTablaRamales();
  } catch (error) {
    showToast(`Error al cargar ramales: ${error.message}`, 'error');
  }
}

function renderPhotoPreview() {
  photoPreview.innerHTML = '';
  if (!imagenesInspeccion.length) {
    photoPreview.innerHTML = '<div class="text-muted">No se han adjuntado fotos.</div>';
    return;
  }

  imagenesInspeccion.forEach((img) => {
    const item = document.createElement('div');
    item.className = 'photo-thumb';
    item.innerHTML = `<img src="${img.dataUrl}" alt="Foto de inspección">`;
    photoPreview.appendChild(item);
  });
}

function abrirInspeccion(ramal) {
  ramalInspeccionActual = ramal;
  imagenesInspeccion = [];
  inspectionForm.reset();
  $('inspection-id').value = '';
  $('inspection-ramal-id').value = ramal.id;
  $('inspection-parroquia').value = ramal.parroquia || '';
  $('inspection-ramal-name').value = `${ramal.codigo || ''} - ${ramal.nombre || ''}`.trim();
  $('inspection-date').value = new Date().toISOString().split('T')[0];
  $('inspection-technician').value = currentUser?.email || '';
  inspectionTitle.textContent = `Realizar inspección - ${ramal.nombre}`;
  bcRamal.textContent = `Inspección: ${ramal.nombre}`;
  bcRamal.className = 'active-crumb';
  renderPhotoPreview();
  fetchInspeccionesPorRamal(ramal.id);
  showView('inspeccion');
}

function badgeInspeccion(estado) {
  const clase = (estado || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-');
  return `status-${clase}`;
}

function renderHistorialInspecciones() {
  inspectionHistoryBody.innerHTML = '';

  if (!cacheInspecciones.length) {
    inspectionHistoryBody.innerHTML = '<tr><td colspan="5"><div class="empty-state-inline"><i class="fa-solid fa-circle-info"></i><span>Este ramal todavía no registra inspecciones.</span></div></td></tr>';
    return;
  }

  cacheInspecciones.forEach((item) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${item.fecha || '-'}</td>
      <td>${item.parroquia || '-'}</td>
      <td>${item.ramalNombre || '-'}</td>
      <td>${item.motivo || '-'}</td>
      <td><span class="badge ${badgeInspeccion(item.estado)}">${item.estado || '-'}</span></td>
    `;
    inspectionHistoryBody.appendChild(tr);
  });
}

async function fetchInspeccionesPorRamal(ramalId) {
  try {
    const q = query(collection(db, 'inspecciones'), where('ramalId', '==', ramalId), orderBy('fecha', 'desc'));
    const querySnapshot = await getDocs(q);
    cacheInspecciones = [];
    querySnapshot.forEach((docSnap) => cacheInspecciones.push({ id: docSnap.id, ...docSnap.data() }));
    renderHistorialInspecciones();
  } catch (error) {
    inspectionHistoryBody.innerHTML = '<tr><td colspan="5"><div class="empty-state-inline"><i class="fa-solid fa-circle-info"></i><span>No fue posible cargar el historial de inspecciones.</span></div></td></tr>';
  }
}

function generarPdfInspeccion() {
  if (!ramalInspeccionActual) return;

  const { jsPDF } = window.jspdf;
  const docPdf = new jsPDF();
  const datos = {
    parroquia: $('inspection-parroquia').value,
    ramal: $('inspection-ramal-name').value,
    fecha: $('inspection-date').value,
    responsable: $('inspection-technician').value,
    motivo: $('inspection-motive').value,
    estado: $('inspection-status').value,
    observaciones: $('inspection-observations').value,
    acciones: $('inspection-actions').value || 'Sin acciones registradas'
  };

  let y = 18;
  docPdf.setFontSize(16);
  docPdf.text('Informe de inspección de ramal', 14, y);
  y += 10;

  docPdf.setFontSize(11);
  const bloques = [
    `Parroquia: ${datos.parroquia}`,
    `Ramal: ${datos.ramal}`,
    `Fecha: ${datos.fecha}`,
    `Responsable: ${datos.responsable}`,
    `Motivo de inspección: ${datos.motivo}`,
    `Estado observado: ${datos.estado}`,
    `Observaciones: ${datos.observaciones}`,
    `Acciones recomendadas: ${datos.acciones}`
  ];

  bloques.forEach((linea) => {
    const partes = docPdf.splitTextToSize(linea, 180);
    docPdf.text(partes, 14, y);
    y += (partes.length * 7);
  });

  imagenesInspeccion.slice(0, 2).forEach((img) => {
    if (y > 220) {
      docPdf.addPage();
      y = 20;
    }
    docPdf.text('Evidencia fotográfica', 14, y);
    y += 4;
    docPdf.addImage(img.dataUrl, 'JPEG', 14, y, 80, 60);
    y += 68;
  });

  const nombre = `inspeccion_${(ramalInspeccionActual.codigo || 'ramal').replace(/\s+/g, '_')}_${datos.fecha || 'sin-fecha'}.pdf`;
  docPdf.save(nombre);
}

onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    authScreen.classList.add('hidden');
    appScreen.classList.remove('hidden');
    userDisplay.innerHTML = `<i class="fa-solid fa-user-gear"></i> ${user.email}`;
    await fetchRamalesDesdeFirestore();
    showView('parroquias');
  } else {
    currentUser = null;
    appScreen.classList.add('hidden');
    authScreen.classList.remove('hidden');
  }
});

authForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = $('auth-email').value.trim();
  const password = $('auth-password').value.trim();

  try {
    await setPersistence(auth, browserSessionPersistence);

    if (modoAuth === 'LOGIN') {
      await signInWithEmailAndPassword(auth, email, password);
      showToast('Acceso autorizado correctamente');
    } else {
      await createUserWithEmailAndPassword(auth, email, password);
      showToast('Usuario registrado y conectado');
    }
  } catch (error) {
    showToast(`Error de autenticación: ${error.message}`, 'error');
  }
});

btnToggleAuth.addEventListener('click', () => {
  if (modoAuth === 'LOGIN') {
    modoAuth = 'REGISTRO';
    btnPrimaryAuth.innerHTML = '<i class="fa-solid fa-user-plus"></i> Registrar usuario';
    authSwitchText.textContent = '¿Ya tienes una cuenta?';
    btnToggleAuth.textContent = 'Inicia sesión aquí';
  } else {
    modoAuth = 'LOGIN';
    btnPrimaryAuth.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Iniciar sesión';
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
    tecnificado: $('ramal-tecnificado').value,
    driveLink: $('ramal-drive-link').value.trim(),
    fechaActualizacion: serverTimestamp()
  };

  try {
    if (id) {
      await updateDoc(doc(db, 'ramales', id), data);
      showToast('Ficha técnica actualizada');
    } else {
      data.creadoPor = currentUser?.email || 'sistema';
      data.fechaCreacion = serverTimestamp();
      await addDoc(collection(db, 'ramales'), data);
      showToast('Nuevo ramal guardado');
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
  if (!confirm('¿Seguro que deseas eliminar este ramal?')) return;

  try {
    await deleteDoc(doc(db, 'ramales', id));
    showToast('Ramal eliminado correctamente');
    await fetchRamalesDesdeFirestore();
    showView('ramales');
  } catch (error) {
    showToast(`Error al eliminar: ${error.message}`, 'error');
  }
});

inspectionForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!ramalInspeccionActual) return;

  const data = {
    ramalId: $('inspection-ramal-id').value,
    parroquia: $('inspection-parroquia').value,
    ramalNombre: ramalInspeccionActual.nombre || '',
    fecha: $('inspection-date').value,
    responsable: $('inspection-technician').value.trim(),
    motivo: $('inspection-motive').value.trim(),
    estado: $('inspection-status').value,
    observaciones: $('inspection-observations').value.trim(),
    acciones: $('inspection-actions').value.trim(),
    fotos: imagenesInspeccion.map((img) => ({ nombre: img.nombre, dataUrl: img.dataUrl })),
    creadoPor: currentUser?.email || 'sistema',
    fechaRegistro: serverTimestamp()
  };

  try {
    await addDoc(collection(db, 'inspecciones'), data);
    showToast('Inspección guardada correctamente');
    await fetchInspeccionesPorRamal(ramalInspeccionActual.id);
  } catch (error) {
    showToast(`Error al guardar inspección: ${error.message}`, 'error');
  }
});

photoInput.addEventListener('change', async (e) => {
  const files = Array.from(e.target.files || []);
  imagenesInspeccion = [];

  for (const file of files.slice(0, 4)) {
    const dataUrl = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(file);
    });
    imagenesInspeccion.push({ nombre: file.name, dataUrl });
  }

  renderPhotoPreview();
});

$('btn-generate-pdf').addEventListener('click', generarPdfInspeccion);
$('btn-cancel-inspeccion').addEventListener('click', () => showView('ramales'));
$('btn-cancel-form').addEventListener('click', () => showView('ramales'));
$('btn-back-parroquias').addEventListener('click', () => showView('parroquias'));
$('btn-nuevo-ramal').addEventListener('click', () => abrirFichaTecnica(null));

searchRamal.addEventListener('input', renderTablaRamales);
filterEstado.addEventListener('change', renderTablaRamales);

$('metric-total').addEventListener('click', abrirTodosLosRamales);
$('metric-construidos').addEventListener('click', () => abrirListadoGlobalPorEstado('Construido', 'Ramales construidos'));
$('metric-construccion').addEventListener('click', () => abrirListadoGlobalPorEstado('En construcción', 'Ramales en construcción'));
$('metric-diseno').addEventListener('click', () => abrirListadoGlobalPorEstado('Diseño', 'Ramales en diseño'));
$('metric-na').addEventListener('click', () => abrirListadoGlobalPorEstado('N/A', 'Ramales N/A'));

bcInicio.addEventListener('click', () => {
  filtroGlobalActivo = { tipo: 'parroquia', valor: null, etiqueta: 'Todas las parroquias' };
  parroquiaSeleccionada = null;
  searchRamal.value = '';
  filterEstado.value = 'Todos';
  showView('parroquias');
});

bcParroquia.addEventListener('click', () => showView('ramales'));