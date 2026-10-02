export default function FolderDeleteDialog({ folder, isAdmin, onCancel, onDelete }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onCancel}>
      <section className="user-modal folder-delete-modal" onMouseDown={(event) => event.stopPropagation()}>
        <div className="user-modal__header">
          <div>
            <p className="eyebrow">Eliminar carpeta</p>
            <h2>{folder.name}</h2>
          </div>
          <button type="button" className="close-btn" onClick={onCancel} aria-label="Cerrar">×</button>
        </div>

        <p className="document-type-summary">
          “Para mí” la oculta solo de tu vista. “Para todos” elimina las carpetas compartidas con este nombre y sus documentos; las personales se conservan.
        </p>

        <div className="user-modal__actions folder-delete-actions">
          <button type="button" className="secondary-btn" onClick={onCancel}>Cancelar</button>
          <button type="button" className="secondary-btn" onClick={() => onDelete('me')}>
            Eliminar para mí
          </button>
          {isAdmin && (
            <button type="button" className="danger-btn" onClick={() => onDelete('all')}>
              Eliminar para todos
            </button>
          )}
        </div>
      </section>
    </div>
  );
}