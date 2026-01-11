# 3D Model Platform — Parametric STL Generation & Slicing

This is my final year project: a web app that lets you design simple parametric 3D models, generate STLs on demand, and slice them to G-code — all in the browser. It’s built to be practical: pick a template, tweak a few numbers, get a printable file. No heavy CAD, no long setup.

## Why I built this
- I wanted a faster path from idea → printable part.
- Many common shapes (cubes, cylinders, pyramids) are better as quick parametric templates.
- Automating STL generation with OpenSCAD and slicing with CuraEngine makes this repeatable and reliable.

## What it does
- Parametric model templates rendered via OpenSCAD.
- Server-side STL generation with sane defaults.
- One-click slicing to G-code using profiles (e.g., balanced Ender 3 settings).
- Minimal, clean UI built with Next.js.
- FastAPI backend with simple JSON endpoints.
- Dockerized services to keep dependencies isolated.

## Architecture
- **Frontend (Next.js)**: User interface in [frontend](frontend).
- **Backend (FastAPI)**: API endpoints in [backend/app](backend/app) with routes for templates, STL generation, and slicing.
- **OpenSCAD service**: CLI used for rendering SCAD → STL. See [docker/openscad-service](docker/openscad-service).
- **CuraEngine service**: CLI used for STL → G-code. See [docker/curaengine-service](docker/curaengine-service).
- **Shared jobs folder**: Generated files live in [backend/jobs](backend/jobs) and are mounted into services.
- **Settings & definitions**: Slicing profiles and printer definitions in [backend/app/settings](backend/app/settings).

High-level flow:
1. User selects a template from `/templates`.
2. Frontend posts template parameters to `/generate-stl` to produce an STL.
3. Frontend (or user) posts to `/slice` (or `/slice-stl`) with a profile/overrides to get G-code.

## API Overview
- `GET /` — health check.
- `GET /templates` — list available templates with metadata.
- `POST /generate-stl` — body: `{ template_id, params }` → returns binary STL.
- `POST /slice` — body: `{ template_id, params, slice_settings?, profile? }` → returns G-code.
- `POST /slice-stl` — body: `{ stl_filename, slice_settings?, profile? }` → returns G-code for an existing STL.
- `GET /profiles` — list available slicing profiles.
- `GET /profiles/{name}` — get full settings for a profile.

## Quick Start (Docker)
Prerequisites: Docker + Docker Compose.

```bash
docker compose up --build
```

- Frontend: http://localhost:3000
- Backend: http://localhost:8000

The services share the [backend/jobs](backend/jobs) folder for generated files.

## Local Development (without Docker)
Backend (FastAPI):

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Frontend (Next.js):

```bash
cd frontend
npm install
npm run dev
```

Set the API URLs for the browser in [frontend/next.config.ts](frontend/next.config.ts) or via env:
- `NEXT_PUBLIC_API_URL`: server-to-server (e.g., `http://localhost:8000` when running locally, or `http://backend:8000` in Docker)
- `NEXT_PUBLIC_API_URL_BROWSER`: client-side calls (usually `http://localhost:8000`)

Note: If not using Docker, you’ll need OpenSCAD and CuraEngine installed locally (or adapt paths). The Docker route is simpler because it packages those CLIs for you.

## Usage Examples
List templates:

```bash
curl http://localhost:8000/templates
```

Generate a cube STL (saved in jobs):

```bash
curl -X POST http://localhost:8000/generate-stl \
	-H "Content-Type: application/json" \
	-d '{
		"template_id": "cube",
		"params": { "CUBE_SIZE": 20, "CENTERED": false }
	}' --output cube.stl
```

Slice a generated STL to G-code using the balanced profile:

```bash
curl -X POST http://localhost:8000/slice \
	-H "Content-Type: application/json" \
	-d '{
		"template_id": "cube",
		"params": { "CUBE_SIZE": 20, "CENTERED": false },
		"profile": "balanced_profile"
	}' --output cube.gcode
```

Alternatively, slice an existing STL from the jobs folder:

```bash
curl -X POST http://localhost:8000/slice-stl \
	-H "Content-Type: application/json" \
	-d '{
		"stl_filename": "<job-id>.stl",
		"profile": "balanced_profile"
	}' --output part.gcode
```

## Project Structure
- **Root**
	- [docker-compose.yml](docker-compose.yml): Orchestrates backend, frontend, OpenSCAD, CuraEngine.
- **Backend**
	- [backend/app/main.py](backend/app/main.py): FastAPI app setup + CORS.
	- [backend/app/routes](backend/app/routes): `generate.py`, `slice.py`, `templates.py`.
	- [backend/app/services](backend/app/services): STL generation, slicing, template catalog.
	- [backend/app/settings](backend/app/settings): Profiles and printer definition files.
	- [backend/templates](backend/templates): Jinja2 SCAD templates.
	- [backend/jobs](backend/jobs): Output files (SCAD/STL/G-code).
- **Frontend**
	- [frontend/src/app](frontend/src/app): Next.js app directory with pages.
	- [frontend/lib/auth.ts](frontend/lib/auth.ts): Placeholder for future auth.
- **Docker services**
	- [docker/openscad-service/Dockerfile](docker/openscad-service/Dockerfile)
	- [docker/curaengine-service/Dockerfile](docker/curaengine-service/Dockerfile)

## Testing
Backend tests live in [backend/tests](backend/tests). To run locally:

```bash
cd backend
pytest
```

Notes:
- Some tests will skip if OpenSCAD isn’t installed (that’s expected outside Docker).
- STL generation test writes to a temporary directory and checks that files are non-trivial in size.

## Design Decisions
- **Templates first**: Common shapes are faster to customize than re-modeling.
- **CLI tools in containers**: OpenSCAD and CuraEngine are packaged to reduce setup friction.
- **Profiles**: Default to balanced Ender 3 settings with room for overrides.
- **Simple API**: Narrow endpoints to keep the client small and maintainable.

## Future Work
- More parametric templates (threads, brackets, hinges, LEGO-style bricks).
- Profile editor in the UI; preview changes before slicing.
- Inline 3D viewer for STL (WebGL/Three.js).
- User accounts and saved jobs (see [frontend/lib/auth.ts](frontend/lib/auth.ts) for scaffolding).
- Upload custom templates and share profiles.

## Acknowledgements
- OpenSCAD for parametric geometry.
- CuraEngine for reliable slicing.
- FastAPI and Next.js for modern, fast development.

