/* =========================================================
   WMS·IT — Etiquetas de código de barras
   Lógica: importar Excel, generar Code128, seleccionar,
   buscar, imprimir.
   ========================================================= */

// Estado de la aplicación: arreglo de etiquetas
// cada etiqueta: { id, upc, item, source, selected }
let etiquetas = [];
let contadorId = 1;
let ordenActual = 'llegada';   // llegada | item-az | item-za | upc-asc | upc-desc
let filtroOrigen = 'todos';    // 'todos' o nombre de archivo

// ---------- Persistencia (localStorage) ----------
const STORAGE_KEY = 'wmsit-etiquetas-v1';

function guardarEstado(){
  try{
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      etiquetas,
      contadorId,
      ordenActual
    }));
  }catch(err){
    console.warn('No se pudo guardar en localStorage:', err);
  }
}

function cargarEstado(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return;
    const data = JSON.parse(raw);
    if(Array.isArray(data.etiquetas)){
      etiquetas = data.etiquetas;
      contadorId = data.contadorId || (Math.max(0, ...etiquetas.map(e => e.id)) + 1);
      ordenActual = data.ordenActual || 'llegada';
    }
  }catch(err){
    console.warn('No se pudo leer localStorage:', err);
  }
}

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
const btnDescargarToggle = document.getElementById('btnDescargarToggle');
const downloadMenu = document.getElementById('downloadMenu');

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
  let lista = etiquetas;

  // Filtro por archivo de origen
  if(filtroOrigen !== 'todos'){
    lista = lista.filter(e => e.source === filtroOrigen);
  }

  // Filtro por texto de búsqueda
  if(q){
    lista = lista.filter(e =>
      e.upc.toLowerCase().includes(q) ||
      (e.item || '').toLowerCase().includes(q)
    );
  }

  // Ordenamiento
  lista = [...lista];
  switch(ordenActual){
    case 'item-az':
      lista.sort((a, b) => (a.item || '').localeCompare(b.item || '', 'es'));
      break;
    case 'item-za':
      lista.sort((a, b) => (b.item || '').localeCompare(a.item || '', 'es'));
      break;
    case 'upc-asc':
      lista.sort((a, b) => String(a.upc).localeCompare(String(b.upc), undefined, { numeric: true }));
      break;
    case 'upc-desc':
      lista.sort((a, b) => String(b.upc).localeCompare(String(a.upc), undefined, { numeric: true }));
      break;
    // 'llegada': orden original, no se toca
  }

  return lista;
}

function origenesUnicos(){
  const set = new Set(etiquetas.map(e => e.source));
  return [...set];
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

function renderTabsOrigen(){
  const cont = document.getElementById('filterTabs');
  if(!cont) return;

  const origenes = origenesUnicos();

  // Solo mostrar tabs si hay más de un origen
  if(origenes.length <= 1){
    cont.innerHTML = '';
    filtroOrigen = 'todos';
    return;
  }

  // Si el filtro apunta a un origen que ya no existe, resetear
  if(filtroOrigen !== 'todos' && !origenes.includes(filtroOrigen)){
    filtroOrigen = 'todos';
  }

  let html = `<div class="filter-tab ${filtroOrigen === 'todos' ? 'active' : ''}" data-origen="todos">Todos</div>`;
  origenes.forEach(o => {
    const nombre = o.length > 22 ? o.slice(0, 20) + '…' : o;
    html += `<div class="filter-tab ${filtroOrigen === o ? 'active' : ''}" data-origen="${escapeHtml(o)}" title="${escapeHtml(o)}">${escapeHtml(nombre)}</div>`;
  });
  cont.innerHTML = html;

  cont.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      filtroOrigen = tab.dataset.origen;
      render();
    });
  });
}

