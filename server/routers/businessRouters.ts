import { router } from "../_core/trpc";
import { prospectRouter } from "./prospectRouter";
import { dashboardRouter } from "./dashboardRouter";
import { campaignRouter } from "./campaignRouter";
import { appointmentRouter } from "./appointmentRouter";
import { appointmentReminderRouter } from "./appointmentReminderRouter";
import { realEstateRouter } from "./realEstateRouter";
import { businessEntitiesRouter } from "./businessEntitiesRouter";
import { posRouter } from "./posRouter";
import { realTimeMonitoringRouter } from "./realTimeMonitoringRouter";

export const businessRouter = router({
  prospect: prospectRouter,
  dashboard: dashboardRouter,
  campaign: campaignRouter,
  appointment: appointmentRouter,
  appointmentReminder: appointmentReminderRouter,
  realEstate: realEstateRouter,
  businessEntities: businessEntitiesRouter,
  pos: posRouter,
  monitoring: realTimeMonitoringRouter,
});
