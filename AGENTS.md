# Repository Guidelines

## Project Structure & Module Organization

This minimal Next.js 15 App Router application exposes a stateless Model Context Protocol (MCP) server. The main implementation is `app/mcp/route.ts`; keep tools, prompts, and resources there unless a feature warrants a separate module. `scripts/test-client.mjs` is the MCP smoke-test client. Static files belong in `public/`; root-level files configure the application and tooling.

## Build, Test, and Development Commands

Use pnpm 8 and Node.js 20 or later.

- `pnpm install` installs dependencies from `pnpm-lock.yaml`.
- `pnpm dev` starts the local Next.js server at `http://localhost:3000`.
- `pnpm build` creates a production build and catches Next.js integration errors.
- `pnpm start` serves the completed production build.
- `pnpm type-check` runs TypeScript in strict, no-emit mode.
- `pnpm lint` checks the repository with ESLint and Next.js Core Web Vitals rules.
- `pnpm test:client -- http://localhost:3000` connects to a running server, lists tools, and calls `echo`.

## Coding Style & Naming Conventions

Write strict TypeScript for application code and modern ESM JavaScript for scripts. Follow two-space indentation, double quotes, semicolons, and trailing commas in multiline structures. Use `camelCase` for variables and functions, `PascalCase` for types or components, and lowercase route directories. Give MCP tools concise verb-oriented names and bounded, `.strict()` Zod schemas. Include accurate annotations, especially for read-only or destructive behavior.

## Testing Guidelines

There is currently no unit-test framework or coverage threshold. Before submitting changes, run `pnpm lint`, `pnpm type-check`, and `pnpm build`. For protocol changes, start the app and run the client smoke test against it. If adding automated tests, place them beside the code as `*.test.ts` or under a focused `tests/` directory, and add the corresponding pnpm script.

## Commit & Pull Request Guidelines

History currently contains only `Initial commit`, so no mature convention exists. Use short, imperative commit subjects such as `Add resource listing tool`, and keep each commit focused. Pull requests should explain the behavior changed, list verification commands, link relevant issues, and include sample MCP requests/responses when contracts change. Add screenshots only for visible UI or static-asset changes.

## Security & Configuration

Do not commit `.env*`, credentials, private keys, or deployment secrets. Validate all externally supplied tool arguments with Zod, preserve conservative MCP annotations, and document any new environment variables in `README.md` without including real values.
