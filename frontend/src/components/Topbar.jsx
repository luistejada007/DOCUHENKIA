import UserAvatar from './UserAvatar';

export default function Topbar({ user, userName, search, onSearchChange, onLogout }) {
  return (
    <header className="topbar">
      <div className="search-box">
        ⌕ <input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Buscar documentos..."
          aria-label="Buscar documentos"
        />
      </div>
      <div className="user">
        <UserAvatar user={user} />
        <span className="topbar-user-name">{userName}</span>
        <button className="logout-button" type="button" onClick={onLogout}>Salir</button>
      </div>
    </header>
  );
}