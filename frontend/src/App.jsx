import { useEffect, useMemo, useRef, useState } from 'react';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import Login from './Login';

const API = '/api/documents';
const FOLDERS_API = '/api/folders';
const USERS_API = '/api/users';

async function readResponse(response) {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) return response.json();
  const text = await response.text();
  throw new Error(
    response.status === 404
      ? 'El backend no tiene disponible esta función. Reinicia el servidor.'
      : `Respuesta inesperada del servidor (${response.status})`
  );
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }[char]));
}

function groupFor(doc) {
  const name = doc.name.toLowerCase();
  if (name.endsWith('.pdf')) return 'pdf';
  if (/\.(doc|docx)$/.test(name)) return 'word';
  if (/\.(xls|xlsx|csv)$/.test(name)) return 'excel';
  if (/\.(jpg|jpeg|png|webp|gif)$/.test(name)) return 'image';
  return 'other';
}

function iconFor(group) {
  return { pdf: 'PDF', word: 'DOC', excel: 'XLS', image: 'IMG', other: 'FILE' }[group];
}

function size(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes;
  let index = -1;
  do {
    value /= 1024;
    index += 1;
  } while (value >= 1024 && index < units.length - 1);
  return `${value.toFixed(index > 0 && value < 10 ? 1 : 0)} ${units[index]}`;
}

function date(value) {
  return new Date(value).toLocaleDateString('es-CO');
}

