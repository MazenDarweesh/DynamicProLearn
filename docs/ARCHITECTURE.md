# 🏛️ DynamicProLearn Architecture Blueprint

DynamicProLearn is an enterprise-grade Learning Management System (LMS) engineered for ERP software onboarding, multi-department corporate training, tester quality evaluation, and context-aware artificial intelligence.

This document provides a deep architectural breakdown of the platform, including its Clean Architecture layers, reactive frontend design, data flow sequences, and microservice integration with the AI Co-Pilot engine.

---

## 🗺️ High-Level System Architecture

```mermaid
graph TB
    subgraph Client Layer ["Client Tier (Browser)"]
        UI["Angular 19 SPA<br/>(Signals, CDK Drag, Reactive Forms)"]
        Widget["AI Co-Pilot Floating Widget<br/>(SSE Streaming, Provenance Badges)"]
    end

    subgraph Gateway ["Reverse Proxy & Host"]
        Docker["Docker Container<br/>(Kestrel .NET 10 Runtime + Static SPA Files)"]
    end

    subgraph Core Platform ["DynamicProLearn Core (.NET 10)"]
        API["Web API Layer<br/>(Controllers, Middlewares, Auth Guards)"]
        App["Application Layer<br/>(CQRS, Services, DTOs, Validators)"]
        Infra["Infrastructure Layer<br/>(EF Core, Identity, WebhookDispatcher)"]
        Domain["Domain Layer<br/>(Entities, Value Objects, Enums)"]
    end

    subgraph Persistence ["Storage Tier"]
        DB[("SQL Server 2022<br/>(Curriculum, Users, Progress, Audits)")]
    end

    subgraph AI Engine ["AI Co-Pilot Microservice (Python / FastAPI)"]
        FastAPI["FastAPI Gateway<br/>(:8000 /v1/*)"]
        Qdrant[("Qdrant Vector DB<br/>(Dense BGE-M3 + BM25 Sparse)")]
        LLM["Google Gemini 3.5 Flash-Lite<br/>(RAG Generation & Summaries)"]
        Cache["Dual-Tier Cache<br/>(Exact In-Memory + Semantic Vector Cache)"]
    end

    UI -->|"HTTP / REST (JWT Bearer)"| Docker
    Widget -->|"SSE / EventSource (:8000)"| FastAPI
    Docker --> API
    API --> App
    App --> Domain
    App --> Infra
    Infra --> DB
    
    %% Service-to-Service Integration
    API -.->|"Clear AI Cache (:8000)"| FastAPI
    Infra -.->|"Dual-Key Webhook (:8000)"| FastAPI
    FastAPI -.->|"RBAC & Permissions (:5115/api/internal)"| API
    FastAPI --> Qdrant
    FastAPI --> LLM
    FastAPI --> Cache
```

---

## 🧱 Backend Architecture (.NET 10 Clean Architecture)

The backend is built following strict **Clean Architecture (Onion Architecture)** principles, ensuring high testability, loose coupling, and domain independence.

```
src/
├── LearnDynamicPro.Domain/           # Enterprise Business Rules
│   ├── Common/                       # BaseEntity, AuditableEntity
│   ├── Entities/                     # User, Company, Department, Module, Unit, Lesson, Feedback, etc.
│   └── Enums/                        # UserRole, ContentType, DifficultyLevel
│
├── LearnDynamicPro.Application/      # Application Business Rules
│   ├── Common/                       # Result<T>, Error types, Service Lifespans
│   ├── DTOs/                         # Request/Response contracts per feature
│   ├── Interfaces/                   # IApplicationDbContext, ITokenService, IUnitOfWork
│   └── Features/                     # AuthService, AdminService, StudentService, TesterService
│
├── LearnDynamicPro.Infrastructure/   # External Interfaces & Data Access
│   ├── Data/                         # ApplicationDbContext, Model Configurations, Seeding
│   ├── Identity/                     # TokenService (Stateless JWT + 7-day Refresh Tokens)
│   ├── Repositories/                 # Generic Repository & Unit of Work implementation
│   └── Services/                     # WebhookDispatcher (Dual-key payload serialization)
│
└── LearnDynamicPro.API/              # Interface Adapters & Delivery Layer
    ├── Controllers/                  # Auth, Admin, Student, Tester, Internal
    ├── Middlewares/                  # ExceptionMiddleware, RequestLoggingMiddleware
    └── Program.cs                    # Dependency Injection, DB Retry Policy, Host Configuration
```

