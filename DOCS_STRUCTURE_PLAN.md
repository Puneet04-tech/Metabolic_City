# Documentation Structure Plan

**Purpose:** Organize all markdown files into logical folders for better project management

---

## Proposed Folder Structure

```
Metabolic_City/
├── docs/
│   ├── reports/                    # Progress and status reports
│   │   ├── PROGRESS_REPORT.md
│   │   ├── WEEKLY_PROGRESS_REPORT_OCT_2026.md
│   │   ├── FINAL_STATUS_REPORT.md
│   │   ├── FINAL_IMPLEMENTATION_REPORT.md
│   │   ├── IMPLEMENTATION_STATUS.md
│   │   └── ISSUES_AND_SOLUTIONS.md
│   │
│   ├── architecture/               # System architecture and design
│   │   ├── ALGORITHMS_AND_FORMULAE.md
│   │   ├── ARCHITECTURAL_IMPROVEMENTS.md
│   │   ├── SYSTEM_DESIGN_PRINCIPLES.md
│   │   └── PRINCIPLES_IMPLEMENTATION.md
│   │
│   ├── features/                   # Feature-specific documentation
│   │   ├── CITIZEN_QR_REPORTING.md
│   │   └── CITIZEN_REPORT_DATA_FLOW.md
│   │
│   ├── development/               # Development guides
│   │   ├── TESTING_GUIDE.md
│   │   ├── DEPLOYMENT.md
│   │   └── DEPLOYMENT_GUIDE.md
│   │
│   ├── backend/                   # Backend-specific docs
│   │   └── DATA-SOURCES.md
│   │
│   ├── frontend/                  # Frontend-specific docs
│   │   ├── REFACTORING.md
│   │   └── VERIFICATION.md
│   │
│   └── root/                      # Keep in root
│       ├── README.md
│       └── ADVANCED_PYTHON_FEATURES.md
│
├── .claude/                       # Claude-specific (keep as-is)
│   └── plans/
│       └── precious-shimmying-moon.md
│
├── backend/                       # Backend folder (keep existing)
│   └── DATA-SOURCES.md → docs/backend/
│
└── frontend/                      # Frontend folder (keep existing)
    ├── REFACTORING.md → docs/frontend/
    └── VERIFICATION.md → docs/frontend/
```

---

## File Mapping

### Root → docs/reports/
- `PROGRESS_REPORT.md` → `docs/reports/PROGRESS_REPORT.md`
- `WEEKLY_PROGRESS_REPORT_OCT_2026.md` → `docs/reports/WEEKLY_PROGRESS_REPORT_OCT_2026.md`
- `FINAL_STATUS_REPORT.md` → `docs/reports/FINAL_STATUS_REPORT.md`
- `FINAL_IMPLEMENTATION_REPORT.md` → `docs/reports/FINAL_IMPLEMENTATION_REPORT.md`
- `IMPLEMENTATION_STATUS.md` → `docs/reports/IMPLEMENTATION_STATUS.md`
- `ISSUES_AND_SOLUTIONS.md` → `docs/reports/ISSUES_AND_SOLUTIONS.md`

### Root → docs/architecture/
- `ALGORITHMS_AND_FORMULAE.md` → `docs/architecture/ALGORITHMS_AND_FORMULAE.md`
- `ARCHITECTURAL_IMPROVEMENTS.md` → `docs/architecture/ARCHITECTURAL_IMPROVEMENTS.md`
- `SYSTEM_DESIGN_PRINCIPLES.md` → `docs/architecture/SYSTEM_DESIGN_PRINCIPLES.md`
- `PRINCIPLES_IMPLEMENTATION.md` → `docs/architecture/PRINCIPLES_IMPLEMENTATION.md`

### Root → docs/features/
- `CITIZEN_QR_REPORTING.md` → `docs/features/CITIZEN_QR_REPORTING.md`
- `CITIZEN_REPORT_DATA_FLOW.md` → `docs/features/CITIZEN_REPORT_DATA_FLOW.md`

### Root → docs/development/
- `TESTING_GUIDE.md` → `docs/development/TESTING_GUIDE.md`
- `DEPLOYMENT.md` → `docs/development/DEPLOYMENT.md`
- `DEPLOYMENT_GUIDE.md` → `docs/development/DEPLOYMENT_GUIDE.md`

### Backend → docs/backend/
- `backend/DATA-SOURCES.md` → `docs/backend/DATA-SOURCES.md`

