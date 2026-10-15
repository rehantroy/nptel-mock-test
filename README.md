# Industrial IoT Mock Test Platform

A responsive, local-first web application designed for comprehensive exam preparation for the **Industrial Internet of Things (IIoT)** academic course across all 13 weeks (**Week 0 through Week 12**).

Built strictly in accordance with academic integrity guidelines: **zero fabricated or synthetic questions**. The question bank starts strictly empty and is populated through official assignment documents, verified answer keys, or manual entry.

---

## 🚀 Key Features

### 1. Five Specialized Test Modes
- **Mode 1: Week-wise Test**: Select any single week (Week 0 to Week 12). Contains only verified original assignment questions.
- **Mode 2: Custom Test**: Select any combination of weeks (Week 0 to 12) and filter by **Assignment Questions only**, **Other Questions only**, or **Both**.
- **Mode 3: All Week Test**: Exam covering all eligible original assignment questions across all 13 weeks (Week 0–12).
- **Mode 4: Other Questions — All Weeks**: Practices additional problem sets across all weeks. Missing weeks are automatically skipped without generating placeholder questions.
- **Mode 5: All Questions Test**: Complete master revision combining all verified assignment and additional questions across all 13 weeks with zero duplicates.

### 2. Randomization & Stable Answer Preservation
- **Fisher–Yates Algorithm**: Shuffles questions independently for each attempt.
- **Independent Option Shuffling**: Options are shuffled per question on each attempt.
- **Stable ID Architecture**: Questions and options use persistent UUIDs. Correct answers map to option IDs rather than display positions or letter indices (`A`, `B`, `C`, `D`), ensuring 100% grading fidelity even after repeated shuffles.
- **In-Progress Persistence**: Ongoing tests automatically save to `IndexedDB` and `localStorage`, preventing loss of progress on accidental page refreshes.

### 3. Document Import & Verification Pipeline
- **Multi-Format Extraction**: Supports text-based **PDF**, Word **DOCX**, structured **CSV**, and **JSON** bank exports.
- **Scanned PDF Detection & OCR**: Automatically detects image-based PDFs and provides client-side OCR via **Tesseract.js** with uncertain character flags.
- **Separate Answer Key Matcher**: Accepts official answer keys (e.g., `1. A, 2. B` or `Q1: C`) and matches them against extracted questions, flagging discrepancies or missing keys.
- **Scientific Notation & Math**: Renders KaTeX LaTeX math (`$...$`), subscripts (`CO₂`, `H₂O`), superscripts (`x²`), Greek symbols (`μ`, `λ`, `Ω`), and structured paragraphs.
- **Duplicate Detection**: Computes token overlap (Jaccard similarity) to flag potential duplicate questions before entering the bank.
- **Manual Question Entry**: Fast, fully typed question authoring form with live preview.

### 4. Results & Answer Review
- Real-time scoring breakdown: Score, Percentage, Correct, Incorrect, Unanswered, Time Taken.
- Division-by-zero safeguards for empty test states.
- Question-by-question review with official keys, user choices, source references (filename & page number), and official explanations (only if present in source).
- Instant retake with newly randomized question and option orders.

### 5. Local-First Data Safety & Backups
- **100% Client-Side**: All data is stored in the browser's IndexedDB. No questions or documents are sent to external servers.
- **JSON Backup & Restore**: One-click full database export and restore functionality to safeguard against browser cache clearing.

---

## 🛠️ Technology Stack

- **Frontend**: React 19, TypeScript, Vite
- **Styling**: Tailwind CSS v4, Lucide Icons
- **Math Rendering**: KaTeX
- **Persistence**: IndexedDB (`idb`) with localStorage active-attempt sync
- **Validation**: Zod schema validation
- **Document Processing**: `pdfjs-dist` (PDF), `mammoth` (DOCX), `tesseract.js` (OCR)
- **Testing**: Vitest, `@testing-library/react`, `jsdom`

---

## 📦 Getting Started

### Prerequisites
- Node.js (v18 or higher recommended; developed and tested on v24.14.0)
- npm (v9+; tested on v11.9.0)

