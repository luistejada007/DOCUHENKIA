import { useState } from 'react';
import { APP_ROLES } from '../utils/roles';

export default function FolderCreateDialog({ onCancel, onCreateFolder }) {
  const [name, setName] = useState('');
  const [sharingScope, setSharingScope] = useState('me');
  const [accessRoles, setAccessRoles] = useState(APP_ROLES);
  const [isSaving, setIsSaving] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    const cleanName = name.trim();
    if (!cleanName || isSaving || (sharingScope === 'all' && !accessRoles.length)) return;

    setIsSaving(true);
    try {
      const created = await onCreateFolder({
        name: cleanName,
        isShared: sharingScope === 'all',
        accessRoles: sharingScope === 'all' ? accessRoles : [],
      });
      if (created) onCancel();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onCancel}>
      <form className="user-modal folder-create-modal" onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}>
        <div className="user-modal__header">
          <div>
            <p className="eyebrow">Organización</p>
            <h2>Nueva carpeta</h2>
          </div>
          <button type="button" className="close-btn" onClick={onCancel} aria-label="Cerrar">×</button>
        </div>

        <div className="user-form-grid member-edit-form">
          <label>
            Nombre de la carpeta
            <input autoFocus required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label>
            ¿Quién puede verla?
            <select value={sharingScope} onChange={(event) => setSharingScope(event.target.value)}>
              <option value="me">Solo yo</option>
              <option value="all">Compartida</option>
            </select>
          </label>
          {sharingScope === 'all' && (
            <fieldset className="upload-role-options">
              <legend>Visible para los roles</legend>
              {APP_ROLES.map((role) => (
                <label key={role}>
                  <input
                    type="checkbox"
                    checked={accessRoles.includes(role)}
                    onChange={() => setAccessRoles((current) => current.includes(role)
                      ? current.filter((item) => item !== role)
                      : [...current, role])}
                  />
                  {role}
                </label>
              ))}
            </fieldset>
          )}
        </div>

        <div className="user-modal__actions">
          <button type="button" className="secondary-btn" onClick={onCancel} disabled={isSaving}>Cancelar</button>
          <button type="submit" className="primary-btn" disabled={!name.trim() || isSaving || (sharingScope === 'all' && !accessRoles.length)}>
            {isSaving ? 'Creando...' : 'Crear carpeta'}
          </button>
        </div>
      </form>
    </div>
  );
}