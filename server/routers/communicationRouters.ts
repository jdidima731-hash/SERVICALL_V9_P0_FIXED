import { router } from "../_core/trpc";
import { callsRouter } from "./callsRouter";
import { messagingRouter } from "./messagingRouter";
import { phoneRouter } from "./phoneRouter";
import { softphoneRouter } from "./softphoneRouter";
import { twilioRouter } from "./twilioRouter";
import { recordingRouter } from "./recordingRouter";
import { emailConfigRouter } from "./emailConfigRouter";
import { whatsappRouter } from "./whatsappRouter";
import { liveListeningRouter } from "./liveListeningRouter";

export const communicationRouter = router({
  calls:     callsRouter,
  messaging: messagingRouter,
  phone:     phoneRouter,
  softphone: softphoneRouter,
  twilio:    twilioRouter,
  recording: recordingRouter,
  emailConfig: emailConfigRouter,
  whatsapp:    whatsappRouter,
  liveListening: liveListeningRouter,
});
