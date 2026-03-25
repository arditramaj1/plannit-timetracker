# Plannit Time Tracker

## Architecture Overview

This repository is a monorepo for a calendar-based time tracking application with a Django REST backend and a Next.js frontend.

- Backend: Django, Django REST Framework, PostgreSQL, JWT authentication, Django admin.
- Frontend: Next.js App Router, React, Tailwind CSS, shadcn-style component primitives, TanStack Query.
- Infrastructure: local backend/frontend workflow, optional Dockerized PostgreSQL for development, seed scripts, health checks, environment-driven configuration.

Key architectural choices:

- Time tracking is based on fixed one-hour calendar slots rather than running timers.
- The admin/user role split is implemented with Django's built-in staff/superuser permissions, which keeps admin management native to Django admin.
- Work log overlap prevention is enforced by a database-level uniqueness rule on `user + work_date + hour_slot`.
- Admin reporting is exposed through a dedicated reporting endpoint with JSON and CSV output modes.

## Folder Structure

```text
.
├── backend/
│   ├── apps/
│   │   ├── accounts/
│   │   ├── common/
│   │   ├── projects/
│   │   ├── reports/
│   │   └── worklogs/
│   ├── config/
│   │   └── settings/
│   ├── scripts/
│   ├── Dockerfile
│   ├── manage.py
│   ├── pyproject.toml
│   └── uv.lock
├── frontend/
│   ├── public/
│   ├── scripts/
│   ├── src/
│   │   ├── app/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── lib/
│   │   └── services/
│   ├── Dockerfile
│   └── package.json
├── scripts/
│   ├── dev-down.sh
│   └── dev-up.sh
├── .env.example
├── docker-compose.yml
└── docker-compose.dev.yml
```

## Core Implementation

### Backend

- `backend/config/settings/`
  - `base.py`: shared settings, DRF, JWT, PostgreSQL, CORS/CSRF, static/media.
  - `development.py`: relaxed dev config.
  - `production.py`: secure production defaults.
- `backend/apps/accounts/`
  - login via JWT token pair endpoint
  - current user endpoint
  - admin-only user listing
- `backend/apps/projects/`
  - `Project` model with status, color, code, and admin CRUD
  - seed command creates demo projects and users
- `backend/apps/worklogs/`
  - `WorkLogEntry` model for fixed one-hour slots
  - duplicate-slot prevention
  - owner/admin permission model
  - list/create/update/delete API
- `backend/apps/reports/`
  - admin-only summary endpoint
  - groupings by day/week/month
  - filters by user, project, and date range
  - CSV export support

### Frontend

- `frontend/src/app/(auth)/login/`
  - branded login screen
- `frontend/src/app/(app)/calendar/`
  - weekly calendar page
  - week navigation
  - modal-based create/edit/delete flow
- `frontend/src/app/(app)/projects/`
  - admin project management page
- `frontend/src/app/(app)/reports/`
  - admin reporting dashboard with filters and CSV export
- `frontend/src/components/ui/`
  - shadcn-inspired primitives for buttons, dialogs, selects, cards, tables, inputs, and badges
- `frontend/src/services/`
  - typed API client with JWT refresh flow

## API Endpoints

Base URL: `http://localhost:8000/api/v1`

Authentication:

- `POST /auth/token/`
- `POST /auth/token/refresh/`
- `GET /auth/me/`
- `GET /auth/users/` admin only

Projects:

- `GET /projects/`
- `POST /projects/` admin only
- `PATCH /projects/:id/` admin only
- `DELETE /projects/:id/` admin only

Work logs:

- `GET /worklogs/?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD`
- `POST /worklogs/`
- `PATCH /worklogs/:id/`
- `DELETE /worklogs/:id/`

Reports:

- `GET /reports/summary/?period=week&reference_date=YYYY-MM-DD`
- `GET /reports/summary/?period=custom&date_from=YYYY-MM-DD&date_to=YYYY-MM-DD`
- `GET /reports/summary/?export=csv&...` admin only

Utility:

- `GET /health/`

## Reporting Approach

Reports query the `WorkLogEntry` table with optional filters and return:

- total hours and entry counts
- grouped totals by user
- grouped totals by project
- timeline buckets by day, week, or month
- detailed rows for export-friendly review

CSV export is implemented as a separate response mode on the same reporting endpoint so it can be extended later for scheduled exports or PDF generation.

## Environment Strategy

Copy these files before starting:

- `.env.example` to `.env`
- `backend/.env.example` to `backend/.env`
- `frontend/.env.local.example` to `frontend/.env.local`

Important environment variables:

- `DJANGO_SECRET_KEY`
- `DJANGO_ALLOWED_HOSTS`
- `DJANGO_CORS_ALLOWED_ORIGINS`
- `DJANGO_CSRF_TRUSTED_ORIGINS`
- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_HOST`
- `POSTGRES_PORT`
- `NEXT_PUBLIC_API_BASE_URL`

## Development Run Instructions

### Local Development

For local development, run the frontend and backend directly on your machine. PostgreSQL can run in a local container, but the database tables are created by Django migrations, not by Docker.

```bash
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.local.example frontend/.env.local
```

Install dependencies locally:

```bash
cd backend
uv sync --locked

cd ../frontend
npm ci
```

Start PostgreSQL in a local container:

```bash
bash scripts/dev-up.sh
```

If you prefer to run it directly:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d db
```

Run Django migrations locally to create/update the tables in that PostgreSQL container:

```bash
cd backend
uv run python manage.py migrate --noinput
uv run python manage.py seed_demo_data || true
```

Start the backend locally:

```bash
cd backend
uv run python manage.py runserver 0.0.0.0:8000
```

Start the frontend locally in a second terminal:

```bash
cd frontend
npm run dev
```

To stop the PostgreSQL container:

```bash
bash scripts/dev-down.sh
```

Application URLs:

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:8000/api/v1`
- Django admin: `http://localhost:8000/admin`

Seeded credentials:

- Admin: `admin / admin123`
- Regular user: `alex / demo123`

## Production Notes

- Use `config.settings.production` in production and inject a real `DJANGO_SECRET_KEY`.
- Set `DJANGO_ALLOWED_HOSTS`, `DJANGO_CORS_ALLOWED_ORIGINS`, and `DJANGO_CSRF_TRUSTED_ORIGINS` to real public origins.
- Run the backend behind a reverse proxy or load balancer that terminates TLS.
- The backend Docker image already uses Gunicorn for production.
- The frontend Docker image builds a standalone Next.js server for production.
- Static assets are collected into `backend/staticfiles`; media uploads are stored in `backend/media`.
- The current JWT flow is good for a decoupled SPA/API setup. For stricter browser hardening, the next step would be moving refresh tokens to secure HttpOnly cookies behind a same-site proxy.

## Recommended Next Steps

- Add automated tests for serializer validation, permissions, and critical frontend flows.
- Add pagination and saved filters for large report datasets.
- Add CSV/PDF export scheduling and email delivery if reporting grows.
- Add audit logs for admin edits if the product requires stricter compliance.
