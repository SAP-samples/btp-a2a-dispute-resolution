import {
    AgentExecutor,
    ExecutionEventBus,
    RequestContext,
    TextPart,
    Task,
    TaskStatusUpdateEvent
} from "@a2a-js/sdk";

import { BAFAgentClient } from "./BafAgentClient"

export class BAFAgentExecutor implements AgentExecutor {
    private cancelledTasks = new Set<string>();

    public cancelTask = async (taskId: string, eventBus: ExecutionEventBus): Promise<void> => {
        this.cancelledTasks.add(taskId);
    };

    async execute(requestContext: RequestContext, eventBus: ExecutionEventBus): Promise<void> {
        const userMessage = requestContext.userMessage;
        let existingTask = requestContext.task;

        // Determine IDs for the task and context, from requestContext.
        const taskId = requestContext.taskId;
        const contextId = requestContext.contextId;
        const bafAgentClient = new BAFAgentClient();

        console.log(
            `[BAFAgentExecutor] Processing message ${userMessage.messageId} for task ${taskId} (context: ${contextId})`
        );

        // 1. Publish initial Task event if it's a new task
        if (!existingTask) {
            const message = (requestContext.userMessage.parts[0] as TextPart).text;
            const { chatId, historyId } = await bafAgentClient.invokeAgentSync(taskId, message) 
            if (chatId && historyId) {
                const initialTask: Task = {
                    kind: "task",
                    id: taskId,
                    contextId: contextId,
                    status: {
                        state: "submitted",
                        timestamp: new Date().toISOString()
                    },
                    history: [userMessage],
                    metadata: {
                        chatId: chatId, 
                        historyId,
                        ...userMessage.metadata},
                    artifacts: [] // Initialize artifacts array
                };
                eventBus.publish(initialTask);
                existingTask = initialTask;
            } else {
                throw new Error("Failed to invoke Baf Agent");
            }
        }

        // Check for request cancellation
        if (this.cancelledTasks.has(taskId)) {
            console.log(`[MyAgentExecutor] Request cancelled for task: ${taskId}`);
            const cancelledUpdate: TaskStatusUpdateEvent = {
                kind: "status-update",
                taskId: taskId,
                contextId: contextId,
                status: {
                    state: "canceled",
                    timestamp: new Date().toISOString()
                },
                final: true
            };
            eventBus.publish(cancelledUpdate);
            eventBus.finished();
            return;
        }
        const { chatId, historyId } = existingTask.metadata as { chatId: string; historyId: string };
        if (chatId && historyId) {
            await bafAgentClient.triggerStatusUpdate(existingTask, eventBus);
        }
    }
}   