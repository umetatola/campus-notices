# Campus Notices

[![CI](https://github.com/umetatola/campus-notices/actions/workflows/ci.yml/badge.svg)](https://github.com/umetatola/campus-notices/actions/workflows/ci.yml)

English digests of Ajou University notices, with keyword alerts.

University announcements (course withdrawal deadlines, scholarships, dorm and job-fair notices) are spread across
the school website and written in Korean. Campus Notices collects them automatically, gives each one an English
title and summary, and emails you when a notice matches the keywords you follow.

> Status: week 4 of 4. Everything works locally and in CI; the production setup is ready and waiting for a server.

## Architecture

```
React (Vite + TypeScript)  ──REST──►  Spring Boot 4 (Java 21)
                                       ├─ crawler     scheduled, polite (Jsoup)
                                       ├─ summarizer  PostgreSQL job queue → Claude
                                       ├─ alerts      keyword matching → email digest
                                       └─ api         notices, search, sign-in, keywords (Spring Security)
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

### English summaries

Each notice gets an English title, a two-to-four sentence summary, and the action deadline if there is one,
written by Claude from the Korean original (structured output, so the reply always has the same fields).

- **Queue in PostgreSQL.** New or edited notices are queued in `notice_summaries`. Workers claim small batches with
  `FOR UPDATE SKIP LOCKED`, so two workers never take the same notice, and no transaction stays open while the
  model runs: a claimed row gets a 5-minute lock instead, and a crashed worker's rows become claimable again.
- **Each version summarized once.** A result is only stored if the notice's content hash still matches; a notice
  edited mid-summary is re-queued for its new version and the stale result is dropped.
- **Failures.** Rate limits, timeouts and server errors are retried with exponential backoff (1 minute doubling
  to 1 hour, 5 attempts); refusals and bad requests are marked failed at once.
- **Providers.** `SUMMARIZER_PROVIDER=auto` (default) uses Claude when `ANTHROPIC_API_KEY` is set; without a key
  notices simply stay queued and are summarized once a key is added. `stub` writes clearly fake summaries for UI
  work, and a real summarizer re-queues them on startup.

### Sign-in and alerts

- **Passwordless sign-in.** Students enter their email and get a one-time link (15 minutes). Only the token's SHA-256
  hash is stored; one `UPDATE … RETURNING` marks it used, so it can't be used twice. The endpoint answers the same
  way for every address and allows 3 links per address per 15 minutes. Sign-in creates a new session id (no
  session fixation); the session cookie is HttpOnly and SameSite=Lax, and every write needs the CSRF token
  (Spring Security's SPA setup: `XSRF-TOKEN` cookie → `X-XSRF-TOKEN` header).
- **Keywords.** Up to 20 per user, case-insensitive and unique per user.
- **Matching.** Each new notice is checked once, after its English summary is ready (or after 30 minutes), against
  the Korean title and body and the English title and summary. A keyword only matches notices first seen after it
  was followed, so nobody is flooded with old news.
- **Delivery.** Matches go to an outbox table whose primary key (user, notice) rules out duplicates. One email per
  user lists all new matches. Each user's rows are locked while their email is sent; failed sends are retried up to
  5 times. Delivery is at-least-once.

## API

| Method | Path | Description |
|---|---|---|
| GET | `/api/notices?q=&category=&page=&size=` | Notices, newest first, with English title and deadline; `q` searches Korean and English text |
| GET | `/api/notices/{id}` | One notice with body, attachments and its English summary |
| GET | `/api/notices/categories` | Categories in use |
| POST | `/api/auth/request-link` | Email a sign-in link (always 202) |
| POST | `/api/auth/verify` | Exchange a link token for a session |
| POST | `/api/auth/logout` | Sign out |
| GET | `/api/me` | The signed-in user (401 when signed out) |
| GET/POST | `/api/subscriptions` | List or follow keywords (signed in) |
| DELETE | `/api/subscriptions/{id}` | Stop following a keyword |
| GET | `/actuator/health` | Health check |

## Web app

React 19 + TypeScript (Vite), TanStack Query and React Router, styled with Tailwind.

- Notice list with English titles (Korean original underneath), "Due" badges for upcoming deadlines, search
  (debounced), category filters with English names, and paging. Search, category and page live in the URL, so
  any view can be bookmarked or shared.
- Notice page with the English summary and deadline, attachments, a link to the original, and the notice body. Bodies are HTML from the university
  site: sanitized on the server (jsoup) and again in the browser (DOMPurify) before rendering.
- Loading, empty and error states; light and dark themes; Korean text wraps between words.

## Running locally

Requirements: Java 21, Node 20+, Docker.

```bash
docker compose up -d              # PostgreSQL on :5432, Mailpit (dev inbox) on http://localhost:8025
cd backend && ./gradlew bootRun   # API on http://localhost:8080, first crawl after 10 s
cd frontend && npm install && npm run dev   # web app on http://localhost:5173 (proxies /api to :8080)
```

Set `CRAWLER_ENABLED=false` to run the API without crawling. For summaries, copy `.env.example` to `.env` and add
an Anthropic API key (`SUMMARIZER_PROVIDER=stub` shows fake summaries without one).

## Tests

```bash
cd backend && ./gradlew test
```

- Parser tests run against pages saved from the real site (text, image-only and attachment-only notices).
- Integration tests use a real PostgreSQL started by Testcontainers: crawling (twice, to check it stops at known
  notices) and the HTTP API; the summary queue's edge cases (retries, giving up, edits mid-summary, expired
  locks); and sign-in, keywords and alert emails end to end. They are skipped when Docker is not running.

CI (GitHub Actions) runs the backend tests, the frontend lint and build, and the Docker build on every push and
pull request.

## Deployment

The whole site is one Docker image: the React app is built first and served by Spring Boot (which also answers
app URLs such as `/notices/12` with the app, and keeps 404s for missing files). The runtime image is an Alpine JRE
running as a non-root user, with a health check.

Every push to `main` publishes the image to GitHub's container registry. A server runs
[`deploy/docker-compose.yml`](deploy/docker-compose.yml): the app, PostgreSQL, and Caddy, which gets and renews the
HTTPS certificate. Memory limits fit a 1 GB machine. To deploy:

```bash
cd deploy
cp .env.example .env     # domain, database password, SMTP account, optional Anthropic key
docker compose up -d     # later updates: docker compose pull && docker compose up -d
```