### Frontend → docs/frontend/
- `frontend/REFACTORING.md` → `docs/frontend/REFACTORING.md`
- `frontend/VERIFICATION.md` → `docs/frontend/VERIFICATION.md`

### Keep in Root
- `README.md` (stay in root)
- `ADVANCED_PYTHON_FEATURES.md` (stay in root - reference document)

### Keep in .claude/
- `.claude/plans/precious-shimmying-moon.md` (Claude-specific, keep as-is)

---

## Commands to Execute

### Windows PowerShell
```powershell
# Create directories
New-Item -ItemType Directory -Force -Path "E:\Metabolic_City\docs\reports"
New-Item -ItemType Directory -Force -Path "E:\Metabolic_City\docs\architecture"
New-Item -ItemType Directory -Force -Path "E:\Metabolic_City\docs\features"
New-Item -ItemType Directory -Force -Path "E:\Metabolic_City\docs\development"
New-Item -ItemType Directory -Force -Path "E:\Metabolic_City\docs\backend"
New-Item -ItemType Directory -Force -Path "E:\Metabolic_City\docs\frontend"

# Move files
Move-Item "E:\Metabolic_City\PROGRESS_REPORT.md" "E:\Metabolic_City\docs\reports\"
Move-Item "E:\Metabolic_City\WEEKLY_PROGRESS_REPORT_OCT_2026.md" "E:\Metabolic_City\docs\reports\"
Move-Item "E:\Metabolic_City\FINAL_STATUS_REPORT.md" "E:\Metabolic_City\docs\reports\"
Move-Item "E:\Metabolic_City\FINAL_IMPLEMENTATION_REPORT.md" "E:\Metabolic_City\docs\reports\"
Move-Item "E:\Metabolic_City\IMPLEMENTATION_STATUS.md" "E:\Metabolic_City\docs\reports\"
Move-Item "E:\Metabolic_City\ISSUES_AND_SOLUTIONS.md" "E:\Metabolic_City\docs\reports\"

Move-Item "E:\Metabolic_City\ALGORITHMS_AND_FORMULAE.md" "E:\Metabolic_City\docs\architecture\"
Move-Item "E:\Metabolic_City\ARCHITECTURAL_IMPROVEMENTS.md" "E:\Metabolic_City\docs\architecture\"
Move-Item "E:\Metabolic_City\SYSTEM_DESIGN_PRINCIPLES.md" "E:\Metabolic_City\docs\architecture\"
Move-Item "E:\Metabolic_City\PRINCIPLES_IMPLEMENTATION.md" "E:\Metabolic_City\docs\architecture\"

Move-Item "E:\Metabolic_City\CITIZEN_QR_REPORTING.md" "E:\Metabolic_City\docs\features\"
Move-Item "E:\Metabolic_City\CITIZEN_REPORT_DATA_FLOW.md" "E:\Metabolic_City\docs\features\"

Move-Item "E:\Metabolic_City\TESTING_GUIDE.md" "E:\Metabolic_City\docs\development\"
Move-Item "E:\Metabolic_City\DEPLOYMENT.md" "E:\Metabolic_City\docs\development\"
Move-Item "E:\Metabolic_City\DEPLOYMENT_GUIDE.md" "E:\Metabolic_City\docs\development\"

Move-Item "E:\Metabolic_City\backend\DATA-SOURCES.md" "E:\Metabolic_City\docs\backend\"
Move-Item "E:\Metabolic_City\frontend\REFACTORING.md" "E:\Metabolic_City\docs\frontend\"
Move-Item "E:\Metabolic_City\frontend\VERIFICATION.md" "E:\Metabolic_City\docs\frontend\"
```

