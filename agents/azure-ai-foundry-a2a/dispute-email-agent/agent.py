# Agent for single invocation scenario

import os
from dotenv import load_dotenv
from langchain_openai import AzureChatOpenAI
from langchain.agents import AgentExecutor, create_tool_calling_agent
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.tools import tool

load_dotenv()

llm = AzureChatOpenAI(
    azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"),
    openai_api_key=os.getenv("AZURE_OPENAI_API_KEY"),
    deployment_name=os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME"),
    openai_api_version=os.getenv("AZURE_OPENAI_API_VERSION"),
)

@tool
def dispute_resolution_plan_tool(dispute_input: str) -> str:
    """
    Dispute Resolution Plan Tool: Constructs an email response for a customer dispute.
    Use this tool when a customer has raised a dispute regarding specific order.
    Input will be a customer email and additional analysis to do with that order
    Response will be a well-structured email addressing the customer's concerns.
    """

    # This tool returns an instruction to the Agent
    instruction_prompt= """You are a helpful agent responsible for handling dispute-case related cases. 
    Your task is to analyze the dispute which could be in the form of mail, understand the related analysis 
    which will also be provided to you and provide a clear and brief email response. You would need to manage 
    disputes and and in case deemed fit, you can offer a resolution to the customer which could be a
    credit for the missing items.

    Example: ---------------------------------

    INPUT MAIL: <similar information will be given to you>
    
    Dear Customer Service,
    I am writing to express my concern regarding my recent order with ID ORD123.
    I received the shipment today, but I noticed that some items were missing.
    I ordered 100 laptops, but only 95 were delivered. Please look into the matter 
    and let me know how we can resolve this issue.
    
    Thank you,
    ABC
    
    
    ANALYSIS: <similar information will be given to you>
    The order ID ORD123 was checked in the warehouse system and it was found that 100 laptops were ordered.
    However, during the shipment process, 5 laptops were damaged and could not be shipped.
    
    
    EXPECTED OUTPUT:
    Dear Customer,
    Thank you for reaching out to us regarding your recent order with ID ORD123.
    We apologize for the inconvenience caused by the missing items in your shipment.
    Upon reviewing your order, we found that 100 laptops were indeed ordered, but unfortunately, 
    5 of them were damaged during the shipment process.
    
    As per company policy, we will issue a credit for the 5 missing laptops to your account.
    You can use this credit for your next purchase.
    
    Thanks & Regards,
    XYZ,
    Customer Service Team
    ---------------------------
    
    Now it is important for you to note that despite you not having access to the actual policy,
    YOU MUST always point out that the resolution is based on the company policy
    and use the phrase "As per company policy" in your response. The resolution SHOULD always be by issuing
    a credit to the customer for the missing items.
    
    Also, you must always give a response email, and NEVER ask the user for any follow up or additional information.
    Utilize the information provided in the dispute input and the analysis to create a complete email response.
    The email should be clear, professional, and empathetic. 

    """
    
    plan = f"""{instruction_prompt}. Here is the dispute input mail: {dispute_input}."""
    print(f"--- Tool execution finished ---")
    return plan

tools_list = [dispute_resolution_plan_tool]

prompt = ChatPromptTemplate.from_messages([
    ("system", "You are a helpful assistant specializing in dispute resolution. You have access to a tool that can create dispute resolution response email. Use it when asked for a response to a dispute case."),
    ("human", "{input}"),
    ("placeholder", "{agent_scratchpad}"),
    MessagesPlaceholder(variable_name="agent_scratchpad")
])

agent_runnable = create_tool_calling_agent(llm, tools_list, prompt)

agent_executor = AgentExecutor(agent=agent_runnable, tools=tools_list, verbose=True)