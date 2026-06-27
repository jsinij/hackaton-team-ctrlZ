# Cavaltec Privacy Platform — Documentación Técnica y Manual de Uso

> Plataforma web para autodiagnóstico de cumplimiento de la **Ley 1581 de 2012** (Protección de Datos Personales - Colombia).
> Desarrollada en la Hackathon 26-27 de junio de 2026 por **Team Ctrl+Z**.

---

## Tabla de Contenidos

1. [Descripción del Proyecto](#1-descripción-del-proyecto)
2. [Tecnologías Utilizadas](#2-tecnologías-utilizadas)
3. [Arquitectura del Sistema](#3-arquitectura-del-sistema)
4. [Estructura del Proyecto](#4-estructura-del-proyecto)
5. [Modelo de Datos](#5-modelo-de-datos)
6. [API — Endpoints del Backend](#6-api--endpoints-del-backend)
7. [Frontend — Páginas y Componentes](#7-frontend--páginas-y-componentes)
8. [Algoritmo de Scoring](#8-algoritmo-de-scoring)
9. [Integración con IA (Azure AI Foundry)](#9-integración-con-ia-azure-ai-foundry)
10. [Configuración y Variables de Entorno](#10-configuración-y-variables-de-entorno)
11. [Despliegue con Docker](#11-despliegue-con-docker)
12. [Manual de Uso](#12-manual-de-uso)
13. [Roles y Permisos](#13-roles-y-permisos)
14. [Seguridad](#14-seguridad)

---

## 1. Descripción del Proyecto

Cavaltec Privacy Platform es una aplicación web de autodiagnóstico que permite a empresas colombianas evaluar su nivel de cumplimiento con la **Ley 1581 de 2012** (Estatuto General de Protección de Datos Personales) y el **Decreto 1377 de 2013**.

### Funcionalidades principales

- **Diagnóstico guiado**: cuestionario de 11 preguntas estructurado por categorías normativas.
- **Scoring automático**: cálculo del porcentaje de cumplimiento con lógica de ponderación.
- **Asistente IA**: agente de Azure AI Foundry que explica preguntas, orienta respuestas, genera recomendaciones y permite chat libre sobre los resultados.
- **Reporte PDF**: generación de informe descargable con los resultados de la evaluación.
- **Historial**: registro de todas las evaluaciones realizadas por empresa.
- **Gestión multi-empresa**: un administrador puede registrar y gestionar múltiples empresas.
- **Control de usuarios y roles**: administración de accesos por rol (usuario, auditor, admin).

---

## 2. Tecnologías Utilizadas

### Backend

| Tecnología | Versión | Rol |
|---|---|---|
| Python | 3.12 | Lenguaje principal |
| FastAPI | 0.115.0 | Framework web / API REST |
| Uvicorn | 0.32.0 | Servidor ASGI |
| SQLAlchemy | 2.0.36 | ORM para base de datos |
| PostgreSQL | 16 | Base de datos relacional |
| Pydantic | 2.10.3 | Validación de datos y settings |
| Firebase Admin SDK | 6.6.0 | Verificación de tokens de autenticación |
| Azure AI Projects | 1.0.0b11 | SDK para agentes de IA |
| Azure Identity | 1.23.0 | Autenticación con Azure |
| ReportLab | 4.2.5 | Generación de reportes PDF |
| Slowapi | 0.1.9 | Rate limiting por IP |
| PyPDF2 | 3.0.1 | Lectura de PDFs subidos por el usuario |
| psycopg2-binary | 2.9.10 | Driver PostgreSQL |

### Frontend

| Tecnología | Versión | Rol |
|---|---|---|
| React | 18.3.1 | Librería UI |
| TypeScript | 5.9.3 | Tipado estático |
| Vite | 6.0.5 | Bundler y dev server |
| Tailwind CSS | 3.4.17 | Estilos utility-first |
| Axios | 1.7.9 | Cliente HTTP |
| React Router | 6.28.0 | Routing SPA |
| Firebase SDK | 11.1.0 | Autenticación cliente |
| Recharts | 2.13.3 | Gráficos (gauge de score) |

### Infraestructura

| Tecnología | Rol |
|---|---|
| Docker | Contenedorización de servicios |
| Docker Compose | Orquestación de contenedores |
| Nginx (Alpine) | Servidor web para el frontend, proxy inverso a la API |
| Firebase Authentication | Proveedor de identidad (Google OAuth + Email/Password) |
| Azure AI Foundry | Plataforma de agentes de IA |

---

## 3. Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────────┐
│                        Usuario (Navegador)                       │
└─────────────────────────┬───────────────────────────────────────┘
                          │ HTTP :3000
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Frontend — Nginx (Docker)                      │
│   React + TypeScript + Vite (build estático)                    │
│                                                                  │
│  /              → index.html (SPA)                              │
│  /api/*         → proxy → API Backend :8000                     │
└─────────────────────────┬───────────────────────────────────────┘
                          │ HTTP :8000
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Backend — FastAPI (Docker)                     │
│   Python 3.12 + Uvicorn                                         │
│                                                                  │
│   Routes: /auth  /companies  /assessments  /ai  /reports        │
│   Services: Firebase · AI · Scoring · Reports                   │
└──────────┬──────────────────────────┬───────────────────────────┘
           │ SQL                      │ HTTPS (API calls)
           ▼                          ▼
┌─────────────────┐        ┌──────────────────────────┐
│  PostgreSQL 16  │        │   Servicios Externos      │
│  (Docker)       │        │                          │
│                 │        │  • Firebase Auth          │
│  Users          │        │    (verificación tokens)  │
│  Companies      │        │                          │
│  Assessments    │        │  • Azure AI Foundry       │
│  AuditLogs      │        │    (agente conversacional)│
└─────────────────┘        └──────────────────────────┘
```

### Flujo de autenticación

```
Usuario → Google OAuth → Firebase → ID Token → Backend → Verifica con Firebase Admin SDK
                                                        → Crea/actualiza User en PostgreSQL
                                                        → Retorna perfil con rol asignado
```

---

## 4. Estructura del Proyecto

```
cavaltec-privacy-platform/
├── api/                          # Backend FastAPI
│   ├── app/
│   │   ├── main.py               # App principal, CORS, lifespan, rutas
│   │   ├── core/
│   │   │   ├── config.py         # Configuración con Pydantic Settings
│   │   │   ├── database.py       # Engine SQLAlchemy y sesiones
│   │   │   └── security.py       # Verificación tokens y control de roles
│   │   ├── models/               # Modelos ORM
│   │   │   ├── user.py
│   │   │   ├── company.py
│   │   │   └── assessment.py     # Assessment + AuditLog
│   │   ├── routes/               # Endpoints REST
│   │   │   ├── auth.py
│   │   │   ├── companies.py
│   │   │   ├── users.py
│   │   │   ├── assessments.py
│   │   │   ├── ai.py
│   │   │   └── reports.py
│   │   ├── schemas/              # Validación Pydantic
│   │   │   ├── user.py
│   │   │   ├── company.py
│   │   │   ├── assessment.py
│   │   │   └── ai.py
│   │   ├── services/             # Lógica de negocio
│   │   │   ├── ai_service.py     # Integración Azure AI Agent
│   │   │   ├── firebase_service.py
│   │   │   ├── scoring_service.py
│   │   │   └── report_service.py
│   │   └── utils/
│   │       └── questions.py      # Las 11 preguntas de la Ley 1581
│   ├── Dockerfile
│   └── requirements.txt
│
├── frontend/                     # Frontend React
│   ├── src/
│   │   ├── App.tsx               # Rutas React Router
│   │   ├── contexts/
│   │   │   └── AuthContext.tsx   # Estado global de autenticación
│   │   ├── hooks/
│   │   │   ├── useAuth.ts
│   │   │   └── useApi.ts         # Factory de cliente Axios con token
│   │   ├── pages/
│   │   │   ├── Login.tsx
│   │   │   ├── Dashboard.tsx
│   │   │   ├── AssessmentChat.tsx
│   │   │   ├── History.tsx
│   │   │   ├── CompanyInfo.tsx
│   │   │   └── Users.tsx
│   │   ├── components/
│   │   │   ├── Layout.tsx        # Sidebar + contenido
│   │   │   ├── PrivateRoute.tsx  # Guard de rutas
│   │   │   └── ScoreGauge.tsx    # Visualización circular del score
│   │   ├── services/
│   │   │   └── api.ts            # Todas las funciones de llamada a API
│   │   └── lib/
│   │       └── firebase.ts       # Inicialización Firebase
│   ├── nginx.conf
│   ├── Dockerfile
│   └── package.json
│
├── docker-compose.yml
├── .env.example
└── DOCUMENTACION.md
```

---

## 5. Modelo de Datos

### User

```
id            UUID (PK)
firebase_uid  string  — identificador de Firebase (único, indexado)
email         string
name          string
role          enum: "usuario" | "auditor" | "admin"
company_id    UUID FK → Company (opcional)
created_at    datetime
updated_at    datetime
```

### Company

```
id          UUID (PK)
name        string
nit         string (único, indexado)
sector      string
size        enum: "micro" | "pequena" | "mediana" | "grande"
created_by  UUID FK → User
created_at  datetime
updated_at  datetime
```

### Assessment

```
id            UUID (PK)
company_id    UUID FK → Company
user_id       UUID FK → User
status        enum: "in_progress" | "completed"
answers       JSON  — { "P1": "si", "P2": "no", ... }
score         float (0-100, null si no completado)
gaps          JSON  — lista de IDs de preguntas fallidas
created_at    datetime
completed_at  datetime (null si no completado)
```

### AuditLog

```
id           UUID (PK)
user_id      UUID FK → User
action       string — "login" | "assessment_completed" | "report_downloaded"
entity_type  string — "user" | "assessment"
entity_id    string
detail       JSON   — metadata adicional
created_at   datetime
```

### Relaciones

```
User ──────< Assessment (un usuario puede tener muchos assessments)
Company ───< Assessment (una empresa tiene muchos assessments)
Company ───< User       (una empresa tiene muchos miembros)
User ──────< AuditLog
```

---

## 6. API — Endpoints del Backend

Base URL en desarrollo: `http://localhost:8000`
Todos los endpoints (excepto `/auth/firebase-login` y `/health`) requieren header:
```
Authorization: Bearer <Firebase ID Token>
```

### Autenticación — `/auth`

| Método | Ruta | Descripción | Roles |
|---|---|---|---|
| POST | `/auth/firebase-login` | Login / registro con token Firebase | Público |
| GET | `/auth/me` | Perfil del usuario autenticado | Cualquiera |

### Empresas — `/companies`

| Método | Ruta | Descripción | Roles |
|---|---|---|---|
| POST | `/companies` | Crear empresa | Admin |
| GET | `/companies` | Listar empresas accesibles | Cualquiera |
| GET | `/companies/{id}` | Obtener empresa | Con acceso |
| PUT | `/companies/{id}` | Actualizar empresa | Admin |
| GET | `/companies/{id}/assessments` | Evaluaciones de la empresa | Con acceso |

### Usuarios — `/users`

| Método | Ruta | Descripción | Roles |
|---|---|---|---|
| GET | `/users` | Listar todos los usuarios | Admin |
| GET | `/users/{id}` | Obtener usuario | Admin |
| PUT | `/users/{id}` | Actualizar rol / empresa | Admin |

### Evaluaciones — `/assessments`

| Método | Ruta | Descripción | Roles |
|---|---|---|---|
| POST | `/assessments` | Crear evaluación | Auditor, Admin |
| GET | `/assessments/{id}` | Obtener evaluación | Con acceso |
| PUT | `/assessments/{id}/answers` | Guardar respuestas | Auditor, Admin |
| POST | `/assessments/{id}/complete` | Finalizar y calcular score | Auditor, Admin |
| DELETE | `/assessments/{id}` | Eliminar evaluación | Auditor, Admin |

### Inteligencia Artificial — `/ai`

Rate limit por IP: 5 req/min para análisis, 20 req/min para chat.

| Método | Ruta | Descripción | Límite |
|---|---|---|---|
| POST | `/ai/explain-question` | Explicar requisito normativo | 5/min |
| POST | `/ai/answer-guidance` | Guía para responder la pregunta | 5/min |
| POST | `/ai/recommendations` | Recomendaciones basadas en gaps | 5/min |
| POST | `/ai/interpret-score` | Interpretación del score obtenido | 5/min |
| POST | `/ai/chat` | Chat libre con el agente (contexto de evaluación) | 20/min |
| POST | `/ai/question-chat` | Chat enfocado en una pregunta | 20/min |

### Reportes — `/reports`

| Método | Ruta | Descripción | Roles |
|---|---|---|---|
| GET | `/reports/assessment/{id}/pdf` | Descargar reporte PDF | Auditor, Admin |

### Health

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/health` | Estado del servicio |

---

## 7. Frontend — Páginas y Componentes

### Rutas

| Ruta | Página | Acceso |
|---|---|---|
| `/login` | Login | Público |
| `/` | Dashboard | Autenticado |
| `/diagnostico` | AssessmentChat | Auditor, Admin |
| `/historial` | History | Autenticado |
| `/empresa` | CompanyInfo | Admin |
| `/usuarios` | Users | Admin |

### Páginas

**Login** — permite ingreso con Google OAuth o email/password. Incluye modo registro.

**Dashboard** — vista principal. Muestra estadísticas de la empresa seleccionada (total evaluaciones, completadas, promedio de score) y acceso rápido a las evaluaciones recientes.

**AssessmentChat** — el núcleo de la plataforma:
- Pantalla inicial con selector de empresa
- Cuestionario de 11 preguntas con respuestas Si / Parcialmente / No
- Botones de ayuda IA por pregunta ("Explicar" y "¿Cómo responder?")
- Indicador de progreso
- Al finalizar: score visual, lista de brechas, chat con agente IA, descarga de PDF

**History** — historial de evaluaciones por empresa. Permite filtrar por empresa, descargar reportes y eliminar evaluaciones (roles con permiso).

**CompanyInfo** — gestión de empresas: crear y editar (solo admin).

**Users** — administración de usuarios: cambiar roles y asignar empresa (solo admin).

### Componentes reutilizables

**Layout** — estructura base con sidebar de navegación. El menú se adapta según el rol del usuario.

**PrivateRoute** — componente guard que verifica autenticación y rol antes de renderizar una página.

**ScoreGauge** — visualización circular del porcentaje de cumplimiento. Cambia de color según el rango (rojo / ámbar / verde).

---

## 8. Algoritmo de Scoring

Las 11 preguntas están distribuidas en 3 categorías con pesos específicos:

| ID | Pregunta resumida | Categoría | Peso |
|---|---|---|---|
| P1 | ¿Tiene política de tratamiento de datos? | Política (Gate) | 0 |
| P2 | ¿Está documentada y publicada? | Política | 10 |
| P3 | ¿Define las finalidades del tratamiento? | Política | 10 |
| P4 | ¿Incluye derechos de los titulares? | Política | 10 |
| P5 | ¿Explica cómo ejercer los derechos? | Política | 10 |
| P6 | ¿Realiza evaluaciones de impacto (PIA)? | Diseño | 12 |
| P7 | ¿Aplica minimización de datos? | Diseño | 12 |
| P8 | ¿Recopila el mínimo por defecto? | Diseño | 12 |
| P9 | ¿Cuenta con sistema de gestión de riesgos? | Gobernanza | 16 |
| P10 | ¿Tiene oficial de protección de datos? | Gobernanza | 8 |
| P11 | ¿El oficial está designado formalmente? | Complementaria | 0 |

**Total ponderado: 100 puntos**

### Reglas de cálculo

- **Sí** → peso completo
- **Parcialmente** → 50% del peso
- **No** → 0 puntos, se registra como brecha (gap)
- **Gate P1**: si se responde "No", P2–P5 se auto-responden como "No" (sin política, no puede cumplir ningún sub-requisito)
- **P11**: pregunta informativa, no afecta el score

### Interpretación del score

| Rango | Nivel | Color |
|---|---|---|
| 80 – 100 | Cumplimiento Alto | Verde |
| 50 – 79 | Cumplimiento Medio | Ámbar |
| 0 – 49 | Cumplimiento Bajo | Rojo |

---

## 9. Integración con IA (Azure AI Foundry)

El agente de IA corre en **Azure AI Projects** y se integra mediante el SDK `azure-ai-projects`.

### Autenticación con Azure

Se usa **Device Code Flow** (`DeviceCodeCredential`), lo que requiere que al primer arranque el administrador abra un URL en el navegador para autenticar. El token se almacena en caché en el volumen Docker `azure_token_cache` para sesiones subsiguientes.

### Capacidades del agente

| Función | Descripción | Fallback |
|---|---|---|
| `explain_question` | Explica el requisito normativo de una pregunta | Retorna referencia legal |
| `answer_guidance` | Indica qué evidencias y pasos son necesarios para cumplir | Consejo genérico |
| `generate_recommendations` | Genera plan de acción para cada brecha detectada | Lista genérica |
| `interpret_score` | Análisis narrativo del score obtenido | Texto basado en rangos |
| `chat` | Chat multiturno con contexto de evaluación, score y gaps | Mensaje de error amigable |
| `chat_question` | Chat enfocado en una pregunta específica (explicar/guía/seguimiento) | Mensaje de error amigable |

### Contexto enviado al agente en el chat

Cada mensaje incluye:
- Score total y nivel (alto/medio/bajo)
- Lista de brechas detectadas con referencia legal
- Sector de la empresa
- Historial de la conversación
- Texto del PDF (si el usuario sube un documento)

---

## 10. Configuración y Variables de Entorno

Crear el archivo `.env` en `cavaltec-privacy-platform/` basándose en `.env.example`:

```bash
# ─── Base de datos ────────────────────────────────────────────
POSTGRES_DB=cavaltec
POSTGRES_USER=postgres
POSTGRES_PASSWORD=tu_contraseña_segura
POSTGRES_HOST=db
POSTGRES_PORT=5432
DATABASE_URL=postgresql://postgres:tu_contraseña_segura@db:5432/cavaltec

# ─── Firebase (Frontend — prefijo VITE_) ──────────────────────
VITE_FIREBASE_API_KEY=tu_api_key
VITE_FIREBASE_AUTH_DOMAIN=tu_proyecto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=tu_proyecto
VITE_FIREBASE_STORAGE_BUCKET=tu_proyecto.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123

# ─── Firebase Admin SDK (Backend) ─────────────────────────────
FIREBASE_PROJECT_ID=tu_proyecto
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@tu_proyecto.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----\n"

# ─── Azure AI Foundry ─────────────────────────────────────────
AZURE_AI_PROJECT_ENDPOINT=https://tu-proyecto.api.azureml.ms
AZURE_AI_AGENT_ID=asst_xxxxxxxxxxxxxxxx

# ─── Aplicación ───────────────────────────────────────────────
BACKEND_CORS_ORIGINS=http://localhost:3000
ENVIRONMENT=development
ADMIN_EMAIL=admin@tudominio.com

# ─── JWT (disponible para extensiones futuras) ────────────────
JWT_SECRET=cadena_aleatoria_larga_y_segura
```

> **Importante**: Las variables `VITE_*` son embebidas en el build del frontend. Nunca incluir credenciales de backend en variables `VITE_`.

---

## 11. Despliegue con Docker

### Requisitos previos

- Docker Engine 24+
- Docker Compose v2
- Acceso a internet para descargar imágenes (o caché local)
- Archivo `.env` configurado

### Levantar la plataforma

```bash
# Desde la carpeta cavaltec-privacy-platform/
docker compose up -d --build
```

### Servicios levantados

| Servicio | Puerto | Descripción |
|---|---|---|
| `db` | 5432 | PostgreSQL 16 |
| `api` | 8000 | FastAPI — Backend |
| `frontend` | 3000 | Nginx — Frontend React |

La aplicación queda disponible en: **http://localhost:3000**

### Primer inicio — Autenticación Azure

En el primer arranque, el backend intentará autenticarse con Azure AI mediante Device Code Flow. Revisa los logs:

```bash
docker compose logs api -f
```

Busca una línea como:
```
To sign in, use a web browser to open the page https://microsoft.com/devicelogin and enter the code XXXXXXXX
```

Abre esa URL, ingresa el código y autoriza. El token queda cacheado en el volumen `azure_token_cache`.

### Comandos útiles

```bash
# Ver logs en tiempo real
docker compose logs -f

# Reiniciar solo el backend
docker compose restart api

# Detener todos los servicios
docker compose down

# Detener y eliminar volúmenes (borra la base de datos)
docker compose down -v

# Rebuild sin caché
docker compose build --no-cache
docker compose up -d
```

### Acceso a la base de datos (opcional)
us o cualquier cliente PostgreSQL usando:

┌───────────────┬───────────────────────────────────────────┐
│     Campo     │                   Valor                   │
├───────────────┼───────────────────────────────────────────┤
│ Host          │ localhost                                 │
├───────────────┼───────────────────────────────────────────┤
│ Puerto        │ 5432                                      │
├───────────────┼───────────────────────────────────────────┤
│ Base de datos │ cavaltec                                  │
├───────────────┼───────────────────────────────────────────┤
│ Usuario       │ postgres                                  │
├───────────────┼───────────────────────────────────────────┤
│ Contraseña    │ la que tengas en .env (POSTGRES_PASSWORD) │
└───────────────┴─────────────────────────────
```bash
docker exec -it cavaltec-db psql -U postgres -d cavaltec
```

---

## 12. Manual de Uso

### 12.1 Primer acceso — Administrador

1. Accede a **http://localhost:3000**
2. Inicia sesión con el email configurado en `ADMIN_EMAIL` (Google o email/password)
3. El sistema te asigna automáticamente el rol `admin`

### 12.2 Registrar una empresa

> Solo el administrador puede crear empresas.

1. En el menú lateral, haz clic en **"Mi Empresa"**
2. Completa el formulario:
   - **Nombre** de la empresa
   - **NIT** (número de identificación tributaria, único)
   - **Sector** (Tecnología, Salud, Educación, etc.)
   - **Tamaño** (Micro / Pequeña / Mediana / Grande)
3. Haz clic en **"Crear empresa"**

### 12.3 Gestionar usuarios

> Solo el administrador puede gestionar usuarios.

1. En el menú lateral, haz clic en **"Usuarios"**
2. Verás la tabla con todos los usuarios registrados
3. Para cada usuario puedes:
   - Cambiar el **rol**: `usuario` → `auditor` → `admin`
   - Asignar una **empresa**
4. Haz clic en el ícono de edición de la fila, aplica los cambios y guarda

> Los usuarios con rol `auditor` o `admin` pueden crear y completar evaluaciones.

### 12.4 Realizar una evaluación

> Requiere rol `auditor` o `admin`.

1. Haz clic en **"Nueva Evaluación"** en el menú lateral o en el Dashboard
2. Selecciona la empresa a evaluar en el desplegable
3. Haz clic en **"Comenzar Evaluación"**
4. Para cada pregunta:
   - Lee el enunciado
   - Selecciona **Sí**, **Parcialmente** o **No**
   - Si tienes dudas, usa los botones:
     - **"Explicar esta pregunta"** — el agente IA explica el requisito legal
     - **"¿Cómo responder?"** — el agente IA te indica qué evidencias necesitas
5. Responde las 11 preguntas (algunas pueden omitirse automáticamente según tus respuestas)
6. Al llegar a la última pregunta, el sistema calcula y muestra tu **score de cumplimiento**

### 12.5 Interpretar los resultados

Al finalizar la evaluación verás:

- **Porcentaje de cumplimiento** (0–100%)
- **Nivel**: Cumplimiento Alto (verde) / Medio (ámbar) / Bajo (rojo)
- **Número de brechas** identificadas

Puedes interactuar con el **asistente IA**:
- El agente analiza automáticamente tus resultados y entrega recomendaciones iniciales
- Puedes hacerle preguntas sobre la Ley 1581, tus brechas, pasos a seguir, etc.
- También puedes subir un documento PDF (política de datos, contratos, etc.) para que el agente lo analice en contexto

### 12.6 Descargar el reporte PDF

> Requiere rol `auditor` o `admin`.

- En la pantalla de resultados, haz clic en **"Descargar PDF"**
- O desde **"Historial"**, busca la evaluación y haz clic en **"Descargar PDF"**

El reporte incluye:
- Datos de la empresa
- Fecha y score de la evaluación
- Tabla con todas las respuestas
- Lista de brechas detectadas con referencia normativa
- Barra visual del nivel de cumplimiento

### 12.7 Consultar el historial

1. En el menú lateral, haz clic en **"Historial"**
2. Si tienes acceso a varias empresas, selecciónala en el desplegable superior
3. Verás la tabla con todas las evaluaciones de esa empresa:
   - Fecha de creación
   - Score obtenido
   - Estado (Completado / En progreso)
   - Número de brechas
4. Desde aquí puedes **descargar** o **eliminar** evaluaciones (según tu rol)

### 12.8 Registro de nuevos usuarios

1. Cualquier persona puede acceder a `/login` y crear una cuenta
2. Por defecto, el rol asignado es `usuario` (solo lectura)
3. El administrador debe cambiar el rol a `auditor` para que puedan realizar evaluaciones

---

## 13. Roles y Permisos

| Acción | Usuario | Auditor | Admin |
|---|---|---|---|
| Ver Dashboard | ✅ | ✅ | ✅ |
| Ver Historial | ✅ | ✅ | ✅ |
| Crear evaluación | ❌ | ✅ | ✅ |
| Responder evaluación | ❌ | ✅ | ✅ |
| Descargar PDF | ❌ | ✅ | ✅ |
| Eliminar evaluación | ❌ | ✅ | ✅ |
| Ver chat IA | ❌ | ✅ | ✅ |
| Crear empresa | ❌ | ❌ | ✅ |
| Editar empresa | ❌ | ❌ | ✅ |
| Gestionar usuarios | ❌ | ❌ | ✅ |
| Ver todos los usuarios | ❌ | ❌ | ✅ |

> El email definido en `ADMIN_EMAIL` siempre es admin y su rol no puede ser modificado.

---

## 14. Seguridad

### Autenticación y tokens

- Los usuarios se autentican con **Firebase Authentication** (Google OAuth o email/password)
- El frontend obtiene un **ID Token** de Firebase que expira en 1 hora y se refresca automáticamente
- El token **nunca se guarda en localStorage** — se mantiene en memoria React
- El backend valifica cada token con el **Firebase Admin SDK** en cada request

### Control de acceso

- Todos los endpoints (salvo login y health) requieren token válido
- Los datos se filtran según el rol y la empresa del usuario
- Un usuario no puede ver ni modificar evaluaciones de empresas a las que no pertenece
- El rol `admin` principal (email en `.env`) no puede ser degradado por ningún usuario

### Registro de auditoría

Todas las acciones críticas quedan registradas en la tabla `AuditLog`:
- Inicios de sesión
- Evaluaciones completadas
- Reportes descargados

### Rate limiting

Los endpoints de IA están protegidos contra abuso por IP:
- Análisis (explicar, orientar, recomendar, interpretar): **5 requests/minuto**
- Chat: **20 requests/minuto**

### CORS

En desarrollo, solo `http://localhost:3000` tiene permiso de origen. Para producción, actualizar `BACKEND_CORS_ORIGINS` en `.env`.

---

*Documentación generada para el proyecto Cavaltec Privacy Platform — Hackathon Team Ctrl+Z, junio 2026.*
