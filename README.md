# Código de barras — Etiquetas Hortifruti (CD Santa Tecla)

Generador de etiquetas con código de barras (UPC + nombre de producto) para
imprimir o descargar, usado en el Centro de Distribución de Hortifruti en
Santa Tecla. Incluye búsqueda por texto y por voz, selección múltiple e
impresión/exportación en varios formatos.

## Cómo funciona (arquitectura, en corto)

- **100% estático, sin backend.** Es solo `index.html` + `style.css` +
  `app.js`. No hay servidor propio, base de datos ni API.
- **Los datos viven en el navegador de cada usuario** (`localStorage`).
  Cada quien que usa la página importa su propio Excel y ve sus propias
  etiquetas — nada se comparte entre usuarios ni se guarda en la nube.
- **Librerías externas vía CDN** (jsDelivr), cargadas directo en
  `index.html`, sin paso de build ni `npm install`:
  - `xlsx` / `exceljs` → leer archivos Excel/CSV importados.
  - `jsbarcode` → dibujar los códigos de barras.
  - `jspdf` + `html2canvas` → exportar a PDF.
  - `docx` → exportar a Word.
- **Búsqueda por voz** usa la Web Speech API nativa del navegador
  (`SpeechRecognition`/`webkitSpeechRecognition`), sin librerías ni API
  keys. Si el navegador no la soporta (Firefox, algunos Safari), el botón
  de micrófono se oculta solo y el buscador de texto sigue funcionando
  normal.
- **Es una PWA instalable.** Tiene `manifest.json` + `sw.js` (service
  worker). Desde Chrome/Edge (escritorio o Android) aparece la opción
  "Instalar app" / "Agregar a pantalla de inicio", y queda como un ícono
  normal que abre en pantalla completa, sin barra del navegador. El
  service worker cachea el HTML/CSS/JS propios para que abra rápido y
  siga funcionando si el hosting tiene un hipo momentáneo (los datos en
  sí ya vivían solo en el navegador, así que esto no cambia dónde se
  guardan, solo mejora la resiliencia al cargar).

## Cómo correrlo en local

No hace falta instalar nada (no hay `npm`, no hay build):

```bash
cd Codigo-de-barras
python -m http.server 8765
# abrir http://localhost:8765/
```

O simplemente abrir `index.html` directo en el navegador (algunas cosas,
como el micrófono, requieren `http://` o `https://`, no funcionan con
`file://`).

## Cómo desplegarlo (deploy)

Ya está conectado a **GitHub Pages**. Cualquier `git push` a la rama
`main` se refleja solo en 1-2 minutos en la URL pública. No hay pipeline
de CI/CD, no hay que construir nada.

```bash
git add .
git commit -m "Describe tu cambio aquí"
git push origin main
```

## Known issues / pendientes

- En pantallas muy angostas (tipo iPhone SE, ~375px) hay un recorte
  horizontal de contenido en el sidebar/topbar que no se ha corregido
  todavía (no afecta el uso normal en celulares más anchos ni en
  escritorio).

##  Continuidad del proyecto

Este repositorio vive actualmente bajo una cuenta personal de GitHub, no
bajo una organización de la empresa. Antes de que cambie de dueño o se
transfiera, **cualquier persona que lo herede debe**:

1. Tener acceso de administrador al repo (ver sección de GitHub
   Settings → Collaborators, o que se transfiera a una organización).
2. Saber que no hay backend que mantener — solo el repo y GitHub Pages.
3. Leer este README antes de tocar nada.

Contacto / dueño original: Kevin Chávez.
