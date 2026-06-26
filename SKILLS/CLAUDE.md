# Prompt de Construcción Frontend: Plataforma Cavaltec - Ley 1581

## 1. Contexto del Proyecto y Objetivo
Eres un desarrollador frontend experto (React/Next.js). Tu objetivo es construir la interfaz de usuario de una aplicación web multiempresa para el autodiagnóstico de cumplimiento de la Ley 1581 (fase de diseño). 

La aplicación debe tener un diseño profesional, intuitivo y aplicar buenas prácticas de seguridad (OWASP). El backend (FastAPI) y la base de datos (PostgreSQL) ya están definidos; tu enfoque es el cliente web.

## 2. Requisitos de Autenticación (Firebase)
La aplicación requiere un inicio de sesión seguro usando OAuth.
* **Proveedor:** Firebase Authentication.
* **Métodos requeridos:** Google y Microsoft.
* **Flujo:**
    1.  El usuario se autentica en el frontend usando el SDK de Firebase.
    2.  El frontend captura el `idToken` de Firebase.
    3.  Este token debe enviarse en los headers (`Authorization: Bearer <token>`) en cada petición al backend para la validación de sesión y autorización por roles.

## 3. Estructura de Vistas (Rutas)
Una vez el usuario esté autenticado, el sistema debe proteger las rutas y ofrecer la siguiente navegación principal:

### A. Pantalla de Login (`/login`)
* Botones claros para "Iniciar sesión con Google" y "Iniciar sesión con Microsoft".
* No debe permitir el acceso a las demás rutas si el usuario no tiene un token activo.

### B. Información de la Empresa (`/empresa`)
* Formulario para capturar y editar los datos básicos del cliente.
* **Campos obligatorios:** Nombre, NIT, Sector y Tamaño de la empresa.
* Debe soportar el contexto de "multiempresa", permitiendo asociar evaluaciones a una entidad específica.

### C. Historial de Diagnósticos (`/historial`)
* Listado o tabla con los diagnósticos de seguridad anteriores.
* **Datos a mostrar por fila:** Fecha de la evaluación y Porcentaje (%) de cumplimiento alcanzado.

### D. Chat / Diagnóstico con Agente IA (`/diagnostico`)
* Interfaz tipo chat o formulario asistido donde se realiza el cuestionario estructurado sobre protección de datos.
* **Integración de IA:** La inteligencia artificial (Azure AI Foundry) no se consume directamente desde el frontend.
* El frontend debe comunicarse mediante una API interna al backend, enviando el contexto para que la IA devuelva:
    * Explicación de las preguntas en lenguaje sencillo.
    * Orientación sobre cómo responder.
    * Recomendaciones automáticas basadas en las respuestas.

## 4. Gestión de Variables de Entorno
El frontend solo debe manejar las variables públicas de Firebase. Instruye a tu código para leer las siguientes variables dependiendo del entorno (ej. `VITE_*` o `NEXT_PUBLIC_*`):
* `VITE_FIREBASE_API_KEY`
* `VITE_FIREBASE_AUTH_DOMAIN`
* `VITE_FIREBASE_PROJECT_ID`
* `VITE_FIREBASE_STORAGE_BUCKET`
* `VITE_FIREBASE_MESSAGING_SENDER_ID`
* `VITE_FIREBASE_APP_ID`

*Regla de Seguridad:* Las credenciales de Azure AI Foundry NUNCA deben existir en el frontend.

## 5. Estructura de Archivos Sugerida
Genera el código inicial respetando una arquitectura limpia (ejemplo para React/Vite):

```text
src/
├── assets/
├── components/       # UI reutilizable (botones, modales, layout)
├── contexts/         # AuthContext (Firebase auth state)
├── hooks/            # Custom hooks (ej. useAuth, useApi)
├── lib/
│   └── firebase.js   # Inicialización del SDK de Firebase
├── pages/
│   ├── Login.jsx
│   ├── CompanyInfo.jsx
│   ├── History.jsx
│   └── AssessmentChat.jsx
├── services/         # Clientes HTTP (Axios) para comunicarse con el backend
└── App.jsx           # Configuración de Router y Rutas Privadas
