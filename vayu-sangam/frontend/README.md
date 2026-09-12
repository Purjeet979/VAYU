# VayuSangam Frontend

## Getting Started

Copy `.env.example` to `.env.local` and set the backend API URL when it is not running on `http://127.0.0.1:8000`:

```bash
BACKEND_API_BASE_URL=http://127.0.0.1:8000
```

Then run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open `http://localhost:3000` with your browser to see the result.

Production build:

```bash
npm run build
npm run start
```

The app uses bundled local fonts, so production builds do not require Google Fonts network access.

## Backend

Start the FastAPI backend from the repository root:

```bash
uvicorn backend.app.main:app --reload --host 0.0.0.0 --port 8000
```

The browser calls same-origin `/api/...` routes. Next.js rewrites those requests to `BACKEND_API_BASE_URL`, which avoids frontend hardcoded localhost URLs and CORS surprises.
