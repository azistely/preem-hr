/**
 * Performance ↔ Training Integration Inngest Functions
 * Epic: Performance Management & Training Modules
 *
 * Integration events that connect Performance and Training modules:
 * - Competency gaps from evaluations → Training recommendations
 * - Training completion → Objective progress updates
 * - Certification expiry → Compliance action items
 */

import { inngest } from '../client';
import { db } from '@/lib/db';
import { eq, and, sql, inArray } from 'drizzle-orm';
import { competencies } from '@/lib/db/schema/performance';
import { trainingCourses, trainingEnrollments, employeeCertifications } from '@/lib/db/schema/training';
import { employees } from '@/lib/db/schema/employees';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface CompetencyRating {
  competencyId: string;
  currentLevel: number;
  targetLevel: number;
  gap: number;
}

interface TrainingRecommendation {
  courseId: string;
  courseName: string;
  competencyId: string;
  competencyName: string;
  gap: number;
  priority: 'high' | 'medium' | 'low';
}

// ============================================================================
// COMPETENCY GAP → TRAINING RECOMMENDATIONS
// ============================================================================

/**
 * Generate Training Recommendations from Competency Gaps
 * Triggered when an evaluation is submitted or a competency assessment is completed
 */
export const generateTrainingRecommendationsFunction = inngest.createFunction(
  {
    id: 'generate-training-recommendations',
    name: 'Generate Training Recommendations from Competency Gaps',
    retries: 2,
  },
  { event: 'competency.gap.identified' },
  async ({ event, step }) => {
    const { employeeId, tenantId, competencyRatings } = event.data as {
      employeeId: string;
      tenantId: string;
      competencyRatings: CompetencyRating[];
    };

    // Step 1: Filter for competencies with gaps (current < target)
    const gapsToAddress = await step.run('filter-gaps', async () => {
      return competencyRatings.filter((rating) => rating.gap > 0);
    });

    if (gapsToAddress.length === 0) {
      return {
        message: 'No competency gaps to address',
        employeeId,
        recommendations: [],
      };
    }

    // Step 2: Get competency details and matching courses
    const recommendations = await step.run('generate-recommendations', async () => {
      const competencyIds = gapsToAddress.map((g) => g.competencyId);

      // Get competency details
      const competencyRecords = await db
        .select()
        .from(competencies)
        .where(
          and(
            eq(competencies.tenantId, tenantId),
            inArray(competencies.id, competencyIds)
          )
        );

      const competencyMap = new Map(
        competencyRecords.map((c) => [c.id, c])
      );

      // Find courses that address these competencies
      const matchingCourses = await db
        .select()
        .from(trainingCourses)
        .where(
          and(
            eq(trainingCourses.tenantId, tenantId),
            eq(trainingCourses.isActive, true)
          )
        );

      // Match courses to gaps
      const courseRecommendations: TrainingRecommendation[] = [];

      for (const gap of gapsToAddress) {
        const competency = competencyMap.get(gap.competencyId);
        if (!competency) continue;

        // Find courses linked to this competency
        const relevantCourses = matchingCourses.filter((course) => {
          const linkedIds = course.linkedCompetencyIds as string[] | null;
          return linkedIds?.includes(gap.competencyId);
        });

        // Determine priority based on gap size
        const priority: 'high' | 'medium' | 'low' =
          gap.gap >= 2 ? 'high' : gap.gap >= 1 ? 'medium' : 'low';

        for (const course of relevantCourses) {
          courseRecommendations.push({
            courseId: course.id,
            courseName: course.name,
            competencyId: gap.competencyId,
            competencyName: competency.name,
            gap: gap.gap,
            priority,
          });
        }

        // If no specific courses found, add a generic recommendation flag
        if (relevantCourses.length === 0) {
          console.log(
            `No training course found for competency ${competency.name} (gap: ${gap.gap})`
          );
        }
      }

      // Sort by priority (high first) then by gap size
      return courseRecommendations.sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        }
        return b.gap - a.gap;
      });
    });

    // Step 3: Store recommendations (could be in a training_recommendations table)
    await step.run('notify-employee', async () => {
      // Get employee email
      const employee = await db
        .select()
        .from(employees)
        .where(eq(employees.id, employeeId))
        .limit(1);

      if (employee[0]?.email && recommendations.length > 0) {
        // TODO: Send email notification with training recommendations
        console.log(
          `Sending training recommendations to ${employee[0].email}:`,
          recommendations.map((r) => r.courseName).join(', ')
        );
      }
    });

    return {
      message: `Generated ${recommendations.length} training recommendations`,
      employeeId,
      recommendations,
      gaps: gapsToAddress.length,
    };
  }
);

