# CSU-Gonzaga Paragon

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- Campus readers who browse articles and special issues and learn about the editorial board.
- Publication staff who manage articles, special issues, the editorial board, and recruitment through a separate administration workspace.
- Prospective contributors who apply through the public recruitment workflow.

The reader and staff scope was confirmed by the user during initialization.

## Product Purpose

Provide CSU-Gonzaga Paragon's campus readership with access to its journalism and publications, and give publication staff a workspace for managing content and recruitment.

Success means readers can find and read the publication's work, applicants can submit recruitment applications, and staff can carry out the corresponding management workflows.

## Operating Context

The existing web application has public reading and recruitment pages and a guarded administration area. Public routes cover the home page, individual articles, top stories, special issues and their reader, the editorial board, and applications to join.

Staff routes cover a dashboard, article and special-issue management, recruitment applications, staff directory, public board preview, media library, profiles, settings, and activity logs. Route presence documents the current implementation; it does not establish that every feature is production-ready.

## Capabilities and Constraints

- Preserve the confirmed public-reader and publication-staff scope when making future interface decisions.
- The existing frontend is an Angular application at `frontend/ParagonWebApp`; the backend is a TypeScript/Express application at `backend`.
- The frontend development entry is `src/index.html`; run `npm start` from `frontend/ParagonWebApp` to use its configured Angular development server.
- Additional editorial requirements, accessibility standards, immutable brand commitments, audience priorities, and operational constraints remain undecided. The user has not supplied additional constraints.
- Unique positioning, quantified success targets, and production readiness have not been established.

## Evidence on Hand

- `frontend/ParagonWebApp/src/app/app.routes.ts`: public and guarded staff routes.
- `frontend/ParagonWebApp/src/app/features/home/components/welcome-banner/welcome-banner.html`: the existing name, CSU-Gonzaga Paragon, and tagline, "Liberating Voices · Amplifying the Truth."
- `frontend/ParagonWebApp/src/assets/PRG_Logo.png` and `frontend/ParagonWebApp/public/PRG_Logo.png`: existing logo assets.
- `frontend/ParagonWebApp/src/assets/pdfs/wanderlust.pdf`: an existing publication PDF asset.

Existing copy and assets are implementation evidence, not newly approved brand rules. Testimonials, audience metrics, awards, and other external proof have not been confirmed and must not be invented.

## Product Principles

- Make the publication's work easy for campus readers to find and read.
- Support the staff workflows needed to manage content, the editorial board, and recruitment.
- Keep public reading and staff administration understandable for their respective users.
- Preserve factual content and distinguish verified product facts from open decisions.
