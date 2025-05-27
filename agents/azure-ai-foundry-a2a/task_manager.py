import uuid
from typing import Any
from a2a_types import Task, TaskSendParams, TaskStatus, Artifact, TextPart, Message # Message will be needed to send task package

class TaskProcessingError(Exception):
    """Custom exception for errors during task processing."""
    
    def __init__(self, message="Error processing task"):
        self.message = message
        super().__init__(self.message)

class TaskManager:
    """Handles the processing of an A2A task by interacting with an agent logic."""
    
    def __init__(self, agent_invoker: Any):
        
        if not hasattr(agent_invoker, 'invoke') or not callable(agent_invoker.invoke):
            raise TypeError("agent_invoker must have a callable 'invoke' method")
        self.agent_invoker = agent_invoker

    def process_task(self, task_params: TaskSendParams) -> Task:
        """Processes the task defined by task_params using the agent_invoker."""
        try:
            if not task_params.message or not task_params.message.parts or not isinstance(task_params.message.parts[0], TextPart):
                raise TaskProcessingError("Invalid task input: requires message with a text part.")
            user_input_text = task_params.message.parts[0].text

            agent_input_state = {"input": user_input_text}
            agent_result_state = self.agent_invoker.invoke(agent_input_state)

            agent_output_text = agent_result_state.get("agent_output")
            if agent_output_text is None:
                raise TaskProcessingError("Agent did not produce expected 'agent_output'.")

            response_task = Task(
                id=task_params.id, # Echo back the task ID from params
                sessionId=str(uuid.uuid4()), # Generate a unique session ID
                status=TaskStatus(state="COMPLETED"),
                artifacts=[
                    Artifact(
                        # Optional: Make artifact name configurable or generic?
                        name="agent_response",
                        parts=[TextPart(text=agent_output_text)]
                    )
                ],
            )
            return response_task

        except Exception as e:
            raise TaskProcessingError(f"Failed during task processing: {str(e)}") from e