// ============================================================================
// TRAINING COMPLETION → OBJECTIVE PROGRESS
// ============================================================================

/**
 * Update Objective Progress on Training Completion
 * Triggered when training enrollment status changes to 'reussi' (passed)
 */
export const updateObjectiveOnTrainingCompleteFunction = inngest.createFunction(
  {
    id: 'update-objective-on-training-complete',
    name: 'Update Objective Progress on Training Completion',
    retries: 2,
  },
  { event: 'training.completed' },
  async ({ event, step }) => {
    const { enrollmentId, employeeId, tenantId, courseId, completionStatus } = event.data as {
      enrollmentId: string;
      employeeId: string;
      tenantId: string;
      courseId: string;
      completionStatus: 'reussi' | 'echoue' | 'en_cours';
    };

    // Only process successful completions
    if (completionStatus !== 'reussi') {
      return {
        message: 'Training not successfully completed, no objective update needed',
        enrollmentId,
        completionStatus,
      };
    }

    // Step 1: Get course details to find linked competencies
    const courseData = await step.run('get-course-data', async () => {
      const course = await db
        .select()
        .from(trainingCourses)
        .where(eq(trainingCourses.id, courseId))
        .limit(1);

      return course[0] ?? null;
    });

    if (!courseData) {
      return {
        message: 'Course not found',
        courseId,
        enrollmentId,
      };
    }

    // Step 2: Update competency levels if course is linked to competencies
    const linkedCompetencies = (courseData.linkedCompetencyIds as string[] | null) ?? [];

    if (linkedCompetencies.length > 0) {
      await step.run('update-competency-progress', async () => {
        // Get current competency assessments for employee
        // This would update employee_competency_assessments table
        console.log(
          `Training ${courseData.name} completed by employee ${employeeId}. ` +
          `Linked competencies: ${linkedCompetencies.join(', ')}`
        );

        // TODO: Update employee competency assessments
        // Could send an event to trigger competency re-assessment
      });
    }

    // Step 3: Update any linked objectives
    await step.run('update-objective-progress', async () => {
      // Find objectives that have this training as a key result or action item
      // This would typically check a junction table or JSONB field
      console.log(
        `Checking for objectives linked to course ${courseData.name} for employee ${employeeId}`
      );

      // TODO: Update objective progress based on training completion
    });

    // Step 4: Grant certification if applicable
    if (courseData.grantsCertification) {
      await step.run('grant-certification', async () => {
        const validityMonths = courseData.certificationValidityMonths ?? 24;
        const expiryDate = new Date();
        expiryDate.setMonth(expiryDate.getMonth() + validityMonths);

        await db.insert(employeeCertifications).values({
          tenantId,
          employeeId,
          certificationName: courseData.name,
          issuingOrganization: courseData.provider ?? 'Internal',
          issueDate: new Date().toISOString().split('T')[0],
          expiryDate: expiryDate.toISOString().split('T')[0],
          status: 'active',
          linkedCourseId: courseId,
          linkedEnrollmentId: enrollmentId,
        });

        console.log(
          `Certification granted for ${courseData.name}, expires ${expiryDate.toISOString()}`
        );
      });
    }

    return {
      message: 'Training completion processed',
      enrollmentId,
      courseId,
      courseName: courseData.name,
      competenciesUpdated: linkedCompetencies.length,
      certificationGranted: courseData.grantsCertification,
    };
  }
);

// ============================================================================
// EVALUATION SUBMITTED → COMPETENCY GAP ANALYSIS
// ============================================================================

/**
 * Process Evaluation Submission
 * Extracts competency ratings and triggers gap analysis
 */
