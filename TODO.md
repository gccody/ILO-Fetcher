# TODO: Convert to SvelteKit Static Site

## Overview

Transform the ilo-fetcher project into a SvelteKit static website that displays firmware information from data.json, with automated daily updates via GitHub Actions.

## Phase 1: SvelteKit Setup

- [ ] Initialize new SvelteKit project in current directory
- [ ] Configure static adapter for SSG output
- [ ] Set up Tailwind CSS for styling
- [ ] Verify empty static build works

## Phase 2: Frontend Development

- [ ] Create main page layout
- [ ] Build firmware display component
- [ ] Implement iLO version tabs (ILO1-ILO7)
- [ ] Add firmware file cards with metadata
- [ ] Style with responsive design
- [ ] Add search/filter functionality
- [ ] Implement sort by version/date

## Phase 3: GitHub Actions Integration

- [ ] Create workflow file for daily builds
- [ ] Configure workflow to run bun run index.ts
- [ ] Set up conditional commit if data.json changes
- [ ] Configure deployment to GitHub Pages

## Phase 4: Deployment

- [ ] Set up GitHub Pages deployment
- [ ] Test CI/CD pipeline
- [ ] Verify daily updates work correctly
