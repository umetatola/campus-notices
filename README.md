# Campus Notices

English digests of Ajou University notices, with keyword alerts.

University announcements (course withdrawal deadlines, scholarships, dorm and job-fair notices) are spread across
the school website and written in Korean. Campus Notices collects them automatically, gives each one an English
title and summary, and emails you when a notice matches the keywords you follow.

> Status: week 1 of 4. The crawler and the notice API work; summaries, the web app and alerts are next.

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

## Running locally

Requirements: Java 21, Docker.

```bash
docker compose up -d            # PostgreSQL on localhost:5432
cd backend && ./gradlew bootRun # API on http://localhost:8080, first crawl after 10 s
```

Set `CRAWLER_ENABLED=false` to run the API without crawling.

## Tests

```bash
cd backend && ./gradlew test
```

- Parser tests run against pages saved from the real site (text, image-only and attachment-only notices).
- The integration test crawls those pages into a real PostgreSQL started by Testcontainers, runs the crawl twice
  to check it stops at known notices, and queries the HTTP API. It is skipped when Docker is not running.