function HomeOverview({ userName, members, onRoleChange }) {
  const updateRole = (id, nextRole) => {
    onRoleChange(id, nextRole);
  };

  const summary = [
    { label: 'Usuarios', value: members.length, tone: 'green' },
    { label: 'Administradores', value: members.filter((member) => member.role === 'Administrador').length, tone: 'dark' },
    { label: 'Edición activa', value: members.filter((member) => member.role === 'Editor').length, tone: 'blue' },
    { label: 'Pendientes', value: members.filter((member) => member.status === 'Pendiente').length, tone: 'amber' },
  ];

  return (
    <section className="home-page">
      <div className="home-hero">
        <div>
          <p className="eyebrow">Panel principal</p>
          <h1>Bienvenido, {userName}</h1>
          <p className="home-subtitle">Revisa el estado general del equipo y administra los permisos del sistema.</p>
        </div>
        <button type="button" className="primary-btn">+ Crear usuario</button>
      </div>

      <div className="profile-layout">
        <div className="profile-card">
          <div className="profile-header">
            <span className="avatar avatar-large">{userName.charAt(0).toUpperCase()}</span>
            <div>
              <h2>{userName}</h2>
              <span>Administrador general</span>
            </div>
          </div>

          <ul className="profile-details">
            <li><strong>Email</strong><span>admin@docuhenkia.com</span></li>
            <li><strong>Área</strong><span>Dirección</span></li>
            <li><strong>Rol actual</strong><span>Administrador</span></li>
            <li><strong>Estado</strong><span className="status-pill">Activo</span></li>
          </ul>
        </div>

        <div className="stats-grid">
          {summary.map((item) => (
            <div key={item.label} className={`stat-card stat-card--${item.tone}`}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>
      </div>

      <div className="role-manager">
        <div className="role-header">
          <div>
            <p className="eyebrow">Seguridad</p>
            <h2>Asignación de roles</h2>
          </div>
          <button type="button" className="secondary-btn">Guardar cambios</button>
        </div>

        <div className="table-container table-container--compact">
          <table>
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Equipo</th>
                <th>Rol</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.id}>
                  <td>
                    <div className="member-cell">
                      <span className="avatar avatar-small">{member.name.charAt(0).toUpperCase()}</span>
                      <div>
                        <strong>{member.name}</strong>
                        <small>{member.email}</small>
                      </div>
                    </div>
                  </td>
                  <td>{member.team}</td>
                  <td>
                    <select
                      value={member.role}
                      onChange={(event) => updateRole(member.id, event.target.value)}
                      className="role-select"
                    >
                      <option>Administrador</option>
                      <option>Editor</option>
                      <option>Revisor</option>
                      <option>Visualizador</option>
                    </select>
                  </td>
                  <td>
                    <span className={`status-pill ${member.status === 'Pendiente' ? 'status-pill--pending' : ''}`}>
                      {member.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function ProfileView({ userName, profile, onUserUpdate, onSaveMessage, onProfileChange }) {
  const [localProfile, setLocalProfile] = useState(profile);

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
            <span className="avatar avatar-large">{localProfile.name.charAt(0).toUpperCase() || 'U'}</span>
            <div>
              <h2>{localProfile.name}</h2>
              <span>{localProfile.role}</span>
            </div>
          </div>

          <div className="profile-form">
            <label>
              <span>Nombre completo</span>
              <input value={localProfile.name} onChange={(event) => handleChange('name', event.target.value)} />
            </label>
            <label>
              <span>Correo electrónico</span>
              <input value={localProfile.email} onChange={(event) => handleChange('email', event.target.value)} />
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
              <select value={localProfile.role} onChange={(event) => handleChange('role', event.target.value)}>
                <option>Administrador</option>
                <option>Editor</option>
                <option>Revisor</option>
                <option>Visualizador</option>
              </select>
            </label>
            <label>
              <span>Estado</span>
              <select value={localProfile.status} onChange={(event) => handleChange('status', event.target.value)}>
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

function DocumentManager({ userName, onLogout, onUserUpdate }) {
  const [documents, setDocuments] = useState([]);
  const [members, setMembers] = useState([]);
  const [profile, setProfile] = useState({
    id: 5,
    name: userName,
    email: 'admin@docuhenkia.com',
    area: 'Dirección',
    role: 'Administrador',
    status: 'Activo',
    phone: '+57 300 123 4567',
    team: 'Dirección',
  });
  const [folders, setFolders] = useState([]);
  const [currentFolderId, setCurrentFolderId] = useState(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [isFullPreview, setIsFullPreview] = useState(false);
  const [currentFilter, setCurrentFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [activeView, setActiveView] = useState('home');
  const [toast, setToast] = useState('');
  const [preview, setPreview] = useState({
    type: 'empty',
    title: 'Vista previa',
    info: 'Selecciona un documento',
    value: '',
  });
  const fileInputRef = useRef(null);
  const dropzoneRef = useRef(null);

  const selectedDocument = useMemo(
    () => documents.find((doc) => doc.id === selectedId) ?? null,
    [documents, selectedId]
  );

  const visibleDocuments = useMemo(() => {
    const query = search.trim().toLowerCase();
    return documents.filter((doc) => {
      const group = groupFor(doc);
      return (
        (currentFolderId === null || doc.folderId === currentFolderId) &&
        (currentFilter === 'all' || group === currentFilter) &&
        doc.name.toLowerCase().includes(query)
      );
    });
  }, [documents, currentFolderId, currentFilter, search]);

  useEffect(() => {
    let timeoutId;
    if (!toast) return undefined;

    timeoutId = setTimeout(() => setToast(''), 2500);
    return () => clearTimeout(timeoutId);
  }, [toast]);

  const loadDocuments = async () => {
    try {
      const response = await fetch(API);
      if (!response.ok) throw new Error('No se pudieron cargar los documentos');
      const data = await response.json();
      setDocuments(data);
    } catch (error) {
      setDocuments([]);
      setToast(error.message);
    }
  };

  const loadFolders = async () => {
    try {
      const response = await fetch(FOLDERS_API);
      if (!response.ok) throw new Error('No se pudieron cargar las carpetas');
      setFolders(await readResponse(response));
    } catch (error) {
      showToast(error.message);
    }
  };

  const loadUsers = async () => {
    try {
      const response = await fetch(USERS_API);
      if (!response.ok) throw new Error('No se pudieron cargar los usuarios');
      const data = await response.json();
      setMembers(data);

      const currentUser = data.find((member) => member.email.toLowerCase() === userName.toLowerCase())
        || data.find((member) => member.name.toLowerCase() === userName.toLowerCase())
        || data[0];

      if (currentUser) {
        setProfile((prev) => ({ ...prev, ...currentUser, name: currentUser.name || prev.name }));
      }
    } catch (error) {
      showToast(error.message);
    }
  };

  const saveUser = async (payload) => {
    try {
      const response = await fetch(`${USERS_API}/${payload.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await readResponse(response);
      if (!response.ok) throw new Error(data.error || 'No se pudo guardar el usuario');

      setMembers((current) => current.map((member) =>
        Number(member.id) === Number(data.id) ? data : member
      ));
      setProfile((current) => ({ ...current, ...data }));
      onUserUpdate(data.name && data.name.trim() ? data.name : userName);
      return data;
    } catch (error) {
      showToast(error.message);
      return null;
    }
  };

  const handleRoleChange = async (id, nextRole) => {
    const member = members.find((item) => Number(item.id) === Number(id));
    if (!member) return;
    const updated = { ...member, role: nextRole };
    const result = await saveUser(updated);
    if (result) {
      showToast('Rol actualizado correctamente');
    }
  };

  const handleProfileChange = (field, value) => {
    setProfile((current) => ({ ...current, [field]: value }));
  };

  useEffect(() => {
    loadDocuments();
    loadFolders();
    loadUsers();
  }, [userName]);

  const showToast = (message) => setToast(message);

  const createFolder = async (event) => {
    event.preventDefault();
    const name = newFolderName.trim();
    if (!name) return;

    try {
      const response = await fetch(FOLDERS_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const data = await readResponse(response);
      if (!response.ok) throw new Error(data.error || 'No se pudo crear la carpeta');
      setFolders((current) => [...current, data].sort((a, b) => a.name.localeCompare(b.name)));
      setNewFolderName('');
      setCurrentFolderId(data.id);
      showToast('Carpeta creada');
    } catch (error) {
      showToast(error.message);
    }
  };

  const removeFolder = async (folder) => {
    if (!window.confirm(`¿Eliminar la carpeta "${folder.name}"?`)) return;

    try {
      const response = await fetch(`${FOLDERS_API}/${folder.id}`, { method: 'DELETE' });
      const data = await readResponse(response);
      if (!response.ok) throw new Error(data.error || 'No se pudo eliminar la carpeta');
      setFolders((current) => current.filter((item) => item.id !== folder.id));
      if (currentFolderId === folder.id) setCurrentFolderId(null);
      showToast('Carpeta eliminada');
    } catch (error) {
      showToast(error.message);
    }
  };

  const uploadFiles = async (fileList) => {
    if (!fileList || !fileList.length) return;

    const form = new FormData();
    if (currentFolderId) form.append('folderId', currentFolderId);
    Array.from(fileList).forEach((file) => form.append('documents', file));

    try {
      showToast('Subiendo documentos...');
      const response = await fetch(`${API}/upload`, {
        method: 'POST',
        body: form,
      });
      const data = await readResponse(response);
      if (!response.ok) throw new Error(data.error || 'Error al subir');
      await loadDocuments();
      await loadFolders();
      showToast(`${data.length} documento(s) subido(s) correctamente`);
    } catch (error) {
      showToast(error.message);
    }
  };

  const download = (id) => {
    window.open(`${API}/${id}/download`, '_blank');
  };

  const closePreview = () => {
    setSelectedId(null);
    setIsFullPreview(false);
    setPreview({
      type: 'empty',
      title: 'Vista previa',
      info: 'Selecciona un documento',
      value: '',
    });
  };

  const previewDocument = async (id) => {
    const doc = documents.find((item) => item.id === id);
    if (!doc) return;

    setSelectedId(id);
    setIsFullPreview(false);
    setPreview({
      type: 'loading',
      title: doc.name,
      info: `${size(doc.size)} · ${date(doc.createdAt)}`,
      value: '',
    });

    const url = doc.previewUrl;
    const group = groupFor(doc);

    try {
      if (group === 'pdf') {
        setPreview({
          type: 'pdf',
          title: doc.name,
          info: `${size(doc.size)} · ${date(doc.createdAt)}`,
          value: url,
        });
        return;
      }

      if (group === 'image') {
        setPreview({
          type: 'image',
          title: doc.name,
          info: `${size(doc.size)} · ${date(doc.createdAt)}`,
          value: url,
        });
        return;
      }

      if (doc.name.toLowerCase().endsWith('.txt')) {
        const text = await fetch(url).then((response) => response.text());
        setPreview({
          type: 'html',
          title: doc.name,
          info: `${size(doc.size)} · ${date(doc.createdAt)}`,
          value: `<pre class="document-preview">${escapeHTML(text)}</pre>`,
        });
        return;
      }

      if (doc.name.toLowerCase().endsWith('.docx')) {
        const buffer = await fetch(url).then((response) => response.arrayBuffer());
        const result = await mammoth.convertToHtml({ arrayBuffer: buffer });
        setPreview({
          type: 'html',
          title: doc.name,
          info: `${size(doc.size)} · ${date(doc.createdAt)}`,
          value: `<article class="document-preview">${result.value}</article>`,
        });
        return;
      }

      if (/\.(xlsx|xls|csv)$/.test(doc.name.toLowerCase())) {
        const buffer = await fetch(url).then((response) => response.arrayBuffer());
        const workbook = XLSX.read(buffer, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        setPreview({
          type: 'html',
          title: doc.name,
          info: `${size(doc.size)} · ${date(doc.createdAt)}`,
          value: `<div class="document-preview">${XLSX.utils.sheet_to_html(sheet)}</div>`,
        });
        return;
      }

      setPreview({
        type: 'empty-alt',
        title: doc.name,
        info: `${size(doc.size)} · ${date(doc.createdAt)}`,
        value: '',
      });
    } catch (error) {
      setPreview({
        type: 'error',
        title: doc.name,
        info: `${size(doc.size)} · ${date(doc.createdAt)}`,
        value: error.message,
      });
    }
  };

  const removeDocument = async (id) => {
    const doc = documents.find((item) => item.id === id);
    if (!doc || !window.confirm(`¿Eliminar "${doc.name}"?`)) return;

    try {
      const response = await fetch(`${API}/${id}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se pudo eliminar');
      if (selectedId === id) closePreview();
      await loadDocuments();
      showToast('Documento eliminado');
    } catch (error) {
      showToast(error.message);
    }
  };

  const renderPreview = () => {
    if (preview.type === 'empty' || preview.type === 'empty-alt') {
      return (
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
    }

    if (preview.type === 'loading') {
      return (
        <div className="empty-preview">
          <span>⏳</span>
          <h3>Cargando vista previa...</h3>
        </div>
      );
    }

    if (preview.type === 'pdf') {
      return <iframe className="preview-frame" title={preview.title} src={preview.value} />;
    }

    if (preview.type === 'image') {
      return <img className="preview-image" src={preview.value} alt={preview.title} />;
    }

    if (preview.type === 'html') {
      return <div dangerouslySetInnerHTML={{ __html: preview.value }} />;
    }

    if (preview.type === 'error') {
      return (
        <div className="empty-preview">
          <span>⚠️</span>
          <h3>No se pudo visualizar</h3>
          <p>{preview.value}</p>
        </div>
      );
    }

    return null;
  };

  const renderMainContent = () => {
    if (activeView === 'home') {
      return <HomeOverview userName={userName} members={members} onRoleChange={handleRoleChange} />;
    }

    if (activeView === 'profile') {
      return (
        <ProfileView
          userName={userName}
          profile={profile}
          onUserUpdate={(name) => {
            const nextProfile = { ...profile, name };
            setProfile(nextProfile);
            saveUser(nextProfile);
            onUserUpdate(name);
          }}
          onProfileChange={handleProfileChange}
          onSaveMessage={(message) => setToast(message)}
        />
      );
    }

    return (
      <section className={`dashboard ${selectedId && isFullPreview ? 'preview-mode' : ''}`}>
        <div className="documents-panel">
          <div className="title-row">
            <div>
              <h1>{currentFolderId ? folders.find((folder) => folder.id === currentFolderId)?.name : 'Mis documentos'}</h1>
              <p>{currentFolderId ? 'Documentos guardados en esta carpeta.' : 'Gestiona tus archivos de forma simple y segura.'}</p>
            </div>
            <button className="primary-btn" onClick={() => fileInputRef.current?.click()}>
              ☁ Subir documentos
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              hidden
              onChange={(event) => uploadFiles(event.target.files)}
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
              uploadFiles(event.dataTransfer.files);
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
                  onClick={() => setCurrentFilter(filter)}
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
            <button className="secondary-btn" onClick={loadDocuments}>
              ↻ Actualizar
            </button>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Documento</th>
                  <th>Tipo</th>
                  <th>Tamaño</th>
                  <th>Fecha</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {visibleDocuments.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="empty-row">
                      No hay documentos para mostrar.
                    </td>
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
                        <td>
                          <span className="badge">{group.toUpperCase()}</span>
                        </td>
                        <td>{size(doc.size)}</td>
                        <td>{date(doc.createdAt)}</td>
                        <td>
                          <button className="action preview" title="Visualizar" onClick={() => previewDocument(doc.id)}>
                            ◉
                          </button>
                          <button className="action download" title="Descargar" onClick={() => download(doc.id)}>
                            ⇩
                          </button>
                          <button className="action delete" title="Eliminar" onClick={() => removeDocument(doc.id)}>
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

        <aside className="preview-panel">
          <div className="preview-header">
            <div>
              <h2>{preview.title}</h2>
              <small>{preview.info}</small>
            </div>
            <button className="close-btn" onClick={closePreview}>
              ← Volver
            </button>
          </div>

          <div className="preview-actions">
            <button
              className="primary-btn small"
              onClick={() => (selectedDocument ? download(selectedDocument.id) : showToast('Selecciona un documento'))}
            >
              ⇩ Descargar
            </button>
            {selectedDocument && !isFullPreview && (
              <button className="secondary-btn small open-full-btn" type="button" onClick={() => setIsFullPreview(true)}>
                ⛶ Abrir completo
              </button>
            )}
          </div>

          <div className="preview-content">{renderPreview()}</div>
        </aside>
      </section>
    );
  };

  return (
    <>
      <div className="app">
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
              onClick={() => setActiveView('home')}
            >
              ⌂ <span>Inicio</span>
            </button>
            <button
              type="button"
              className={`nav-item nav-button ${activeView === 'documents' ? 'active' : ''}`}
              onClick={() => {
                setActiveView('documents');
                setCurrentFolderId(null);
              }}
            >
              ▣ <span>Mis documentos</span>
            </button>
            <button
              type="button"
              className={`nav-item nav-button ${activeView === 'profile' ? 'active' : ''}`}
              onClick={() => setActiveView('profile')}
            >
              ☺ <span>Perfil</span>
            </button>
            <a href="#" className="nav-item" onClick={(event) => {
              event.preventDefault();
              fileInputRef.current?.click();
            }}>
              ☁ <span>Subir documentos</span>
            </a>
            <a href="#" className="nav-item">
              ⚙ <span>Configuración</span>
            </a>
          </nav>

          <div className="folder-section">
            <div className="folder-heading">
              <strong>Carpetas</strong>
              <span>{folders.length}</span>
            </div>
            <form className="folder-create" onSubmit={createFolder}>
              <input
                value={newFolderName}
                onChange={(event) => setNewFolderName(event.target.value)}
                placeholder="Nueva carpeta"
                aria-label="Nombre de la nueva carpeta"
              />
              <button type="submit" title="Crear carpeta" aria-label="Crear carpeta">+</button>
            </form>
            <div className="folder-list">
              {folders.map((folder) => (
                <div className="folder-row" key={folder.id}>
                  <button
                    type="button"
                    className={`folder-button ${currentFolderId === folder.id ? 'active' : ''}`}
                    onClick={() => {
                      setActiveView('documents');
                      setCurrentFolderId(folder.id);
                    }}
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
                    onClick={() => removeFolder(folder)}
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
        </aside>

        <main>
          <header className="topbar">
            <div className="search-box">
              ⌕ <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar documentos..." />
            </div>
            <div className="user">
              <span className="avatar">{userName.charAt(0).toUpperCase()}</span>
              <span>{userName}</span>
              <button className="logout-button" type="button" onClick={onLogout}>Salir</button>
            </div>
          </header>

          {renderMainContent()}
        </main>
      </div>

      {toast && <div id="toast" className="show">{toast}</div>}
    </>
  );
}

export default function App() {
  const [userName, setUserName] = useState(() => localStorage.getItem('docugreen-user'));

  const handleAuthenticated = (name, token) => {
    localStorage.setItem('docugreen-user', name);
    localStorage.setItem('docugreen-token', token);
    setUserName(name);
  };

  const handleUserUpdate = (name) => {
    const cleanName = name.trim() || 'Usuario';
    localStorage.setItem('docugreen-user', cleanName);
    setUserName(cleanName);
  };

  const handleLogout = () => {
    localStorage.removeItem('docugreen-user');
    localStorage.removeItem('docugreen-token');
    setUserName(null);
  };

  if (!userName || !localStorage.getItem('docugreen-token')) {
    return <Login onAuthenticated={handleAuthenticated} />;
  }

  return <DocumentManager userName={userName} onLogout={handleLogout} onUserUpdate={handleUserUpdate} />;
}
