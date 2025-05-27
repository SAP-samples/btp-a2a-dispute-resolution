import cds from "@sap/cds";
import { TaskHandler } from "../vendor/a2a/server/handler";
import { A2AServer } from "../vendor/a2a/server/server";

/**
 * Class to enforce equipping the A2A Server with a TaskHandler
 */
export class A2AService extends cds.ApplicationService {
    protected a2aServer: A2AServer;

    protected registerTaskHandler(handler: TaskHandler): void {
        this.a2aServer.setTaskHandler(handler);
    }
}
