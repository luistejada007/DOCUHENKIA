# DocuGreen Professional

Aplicación profesional para subir, listar, visualizar, descargar y eliminar documentos.

## Tecnologías

- Frontend: HTML, CSS y JavaScript
- Backend: Node.js + Express
- Subida de archivos: Multer
- Seguridad HTTP: Helmet
- Base de datos: PostgreSQL para usuarios, carpetas y metadatos de documentos
- Archivos: almacenamiento local en `backend/uploads`
- Modo JSON local disponible si PostgreSQL no está configurado

## Instalación

1. Crea una base de datos vacía en PostgreSQL, por ejemplo `docuhenkia`.
2. Si todavía no tienes `.env`, copia `.env.example`; si ya existe, agrega allí `DATABASE_URL` con las credenciales de tu servidor. En proveedores que requieran TLS, configura `DB_SSL=true`.
3. Instala y arranca la aplicación:

```bash
npm install
npm start
```

Al iniciar, la aplicación crea las tablas necesarias e importa los datos JSON existentes para cada tabla que esté vacía. El estado del almacenamiento aparece en `GET /api/health`.

Si `DATABASE_URL` no está configurada, la aplicación conserva el modo JSON local. No compartas ni subas el archivo `.env` al repositorio.

Abre:

```text
http://localhost:3000
```

## Desarrollo

```bash
npm run dev
```

## API

- GET `/api/documents`
- POST `/api/documents/upload`
- GET `/api/documents/:id`
- GET `/api/documents/:id/download`
- DELETE `/api/documents/:id`

## Tipos permitidos

PDF, Word, Excel, TXT, JPG, JPEG, PNG, WEBP y GIF.

## Tamaño máximo

50 MB por archivo.

## Producción

Para producción se recomienda guardar los archivos en S3, Cloudflare R2, Google Cloud Storage o Azure Blob Storage; añadir autenticación JWT/cookies seguras, roles y permisos; y configurar HTTPS con un proxy inverso.
