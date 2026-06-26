# Reto Cavaltec — Plataforma de Autodiagnóstico de Cumplimiento Ley 1581

Este proyecto implementa una aplicación web multiempresa para autodiagnóstico de cumplimiento de protección de datos en la fase de diseño, alineada con el reto de Cavaltec: autenticación OAuth, cuestionario estructurado, porcentaje de cumplimiento, dashboard visual, recomendaciones asistidas por IA y enfoque de seguridad/OWASP.[cite:1]

La arquitectura propuesta usa Firebase Authentication para acelerar el login con Google y Microsoft, Azure AI Foundry para la capa de IA, un backend propio para lógica auditable y PostgreSQL para persistencia. Esa división permite cumplir rápido con los requisitos del hackathon sin poner la lógica crítica en el frontend.[cite:1][cite:28][cite:26]

## Objetivo

Construir una plataforma web segura, intuitiva y desplegable en Azure que permita:

- Registro e inicio de sesión con OAuth.
- Gestión multiempresa.
- Cuestionario de evaluación de cumplimiento.
- Cálculo porcentual del nivel de cumplimiento.
- Identificación de brechas.
- Recomendaciones accionables generadas con IA.
- Reportes y dashboard de resultados.

## Arquitectura propuesta

### Componentes

- **frontend**: aplicación web modular con vistas de login, dashboard, diagnóstico, brechas, recomendaciones e histórico.
- **api**: backend REST para autenticación interna, empresas, evaluaciones, scoring, reportes y auditoría.
- **db**: PostgreSQL para usuarios internos, empresas, respuestas, evaluaciones e historial.
- **ia**: integración con Azure AI Foundry para explicar preguntas, orientar respuestas y generar recomendaciones basadas en normas.
- **auth**: Firebase Authentication como proveedor de identidad para Google/Microsoft y emisión inicial de sesión.[cite:28][cite:25]

### Principios de diseño

- La IA **no** calcula el puntaje final; el scoring debe salir de reglas de negocio en backend para que sea consistente y auditable.
- La normativa colombiana debe cargarse como base documental recuperable para asistencia contextual, no como conocimiento implícito sin trazabilidad.
- La aplicación debe seguir buenas prácticas OWASP, especialmente en autenticación, sesiones, validación de entradas y autorización por rol.[cite:27][cite:1]

## Stack recomendado

### Frontend

- React + Vite o Next.js.
- Tailwind CSS o componente UI sobrio.
- Firebase SDK para login.
- Cliente HTTP hacia el backend.

### Backend

- FastAPI.
- SQLAlchemy.
- Pydantic.
- PostgreSQL.
- JWT o sesión firmada para el backend.
- SDK/API de Azure AI Foundry.

### Infraestructura

- Docker para cada servicio.
- Docker Compose para desarrollo y despliegue inicial.
- Azure Container Apps o Azure App Service para publicación.
- Azure Database for PostgreSQL en producción.
- Azure Key Vault o variables de entorno seguras para secretos.

## Estructura esperada del proyecto

```text
cavaltec-privacy-platform/
├── docker-compose.yml
├── .env
├── .env.example
├── README.md
├── frontend/
│   ├── Dockerfile
│   ├── package.json
│   ├── src/
│   └── ...
├── api/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── app/
│   │   ├── main.py
│   │   ├── core/
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── routes/
│   │   ├── services/
│   │   └── utils/
│   └── ...
├── docs/
│   └── normas/
│       ├── ley_1581_2012.pdf
│       ├── decreto_1377_2013.pdf
│       └── ...
└── nginx/
    └── default.conf
```

## Módulos funcionales

### 1. Autenticación y acceso

- Login con Google.
- Login con Microsoft.
- Validación del token de Firebase en backend.
- Asociación del usuario autenticado a una empresa.
- Roles: `admin`, `evaluador`, `auditor`.[cite:1][cite:28]

### 2. Gestión de empresa

- Crear y editar empresa.
- Capturar nombre, NIT, sector y tamaño.
- Soportar múltiples evaluaciones por empresa.[cite:1]

### 3. Diagnóstico fase diseño

Implementar el cuestionario base del reto con sus pesos:

- Política de datos personales.
- Privacidad desde el diseño.
- Gobernanza.
- Cálculo del total sobre 100.
- Identificación automática de brechas por respuesta negativa o incompleta.[cite:1]

### 4. IA asistiva

La IA debe servir para:

- Explicar cada pregunta en lenguaje simple.
- Orientar al usuario para responder correctamente.
- Generar recomendaciones concretas para cerrar brechas.
- Interpretar el resultado final con lenguaje claro.[cite:1]

### 5. Resultados y reportes

