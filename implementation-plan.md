# Salary Management Tool — Backend Implementation Plan

> **Stack:** NestJS · Prisma ORM · SQLite · JWT Authentication · Jest  
> **Scope:** Backend API only (REST). Frontend integration points are noted where relevant.  
> **Target Scale:** 10,000 employee records with performant seeding and sub-second analytics queries.

---

## Phase 1: Project Bootstrap & Database Design
**Goal:** Initialize the codebase, configure the toolchain, and lock the data model.

| Task | Details |
|------|---------|
| 1.1 Initialize NestJS | `nest new salary-mgmt-api` with strict TS, ESLint ( Airbnb / Nest recommended ), Prettier. |
| 1.2 Install dependencies | `@nestjs/jwt`, `@nestjs/passport`, `passport`, `passport-jwt`, `bcrypt`, `class-validator`, `class-transformer`, `@prisma/client`, `prisma`, `swagger-ui-express`. |
| 1.3 Prisma init | `prisma init` → configure SQLite datasource, create `prisma/schema.prisma`. |
| 1.4 Schema design | Finalize models (see **Data Model** below). Run initial migration. |
| 1.5 Env configuration | `@nestjs/config` module with `.env` validation (Joi or class-validator). Variables: `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `PORT`, `NODE_ENV`. |
| 1.6 Prisma module | Create a global `PrismaModule` exposing `PrismaService` extending `OnModuleInit` / `OnModuleDestroy` for clean connection lifecycle. |
| 1.7 Swagger setup | `SwaggerModule` in `main.ts` for auto-generated API docs consumed by the React/Next.js UI. |

### Data Model (Prisma Schema)
```prisma
model User {
  id        Int      @id @default(autoincrement())
  email     String   @unique
  password  String   // hashed
  role      Role     @default(HR_MANAGER)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Employee {
  id               Int              @id @default(autoincrement())
  employeeId       String           @unique // org-level ID, e.g. "EMP-00001"
  firstName        String
  lastName         String
  email            String           @unique
  jobTitle         String
  department       String
  country          String
  salary           Decimal          @db.Decimal(12, 2)
  currency         String           @default("USD")
  employmentStatus EmploymentStatus @default(FULL_TIME)
  hireDate         DateTime
  createdAt        DateTime         @default(now())
  updatedAt        DateTime         @updatedAt

  @@index([country, salary])
  @@index([jobTitle, country])
  @@index([department])
}

enum Role {
  HR_MANAGER
  ADMIN
}

enum EmploymentStatus {
  FULL_TIME
  PART_TIME
  CONTRACT
  INTERN
}
```

**Key decisions:**
- `Decimal` for salary to prevent floating-point rounding errors.
- Composite indexes on `(country, salary)` and `(jobTitle, country)` to guarantee fast aggregations at 10k scale.
- `employeeId` as a human-readable business key separate from the auto-increment PK.

---

## Phase 2: Authentication & Authorization
**Goal:** Secure every analytics and mutation endpoint using stateless JWT.

| Task | Details |
|------|---------|
| 2.1 Auth module scaffold | `AuthModule`, `AuthService`, `AuthController`. |
| 2.2 Local strategy (login) | `POST /auth/login` — validate email/password with bcrypt, return `{ access_token }`. |
| 2.3 JWT strategy | `JwtStrategy` reads `Authorization: Bearer <token>`, validates signature & expiry. |
| 2.4 Global guard | `APP_GUARD` provider using `AuthGuard('jwt')` so every route is protected by default. |
| 2.5 Public decorator | `@Public()` decorator to opt-out routes (login, health-check). |
| 2.6 Role-based access | `RolesGuard` + `@Roles(Role.HR_MANAGER)` for future admin endpoints. |
| 2.7 Password hashing | `bcrypt` with salt rounds = 12. Never store plain text. |
| 2.8 Seeded admin user | Include one seeded user in the seed script so the evaluator can log in immediately. |

**Endpoints delivered:**
- `POST /auth/login`
- `GET /auth/me` (optional — returns current user profile)

---

## Phase 3: Employee Management (CRUD)
**Goal:** Full lifecycle endpoints for the HR Manager persona with pagination and validation.

| Task | Details |
|------|---------|
| 3.1 Module scaffold | `EmployeesModule`, `EmployeesService`, `EmployeesController`. |
| 3.2 DTOs & validation | `CreateEmployeeDto`, `UpdateEmployeeDto` using `class-validator`. Enforce email uniqueness, positive salary, valid ISO country codes (optional: use `country-code-list`). |
| 3.3 Create | `POST /employees` — auto-generate `employeeId` (zero-padded sequence). |
| 3.4 Read (list) | `GET /employees?page=1&limit=20&country=US&jobTitle=Engineer` — paginated, filterable, sortable. |
| 3.5 Read (single) | `GET /employees/:id` — return full record. |
| 3.6 Update | `PATCH /employees/:id` — partial updates allowed. |
| 3.7 Delete | `DELETE /employees/:id` — hard delete (soft delete optional if time permits). |
| 3.8 Search | `GET /employees/search?q=john` — full-text search on firstName / lastName / email using Prisma `contains` mode `insensitive`. |

**Performance notes:**
- Use Prisma `findMany` with `skip` / `take` for pagination.
- Return `{ data, meta: { total, page, lastPage } }` envelope for easy UI table binding.

---

## Phase 4: Salary Insights & Analytics
**Goal:** Aggregated metrics that answer the HR Manager’s business questions instantly.

| Task | Details |
|------|---------|
| 4.1 Insights module | `InsightsModule`, `InsightsService`, `InsightsController`. |
| 4.2 Country aggregates | `GET /insights/salary-by-country?country=US` → `{ min, max, avg, median, count, totalPayroll }`. |
| 4.3 Job-title + country | `GET /insights/salary-by-job-title?country=US&jobTitle=Software Engineer` → `{ avg, min, max, count }`. |
| 4.4 Global overview | `GET /insights/overview` → top-level KPIs: total employees, total payroll, avg tenure, count by status. |
| 4.5 Distribution | `GET /insights/distribution?country=US` → salary histogram buckets (e.g., 5 percentile bands) for charting in UI. |
| 4.6 Prisma aggregation | Leverage `prisma.employee.aggregate`, `groupBy`, and raw `$queryRaw` for median / percentile calculations (SQLite percentile support via custom CTE if needed). |

**Query strategy:**
- SQLite handles 10k rows effortlessly; indexed columns make aggregation queries < 50 ms.
- If median proves tricky in Prisma alone, use a controlled `$queryRaw` with a window-function CTE (SQLite 3.25+ supports window functions).

---

## Phase 5: High-Performance Seeding
**Goal:** Populate 10,000 realistic employees in < 3 seconds on developer hardware.

| Task | Details |
|------|---------|
| 5.1 Seed harness | `prisma/seed.ts` executed via `ts-node` and registered in `package.json` `"prisma": { "seed": "ts-node prisma/seed.ts" }`. |
| 5.2 Name generator | Read `first_names.txt` and `last_names.txt` into memory arrays. Use deterministic random or `faker` to combine them into unique full names. |
| 5.3 Data generation | Generate 10k objects with varied job titles (20 options), departments (8 options), countries (10 options), salaries (30k – 250k), statuses, and hire dates spanning 10 years. |
| 5.4 Bulk insert | **Critical for speed.** Use `prisma.employee.createMany({ data: batch, skipDuplicates: true })` in batches of **1,000–2,000**. Wrap all batches in a single `$transaction` for atomicity. |
| 5.5 Admin user seed | Insert one `User` record with known credentials (e.g., `hr@company.com / password123`) so evaluators can authenticate immediately. |
| 5.6 Performance check | Add a `console.time/timeEnd` block; target < 3s for 10k rows. If slower, switch batch size or use `better-sqlite3` raw import as fallback. |

**Commit checkpoint:** After this phase, the database should be reproducible with `npx prisma migrate dev && npx prisma db seed`.

---

## Phase 6: Testing Strategy
**Goal:** Fast, deterministic unit tests covering core logic without hitting a real disk-backed DB.

| Task | Details |
|------|---------|
| 6.1 Test DB setup | Use an **in-memory SQLite** (`file::memory:`) or a temporary file per test run for Prisma integration tests. |
| 6.2 Prisma testing utilities | Create a `PrismaTestModule` that spins up Prisma, runs migrations, and truncates tables before each test context. |
| 6.3 Service unit tests | Mock Prisma client with `jest.spyOn` or a lightweight in-memory stub for pure logic tests. |
| 6.4 Auth tests | Test `AuthService.validateUser` (bcrypt integration), `JwtStrategy`, token expiry edge cases. |
| 6.5 Employee CRUD tests | Create → expect correct `employeeId` generation. Update → expect changed field. Delete → expect `NotFoundException`. |
| 6.6 Insights tests | Seed a known dataset (e.g., 5 employees) and assert exact aggregation values (deterministic). |
| 6.7 Controller tests | Mock services, test HTTP status codes, DTO validation pipes, and guard behavior. |
| 6.8 Coverage gate | Aim for **> 80 %** on services and controllers. Exclude DTOs / Prisma client from coverage. |

**Test principles enforced:**
- No network calls.
- No dependency on external files during unit tests (mock file reads).
- Each test independent (no shared DB state).

---

## Phase 7: Deployment, Documentation & Demo Prep
**Goal:** Ship a live backend and a short video walkthrough.

| Task | Details |
|------|---------|
| 7.1 Production build | `nest build` optimization, enable `webpack` or `swc` for faster builds. |
| 7.2 Docker (optional) | `Dockerfile` multi-stage build with Node 20 Alpine + SQLite. `.dockerignore` to keep image small. |
| 7.3 Environment parity | Ensure `DATABASE_URL` points to a persistent SQLite file in production (or mount a volume). |
| 7.4 CORS | Enable `app.enableCors()` with the deployed frontend origin. |
| 7.5 Health check | `GET /health` using `@nestjs/terminus` (Prisma DB ping). |
| 7.6 API docs polish | Swagger UI with bearer-auth button so frontend devs can test endpoints directly. |
| 7.7 Deploy | Railway / Render / Fly.io / VPS — any platform that persists SQLite file across restarts (or migrate to PostgreSQL if required later). |
| 7.8 Seed in prod | Document one-time `npx prisma db seed` after first deploy. |
| 7.9 Video demo script | 2–3 min screen recording showing: login → create employee → view list → view salary insights → run seed script locally with timing output. |

---

## Suggested Commit History (Incremental Evolution)

| Commit | Message | Scope |
|--------|---------|-------|
| 1 | `chore: init NestJS project with Prisma and SQLite` | Phase 1 |
| 2 | `feat: add Employee and User Prisma schema with indexes` | Phase 1 |
| 3 | `feat: implement JWT auth module with login and guards` | Phase 2 |
| 4 | `feat: add employee CRUD endpoints with pagination and DTOs` | Phase 3 |
| 5 | `feat: add salary insights endpoints (country, job-title aggregates)` | Phase 4 |
| 6 | `feat: high-performance seed script for 10k employees` | Phase 5 |
| 7 | `test: unit tests for auth, employee, and insights services` | Phase 6 |
| 8 | `chore: swagger docs, CORS, health check, and deployment config` | Phase 7 |

---

## Appendix: API Endpoint Summary

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/login` | Public | Obtain JWT |
| GET | `/employees` | JWT | List (paginated, filterable) |
| POST | `/employees` | JWT | Create |
| GET | `/employees/:id` | JWT | Single |
| PATCH | `/employees/:id` | JWT | Update |
| DELETE | `/employees/:id` | JWT | Delete |
| GET | `/employees/search` | JWT | Search by name/email |
| GET | `/insights/salary-by-country` | JWT | Min / max / avg / median per country |
| GET | `/insights/salary-by-job-title` | JWT | Avg salary for job title in country |
| GET | `/insights/overview` | JWT | Global KPIs |
| GET | `/insights/distribution` | JWT | Salary histogram |
| GET | `/health` | Public | Service health |

---

## Appendix: File Structure

```
salary-mgmt-api/
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts
│   └── first_names.txt
│   └── last_names.txt
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── prisma/
│   │   └── prisma.service.ts
│   ├── auth/
│   │   ├── auth.module.ts
│   │   ├── auth.service.ts
│   │   ├── auth.controller.ts
│   │   ├── strategies/
│   │   │   ├── jwt.strategy.ts
│   │   │   └── local.strategy.ts
│   │   ├── guards/
│   │   │   ├── jwt-auth.guard.ts
│   │   │   └── roles.guard.ts
│   │   └── decorators/
│   │       ├── public.decorator.ts
│   │       └── roles.decorator.ts
│   ├── employees/
│   │   ├── employees.module.ts
│   │   ├── employees.service.ts
│   │   ├── employees.controller.ts
│   │   └── dto/
│   │       ├── create-employee.dto.ts
│   │       └── update-employee.dto.ts
│   ├── insights/
│   │   ├── insights.module.ts
│   │   ├── insights.service.ts
│   │   └── insights.controller.ts
│   └── health/
│       └── health.controller.ts
├── test/
│   ├── jest-e2e.json
│   └── app.e2e-spec.ts
├── .env.example
├── Dockerfile
└── package.json
```

---

*Plan generated for backend implementation. Frontend (React/Next.js) consumes these REST endpoints; CORS and Swagger contracts are pre-configured for seamless integration.*