### Installation
```bash
# Clone or navigate to the workspace directory
cd "d:/Hp/Desktop/NPTEL Test"

# Install dependencies (already installed in workspace)
npm install
```

### Running Locally
```bash
npm run dev
```
Open [http://localhost:5173/](http://localhost:5173/) in your web browser.

### Running Automated Tests
```bash
# Run all Vitest suites
npm test

# Run tests in watch mode
npm run test:watch
```

### Building for Production
```bash
npm run build
```

---

## 🧪 Automated Test Suite

The test suite covers 26 automated tests across 5 critical subsystems:
1. `src/test/scoringAndResults.test.ts`: Scoring invariants, percentage rounding, zero-division protection.
2. `src/test/weekFilteringAndModes.test.ts`: Verification of all 5 test modes, Week 0 and Week 12 filtering, custom mode combinations, and skipping of missing weeks.
3. `src/test/randomizationAndAnswerMapping.test.ts`: Fisher–Yates shuffling, option shuffle stability, grading invariance over 50 repeated shuffles, and attempt deduplication.
4. `src/test/importValidationAndDuplicates.test.ts`: CSV/JSON parsing, malformed file resilience, schema constraint checks, and duplicate detection.
5. `src/test/answerKeyAndVerification.test.ts`: Key matching formats, conflict detection, and strict exclusion of unverified questions from scored tests.

---

## 📁 Project Structure

```
├── src/
│   ├── components/
│   │   ├── FormattedContent.tsx  # Scientific, KaTeX, and subscript renderer
│   │   ├── Layout.tsx            # Main layout wrapper
│   │   └── Navbar.tsx            # Sticky header with real-time verified counter
│   ├── lib/
│   │   ├── importer/
│   │   │   ├── answerKeyMatcher.ts  # Answer key parser and matcher
│   │   │   ├── csvJsonParser.ts     # CSV & JSON structured parser + templates
│   │   │   ├── docxParser.ts        # Word DOCX extractor (mammoth)
│   │   │   ├── pdfParser.ts         # PDF text layer & Tesseract OCR fallback
│   │   │   └── questionExtractor.ts # Question & option text heuristics
│   │   ├── storage.ts            # IndexedDB manager, active attempt persistence, backup
│   │   ├── testEngine.ts         # Fisher-Yates, 5 modes filter, scoring formulas
│   │   └── validation.ts         # Zod schemas & duplicate text similarity
│   ├── pages/
│   │   ├── ActiveTest.tsx        # Distraction-free quiz engine with timer & palette
│   │   ├── AnswerReview.tsx      # Side-by-side answer review with source badges
│   │   ├── AttemptHistory.tsx    # Historical test records and retake launcher
│   │   ├── CustomTestConfig.tsx  # Mode 2 multi-week & category configurator
│   │   ├── Dashboard.tsx         # Course overview, week matrix, recent attempts
│   │   ├── ImportVerification.tsx# Multi-format import, OCR, and review queue
│   │   ├── ModeSelection.tsx     # Interactive picker for all 5 test modes
│   │   ├── QuestionBank.tsx      # Comprehensive question management, search & edit
│   │   ├── ResultsScreen.tsx     # Score cards, percentages, celebration effects
│   │   ├── SettingsPage.tsx      # Backup export/restore, privacy & storage info
│   │   └── WeekSelection.tsx     # Mode 1 Week 0-12 selector
│   ├── test/                     # Vitest automated test suites
│   ├── types/                    # Core TypeScript domain models
│   ├── App.tsx                   # React Router routing
│   ├── index.css                 # Tailwind CSS styles and custom utilities
│   └── main.tsx                  # Application entry point
├── package.json
└── vite.config.ts
```

---

## 🔒 Academic Integrity & Fidelity Policy

- The application contains **no fabricated Industrial IoT questions or answer keys**.
- The real question bank is populated strictly from source documents you provide (official NPTEL assignment PDFs, answer keys, or structured files).
- OCR output from scanned documents is always flagged as `Needs Review` and requires user verification before entering scored tests.
