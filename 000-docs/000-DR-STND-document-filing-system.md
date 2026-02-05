# DOCUMENT FILING SYSTEM STANDARD v4.3 (LLM/AI-ASSISTANT FRIENDLY)

**Document ID:** 000-DR-STND-document-filing-system
**Version:** 4.3
**Applies To:** All IRSB repositories (canonical cross-repo standard)
**Default Timezone:** America/Chicago
**Status:** Active

---

## 1. Purpose

This standard defines how documents are named and organized in `000-docs/`. The system is designed to be:
- **Flat**: No subdirectories under `000-docs/`
- **Chronological**: Project docs use sequential numbering (001-999)
- **Canonical**: Cross-repo standards use `000-*` prefix
- **Parseable**: Both humans and LLMs can extract metadata from filenames

---

## 2. Directory Structure

```
000-docs/           # FLAT - no subdirectories allowed
├── 000-*.md        # Canonical standards (cross-repo, must be identical)
├── 001-*.md        # First project doc
├── 002-*.md        # Second project doc
└── NNN-*.md        # Nth project doc (chronological, 001-999)
```

**Hard Rule:** `000-docs/` must remain strictly flat. No nested folders.

---

## 3. Filename Families

### 3.1 Project Documents (001-999)

Format: `NNN-CC-ABCD-short-description.ext`

| Component | Description | Example |
|-----------|-------------|---------|
| `NNN` | 3-digit sequence number (chronological, 001-999) | `001`, `042`, `999` |
| `CC` | 2-letter category code (see §4) | `DR`, `AA`, `TM` |
| `ABCD` | 4-letter type code (see §5) | `INDX`, `REPT`, `SPEC` |
| `short-description` | Kebab-case description | `repo-docs-index` |
| `.ext` | File extension | `.md`, `.pdf` |

**Examples:**
- `001-DR-INDX-repo-docs-index.md`
- `002-AA-REPT-phase-1-scaffold.md`
- `003-TM-SPEC-threat-model-v1.md`

### 3.2 Canonical Standards (000-*)

Format: `000-CC-ABCD-short-description.ext`

| Component | Description | Example |
|-----------|-------------|---------|
| `000` | Fixed prefix for canonical standards | `000` |
| `CC` | 2-letter category code | `DR`, `TM` |
| `ABCD` | 4-letter type code | `STND`, `SPEC` |
| `short-description` | Kebab-case description | `document-filing-system` |

**Canonical standards MUST be identical across all repos.** Use drift checking to verify.

**Examples:**
- `000-DR-STND-document-filing-system.md` (this file)
- `000-TM-STND-secrets-handling.md`

---

## 4. Category Codes (CC)

| Code | Category | Use For |
|------|----------|---------|
| `DR` | Documentation | Standards, indexes, guides |
| `AA` | After-Action | AARs, retrospectives, post-mortems |
| `TM` | Technical Model | Threat models, architecture docs |
| `AD` | Architecture Decision | ADRs |
| `OP` | Operations | Runbooks, playbooks |
| `RP` | Report | Status reports, audits |
| `PL` | Plan | Project plans, roadmaps |
| `PR` | Product | PRDs, requirements |

---

## 5. Type Codes (ABCD)

| Code | Type | Use For |
|------|------|---------|
| `INDX` | Index | Document indexes, catalogs |
| `STND` | Standard | Standards, conventions |
| `SPEC` | Specification | Technical specs, schemas |
| `REPT` | Report | AARs, status reports |
| `GUID` | Guide | How-to guides, tutorials |
| `RUNB` | Runbook | Operational procedures |
| `ARCH` | Architecture | Architecture docs, ADRs |
| `MODL` | Model | Threat models, data models |
| `PRDC` | Product | PRDs, requirements docs |
| `POLC` | Policy | Policies, governance |
| `ADRD` | ADR Decision | Architecture decision records |

---

## 6. Sequencing Rules

1. **Canonical standards (000-*)**: Reserved for cross-repo standards. Content must be identical across all repos.
2. **Project docs (001-999)**: Assign next available number chronologically.
3. **No gaps**: If `003` exists, next is `004`
4. **No reuse**: Deleted doc numbers are not reused

---

## 7. Cross-Repo Synchronization

### 7.1 Canonical Standard Management

- **Source of truth**: `irsb-solver` is the canonical source for all `000-*` files
- **Synchronization**: Other repos copy from source and verify checksums
- **Drift detection**: CI checks ensure canonical files are identical across repos

### 7.2 Drift Check Script

Each repo should have `scripts/check-canonical-drift.sh`:

```bash
#!/bin/bash
# Check that 000-* files match the canonical source

CANONICAL_REPO="irsb-solver"
CANONICAL_DIR="000-docs"

for file in 000-docs/000-*.md; do
  if [ -f "$file" ]; then
    local_sum=$(shasum -a 256 "$file" | cut -d' ' -f1)
    echo "Checking $file: $local_sum"
  fi
done
```

---

## 8. Examples Table

| Filename | Purpose |
|----------|---------|
| `000-DR-STND-document-filing-system.md` | This standard (canonical) |
| `001-DR-INDX-repo-docs-index.md` | Repository document index |
| `002-AA-REPT-phase-1-scaffold.md` | Phase 1 after-action report |
| `003-TM-MODL-threat-model-v1.md` | Threat model document |
| `004-AD-ARCH-tech-stack-decision.md` | ADR for tech stack |

---

## 9. Validation Checklist

Before committing a new doc to `000-docs/`:

- [ ] Filename matches pattern `NNN-CC-ABCD-*.ext` (001-999) or `000-CC-ABCD-*.ext`
- [ ] `000-docs/` remains flat (no subdirectories created)
- [ ] Sequence number is next available (no gaps, no reuse)
- [ ] Category code (CC) is from approved list
- [ ] Type code (ABCD) is from approved list
- [ ] Description is kebab-case and meaningful
- [ ] For `000-*` files: content matches canonical source

---

## 10. LLM/AI Integration Notes

This standard is designed for AI assistants:
- Filenames are self-documenting
- Regex patterns can extract metadata
- Chronological ordering enables "latest" queries
- Category/type codes enable filtering

**Extraction regex:**
```regex
^(\d{3})-([A-Z]{2})-([A-Z]{4})-(.+)\.(\w+)$
```

Groups: (1) sequence, (2) category, (3) type, (4) description, (5) extension

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 4.3 | 2026-02-05 | Migrated from 6767 to 000-* prefix; added cross-repo sync rules |
| 4.2 | 2025-02-04 | Initial version for irsb-solver |

---

*End of Document*
