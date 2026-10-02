import { APP_ROLES } from '../utils/roles';
import LoadingOverlay from './LoadingOverlay';

export default function DocumentTypeDialog({
  files,
  documentType,
  onDocumentTypeChange,
  sharingScope,
  onSharingScopeChange,
  onCancel,
  onSubmit,
  isUploading,
  uploadProgress,
  folderName,
  folderAccessRoles,
  onFolderAccessRolesChange,
}) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onCancel}>
      <form
        className="user-modal document-type-modal"
        onSubmit={onSubmit}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="user-modal__header">
          <div>
            <p className="eyebrow">Clasificación documental</p>
            <h2>Tipo de documentación</h2>
          </div>
          <button type="button" className="close-btn" onClick={onCancel} aria-label="Cancelar subida">×</button>
        </div>

        <p className="document-type-summary">
          {files.length} archivo{files.length === 1 ? '' : 's'} seleccionado{files.length === 1 ? '' : 's'}.
          La categoría y visibilidad se aplicarán a todos los archivos.
          {folderName && <> La carpeta “{folderName}” tendrá la misma visibilidad.</>}
          {isUploading && <> Subiendo {uploadProgress} de {files.length}...</>}
        </p>

        <label className="document-type-field">
          Tipo de documentación
          <select required value={documentType} onChange={(event) => onDocumentTypeChange(event.target.value)}>
            <option value="" disabled>Selecciona una categoría</option>
            <option value="Arquitectura">Arquitectura</option>
            <option value="Información técnica">Información técnica</option>
            <option value="Manual">Manual</option>
          </select>
        </label>

        <label className="document-type-field">
          ¿Quién puede ver {folderName ? 'la carpeta y sus archivos' : 'los archivos'}?
          <select required value={sharingScope} onChange={(event) => onSharingScopeChange(event.target.value)}>
            <option value="" disabled>Selecciona quién puede verlos</option>
            <option value="me">Solo yo</option>
            <option value="all">Todos los usuarios</option>
          </select>
        </label>

        {folderName && sharingScope === 'all' && (
          <fieldset className="upload-role-options">
            <legend>Visible para los roles</legend>
            {APP_ROLES.map((role) => (
              <label key={role}>
                <input
                  type="checkbox"
                  checked={folderAccessRoles.includes(role)}
                  onChange={() => onFolderAccessRolesChange((current) => current.includes(role)
                    ? current.filter((item) => item !== role)
                    : [...current, role])}
                />
                {role}
              </label>
            ))}
          </fieldset>
        )}

        <div className="user-modal__actions">
          <button type="button" className="secondary-btn" onClick={onCancel} disabled={isUploading}>Cancelar</button>
          <button
            type="submit"
            className="primary-btn"
            disabled={!documentType || !sharingScope || isUploading
              || Boolean(folderName && sharingScope === 'all' && !folderAccessRoles.length)}
          >
            {isUploading ? 'Subiendo...' : 'Subir documentos'}
          </button>
        </div>
      </form>
      {isUploading && (
        <LoadingOverlay
          message="Subiendo documentos"
          detail={`${uploadProgress} de ${files.length} archivos guardados`}
        />
      )}
    </div>
  );
}