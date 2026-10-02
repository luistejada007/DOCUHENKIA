import { useState } from 'react';

const emptyNewUser = {
  name: '',
  email: '',
  role: 'Visualizador',
  team: '',
  area: '',
  phone: '',
  status: 'Activo',
};

const MEMBERS_PER_PAGE = 5;

function dateTime(value) {
  return value ? new Date(value).toLocaleString('es-CO') : 'Sin registros';
}

export default function HomeOverview({ userName, profile, members, activity, isAdmin, onSaveChanges, onDeleteUser, onCreateUser }) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newUser, setNewUser] = useState(emptyNewUser);
  const [editingMember, setEditingMember] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);
  const [pendingChanges, setPendingChanges] = useState({});
  const [isSavingChanges, setIsSavingChanges] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [memberPage, setMemberPage] = useState(1);

  const updateNewUser = (field, value) => {
    setNewUser((current) => ({ ...current, [field]: value }));
  };

  const submitNewUser = async (event) => {
    event.preventDefault();
    const created = await onCreateUser(newUser);
    if (created) {
      setNewUser(emptyNewUser);
      setIsCreateOpen(false);
    }
  };

  const updateDraft = (id, field, value) => {
    setPendingChanges((current) => ({
      ...current,
      [id]: { ...current[id], [field]: value },
    }));
  };

  const saveChanges = async () => {
    if (isSavingChanges) return;
    setIsSavingChanges(true);
    const updates = Object.entries(pendingChanges).map(([id, changes]) => {
      const member = members.find((item) => Number(item.id) === Number(id));
      return member ? { ...member, ...changes } : null;
    }).filter(Boolean);

    try {
      const saved = await onSaveChanges(updates);
      if (saved) setPendingChanges({});
    } finally {
      setIsSavingChanges(false);
    }
  };

  const deleteMember = async (member) => {
    if (!window.confirm(`¿Eliminar permanentemente a ${member.name}?`)) return;
    if (await onDeleteUser(member)) {
      setPendingChanges((current) => {
        const next = { ...current };
        delete next[member.id];
        return next;
      });
    }
  };

  const openNameEditor = (member) => {
    setEditingMember(member);
    setEditingName(member.name);
  };

  const saveMemberName = async (event) => {
    event.preventDefault();
    const name = editingName.trim();
    if (!name || !editingMember || isSavingName) return;

    setIsSavingName(true);
    try {
      if (await onSaveChanges([{ ...editingMember, name }])) {
        setEditingMember(null);
        setEditingName('');
      }
    } finally {
      setIsSavingName(false);
    }
  };

  const summary = [
    { label: 'Usuarios', value: members.length, tone: 'green' },
    { label: 'Administradores', value: members.filter((member) => member.role === 'Administrador').length, tone: 'dark' },
    { label: 'Edición activa', value: members.filter((member) => member.role === 'Editor').length, tone: 'blue' },
    { label: 'Pendientes', value: members.filter((member) => member.status === 'Pendiente').length, tone: 'amber' },
  ];
  const normalizedMemberSearch = memberSearch.trim().toLocaleLowerCase();
  const filteredMembers = members.filter((member) => {
    const changes = pendingChanges[member.id] || {};
    return [member.name, member.email, member.team, changes.role ?? member.role, changes.status ?? member.status]
      .some((value) => String(value || '').toLocaleLowerCase().includes(normalizedMemberSearch));
  });
  const memberPageCount = Math.max(1, Math.ceil(filteredMembers.length / MEMBERS_PER_PAGE));
  const currentMemberPage = Math.min(memberPage, memberPageCount);
  const visibleMembers = filteredMembers.slice(
    (currentMemberPage - 1) * MEMBERS_PER_PAGE,
    currentMemberPage * MEMBERS_PER_PAGE
  );

  return (
    <section className="home-page">
      <div className="home-hero">
        <div>
          <p className="eyebrow">Panel principal</p>
          <h1>Bienvenido, {userName}</h1>
          <p className="home-subtitle">Revisa el estado general del equipo y administra los permisos del sistema.</p>
        </div>
        {isAdmin && <button type="button" className="primary-btn" onClick={() => setIsCreateOpen(true)}>+ Crear usuario</button>}
      </div>

      <div className="profile-layout">
        <div className="profile-card">
          <div className="profile-header">
            <span className="avatar avatar-large">{userName.charAt(0).toUpperCase()}</span>
            <div>
              <h2>{userName}</h2>
              <span>{profile.role}</span>
            </div>
          </div>

          <ul className="profile-details">
            <li><strong>Email</strong><span>{profile.email}</span></li>
            <li><strong>Área</strong><span>{profile.area}</span></li>
            <li><strong>Rol actual</strong><span>{profile.role}</span></li>
            <li><strong>Estado</strong><span className={`status-pill ${profile.status === 'Inactivo' ? 'status-pill--pending' : ''}`}>{profile.status}</span></li>
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

      {isAdmin && <div className="role-manager">
        <div className="role-header">
          <div>
            <p className="eyebrow">Seguridad</p>
            <h2>Asignación de roles</h2>
          </div>
          <button
            type="button"
            className="secondary-btn"
            onClick={saveChanges}
            disabled={isSavingChanges || Object.keys(pendingChanges).length === 0}
          >
            {isSavingChanges ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>

        <div className="member-table-tools">
          <label className="member-search">
            <span>Buscar usuario</span>
            <input
              type="search"
              value={memberSearch}
              onChange={(event) => {
                setMemberSearch(event.target.value);
                setMemberPage(1);
              }}
              placeholder="Nombre, correo, equipo o rol"
            />
          </label>
          <p className="member-result-count">
            {filteredMembers.length === 0
              ? 'Sin usuarios'
              : `Mostrando ${(currentMemberPage - 1) * MEMBERS_PER_PAGE + 1}-${Math.min(currentMemberPage * MEMBERS_PER_PAGE, filteredMembers.length)} de ${filteredMembers.length}`}
          </p>
        </div>

        <div className="table-container table-container--compact">
          <table>
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Equipo</th>
                <th>Rol</th>
                <th>Estado</th>
                <th>Conexión</th>
                <th>Último acceso</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {visibleMembers.length === 0 && (
                <tr><td className="member-empty" colSpan="7">No se encontraron usuarios.</td></tr>
              )}
              {visibleMembers.map((member) => {
                const changes = pendingChanges[member.id] || {};
                const isCurrentUser = Number(profile.id) === Number(member.id);
                const status = changes.status ?? member.status;
                const presence = activity.find((entry) => Number(entry.userId) === Number(member.id));
                const isOnline = Number(presence?.activeSessions) > 0;

                return (
                  <tr key={member.id}>
                    <td>
                      <div className="member-cell">
                        <span className="avatar avatar-small">{member.name.charAt(0).toUpperCase()}</span>
                        <div>
                          <div className="member-name-row">
                            <strong>{member.name}</strong>
                            <button
                              type="button"
                              className="action member-name-edit"
                              title={`Editar nombre de ${member.name}`}
                              aria-label={`Editar nombre de ${member.name}`}
                              disabled={isCurrentUser}
                              onClick={() => openNameEditor(member)}
                            >✎</button>
                          </div>
                          <small>{member.email}</small>
                        </div>
                      </div>
                    </td>
                    <td>{member.team}</td>
                    <td>
                      <select
                        value={changes.role ?? member.role}
                        onChange={(event) => updateDraft(member.id, 'role', event.target.value)}
                        className="role-select"
                        disabled={isCurrentUser}
                      >
                        <option>Administrador</option>
                        <option>Editor</option>
                        <option>Revisor</option>
                        <option>Visualizador</option>
                      </select>
                    </td>
                    <td>
                      <span className={`status-pill ${isOnline ? '' : 'status-pill--pending'}`}>
                        {isOnline ? 'En línea' : 'Desconectado'}
                      </span>
                    </td>
                    <td>{dateTime(presence?.lastLoginAt || member.lastLoginAt)}</td>
                    <td>
                      <select
                        value={['Activo', 'Inactivo', 'Pendiente'].includes(status) ? status : 'Activo'}
                        onChange={(event) => updateDraft(member.id, 'status', event.target.value)}
                        className="role-select status-select"
                        aria-label={`Estado de ${member.name}`}
                        disabled={isCurrentUser}
                      >
                        <option>Activo</option>
                        <option>Inactivo</option>
                        <option>Pendiente</option>
                      </select>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="action delete"
                        title={isCurrentUser ? 'No puedes eliminar tu propia sesión' : `Eliminar ${member.name}`}
                        aria-label={isCurrentUser ? 'No puedes eliminar tu propia sesión' : `Eliminar ${member.name}`}
                        disabled={isCurrentUser}
                        onClick={() => deleteMember(member)}
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {memberPageCount > 1 && (
          <nav className="member-pagination" aria-label="Paginación de usuarios">
            <button
              type="button"
              className="member-page-control"
              onClick={() => setMemberPage(currentMemberPage - 1)}
              disabled={currentMemberPage === 1}
            >Anterior</button>
            <div className="member-page-list">
              {Array.from({ length: memberPageCount }, (_, index) => index + 1).map((page) => (
                <button
                  type="button"
                  key={page}
                  className="member-page-number"
                  aria-current={page === currentMemberPage ? 'page' : undefined}
                  aria-label={`Página ${page}`}
                  onClick={() => setMemberPage(page)}
                >{page}</button>
              ))}
            </div>
            <button
              type="button"
              className="member-page-control"
              onClick={() => setMemberPage(currentMemberPage + 1)}
              disabled={currentMemberPage === memberPageCount}
            >Siguiente</button>
          </nav>
        )}
      </div>}

      {isAdmin && isCreateOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setIsCreateOpen(false)}>
          <form className="user-modal" onSubmit={submitNewUser} onMouseDown={(event) => event.stopPropagation()}>
            <div className="user-modal__header">
              <div>
                <p className="eyebrow">Administración</p>
                <h2>Crear usuario</h2>
              </div>
              <button type="button" className="close-btn" onClick={() => setIsCreateOpen(false)} aria-label="Cerrar">×</button>
            </div>
            <div className="user-form-grid">
              <label>Nombre<input required value={newUser.name} onChange={(event) => updateNewUser('name', event.target.value)} /></label>
              <label>Correo<input required type="email" value={newUser.email} onChange={(event) => updateNewUser('email', event.target.value)} /></label>
              <label>Rol<select value={newUser.role} onChange={(event) => updateNewUser('role', event.target.value)}><option>Administrador</option><option>Editor</option><option>Revisor</option><option>Visualizador</option></select></label>
              <label>Estado<select value={newUser.status} onChange={(event) => updateNewUser('status', event.target.value)}><option>Activo</option><option>Inactivo</option></select></label>
              <label>Equipo<input value={newUser.team} onChange={(event) => updateNewUser('team', event.target.value)} /></label>
              <label>Área<input value={newUser.area} onChange={(event) => updateNewUser('area', event.target.value)} /></label>
              <label>Teléfono<input value={newUser.phone} onChange={(event) => updateNewUser('phone', event.target.value)} /></label>
            </div>
            <div className="user-modal__actions">
              <button type="button" className="secondary-btn" onClick={() => setIsCreateOpen(false)}>Cancelar</button>
              <button type="submit" className="primary-btn">Crear usuario</button>
            </div>
          </form>
        </div>
      )}

      {isAdmin && editingMember && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setEditingMember(null)}>
          <form className="user-modal" onSubmit={saveMemberName} onMouseDown={(event) => event.stopPropagation()}>
            <div className="user-modal__header">
              <div>
                <p className="eyebrow">Administración</p>
                <h2>Editar nombre</h2>
              </div>
              <button type="button" className="close-btn" onClick={() => setEditingMember(null)} aria-label="Cerrar">×</button>
            </div>
            <div className="user-form-grid member-edit-form">
              <label>
                Nombre de {editingMember.name}
                <input
                  autoFocus
                  required
                  value={editingName}
                  onChange={(event) => setEditingName(event.target.value)}
                />
              </label>
            </div>
            <div className="user-modal__actions">
              <button type="button" className="secondary-btn" onClick={() => setEditingMember(null)}>Cancelar</button>
              <button type="submit" className="primary-btn" disabled={isSavingName}>
                {isSavingName ? 'Guardando...' : 'Guardar nombre'}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}