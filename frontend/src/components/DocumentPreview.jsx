export default function DocumentPreview({
  preview,
  selectedDocument,
  isFullPreview,
  onDownload,
  onClose,
  onOpenFull,
  onShowToast,
}) {
  let content = null;

  if (preview.type === 'empty' || preview.type === 'empty-alt') {
    content = (
      <div className="empty-preview">
        <img className="preview-brand-icon" src="/docuhenkia-logo.png" alt="DOCUHENKIA" />
        <h3>{preview.type === 'empty' ? 'Selecciona un documento' : 'Vista previa no disponible'}</h3>
        <p>
          {preview.type === 'empty'
            ? 'Visualiza PDFs, imágenes, archivos de texto, Word y Excel.'
            : 'Descarga el archivo para abrirlo.'}
        </p>
      </div>
    );
  } else if (preview.type === 'loading') {
    content = (
      <div className="empty-preview">
        <span>⏳</span>
        <h3>Cargando vista previa...</h3>
      </div>
    );
  } else if (preview.type === 'pdf') {
    content = <iframe className="preview-frame" title={preview.title} src={preview.value} />;
  } else if (preview.type === 'image') {
    content = <img className="preview-image" src={preview.value} alt={preview.title} />;
  } else if (preview.type === 'html') {
    content = <div dangerouslySetInnerHTML={{ __html: preview.value }} />;
  } else if (preview.type === 'error') {
    content = (
      <div className="empty-preview">
        <span>⚠️</span>
        <h3>No se pudo visualizar</h3>
        <p>{preview.value}</p>
      </div>
    );
  }

  return (
    <aside className="preview-panel">
      <div className="preview-header">
        <div>
          <h2>{preview.title}</h2>
          <small>{preview.info}</small>
        </div>
        <button className="close-btn" onClick={onClose}>
          ← Volver
        </button>
      </div>

      <div className="preview-actions">
        <button
          className="primary-btn small"
          onClick={() => (selectedDocument ? onDownload(selectedDocument.id) : onShowToast('Selecciona un documento'))}
        >
          ⇩ Descargar
        </button>
        {selectedDocument && !isFullPreview && (
          <button className="secondary-btn small open-full-btn" type="button" onClick={onOpenFull}>
            ⛶ Abrir completo
          </button>
        )}
      </div>

      <div className="preview-content">{content}</div>
    </aside>
  );
}