- Medidor visual de cumplimiento 0–100.
- Brechas detectadas.
- Recomendaciones priorizadas.
- Histórico por empresa.
- Exportación a PDF.[cite:1]

## Variables de entorno

Crear un archivo `.env` en la raíz del proyecto.

### Firebase

Estas variables deben ponerse tanto en el frontend como en el backend donde se valide el token.

```env
FIREBASE_PROJECT_ID=poner_aqui_tu_project_id
FIREBASE_CLIENT_EMAIL=poner_aqui_tu_client_email_si_usas_admin_sdk
FIREBASE_PRIVATE_KEY=poner_aqui_tu_private_key_si_usas_admin_sdk

VITE_FIREBASE_API_KEY=poner_aqui_tu_api_key
VITE_FIREBASE_AUTH_DOMAIN=poner_aqui_tu_auth_domain
VITE_FIREBASE_PROJECT_ID=poner_aqui_tu_project_id
VITE_FIREBASE_STORAGE_BUCKET=poner_aqui_tu_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=poner_aqui_tu_messaging_sender_id
VITE_FIREBASE_APP_ID=poner_aqui_tu_app_id
```

### Azure AI Foundry

Estas variables deben quedar en el backend, nunca expuestas en el frontend.

```env
AZURE_FOUNDRY_ENDPOINT=poner_aqui_tu_endpoint_de_foundry
AZURE_FOUNDRY_API_KEY=poner_aqui_tu_api_key_de_foundry
AZURE_FOUNDRY_MODEL=poner_aqui_el_modelo_elegido
AZURE_FOUNDRY_API_VERSION=poner_aqui_la_version_api
```

Sugerencia inicial para el modelo:

```env
AZURE_FOUNDRY_MODEL=gpt-4o-mini
```

### Base de datos y app

```env
POSTGRES_DB=cavaltec
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_HOST=db
POSTGRES_PORT=5432
DATABASE_URL=postgresql://postgres:postgres@db:5432/cavaltec

API_HOST=0.0.0.0
API_PORT=8000
FRONTEND_PORT=3000
BACKEND_CORS_ORIGINS=http://localhost:3000
JWT_SECRET=poner_aqui_un_secreto_largo
ENVIRONMENT=development
```

## Docker Compose

Crear `docker-compose.yml` así:

```yaml
services:
  db:
    image: postgres:16
    container_name: cavaltec-db
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  api:
    build:
      context: ./api
    container_name: cavaltec-api
    restart: unless-stopped
    env_file:
      - .env
    depends_on:
      - db
    ports:
      - "8000:8000"

  frontend:
    build:
      context: ./frontend
    container_name: cavaltec-frontend
    restart: unless-stopped
    env_file:
      - .env
    depends_on:
      - api
    ports:
      - "3000:3000"

volumes:
  postgres_data:
```

## Implementación de autenticación

### Frontend

- Configurar Firebase SDK.
- Habilitar Google y Microsoft en Firebase Authentication.
- Después del login, obtener el `idToken`.
- Enviar ese token al backend en `Authorization: Bearer <token>`.

Ejemplo de archivo de configuración:

```ts
// frontend/src/lib/firebase.ts
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, OAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const microsoftProvider = new OAuthProvider('microsoft.com');
```

### Backend

- Verificar el token de Firebase con Admin SDK o validación del token.
- Crear o actualizar el usuario interno.
- Asignar rol y empresa.
- Emitir sesión interna si se requiere control adicional.

## Integración con Azure AI Foundry

La integración de IA debe vivir en el backend.

### Casos de uso

- `POST /ai/explain-question`
- `POST /ai/answer-guidance`
- `POST /ai/recommendations`
- `POST /ai/interpret-score`

### Reglas para la IA

- Nunca inventar artículos de ley.
- Basarse en documentos normativos cargados por el sistema.
- Responder en español claro.
- Diferenciar entre explicación, orientación y recomendación.
- No reemplazar el puntaje calculado por reglas del backend.

### Dónde poner la API de Foundry

La API key y endpoint de Azure AI Foundry van en el archivo `.env` del backend o en los secretos del servicio desplegado en Azure:

```env
AZURE_FOUNDRY_ENDPOINT=poner_aqui_tu_endpoint_de_foundry
AZURE_FOUNDRY_API_KEY=poner_aqui_tu_api_key_de_foundry
AZURE_FOUNDRY_MODEL=gpt-4o-mini
AZURE_FOUNDRY_API_VERSION=poner_aqui_la_version_api
```

Nunca exponer estas variables en `VITE_*`, `NEXT_PUBLIC_*` o cualquier variable pública del frontend.

### Dónde poner la API de Firebase

- En el **frontend** sí van las variables públicas del SDK (`VITE_FIREBASE_*`).
- En el **backend** van solo las credenciales necesarias para verificar tokens si usas Admin SDK (`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`).

