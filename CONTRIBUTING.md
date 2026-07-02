# Contributing to MusicWeb

Thanks for your interest in improving MusicWeb! 🎵

## 🐛 Reporting Bugs

Found a bug? Please open an issue with:
- Steps to reproduce
- Expected vs actual behavior
- Screenshots (if applicable)
- Environment (OS, Node version, browser)

## 💡 Suggesting Features

Have an idea? Open an issue with the `enhancement` label and describe:
- The problem you're trying to solve
- Your proposed solution
- Any alternatives you considered

## 🔧 Pull Requests

1. **Fork & branch** — `git checkout -b feature/your-feature`
2. **Code style** — Run `pnpm lint` and `pnpm ts-check` before committing
3. **Commit messages** — Use [Conventional Commits](https://www.conventionalcommits.org/):
   ```
   feat: add playlist drag-and-drop
   fix: resolve memory leak in audio visualizer
   docs: update deployment guide
   style: format with prettier
   refactor: extract usePlayback hook
   test: add rhythm game scoring tests
   chore: bump dependencies
   ```
4. **Test your changes** — make sure `pnpm dev` still works
5. **Update docs** — if you change APIs, update `ARCHITECTURE.md`

## 🏗️ Architecture Decisions

For major changes, please open an issue first to discuss the approach. See `ARCHITECTURE.md` for the current system design.

## 📜 License

By contributing, you agree that your contributions will be licensed under the MIT License.
