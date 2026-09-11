import { EventEmitter } from "node:events";

export type AppEvent =
  | {
      type: "booking.created";
      companyId: string;
      appointmentId: string;
      customerName: string;
      customerPhone?: string | null;
      customerEmail?: string | null;
      serviceName: string;
      employeeId: string;
      employeeName?: string | null;
      startsAt: Date;
      totalPrice: string;
    }
  | {
      type: "booking.rescheduled";
      companyId: string;
      appointmentId: string;
      customerName: string;
      serviceName: string;
      employeeId: string;
      oldStartsAt: Date;
      newStartsAt: Date;
    }
  | {
      type: "booking.cancelled";
      companyId: string;
      appointmentId: string;
      customerName: string;
      serviceName: string;
      employeeId?: string;
      startsAt: Date;
      reason?: string;
    }
  | {
      type: "booking.completed";
      companyId: string;
      appointmentId: string;
      customerName: string;
      totalPrice: string;
      paymentMethod?: string;
    }
  | {
      type: "customer.arrived";
      companyId: string;
      appointmentId: string;
      customerName: string;
      employeeId: string;
    }
  | {
      type: "payment.received";
      companyId: string;
      appointmentId?: string;
      amount: string;
      method: string;
    }
  | {
      type: "subscription.status_changed";
      companyId: string;
      status: string;
      plan: string;
    }
  | {
      type: "system.alert";
      companyId?: string;
      title: string;
      message: string;
      level?: "info" | "warning" | "error";
    };

class AppEventBus extends EventEmitter {
  public emitEvent(event: AppEvent): boolean {
    return this.emit(event.type, event) && this.emit("*", event);
  }

  public onEvent(type: AppEvent["type"] | "*", listener: (event: AppEvent) => void | Promise<void>) {
    this.on(type, (evt: AppEvent) => {
      Promise.resolve(listener(evt)).catch((err) => {
        console.error(`[EventBus] Error handling event ${evt.type}:`, err);
      });
    });
  }
}

export const eventBus = new AppEventBus();
