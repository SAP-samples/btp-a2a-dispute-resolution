from typing import TypedDict
from langgraph.graph import StateGraph, END
from AzureAgent.agent import agent_executor

class SimpleAgentState(TypedDict):
    input: str
    agent_output: str | None


def run_agent_executor_node(state: SimpleAgentState):
    """Runs the pre-configured AgentExecutor with the input from the state."""
    
    user_input = state.get("input")
    if not user_input:
        raise ValueError("Input not found in state for AgentExecutor node.")

    result_dict = agent_executor.invoke({"input": user_input})

    final_output = result_dict.get("output", "Error: AgentExecutor did not return an 'output' key.")

    return {"agent_output": final_output}

graph_builder = StateGraph(SimpleAgentState)
graph_builder.add_node("agent_executor_node", run_agent_executor_node)
graph_builder.set_entry_point("agent_executor_node")
graph_builder.add_edge("agent_executor_node", END)

app = graph_builder.compile()