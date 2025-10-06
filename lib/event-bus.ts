/**
 * Event Bus for Domain Events
 *
 * Enables loosely-coupled communication between bounded contexts.
 * Events are published asynchronously and handled by registered listeners.
 */

type EventHandler<T = any> = (payload: T) => void | Promise<void>;

interface EventSubscription {
  event: string;
  handler: EventHandler;
}

class EventBus {
  private subscriptions: EventSubscription[] = [];

  /**
   * Subscribe to an event
   *
   * @param event - Event name (e.g., 'employee.hired')
   * @param handler - Handler function
   * @returns Unsubscribe function
   */
  subscribe<T = any>(event: string, handler: EventHandler<T>): () => void {
    const subscription: EventSubscription = { event, handler };
    this.subscriptions.push(subscription);

    // Return unsubscribe function
    return () => {
      const index = this.subscriptions.indexOf(subscription);
      if (index > -1) {
        this.subscriptions.splice(index, 1);
      }
    };
  }

  /**
   * Publish an event to all subscribers
   *
   * @param event - Event name
   * @param payload - Event data
   */
  async publish<T = any>(event: string, payload: T): Promise<void> {
    const handlers = this.subscriptions
      .filter(sub => sub.event === event || sub.event === '*')
      .map(sub => sub.handler);

    if (handlers.length === 0) {
      console.warn(`[EventBus] No handlers registered for event: ${event}`);
    }

    // Execute handlers concurrently
    await Promise.all(
      handlers.map(async (handler) => {
        try {
          await handler(payload);
        } catch (error) {
          console.error(`[EventBus] Handler error for ${event}:`, error);
          // Don't throw - we don't want one handler failure to affect others
        }
      })
    );

    console.log(`[EventBus] Published: ${event}`, payload);
  }

  /**
   * Clear all subscriptions (useful for testing)
   */
  clear(): void {
    this.subscriptions = [];
  }
}

// Singleton instance
export const eventBus = new EventBus();

/**
 * Domain Event Types
 */
export interface EmployeeHiredEvent {
  employeeId: string;
  tenantId: string;
  hireDate: Date;
  positionId: string;
}

export interface EmployeeUpdatedEvent {
  employeeId: string;
  tenantId: string;
  changes: Record<string, any>;
}

export interface EmployeeTerminatedEvent {
  employeeId: string;
  tenantId: string;
  terminationDate: Date;
  reason: string;
}

export interface EmployeeSuspendedEvent {
  employeeId: string;
  tenantId: string;
  suspensionStart: Date;
  suspensionEnd?: Date;
  reason: string;
}

export interface EmployeeTransferredEvent {
  employeeId: string;
  tenantId: string;
  fromPositionId: string;
  toPositionId: string;
  effectiveDate: Date;
  reason: string;
}

export interface SalaryChangedEvent {
  employeeId: string;
  tenantId: string;
  oldSalary: number;
  newSalary: number;
  effectiveDate: Date;
  reason: string;
}

export interface EmployeeAssignedEvent {
  employeeId: string;
  tenantId: string;
  positionId: string;
  assignmentType: 'primary' | 'secondary' | 'temporary';
  effectiveDate: Date;
}

export interface PositionCreatedEvent {
  positionId: string;
  tenantId: string;
  title: string;
  departmentId?: string;
}
