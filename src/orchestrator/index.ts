import * as df from "durable-functions";
import orchestrator from "./orchestrator";

export const jobOrchestrator = df.app.orchestration("jobOrchestrator", orchestrator);
