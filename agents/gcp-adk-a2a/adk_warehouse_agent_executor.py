import asyncio
from uuid import uuid4
from google.adk import Runner
from google.adk.agents import Agent as ADKInternalAgent
from google.adk.events import Event as ADKEvent
from google.adk.sessions import Session as ADKSession
from google.adk.artifacts import InMemoryArtifactService
from google.adk.memory.in_memory_memory_service import InMemoryMemoryService
from google.adk.sessions import InMemorySessionService
from google.genai import types as genai_types
from Warehouse_Insight_Agent.agent import root_agent as warehouse_adk_agent
from a2a.server.agent_execution import AgentExecutor, RequestContext
from a2a.server.events.event_queue import EventQueue
from a2a.server.tasks import TaskUpdater
from a2a.types import Part as A2APart, TextPart as A2ATextPart, TaskState

def convert_adk_text_output_to_a2a_parts(adk_output_text: str) -> list[A2APart]:
    if isinstance(adk_output_text, str):
        return [A2APart(root=A2ATextPart(text=adk_output_text))]
    print(f"Warning: ADK output type for conversion: {type(adk_output_text)}. Wrapping as string.")
    return [A2APart(root=A2ATextPart(text=str(adk_output_text)))]

def convert_a2a_parts_to_genai_content(parts: list[A2APart]) -> genai_types.Content:
    genai_parts = []
    for part_wrapper in parts:
        part = part_wrapper.root
        if isinstance(part, A2ATextPart):
            genai_parts.append(genai_types.Part(text=part.text))
        else:
            print(f"Warning: Unsupported A2A part type for conversion to GenAI: {type(part)}")
    return genai_types.Content(parts=genai_parts, role="user")

class AdkWarehouseAgentExecutor(AgentExecutor):
    """
    AgentExecutor for the Warehouse_Insight_Agent.
    """
    def __init__(self):
        if not isinstance(warehouse_adk_agent, ADKInternalAgent):
            raise TypeError("warehouse_adk_agent is not a valid Google ADK Agent instance.")
        self._agent: ADKInternalAgent = warehouse_adk_agent
        self.runner = Runner(
            app_name=self._agent.name or "warehouse_insight_runner",
            agent=self._agent,
            artifact_service=InMemoryArtifactService(),
            session_service=InMemorySessionService(),
            memory_service=InMemoryMemoryService(),
        )
        print(f"AdkWarehouseAgentExecutor initialized for ADK agent: {self._agent.name}")

    def _get_or_create_adk_session(self, a2a_context_id: str) -> ADKSession:
        app_name = self.runner.app_name
        user_id = "a2a_user" # Fixed user_id
        session = self.runner.session_service.get_session(
            app_name=app_name, user_id=user_id, session_id=a2a_context_id
        )
        if not session:
            # print(f"Creating new ADK session for A2A context ID: {a2a_context_id}")
            session = self.runner.session_service.create_session(
                app_name=app_name, user_id=user_id, session_id=a2a_context_id
            )
        return session

    async def execute(
        self,
        context: RequestContext,
        event_queue: EventQueue,
    ) -> None:
        if not context.message:
            print("ADK Executor Error: No message in A2A context.")
            if context.current_task:
                TaskUpdater(event_queue, context.task_id, context.context_id).failed("Error: No input message.")
            return

        user_query_text = context.get_user_input()
        if not user_query_text:
            print("ADK Executor Error: No text input in A2A message.")
            if context.current_task:
                TaskUpdater(event_queue, context.task_id, context.context_id).failed("Error: No text input.")
            return

        updater = TaskUpdater(event_queue, context.task_id, context.context_id)
        if not context.current_task:
            updater.submit()
        updater.start_work()
        print(f"ADK Exec: Task {context.task_id} query: \"{user_query_text[:60]}...\"")

        try:
            adk_session = self._get_or_create_adk_session(context.context_id)
            adk_user_message = convert_a2a_parts_to_genai_content(context.message.parts)

            final_adk_event_content: genai_types.Content | None = None
            intermediate_update_sent = False

            async for adk_event in self.runner.run_async(
                session_id=adk_session.id,
                user_id=adk_session.user_id,
                new_message=adk_user_message,
            ):
                if adk_event.is_final_response():
                    final_adk_event_content = adk_event.content
                    break
                elif adk_event.content and adk_event.content.parts and not intermediate_update_sent:
                    updater.update_status(TaskState.working, message=updater.new_agent_message(
                        convert_adk_text_output_to_a2a_parts("Agent is thinking..."))
                    )
                    intermediate_update_sent = True
            
            final_agent_output_text = ""
            if final_adk_event_content and final_adk_event_content.parts:
                final_text_parts = [p.text for p in final_adk_event_content.parts if hasattr(p, 'text') and p.text]
                final_agent_output_text = "\n".join(final_text_parts).strip()
                if not final_agent_output_text:
                    if len(final_adk_event_content.parts) == 1:
                        single_part = final_adk_event_content.parts[0]
                        if hasattr(single_part, 'function_response'):
                            fn_resp = single_part.function_response
                            if fn_resp.name == warehouse_adk_agent.tools[0].name: # warehouse_insights
                                if isinstance(fn_resp.response, dict) and "result" in fn_resp.response:
                                    final_agent_output_text = fn_resp.response["result"]
                                else:
                                    final_agent_output_text = str(fn_resp.response)
                        elif hasattr(single_part, 'text') and single_part.text: # Fallback if it was text after all
                             final_agent_output_text = single_part.text
                
            if final_agent_output_text:
                print(f"ADK Exec: Task {context.task_id} completed. Output: '{final_agent_output_text[:100]}...'")
                a2a_response_parts = convert_adk_text_output_to_a2a_parts(final_agent_output_text)
                updater.add_artifact(parts=a2a_response_parts, name="warehouse_insight_response")
                updater.complete(message_text="Warehouse insight ready.")
            else:
                print(f"ADK Exec Error: No final output from ADK agent for task {context.task_id}.")
                updater.failed("Agent did not produce a final output.")

        except Exception as e:
            print(f"ADK Exec Error: Exception for task {context.task_id}: {str(e)}")
            updater.failed(f"An unexpected error occurred: {str(e)}")

    async def cancel(self, context: RequestContext, event_queue: EventQueue) -> None:
        print(f"ADK Exec: Cancel requested for task {context.task_id}, marking as CANCELED.")
        TaskUpdater(event_queue, context.task_id, context.context_id).update_status(
            TaskState.canceled, final=True, message_text="Task cancellation requested."
        )