# NHKHUY Portal v2

The v2 rebuild is being developed alongside the production v0.1 portal.

## Stack

- ASP.NET Core Web API / .NET 10
- Angular + TypeScript
- SQLite + EF Core (next milestone)
- Cookie authentication, antiforgery, and admin-only authorization (next milestone)

## Structure

- `backend/Nhkhuy.Portal.Api` — ASP.NET Core API host
- `frontend` — Angular single-page application

## Local development

Backend:

```bash
dotnet run --project backend/Nhkhuy.Portal.Api
```

Frontend:

```bash
cd frontend
npm install
npm start
```

This foundation is not production-ready and must not be routed from the public domain yet.