function render(){
  guardarEstado();
  renderTabsOrigen();
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
      guardarEstado();
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
  const ok = confirm('¿Eliminar todas las etiquetas generadas? También se borrarán los datos guardados en este navegador. Esta acción no se puede deshacer.');
  if(ok){
    etiquetas = [];
    filtroOrigen = 'todos';
    importQueue.innerHTML = '';
    try{ localStorage.removeItem(STORAGE_KEY); }catch(err){}
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
// GRID DE IMPRESIÓN: calcula columnas/filas según cantidad por página
// =========================================================

function calcularGrid(porPagina){
  const mapa = {
    1:  { cols: 1, filas: 1 },
    8:  { cols: 2, filas: 4 },
    12: { cols: 3, filas: 4 },
    18: { cols: 3, filas: 6 },
    24: { cols: 4, filas: 6 },
    30: { cols: 5, filas: 6 }
  };
  return mapa[porPagina] || { cols: 3, filas: Math.ceil(porPagina / 3) };
}

// =========================================================
// IMPRESIÓN
// =========================================================

function imprimirSeleccionadas(){
  const seleccionadas = etiquetas.filter(e => e.selected);
  if(seleccionadas.length === 0) return;

  const porPagina = parseInt(printLayout.value, 10);
  const { cols, filas } = calcularGrid(porPagina);

  printArea.innerHTML = '';

  for(let i = 0; i < seleccionadas.length; i += porPagina){
    const grupo = seleccionadas.slice(i, i + porPagina);
    const sheet = document.createElement('div');
    sheet.className = `print-sheet cols-${cols}`;
    sheet.style.setProperty('--filas-hoja', filas);

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
        height: porPagina >= 24 ? 28 : 45,
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

// =========================================================
// UTILIDAD: generar un canvas de código de barras aislado
// (para usarlo como imagen en PDF y Word, sin depender del DOM visible)
// =========================================================

function barcodeAPngDataUrl(upc){
  const canvas = document.createElement('canvas');
  try{
    JsBarcode(canvas, upc, {
      format: 'CODE128',
      displayValue: false,
      margin: 4,
      height: 60,
      background: '#ffffff'
    });
    return canvas.toDataURL('image/png');
  }catch(err){
    return null;
  }
}

function nombreArchivoBase(){
  const fecha = new Date().toISOString().slice(0,10);
  return `etiquetas-codigo-barras-${fecha}`;
}

// =========================================================
// EXPORTAR A EXCEL (.xlsx) — con imagen del código en cada fila
// =========================================================

async function exportarExcel(){
  const seleccionadas = etiquetas.filter(e => e.selected);
  if(seleccionadas.length === 0) return;

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Etiquetas');

  // Columnas: ITEM | CÓDIGO DE BARRAS (imagen) | UPC
  ws.columns = [
    { header: 'ITEM', key: 'item', width: 34 },
    { header: 'CÓDIGO DE BARRAS', key: 'barcode', width: 38 },
    { header: 'UPC', key: 'upc', width: 24 }
  ];

  // Estilo del encabezado
  const head = ws.getRow(1);
  head.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  head.alignment = { horizontal: 'center', vertical: 'middle' };
  head.height = 22;
  head.eachCell(c => {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0E1412' } };
    c.border = { bottom: { style: 'medium' } };
  });

  const ALTO_FILA = 52; // puntos, para que quepa el código de barras

  seleccionadas.forEach((et, i) => {
    const fila = ws.addRow({ item: et.item || '', barcode: '', upc: String(et.upc) });
    fila.height = ALTO_FILA;
    fila.getCell('item').alignment = { vertical: 'middle', wrapText: true };
    fila.getCell('item').font = { bold: true, size: 11 };
    fila.getCell('upc').alignment = { vertical: 'middle', horizontal: 'center' };
    fila.getCell('upc').font = { name: 'Courier New', size: 11 };
    fila.eachCell(c => {
      c.border = {
        top: { style: 'thin' }, bottom: { style: 'thin' },
        left: { style: 'thin' }, right: { style: 'thin' }
      };
    });

    // Insertar imagen del código de barras en la columna B
    const png = barcodeAPngDataUrl(et.upc);
    if(png){
      const imgId = wb.addImage({ base64: png, extension: 'png' });
      ws.addImage(imgId, {
        tl: { col: 1.08, row: i + 1 + 0.12 }, // col B (índice 1), fila de datos
        ext: { width: 230, height: 56 }
      });
    }
  });

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${nombreArchivoBase()}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

// =========================================================
// EXPORTAR A PDF (.pdf) — etiquetas visuales con código real
// =========================================================

function exportarPDF(){
  const seleccionadas = etiquetas.filter(e => e.selected);
  if(seleccionadas.length === 0) return;

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'letter' });

  const porPagina = parseInt(printLayout.value, 10);
  const { cols, filas } = calcularGrid(porPagina);
  const compacta = porPagina >= 18;

  const margen = 8;
  const anchoUtil = 215.9 - margen * 2; // carta: 8.5in = 215.9mm
  const altoUtil = 279.4 - margen * 2;  // carta: 11in = 279.4mm
  const gap = compacta ? 2.5 : 5;
  const anchoCelda = (anchoUtil - gap * (cols - 1)) / cols;
  const altoCelda = (altoUtil - gap * (filas - 1)) / filas;

  seleccionadas.forEach((et, i) => {
    const posEnPagina = i % porPagina;
    if(i > 0 && posEnPagina === 0) doc.addPage();

    const col = posEnPagina % cols;
    const fila = Math.floor(posEnPagina / cols);
    const x = margen + col * (anchoCelda + gap);
    const y = margen + fila * (altoCelda + gap);

    // Marco de la etiqueta
    doc.setDrawColor(0);
    doc.setLineWidth(0.3);
    doc.rect(x, y, anchoCelda, altoCelda);

    // Nombre del producto
    const tamNombre = compacta ? 6.5 : 9;
    doc.setFontSize(tamNombre);
    doc.setFont(undefined, 'bold');
    const altoTitulo = compacta ? 6 : 10;
    const nombreLineas = doc.splitTextToSize(et.item || '', anchoCelda - 3);
    doc.text(nombreLineas.slice(0, compacta ? 1 : 2), x + anchoCelda/2, y + (compacta ? 3.2 : 5), { align: 'center' });
    doc.setLineWidth(0.25);
    doc.line(x, y + altoTitulo, x + anchoCelda, y + altoTitulo);

    // Código de barras
    const png = barcodeAPngDataUrl(et.upc);
    if(png){
      const margenTexto = compacta ? 6 : 8;
      const imgAlto = altoCelda - altoTitulo - margenTexto;
      const imgAncho = anchoCelda - (compacta ? 3 : 8);
      doc.addImage(png, 'PNG', x + (anchoCelda - imgAncho)/2, y + altoTitulo + 1.5, imgAncho, Math.max(imgAlto, 4));
    }

    // UPC como texto
    doc.setFontSize(compacta ? 6 : 8);
    doc.setFont('courier', 'normal');
    doc.text(String(et.upc), x + anchoCelda/2, y + altoCelda - 1.8, { align: 'center' });
  });

  doc.save(`${nombreArchivoBase()}.pdf`);
}

// =========================================================
// EXPORTAR A WORD (.docx) — cuadrícula de etiquetas como el PDF
// =========================================================

async function exportarWord(){
  const seleccionadas = etiquetas.filter(e => e.selected);
  if(seleccionadas.length === 0) return;

  const { Document, Packer, Table, TableRow, TableCell, Paragraph, ImageRun, TextRun, WidthType, AlignmentType, BorderStyle } = window.docx;

  function dataUrlABuffer(dataUrl){
    const base64 = dataUrl.split(',')[1];
    const binario = atob(base64);
    const bytes = new Uint8Array(binario.length);
    for(let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
    return bytes;
  }

  // Usar el mismo layout que el PDF/impresión (columnas según selector)
  const porPagina = parseInt(printLayout.value, 10);
  let { cols } = calcularGrid(porPagina);
  if(cols > 4) cols = 4; // Word se ve mejor con máx 4 columnas

  // Ancho útil de página carta en Word: ~9360 twips (8.5in - 2in márgenes aprox)
  // Imagen: ancho en px proporcional al número de columnas
  const anchoImgPx = Math.floor(660 / cols) - 14;
  const altoImgPx = cols >= 4 ? 42 : 55;

  const bordeCelda = {
    top: { style: BorderStyle.SINGLE, size: 8, color: '000000' },
    bottom: { style: BorderStyle.SINGLE, size: 8, color: '000000' },
    left: { style: BorderStyle.SINGLE, size: 8, color: '000000' },
    right: { style: BorderStyle.SINGLE, size: 8, color: '000000' }
  };

  function celdaEtiqueta(et){
    const png = barcodeAPngDataUrl(et.upc);
    const hijos = [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 40 },
        children: [new TextRun({ text: et.item || ' ', bold: true, size: 17 })] // size en half-points (17 = 8.5pt)
      })
    ];
    if(png){
      hijos.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 30 },
        children: [new ImageRun({
          data: dataUrlABuffer(png),
          transformation: { width: anchoImgPx, height: altoImgPx }
        })]
      }));
    }
    hijos.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: String(et.upc), font: 'Courier New', size: 15 })]
    }));

    return new TableCell({
      borders: bordeCelda,
      margins: { top: 80, bottom: 80, left: 60, right: 60 },
      width: { size: Math.floor(100 / cols), type: WidthType.PERCENTAGE },
      children: hijos
    });
  }

  function celdaVacia(){
    return new TableCell({
      borders: {
        top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
        left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }
      },
      width: { size: Math.floor(100 / cols), type: WidthType.PERCENTAGE },
      children: [new Paragraph('')]
    });
  }

  // Agrupar en filas de `cols` etiquetas
  const filas = [];
  for(let i = 0; i < seleccionadas.length; i += cols){
    const grupo = seleccionadas.slice(i, i + cols);
    const celdas = grupo.map(et => celdaEtiqueta(et));
    while(celdas.length < cols) celdas.push(celdaVacia()); // completar fila
    filas.push(new TableRow({ children: celdas }));
  }

  const documento = new Document({
    sections: [{
      properties: {
        page: { margin: { top: 720, bottom: 720, left: 720, right: 720 } } // 0.5in
      },
      children: [
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: filas
        })
      ]
    }]
  });

  const blob = await Packer.toBlob(documento);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${nombreArchivoBase()}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}

