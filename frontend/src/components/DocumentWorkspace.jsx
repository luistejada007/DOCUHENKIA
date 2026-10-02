import DocumentPreview from './DocumentPreview';
import { date, groupFor, iconFor, size } from '../utils/documents';

export default function DocumentWorkspace({
  currentFolderId,
  folders,
  fileInputRef,
  folderInputRef,
  dropzoneRef,
  onUploadFiles,
  currentFilter,
  onFilterChange,
  onRefresh,
  visibleDocuments,
  onPreviewDocument,
  onDownload,
  onRemoveDocument,
  preview,
  selectedDocument,
  isFullPreview,
  onClosePreview,
  onOpenFullPreview,
  onShowToast,
}) {
  return (
    <section className={`dashboard ${selectedDocument && isFullPreview ? 'preview-mode' : ''}`}>
      <div className="documents-panel">
        <div className="title-row">
          <div>
            <h1>{currentFolderId ? folders.find((folder) => folder.id === currentFolderId)?.name : 'Mis documentos'}</h1>
            <p>{currentFolderId ? 'Documentos guardados en esta carpeta.' : 'Gestiona tus archivos de forma simple y segura.'}</p>
          </div>
          <div className="document-upload-actions">
            <button type="button" className="primary-btn" onClick={() => fileInputRef.current?.click()}>
              ☁ Subir documentos
            </button>
            <button type="button" className="secondary-btn" onClick={() => folderInputRef.current?.click()}>
              Subir carpeta completa
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            hidden
            onChange={(event) => {
              onUploadFiles(event.target.files);
              event.target.value = '';
            }}
          />
          <input
            ref={folderInputRef}
            type="file"
            multiple
            webkitdirectory=""
            hidden
            onChange={(event) => {
              onUploadFiles(event.target.files, true);
              event.target.value = '';
            }}
          />
        </div>

        <div
          ref={dropzoneRef}
          className="dropzone"
          onClick={() => fileInputRef.current?.click()}
          onDragEnter={(event) => {
            event.preventDefault();
            event.currentTarget.classList.add('drag');
          }}
          onDragOver={(event) => {
            event.preventDefault();
            event.currentTarget.classList.add('drag');
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            event.currentTarget.classList.remove('drag');
          }}
          onDrop={(event) => {
            event.preventDefault();
            event.currentTarget.classList.remove('drag');
            onUploadFiles(event.dataTransfer.files);
          }}
        >
          <strong>📤 Arrastra documentos aquí</strong>
          <span>o haz clic para seleccionar archivos · Excel, Word, PDF e imágenes · Máximo 50 MB</span>
        </div>

        <div className="toolbar">
          <div className="filters">
            {['all', 'pdf', 'word', 'excel', 'image', 'other'].map((filter) => (
              <button
                key={filter}
                className={`filter ${currentFilter === filter ? 'active' : ''}`}
                onClick={() => onFilterChange(filter)}
              >
                {filter === 'all' && 'Todos'}
                {filter === 'pdf' && 'PDF'}
                {filter === 'word' && 'Word'}
                {filter === 'excel' && 'Excel'}
                {filter === 'image' && 'Imágenes'}
                {filter === 'other' && 'Otros'}
              </button>
            ))}
          </div>
          <button className="secondary-btn" onClick={onRefresh}>
            ↻ Actualizar
          </button>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Documento</th>
                <th>Documentación</th>
                <th>Tipo</th>
                <th>Tamaño</th>
                <th>Fecha</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {visibleDocuments.length === 0 ? (
                <tr>
                  <td colSpan="6" className="empty-row">No hay documentos para mostrar.</td>
                </tr>
              ) : (
                visibleDocuments.map((doc) => {
                  const group = groupFor(doc);
                  return (
                    <tr key={doc.id}>
                      <td>
                        <div className="file-cell">
                          <span className={`file-icon ${group}`}>{iconFor(group)}</span>
                          <strong>{doc.name}</strong>
                        </div>
                      </td>
                      <td>{doc.documentType || 'Sin clasificar'}</td>
                      <td><span className="badge">{group.toUpperCase()}</span></td>
                      <td>{size(doc.size)}</td>
                      <td>{date(doc.createdAt)}</td>
                      <td>
                        <button className="action preview" title="Visualizar" onClick={() => onPreviewDocument(doc.id)}>
                          ◉
                        </button>
                        <button className="action download" title="Descargar" onClick={() => onDownload(doc.id)}>
                          ⇩
                        </button>
                        <button className="action delete" title="Eliminar" onClick={() => onRemoveDocument(doc.id)}>
                          ×
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="footer">
          <span>{visibleDocuments.length} documento{visibleDocuments.length !== 1 ? 's' : ''}</span>
          <span>Almacenamiento conectado</span>
        </div>
      </div>

      <DocumentPreview
        preview={preview}
        selectedDocument={selectedDocument}
        isFullPreview={isFullPreview}
        onDownload={onDownload}
        onClose={onClosePreview}
        onOpenFull={onOpenFullPreview}
        onShowToast={onShowToast}
      />
    </section>
  );
}