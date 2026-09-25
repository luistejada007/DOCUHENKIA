# DocuGreen Professional

Aplicación profesional para subir, listar, visualizar, descargar y eliminar documentos.

## Tecnologías

- Frontend: HTML, CSS y JavaScript
- Backend: Node.js + Express
- Subida de archivos: Multer
- Seguridad HTTP: Helmet
- Almacenamiento: archivos locales + JSON
- Arquitectura preparada para migrar a PostgreSQL

## Instalación

```bash
npm install
npm start
```

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

Para producción se recomienda:

1. Reemplazar `data/documents.json` por PostgreSQL.
2. Guardar archivos en S3, Cloudflare R2, Google Cloud Storage o Azure Blob Storage.
3. Añadir autenticación JWT/cookies seguras.
4. Añadir roles y permisos.
5. Configurar HTTPS y un proxy inverso.
