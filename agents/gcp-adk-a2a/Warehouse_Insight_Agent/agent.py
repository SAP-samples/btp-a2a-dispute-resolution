from google.adk.agents import Agent
from Warehouse_Insight_Agent.instructions import data_agent_instructions
from Warehouse_Insight_Agent.data_query_tool import warehouse_insights

root_agent = Agent(
    name="Warehouse_Insight_Agent",
    model="gemini-2.0-flash",
    description="Tracks stock movements across the warehouse and their causes in real-time.",
    instruction=data_agent_instructions,
    tools=[warehouse_insights],
)