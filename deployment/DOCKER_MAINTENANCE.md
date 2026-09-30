# 🐳 DynamicAI Docker Deployment Strategy (Backend-Only)
just change the Name and :
docker build -t mazendarweesh/dynamicai:v2.1.1-dynamicai-health-observability -f deployment/Dockerfile .

docker push mazendarweesh/dynamicai:v2.0.1-Direct_pages_Integration_PrompetInhancment

This document provides a line-by-line breakdown of how to containerize the DynamicAI Backend, manage secrets, and override configurations for production deployment.

---

## 1. How .NET Handles Configuration (The "Override" Rule)
In .NET Core, configurations are loaded in a specific order:
1. `appsettings.json` (Base values)
2. `appsettings.Production.json` (Production overrides)
3. **Environment Variables** (The Ultimate Winner 🏆)

**The Double Underscore Rule (`__`):**
In Docker, you can override any JSON key using environment variables.
*   JSON: `"Gemini": { "ApiKey": "" }`
*   Environment: `Gemini__ApiKey`

---

## 2. Managing Secrets (The `.env` file)
Never hardcode API keys or passwords. We use a `.env` file in the project root to feed variables into the compose file.

### Create/Update `.env` in the root:
```bash
# 🤖 AI Provider Keys
GEMINI_API_KEY="AIzaSyA..."
QDRANT_API_KEY=""

# ⚡ Features & Caching (Optional overrides)
FEATURES_INTENT_ENABLED="true"
CACHING_QUERY_ENABLED="true"

# 🔌 Networking (If using local qdrant in compose)
QDRANT_HOST="http://qdrant_local"
```

---

## 3. Detailed Dockerfile Breakdown (`deployment/Dockerfile`)
*This version is optimized for Backend-only execution.*

| Section | Purpose | Why? |
| :--- | :--- | :--- |
| `FROM mcr...sdk:8.0` | .NET 8 SDK. | Required to *compile* the code. |
| `RUN dotnet restore` | NuGet Restore. | Run *before* copying all code to cache dependencies. Saves minutes on builds. |
| `RUN dotnet publish` | Compile & Bundle. | Optimizes code for speed and removes debugging symbols. |
| `FROM mcr...aspnet:8.0` | Runtime image. | Very small (~200MB). Only contains what's needed to *run* the app. |
| `RUN adduser ... appuser` | Non-root User. | **Security Best Practice.** Prevents root access to the OS if the app is compromised. |
| `EXPOSE 8080` | Port Mapping. | Non-root users cannot bind to port 80. 8080 is the standard. |

---

## 4. Detailed Compose Breakdown (`deployment/docker-compose.yml`)

### 🌐 Networking (`external: true`)
The application uses an **external network** (`5189150146_egdynamics-network`). This allows the app to communicate with a pre-existing SQL Server or other containers managed by a different compose file.

### 🧠 Qdrant Optimization
*   **Resource Limits**: Limited to 2 CPUs and 4GB RAM to prevent memory leaks from crashing the host.
*   **Persistence**: Uses `qdrant_storage` and `qdrant_snapshots` volumes to ensure AI knowledge survives container restarts.

### ⚡ Grouped Environment Variables
The new structure groups variables for better maintenance:
*   **Connection Strings**: Handles DB access.
*   **Gemini Configuration**: Chat, Predict, and Embedding model settings.
*   **Features & Caching**: granular control over system behavior (Intent, Condenser, TTLs).

---

## 🚀 Execution Steps

1.  **Navigate to the project root:**
    ```bash
    cd e:\Mazen\EGYD\DynamicAi
    ```
2.  **Build and Deploy:**
    ```bash
    docker-compose -f deployment/docker-compose.yml up -d --build
    ```
3.  **Verify External Network:**
    Ensure the network exists before starting: `docker network ls | grep egdynamics`
4.  **Check Logs:**
    ```bash
    docker logs -f dynamicai-app
    ```
