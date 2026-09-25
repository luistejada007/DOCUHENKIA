import { useState } from 'react';

const initialSignIn = { email: '', password: '' };
const initialSignUp = { name: '', email: '', password: '' };

export default function Login({ onAuthenticated }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [signIn, setSignIn] = useState(initialSignIn);
  const [signUp, setSignUp] = useState(initialSignUp);
  const [showSignInPassword, setShowSignInPassword] = useState(false);
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const submitSignIn = async (event) => {
    event.preventDefault();
    if (!signIn.email.trim() || !signIn.password) {
      setError('Ingresa tu correo y contraseña para continuar.');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: signIn.email.trim(),
          password: signIn.password,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Usuario o contraseña inválidos.');

      const token = typeof data === 'string'
        ? data
        : data.token
          || data.access_token
          || data.accessToken
          || data.session_token
          || data.data?.token
          || data.data?.access_token
          || data.result?.token;
      if (!token) throw new Error('La API no devolvió un token de sesión.');
      onAuthenticated(signIn.email.trim(), token);
    } catch (requestError) {
      setError(requestError.message || 'No fue posible iniciar sesión.');
    } finally {
      setIsLoading(false);
    }
  };

  const submitSignUp = (event) => {
    event.preventDefault();
    setError('El registro todavía no está disponible en la API de autenticación.');
  };

  return (
    <main className={`login-page ${isSignUp ? 'login-page--signup' : ''}`}>
      <section className="login-container" aria-label="Acceso a DOCUHENKIA">
        <div className="login-brand">
          <img src="/docuhenkia-logo.png" alt="Logo DOCUHENKIA" />
          <strong>DOCUHENKIA</strong>
        </div>
        <div className="login-form-panel">
          <form className="login-form login-form--signin" onSubmit={submitSignIn}>
            <h1>Iniciar sesión</h1>
            <div className="login-socials" aria-label="Proveedores de acceso">
              <button type="button" aria-label="Iniciar sesión con Google">G</button>
              <button type="button" aria-label="Iniciar sesión con Microsoft">M</button>
            </div>
            <span>Usa tu usuario y contraseña</span>
            <label className="login-input">
              <span aria-hidden="true">@</span>
              <input
                type="text"
                placeholder="Usuario"
                value={signIn.email}
                onChange={(event) => setSignIn({ ...signIn, email: event.target.value })}
                autoComplete="username"
              />
            </label>
            <label className="login-input login-input--password">
              <span aria-hidden="true">*</span>
              <input
                type={showSignInPassword ? 'text' : 'password'}
                placeholder="Contraseña"
                value={signIn.password}
                onChange={(event) => setSignIn({ ...signIn, password: event.target.value })}
                autoComplete="current-password"
              />
              <button
                type="button"
                className="password-toggle"
                aria-label={showSignInPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                onClick={() => setShowSignInPassword((current) => !current)}
              >
                {showSignInPassword ? 'Ocultar' : 'Ver'}
              </button>
            </label>
            <button className="login-button" type="submit" disabled={isLoading}>
              {isLoading ? 'Validando...' : 'Iniciar DOCUHENKIA'}
            </button>
          </form>

          <form className="login-form login-form--signup" onSubmit={submitSignUp}>
            <h1>Registrarse</h1>
            <div className="login-socials" aria-label="Proveedores de registro">
              <button type="button" aria-label="Registrarse con Google">G</button>
              <button type="button" aria-label="Registrarse con Microsoft">M</button>
            </div>
            <span>Regístrate usando tu correo</span>
            <label className="login-input">
              <span aria-hidden="true">●</span>
              <input
                type="text"
                placeholder="Nombre de usuario"
                value={signUp.name}
                onChange={(event) => setSignUp({ ...signUp, name: event.target.value })}
                autoComplete="name"
              />
            </label>
            <label className="login-input">
              <span aria-hidden="true">@</span>
              <input
                type="email"
                placeholder="Email"
                value={signUp.email}
                onChange={(event) => setSignUp({ ...signUp, email: event.target.value })}
                autoComplete="email"
              />
            </label>
            <label className="login-input login-input--password">
              <span aria-hidden="true">*</span>
              <input
                type={showSignUpPassword ? 'text' : 'password'}
                placeholder="Contraseña"
                value={signUp.password}
                onChange={(event) => setSignUp({ ...signUp, password: event.target.value })}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="password-toggle"
                aria-label={showSignUpPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                onClick={() => setShowSignUpPassword((current) => !current)}
              >
                {showSignUpPassword ? 'Ocultar' : 'Ver'}
              </button>
            </label>
            <button className="login-button" type="submit">Registrarse</button>
          </form>
        </div>

        <div className="login-welcome-panel">
          <div className="login-welcome login-welcome--signin">
            <h2>¡Bienvenido a DOCUHENKIA!</h2>
            <p>Accede a tus documentos desde un solo lugar.</p>
            <button className="login-button login-button--outline" type="button" onClick={() => { setError(''); setIsSignUp(true); }}>
              Registrarse
            </button>
          </div>
          <div className="login-welcome login-welcome--signup">
            <h2>¡Únete a DOCUHENKIA!</h2>
            <p>Organiza y gestiona tus documentos de forma simple.</p>
            <button className="login-button login-button--outline" type="button" onClick={() => { setError(''); setIsSignUp(false); }}>
              Iniciar sesión
            </button>
          </div>
        </div>
      </section>
      {error && <p className="login-error" role="alert">{error}</p>}
    </main>
  );
}
