# Contributing

This guide covers the developer setup, code formatting and tests. For running the app itself, see [README.md](README.md).

## Repository layout

| Folder       | Language             | Formatter                                   | Config                      |
| ------------ | -------------------- | ------------------------------------------- | --------------------------- |
| `backend/`   | Java (Spring Boot)   | Spotless with `palantir-java-format`        | `backend/pom.xml`           |
| `frontend/`  | TypeScript (Next.js) | Prettier with `prettier-plugin-tailwindcss` | `frontend/.prettierrc.json` |
| `generator/` | Python               | Ruff                                        | `generator/pyproject.toml`  |

The repository root holds the shared tooling: `package.json` with the format scripts, husky and lint-staged.

## One-time setup

Requirements: Java 21, Node.js 20+, Python 3.10+.

Install the tooling of every part. From the repository root:

```bash
npm install
```

```bash
npm --prefix frontend install
```

```bash
cd generator && python3 -m venv venv && venv/bin/pip install -r requirements-dev.txt
```

The backend needs no install step: `backend/mvnw` downloads Maven on first use.

The root `npm install` also enables the pre-commit hook (see below). Run it once after cloning.

## Code formatting

Formatting is automatic. You normally don't need to run anything by hand.

### Pre-commit hook

Every `git commit` runs [lint-staged](https://github.com/lint-staged/lint-staged) through [husky](https://typicode.github.io/husky/). It:

1. takes only the files you staged for the commit;
2. formats them with the tool for their part: Spotless for `backend/**/*.java`, Prettier for `frontend/**`, Ruff for `generator/**/*.py`;
3. adds the formatted result to the same commit.

Changes you did not stage stay untouched, so `git add -p` is safe. If a formatter fails (for example on a syntax error), nothing is committed and the error is printed.

The hook needs `frontend/node_modules` and `generator/venv`. If a commit fails with "command not found", repeat the one-time setup.

The hook can be skipped with `git commit --no-verify`. Don't do this for regular work: CI checks the formatting anyway.

### Manual commands

From the repository root:

| Command                  | What it does                                             |
| ------------------------ | -------------------------------------------------------- |
| `npm run format`         | Format the whole repository                              |
| `npm run check`          | Check formatting without changing files (CI)             |
| `npm run format:backend` | Format only the backend (also `:frontend`, `:generator`) |
| `npm run check:backend`  | Check only the backend (also `:frontend`, `:generator`)  |

## API contract

The HTTP API between the frontend and the backend is described in `openapi/openapi.yaml`. The contract comes first: change the spec, then the code.

- **Backend**: every Maven build generates the controller interfaces (`icepunk_backend.api`) and the DTOs (`icepunk_backend.dto`) into `backend/target/generated-sources/openapi`. They are not committed. The controllers implement the generated interfaces, so a mismatch with the spec is a compile error.
- **Frontend**: `frontend/lib/api-schema.d.ts` is generated from the spec before every `npm run dev` and `npm run build`. It is not committed. To refresh the types while the dev server is running, or right after cloning so the editor resolves them, run `npm run generate:api` from the repository root.

To browse the contract, run the backend with `./mvnw spring-boot:run` and open `http://localhost:8081/swagger-ui.html`.

`npm run check:openapi` lints the spec. The pre-commit hook runs it when the spec is staged.

### Editor setup

Format-on-save keeps the hook from ever having to change anything:

- **IntelliJ IDEA**: install the _palantir-java-format_ plugin for Java, enable Prettier under _Settings → Languages & Frameworks → JavaScript → Prettier_, and turn on _Settings → Tools → Actions on Save → Reformat code_.
- **VS Code**: install the _Prettier_ and _Ruff_ extensions and enable `editor.formatOnSave`.

### Rules

- Don't change formatter settings or versions in a feature change. Do it in a separate commit, together with reformatting the affected code.
- Keep reformatting and logic changes in separate commits, so the history shows real changes clearly.

## Line endings

All text files use LF line endings, enforced by `.gitattributes`. Windows scripts (`*.cmd`, `*.bat`) use CRLF. You don't need to configure anything: Git converts line endings on checkout and commit.

## Tests

| Part        | Command (from the part's folder) | Notes                                                                            |
| ----------- | -------------------------------- | -------------------------------------------------------------------------------- |
| `generator` | `venv/bin/pytest`                | Fails below 100% line and branch coverage                                        |
| `backend`   | `./mvnw test`                    | `BackendApplicationTests` needs the local PostgreSQL from `docker compose up -d` |
| `frontend`  | `npm run lint`                   | ESLint; there are no unit tests yet                                              |

To see which generator lines are covered, build an HTML report and open it:

```bash
venv/bin/pytest --cov-report=html && open htmlcov/index.html
```

New Python code needs tests that keep coverage at 100%.

## Linting Python

Ruff also works as a linter. The hook only sorts imports; run the full lint from `generator/`:

```bash
venv/bin/ruff check --fix .
```
