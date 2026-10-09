import { useState } from 'react';
import FolderCreateDialog from './FolderCreateDialog';

export default function Sidebar({
  activeView,
  onViewChange,
  folders,
  currentFolderId,
  onFolderSelect,
  onCreateFolder,
  onDeleteFolder,
  onUploadClick,
  onTrashClick,
  isAdmin,
}) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-icon">
          <img src="/docuhenkia-logo.png" alt="Logo DOCUHENKIA" />
        </div>
        <div>
          <strong>DOCUHENKIA</strong>
          <small>Gestión documental</small>
        </div>
      </div>

      <nav>
        <button
          type="button"
          className={`nav-item nav-button ${activeView === 'home' ? 'active' : ''}`}
          onClick={() => onViewChange('home')}
        >
          ⌂ <span>Inicio</span>
        </button>
        <button
          type="button"
          className={`nav-item nav-button ${activeView === 'documents' ? 'active' : ''}`}
          onClick={() => onFolderSelect(null)}
        >
          ▣ <span>Mis documentos</span>
        </button>
        <button
          type="button"
          className={`nav-item nav-button ${activeView === 'profile' ? 'active' : ''}`}
          onClick={() => onViewChange('profile')}
        >
          ☺ <span>Perfil</span>
        </button>
        <button type="button" className="nav-item nav-button" onClick={onUploadClick}>
          ☁ <span>Subir documentos</span>
        </button>
        {isAdmin && (
          <button
            type="button"
            className={`nav-item nav-button ${activeView === 'settings' ? 'active' : ''}`}
            onClick={() => onViewChange('settings')}
          >
            ⚙ <span>Configuración</span>
          </button>
        )}
        <button
          type="button"
          className={`nav-item nav-button ${activeView === 'trash' ? 'active' : ''}`}
          onClick={onTrashClick}
        >
          ♲ <span>Papelera</span>
        </button>
      </nav>

      <div className="folder-section">
        <div className="folder-heading">
          <strong>Carpetas</strong>
          <span>{folders.length}</span>
        </div>
        <button type="button" className="folder-create-trigger" onClick={() => setIsCreateOpen(true)}>
          + Crear carpeta
        </button>
        <div className="folder-list">
          {folders.map((folder) => (
            <div className="folder-row" key={folder.id}>
              <button
                type="button"
                className={`folder-button ${currentFolderId === folder.id ? 'active' : ''}`}
                onClick={() => onFolderSelect(folder.id)}
              >
                <span>▰</span>
                <span>{folder.name}</span>
                <small>{folder.documentCount}</small>
              </button>
              <button
                type="button"
                className="folder-delete"
                title={`Eliminar ${folder.name}`}
                aria-label={`Eliminar ${folder.name}`}
                onClick={() => onDeleteFolder(folder)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="storage-card">
        <strong>DOCUHENKIA</strong>
        <p>Organiza, visualiza y descarga tus documentos desde un solo lugar.</p>
      </div>
      {isCreateOpen && (
        <FolderCreateDialog
          onCancel={() => setIsCreateOpen(false)}
          onCreateFolder={onCreateFolder}
        />
      )}
    </aside>
  );
}