# Database ERD

```mermaid
erDiagram
    log_entries {
        INTEGER id PK
        INTEGER timestamp_start
        INTEGER timestamp_end
        TEXT    transcript
    }

    notes {
        INTEGER id PK
        INTEGER entry_id FK
        TEXT    text
        INTEGER created_at
    }

    log_entries ||--o{ notes : "has many"
```

## Notes

- All timestamps are Unix epoch milliseconds
- `id` fields use `INTEGER PRIMARY KEY AUTOINCREMENT` (SQLite rowid alias)
- `notes.entry_id` references `log_entries.id` (no FK constraint enforced yet — will be added with cascade delete when user/sync tables are introduced)
