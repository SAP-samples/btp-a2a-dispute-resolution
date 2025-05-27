import uvicorn
import os
import httpx
from starlette.routing import Route
from starlette.responses import FileResponse, JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from a2a.server.apps import A2AStarletteApplication
from a2a.server.request_handlers import DefaultRequestHandler
from a2a.server.tasks import InMemoryPushNotifier, InMemoryTaskStore
from a2a.types import AgentCapabilities, AgentCard, AgentSkill
from langgraph_agent_executor import LangGraphAgentExecutor

AGENT_NAME_CONFIG = "Dispute_Email_Agent"
AGENT_DESCRIPTION_CONFIG = "Analyzes dispute and using provided additional information, drafts a response email."
AGENT_VERSION_CONFIG = "0.0.1"
ORD_DOC_PATH = os.path.join(os.path.dirname(__file__), "ord.json")

def get_agent_card(public_base_url: str) -> AgentCard:
    capabilities = AgentCapabilities(streaming=False, pushNotifications=False)
    skill = AgentSkill(
        id="dispute_email_generation",
        name="Dispute Email Generation Tool",
        description="Generates an email response for a given dispute shared by a customer.",
        tags=["dispute resolution", "customer service", "dispute email", "email generation"],
        examples=[
            "Generate a response for dispute by Customer CUST001, order ORD0001, where only 90 of the ordered 100 items were delivered.",
        ],
    )
    return AgentCard(
        name=AGENT_NAME_CONFIG,
        description=AGENT_DESCRIPTION_CONFIG,
        url=f'{public_base_url.rstrip("/")}/',
        version=AGENT_VERSION_CONFIG,
        defaultInputModes=['text/plain'],
        defaultOutputModes=['text/plain'],
        capabilities=capabilities,
        skills=[skill],
    )

async def get_ord_document_route(request):
    if not os.path.exists(ORD_DOC_PATH):
        print(f"Error: ORD document not found at {ORD_DOC_PATH}")
        raise StarletteHTTPException(status_code=404, detail="ORD document not found.")
    return FileResponse(ORD_DOC_PATH, media_type="application/json")

async def health_check_route(request):
    if hasattr(request.app.state, 'agent_card'):
        agent_card_instance = request.app.state.agent_card
        return JSONResponse({"status": "ok", "agent_name": agent_card_instance.name})
    else:
        return JSONResponse({"status": "ok", "agent_name": AGENT_NAME_CONFIG + "Card not present"})


def create_app():
    """Creates and configures the Starlette application instance."""
    
    PORT = 8000
    
    base_url = f"http://localhost:{PORT}"

    client_for_notifier = httpx.AsyncClient()

    request_handler = DefaultRequestHandler(
        agent_executor=LangGraphAgentExecutor(),
        task_store=InMemoryTaskStore(),
        push_notifier=InMemoryPushNotifier(client_for_notifier),
    )

    current_agent_card = get_agent_card(public_base_url=base_url)

    a2a_server_app_sdk = A2AStarletteApplication(
        agent_card=current_agent_card,
        http_handler=request_handler
    )

    starlette_app_instance = a2a_server_app_sdk.build()
    starlette_app_instance.state.agent_card = current_agent_card

    starlette_app_instance.routes.extend([
        Route("/open-resource-discovery/v1/documents/1", endpoint=get_ord_document_route, methods=["GET"], name="ord_document"),
        Route("/check_agent", endpoint=health_check_route, methods=["GET"], name="health_check")
    ])
    
    print(f"A2A Starlette application created for agent: {current_agent_card.name}")
    return starlette_app_instance

app = create_app()

# if __name__ == '__main__':
#     uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True) # Local testing only
    