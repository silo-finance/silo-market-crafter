# Silo Market Crafter

UI for market creation for Silo - A modern web3 application built with Next.js, React, and Tailwind CSS.

## Quick Start

### Prerequisites
- Node.js 20 (use `nvm use` when `.nvmrc` is present, or `nvm use 20`)
- npm or yarn

### Installation

1. Install dependencies:
```bash
nvm use 20
npm install
```

If you get `ENOTEMPTY` or engine warnings, use Node 20 and do a clean install:
```bash
nvm use 20
rm -rf node_modules
npm install
```
Use `npm install --legacy-peer-deps` if you hit peer dependency conflicts.

2. Run the development server:
```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript type checking

### Tech Stack

- **Framework**: Next.js 14 with App Router
- **UI**: React 18 with TypeScript
- **Styling**: Tailwind CSS
- **Web3**: ethers.js, wagmi, RainbowKit
- **State Management**: TanStack Query
- **Linting**: ESLint with Next.js config

### Development

The application is set up with:
- TypeScript for type safety
- ESLint for code quality
- Tailwind CSS for styling
- Modern web3 libraries for blockchain integration
- CI/CD pipeline with GitHub Actions

