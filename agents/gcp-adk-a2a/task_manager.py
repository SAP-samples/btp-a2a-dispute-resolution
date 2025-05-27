import uuid
from typing import Optional

# Import necessary ADK components
from google.adk.agents import Agent # Base agent type
from google.adk.runners import Runner
from google.adk.artifacts import InMemoryArtifactService
from google.adk.sessions import InMemorySessionService
from google.adk.memory.in_memory_memory_service import InMemoryMemoryService
from google.genai import types as genai_types # Use alias to avoid conflicts

from a2a_types import Task, TaskSendParams, TaskStatus, Artifact, TextPart, Message # Message is needed to send tasks

class TaskProcessingError(Exception):
    """Custom exception for errors during task processing."""

    def __init__(self, message="Error processing task"):
        self.message = message
        super().__init__(self.message)

class TaskManager:
    """Handles A2A tasks by interacting with a Google ADK Agent instance."""

    def __init__(self, adk_agent: Agent):
        if not isinstance(adk_agent, Agent):
            raise TypeError("agent_invoker must be an instance of google.adk.agents.Agent")
        self.adk_agent = adk_agent
        self.user_id = "a2a_user" # Fixed ID for simplicity
        self._runner = Runner(
            app_name=self.adk_agent.name or "adk_agent",
            agent=self.adk_agent,
            artifact_service=InMemoryArtifactService(),
            session_service=InMemorySessionService(),
            memory_service=InMemoryMemoryService(),
        )


    def _get_or_create_session(self, session_id_hint: Optional[str] = None):
        """Gets or creates an ADK session."""

        # This session_id is for ADK internal tracking. It uses the hint if available.
        adk_internal_session_id = session_id_hint or f"session_{str(uuid.uuid4())}"
        session = self._runner.session_service.get_session(
            app_name=self._runner.app_name, user_id=self.user_id, session_id=adk_internal_session_id
        )
        if session is None:
            session = self._runner.session_service.create_session(
                app_name=self._runner.app_name,
                user_id=self.user_id,
                state={},
                session_id=adk_internal_session_id,
            )
        return session

    def process_task(self, task_params: TaskSendParams) -> Task:
        """Processes the task using the ADK Runner."""

        adk_session_obj = None # Renamed variable for clarity
        try:
            if not task_params.message or not task_params.message.parts or not isinstance(task_params.message.parts[0], TextPart):
                raise TaskProcessingError("Invalid task input: requires message with a text part.")
            user_input_text = task_params.message.parts[0].text

            # ADK session uses task_params.id as a hint for *its* internal ID
            adk_session_obj = self._get_or_create_session(session_id_hint=task_params.id)

            adk_content = genai_types.Content(
                role="user", parts=[genai_types.Part.from_text(text=user_input_text)]
            )

            events = list(self._runner.run(
                user_id=self.user_id, session_id=adk_session_obj.id, new_message=adk_content
            ))

            if not events or not events[-1].content or not events[-1].content.parts:
                raise TaskProcessingError("Agent did not produce a text response.")

            agent_output_text = "\n".join([p.text for p in events[-1].content.parts if hasattr(p, 'text') and p.text])

            response_task = Task(
                id=task_params.id,      
                sessionId=str(uuid.uuid4()),
                status=TaskStatus(state="COMPLETED"),
                artifacts=[
                    Artifact(
                        name="adk_agent_response",
                        parts=[TextPart(text=str(agent_output_text))]
                    )
                ],
            )
            return response_task

        except Exception as e:
            raise TaskProcessingError(f"Failed during task processing: {str(e)}") from e