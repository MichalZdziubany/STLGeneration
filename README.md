# 3D Model Platform — Parametric STL Generation & Slicing

This is my final year project: a web app that lets you design simple parametric 3D models, generate STLs on demand, and slice them to G-code — all in the browser. It’s built to be practical: pick a template, tweak a few numbers, get a printable file. No heavy CAD, no long setup.

## Why I built this
- I wanted a faster path from idea → printable part.
- Many common shapes (cubes, cylinders, pyramids) are better as quick parametric templates.
- Automating STL generation with OpenSCAD and slicing with CuraEngine makes this repeatable and reliable.

## What it does
- Parametric model templates rendered via OpenSCAD.
- Includes advanced multi-part templates like a matched threaded nut + bolt pair.
- Server-side STL generation with practical defaults.
- One-click slicing to G-code using profiles (e.g., balanced Ender 3 settings).
- Minimal, clean UI built with Next.js.
- FastAPI backend with simple JSON endpoints.
- Dockerized services to keep dependencies isolated.

## Architecture
- **Frontend (Next.js)**: User interface in [frontend](frontend).
- **Backend (FastAPI)**: API endpoints in [backend/app](backend/app) with routes for templates, STL generation, and slicing.
- **OpenSCAD + CuraEngine CLIs**: Installed in the backend container image and invoked by backend services.
- **Shared jobs folder**: Generated files live in [backend/jobs](backend/jobs) and are mounted into services.
- **Settings & definitions**: Slicing profiles and printer definitions in [backend/app/settings](backend/app/settings).

High-level flow:
1. User selects a template from `/templates`.
2. Frontend posts template parameters to `/generate-stl` to produce an STL.
3. Frontend (or user) posts to `/slice` (or `/slice-stl`) with a profile/overrides to get G-code.

## API Overview
- `GET /` — health check.
- `GET /templates` — list available templates with metadata.
- `POST /templates/upload` — upload a user template (`.scad.j2`).
- `GET /templates/{template_id}` — fetch template content + metadata.
- `POST /generate-stl` — body: `{ template_id, params }` → returns binary STL.
- `POST /slice` — body: `{ template_id, params, slice_settings?, profile? }` → returns G-code.
- `POST /slice-stl` — body: `{ stl_filename, slice_settings?, profile? }` → returns G-code for an existing STL.
- `POST /generate-stl` with `{ multi_part: true, parts: [...] }` — returns ZIP of multiple STLs rendered from one template.
- `POST /slice` with `{ multi_part: true, parts: [...] }` — returns ZIP of multiple G-code files sliced from one template.
- `GET /runs` — list recent generation/slicing runs.
- `GET /runs/{run_id}` — fetch a single run record.
- `GET /profiles` — list available slicing profiles.
- `GET /profiles/{name}` — get full settings for a profile.
- `GET /printers` — list Cura printer definitions and build volumes discovered from Cura resources.

## Quick Start (Docker)
Prerequisites: Docker + Docker Compose.

```bash
docker compose up --build
```

- Frontend: http://localhost:3000
- Backend: http://localhost:8000

The services share the [backend/jobs](backend/jobs) folder for generated files.
User-uploaded template files are persisted in a Docker named volume (`backend_user_templates`) mounted to `/app/app/user_templates`, so they remain available across container rebuilds/recreates.

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

Set API URLs via environment variables:
- `NEXT_PUBLIC_API_URL`: server-to-server (e.g., `http://localhost:8000` when running locally, or `http://backend:8000` in Docker)
- `NEXT_PUBLIC_API_URL_BROWSER`: client-side calls (usually `http://localhost:8000`)

The frontend also requires Firebase env vars (used for auth, Firestore, and storage). Add these to `frontend/.env.local`:
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

Optional:
- `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID`

If any required Firebase vars are missing, the frontend throws an explicit startup error listing which keys are missing.

Note: If not using Docker, you’ll need OpenSCAD and CuraEngine installed locally (or adapt paths). The Docker route is simpler because it packages those CLIs for you.

Printer discovery for profile settings (`GET /printers`) now checks:
- Bundled Cura resources from `CURA_RESOURCES` (defaults to `/opt/cura-resources`).
- User/downstream definitions from `CURA_USER_RESOURCES` (path list of resource roots; each root should contain `definitions/`).
- Explicit definition folders from `CURA_DEFINITIONS_DIRS` (path list of directories containing `.def.json` files).

Use `CURA_USER_RESOURCES` or `CURA_DEFINITIONS_DIRS` when you want downloaded/custom Cura printer definitions to appear in the frontend printer selector and auto-fill build volume dimensions.

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

Generate two STL files (bolt + nut) from one template file:

```bash
curl -X POST http://localhost:8000/generate-stl \
	-H "Content-Type: application/json" \
	-d '{
		"template_id": "threaded_nut_bolt",
		"params": {
			"BOLT_LENGTH": 40,
			"THREAD_MAJOR_DIAMETER": 8,
			"THREAD_PITCH": 1.25,
			"THREAD_DEPTH": 0.55,
			"HEAD_HEIGHT": 6,
			"HEAD_FLAT_DIAMETER": 13,
			"SEGMENTS": 72
		},
		"multi_part": true,
		"parts": ["bolt", "nut"],
		"part_selector_param": "PART_MODE"
	}' --output threaded_parts_stl.zip
```

Slice two G-code files (bolt + nut) from one template file:

```bash
curl -X POST http://localhost:8000/slice \
	-H "Content-Type: application/json" \
	-d '{
		"template_id": "threaded_nut_bolt",
		"params": {
			"BOLT_LENGTH": 40,
			"THREAD_MAJOR_DIAMETER": 8,
			"THREAD_PITCH": 1.25,
			"THREAD_DEPTH": 0.55,
			"HEAD_HEIGHT": 6,
			"HEAD_FLAT_DIAMETER": 13,
			"SEGMENTS": 72
		},
		"profile": "balanced_profile",
		"multi_part": true,
		"parts": ["bolt", "nut"],
		"part_selector_param": "PART_MODE"
	}' --output threaded_parts_gcode.zip
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
	- [docker-compose.yml](docker-compose.yml): Orchestrates backend and frontend services.
- **Backend**
	- [backend/app/main.py](backend/app/main.py): FastAPI app setup + CORS.
	- [backend/app/routes](backend/app/routes): `generate.py`, `slice.py`, `templates.py`.
	- [backend/app/services](backend/app/services): STL generation, slicing, template catalog.
	- [backend/app/settings](backend/app/settings): Profiles and printer definition files.
	- [backend/app/templates](backend/app/templates): Jinja2 SCAD templates.
	- [backend/jobs](backend/jobs): Output files (SCAD/STL/G-code).
- **Frontend**
	- [frontend/src/app](frontend/src/app): Next.js app directory with pages.
	- [frontend/src/contexts/AuthContext.tsx](frontend/src/contexts/AuthContext.tsx): Firebase auth state and session context.
	- [frontend/src/lib/auth.ts](frontend/src/lib/auth.ts): Auth helpers for sign-in, sign-up, and password reset.
- **Container build files**
	- [backend/Dockerfile](backend/Dockerfile)
	- [frontend/Dockerfile](frontend/Dockerfile)

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
- Better account-level features (template sharing controls, richer run management, and profile sync UX).
- Upload custom templates and share profiles.

## Acknowledgements
- OpenSCAD for parametric geometry.
- CuraEngine for reliable slicing.
- FastAPI and Next.js for modern, fast development.