// =========================================================
// EVENTOS: menú de descarga
// =========================================================

btnDescargarToggle.addEventListener('click', (e) => {
  e.stopPropagation();
  downloadMenu.classList.toggle('visible');
});

document.addEventListener('click', () => {
  downloadMenu.classList.remove('visible');
});

downloadMenu.addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-formato]');
  if(!btn) return;

  const seleccionadas = etiquetas.filter(x => x.selected);
  if(seleccionadas.length === 0) return;

  const formato = btn.dataset.formato;
  const textoOriginal = btn.innerHTML;
  btn.innerHTML = 'Generando…';
  btn.disabled = true;

  try{
    if(formato === 'excel') await exportarExcel();
    else if(formato === 'pdf') exportarPDF();
    else if(formato === 'word') await exportarWord();
  }catch(err){
    console.error(err);
    alert('Ocurrió un error generando el archivo. Revisa la consola para más detalle.');
  }finally{
    btn.innerHTML = textoOriginal;
    btn.disabled = false;
    downloadMenu.classList.remove('visible');
  }
});

// Selector de ordenamiento
const selectOrden = document.getElementById('selectOrden');
if(selectOrden){
  selectOrden.addEventListener('change', () => {
    ordenActual = selectOrden.value;
    render();
  });
}

// Cargar datos guardados de sesiones anteriores y render inicial
cargarEstado();
if(selectOrden) selectOrden.value = ordenActual;
render();