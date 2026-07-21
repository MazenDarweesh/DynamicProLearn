# 🚀 DynamicProLearn — Enterprise ERP Learning Management System

<div align="center">

![.NET 10](https://img.shields.io/badge/.NET-10.0-512BD4?style=for-the-badge&logo=dotnet&logoColor=white)
![Angular](https://img.shields.io/badge/Angular-19-DD0031?style=for-the-badge&logo=angular&logoColor=white)
![SQL Server](https://img.shields.io/badge/SQL_Server-2022-CC2927?style=for-the-badge&logo=microsoft-sql-server&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Containerized-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![JWT](https://img.shields.io/badge/Auth-JWT_Bearer-000000?style=for-the-badge&logo=jsonwebtokens&logoColor=white)
![Clean Architecture](https://img.shields.io/badge/Architecture-Clean_Architecture-brightgreen?style=for-the-badge)

**A full-stack, production-ready LMS platform purpose-built for ERP software onboarding, tester evaluation, and employee training workflows.**

</div>

---

## 📌 Table of Contents

- [Overview](#-overview)
- [Key Features](#-key-features)
- [Architecture](#-architecture)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [User Roles & Portals](#-user-roles--portals)
- [API Endpoints](#-api-endpoints)
- [Authentication & Security](#-authentication--security)
- [Database Design](#-database-design)
- [Deployment](#-deployment)
- [Getting Started (Local Development)](#-getting-started-local-development)

---

## 🧠 Overview

**DynamicProLearn** is a full-stack Enterprise Learning Management System (LMS) designed to bridge the gap between ERP software delivery and user onboarding. The platform enables companies to:

- 📚 Structure their ERP training content into **Modules → Units → Lessons**.
- 👨‍💼 Assign and track **employee learning progress** across departments.
- 🧪 Manage **tester evaluation cycles** for ERP version releases.
- 📊 Monitor real-time **analytics** on lesson completion and tester feedback.
- 🔗 Integrate with an **external ERP system via deep-link SSO**, enabling users to launch the learning portal directly from inside the ERP.

The entire application is packaged as a **single Docker container** — the Angular SPA is bundled and served statically by the ASP.NET Core backend — making it trivially simple to deploy to any environment.

---

## ✨ Key Features

### 👨‍🏫 Admin Portal
| Feature | Description |
|---|---|
| **Company & Department Management** | Full CRUD for organizational hierarchy. |
| **User Management** | Create and manage Employees (Students) and Testers with role assignment. |
| **Content Builder** | Visual drag-and-drop-style builder for Modules, Units, and Lessons. |
| **Module Assignment** | Assign ERP modules to specific departments with targeted access control. |
| **ERP Version Management** | Create ERP software versions and assign specific testers to evaluate them. |
| **Analytics Dashboard** | View lesson engagement metrics, completion rates, and per-lesson performance. |
| **Tester Evaluation Dashboard** | Deep-dive into individual tester or version feedback and completion stats. |

### 🎓 Student (Employee) Portal
| Feature | Description |
|---|---|
| **Personalized Dashboard** | Shows only the modules/lessons assigned to the student's department. |
| **Lesson Viewer** | Rich content display for video, text, and media lessons. |
| **Progress Tracking** | Tracks `CompletedBy` and `MarkedBy` states per lesson, per user. |
| **Continue Learning** | Smart "resume" functionality that picks up where the student left off. |

### 🧪 Tester Portal
| Feature | Description |
|---|---|
| **Version Selection** | Testers choose their active ERP version to evaluate. |
| **Structured Feedback** | Testers submit feedback per lesson using configurable condition/level/type filters. |
| **Tester Dashboard** | Overview of assigned versions and completion status. |
| **Feedback Panel** | Full feedback submission with multi-attribute classification. |

### 🔗 ERP SSO Integration
- Supports **deep-link authentication** (`/erp-redirect`) allowing an external ERP system to authenticate users directly into DynamicProLearn by passing a pre-shared ERP key.

---

## 🏛️ Architecture

DynamicProLearn is built on **Clean Architecture** principles with a strict 4-layer separation of concerns:

```
┌──────────────────────────────────────────────────────────────────┐
│                        Presentation Layer                        │
│             Angular 19 SPA  +  ASP.NET Core Web API             │
└──────────────────────┬───────────────────────────────────────────┘
                       │ depends on
┌──────────────────────▼───────────────────────────────────────────┐
│                       Application Layer                          │
│  Services, DTOs, Interfaces, Feature Handlers (CQRS-inspired)   │
└──────────────────────┬───────────────────────────────────────────┘
                       │ depends on
┌──────────────────────▼───────────────────────────────────────────┐
│                         Domain Layer                             │
│          Entities, Enums, Base Classes (NO dependencies)         │
└──────────────────────────────────────────────────────────────────┘
                       ▲ implemented by
┌──────────────────────┴───────────────────────────────────────────┐
│                     Infrastructure Layer                         │
│  EF Core DbContext, Repositories, JWT, Password Hashing, Seeder  │
└──────────────────────────────────────────────────────────────────┘
```

**Key architectural decisions:**
- **Repository Pattern** + **Unit of Work** for all data access — controllers never touch the DbContext directly.
- **Interface-driven** dependency injection throughout — every service is registered against an interface, enabling full testability.
- **Auditable Entities** via an EF Core `SaveChangesInterceptor` that auto-stamps `CreatedAt` / `UpdatedAt` on every entity.
- **Global Exception Handling Middleware** for consistent, structured error responses across all endpoints.
- **Serilog** structured logging with daily rolling JSON log files.

---

## 🛠️ Tech Stack

### Backend
| Technology | Purpose |
|---|---|
| **.NET 10 / ASP.NET Core 10** | REST API & SPA Host |
| **Entity Framework Core 10** | ORM with Code-First migrations |
| **SQL Server 2022** | Relational database |
| **JWT Bearer Authentication** | Stateless authentication |
| **Serilog** | Structured JSON logging |
| **Scalar (OpenAPI)** | Modern API documentation UI |
| **BCrypt / Custom PasswordHasher** | Secure password hashing |

### Frontend
| Technology | Purpose |
|---|---|
| **Angular 19** | Single Page Application framework |
| **Angular Signals** | Reactive state management |
| **Angular Standalone Components** | Lazy-loaded, modular UI |
| **Role Guards** | Client-side route protection |
| **HTTP Interceptors** | Auto JWT token injection on every request |
| **Vanilla CSS** | Custom design system, RTL-aware |

### DevOps & Deployment
| Technology | Purpose |
|---|---|
| **Docker** | Multi-stage containerization |
| **Docker Compose** | Local orchestration with SQL Server |
| **Docker Hub** | Image registry & version tagging |

---

## 📁 Project Structure

```
DynamicProLearn/
│
├── src/                                    # .NET Solution
│   ├── LearnDynamicPro.Domain/             # Core entities, enums, base classes
│   │   ├── Entities/                       # 18 domain entities
│   │   └── Enums/                          # UserRole, CompletionSource
│   │
│   ├── LearnDynamicPro.Application/        # Business logic, DTOs, interfaces
│   │   ├── Features/                       # Auth, Admin, Student, Tester, Progress
│   │   ├── Interfaces/                     # ITokenService, IAuthService, Repositories...
│   │   └── Dtos/                           # Request/Response Data Transfer Objects
│   │
│   ├── LearnDynamicPro.Infrastructure/     # Data access & identity
│   │   ├── Identity/                       # JWT TokenService, PasswordHasher, CurrentUserService
│   │   ├── Persistence/                    # AppDbContext, Repositories, Seeder, Migrations
│   │   └── Persistence/Interceptors/       # AuditableEntityInterceptor
│   │
│   └── LearnDynamicPro.API/                # Web API entry point
│       ├── Controllers/                    # Auth, Admin, Student, Tester controllers
│       ├── Middlewares/                    # GlobalExceptionHandler, LogContextEnrichment
│       └── Program.cs                      # DI registration, middleware pipeline
│
├── learn-dynamic-pro-ui/                   # Angular 19 Frontend
│   └── src/app/
│       ├── core/                           # Guards, Interceptors, Services, Utils
│       │   ├── guards/                     # roleGuard (JWT-based route protection)
│       │   └── services/                   # AuthService, API services
│       ├── features/
│       │   ├── admin/                      # 10 admin feature components
│       │   ├── student/                    # Dashboard, LessonViewer, ContinueLearning
│       │   ├── tester/                     # Setup, Dashboard, FeedbackPanel, VersionSelect
│       │   └── auth/                       # Login, ERP Redirect (SSO)
│       └── shared/                         # Reusable UI components
│
└── deployment/
    ├── Dockerfile                          # Multi-stage build (Node 20 + .NET 10 SDK + .NET 10 Runtime)
    └── docker-compose.yml                  # App + SQL Server 2022 orchestration
```

---

## 👥 User Roles & Portals

The system implements a **3-tier role system** enforced at both the API (JWT Claims, `[Authorize(Policy)]`) and frontend (Angular `roleGuard`) levels:

```
┌─────────────┬──────────────────────────────────────────────────────────────────┐
│  Role       │  Capabilities                                                    │
├─────────────┼──────────────────────────────────────────────────────────────────┤
│  Admin      │  Full system control: companies, departments, users, content,    │
│             │  ERP versions, module assignments, analytics & tester oversight. │
├─────────────┼──────────────────────────────────────────────────────────────────┤
│  Student    │  View assigned learning content, track lesson progress,          │
│             │  resume learning across sessions.                                │
├─────────────┼──────────────────────────────────────────────────────────────────┤
│  Tester     │  Select active ERP version, consume learning material,           │
│             │  submit structured feedback per lesson with level/type filters.  │
└─────────────┴──────────────────────────────────────────────────────────────────┘
```

---

## 🌐 API Endpoints

### Auth Controller — `/api/Auth`
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/login` | Public | Standard username/password login |
| `POST` | `/erp-login` | Public | ERP SSO deep-link login |

### Admin Controller — `/api/Admin` *(AdminOnly)*
| Method | Endpoint | Description |
|---|---|---|
| `GET/POST` | `/companies` | List / Create companies |
| `GET/POST` | `/companies/{id}/departments` | Manage departments |
| `GET/POST` | `/modules` | List / Create ERP modules |
| `POST` | `/modules/assign` | Assign module to department |
| `GET/POST` | `/users` | List / Create students & testers |
| `GET/POST` | `/lessons` | Create / manage lessons |
| `GET` | `/analytics` | Lesson analytics overview |
| `GET` | `/analytics/lesson/{id}` | Per-lesson engagement data |
| `GET/POST` | `/versions` | ERP version management |
| `POST` | `/versions/{id}/testers` | Assign testers to a version |
| `GET` | `/testers/{id}` | Tester detail + feedback report |
| `GET` | `/versions/{id}/details` | Version detail + tester report |

### Student Controller — `/api/Student` *(StudentOrAbove)*
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/dashboard` | Assigned modules & progress |
| `GET` | `/lesson/{id}` | Lesson content retrieval |
| `POST` | `/lesson/{id}/complete` | Mark lesson as completed |
| `POST` | `/lesson/{id}/mark` | Bookmark lesson |

### Tester Controller — `/api/Tester` *(TesterOnly)*
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/versions` | Available versions for the tester |
| `POST` | `/versions/select` | Set active evaluation version |
| `GET` | `/dashboard` | Tester's active version & progress |
| `POST` | `/feedback` | Submit lesson feedback |

---

## 🔐 Authentication & Security

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          JWT Security Flow                              │
│                                                                         │
│  1. Client POSTs credentials → /api/Auth/login                         │
│  2. AuthService validates password hash via BCrypt                      │
│  3. TokenService generates signed JWT with claims:                      │
│     { sub: userId, unique_name: username, role: Admin|Student|Tester,  │
│       companyId: ..., departmentId: ..., exp: +60min }                  │
│  4. JWT signed with HMAC-SHA256 (HS256) using Secret Key               │
│  5. Angular stores token in localStorage & injects it on every request  │
│     via HTTP Interceptor: "Authorization: Bearer <token>"               │
│  6. ASP.NET Core validates: Issuer ✓ | Audience ✓ | Signature ✓ | TTL ✓│
│  7. [Authorize(Policy = "AdminOnly")] enforces role-based access        │
└─────────────────────────────────────────────────────────────────────────┘
```

**Security measures implemented:**
- ✅ JWT Bearer with `ValidateIssuer`, `ValidateAudience`, `ValidateLifetime`, `ValidateIssuerSigningKey`
- ✅ Password hashing (no plain-text passwords stored)
- ✅ Role-based Authorization Policies (`AdminOnly`, `StudentOrAbove`, `TesterOnly`)
- ✅ CORS restricted to the Angular dev origin in development mode
- ✅ Non-root Docker user (`app:app`) for container security
- ✅ `CurrentUserService` extracts caller identity from JWT claims for server-side user context

---

## 🗄️ Database Design

The system manages **18 domain entities** in a normalized SQL Server schema:

```
Companies ──< Departments ──< Users (Students/Testers)
                    │
                    └──< DepartmentModuleAssignments ──> Modules ──< Units ──< Lessons
                                                                              │
Users (Testers) ──< TesterActiveVersion ──> ErpVersions                      │
     │                                          │                            │
     └──< TesterFeedbacks ───────────────────────────────────────────────────┘
     │
     └──< LessonProgresses (CompletedBy / MarkedBy)

ErpVersions ──< VersionTesters ──> Users
```

**Notable patterns:**
- **Auditable Base Entity** — Every entity has `Id (Guid)`, `CreatedAt`, `UpdatedAt` auto-managed by EF Core Interceptor.
- **Soft Seeding** — `DatabaseSeeder` seeds initial Admin user and reference data on startup (idempotent).
- **EF Core Configurations** — Entity relationships are configured via `IEntityTypeConfiguration<T>` (Fluent API) in dedicated configuration files.
- **Generic Repository + Unit of Work** — Abstracts all data access to prevent direct DbContext coupling in the Application Layer.

---

## 🐳 Deployment

The application ships as a **single Docker image** combining the Angular frontend and .NET backend:

### Multi-Stage Docker Build
```
Stage 1: node:20-alpine        → Build Angular production bundle
Stage 2: dotnet/sdk:10.0       → Build & publish .NET backend
Stage 3: dotnet/aspnet:10.0    → Minimal runtime image (~200MB)
         └── Serves Angular from wwwroot (SPA fallback: index.html)
         └── Exposes port 8080 as non-root user
```

### Quick Deploy with Docker Compose
```bash
# Clone the repository
git clone https://github.com/MazenDarweesh/DynamicProLearn.git
cd DynamicProLearn

# Start the full stack (App + SQL Server 2022)
docker compose -f deployment/docker-compose.yml up -d

# Access the application
open http://localhost:8080
```

### Docker Hub
```bash
# Pull the latest production image
docker pull mazendarweesh/dynamicprolearn:latest

# Or pull a specific version
docker pull mazendarweesh/dynamicprolearn:v1.0.0
```

---

## ⚡ Getting Started (Local Development)

### Prerequisites
- [.NET 10 SDK](https://dotnet.microsoft.com/download)
- [Node.js 20+](https://nodejs.org/)
- [SQL Server 2022](https://www.microsoft.com/en-us/sql-server) (or use Docker)
- [Angular CLI](https://angular.io/cli) (`npm install -g @angular/cli`)

### 1. Backend Setup
```bash
# Navigate to the API project
cd src/LearnDynamicPro.API

# Update the connection string in appsettings.json
# (or use User Secrets for local development)

# Apply database migrations (auto-applies on startup via DatabaseSeeder)
dotnet ef database update --project ../LearnDynamicPro.Infrastructure

# Run the API (with Scalar API docs at /scalar)
dotnet run
# API running at: http://localhost:5115
# API docs at:    http://localhost:5115/scalar
```

### 2. Frontend Setup
```bash
# Navigate to the Angular project
cd learn-dynamic-pro-ui

# Install dependencies
npm install

# Start the development server
ng serve
# App running at: http://localhost:4200
```

### Default Admin Credentials
After the database seeder runs on first startup:
```
Username: admin
Password: Admin@1234
```

---

## 📊 System Capabilities at a Glance

```
📦 Backend
├── 4  Clean Architecture Layers
├── 18 Domain Entities
├── 4  API Controllers (25+ endpoints)
├── 10 Feature Services
├── 3  Authorization Policies (Role-based)
├── 2  Custom Middlewares
└── 1  Generic Repository + Unit of Work

🎨 Frontend
├── 4  Feature Portals (Admin / Student / Tester / Auth)
├── 14 Lazy-loaded Route Components
├── 3  Role-based Route Guards
└── 1  JWT HTTP Interceptor

🐳 DevOps
├── Multi-stage Dockerfile (3 stages)
├── Docker Compose (App + SQL Server)
└── Docker Hub CI-ready image tagging
```

---

## 🏗️ Built With Purpose

> DynamicProLearn was designed to solve a real-world challenge: **onboarding employees to complex ERP systems is hard**. Training material is scattered, progress is untracked, and tester feedback before a new ERP version release is often informal and unstructured. This platform centralizes all of that into one clean, role-aware, production-ready system.

---

<div align="center">

**Built with ❤️ using .NET 10 & Angular 19**

[🐳 Docker Hub](https://hub.docker.com/r/mazendarweesh/dynamicprolearn) · [🔗 LinkedIn](https://linkedin.com/in/mazen-darweesh)

</div>
