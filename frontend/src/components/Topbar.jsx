export default function Topbar({ userName, search, onSearchChange, onLogout }) {
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
        <span className="avatar">{userName.charAt(0).toUpperCase()}</span>
        <span>{userName}</span>
        <button className="logout-button" type="button" onClick={onLogout}>Salir</button>
      </div>
    </header>
  );
}