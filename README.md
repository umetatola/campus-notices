# Campus Notices

English digests of Ajou University notices, with keyword alerts.

University announcements (course withdrawal deadlines, scholarships, dorm and job-fair notices) are spread across
the school website and written in Korean. Campus Notices collects them automatically, gives each one an English
title and summary, and emails you when a notice matches the keywords you follow.

> Status: week 2 of 4. The crawler, the notice API and the web app work; English summaries and alerts are next.

## Architecture

```
React (Vite + TypeScript)  ──REST──►  Spring Boot 4 (Java 21)
                                       ├─ crawler     scheduled, polite (Jsoup)
                                       ├─ summarizer  job queue → LLM            (week 2)
                                       ├─ alerts      keyword matching → email   (week 3)
                                       └─ api         notices, search, users
                                                │
                                          PostgreSQL (Flyway migrations)
```

### Crawler

- Reads the main notice board every 15 minutes, newest first, and stops at the first page with no new
  regular notices, so a normal run costs one list request plus one request per new notice.
- Waits at least 1 second between requests and identifies itself with its own User-Agent. Pages that the site's
  robots.txt disallows are not crawled.
- Each notice is stored once (unique on source + article number) with a SHA-256 content hash, so later edits
  can be detected. Every notice is written in its own transaction: one broken page can't roll back a whole run.
- Image-only and attachment-only notices (common on this board) are kept with absolute image and file links.

## API

| Method | Path | Description |
|---|---|---|
| GET | `/api/notices?q=&category=&page=&size=` | Notices, newest first; `q` searches titles |
| GET | `/api/notices/{id}` | One notice with body and attachments |
| GET | `/api/notices/categories` | Categories in use |
| GET | `/actuator/health` | Health check |

## Web app

React 19 + TypeScript (Vite), TanStack Query and React Router, styled with Tailwind.

- Notice list with title search (debounced), category filters with English names, and paging. Search, category and
  page live in the URL, so any view can be bookmarked or shared.
- Notice page with attachments, a link to the original, and the notice body. Bodies are HTML from the university
  site: sanitized on the server (jsoup) and again in the browser (DOMPurify) before rendering.
- Loading, empty and error states; light and dark themes; Korean text wraps between words.

## Running locally

Requirements: Java 21, Node 20+, Docker.

```bash
docker compose up -d              # PostgreSQL on localhost:5432
cd backend && ./gradlew bootRun   # API on http://localhost:8080, first crawl after 10 s
cd frontend && npm install && npm run dev   # web app on http://localhost:5173 (proxies /api to :8080)
```

Set `CRAWLER_ENABLED=false` to run the API without crawling.

## Tests

```bash
cd backend && ./gradlew test
```

- Parser tests run against pages saved from the real site (text, image-only and attachment-only notices).
- The integration test crawls those pages into a real PostgreSQL started by Testcontainers, runs the crawl twice
  to check it stops at known notices, and queries the HTTP API. It is skipped when Docker is not running.
