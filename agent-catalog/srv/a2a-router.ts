import cds from "@sap/cds";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import {
    Message,
    MessageSendParams,
    Task,
    TaskQueryParams,
    SendMessageResponse,
    GetTaskResponse,
    SendMessageSuccessResponse,
    GetTaskSuccessResponse,
    A2AClient,
    TextPart
} from "@a2a-js/sdk";
import { A2AClient as A2AClientDeprecated } from "./vendor/a2a/client/client.js";
import { Task as TaskDeprecated, TaskSendParams, TextPart as TextPartDeprecated } from "./vendor/a2a/schema.js";
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
                if (url.includes("hana.ondemand")) {
                    // workaround for now since BAF-wrapper uses deprecated A2A Server implementation
                    const response = await triggerA2ADeprecated({ url, task });
                    return { response };
                } else {
                    const response = await triggerA2A({ url, task });
                    return { response };
                }
            }
        }
        // curious if the Orchestrator will provide the correct Agent name
        throw new Error("Could not find an entry in the Agents Catalog for that Agent name.");
    };
}

const triggerA2A = async ({ url, task }: { url: string; task: string }): Promise<string> => {
    const messageId = uuid();
    const client = new A2AClient(url);
    let taskId: string | undefined;

    try {
        // 1. Send a message to the agent.
        const sendParams: MessageSendParams = {
            message: {
                messageId: messageId,
                role: "user",
                parts: [{ kind: "text", text: task }],
                kind: "message"
            },
            configuration: {
                blocking: true,
                acceptedOutputModes: ["text/plain"]
            }
        };

        const sendResponse: SendMessageResponse = await client.sendMessage(sendParams);
        //@ts-ignore
        if (sendResponse.error) {
            //@ts-ignore
            console.error("Error sending message:", sendResponse.error);
            return;
        }

        // On success, the result can be a Task or a Message. Check which one it is.
        const result = (sendResponse as SendMessageSuccessResponse).result;

        if (result.kind === "task") {
            // The agent created a task.
            const taskResult = result as Task;
            console.log("Send Message Result (Task):", taskResult);
            taskId = taskResult.id; // Save the task ID for the next call
        } else if (result.kind === "message") {
            // The agent responded with a direct message.
            const messageResult = result as Message;
            console.log("Send Message Result (Direct Message):", messageResult);
            // No task was created, so we can't get task status.
        }

        // 2. If a task was created, get its status.
        if (taskId) {
            const getParams: TaskQueryParams = { id: taskId };
            const getResponse: GetTaskResponse = await client.getTask(getParams);
            //@ts-ignore
            if (getResponse.error) {
                //@ts-ignore
                console.error(`Error getting task ${taskId}:`, getResponse.error);
                return;
            }

            const getTaskResult = (getResponse as GetTaskSuccessResponse).result;
            console.log("Get Task Result:", getTaskResult);

            const artifactResult = (getTaskResult?.artifacts?.[0]?.parts?.[0] as TextPart).text;
            return artifactResult || "No solution available with this tool, please try another.";
        }
    } catch (error) {
        console.error("A2A Client Communication Error:", error);
        return "No solution available with this tool, please try another.";
    }
};

const triggerA2ADeprecated = async ({ url, task }: { url: string; task: string }): Promise<string> => {
    const client = new A2AClientDeprecated(url);
    try {
        // Send a simple task (pass only params)
        const taskId = uuid();
        const sendParams: TaskSendParams = {
            id: taskId,
            message: { role: "user", parts: [{ text: task, type: "text" }] }
        };
        // Method now returns Task | null directly
        const taskResult: TaskDeprecated | null = await client.sendTask(sendParams);
        console.log("Send Task Result:", JSON.stringify(taskResult));

        // get artifact or messages result
        const artifactResult = (taskResult?.artifacts?.[0]?.parts?.[0] as TextPartDeprecated).text;

        return artifactResult ? artifactResult : "No solution available with this tool, please try another.";
    } catch (error) {
        console.error("A2A Client Error:", error);
        return "No solution available with this tool, please try another.";
    }
};
