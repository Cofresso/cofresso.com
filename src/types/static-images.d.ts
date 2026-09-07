// Static image imports (e.g. `import logo from "../public/logo.png"`) need Next.js's module
// declarations. `next-env.d.ts` provides them locally but is generated and git-ignored, so CI's
// `pnpm typecheck` (which runs before `next build`) needs this committed reference instead.
/// <reference types="next/image-types/global" />
