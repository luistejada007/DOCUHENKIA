import { useEffect, useRef, useState } from 'react';
import UserAvatar from './UserAvatar';

function ProfileView({ userName, profile, onUserUpdate, onSaveMessage, onProfileChange, onAvatarUpload }) {
  const [localProfile, setLocalProfile] = useState(profile);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const avatarInputRef = useRef(null);

  useEffect(() => {
    setLocalProfile(profile);
  }, [profile]);

  const handleChange = (field, value) => {
    setLocalProfile((current) => ({ ...current, [field]: value }));
    onProfileChange(field, value);
  };

  const handleSave = () => {
    const cleanName = localProfile.name.trim() || userName;
    onUserUpdate(cleanName);
    onSaveMessage('Perfil actualizado correctamente');
  };

  const handleAvatarSelection = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      onSaveMessage('La foto debe pesar menos de 5 MB');
      return;
    }

    setIsUploadingAvatar(true);
    try {
      await onAvatarUpload(file);
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  return (
    <section className="profile-page">
      <div className="profile-page__header">
        <div>
          <p className="eyebrow">Cuenta</p>
          <h1>Perfil de usuario</h1>
        </div>
        <button type="button" className="primary-btn" onClick={handleSave}>Guardar cambios</button>
      </div>

      <div className="profile-grid">
        <div className="profile-panel">
          <div className="profile-panel__top">
            <UserAvatar user={localProfile} className="avatar-large" />
            <div>
              <h2>{localProfile.name}</h2>
              <span>{localProfile.role}</span>
              <div className="profile-photo-actions">
                <input
                  ref={avatarInputRef}
                  className="visually-hidden"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={handleAvatarSelection}
                  aria-label="Seleccionar foto de perfil"
                />
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={isUploadingAvatar}
                >
                  {isUploadingAvatar ? 'Subiendo...' : 'Actualizar foto'}
                </button>
              </div>
            </div>
          </div>

          <div className="profile-form">
            <label>
              <span>Nombre completo</span>
              <input value={localProfile.name} onChange={(event) => handleChange('name', event.target.value)} />
            </label>
            <label>
              <span>Correo electrónico</span>
              <input value={localProfile.email} onChange={(event) => handleChange('email', event.target.value)} readOnly />
            </label>
            <label>
              <span>Área</span>
              <input value={localProfile.area} onChange={(event) => handleChange('area', event.target.value)} />
            </label>
            <label>
              <span>Teléfono</span>
              <input value={localProfile.phone} onChange={(event) => handleChange('phone', event.target.value)} />
            </label>
          </div>
        </div>

        <div className="profile-panel">
          <div className="profile-panel__header">
            <h3>Permisos y acceso</h3>
          </div>

          <div className="profile-form profile-form--compact">
            <label>
              <span>Rol</span>
              <select value={localProfile.role} onChange={(event) => handleChange('role', event.target.value)} disabled>
                <option>Administrador</option>
                <option>Editor</option>
                <option>Revisor</option>
                <option>Visualizador</option>
              </select>
            </label>
            <label>
              <span>Estado</span>
              <select value={localProfile.status} onChange={(event) => handleChange('status', event.target.value)} disabled>
                <option>Activo</option>
                <option>Inactivo</option>
                <option>Pendiente</option>
              </select>
            </label>
          </div>

          <div className="permission-box">
            <h4>Permisos activos</h4>
            <ul>
              <li>Gestión de documentos</li>
              <li>Control de carpetas</li>
              <li>Asignación de roles</li>
              <li>Descarga y vista previa</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

export default ProfileView;