# Cavaltec Privacy Platform

Plataforma de autoevaluación de cumplimiento de la **Ley 1581 de 2012** (Protección de Datos Personales) para empresas colombianas. Desarrollada para el **Hackathon Cavaltec 2026**.

## Demo en vivo

| Servicio | URL |
|---|---|
| Frontend | [http://40.70.244.169:3000](http://40.70.244.169:3000) |
| API Docs (Swagger) | [http://40.70.244.169:8000/docs](http://40.70.244.169:8000/docs) |
| Health Check | [http://40.70.244.169:8000/health](http://40.70.244.169:8000/health) |

## Stack tecnológico

| Capa | Tecnología | Versión |
|---|---|---|
| Frontend | React + TypeScript + Vite | 18 / 5.9 / 6 |
| UI | Tailwind CSS + Recharts | 3 / 2 |
| Backend | Python + FastAPI | 3.12 / 0.115 |
| ORM | SQLAlchemy | 2.0 |
| Base de datos | PostgreSQL | 16 |
| Autenticación | Firebase Auth (email + Google) | Admin SDK 6.6 |
| Inteligencia Artificial | Azure AI Foundry (GPT-4o) | Agent Service |
| Reportes PDF | ReportLab | 4.2 |
| Contenedores | Docker + Docker Compose | |
| Infraestructura | Azure Container Apps / VM Ubuntu | |

## Arquitectura

```
┌──────────────────┐       ┌──────────────────┐       ┌──────────────────┐
│   Frontend       │──────▶│   API (FastAPI)  │──────▶│   PostgreSQL 16   │
│   React 18       │       │   Python 3.12    │       │   Puerto 5432     │
│   Nginx :3000    │       │   Puerto 8000    │       └──────────────────┘
│   proxy /api/    │       └────────┬─────────┘
└──────────────────┘                │
                                    ├──▶ Firebase Admin SDK
                                    │    (verificación de tokens)
                                    │
                                    └──▶ Azure AI Foundry
                                         (GPT-4o agente legal)
```

### Flujo de datos

1. El usuario se autentica con Firebase (email/contraseña o Google)
2. El frontend envía el token de Firebase a la API (`POST /auth/firebase-login`)
3. La API verifica el token con Firebase Admin SDK y crea/actualiza el usuario en PostgreSQL
4. El usuario completa el diagnóstico de 11 preguntas estructuradas
5. La API calcula el puntaje (0-100) e identifica brechas de cumplimiento
6. El agente de Azure AI genera recomendaciones personalizadas basadas en las brechas
7. Se genera un reporte PDF descargable con ReportLab

## Funcionalidades principales

### Diagnóstico de cumplimiento
- **11 preguntas** estructuradas en 3 categorías: Política de datos, Privacidad por diseño, Gobernanza
- **Lógica de compuerta**: si no tiene política de datos (P1 = no), las preguntas P2-P5 se auto-anulan
- **Ponderación inteligente**: cada pregunta tiene un peso específico según su criticidad
- **Score 0-100** con identificación automática de brechas

### Agente de IA conversacional (Azure GPT-4o)
- Explica cada pregunta en términos simples
- Guía al usuario sobre cómo responder y qué evidencia presentar
- Genera recomendaciones personalizadas según las brechas detectadas
- Interpreta el puntaje obtenido con implicaciones de negocio
- Analiza documentos PDF subidos por el usuario (políticas, procedimientos)
- Rate limiting: 5 consultas/minuto (explicaciones), 20/minuto (chat)

### Reportes PDF profesionales
- Generados con ReportLab
- Incluyen: tabla de resultados, gráfico gauge (270°), desglose por categoría, brechas identificadas
- Listos para presentar a la alta dirección o a la Superintendencia de Industria y Comercio

### Control de acceso
- **3 roles**: `usuario` (consulta), `auditor` (crea/completa evaluaciones), `admin` (CRUD completo)
- Autenticación con Firebase Auth (email/contraseña + Google OAuth)
- Bitácora de auditoría (`AuditLog`) registra login, evaluaciones completadas y reportes descargados
- El admin configurado (`ADMIN_EMAIL`) no puede ser degradado

## API Endpoints

### Auth
| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| POST | `/auth/firebase-login` | — | Login/registro con Firebase ID token |
| GET | `/auth/me` | Bearer | Perfil del usuario actual |

### Usuarios (admin)
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/users` | Listar todos los usuarios |
| GET | `/users/{id}` | Obtener usuario por ID |
| PUT | `/users/{id}` | Actualizar rol/empresa |

### Empresas
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/companies` | Crear empresa (admin) |
| GET | `/companies` | Listar empresas |
| GET | `/companies/{id}` | Detalle de empresa |
| PUT | `/companies/{id}` | Actualizar empresa (admin) |
| GET | `/companies/{id}/assessments` | Evaluaciones de una empresa |

### Evaluaciones
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/assessments` | Crear evaluación |
| GET | `/assessments/{id}` | Detalle de evaluación |
| PUT | `/assessments/{id}/answers` | Enviar respuestas |
| DELETE | `/assessments/{id}` | Eliminar evaluación |
| POST | `/assessments/{id}/complete` | Finalizar y calificar |

### AI
| Método | Ruta | Rate Limit | Descripción |
|---|---|---|---|
| POST | `/ai/explain-question` | 5/min | Explicar una pregunta |
| POST | `/ai/answer-guidance` | 5/min | Guía para responder |
| POST | `/ai/recommendations` | 5/min | Recomendaciones según brechas |
| POST | `/ai/interpret-score` | 5/min | Interpretar puntaje |
| POST | `/ai/chat` | 20/min | Chat sobre resultados |
| POST | `/ai/question-chat` | 20/min | Chat sobre pregunta específica |

### Reportes
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/reports/assessment/{id}/pdf` | Descargar reporte PDF |

## Estructura del proyecto

```
cavaltec-privacy-platform/
├── api/                          # Backend FastAPI
│   ├── Dockerfile                # python:3.12-slim
│   ├── requirements.txt          # 19 dependencias
│   └── app/
│       ├── main.py               # App FastAPI, middleware, routers
│       ├── core/
│       │   ├── config.py         # Configuración con Pydantic Settings
│       │   ├── database.py       # SQLAlchemy engine y sesión
│       │   └── security.py       # JWT + Firebase + roles
│       ├── models/
│       │   ├── user.py           # Modelo User
│       │   ├── company.py        # Modelo Company
│       │   └── assessment.py     # Modelos Assessment + AuditLog
│       ├── schemas/
│       │   ├── user.py
│       │   ├── company.py
│       │   ├── assessment.py
│       │   └── ai.py
│       ├── routes/
│       │   ├── auth.py           # Firebase login
│       │   ├── users.py          # CRUD usuarios (admin)
│       │   ├── companies.py      # CRUD empresas
│       │   ├── assessments.py    # Diagnóstico y scoring
│       │   ├── ai.py             # 6 endpoints de IA
│       │   └── reports.py        # PDF
│       ├── services/
│       │   ├── firebase_service.py
│       │   ├── ai_service.py     # Azure AI Agent client
│       │   ├── scoring_service.py
│       │   └── report_service.py # PDF con ReportLab
│       └── utils/
│           └── questions.py      # Banco de preguntas + scoring
│
├── frontend/                     # Frontend React + TypeScript
│   ├── Dockerfile                # Multi-stage build
│   ├── nginx.conf                # Config de producción
│   ├── nginx.conf.template       # Template con variable API_URL
│   ├── entrypoint.sh             # Substituye API_URL en runtime
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── src/
│       ├── main.tsx
│       ├── App.tsx               # Router con 6 rutas
│       ├── contexts/AuthContext.tsx
│       ├── hooks/useAuth.ts
│       ├── hooks/useApi.ts
│       ├── services/api.ts
│       ├── components/
│       │   ├── Layout.tsx
│       │   ├── PrivateRoute.tsx
│       │   └── ScoreGauge.tsx
│       └── pages/
│           ├── Login.tsx
│           ├── Dashboard.tsx
│           ├── CompanyInfo.tsx
│           ├── AssessmentChat.tsx  # 951 líneas — wizard + IA
│           ├── History.tsx
│           └── Users.tsx
│
├── deploy/                       # Scripts de deployment
│   ├── azure-deploy.sh           # Deploy automatizado a ACA
│   └── gen-postgres-yaml.py      # Genera YAML de PostgreSQL
│
├── docker-compose.yml            # 3 servicios: db, api, frontend
├── .env.example                  # Template de variables de entorno
└── README.md
```

## Scoring del diagnóstico

| Categoría | Preguntas | Peso máximo |
|---|---|---|
| Política de datos personales | P1 (compuerta), P2-P5 | 40% |
| Privacidad desde el diseño | P6-P8 | 36% |
| Gobernanza | P9-P10, P11 (complementaria) | 24% |

**Reglas:**
- Respuestas: `sí` (peso completo), `parcial` (50%), `no` (0%)
- P1 es compuerta: si responde "no", P2-P5 se anulan automáticamente
- P11 es complementaria y no afecta el puntaje
- Brechas = preguntas respondidas "no" o "parcial"
- Score = (peso obtenido / peso total) × 100

## Seguridad

- Tokens JWT de Firebase en memoria (nunca en localStorage)
- Verificación de tokens con Firebase Admin SDK en cada request
- Roles y permisos con decoradores (`require_admin`, `require_auditor_or_admin`)
- Rate limiting con slowapi en endpoints de IA
- CORS configurable (solo orígenes permitidos)
- Headers de seguridad en Nginx (CSP, X-Frame-Options, etc.)
- Bitácora de auditoría para acciones críticas

## Despliegue

### Local con Docker Compose

```bash
# 1. Clonar el repositorio
git clone https://github.com/jsinij/hackaton-team-ctrlZ.git
cd hackaton-team-ctrlZ/cavaltec-privacy-platform

# 2. Configurar variables de entorno
cp .env.example .env
# Editar .env con las credenciales de Firebase y Azure AI

# 3. Iniciar servicios
docker compose up -d --build

# 4. Acceder
# Frontend: http://localhost:3000
# API Docs: http://localhost:8000/docs
```

### Azure Container Apps (automatizado)

```bash
bash deploy/azure-deploy.sh
```

El script:
1. Verifica Azure CLI
2. Lee configuración del `.env`
3. Genera sufijo único o reutiliza uno existente
4. Crea Service Principal
5. Construye y sube imágenes a Azure Container Registry
6. Crea Storage Account con Azure Files
7. Despliega PostgreSQL como Container App interna
8. Despliega API y Frontend como Container Apps

### VM Ubuntu (alternativa)

```bash
# Crear VM
az vm create -g mi-rg -n mi-vm --image Ubuntu2404 --size Standard_B1s \
  --admin-username azureuser --generate-ssh-keys

# Abrir puertos
az vm open-port -g mi-rg -n mi-vm --port 3000 8000

# Instalar Docker
ssh azureuser@<IP> "sudo apt update && sudo apt install -y docker.io docker-compose"

# Clonar y ejecutar
ssh azureuser@<IP> "git clone https://github.com/jsinij/hackaton-team-ctrlZ.git ~/app"
scp .env azureuser@<IP>:~/app/cavaltec-privacy-platform/.env
ssh azureuser@<IP> "cd ~/app/cavaltec-privacy-platform && sudo docker compose up -d --build"
```

## Variables de entorno (`.env`)

| Variable | Descripción |
|---|---|
| `FIREBASE_PROJECT_ID` | ID del proyecto Firebase |
| `FIREBASE_CLIENT_EMAIL` | Email del service account de Firebase |
| `FIREBASE_PRIVATE_KEY` | Llave privada del service account |
| `AZURE_FOUNDRY_ENDPOINT` | Endpoint de Azure AI Foundry |
| `AZURE_FOUNDRY_API_KEY` | API Key de Azure AI |
| `AZURE_AI_PROJECT_ENDPOINT` | Endpoint del proyecto Azure AI |
| `AZURE_AI_AGENT_ID` | ID del agente de Azure AI |
| `ADMIN_EMAIL` | Email del usuario admin (no degradable) |
| `JWT_SECRET` | Secreto para JWT interno |
| `POSTGRES_DB` | Nombre de la base de datos |
| `POSTGRES_USER` | Usuario de PostgreSQL |
| `POSTGRES_PASSWORD` | Contraseña de PostgreSQL |
| `BACKEND_CORS_ORIGINS` | Orígenes CORS permitidos |
| `ENVIRONMENT` | `development` o `production` |
| `VITE_FIREBASE_*` | Variables públicas de Firebase (frontend) |

## Licencia

Proyecto desarrollado para el Hackathon Cavaltec 2026 — Protección de Datos Personales.
