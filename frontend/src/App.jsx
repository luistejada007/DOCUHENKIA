import { useEffect, useMemo, useRef, useState } from 'react';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import Login from './Login';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import ProfileView from './components/ProfileView';
import HomeOverview from './components/HomeOverview';
import DocumentWorkspace from './components/DocumentWorkspace';
import DocumentTypeDialog from './components/DocumentTypeDialog';
import FolderDeleteDialog from './components/FolderDeleteDialog';
import TrashView from './components/TrashView';
import { date, escapeHTML, groupFor, size } from './utils/documents';
import { APP_ROLES } from './utils/roles';

const API = '/api/documents';
const FOLDERS_API = '/api/folders';
const USERS_API = '/api/users';
const TRASH_API = '/api/trash';

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

function DocumentManager({ userName, onLogout, onUserUpdate }) {
  const [documents, setDocuments] = useState([]);
  const [members, setMembers] = useState([]);
  const [activity, setActivity] = useState([]);
  const [profile, setProfile] = useState({
    id: null,
    name: userName,
    email: userName,
    area: 'Sin área',
    role: 'Visualizador',
    status: 'Activo',
    phone: '',
    team: 'Sin equipo',
  });
  const isAdmin = profile.role === 'Administrador' && profile.status === 'Activo';
  const [folders, setFolders] = useState([]);
  const [trashItems, setTrashItems] = useState([]);
  const [isTrashLoading, setIsTrashLoading] = useState(false);
  const [currentFolderId, setCurrentFolderId] = useState(null);
  const [folderAccessRoles, setFolderAccessRoles] = useState(APP_ROLES);
  const [selectedId, setSelectedId] = useState(null);
  const [isFullPreview, setIsFullPreview] = useState(false);
  const [currentFilter, setCurrentFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [activeView, setActiveView] = useState('home');
  const [toast, setToast] = useState('');
  const [pendingUploadFiles, setPendingUploadFiles] = useState(null);
  const [pendingUploadFolderName, setPendingUploadFolderName] = useState('');
  const [documentType, setDocumentType] = useState('');
  const [sharingScope, setSharingScope] = useState('');
  const [folderToDelete, setFolderToDelete] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [preview, setPreview] = useState({
    type: 'empty',
    title: 'Vista previa',
    info: 'Selecciona un documento',
    value: '',
  });
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);
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

  const loadTrash = async () => {
    setIsTrashLoading(true);
    try {
      const response = await fetch(TRASH_API);
      const data = await readResponse(response);
      if (!response.ok) throw new Error(data.error || 'No se pudo cargar la papelera');
      setTrashItems(data);
    } catch (error) {
      showToast(error.message);
    } finally {
      setIsTrashLoading(false);
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
      if (response.status === 401) {
        onLogout();
        return;
      }
      if (!response.ok) throw new Error('No se pudieron cargar los usuarios');
      const data = await response.json();
      setMembers(data);

      const normalizedUserName = userName.trim().toLowerCase();
      const currentUser = data.find((member) => member.email.trim().toLowerCase() === normalizedUserName)
        || data.find((member) => member.name.trim().toLowerCase() === normalizedUserName);

      if (currentUser) {
        setProfile((prev) => ({ ...prev, ...currentUser, name: currentUser.name || prev.name }));
      }
    } catch (error) {
      showToast(error.message);
    }
  };

  const loadActivity = async () => {
    try {
      const response = await fetch(`${USERS_API}/activity`);
      if (response.status === 401) {
        onLogout();
        return;
      }
      if (!response.ok) throw new Error('No se pudo actualizar la actividad');
      setActivity(await response.json());
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
      if (Number(data.id) === Number(profile.id)) {
        setProfile((current) => ({ ...current, ...data }));
        onUserUpdate(data.name && data.name.trim() ? data.name : userName);
      }
      return data;
    } catch (error) {
      showToast(error.message);
      return null;
    }
  };

  const saveUserChanges = async (updates) => {
    for (const update of updates) {
      const saved = await saveUser(update);
      if (!saved) return false;
    }
    showToast('Cambios guardados en la base de datos');
    return true;
  };

  const deleteUser = async (member) => {
    try {
      const response = await fetch(`${USERS_API}/${member.id}`, { method: 'DELETE' });
      const data = await readResponse(response);
      if (!response.ok) throw new Error(data.error || 'No se pudo eliminar el usuario');
      setMembers((current) => current.filter((item) => Number(item.id) !== Number(member.id)));
      showToast('Usuario eliminado de la aplicación y de la base de datos');
      return true;
    } catch (error) {
      showToast(error.message);
      return false;
    }
  };

  const createUser = async (payload) => {
    try {
      const response = await fetch(USERS_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await readResponse(response);
      if (!response.ok) throw new Error(data.error || 'No se pudo crear el usuario');
      setMembers((current) => [...current, data]);
      showToast('Usuario creado correctamente');
      return data;
    } catch (error) {
      showToast(error.message);
      return null;
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

  useEffect(() => {
    const heartbeat = async () => {
      try {
        const response = await fetch('/api/auth/heartbeat');
        if (response.status === 401 || response.status === 403) onLogout();
      } catch {
        showToast('Se perdió la conexión con el servidor');
      }
    };

    const intervalId = setInterval(heartbeat, 15000);
    return () => clearInterval(intervalId);
  }, [userName]);

  useEffect(() => {
    if (!isAdmin) {
      setActivity([]);
      return undefined;
    }
    loadActivity();
    const intervalId = setInterval(loadActivity, 5000);
    return () => clearInterval(intervalId);
  }, [isAdmin, userName]);

  const showToast = (message) => setToast(message);

  const createFolder = async (folder) => {
    try {
      const response = await fetch(FOLDERS_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(folder),
      });
      const data = await readResponse(response);
      if (!response.ok) throw new Error(data.error || 'No se pudo crear la carpeta');
      setFolders((current) => [...current, data].sort((a, b) => a.name.localeCompare(b.name)));
      setCurrentFolderId(data.id);
      showToast('Carpeta creada');
      return true;
    } catch (error) {
      showToast(error.message);
      return false;
    }
  };

  const removeFolder = (folder) => setFolderToDelete(folder);

  const confirmFolderDeletion = async (scope) => {
    if (!folderToDelete) return;
    try {
      const response = await fetch(`${FOLDERS_API}/${folderToDelete.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope }),
      });
      const data = await readResponse(response);
      if (!response.ok) throw new Error(data.error || 'No se pudo eliminar la carpeta');
      const removedFolderIds = new Set(scope === 'all'
        ? data.deletedFolderIds || [folderToDelete.id]
        : [folderToDelete.id]);
      setFolders((current) => current.filter((item) => !removedFolderIds.has(item.id)));
      if (scope === 'all') {
        const deletedIds = new Set(data.deletedDocumentIds || []);
        setDocuments((current) => current.filter((document) => !deletedIds.has(document.id)));
      } else {
        await loadDocuments();
      }
      if (currentFolderId && removedFolderIds.has(currentFolderId)) {
        const privateCopy = scope === 'all' && folders.find((folder) =>
          folder.name.toLocaleLowerCase() === folderToDelete.name.toLocaleLowerCase()
          && folder.isShared === false
          && !removedFolderIds.has(folder.id)
        );
        setCurrentFolderId(privateCopy?.id || null);
      }
      setFolderToDelete(null);
      showToast(scope === 'all'
        ? `${removedFolderIds.size} carpeta(s) compartida(s) eliminada(s); las personales se conservaron`
        : 'Carpeta eliminada de tu vista');
    } catch (error) {
      showToast(error.message);
    }
  };

  const uploadFiles = (fileList, asFolder = false) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;

    setPendingUploadFiles(files);
    setPendingUploadFolderName(asFolder ? files[0].webkitRelativePath?.split('/')[0] || '' : '');
    setDocumentType('');
    setSharingScope('');
    setFolderAccessRoles(APP_ROLES);
    setUploadProgress(0);
  };

  const uploadSelectedFiles = async (event) => {
    event.preventDefault();
    if (!pendingUploadFiles?.length || !documentType || !sharingScope || isUploading) return;
    if (pendingUploadFolderName && sharingScope === 'all' && !folderAccessRoles.length) {
      showToast('Selecciona al menos un rol para compartir la carpeta');
      return;
    }

    let uploadedCount = 0;
    setIsUploading(true);
    try {
      let destinationFolderId = currentFolderId;
      if (pendingUploadFolderName) {
        const existingFolder = folders.find((folder) =>
          folder.name.toLocaleLowerCase() === pendingUploadFolderName.toLocaleLowerCase()
          && (folder.isShared !== false) === (sharingScope === 'all')
          && (sharingScope !== 'all' || APP_ROLES.every((role) =>
            (folder.accessRoles || APP_ROLES).includes(role) === folderAccessRoles.includes(role)
          ))
        );

        if (existingFolder) {
          destinationFolderId = existingFolder.id;
        } else {
          const folderResponse = await fetch(FOLDERS_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: pendingUploadFolderName,
              isShared: sharingScope === 'all',
              accessRoles: sharingScope === 'all' ? folderAccessRoles : [],
            }),
          });
          const folderData = await readResponse(folderResponse);
          if (!folderResponse.ok) throw new Error(folderData.error || 'No se pudo crear la carpeta');
          setFolders((current) => [...current, folderData].sort((a, b) => a.name.localeCompare(b.name)));
          destinationFolderId = folderData.id;
        }
      }

      for (let start = 0; start < pendingUploadFiles.length; start += 10) {
        const batch = pendingUploadFiles.slice(start, start + 10);
        const form = new FormData();
        if (destinationFolderId) form.append('folderId', destinationFolderId);
        form.append('documentType', documentType);
        form.append('isShared', String(sharingScope === 'all'));
        batch.forEach((file) => form.append('documents', file));

        showToast(`Subiendo ${uploadedCount} de ${pendingUploadFiles.length} documentos...`);
        const response = await fetch(`${API}/upload`, { method: 'POST', body: form });
        const data = await readResponse(response);
        if (!response.ok) throw new Error(data.error || 'Error al subir');
        uploadedCount += data.length;
        setUploadProgress(uploadedCount);
      }

      await loadDocuments();
      await loadFolders();
      showToast(`${uploadedCount} documento(s) subido(s) correctamente`);
      if (pendingUploadFolderName) {
        setActiveView('documents');
        setCurrentFolderId(destinationFolderId);
      }
      setPendingUploadFiles(null);
      setPendingUploadFolderName('');
      setDocumentType('');
      setSharingScope('');
    } catch (error) {
      if (uploadedCount) {
        setPendingUploadFiles((current) => current?.slice(uploadedCount) || current);
        setUploadProgress(0);
        showToast(`Se subieron ${uploadedCount} archivos; ${error.message}. Puedes reintentar los restantes.`);
      } else {
        showToast(error.message);
      }
    } finally {
      setIsUploading(false);
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
      showToast('Documento movido a la papelera');
    } catch (error) {
      showToast(error.message);
    }
  };

  const restoreTrashItem = async (item) => {
    try {
      const response = await fetch(`${TRASH_API}/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id }),
      });
      const data = await readResponse(response);
      if (!response.ok) throw new Error(data.error || 'No se pudo restaurar');
      await Promise.all([loadTrash(), loadDocuments(), loadFolders()]);
      showToast(`${data.restoredCount || 1} elemento(s) restaurado(s)`);
    } catch (error) {
      showToast(error.message);
    }
  };

  const emptyTrash = async () => {
    if (!window.confirm(isAdmin
      ? '¿Vaciar la papelera para todos? Los archivos globales eliminados se borrarán permanentemente.'
      : '¿Vaciar tu papelera? Los elementos dejarán de poder restaurarse para ti.')) return;

    try {
      const response = await fetch(TRASH_API, { method: 'DELETE' });
      const data = await readResponse(response);
      if (!response.ok) throw new Error(data.error || 'No se pudo vaciar la papelera');
      setTrashItems([]);
      await Promise.all([loadDocuments(), loadFolders()]);
      showToast(`Papelera vaciada (${data.deletedCount} elemento(s))`);
    } catch (error) {
      showToast(error.message);
    }
  };

  const renderMainContent = () => {
    if (activeView === 'home') {
      return (
        <HomeOverview
          userName={userName}
          profile={profile}
          members={members}
          activity={activity}
          isAdmin={isAdmin}
          onSaveChanges={saveUserChanges}
          onDeleteUser={deleteUser}
          onCreateUser={createUser}
        />
      );
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

    if (activeView === 'trash') {
      return (
        <TrashView
          items={trashItems}
          isAdmin={isAdmin}
          isLoading={isTrashLoading}
          onRefresh={loadTrash}
          onRestore={restoreTrashItem}
          onEmpty={emptyTrash}
        />
      );
    }

    return (
      <DocumentWorkspace
        currentFolderId={currentFolderId}
        folders={folders}
        fileInputRef={fileInputRef}
        folderInputRef={folderInputRef}
        dropzoneRef={dropzoneRef}
        onUploadFiles={uploadFiles}
        currentFilter={currentFilter}
        onFilterChange={setCurrentFilter}
        onRefresh={loadDocuments}
        visibleDocuments={visibleDocuments}
        onPreviewDocument={previewDocument}
        onDownload={download}
        onRemoveDocument={removeDocument}
        preview={preview}
        selectedDocument={selectedDocument}
        isFullPreview={isFullPreview}
        onClosePreview={closePreview}
        onOpenFullPreview={() => setIsFullPreview(true)}
        onShowToast={showToast}
      />
    );
  };

  return (
    <>
      <div className="app">
        <Sidebar
          activeView={activeView}
          onViewChange={setActiveView}
          folders={folders}
          currentFolderId={currentFolderId}
          onFolderSelect={(folderId) => {
            setActiveView('documents');
            setCurrentFolderId(folderId);
          }}
          onCreateFolder={createFolder}
          onDeleteFolder={removeFolder}
          onUploadClick={() => fileInputRef.current?.click()}
          onTrashClick={() => {
            setActiveView('trash');
            loadTrash();
          }}
        />

        <main>
          <Topbar userName={userName} search={search} onSearchChange={setSearch} onLogout={onLogout} />

          {renderMainContent()}
        </main>
      </div>

      {pendingUploadFiles && (
        <DocumentTypeDialog
          files={pendingUploadFiles}
          documentType={documentType}
          onDocumentTypeChange={setDocumentType}
          sharingScope={sharingScope}
          onSharingScopeChange={setSharingScope}
          folderAccessRoles={folderAccessRoles}
          onFolderAccessRolesChange={setFolderAccessRoles}
          onCancel={() => {
            if (isUploading) return;
            setPendingUploadFiles(null);
            setPendingUploadFolderName('');
            setDocumentType('');
            setSharingScope('');
          }}
          onSubmit={uploadSelectedFiles}
          isUploading={isUploading}
          uploadProgress={uploadProgress}
          folderName={pendingUploadFolderName}
        />
      )}

      {folderToDelete && (
        <FolderDeleteDialog
          folder={folderToDelete}
          isAdmin={isAdmin}
          onCancel={() => setFolderToDelete(null)}
          onDelete={confirmFolderDeletion}
        />
      )}

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
    fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    localStorage.removeItem('docugreen-user');
    localStorage.removeItem('docugreen-token');
    setUserName(null);
  };

  if (!userName || !localStorage.getItem('docugreen-token')) {
    return <Login onAuthenticated={handleAuthenticated} />;
  }

  return <DocumentManager userName={userName} onLogout={handleLogout} onUserUpdate={handleUserUpdate} />;
}
