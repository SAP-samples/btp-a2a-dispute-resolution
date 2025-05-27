import cds from "@sap/cds";
import { A2AService } from "./cap/A2AService";
import { a2aServer } from "./server";
import { TaskContext, TaskYieldUpdate } from "./vendor/a2a/server/handler";
import { AgentClient, TokenFetching } from "./vendor/baf/AgentClient";

export default class A2AServerService extends A2AService {
    async init() {
        super.init();
        this.a2aServer = a2aServer;
        this.registerTaskHandler(bafAgentLogic);
    }
}

async function* bafAgentLogic(context: TaskContext): AsyncGenerator<TaskYieldUpdate> {
    console.log(`Handling task: ${context.task.id}`);
    // CHECK IF TASK IS CANCELLED
    if (context.isCancelled()) {
        console.log("Task cancelled!");
        yield { state: "canceled" };
        return;
    }

    const baf = cds.env.requires.baf.credentials; // locally, bind baf before for this line to work
    const { clientid, clientsecret, url: tokenUrl } = baf.uaa;
    const tokenFetcher = new TokenFetching(`${tokenUrl}/oauth/token`, clientid, clientsecret);
    const agentClient = new AgentClient(tokenFetcher, baf.service_urls.agent_api_url);
    const client = agentClient.createClient();

    const AGENT_ID = baf.agentId;

    // START THE TASK
    if (!context.task.metadata?.chatId) {
        // Create chat
        const createChatResponse = await client.post<{ ID: string }>(`/api/v1/Agents(${AGENT_ID})/chats`, {
            name: context.task.id
        });
        const chatId = createChatResponse.data.ID;

        // Start chat and get historyId (needed for streaming)
        const startChatResponse = await client.post<{ historyId: string }>(
            `/api/v1/Agents(${AGENT_ID})/chats(${chatId})/UnifiedAiAgentService.sendMessage`,
            {
                // @ts-ignore => for now assume the user triggers an agent with TextPart only
                msg: context.userMessage.parts[0].text,
                async: true
            }
        );

        yield {
            state: "submitted",
            message: {
                role: "agent",
                parts: [
                    {
                        text: `Submitted Task ${context.task.id} which started Chat ${chatId}`,
                        type: "text"
                    }
                ]
            },
            metadata: {
                chatId: chatId,
                firstMessageHistoryId: startChatResponse.data.historyId
            }
        };
    }

    while (true) {
        // GET TASK STATE
        const chat = await client.get<{
            state: string;
        }>(`/api/v1/Agents(${AGENT_ID})/chats(${context.task.metadata.chatId})?$select=state`);
        switch (chat.data.state) {
            case "none":
                yield {
                    state: "unknown",
                    message: {
                        role: "agent",
                        parts: [{ text: `No BAF chat started for Task ${context.task.id}`, type: "text" }]
                    }
                };
                break;
            case "pending":
                yield {
                    state: "submitted",
                    message: {
                        role: "agent",
                        parts: [{ text: `Task ${context.task.id} submitted and pending!`, type: "text" }]
                    }
                };
                break;
            case "running":
                const trace = await client.get(
                    `/api/v1/Agents(${AGENT_ID})/chats(${context.task.metadata.chatId})/history(${context.task.metadata.firstMessageHistoryId})/trace` //?$filter=data/values/any(v: v/type eq 'agent')`
                );

                const agentTraces = trace?.data?.value
                    .filter((v: any) => v.type === "agent")
                    .map((v: any) => JSON.parse(v.data).thought)
                    .join(" ");
                yield {
                    state: "working",
                    message: {
                        role: "agent",
                        parts: [
                            {
                                text: `Task ${context.task.id} working: ${agentTraces || "No thoughts yet"}`,
                                type: "text"
                            }
                        ]
                    }
                };
                break;
            case "success":
                const successAnswers = await client.get<{
                    value: Array<{
                        content: string;
                    }>;
                }>(
                    `/api/v1/Agents(${AGENT_ID})/chats(${context.task.metadata.chatId})/history?$filter=previous/ID eq ${context.task.metadata.firstMessageHistoryId}`
                );
                const content = successAnswers.data.value.pop().content;
                yield {
                    state: "completed",
                    parts: [{ text: content, type: "text" }],
                    message: {
                        role: "agent",
                        parts: [
                            {
                                text: `Task ${context.task.id} done: ${content}`,
                                type: "text"
                            }
                        ]
                    }
                };
                return;
            case "error":
                yield {
                    state: "failed",
                    message: { role: "agent", parts: [{ text: `Task ${context.task.id} failed!`, type: "text" }] }
                };
                return;
            default:
                yield {
                    state: "unknown",
                    message: {
                        role: "agent",
                        parts: [{ text: `Task ${context.task.id} in unkown state!`, type: "text" }]
                    }
                };
                break;
        }
        // count how often state "unknown" and break after 60 seconds or 12 times
        await sleep(5000);
    }
}

// 1. Define your agent's logic as a TaskHandler
async function* myAgentLogic(context: TaskContext): AsyncGenerator<TaskYieldUpdate> {
    console.log(`Handling task: ${context.task.id}`);
    yield {
        state: "working",
        message: { role: "agent", parts: [{ text: "Processing...", type: "text" }] }
    };

    // Simulate work...
    await new Promise((resolve) => setTimeout(resolve, 1000));

    if (context.isCancelled()) {
        console.log("Task cancelled!");
        yield { state: "canceled" };
        return;
    }

    // Yield an artifact
    yield {
        name: "result.txt",
        //mimeType: "text/plain",
        parts: [{ text: `Task ${context.task.id} completed.`, type: "text" }]
    };

    // Yield final status
    yield {
        state: "completed",
        message: { role: "agent", parts: [{ text: "Done!", type: "text" }] }
    };
}

async function sleep(ms: number) {
    return await new Promise((resolve) => setTimeout(resolve, ms));
}
