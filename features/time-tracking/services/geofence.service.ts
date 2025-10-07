/**
 * Geofence Validation Service
 *
 * Validates employee GPS location against configured geofences.
 * Uses Haversine formula to calculate distance between two GPS coordinates.
 */

import { db } from '@/db';
import { geofenceConfigs } from '@/drizzle/schema';
import { and, eq, isNull, lte, or, sql } from 'drizzle-orm';

export interface GeoLocation {
  latitude: number;
  longitude: number;
}

export interface GeofenceValidationResult {
  isValid: boolean;
  geofenceId?: string;
  geofenceName?: string;
  distance?: number; // meters
  reason?: string;
}

/**
 * Calculate distance between two GPS coordinates using Haversine formula
 * Returns distance in meters
 */
export function calculateDistance(
  point1: GeoLocation,
  point2: GeoLocation
): number {
  const earthRadiusMeters = 6371000;

  const lat1Rad = (point1.latitude * Math.PI) / 180;
  const lat2Rad = (point2.latitude * Math.PI) / 180;
  const deltaLat = ((point2.latitude - point1.latitude) * Math.PI) / 180;
  const deltaLon = ((point2.longitude - point1.longitude) * Math.PI) / 180;

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1Rad) *
      Math.cos(lat2Rad) *
      Math.sin(deltaLon / 2) *
      Math.sin(deltaLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusMeters * c;
}

/**
 * Validate if employee location is within geofence
 */
export async function validateGeofence(
  tenantId: string,
  employeeLocation: GeoLocation
): Promise<GeofenceValidationResult> {
  // Get active geofences for tenant
  const today = new Date().toISOString().split('T')[0];

  const activeGeofences = await db.query.geofenceConfigs.findMany({
    where: and(
      eq(geofenceConfigs.tenantId, tenantId),
      eq(geofenceConfigs.isActive, true),
      lte(geofenceConfigs.effectiveFrom, today),
      or(
        isNull(geofenceConfigs.effectiveTo),
        sql`${geofenceConfigs.effectiveTo} > ${today}`
      )
    ),
  });

  // If no geofences configured, allow by default
  if (activeGeofences.length === 0) {
    return {
      isValid: true,
      reason: 'Aucun géorepérage configuré',
    };
  }

  // Check each geofence
  for (const geofence of activeGeofences) {
    const geofenceCenter: GeoLocation = {
      latitude: parseFloat(geofence.latitude as string),
      longitude: parseFloat(geofence.longitude as string),
    };

    const distance = calculateDistance(employeeLocation, geofenceCenter);

    if (distance <= geofence.radiusMeters) {
      return {
        isValid: true,
        geofenceId: geofence.id,
        geofenceName: geofence.name,
        distance: Math.round(distance),
      };
    }
  }

  // Outside all geofences
  return {
    isValid: false,
    reason: 'Vous êtes trop loin du lieu de travail',
  };
}

/**
 * Get geofence configuration for a tenant
 */
export async function getGeofenceConfig(tenantId: string) {
  const today = new Date().toISOString().split('T')[0];

  return await db.query.geofenceConfigs.findFirst({
    where: and(
      eq(geofenceConfigs.tenantId, tenantId),
      eq(geofenceConfigs.isActive, true),
      lte(geofenceConfigs.effectiveFrom, today),
      or(
        isNull(geofenceConfigs.effectiveTo),
        sql`${geofenceConfigs.effectiveTo} > ${today}`
      )
    ),
  });
}
