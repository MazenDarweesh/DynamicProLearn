# 📡 DynamicProLearn REST API Reference

This document provides a comprehensive technical contract specification for all endpoints exposed by the **LearnDynamicPro .NET 10 Web API** (`http://localhost:5115`).

---

## 🔐 Authentication & Identity (`/api/Auth`)

| Method | Route | Access | Description |
|:---|:---|:---|:---|
| `POST` | `/api/Auth/login` | Public | Authenticates a user with email/username and password. Returns JWT access token and 7-day refresh token. |
| `POST` | `/api/Auth/erp-login` | Public | Deep-link SSO entrypoint using encrypted `erpKey` passed from external ERP systems. |
| `POST` | `/api/Auth/refresh-token` | Public | Exchanges an expired access token and valid refresh token for a fresh token pair. |

### Sample Payload: Silent Refresh Token (`POST /api/Auth/refresh-token`)
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```
**Success Response (200 OK):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.new...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.new...",
  "userId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "username": "mazen",
  "role": "Admin",
  "fullName": "Mazen Darweesh"
}
```

---

## 👑 Administration & Curriculum Builder (`/api/Admin`)
*All endpoints require `Authorization: Bearer <JWT>` with `Admin` role.*

### Lookups & Organizations
| Method | Route | Description |
|:---|:---|:---|
| `GET` | `/api/Admin/lookups/levels` | Fetch all difficulty levels (Beginner, Intermediate, Advanced). |
| `GET` | `/api/Admin/lookups/types` | Fetch all lesson types (Theory, Practical, Assessment). |
| `GET` | `/api/Admin/companies` | List all registered corporate client companies. |
| `POST` | `/api/Admin/companies` | Register a new enterprise client company. |
| `PUT` | `/api/Admin/companies/{id}` | Update company details. |
| `DELETE` | `/api/Admin/companies/{id}` | Deactivate/remove a company. |
| `GET` | `/api/Admin/companies/{companyId}/departments` | List all departments belonging to a company. |
| `POST` | `/api/Admin/departments` | Create a new department. |
| `PUT` | `/api/Admin/departments/{id}` | Update department info. |
| `DELETE` | `/api/Admin/departments/{id}` | Delete department. |

### Users & Progression Management
| Method | Route | Description |
|:---|:---|:---|
| `POST` | `/api/Admin/users` | Provision an employee, tester, or admin user. |
| `PUT` | `/api/Admin/users/{userId}` | Update user information and assigned department. |
| `DELETE` | `/api/Admin/users/{userId}` | Disable user access. |
| `GET` | `/api/Admin/users-progress` | Global overview of employee learning progress across departments. |
| `GET` | `/api/Admin/testers-progress` | Overview of tester evaluations per ERP software version. |
| `GET` | `/api/Admin/users/{id}/details` | Detailed progress profile for an individual student. |
| `GET` | `/api/Admin/testers/{id}/details` | Detailed evaluation breakdown for an individual tester. |

### Visual Curriculum Builder (Modules → Units → Lessons)
| Method | Route | Description |
|:---|:---|:---|
| `GET` | `/api/Admin/modules` | Fetch all curriculum modules. |
| `POST` | `/api/Admin/modules` | Create a new training module. |
| `DELETE` | `/api/Admin/modules/{id}` | Delete module and cascade contents. |
| `GET` | `/api/Admin/modules/{moduleId}/units` | List units inside a module. |
| `POST` | `/api/Admin/units` | Create a new unit inside a module. |
| `DELETE` | `/api/Admin/units/{id}` | Delete unit. |
| `GET` | `/api/Admin/units/{unitId}/lessons` | List lessons inside a unit. |
| `POST` | `/api/Admin/lessons` | Create a lesson (with video URL, PDF, levels, and types). Triggers AI webhook. |
| `DELETE` | `/api/Admin/lessons/{id}` | Delete lesson. Triggers AI webhook deletion notice. |

### Department Assignments & Analytics
| Method | Route | Description |
|:---|:---|:---|
| `POST` | `/api/Admin/assignments` | Assign curriculum modules to specific departments with level/type filters. |
| `GET` | `/api/Admin/departments/{departmentId}/assignments` | Retrieve active module assignments for a department. |
| `DELETE` | `/api/Admin/assignments/{id}` | Revoke module assignment from department. |
| `GET` | `/api/Admin/analytics/curriculum` | High-level curriculum engagement analytics. |
| `GET` | `/api/Admin/analytics/lessons/{lessonId}` | Granular analytics for a specific lesson (completion rate, time spent). |

