import cds from "@sap/cds";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

import { A2AClient } from "./vendor/a2a/client/client.js";
import {
    Task,
    TaskArtifactUpdateEvent,
    TaskSendParams,
    TaskStatusUpdateEvent,
    TextPart
} from "./vendor/a2a/schema.js";
import { CallbackRequest, CallbackResponse, MetadataRequest, MetadataResponse } from "./types.js";

const { uuid } = cds.utils;

export default class A2ARouterService extends cds.ApplicationService {
    private readonly log = cds.log("A2ARouterService");

    async init(): Promise<void> {
        this.log.info("init A2A router service");
        await super.init();
        this.on("metadata", this.onMetadata);
        this.on("callback", this.onCallback);
    }

    // Probably describing the agents in /metadata doesnt have any effect on choosing the tool and implement everything within one tool on BAF side
    // For now: One tool for A2A Router, one tool for A2A Catalog
    private onMetadata = async (request: cds.Request): Promise<MetadataResponse> => {
        const payload = request.data as MetadataRequest;
        this.log.info("Payload on Metadata", payload);

        const agentRoutingSchemaZod = z.object({
            agentName: z.string().describe("The name of the Agent to hand off execution to."),
            task: z.string().describe("A description of the task which the Agent should work on and solve.")
        });

        return {
            name: "Agent Router",
            description: `This tool acts as an Agent Router. Make sure that the name of the Agent, which you want to hand off execution to, is correct.`,
            schema: JSON.stringify(zodToJsonSchema(agentRoutingSchemaZod))
        };
    };

    private onCallback = async (request: cds.Request): Promise<CallbackResponse> => {
        const payload = request.data as CallbackRequest;
        this.log.info("Payload on Callback", payload);
        const { agentName, task }: { agentName: string; task: string } = JSON.parse(payload.toolInput);

        const service = await cds.connect.to("ORDAggregator");
        for (const entry of (await service.send("listAgentsCatalog")).catalog) {
            if (entry.agent.name === agentName) {
                const url = entry.agent.url;
                const response = await triggerA2A({ url, task });
                return { response };
            }
        }
        // curious if the Orchestrator will provide the correct Agent name
        throw new Error("Could not find an entry in the Agents Catalog for that Agent name.");
        
    };
}

const triggerA2A = async ({ url, task }: { url: string; task: string }): Promise<string> => {
    const client = new A2AClient(url);
    try {
        // Send a simple task (pass only params)
        const taskId = uuid();
        const sendParams: TaskSendParams = {
            id: taskId,
            message: { role: "user", parts: [{ text: task, type: "text" }] }
        };
        // Method now returns Task | null directly
        const taskResult: Task | null = await client.sendTask(sendParams);
        console.log("Send Task Result:", JSON.stringify(taskResult));

        // get artifact or messages result
        const artifactResult = (taskResult?.artifacts?.[0]?.parts?.[0] as TextPart).text;

        return artifactResult ? artifactResult : "No solution available with this tool, please try another.";
    } catch (error) {
        console.error("A2A Client Error:", error);
        return "No solution available with this tool, please try another.";
    }
};

// we won't make use of streaming in the beginning
const triggerA2AStreaming = async ({ url, task }: { url: string; task: string }): Promise<boolean> => {
    const client = new A2AClient(url);
    const streamingTaskId = uuid();
    try {
        console.log(`\n--- Starting streaming task ${streamingTaskId} ---`);
        // Construct just the params
        const streamParams: TaskSendParams = {
            id: streamingTaskId,
            message: { role: "user", parts: [{ text: task, type: "text" }] }
        };
        // Pass only params to the client method
        const stream = client.sendTaskSubscribe(streamParams);

        // Stream now yields the event payloads directly
        for await (const event of stream) {
            // Type guard to differentiate events based on structure
            if ("status" in event) {
                // It's a TaskStatusUpdateEvent
                const statusEvent = event as TaskStatusUpdateEvent; // Cast for clarity
                console.log(
                    `[${streamingTaskId}] Status Update: ${statusEvent.status.state} - ${
                        (statusEvent.status.message?.parts[0] as TextPart)?.text ?? "No message"
                    }`
                );
                if (statusEvent.final) {
                    console.log(`[${streamingTaskId}] Stream marked as final.`);
                    break; // Exit loop when server signals completion
                }
            } else if ("artifact" in event) {
                // It's a TaskArtifactUpdateEvent
                const artifactEvent = event as TaskArtifactUpdateEvent; // Cast for clarity
                console.log(
                    `[${streamingTaskId}] Artifact Update: ${
                        artifactEvent.artifact.name ?? `Index ${artifactEvent.artifact.index}`
                    } - Part Count: ${artifactEvent.artifact.parts.length}`
                );
                // Process artifact content (e.g., artifactEvent.artifact.parts[0].text)
            } else {
                console.warn("Received unknown event structure:", event);
            }
        }
        console.log(`--- Streaming task ${streamingTaskId} finished ---`);
        return true;
    } catch (error) {
        console.error(`Error during streaming task ${streamingTaskId}:`, error);
        return false;
    }
};