export const processEvaluationSubmittedFunction = inngest.createFunction(
  {
    id: 'process-evaluation-submitted',
    name: 'Process Evaluation Submission for Gap Analysis',
    retries: 2,
  },
  { event: 'evaluation.submitted' },
  async ({ event, step }) => {
    const { evaluationId, employeeId, tenantId, competencyRatings } = event.data as {
      evaluationId: string;
      employeeId: string;
      tenantId: string;
      competencyRatings?: CompetencyRating[];
    };

    // Step 1: Validate competency ratings exist
    if (!competencyRatings || competencyRatings.length === 0) {
      return {
        message: 'No competency ratings in evaluation',
        evaluationId,
        employeeId,
      };
    }

    // Step 2: Calculate gaps
    const ratingsWithGaps = await step.run('calculate-gaps', async () => {
      return competencyRatings.map((rating) => ({
        ...rating,
        gap: rating.targetLevel - rating.currentLevel,
      }));
    });

    // Step 3: Trigger training recommendations if gaps exist
    const hasGaps = ratingsWithGaps.some((r) => r.gap > 0);

    if (hasGaps) {
      await step.run('trigger-training-recommendations', async () => {
        await inngest.send({
          name: 'competency.gap.identified',
          data: {
            employeeId,
            tenantId,
            competencyRatings: ratingsWithGaps,
            sourceType: 'evaluation',
            sourceId: evaluationId,
          },
        });
      });
    }

    return {
      message: 'Evaluation processed',
      evaluationId,
      employeeId,
      totalCompetencies: ratingsWithGaps.length,
      competenciesWithGaps: ratingsWithGaps.filter((r) => r.gap > 0).length,
      trainingRecommendationsTriggered: hasGaps,
    };
  }
);

// ============================================================================
// CERTIFICATION EXPIRY CHECK
// ============================================================================

/**
 * Check for Expiring Certifications
 * Runs daily to identify certifications expiring in the next 30 days
 */
export const certificationExpiryCheckFunction = inngest.createFunction(
  {
    id: 'certification-expiry-check',
    name: 'Check for Expiring Certifications',
    retries: 2,
  },
  // Run daily at 8 AM
  { cron: '0 8 * * *' },
  async ({ step }) => {
    // Step 1: Find expiring certifications
    const expiringCerts = await step.run('find-expiring-certifications', async () => {
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      const thirtyDaysStr = thirtyDaysFromNow.toISOString().split('T')[0];
      const todayStr = new Date().toISOString().split('T')[0];

      // Find certifications expiring in the next 30 days
      const certs = await db
        .select()
        .from(employeeCertifications)
        .where(
          and(
            eq(employeeCertifications.status, 'active'),
            sql`${employeeCertifications.expiryDate} BETWEEN ${todayStr} AND ${thirtyDaysStr}`
          )
        );

      return certs;
    });

    if (expiringCerts.length === 0) {
      return {
        message: 'No certifications expiring in the next 30 days',
        count: 0,
      };
    }

    // Step 2: Update status and send notifications
    const notifications: Array<{ employeeId: string; certName: string; expiryDate: string | null }> = [];

    for (const cert of expiringCerts) {
      await step.run(`process-expiring-cert-${cert.id}`, async () => {
        // Update status to pending_renewal
        await db
          .update(employeeCertifications)
          .set({
            status: 'pending_renewal',
            updatedAt: new Date(),
          })
          .where(eq(employeeCertifications.id, cert.id));

        // Get employee for notification
        const employee = await db
          .select()
          .from(employees)
          .where(eq(employees.id, cert.employeeId))
          .limit(1);

        if (employee[0]?.email) {
          // TODO: Send expiry warning email
          console.log(
            `Certification "${cert.certificationName}" for ${employee[0].email} expires on ${cert.expiryDate}`
          );

          notifications.push({
            employeeId: cert.employeeId,
            certName: cert.certificationName,
            expiryDate: cert.expiryDate,
          });
        }

        // If linked to a course, suggest re-enrollment
        if (cert.linkedCourseId) {
          console.log(
            `Suggesting re-enrollment in course ${cert.linkedCourseId} for certification renewal`
          );
        }
      });
    }

    return {
      message: `Processed ${expiringCerts.length} expiring certifications`,
      count: expiringCerts.length,
      notifications,
    };
  }
);

// Export all integration functions
export const performanceTrainingIntegrationFunctions = [
  generateTrainingRecommendationsFunction,
  updateObjectiveOnTrainingCompleteFunction,
  processEvaluationSubmittedFunction,
  certificationExpiryCheckFunction,
];
