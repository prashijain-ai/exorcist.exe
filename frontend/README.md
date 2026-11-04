# Exorcist.exe dashboard

React + Vite front end for Exorcist.exe.

## Run on a Mac
Double-click `start.command` (if macOS blocks it: right-click, Open), or:
```bash
npm install
cp .env.example .env     # optional: paste your API URL
npm run dev
```
Requires Node 18+. With no `VITE_API_URL` it runs in pure demo mode using `src/seed.json`.

## Connect to the backend
Put the `ApiUrl` from `cdk deploy` into `.env` as `VITE_API_URL`. The toggle in the page switches between demo spirits and your real account.

## Build
`npm run build` outputs `dist/`, ready for S3 + CloudFront.
