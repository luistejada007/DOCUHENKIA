import { Fragment, useEffect, useState } from 'react';

function formatDeletedAt(value) {
  return value ? new Date(value).toLocaleString('es-CO') : 'Sin fecha';
}

function getExpirationDate(value) {
  if (!value) return null;
  const deletedAt = new Date(value);
  if (Number.isNaN(deletedAt.getTime())) return null;
  deletedAt.setDate(deletedAt.getDate() + 30);
  return deletedAt;
}

export default function TrashView({ items, isAdmin, isLoading, onRefresh, onRestore, onDelete, onDeleteMany, onEmpty }) {
  const [expandedBatches, setExpandedBatches] = useState(() => new Set());
  const [selectedDocumentIds, setSelectedDocumentIds] = useState(() => new Set());
  const documentItems = items.filter((item) => item.itemType === 'document');
  const documentIds = new Set(documentItems.map((item) => item.id));
  const allDocumentsSelected = documentItems.length > 0
    && documentItems.every((item) => selectedDocumentIds.has(item.id));
  const folderByBatch = new Map();
  items.filter((item) => item.itemType === 'folder' && item.batchId).forEach((folder) => {
    if (!folderByBatch.has(folder.batchId)) folderByBatch.set(folder.batchId, folder.id);
  });
  const topLevelItems = items.filter((item) =>
    item.itemType !== 'document' || !folderByBatch.has(item.batchId)
  );

  useEffect(() => {
    setSelectedDocumentIds((current) => new Set([...current].filter((id) => documentIds.has(id))));
  }, [items]);

  const toggleDocument = (id) => {
    setSelectedDocumentIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllDocuments = () => {
    setSelectedDocumentIds(allDocumentsSelected
      ? new Set()
      : new Set(documentItems.map((item) => item.id)));
  };

  const toggleFolder = (batchId) => {
    setExpandedBatches((current) => {
      const next = new Set(current);
      if (next.has(batchId)) next.delete(batchId);
      else next.add(batchId);
      return next;
    });
  };

  return (
    <section className="documents-panel trash-page">
      <div className="title-row trash-header">
        <div>
          <h1>Papelera</h1>
          <p>{isAdmin ? 'Contenido eliminado por los usuarios de la aplicación.' : 'Elementos que eliminaste para ti.'} Se eliminarán automáticamente después de 30 días.</p>
        </div>
        <div className="trash-actions">
          <label className="trash-select-all">
            <input
              type="checkbox"
              checked={allDocumentsSelected}
              onChange={toggleAllDocuments}
              disabled={!documentItems.length || isLoading}
            />
            Seleccionar archivos
          </label>
          <button type="button" className="secondary-btn" onClick={onRefresh} disabled={isLoading}>
            Actualizar
          </button>
          {selectedDocumentIds.size > 0 && (
            <button
              type="button"
              className="danger-btn"
              onClick={() => onDeleteMany(documentItems.filter((item) => selectedDocumentIds.has(item.id)))}
              disabled={isLoading}
            >
              Eliminar {selectedDocumentIds.size} seleccionados
            </button>
          )}
          <button type="button" className="danger-btn" onClick={onEmpty} disabled={isLoading || items.length === 0}>
            {isAdmin ? 'Vaciar papelera' : 'Vaciar mi papelera'}
          </button>
        </div>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Elegir</th>
              <th>Elemento</th>
              <th>Nombre</th>
              <th>Eliminado por</th>
              <th>Fecha</th>
              <th>Alcance</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan="7" className="empty-row">
                  {isLoading ? 'Cargando papelera...' : 'La papelera está vacía.'}
                </td>
              </tr>
            ) : topLevelItems.map((item) => {
              const folderDocuments = item.itemType === 'folder'
                && folderByBatch.get(item.batchId) === item.id
                ? documentItems.filter((document) => document.batchId === item.batchId)
                : [];
              const isExpanded = expandedBatches.has(item.batchId);

              return (
                <Fragment key={item.id}>
                  <tr>
                    <td>{item.itemType === 'document' && (
                      <input
                        type="checkbox"
                        checked={selectedDocumentIds.has(item.id)}
                        onChange={() => toggleDocument(item.id)}
                        aria-label={`Seleccionar ${item.name}`}
                      />
                    )}</td>
                    <td>{item.itemType === 'folder' ? 'Carpeta' : 'Archivo'}</td>
                    <td>
                      <div className="trash-item-name">
                        {item.itemType === 'folder' && folderDocuments.length > 0 && (
                          <button
                            type="button"
                            className="trash-folder-toggle"
                            onClick={() => toggleFolder(item.batchId)}
                            aria-expanded={isExpanded}
                          >
                            {isExpanded ? '▾' : '▸'} {item.name}
                          </button>
                        )}
                        {!(item.itemType === 'folder' && folderDocuments.length > 0) && <strong>{item.name}</strong>}
                        {item.itemType === 'folder' && folderDocuments.length > 0 && <small>{folderDocuments.length} documento(s)</small>}
                        {item.itemType === 'document' && item.folderId && <small>Dentro de una carpeta</small>}
                      </div>
                    </td>
                    <td>{item.deletedByName || 'Usuario eliminado'}</td>
                    <td>
                      {formatDeletedAt(item.deletedAt)}
                      <small>
                        {getExpirationDate(item.deletedAt)
                          ? `Eliminación estimada: ${getExpirationDate(item.deletedAt).toLocaleDateString('es-CO')}`
                          : 'Plazo de eliminación no disponible'}
                      </small>
                    </td>
                    <td>{item.audience === 'global' ? 'Todos' : 'Personal'}</td>
                    <td>
                      {item.itemType === 'document' && item.previewUrl && (
                        <a className="action trash-preview" href={item.previewUrl} target="_blank" rel="noreferrer" title="Visualizar archivo">
                          ◉
                        </a>
                      )}
                      <button type="button" className="action trash-restore" onClick={() => onRestore(item)} title="Restaurar elemento">
                        ↶
                      </button>
                      <button
                        type="button"
                        className="action trash-delete"
                        onClick={() => onDelete(item)}
                        title="Eliminar definitivamente"
                        aria-label={`Eliminar definitivamente ${item.name}`}
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                  {isExpanded && folderDocuments.map((document) => (
                    <tr key={document.id} className="trash-nested-document">
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedDocumentIds.has(document.id)}
                          onChange={() => toggleDocument(document.id)}
                          aria-label={`Seleccionar ${document.name}`}
                        />
                      </td>
                      <td>Archivo</td>
                      <td>
                        <div className="trash-item-name trash-item-name--nested">
                          <strong>{document.name}</strong>
                        </div>
                      </td>
                      <td>{document.deletedByName || 'Usuario eliminado'}</td>
                      <td>{formatDeletedAt(document.deletedAt)}</td>
                      <td>{document.audience === 'global' ? 'Todos' : 'Personal'}</td>
                      <td>
                        {document.previewUrl && (
                          <a className="action trash-preview" href={document.previewUrl} target="_blank" rel="noreferrer" title="Visualizar archivo">
                            ◉
                          </a>
                        )}
                        <button
                          type="button"
                          className="action trash-delete"
                          onClick={() => onDelete(document)}
                          title="Eliminar definitivamente"
                          aria-label={`Eliminar definitivamente ${document.name}`}
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="footer">
        <span>{items.length} elemento{items.length === 1 ? '' : 's'}</span>
        <span>{isAdmin ? 'Vista de administrador' : 'Vista personal'}</span>
      </div>
    </section>
  );
}