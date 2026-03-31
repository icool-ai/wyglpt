import { Injectable } from "@nestjs/common";
import { BillingService } from "../billing/billing.service";
import { TicketsService } from "../tickets/tickets.service";

@Injectable()
export class DashboardService {
  constructor(
    private readonly tickets: TicketsService,
    private readonly billing: BillingService
  ) {}

  async getOverview() {
    const tickets = await this.tickets.list();
    const bills = await this.billing.list();
    const closed = tickets.filter((x) => x.status === "closed").length;
    const paid = bills.filter((x) => x.status === "paid").length;
    const totalAmount = bills.reduce((sum, x) => sum + x.amount, 0);
    return {
      ticketCount: tickets.length,
      ticketCloseRate: tickets.length ? Number((closed / tickets.length).toFixed(2)) : 0,
      billCount: bills.length,
      paymentRate: bills.length ? Number((paid / bills.length).toFixed(2)) : 0,
      receivableAmount: totalAmount
    };
  }

  async aiMetrics() {
    const overview = await this.getOverview();
    return [
      { metric: "ticketCloseRate", current: overview.ticketCloseRate, previous: 0.5 },
      { metric: "paymentRate", current: overview.paymentRate, previous: 0.6 }
    ];
  }
}
