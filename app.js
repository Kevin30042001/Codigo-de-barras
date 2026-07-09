/* =========================================================
   WMS·IT — Etiquetas de código de barras
   Lógica: importar Excel, generar Code128, seleccionar,
   buscar, imprimir.
   ========================================================= */

// Estado de la aplicación: arreglo de etiquetas
// cada etiqueta: { id, upc, item, source, selected }
let etiquetas = [];
let contadorId = 1;

// ---------- Referencias DOM ----------
const grid = document.getElementById('grid');
const emptyState = document.getElementById('emptyState');
const totalCount = document.getElementById('totalCount');
const selCountEl = document.getElementById('selCount');
const checkAll = document.getElementById('checkAll');
const buscador = document.getElementById('buscador');
const printBar = document.getElementById('printBar');
const printSelCount = document.getElementById('printSelCount');
const printArea = document.getElementById('printArea');
const importQueue = document.getElementById('importQueue');

const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const btnSeleccionar = document.getElementById('btnSeleccionar');

const modalOverlay = document.getElementById('modalOverlay');
const modalTitulo = document.getElementById('modalTitulo');
const inputUPC = document.getElementById('inputUPC');
const inputItem = document.getElementById('inputItem');
const btnAgregarManual = document.getElementById('btnAgregarManual');
const btnCancelarModal = document.getElementById('btnCancelarModal');
const btnGuardarModal = document.getElementById('btnGuardarModal');
const modalClose = document.getElementById('modalClose');
const btnGuardar = document.getElementById('btnGuardarModal');
const btnLimpiar = document.getElementById('btnLimpiar');
const btnImprimir = document.getElementById('btnImprimir');
const printLayout = document.getElementById('printLayout');

let editandoId = null; // si no es null, el modal está editando esa etiqueta

// =========================================================
// UTILIDADES
// =========================================================

function filtroTexto(){
  return buscador.value.trim().toLowerCase();
}

function etiquetasFiltradas(){
  const q = filtroTexto();
  if(!q) return etiquetas;
  return etiquetas.filter(e =>
    e.upc.toLowerCase().includes(q) ||
    (e.item || '').toLowerCase().includes(q)
  );
}

function actualizarContadores(){
  const visibles = etiquetasFiltradas();
  totalCount.textContent = `${etiquetas.length} en total`;
  const seleccionadas = etiquetas.filter(e => e.selected).length;
  selCountEl.textContent = `${seleccionadas} seleccionadas`;
  printSelCount.textContent = seleccionadas;

  printBar.classList.toggle('visible', seleccionadas > 0);

  checkAll.checked = visibles.length > 0 && visibles.every(e => e.selected);
}

// =========================================================
// RENDER
// =========================================================

function render(){
  const visibles = etiquetasFiltradas();

  // Limpiar grid (menos el add-card y empty state que reconstruimos)
  grid.innerHTML = '';

  if(etiquetas.length === 0){
    grid.appendChild(emptyState);
    actualizarContadores();
    return;
  }

  if(visibles.length === 0){
    const noRes = document.createElement('div');
    noRes.className = 'empty-state';
    noRes.innerHTML = `
      <p class="empty-title">Sin resultados</p>
      <p class="empty-sub">Ninguna etiqueta coincide con "${escapeHtml(buscador.value)}"</p>
    `;
    grid.appendChild(noRes);
    actualizarContadores();
    return;
  }

  visibles.forEach(et => {
    const card = document.createElement('div');
    card.className = 'label-card' + (et.selected ? ' selected' : '');
    card.dataset.id = et.id;

    card.innerHTML = `
      <input type="checkbox" class="check" ${et.selected ? 'checked' : ''}>
      <div class="slot-label">
        <div class="label-item">${et.item ? escapeHtml(et.item) : '<span style="color:var(--muted);font-weight:600;">Sin nombre de producto</span>'}</div>
        <div class="barcode-area">
          <svg class="barcode-svg"></svg>
        </div>
        <div class="slot-id">${escapeHtml(et.upc)}</div>
      </div>
      <div class="label-meta">
        <div class="source-tag"><span class="dot"></span>${escapeHtml(et.source)}</div>
        <div>
          <button class="edit-btn">Editar</button>
          <button class="delete-btn">Eliminar</button>
        </div>
      </div>
    `;

    grid.appendChild(card);

    // Generar el código de barras real (Code128) dentro del SVG recién creado
    const svg = card.querySelector('.barcode-svg');
    try{
      JsBarcode(svg, et.upc, {
        format: 'CODE128',
        displayValue: false,
        margin: 0,
        height: 40,
        background: 'transparent'
      });
    }catch(err){
      svg.outerHTML = `<div style="font-size:10px;color:var(--red);text-align:center;">Código inválido</div>`;
    }

    // Eventos de la tarjeta
    card.querySelector('.check').addEventListener('change', (e) => {
      et.selected = e.target.checked;
      card.classList.toggle('selected', et.selected);
      actualizarContadores();
    });
    card.querySelector('.edit-btn').addEventListener('click', () => abrirModalEditar(et.id));
    card.querySelector('.delete-btn').addEventListener('click', () => eliminarEtiqueta(et.id));
  });

  // Tarjeta para agregar manualmente al final
  const addCard = document.createElement('div');
  addCard.className = 'add-card';
  addCard.innerHTML = `<div class="plus">+</div> Nueva etiqueta`;
  addCard.addEventListener('click', () => abrirModalNuevo());
  grid.appendChild(addCard);

  actualizarContadores();
}

