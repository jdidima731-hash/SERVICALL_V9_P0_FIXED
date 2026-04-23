#!/bin/bash

# ==============================================================================
# POSTGRESQL AUTOMATIC BACKUP SCRIPT - SERVICALL CRM
# ==============================================================================

# Configuration
PROJECT_ROOT="/home/ubuntu/servicall_crm"
BACKUP_DIR="${BACKUP_DIR:-"$PROJECT_ROOT/backups"}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/db_backup_$TIMESTAMP.sql.gz"
RETENTION_DAYS=7

# Load environment variables if .env exists
if [ -f "$PROJECT_ROOT/.env" ]; then
    export $(grep -v '^#' "$PROJECT_ROOT/.env" | xargs)
fi

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

echo "⏳ [$(date)] Starting database backup..."

# Execute pg_dump
if [ ! -z "$DATABASE_URL" ]; then
    pg_dump "$DATABASE_URL" | gzip > "$BACKUP_FILE"
else
    echo "❌ [$(date)] Error: DATABASE_URL not found. Cannot perform backup."
    exit 1
fi

# Check if backup was successful
if [ $? -eq 0 ]; then
    echo "✅ [$(date)] Backup created successfully: $BACKUP_FILE"
    
    # Remove old backups (Retention)
    echo "🧹 Cleaning up backups older than $RETENTION_DAYS days..."
    find "$BACKUP_DIR" -name "db_backup_*.sql.gz" -mtime +$RETENTION_DAYS -exec rm {} \;
    echo "✨ Cleanup finished."
else
    echo "❌ [$(date)] Error: Backup failed."
    exit 1
fi