### Layer Dependency Rules:
1. **Domain** depends on nothing.
2. **Application** depends only on Domain.
3. **Infrastructure** depends on Application and Domain.
4. **API** acts as the entry point, resolving dependencies at startup.

---

## 🎨 Frontend Architecture (Angular 19 SPA)

The frontend is built using **Angular 19 Standalone Components**, eliminating traditional `NgModule` boilerplate and providing fine-grained reactivity through **Signals**.

```
learn-dynamic-pro-ui/src/app/
├── core/
│   ├── guards/                       # AuthGuard, RoleGuard (Admin, Student, Tester)
│   ├── interceptors/                 # JwtInterceptor (401 catch, Silent Token Refresh Mutex)
│   ├── models/                       # TypeScript interfaces mirroring backend DTOs
│   └── services/                     # AuthService, CopilotService, AdminService, StudentService
│
├── shared/
│   ├── components/                   # Navbar, Sidebar, CopilotChatComponent
│   └── pipes/                        # SafeUrlPipe, TimeAgoPipe, ArabicDatePipe
│
└── features/
    ├── auth/                         # Login, Register, ErpRedirect (SSO)
    ├── admin/                        # Dashboard, CurriculumBuilder, UsersManager, Analytics
    ├── student/                      # TracksViewer, LessonPlayer, QuizRunner, ProgressSummary
    └── tester/                       # VersionSelector, FeedbackForm, EvaluationMatrix
```

### Key Frontend Capabilities:
- **Signals-Driven Reactivity:** Instant state synchronization between session, roles, and UI components without unnecessary change-detection cycles.
- **Floating Ergonomics:** Chat widget is powered by `@angular/cdk/drag-drop` (`cdkDrag`, `cdkDragBoundary="body"`), ensuring users can drag the assistant window anywhere across complex ERP learning materials.
- **Zero-Flicker Markdown:** Responses from the AI are rendered in real-time markdown (`ngx-markdown`) supporting code syntax highlighting, tables, callouts, and interactive video timestamps.

---

## 🔄 Core Architectural Workflows & Sequence Diagrams

### 1. Zero-Friction Silent Token Refresh (Resilient 401 Interception)

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Angular as Angular Client
    participant Interceptor as JwtInterceptor
    participant DotNet as .NET Web API
    participant TokenSvc as TokenService

    User->>Angular: Triggers action or sends AI message
    Angular->>DotNet: HTTP Request (Bearer Expired Access Token)
    DotNet-->>Interceptor: 401 Unauthorized (Token Expired)
    
    Note over Interceptor: Intercepts 401, locks outgoing requests queue
    Interceptor->>DotNet: POST /api/Auth/refresh-token { Token, RefreshToken }
    DotNet->>TokenSvc: ValidateRefreshToken(refreshToken)
    TokenSvc-->>DotNet: Valid User Claims (7-Day signed token)
    DotNet-->>Interceptor: 200 OK { new Token, new RefreshToken }
    
    Note over Interceptor: Updates auth state, replays original queued request
    Interceptor->>DotNet: HTTP Request (Bearer New Access Token)
    DotNet-->>Angular: 200 OK (Successful Execution)
    Angular-->>User: Seamless Response (No logout or interruption)
```

---

### 2. AI Co-Pilot Streaming & Provenance Badging (SSE Flow)

```mermaid
sequenceDiagram
    autonumber
    actor Student
    participant Chat as CopilotChatComponent
    participant CopilotSvc as CopilotService
    participant Python as Python AI Engine (:8000)
    participant Qdrant as Qdrant Vector DB
    participant Gemini as Google Gemini 3.5 Flash-Lite

    Student->>Chat: Asks: "How do I configure sales tax?"
    Chat->>CopilotSvc: streamSearch(query, lessonId, skipCache=false)
    CopilotSvc->>Python: POST /v1/search/stream (SSE Connection)
    
    alt Exact/Semantic Cache Hit
        Python->>Python: Check Tier-1 Memory / Tier-2 Qdrant Cache
        Python-->>Chat: event: sources [ { title, url, timestamp } ]
        Python-->>Chat: event: token (Streaming chunks)
        Python-->>Chat: event: done { provenance: "EXACT_CACHE", cache_hit: true, latency_ms: 22.4 }
        Chat-->>Student: Displays answer with ⚡ Instant Cache badge (22ms)
    else Live RAG Generation (or skip_cache: true on Retry)
        Python->>Qdrant: Hybrid Search (BGE-M3 Dense + BM25 Sparse)
        Qdrant-->>Python: Relevant Lesson Segments
        Python->>Gemini: Stream Generation with Context Injection
        Gemini-->>Python: Stream Tokens
        Python-->>Chat: event: sources [...]
        Python-->>Chat: event: token (Real-time Markdown chunks)
        Python-->>Chat: event: done { provenance: "RAG_GENERATION", cache_hit: false, latency_ms: 2150 }
        Chat-->>Student: Displays answer with 🧠 Live Generation badge (2.1s)
    end
