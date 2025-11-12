/**
 * Document Version Management Service
 * Epic: Document Management - Version Control
 *
 * Handles document versioning operations:
 * - Create new versions
 * - Get version history
 * - Rollback to previous versions
 * - Compare versions
 * - Version statistics
 *
 * Design principles:
 * - Version chain: v1 (parent) → v2 → v3 → v4
 * - Only one "latest" version per document family
 * - Preserve all historical versions (no deletion)
 * - Support rollback by marking old version as latest
 */

import { db } from '@/lib/db';
import { uploadedDocuments } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { inngest } from '@/lib/inngest/client';

// =====================================================
// Types
// =====================================================

export interface VersionInfo {
  id: string;
  versionNumber: number;
  fileName: string;
  fileSize: number;
  fileUrl: string;
  versionNotes: string | null;
  uploadedAt: Date;
  uploadedBy: string;
  isLatestVersion: boolean;
  approvalStatus: string | null;
  signatureStatus: string | null;
}

export interface VersionStats {
  totalVersions: number;
  latestVersion: number;
  firstUploaded: Date;
  lastUpdated: Date;
  totalSizeBytes: number;
  signedVersions: number;
  approvedVersions: number;
}

export interface CreateVersionOptions {
  originalDocumentId: string;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  versionNotes?: string;
  uploadedBy: string;
  tenantId: string;
}

// =====================================================
// Main Functions
// =====================================================

/**
 * Create a new version of an existing document
 *
 * This function:
 * 1. Finds the root document (v1) in the version chain
 * 2. Determines the next version number
 * 3. Creates new document record with parent link
 * 4. Marks old version as superseded
 * 5. Triggers version-created event
 *
 * @param options - Version creation options
 * @returns New version details
 */
export async function createNewVersion(
  options: CreateVersionOptions
): Promise<{ newVersionId: string; versionNumber: number }> {
  // 1. Get original document
  const originalDoc = await db.query.uploadedDocuments.findFirst({
    where: eq(uploadedDocuments.id, options.originalDocumentId),
  });

  if (!originalDoc) {
    throw new Error('Document original non trouvé');
  }

  // 2. Find root document (v1) and get latest version number
  const rootDocumentId = originalDoc.parentDocumentId || originalDoc.id;

  // Get all versions to determine next version number
  const versions = await db.query.uploadedDocuments.findMany({
    where: sql`${uploadedDocuments.id} = ${rootDocumentId} OR ${uploadedDocuments.parentDocumentId} = ${rootDocumentId}`,
    orderBy: (docs, { desc }) => [desc(docs.versionNumber)],
  });

  const latestVersionNumber = versions[0]?.versionNumber || 1;
  const newVersionNumber = latestVersionNumber + 1;

  // 3. Mark current latest version as superseded
  const currentLatest = versions.find((v) => v.isLatestVersion);
  if (currentLatest) {
    await db
      .update(uploadedDocuments)
      .set({
        isLatestVersion: false,
        supersededAt: new Date(),
      })
      .where(eq(uploadedDocuments.id, currentLatest.id));
  }

  // 4. Create new version
  const [newVersion] = await db
    .insert(uploadedDocuments)
    .values({
      tenantId: options.tenantId,
      employeeId: originalDoc.employeeId,
      documentCategory: originalDoc.documentCategory,
      fileName: options.fileName,
      fileUrl: options.fileUrl,
      fileSize: options.fileSize,
      mimeType: options.mimeType,
      versionNumber: newVersionNumber,
      parentDocumentId: rootDocumentId,
      isLatestVersion: true,
      versionNotes: options.versionNotes || null,
      uploadedBy: options.uploadedBy,
      approvalStatus: 'pending', // New versions start as pending
    })
    .returning();

  // 5. Update superseded_by_id on previous version
  if (currentLatest) {
    await db
      .update(uploadedDocuments)
      .set({
        supersededById: newVersion.id,
      })
      .where(eq(uploadedDocuments.id, currentLatest.id));
  }

  // 6. Emit Inngest event for post-processing
  await inngest.send({
    name: 'document/version-created',
    data: {
      documentId: newVersion.id,
      parentDocumentId: rootDocumentId,
      versionNumber: newVersionNumber,
      tenantId: options.tenantId,
      uploadedBy: options.uploadedBy,
    },
  });

  return {
    newVersionId: newVersion.id,
    versionNumber: newVersionNumber,
  };
}