### AI Curriculum Generation & Cache Management
| Method | Route | Description |
|:---|:---|:---|
| `POST` | `/api/Admin/lessons/{lessonId}/generate-quiz` | Triggers Python AI engine to generate multiple-choice quiz (returns `202 Accepted` with async job processing) and saves it in SQL Server. |
| `GET` | `/api/Admin/lessons/{lessonId}/quiz` | Retrieves AI-generated quiz questions for inspection. |
| `POST` | `/api/Admin/lessons/{lessonId}/generate-summary` | Triggers AI generation of comprehensive lesson summary (returns `202 Accepted` async job). |
| `GET` | `/api/Admin/lessons/{lessonId}/summary` | Retrieves AI-generated lesson summary markdown. |
| `POST` | `/api/Admin/lessons/{lessonId}/retry-ai-ingest` | Reset failed or stalled video ingestion state and re-dispatch ingestion event. |
| `POST` | `/api/Admin/ai/cache/clear` | Admin proxy that flushes both Exact In-Memory Cache and Semantic Vector Cache in Python AI engine. |

---

## 🎓 Student & Employee Portal (`/api/Student`)
*All endpoints require `Authorization: Bearer <JWT>` with `Student` or above.*

| Method | Route | Description |
|:---|:---|:---|
| `GET` | `/api/Student/copilot-filters` | Retrieve dynamic hierarchical curriculum filter tree (modules, units, lessons, levels, types) scoped by student RBAC permissions (aliased for Admin at `/api/Admin/copilot-filters`). |
| `GET` | `/api/Student/modules` | Fetch all training modules assigned to the authenticated student's department. |
| `GET` | `/api/Student/modules/{moduleId}/units` | View units inside an assigned module. |
| `GET` | `/api/Student/units/{unitId}/lessons` | View lessons inside an assigned unit with completion statuses. |
| `GET` | `/api/Student/lessons/{lessonId}` | Retrieve full lesson details (video stream, PDF attachments, descriptions). |
| `POST` | `/api/Student/lessons/{lessonId}/complete` | Mark lesson as completed or toggle completion progress. |
| `GET` | `/api/Student/progress` | Overall curriculum completion percentage and statistics. |
| `GET` | `/api/Student/last-lesson` | Fetch last accessed lesson for 1-click resume. |
| `GET` | `/api/Student/next-lesson` | Dynamically recommends the next lesson in the curriculum sequence. |
| `GET` | `/api/Student/unified-curriculum` | Flat list of full assigned curriculum for streamlined track navigation. |
| `GET` | `/api/Student/lessons/{lessonId}/quiz` | Retrieve interactive practice quiz for the lesson. |
| `POST` | `/api/Student/lessons/{lessonId}/quiz/check-answer` | Submit single answer for instant interactive evaluation and AI explanation disclosure. |
| `GET` | `/api/Student/lessons/{lessonId}/summary` | Read AI-generated summary notes before or after watching video. |

---

## 🧪 Tester & Evaluation Portal (`/api/Tester`)
*All endpoints require `Authorization: Bearer <JWT>` with `Tester` role.*

| Method | Route | Description |
|:---|:---|:---|
| `GET` | `/api/Tester/versions` | List all available ERP software versions. |
| `GET` | `/api/Tester/my-versions` | List versions specifically assigned to the authenticated tester. |
| `GET` | `/api/Tester/my-modules` | List ERP modules assigned to the tester under active version. |
| `POST` | `/api/Tester/active-version` | Set the active working ERP version context. |
| `POST` | `/api/Tester/feedback` | Submit structured evaluation/bug report for a specific lesson/module. |
| `GET` | `/api/Tester/feedback` | View all submitted feedback for the active version. |
| `GET` | `/api/Tester/conditions` | Retrieve standardized evaluation criteria (Pass, Fail, Regression, UI Glitch). |

---

## 🤖 Service-to-Service AI Endpoints (`/api/internal`)
*Restricted to internal services. Validated using `Authorization: Bearer <JWT>` or `X-Service-Token`.*

| Method | Route | Description |
|:---|:---|:---|
| `POST` | `/api/internal/lessons/{lessonId}/ai-status` | Status callback from AI worker (`Completed`, `Failed`, `Processing`) with chunk count and error message. Validated with `X-Webhook-Signature` HMAC. |
| `GET` | `/api/internal/user-permissions/{userId}` | Returns the full list of accessible modules, units, and lessons for the user to enforce strict RBAC in Qdrant search. |
| `GET` | `/api/internal/lessons/{lessonId}/full-context` | Returns rich metadata (video URL, PDF URL, module, unit, level, type, dual-casing tenant IDs: `CompanyId`/`company_id`, `DepartmentId`/`department_id`) for RAG embedding generation. |

---

## 📡 Webhook Specification (Outbound to AI Engine)
When a lesson is modified or deleted in .NET, `WebhookDispatcher` sends an HTTP POST request to:
`POST http://localhost:8000/v1/webhooks/lesson-updated`

**Headers:**
```http
X-Service-Token: default_service_token
X-Webhook-Signature: sha256=a1b2c3d4e5f6...
Content-Type: application/json
```

**Payload:**
```json
{
  "lesson_id": "8f1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d",
  "lessonId": "8f1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d",
  "action": "Updated"
}
```
*(Supports both SnakeCase and CamelCase keys to ensure zero deserialization friction).*