function escapeHtml(str){
  if(str === undefined || str === null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// =========================================================
// CRUD DE ETIQUETAS
// =========================================================

function agregarEtiqueta(upc, item, source){
  upc = String(upc).trim();
  if(!upc) return null;
  const et = {
    id: contadorId++,
    upc,
    item: item ? String(item).trim() : '',
    source: source || 'Manual',
    selected: true
  };
  etiquetas.push(et);
  return et;
}

function eliminarEtiqueta(id){
  etiquetas = etiquetas.filter(e => e.id !== id);
  render();
}

function limpiarTodo(){
  if(etiquetas.length === 0) return;
  const ok = confirm('¿Eliminar todas las etiquetas generadas? Esta acción no se puede deshacer.');
  if(ok){
    etiquetas = [];
    importQueue.innerHTML = '';
    render();
  }
}

// =========================================================
// MODAL: agregar / editar manual
// =========================================================

function abrirModalNuevo(){
  editandoId = null;
  modalTitulo.textContent = 'Nueva etiqueta';
  inputUPC.value = '';
  inputItem.value = '';
  modalOverlay.classList.add('visible');
  inputUPC.focus();
}

function abrirModalEditar(id){
  const et = etiquetas.find(e => e.id === id);
  if(!et) return;
  editandoId = id;
  modalTitulo.textContent = 'Editar etiqueta';
  inputUPC.value = et.upc;
  inputItem.value = et.item;
  modalOverlay.classList.add('visible');
  inputUPC.focus();
}

function cerrarModal(){
  modalOverlay.classList.remove('visible');
}

function guardarModal(){
  const upc = inputUPC.value.trim();
  const item = inputItem.value.trim();

  if(!upc){
    inputUPC.focus();
    inputUPC.style.borderColor = 'var(--red)';
    return;
  }
  inputUPC.style.borderColor = '';

  if(editandoId !== null){
    const et = etiquetas.find(e => e.id === editandoId);
    if(et){
      et.upc = upc;
      et.item = item;
    }
  } else {
    agregarEtiqueta(upc, item, 'Manual');
  }
  cerrarModal();
  render();
}

// =========================================================
// IMPORTAR EXCEL (SheetJS)
// =========================================================

function procesarArchivo(file){
  const queueItem = crearItemCola(file.name);

  const reader = new FileReader();
  reader.onload = function(e){
    try{
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const primeraHoja = workbook.Sheets[workbook.SheetNames[0]];
      const filas = XLSX.utils.sheet_to_json(primeraHoja, { defval: '' });

      if(filas.length === 0){
        marcarError(queueItem, 'El archivo no tiene datos');
        return;
      }

      // Detectar nombres de columna de forma flexible (may�sculas/espacios)
      const columnas = Object.keys(filas[0]);
      const colUPC = columnas.find(c => /upc|codigo|c\u00f3digo|barra/i.test(c));
      const colItem = columnas.find(c => /item|referencia|descripcion|descripci\u00f3n|producto/i.test(c));

      if(!colUPC){
        marcarError(queueItem, 'No se encontró una columna de UPC/código');
        return;
      }

      let agregados = 0;
      filas.forEach(fila => {
        const upc = fila[colUPC];
        const item = colItem ? fila[colItem] : '';
        if(upc !== '' && upc !== undefined && upc !== null){
          agregarEtiqueta(upc, item, file.name);
          agregados++;
        }
      });

      marcarListo(queueItem, `${agregados} códigos importados`);
      render();

    }catch(err){
      console.error(err);
      marcarError(queueItem, 'No se pudo leer el archivo');
    }
  };
  reader.onerror = function(){
    marcarError(queueItem, 'Error al leer el archivo');
  };
  reader.readAsArrayBuffer(file);
}

function crearItemCola(nombre){
  const div = document.createElement('div');
  div.className = 'queue-item';
  div.innerHTML = `
    <div class="file-icon">XLS</div>
    <div class="file-info">
      <div class="file-name">${escapeHtml(nombre)}</div>
      <div class="file-detail">Procesando…</div>
    </div>
    <div class="status-pill done"><span class="pulse"></span> Leyendo</div>
  `;
  importQueue.prepend(div);
  return div;
}

function marcarListo(item, detalle){
  item.querySelector('.file-detail').textContent = detalle;
  item.querySelector('.status-pill').innerHTML = '<span class="pulse"></span> Listo';
}

function marcarError(item, detalle){
  item.querySelector('.file-detail').textContent = detalle;
  const pill = item.querySelector('.status-pill');
  pill.classList.remove('done');
  pill.classList.add('error');
  pill.innerHTML = '<span class="pulse"></span> Error';
}

// =========================================================
// IMPRESIÓN
// =========================================================

function imprimirSeleccionadas(){
  const seleccionadas = etiquetas.filter(e => e.selected);
  if(seleccionadas.length === 0) return;

  const porPagina = parseInt(printLayout.value, 10);
  const cols = porPagina === 1 ? 1 : (porPagina === 8 ? 2 : 3);

  printArea.innerHTML = '';

  for(let i = 0; i < seleccionadas.length; i += porPagina){
    const grupo = seleccionadas.slice(i, i + porPagina);
    const sheet = document.createElement('div');
    sheet.className = `print-sheet cols-${cols}`;

    grupo.forEach(et => {
      const label = document.createElement('div');
      label.className = 'print-label';
      label.innerHTML = `
        <div class="label-item">${et.item ? escapeHtml(et.item) : ''}</div>
        <div class="barcode-area"><svg class="print-barcode-svg"></svg></div>
        <div class="slot-id">${escapeHtml(et.upc)}</div>
      `;
      sheet.appendChild(label);
    });

    printArea.appendChild(sheet);
  }

  // Generar los códigos de barras dentro del área de impresión
  const svgs = printArea.querySelectorAll('.print-barcode-svg');
  seleccionadas.forEach((et, i) => {
    try{
      JsBarcode(svgs[i], et.upc, {
        format: 'CODE128',
        displayValue: false,
        margin: 0,
        height: 45,
        background: 'transparent'
      });
    }catch(err){ /* código inválido, se deja vacío */ }
  });

  window.print();
}

// =========================================================
// DRAG & DROP
// =========================================================

['dragenter','dragover'].forEach(evt => {
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });
});
['dragleave','drop'].forEach(evt => {
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
  });
});
dropzone.addEventListener('drop', (e) => {
  const files = e.dataTransfer.files;
  if(files.length) procesarArchivo(files[0]);
});

btnSeleccionar.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (e) => {
  if(e.target.files.length) procesarArchivo(e.target.files[0]);
  fileInput.value = '';
});

// =========================================================
// EVENTOS GENERALES
// =========================================================

checkAll.addEventListener('change', () => {
  const marcar = checkAll.checked;
  etiquetasFiltradas().forEach(e => e.selected = marcar);
  render();
});

buscador.addEventListener('input', render);

btnAgregarManual.addEventListener('click', abrirModalNuevo);
btnCancelarModal.addEventListener('click', cerrarModal);
modalClose.addEventListener('click', cerrarModal);
btnGuardarModal.addEventListener('click', guardarModal);
modalOverlay.addEventListener('click', (e) => {
  if(e.target === modalOverlay) cerrarModal();
});
inputUPC.addEventListener('keydown', (e) => { if(e.key === 'Enter') guardarModal(); });
inputItem.addEventListener('keydown', (e) => { if(e.key === 'Enter') guardarModal(); });

btnLimpiar.addEventListener('click', limpiarTodo);
btnImprimir.addEventListener('click', imprimirSeleccionadas);

// Render inicial
render();