```

---

### 3. Dual-Key Webhook Cache Invalidation

When an Administrator updates or removes curriculum content in .NET, the changes must instantly reflect in the AI engine's vector store and semantic cache.

```mermaid
sequenceDiagram
    autonumber
    actor Admin
    participant AdminCtrl as AdminController (.NET)
    participant ModuleSvc as ModuleService
    participant Dispatcher as WebhookDispatcher
    participant Python as Python AI Engine (:8000)
    participant Qdrant as Qdrant Vector Store

    Admin->>AdminCtrl: PUT /api/Admin/lessons/{id} (Update Lesson Title/Content)
    AdminCtrl->>ModuleSvc: UpdateLessonAsync(id, dto)
    ModuleSvc->>ModuleSvc: Commit updates to SQL Server
    ModuleSvc->>Dispatcher: DispatchLessonWebhookAsync(lessonId, "Updated")
    
    Note over Dispatcher: Serializes dual-key payload: lesson_id & lessonId
    Dispatcher->>Python: POST /v1/webhooks/lesson-updated<br/>Header: X-Service-Token<br/>Body: { lesson_id, lessonId, action: "Updated" }
    
    Python->>Python: Evict Tier-1 & Tier-2 Caches for Lesson
    Python->>Qdrant: Upsert/Update Embeddings for Lesson Points
    Python-->>Dispatcher: 200 OK { status: "processed" }
```

---

### 4. RBAC Permission Filtering via Internal Service Token

```mermaid
sequenceDiagram
    autonumber
    participant Student as Student / Client
    participant Python as Python AI Engine (:8000)
    participant Internal as InternalController (.NET :5115)
    participant DB as SQL Server 2022

    Student->>Python: Sends Query with User Bearer Token
    Python->>Internal: GET /api/internal/user-permissions/{userId}<br/>Header: Authorization: Bearer <X-Service-Token>
    Internal->>DB: Query assigned modules, level filters, and tenant IDs
    DB-->>Internal: User permissions matrix
    Internal-->>Python: 200 OK { AccessibleModules, AccessibleLessonIds, LevelFilters }
    
    Note over Python: Injects payload filter into Qdrant hybrid query
    Python->>Python: Execute search strictly bounded to user's authorized lessons
```

---

## 🛡️ Enterprise Security Architecture

| Security Domain | Implementation Standard |
|:----------------|:------------------------|
| **Authentication** | Dual-token model: 60-min stateless access JWT + 7-day signed cryptographic refresh JWT. |
| **Password Security** | BCrypt Work Factor 12 with cryptographically random salt. |
| **Authorization** | Strict ASP.NET Core Policies (`AdminOnly`, `StudentOrAbove`, `TesterOnly`). |
| **Cross-Service Comms** | Static high-entropy `X-Service-Token` headers for internal endpoints (`/api/internal/*`). |
| **Multi-Tenancy** | Department-level and Company-level data isolation enforced via EF Core query filters. |
| **Container Hardening** | Production runtime executes under unprivileged built-in `app` user (non-root UID). |

---

## 📈 Database Schema & Relationships (EF Core 10)

```mermaid
erDiagram
    Company ||--o{ Department : operates
    Department ||--o{ User : employs
    Department ||--o{ DepartmentModuleAssignment : assigns
    
    Module ||--o{ Unit : contains
    Module ||--o{ DepartmentModuleAssignment : targets
    Unit ||--o{ Lesson : contains
    
    LookupLevel ||--o{ Lesson : categorizes
    LookupType ||--o{ Lesson : categorizes
    
    User ||--o{ LessonProgress : completes
    Lesson ||--o{ LessonProgress : tracks
    
    User ||--o{ Feedback : submits
    Lesson ||--o{ Feedback : receives
    
    ErpVersion ||--o{ TesterAssignment : assigns
    User ||--o{ TesterAssignment : tests
    ErpVersion ||--o{ Feedback : tagged_in

    Lesson ||--o| AiGeneratedContent : owns
```

- **AiGeneratedContent:** JSON-mapped EF Core entity storing AI-generated comprehensive summaries, multiple-choice quizzes, and explanation metadata directly associated with each lesson.
- **LessonProgress:** Captures completion timestamp, active watch time, quiz score, and last accessed date for curriculum analytics.