/**
 * Get complete version history for a document
 *
 * Returns all versions in chronological order (v1 → v2 → v3)
 *
 * @param documentId - ID of any version in the chain
 * @returns Array of version info
 */
export async function getVersionHistory(documentId: string): Promise<VersionInfo[]> {
  // Use the database function get_version_chain()
  const result = await db.execute<{
    id: string;
    version_number: number;
    file_name: string;
    file_size: number;
    version_notes: string | null;
    uploaded_at: Date;
    uploaded_by: string;
    is_latest_version: boolean;
    approval_status: string | null;
    signature_status: string | null;
  }>(
    sql`SELECT * FROM get_version_chain(${documentId}::uuid)`
  );

  // Also fetch file_url for each version (not returned by function)
  const versionIds = (result as any[]).map((r: any) => r.id);
  const fullVersions = await db.query.uploadedDocuments.findMany({
    where: sql`${uploadedDocuments.id} = ANY(${versionIds})`,
  });

  // Merge results
  return (result as any[]).map((row: any) => {
    const fullDoc = fullVersions.find((v) => v.id === row.id);
    return {
      id: row.id,
      versionNumber: row.version_number,
      fileName: row.file_name,
      fileSize: row.file_size,
      fileUrl: fullDoc?.fileUrl || '',
      versionNotes: row.version_notes,
      uploadedAt: new Date(row.uploaded_at),
      uploadedBy: row.uploaded_by,
      isLatestVersion: row.is_latest_version,
      approvalStatus: row.approval_status,
      signatureStatus: row.signature_status,
    };
  });
}

/**
 * Get version statistics for a document family
 *
 * @param documentId - ID of any version in the chain
 * @returns Version statistics
 */
export async function getVersionStats(documentId: string): Promise<VersionStats> {
  // Use the database function get_version_stats()
  const result = await db.execute<{ get_version_stats: any }>(
    sql`SELECT get_version_stats(${documentId}::uuid)`
  );

  const stats = (result as any[])[0]?.get_version_stats;

  if (!stats) {
    throw new Error('Impossible de récupérer les statistiques de version');
  }

  return {
    totalVersions: stats.total_versions,
    latestVersion: stats.latest_version,
    firstUploaded: new Date(stats.first_uploaded),
    lastUpdated: new Date(stats.last_updated),
    totalSizeBytes: stats.total_size_bytes,
    signedVersions: stats.signed_versions,
    approvedVersions: stats.approved_versions,
  };
}

/**
 * Rollback to a previous version
 *
 * This marks the selected version as "latest" and marks the current latest as not latest.
 * Does NOT delete any versions - maintains complete history.
 *
 * @param versionId - ID of the version to rollback to
 * @param rolledBackBy - User ID performing the rollback
 * @returns Success status
 */
export async function rollbackToVersion(
  versionId: string,
  rolledBackBy: string
): Promise<{ success: boolean; newLatestVersion: number }> {
  // 1. Get the version to rollback to
  const targetVersion = await db.query.uploadedDocuments.findFirst({
    where: eq(uploadedDocuments.id, versionId),
  });

  if (!targetVersion) {
    throw new Error('Version non trouvée');
  }

  if (targetVersion.isLatestVersion) {
    throw new Error('Cette version est déjà la version actuelle');
  }

  // 2. Get root document and all versions
  const rootDocumentId = targetVersion.parentDocumentId || targetVersion.id;
  const allVersions = await db.query.uploadedDocuments.findMany({
    where: sql`${uploadedDocuments.id} = ${rootDocumentId} OR ${uploadedDocuments.parentDocumentId} = ${rootDocumentId}`,
  });

  const currentLatest = allVersions.find((v) => v.isLatestVersion);

  // 3. Mark current latest as NOT latest
  if (currentLatest) {
    await db
      .update(uploadedDocuments)
      .set({
        isLatestVersion: false,
        supersededAt: new Date(),
      })
      .where(eq(uploadedDocuments.id, currentLatest.id));
  }

  // 4. Mark target version as latest
  await db
    .update(uploadedDocuments)
    .set({
      isLatestVersion: true,
      supersededAt: null,
      supersededById: null,
    })
    .where(eq(uploadedDocuments.id, versionId));

  // 5. Emit rollback event
  await inngest.send({
    name: 'document/version-rollback',
    data: {
      documentId: versionId,
      parentDocumentId: rootDocumentId,
      versionNumber: targetVersion.versionNumber,
      previousLatestId: currentLatest?.id,
      rolledBackBy,
    },
  });

  return {
    success: true,
    newLatestVersion: targetVersion.versionNumber,
  };
}

