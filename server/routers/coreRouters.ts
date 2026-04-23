import { router } from "../_core/trpc";
import { systemRouter } from "../_core/systemRouter";
import { authRouter } from "./authRouter";
import { userRouter } from "./userRouter";
import { tenantRouter } from "./tenantRouter";
import { securityRouter } from "./securityRouter";
import { teamManagerRouter } from "./teamManagerRouter";
import { taskRouter } from "./taskRouter";

export const coreRouter = router({
  system: systemRouter,
  auth: authRouter,
  user: userRouter,
  tenant: tenantRouter,
  security: securityRouter,
  teamManager: teamManagerRouter,
  tasks: taskRouter,
});