## Endpoints mínimos sugeridos

### Auth

- `POST /auth/firebase-login`
- `GET /auth/me`

### Empresas

- `POST /companies`
- `GET /companies/{id}`
- `PUT /companies/{id}`

### Evaluaciones

- `POST /assessments`
- `GET /assessments/{id}`
- `GET /companies/{id}/assessments`

### IA

- `POST /ai/explain-question`
- `POST /ai/recommendations`
- `POST /ai/interpret-score`

### Reportes

- `GET /reports/assessment/{id}/pdf`

## Flujo funcional esperado

1. El usuario inicia sesión con Google o Microsoft.
2. El frontend obtiene el token de Firebase.
3. El backend valida el token y crea sesión interna.
4. El usuario registra o selecciona empresa.
5. Completa el cuestionario.
6. El backend calcula el puntaje y detecta brechas.
7. El backend consulta Azure AI Foundry para explicaciones y recomendaciones.
8. El sistema muestra dashboard, brechas y plan de acción.
9. El usuario exporta reporte.[cite:1]

## Seguridad mínima obligatoria

- Validación de entrada en backend.
- Autorización por rol.
- Tokens manejados de forma segura.
- Secretos solo por variables de entorno.
- Rate limiting en endpoints de IA.
- Sanitización de textos enviados al modelo.
- Registro de auditoría de evaluaciones y recomendaciones.
- Prevención de fallos de autenticación y control de sesiones siguiendo OWASP.[cite:27][cite:1]

## Despliegue en Azure

### Opción recomendada para hackathon

- Frontend en Azure App Service o contenedor web.
- API en Azure App Service o Azure Container Apps.
- PostgreSQL administrado en Azure Database for PostgreSQL.
- Secretos en configuración del recurso o Key Vault.
- Azure AI Foundry consumido desde la API.[cite:26][cite:29]

### Variables en Azure

Configurar en el servicio desplegado:

- `AZURE_FOUNDRY_ENDPOINT`
- `AZURE_FOUNDRY_API_KEY`
- `AZURE_FOUNDRY_MODEL`
- `AZURE_FOUNDRY_API_VERSION`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `DATABASE_URL`
- `JWT_SECRET`

Las variables `VITE_FIREBASE_*` deben inyectarse en el build del frontend.

## Criterios de implementación para Opencode

Construir el proyecto con estas reglas:

- Código limpio y modular.
- Backend separado por capas: rutas, servicios, modelos y esquemas.
- Frontend con vistas por módulo y protección de rutas.
- Validación de formularios.
- Dashboard visual claro.
- Estilo sobrio y profesional.
- Preparado para multiempresa.
- Preparado para roles.
- Preparado para despliegue con Docker Compose.
- Variables sensibles solo por entorno.
- README y `.env.example` completos.

## Entregables esperados

- Proyecto funcional con `frontend`, `api` y `docker-compose.yml`.
- Login con Google y Microsoft vía Firebase.
- Backend FastAPI con PostgreSQL.
- Integración con Azure AI Foundry.
- Dashboard de cumplimiento.
- Reporte exportable.
- Archivos `.env.example` y documentación de despliegue.

## Prompt final para CLAUDE

Construye una aplicación web full-stack llamada `cavaltec-privacy-platform` para el reto de autodiagnóstico de cumplimiento de protección de datos personales en Colombia. Debe ser multiempresa, segura, con autenticación OAuth usando Firebase Authentication (Google y Microsoft), backend en FastAPI, base de datos PostgreSQL, frontend moderno modular y despliegue con Docker Compose.

Implementa módulos de autenticación, gestión de empresa, cuestionario de diagnóstico, cálculo de cumplimiento porcentual, brechas, recomendaciones asistidas por IA, histórico y reportes PDF. El cálculo del puntaje debe hacerse en backend con reglas determinísticas; la IA solo explica preguntas, orienta respuestas, interpreta resultados y genera recomendaciones.

Integra Azure AI Foundry desde el backend. Las variables del backend deben leer `AZURE_FOUNDRY_ENDPOINT`, `AZURE_FOUNDRY_API_KEY`, `AZURE_FOUNDRY_MODEL`, `AZURE_FOUNDRY_API_VERSION`. Las variables públicas del frontend deben leer `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`. Si se usa validación server-side de Firebase, leer también `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL` y `FIREBASE_PRIVATE_KEY`.

Genera la estructura completa del proyecto, los Dockerfile de frontend y backend, el `docker-compose.yml`, `.env.example`, modelos de base de datos, endpoints REST, integración inicial con Firebase y Azure AI Foundry, y una interfaz sobria y profesional orientada a jurados de hackathon. Debe quedar lista para correr con `docker compose up --build` y luego desplegarse en Azure.