/**
 * Compare two versions of a document
 *
 * Returns differences between two versions (metadata only, not file content)
 *
 * @param versionId1 - First version ID (usually older)
 * @param versionId2 - Second version ID (usually newer)
 * @returns Comparison result
 */
export async function compareVersions(
  versionId1: string,
  versionId2: string
): Promise<{
  version1: VersionInfo;
  version2: VersionInfo;
  differences: {
    fileName: boolean;
    fileSize: { changed: boolean; diff: number };
    approvalStatus: boolean;
    signatureStatus: boolean;
  };
}> {
  // Get both versions
  const [v1, v2] = await Promise.all([
    db.query.uploadedDocuments.findFirst({ where: eq(uploadedDocuments.id, versionId1) }),
    db.query.uploadedDocuments.findFirst({ where: eq(uploadedDocuments.id, versionId2) }),
  ]);

  if (!v1 || !v2) {
    throw new Error('Une ou plusieurs versions non trouvées');
  }

  // Calculate differences
  const differences = {
    fileName: v1.fileName !== v2.fileName,
    fileSize: {
      changed: v1.fileSize !== v2.fileSize,
      diff: v2.fileSize - v1.fileSize,
    },
    approvalStatus: v1.approvalStatus !== v2.approvalStatus,
    signatureStatus: v1.signatureStatus !== v2.signatureStatus,
  };

  return {
    version1: {
      id: v1.id,
      versionNumber: v1.versionNumber,
      fileName: v1.fileName,
      fileSize: v1.fileSize,
      fileUrl: v1.fileUrl,
      versionNotes: v1.versionNotes,
      uploadedAt: v1.uploadedAt ? new Date(v1.uploadedAt) : new Date(),
      uploadedBy: v1.uploadedBy!,
      isLatestVersion: v1.isLatestVersion,
      approvalStatus: v1.approvalStatus,
      signatureStatus: v1.signatureStatus,
    },
    version2: {
      id: v2.id,
      versionNumber: v2.versionNumber,
      fileName: v2.fileName,
      fileSize: v2.fileSize,
      fileUrl: v2.fileUrl,
      versionNotes: v2.versionNotes,
      uploadedAt: v2.uploadedAt ? new Date(v2.uploadedAt) : new Date(),
      uploadedBy: v2.uploadedBy!,
      isLatestVersion: v2.isLatestVersion,
      approvalStatus: v2.approvalStatus,
      signatureStatus: v2.signatureStatus,
    },
    differences,
  };
}

/**
 * Delete a specific version (soft delete - marks as deleted)
 *
 * WARNING: Cannot delete v1 (root) if it has children.
 * Cannot delete the only remaining version.
 *
 * @param versionId - ID of version to delete
 * @returns Success status
 */
export async function deleteVersion(versionId: string): Promise<{ success: boolean }> {
  const version = await db.query.uploadedDocuments.findFirst({
    where: eq(uploadedDocuments.id, versionId),
  });

  if (!version) {
    throw new Error('Version non trouvée');
  }

  // Get all versions in family
  const rootDocumentId = version.parentDocumentId || version.id;
  const allVersions = await db.query.uploadedDocuments.findMany({
    where: sql`${uploadedDocuments.id} = ${rootDocumentId} OR ${uploadedDocuments.parentDocumentId} = ${rootDocumentId}`,
  });

  // Check if this is the only version
  if (allVersions.length === 1) {
    throw new Error('Impossible de supprimer la seule version restante');
  }

  // Check if this is v1 with children
  if (!version.parentDocumentId && allVersions.length > 1) {
    throw new Error(
      'Impossible de supprimer la version 1 (racine) car elle a des versions enfants'
    );
  }

  // If deleting the latest version, mark previous as latest
  if (version.isLatestVersion) {
    const previousVersions = allVersions
      .filter((v) => v.id !== versionId)
      .sort((a, b) => b.versionNumber - a.versionNumber);

    if (previousVersions.length > 0) {
      await db
        .update(uploadedDocuments)
        .set({
          isLatestVersion: true,
          supersededAt: null,
          supersededById: null,
        })
        .where(eq(uploadedDocuments.id, previousVersions[0].id));
    }
  }

  // Soft delete (or hard delete - depending on requirements)
  // For now, we'll hard delete since we have CASCADE constraints
  await db.delete(uploadedDocuments).where(eq(uploadedDocuments.id, versionId));

  return { success: true };
}
