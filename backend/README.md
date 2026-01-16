# SEO Project Manager - FastAPI with MySQL

A SEO keyword management application built with FastAPI and MySQL.

## Features

- Project management
- CSV upload and processing
- Keyword grouping and analysis
- API authentication with JWT
- NLP-based keyword processing

## Project Structure

```
seo-project-manager/
├── app/
│   ├── main.py               # FastAPI application entry point
│   ├── config.py             # Configuration settings
│   ├── database.py           # Database connection
│   ├── models/               # SQLAlchemy models
│   │   ├── base.py           # Base model class
│   │   ├── project.py        # Project model
│   │   └── keyword.py        # Keyword model
│   ├── routes/               # API routes
│   │   ├── auth.py           # Authentication routes
│   │   ├── projects.py       # Project routes
│   │   └── keywords.py       # Keyword routes
│   ├── schemas/              # Pydantic schemas
│   │   ├── auth.py           # Authentication schemas
│   │   ├── project.py        # Project schemas
│   │   └── keyword.py        # Keyword schemas
│   ├── services/             # Business logic
│   │   ├── project.py        # Project service
│   │   └── keyword.py        # Keyword processing service
│   └── utils/                # Utility functions
│       ├── security.py       # JWT and auth utilities
│       └── token_normalization.py # Tokenization/normalization utilities
├── uploads/                  # Directory for uploaded files
├── requirements.txt          # Project dependencies
├── .env                      # Environment variables
└── README.md                 # Project documentation
```

## Setup and Installation

1. Clone the repository
2. Create a virtual environment
   ```
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```
3. Install dependencies
   ```
   pip install -r requirements.txt
   ```
4. Configure MySQL
   - Make sure MySQL is running
   - Create a database named `seo_project_manager`:
     ```sql
     CREATE DATABASE seo_project_manager;
     ```
   - Update the connection settings in `.env` if needed

5. Run the application
   ```
   uvicorn app.main:app --reload
   ```

## Linting

Run the backend linters from the repository root:

```
ruff check backend/app backend/alembic
black --check backend/app backend/alembic
```

## Backfill: Compound Normalization Tokens

When the compound normalization/tokenization pipeline changes, re-run the backfill to regenerate
`keywords.tokens`, apply existing merge mappings, and regroup affected keywords:

```
cd backend
python -m app.scripts.backfill_compounds --project-id <project_id>
```

Tips:
- Add `--dry-run` to preview changes without writing updates.
- Use `--batch-size 1000` (or larger) for bigger projects.

## API Endpoints

The application provides the following API endpoints:

### Authentication
- POST `/api/auth/token` - Get JWT token (form)
- POST `/api/auth/login` - Get JWT token (JSON)

### Projects
- POST `/api/projects` - Create a new project
- GET `/api/projects` - Get all projects
- GET `/api/projects/{project_id}` - Get a project by ID
- PUT `/api/projects/{project_id}` - Update a project
- DELETE `/api/projects/{project_id}` - Delete a project

### Keywords
- POST `/api/projects/{project_id}/upload` - Upload and process CSV file
- GET `/api/projects/{project_id}/processing-status` - Get CSV processing status
- GET `/api/projects/{project_id}/keywords` - Get keywords with pagination
- POST `/api/projects/{project_id}/group` - Group selected keywords

## API Documentation

Once the application is running, you can access the API documentation at:
- Swagger UI: `http://localhost:5000/docs`
- ReDoc: `http://localhost:5000/redoc`

## Authentication

All API endpoints (except authentication) require a valid JWT token. To authenticate:

1. Call the login endpoint with username/password
2. Add the returned token to the `Authorization` header as `Bearer {token}`

## CSV Upload Format

The CSV file should contain the following columns:
- `Keyword` (required)
- `Country`
- `Difficulty`
- `Volume`
- `CPC`
- `CPS`
- `Parent Keyword`
- `Last Update`
- `SERP Features`
- `Global volume`
- `Traffic potential`
- `Global traffic potential`
- `First seen`
- `Intents`

## License

This project is licensed under the MIT License.
