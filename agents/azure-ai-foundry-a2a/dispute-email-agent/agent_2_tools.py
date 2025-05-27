## Agent for multiple invocation scenario 

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
def policy_lookup_tool(dispute_description: str) -> str:
    """
    Policy Lookup Tool: Constructs an instruction for the agent to generate a step-by-step resolution plan for a given dispute.
    Use this tool when a plan is needed to address a customer dispute (e.g., missing items, incorrect shipment).
    Input must be a clear string describing the customer's dispute.
    The tool's output will guide the agent in creating a plan.
    """
    
    prompt_for_agent_to_generate_plan = f"""
        You are tasked with generating a clear, step-by-step resolution plan for the following dispute.
        The plan should specify if at all any other specialized agents should be involved.
        You should not ask for any additional information from the user.
        The plan could be detailed but actionable and easy to follow.

        --- Example of Expected Plan Format ---
        If the dispute was: "Customer with ID CUST0001 claims that their order with ID ORD0001 has some missing items that were not included in the shipment."
        A good plan would be:
        1. Send the order ID ORD0001 to a specialized agent to verify how many items were ordered for customer CUST0001 and how many were actually delivered.
        2. Based on the specialized agent’s response, determine if the correct number of items was shipped.
        3. Depending on the investigation outcome, decide on the appropriate action: either reship the missing items or issue a credit to customer CUST0001.
        --- End Example Plan Format ---

        Remember, do not ask user for any follow up, and ry to come up with a plan with whatever information is made available.
        Now, using the 'Dispute Details Provided' below, generate the specific resolution plan:
        Dispute Details Provided:
        '{dispute_description}'
    """
    
    return prompt_for_agent_to_generate_plan


@tool
def email_response_tool(resolution_and_dispute_details: str) -> str:
    """
    Email Response Tool: Constructs an instruction for the agent to draft a professional email response to a customer.
    Use this tool AFTER a dispute has been investigated and a resolution has been decided.
    Input must be a clear string containing the resolution details and any relevant information about the dispute.
    The tool's output will be a well-structured email.
    """
    
    prompt_for_agent_to_generate_email = f"""
        You are tasked with drafting a professional and empathetic email to a customer regarding their dispute resolution.
        The email should clearly communicate the situation and the decided resolution.
        Remember to not ask any follow up to the user, and try to come up with a complete email with whatever information is made available.

        --- Example Email Structure ---
        Subject: Regarding your inquiry - Order [Order ID]

        Dear [Customer Name],

        Thank you for reaching out to us regarding [briefly mention issue, Order ID, etc. - some relevant identification information"].

        We have reviewed your concern. [Briefly state findings"].
        As a resolution, we will be [clearly state the resolution"].

        Should you have any further questions or require additional assistance, please do not hesitate to contact us on our support email.

        Sincerely,
        [Company Name]
        --- End Example Email Structure ---

        Use the following information to draft the email:
        '{resolution_and_dispute_details}'
    """
    
    return prompt_for_agent_to_generate_email

tools_list = [policy_lookup_tool, email_response_tool]

# System prompt for the Dispute Email Agent
SYSTEM_PROMPT = """You are the "Dispute Email Agent". Your primary role is to assist with customer disputes by generating resolution plans and drafting email communications.

You have access to the following tools:
1.  `policy_lookup_tool`:
    -   Use this tool when you receive a new dispute and need to create a step-by-step resolution plan.
    -   This tool is named "Policy Lookup Tool" but its function is to help you create a plan for action as there is no policy document as of now.

2.  `email_response_tool`:
    -   Use this tool AFTER a dispute has been investigated and a resolution has been decided, and you are asked to draft an email to the customer.

Your main tasks are:
-   If asked to create a plan for a dispute: Use `policy_lookup_tool`.
-   If asked to draft an email about a resolved dispute: Use `email_response_tool`.

Always follow the instructions returned by the tools precisely to generate the required output (either a plan or an email).
"""

prompt = ChatPromptTemplate.from_messages([
    ("system", SYSTEM_PROMPT),
    ("human", "{input}"),
    ("placeholder", "{agent_scratchpad}"),
    MessagesPlaceholder(variable_name="agent_scratchpad")
])

agent_runnable = create_tool_calling_agent(llm, tools_list, prompt)

agent_executor = AgentExecutor(agent=agent_runnable, tools=tools_list, verbose=True)