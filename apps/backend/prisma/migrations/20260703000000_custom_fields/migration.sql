-- Custom Fields System Migration

-- Field Groups
CREATE TABLE "FieldGroup" (
  "id"          TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "orgId"       TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "description" TEXT,
  "color"       TEXT DEFAULT '#7F77DD',
  "icon"        TEXT,
  "sortOrder"   INTEGER NOT NULL DEFAULT 0,
  "isCollapsed" BOOLEAN NOT NULL DEFAULT false,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FieldGroup_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "FieldGroup_orgId_sortOrder_idx" ON "FieldGroup"("orgId", "sortOrder");

-- Custom Fields
CREATE TABLE "CustomField" (
  "id"           TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "orgId"        TEXT NOT NULL,
  "groupId"      TEXT,
  "type"         TEXT NOT NULL,
  "name"         TEXT NOT NULL,
  "description"  TEXT,
  "isRequired"   BOOLEAN NOT NULL DEFAULT false,
  "isSystem"     BOOLEAN NOT NULL DEFAULT false,
  "showInTable"  BOOLEAN NOT NULL DEFAULT true,
  "showInCard"   BOOLEAN NOT NULL DEFAULT true,
  "showInFilter" BOOLEAN NOT NULL DEFAULT true,
  "showOnCreate" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder"    INTEGER NOT NULL DEFAULT 0,
  "defaultValue" JSONB,
  "config"       JSONB,
  "deletedAt"    TIMESTAMP(3),
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomField_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CustomField_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "FieldGroup"("id") ON DELETE SET NULL
);
CREATE INDEX "CustomField_orgId_sortOrder_idx" ON "CustomField"("orgId", "sortOrder");
CREATE INDEX "CustomField_orgId_type_idx" ON "CustomField"("orgId", "type");
CREATE INDEX "CustomField_orgId_deletedAt_idx" ON "CustomField"("orgId", "deletedAt");

-- Field → Project Bindings
CREATE TABLE "FieldProjectBinding" (
  "id"        TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "fieldId"   TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  CONSTRAINT "FieldProjectBinding_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FieldProjectBinding_fieldId_projectId_key" UNIQUE ("fieldId", "projectId"),
  CONSTRAINT "FieldProjectBinding_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "CustomField"("id") ON DELETE CASCADE
);
CREATE INDEX "FieldProjectBinding_projectId_idx" ON "FieldProjectBinding"("projectId");

-- Task Types (templates)
CREATE TABLE "TaskType" (
  "id"        TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "orgId"     TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "icon"      TEXT,
  "color"     TEXT DEFAULT '#7F77DD',
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TaskType_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TaskType_orgId_idx" ON "TaskType"("orgId");

-- Field → TaskType Bindings
CREATE TABLE "FieldTaskTypeBinding" (
  "id"         TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "fieldId"    TEXT NOT NULL,
  "taskTypeId" TEXT NOT NULL,
  "sortOrder"  INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "FieldTaskTypeBinding_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FieldTaskTypeBinding_fieldId_taskTypeId_key" UNIQUE ("fieldId", "taskTypeId"),
  CONSTRAINT "FieldTaskTypeBinding_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "CustomField"("id") ON DELETE CASCADE,
  CONSTRAINT "FieldTaskTypeBinding_taskTypeId_fkey" FOREIGN KEY ("taskTypeId") REFERENCES "TaskType"("id") ON DELETE CASCADE
);
CREATE INDEX "FieldTaskTypeBinding_taskTypeId_idx" ON "FieldTaskTypeBinding"("taskTypeId");

-- Conditional Logic
CREATE TABLE "FieldCondition" (
  "id"            TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "orgId"         TEXT NOT NULL,
  "sourceFieldId" TEXT NOT NULL,
  "operator"      TEXT NOT NULL,
  "value"         JSONB,
  "logicGroup"    INTEGER NOT NULL DEFAULT 0,
  "action"        TEXT NOT NULL,
  "targetFieldId" TEXT NOT NULL,
  "actionValue"   JSONB,
  "sortOrder"     INTEGER NOT NULL DEFAULT 0,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FieldCondition_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FieldCondition_sourceFieldId_fkey" FOREIGN KEY ("sourceFieldId") REFERENCES "CustomField"("id") ON DELETE CASCADE,
  CONSTRAINT "FieldCondition_targetFieldId_fkey" FOREIGN KEY ("targetFieldId") REFERENCES "CustomField"("id") ON DELETE CASCADE
);
CREATE INDEX "FieldCondition_orgId_sourceFieldId_idx" ON "FieldCondition"("orgId", "sourceFieldId");

-- Custom Field Values (EAV)
CREATE TABLE "CustomFieldValue" (
  "id"        TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "orgId"     TEXT NOT NULL,
  "taskId"    TEXT NOT NULL,
  "fieldId"   TEXT NOT NULL,
  "strVal"    TEXT,
  "numVal"    DOUBLE PRECISION,
  "boolVal"   BOOLEAN,
  "dateVal"   TIMESTAMP(3),
  "jsonVal"   JSONB,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomFieldValue_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CustomFieldValue_taskId_fieldId_key" UNIQUE ("taskId", "fieldId"),
  CONSTRAINT "CustomFieldValue_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE,
  CONSTRAINT "CustomFieldValue_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "CustomField"("id") ON DELETE CASCADE
);
CREATE INDEX "CustomFieldValue_orgId_fieldId_numVal_idx"  ON "CustomFieldValue"("orgId", "fieldId", "numVal");
CREATE INDEX "CustomFieldValue_orgId_fieldId_dateVal_idx" ON "CustomFieldValue"("orgId", "fieldId", "dateVal");
CREATE INDEX "CustomFieldValue_orgId_fieldId_boolVal_idx" ON "CustomFieldValue"("orgId", "fieldId", "boolVal");
CREATE INDEX "CustomFieldValue_orgId_fieldId_strVal_idx"  ON "CustomFieldValue"("orgId", "fieldId", "strVal");

-- Saved Filters
CREATE TABLE "SavedFilter" (
  "id"        TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "orgId"     TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "filters"   JSONB NOT NULL,
  "isShared"  BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SavedFilter_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SavedFilter_orgId_userId_idx" ON "SavedFilter"("orgId", "userId");

-- Add taskTypeId and customFields to Task
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "taskTypeId"   TEXT;
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "customFields" JSONB;
ALTER TABLE "Task" ADD CONSTRAINT "Task_taskTypeId_fkey"
  FOREIGN KEY ("taskTypeId") REFERENCES "TaskType"("id") ON DELETE SET NULL;

-- GIN index for JSONB search on Task
CREATE INDEX "Task_customFields_gin_idx" ON "Task" USING GIN ("customFields");

-- Enable pg_trgm for text search (safe if already enabled)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX "CustomFieldValue_strVal_trgm_idx" ON "CustomFieldValue" USING GIN ("strVal" gin_trgm_ops);