### Git Bash (if using WSL)
```bash
# Create directories
mkdir -p /e/Metabolic_City/docs/reports
mkdir -p /e/Metabolic_City/docs/architecture
mkdir -p /e/Metabolic_City/docs/features
mkdir -p /e/Metabolic_City/docs/development
mkdir -p /e/Metabolic_City/docs/backend
mkdir -p /e/Metabolic_City/docs/frontend

# Move files
mv /e/Metabolic_City/PROGRESS_REPORT.md /e/Metabolic_City/docs/reports/
mv /e/Metabolic_City/WEEKLY_PROGRESS_REPORT_OCT_2026.md /e/Metabolic_City/docs/reports/
mv /e/Metabolic_City/FINAL_STATUS_REPORT.md /e/Metabolic_City/docs/reports/
mv /e/Metabolic_City/FINAL_IMPLEMENTATION_REPORT.md /e/Metabolic_City/docs/reports/
mv /e/Metabolic_City/IMPLEMENTATION_STATUS.md /e/Metabolic_City/docs/reports/
mv /e/Metabolic_City/ISSUES_AND_SOLUTIONS.md /e/Metabolic_City/docs/reports/

mv /e/Metabolic_City/ALGORITHMS_AND_FORMULAE.md /e/Metabolic_City/docs/architecture/
mv /e/Metabolic_City/ARCHITECTURAL_IMPROVEMENTS.md /e/Metabolic_City/docs/architecture/
mv /e/Metabolic_City/SYSTEM_DESIGN_PRINCIPLES.md /e/Metabolic_City/docs/architecture/
mv /e/Metabolic_City/PRINCIPLES_IMPLEMENTATION.md /e/Metabolic_City/docs/architecture/

mv /e/Metabolic_City/CITIZEN_QR_REPORTING.md /e/Metabolic_City/docs/features/
mv /e/Metabolic_City/CITIZEN_REPORT_DATA_FLOW.md /e/Metabolic_City/docs/features/

mv /e/Metabolic_City/TESTING_GUIDE.md /e/Metabolic_City/docs/development/
mv /e/Metabolic_City/DEPLOYMENT.md /e/Metabolic_City/docs/development/
mv /e/Metabolic_City/DEPLOYMENT_GUIDE.md /e/MMetabolic_City/docs/development/

mv /e/Metabolic_City/backend/DATA-SOURCES.md /e/Metabolic_City/docs/backend/
mv /e/Metabolic_City/frontend/REFACTORING.md /e/Metabolic_City/docs/frontend/
mv /e/Metabolic_City/frontend/VERIFICATION.md /e/Metabolic_City/docs/frontend/
```

---

## After Moving Files

### Update README.md
Add a Documentation section to README.md:

```markdown
## Documentation

Detailed documentation is organized in the `docs/` folder:

- **[Reports](docs/reports/)** - Progress reports, status updates, and implementation tracking
- **[Architecture](docs/architecture/)** - System design, algorithms, and formulae
- **[Features](docs/features/)** - Feature-specific documentation (citizen reporting, etc.)
- **[Development](docs/development/)** - Testing guides, deployment instructions
- **[Backend](docs/backend/)** - Backend-specific documentation
- **[Frontend](docs/frontend/)** - Frontend-specific documentation
```

### Update Import References
If any code files import or reference these markdown files, update the paths:
- Check for any `require()` or `import` statements referencing `.md` files
- Update paths to include `docs/` prefix
- Update any documentation links in the codebase

---

## Benefits of This Structure

1. **Better Organization:** Related documents are grouped together
2. **Easier Navigation:** Clear folder structure makes finding documents easier
3. **Scalability:** Easy to add new documents to appropriate categories
4. **Professional:** Follows industry best practices for documentation
5. **Version Control:** Easier to track changes by category

---

## Files After Reorganization

### Root (2 files)
- README.md
- ADVANCED_PYTHON_FEATURES.md

### docs/reports/ (6 files)
- PROGRESS_REPORT.md
- WEEKLY_PROGRESS_REPORT_OCT_2026.md
- FINAL_STATUS_REPORT.md
- FINAL_IMPLEMENTATION_REPORT.md
- IMPLEMENTATION_STATUS.md
- ISSUES_AND_SOLUTIONS.md

### docs/architecture/ (4 files)
- ALGORITHMS_AND_FORMULAE.md
- ARCHITECTURAL_IMPROVEMENTS.md
- SYSTEM_DESIGN_PRINCIPLES.md
- PRINCIPLES_IMPLEMENTATION.md

### docs/features/ (2 files)
- CITIZEN_QR_REPORTING.md
- CITIZEN_REPORT_DATA_FLOW.md

### docs/development/ (3 files)
- TESTING_GUIDE.md
- DEPLOYMENT.md
- DEPLOYMENT_GUIDE.md

### docs/backend/ (1 file)
- DATA-SOURCES.md

### docs/frontend/ (2 files)
- REFACTORING.md
- VERIFICATION.md

### .claude/plans/ (1 file - unchanged)
- precious-shimmying-moon.md

---

**Total Files Reorganized:** 18  
**Total Folders Created:** 6  
**Files Remaining in Root:** 2
