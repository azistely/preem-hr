/**
 * HR Modules - Services
 * Centralized exports for all HR module services
 */

export * from './smart-defaults.service';
export * from './form-renderer.service';
export * from './scoring.service';

// Note: workflow-engine.service.ts and assignment-resolver.service.ts
// have duplicate exports with types - import directly if needed:
// import { ... } from '@/lib/hr-modules/services/workflow-engine.service';
// import { ... } from '@/lib/hr-modules/services/assignment-resolver.service';
