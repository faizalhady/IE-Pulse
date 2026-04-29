---
name: filesystem-mcp
description: >
  Use this skill whenever you are about to read, write, edit, or create any file
  on the user's computer using Filesystem MCP tools. Triggers on ANY file operation
  — new files, edits, rewrites, directory listing. Always consult this skill before
  touching the filesystem. Critical for avoiding write failures, double-append bugs,
  CRLF mismatch errors, and tool-not-loaded errors that have caused repeated failures
  in this project. If the user says "create a file", "edit this file", "update that
  file", "write to", or anything involving their local filesystem — use this skill.
---

# Filesystem MCP Skill

## Step 0 — Load tools FIRST (non-negotiable)

Filesystem tools are deferred — they do NOT exist until loaded via tool_search.
Skipping this causes "tool not found" errors.

**Run this before ANY file operation:**
```
tool_search(query="write file create new filesystem")
```

This loads: write_file, edit_file, read_text_file, list_directory,
create_directory, copy_file_user_to_claude, list_directory_with_sizes.

Do this even if earlier in the conversation you used these tools — long
conversations cause tool cache expiry.

---

## Tool reference

| Tool | What it does | When to use |
|---|---|---|
| `write_file` | Create new OR fully overwrite existing file | New files, full rewrites, long edits |
| `edit_file` | Line-based find-replace on existing file | Tiny surgical changes only (1-5 lines) |
| `read_text_file` | Read file into context | Before every edit |
| `list_directory` | List files in a folder | Exploring structure |
| `list_directory_with_sizes` | List files with sizes | Checking large projects |
| `create_directory` | Create new folder | Setting up paths |
| `copy_file_user_to_claude` | Copy user file to Claude's machine | Binary/large file analysis |

---

## Decision tree — which tool to use

```
Need to touch a file?
│
├── New file that doesn't exist yet?
│   └── write_file ✓
│
├── Full rewrite of existing file?
│   └── write_file ✓
│
├── Long edit (20+ lines, multiple sections)?
│   └── write_file ✓  (read first → construct full content → write_file)
│
└── Small surgical edit (1-5 lines, single location, unique text)?
    └── edit_file ✓  (read first → verify exact text → edit_file)
```

**When in doubt → write_file. It is always safe.**

---

## Correct workflows

### Creating a new file
```python
# 1. Load tools
tool_search("write file create new filesystem")

# 2. Write directly — no need to create first
write_file(path="C:\\Users\\...\\file.ts", content="full content")
```

### Full rewrite of existing file
```python
# 1. Load tools
tool_search("write file create new filesystem")

# 2. Read current content (to preserve parts not being changed)
read_text_file(path="C:\\Users\\...\\file.ts")

# 3. Construct complete new content in memory

# 4. Write entire file atomically
write_file(path="C:\\Users\\...\\file.ts", content="complete new content")
```

### Small surgical edit
```python
# 1. Load tools
tool_search("write file create new filesystem")

# 2. Read file — get exact current content
read_text_file(path="C:\\Users\\...\\file.ts")

# 3. Edit with SHORT, UNIQUE oldText only
edit_file(path="C:\\Users\\...\\file.ts", edits=[{
    "oldText": "exact 1-3 lines that appear ONCE in file",
    "newText": "replacement content"
}])

# 4. Re-read to verify the edit applied correctly
read_text_file(path="C:\\Users\\...\\file.ts")
```

---

## Hard rules — never violate

1. **Always tool_search before any file operation** — tools are lazy-loaded.

2. **write_file for anything new or large** — no matching, no CRLF issues, atomic.

3. **Always read_text_file before edit_file** — never edit from memory.
   The file on disk may differ from what's in context.

4. **edit_file oldText must be byte-perfect and SHORT** — Windows CRLF (`\r\n`)
   vs Unix LF (`\n`) causes silent match failures on long blocks.
   Keep oldText to 1-3 lines maximum.

5. **edit_file oldText must be unique** — if the text appears more than once in
   the file, ALL occurrences get replaced. This causes duplicate code bugs.

6. **Never use edit_file for large blocks** — even if it "works" it may match
   the wrong location. Use write_file instead.

7. **Re-read after edit_file to verify** — confirm the change applied correctly
   before proceeding.

---

## Common failure modes

| Symptom | Root cause | Fix |
|---|---|---|
| `ENOENT` error on edit_file | File doesn't exist | Use write_file |
| edit_file no-op (nothing changed) | CRLF mismatch on oldText | Use write_file for full rewrite |
| Code appears twice in file | oldText matched multiple times | Make oldText unique; use write_file |
| Tool not found error | Tool not loaded via tool_search | Call tool_search first |
| Wrong section of file edited | oldText not unique enough | Lengthen oldText or use write_file |
| File content is stale in context | Previous edits changed the file | Re-read with read_text_file |

---

## Two filesystems — never confuse them

Claude has access to TWO filesystems:

**User's computer** (Windows) → use Filesystem MCP tools
- Paths look like: `C:\Users\4033375\Projects\...`
- Tools: write_file, edit_file, read_text_file, list_directory

**Claude's computer** (Linux) → use bash_tool
- Paths look like: `/home/claude/...` or `/mnt/...`
- Tools: bash_tool with cat, echo, python, etc.

`bash_tool` CANNOT write to `C:\Users\...`
Filesystem tools CANNOT write to `/home/claude/...`

---

## Project-specific paths (Faiz's project)

- Frontend OLE pages: `C:\Users\4033375\Projects\PRODUCTION DASHBOARD\IE-Pulse\src\pages\ole\`
- Frontend source: `C:\Users\4033375\Projects\PRODUCTION DASHBOARD\IE-Pulse\src\`
- OLE Backend: `C:\Users\4033375\Projects\OLE ANALYZER\ole-backend\`
- Backend API: `C:\Users\4033375\Projects\OLE ANALYZER\ole-backend\api\main.py`
- Backend pipeline: `C:\Users\4033375\Projects\OLE ANALYZER\ole-backend\pipeline\`
- Backend config: `C:\Users\4033375\Projects\OLE ANALYZER\ole-backend\config.py`
