# Keyword Project Manager

A comprehensive full-stack application for SEO keyword management, clustering, and analysis. Built with **Next.js 15 (React 19)** and **FastAPI**.

## 🚀 Quick Start

### Prerequisites
- **Node.js** v20+
- **Python** 3.10+
- **PostgreSQL** 14+ (Required for JSONB support)

### 1. Backend Setup
The backend runs on FastAPI and uses SQLAlchemy (Async).

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Create a .env file (see backend/README.md for details)
# Run migrations (if applicable) or start the server
uvicorn app.main:app --reload
```

### 2. Frontend Setup
The frontend is a Next.js application using NPM workspaces.

```bash
# From the repository root
npm install

# Start the frontend dev server
npm run dev
```

The frontend will be available at [http://localhost:3000](http://localhost:3000).

## 📚 Documentation

- **[AGENTS.md](./AGENTS.md)**: The **Developer Bible**. Contains all coding standards, best practices, and workflow guidelines. **Read this before contributing.**
- **[Frontend Docs](frontend/README.md)**: Specifics about the Next.js setup.
- **[Backend Docs](backend/README.md)**: API details, database schema, and CSV formats.
- **[Repository Review](REPO_REVIEW.md)**: Architectural deep dive and known risks.

## 🏗 Directory Structure

- `frontend/`: Next.js application (App Router, Redux, Tailwind).
- `backend/`: FastAPI application (SQLAlchemy, Pydantic).
- `docs/`: Additional project documentation.
