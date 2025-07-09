import cds from "@sap/cds";
import { AgentClient, TokenFetching } from "./baf/AgentClient";
import { ExecutionEventBus, RequestContext, Task, TaskArtifactUpdateEvent, TaskState, TaskStatusUpdateEvent } from "@a2a-js/sdk";

export class BAFAgentClient {
    private tokenFetcher: TokenFetching;
    private agentClient: AgentClient;
    private agentId: string;

    constructor() {
        const baf = cds.env.requires.baf.credentials; // locally, bind baf before for this line to work
        const { clientid, clientsecret, url: tokenUrl } = baf.uaa;
        const apiUrl = baf.service_urls.agent_api_url
        this.agentId = baf.agentId;
        this.tokenFetcher = new TokenFetching(`${tokenUrl}/oauth/token`, clientid, clientsecret);
        this.agentClient = new AgentClient(this.tokenFetcher, apiUrl);
        
    }

    async invokeAgentSync(taskId: string, message: string) {
        const client = this.agentClient.createClient();
        const createChatResponse = await client.post<{ ID: string }>(`/api/v1/Agents(${this.agentId})/chats`, {
            name: taskId
        });
        const chatId = createChatResponse.data.ID;

        // Start chat and get historyId (needed for streaming)
        const startChatResponse = await client.post<{ historyId: string }>(
            `/api/v1/Agents(${this.agentId})/chats(${chatId})/UnifiedAiAgentService.sendMessage`,
            {
                msg: message,
                async: true
            }
        );
        return { chatId, historyId: startChatResponse.data.historyId };
    }

    async triggerStatusUpdate(task: Task, eventBus: ExecutionEventBus) {
        const {id: taskId, contextId, metadata} = task;
        const { chatId, historyId } = metadata as { chatId: string; historyId: string };
        
        const client = this.agentClient.createClient();
        while (true) {
            // GET TASK STATE
            const chat = await client.get<{
                state: string;
            }>(`/api/v1/Agents(${this.agentId})/chats(${chatId})?$select=state`);
            switch (chat.data.state) {
                case "none":
                    eventBus.publish(this.createStatusUpdateEvent("unknown" , taskId, contextId));
                    break;
                case "pending":
                    eventBus.publish(this.createStatusUpdateEvent("submitted" , taskId, contextId));
                    break;
                case "running":
                    const trace = await client.get(
                        `/api/v1/Agents(${this.agentId})/chats(${chatId})/history(${historyId})/trace` //?$filter=data/values/any(v: v/type eq 'agent')`
                    );
                    const agentTraces = trace?.data?.value
                    .filter((v: any) => v.type === "agent")
                    .map((v: any) => JSON.parse(v.data).thought)
                    .join(" ");
                    const workingStatusUpdate: TaskStatusUpdateEvent = {
                        kind: "status-update",
                        taskId: taskId,
                        contextId: contextId,
                        status: {
                            state: "working",
                            message: {
                                kind: "message",
                                role: "agent",
                                messageId: cds.utils.uuid(),
                                parts: [{ kind: "text", text: agentTraces || "No thoughts yet" }],
                                taskId: taskId,
                                contextId: contextId
                            },
                            timestamp: new Date().toISOString()
                        },
                        final: false
                    };
                    eventBus.publish(workingStatusUpdate);
                    break;
                case "success":
                    const successAnswers = await client.get<{
                        value: Array<{
                            content: string;
                        }>;
                    }>(
                        `/api/v1/Agents(${this.agentId})/chats(${chatId})/history?$filter=previous/ID eq ${historyId}`
                    );
                    const content = successAnswers.data.value.pop()?.content ?? "";
                    if (!content) throw new Error("Could not find response Message in Thread");

                    const artifactUpdate: TaskArtifactUpdateEvent = {
                        kind: "artifact-update",
                        taskId: taskId,
                        contextId: contextId,
                        artifact: {
                            artifactId: "artifact-1",
                            name: "artifact-1",
                            parts: [{ kind: "text", text: content }]
                        },
                        append: false,
                        lastChunk: true
                    };
                    eventBus.publish(artifactUpdate);

                    const finalUpdate: TaskStatusUpdateEvent = {
                        kind: "status-update",
                        taskId: taskId,
                        contextId: contextId,
                        status: {
                            state: "completed",
                            message: {
                                kind: "message",
                                role: "agent",
                                messageId: cds.utils.uuid(),
                                taskId: taskId,
                                contextId: contextId,
                                parts: []
                            },
                            timestamp: new Date().toISOString()
                        },
                        final: true
                    };
                    eventBus.publish(finalUpdate);
                    eventBus.finished();
                    return;
                    return;
                case "error":
                    eventBus.publish(this.createStatusUpdateEvent("failed" , taskId, contextId));
                    return;
            }
            // count how often state "unknown" and break after 60 seconds or 12 times
            await sleep(1500);
        }
        
    }

    createStatusUpdateEvent(state: TaskState, taskId: string, contextId: string): TaskStatusUpdateEvent {
       return {
            kind: "status-update",
                taskId,
                contextId,
                status: {
                    state,
                    timestamp: new Date().toISOString()
                },
                final: false 
        }
    }

    async getChat(chatId: string) {
        const client = this.agentClient.createClient();
        const chat = await client.get<{
            state: string;
        }>(`/api/v1/Agents(${this.agentId})/chats(${chatId})?$select=state`);
        return chat
    }
}

async function sleep(ms: number) {
    return await new Promise((resolve) => setTimeout(resolve, ms));
}