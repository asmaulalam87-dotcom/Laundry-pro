# Recipe System - React

Modern industrial laundry recipe management system built with React, TypeScript, and Vite.

## Features

- Dashboard with analytics and charts
- Recipe management with AG Grid
- Chemical inventory tracking
- Costing calculator
- Process library
- Offline-first architecture with IndexedDB
- Cloud sync with Supabase
- Dark/Light theme support
- Export to Excel/PDF
- WhatsApp sharing

## Tech Stack

- React 18 + TypeScript
- Vite
- TailwindCSS
- Zustand (State Management)
- TanStack Query (Data Fetching)
- AG Grid (Data Tables)
- Recharts (Charts)
- Dexie (IndexedDB)
- Supabase (Cloud Backend)

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start development server:
```bash
npm run dev
```

3. Open http://localhost:5173 in your browser

### Build for Production

```bash
npm run build
```

## Project Structure

```
src/
├── components/     # Reusable UI components
├── pages/         # Page components
├── stores/        # Zustand state stores
├── services/      # API and database services
├── lib/           # Utilities and helpers
├── types/         # TypeScript type definitions
└── hooks/         # Custom React hooks
```

## Database

The app uses a dual-layer database architecture:
- **Local**: IndexedDB via Dexie for offline support
- **Cloud**: Supabase for synchronization and multi-user access

## License

MIT
