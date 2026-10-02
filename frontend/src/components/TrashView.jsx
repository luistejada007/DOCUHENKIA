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

export default function TrashView({ items, isAdmin, isLoading, onRefresh, onRestore, onEmpty }) {
  return (
    <section className="documents-panel trash-page">
      <div className="title-row trash-header">
        <div>
          <h1>Papelera</h1>
          <p>{isAdmin ? 'Contenido eliminado por los usuarios de la aplicación.' : 'Elementos que eliminaste para ti.'} Se eliminarán automáticamente después de 30 días.</p>
        </div>
        <div className="trash-actions">
          <button type="button" className="secondary-btn" onClick={onRefresh} disabled={isLoading}>
            Actualizar
          </button>
          <button type="button" className="danger-btn" onClick={onEmpty} disabled={isLoading || items.length === 0}>
            {isAdmin ? 'Vaciar papelera' : 'Vaciar mi papelera'}
          </button>
        </div>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
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
                <td colSpan="6" className="empty-row">
                  {isLoading ? 'Cargando papelera...' : 'La papelera está vacía.'}
                </td>
              </tr>
            ) : items.map((item) => (
              <tr key={item.id}>
                <td>{item.itemType === 'folder' ? 'Carpeta' : 'Archivo'}</td>
                <td>
                  <div className="trash-item-name">
                    <strong>{item.name}</strong>
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
                </td>
              </tr>
            ))}
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