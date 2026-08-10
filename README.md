# ilo-fetcher

A browser automation tool that fetches HPE iLO (Integrated Lights-Out) firmware files from the official HPE support website. This project identifies missing firmware versions and downloads them automatically.

## What is iLO?

iLO (Integrated Lights-Out) is HP's remote server management technology that allows administrators to monitor and manage HP servers remotely, including tasks like firmware updates, hardware monitoring, and server control.

## Features

- **Automatic Firmware Detection**: Scans HPE support pages to find available firmware versions
- **Missing Version Tracking**: Only downloads firmware versions not already present in the local database
- **Shadow DOM Support**: Handles complex HPE web pages with nested shadow roots
- **Metadata Extraction**: Captures version info, release dates, checksums, and upgrade requirements
- **Multi-Version Support**: Supports iLO1 through iLO7 firmware versions

## Installation

```bash
bun install
```

## Configuration

The `data.json` file contains:

- Whitelisted file extensions for firmware downloads
- URLs for each iLO version's firmware page
- Track of already-downloaded firmware files

## Usage

```bash
bun run index.ts
```

The script will:

1. Launch a headless browser and navigate to each iLO firmware page
2. Extract all available firmware versions
3. Compare against locally stored versions in `data.json`
4. Download any missing firmware versions
5. Update `data.json` with new entries

Downloaded firmware files are saved to the `downloads/` directory.

## JSON API

Start the web app with `bun run dev`, then browse the API at
`http://localhost:5173/api`. All endpoints are read-only, require no
authentication, and include the file metadata, checksum, release metadata, HPE
source page, and direct download URL where applicable.

| Endpoint | Description |
| --- | --- |
| `GET /api` | API metadata and endpoint discovery |
| `GET /api/ilos` | Every iLO generation with release counts and latest releases |
| `GET /api/ilos/latest` | The latest release for every iLO generation |
| `GET /api/ilos/{version}` | Latest and all previous releases for one generation |
| `GET /api/ilos/{version}/releases` | Complete release history for one generation |
| `GET /api/ilos/{version}/latest` | Latest release for one generation |
| `GET /api/ilos/{version}/releases/{releaseVersion}` | One exact release |

Version parameters are case-insensitive and accept `ILO5`, `ilo5`, or `5`.

For example:

```bash
curl http://localhost:5173/api/ilos/ILO5/latest
curl http://localhost:5173/api/ilos/ILO4/releases/2.82
```

## Technical Details

- **Runtime**: [Bun](https://bun.com) v1.3.9+
- **Browser Automation**: Puppeteer
- **Language**: TypeScript
