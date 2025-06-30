import os
import httpx
from starlette.applications import Starlette
from starlette.routing import Route
from starlette.responses import FileResponse, JSONResponse, PlainTextResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from a2a.server.apps import A2AStarletteApplication
from a2a.server.request_handlers import DefaultRequestHandler
from a2a.server.tasks import InMemoryPushNotifier, InMemoryTaskStore
from a2a.types import AgentCapabilities, AgentCard, AgentSkill
from adk_warehouse_agent_executor import AdkWarehouseAgentExecutor
from Warehouse_Insight_Agent.agent import root_agent as warehouse_adk_agent_instance


AGENT_NAME_CONFIG = "Warehouse_Insight_Agent"
AGENT_DESCRIPTION_CONFIG = getattr(warehouse_adk_agent_instance, 'description',
                                   "Warehouse Insight Agent handling data queries about shipping details.")
AGENT_VERSION_CONFIG = "0.0.1"
ORD_DOC_PATH = os.path.join(os.path.dirname(__file__), "ord.json")

def get_a2a_agent_card(public_base_url: str) -> AgentCard:
    capabilities = AgentCapabilities(streaming=False, pushNotifications=False)
    skill = AgentSkill(
        id="warehouse-insight-query",
        name="Warehouse Insight Query Tool",
        description=AGENT_DESCRIPTION_CONFIG,
        tags=["warehouse", "stock", "inventory", "data query", "shipping"],
        examples=[
            "why did the stock level for Item X drop this morning?",
            "which orders caused stock changes for Item Y in the last 24 hours?",
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
    agent_name_to_return = AGENT_NAME_CONFIG
    if hasattr(request.app.state, 'agent_card') and request.app.state.agent_card:
        agent_name_to_return = request.app.state.agent_card.name
    return JSONResponse({"status": "ok", "agent_name": agent_name_to_return})

async def root_test_endpoint(request):
    return PlainTextResponse("A2A Warehouse Insight Agent (ADK based) is alive!")

def create_app():
    """Creates and configures the Starlette application instance for Cloud Run."""

    public_base_url = os.getenv("SERVICE_URL")
    if not public_base_url:
        host = os.getenv("HOST", "localhost")
        port = os.getenv("PORT", "8080")
        scheme = "https" if host != "localhost" and host != "0.0.0.0" else "http" # Basic inference
        public_base_url = f"{scheme}://{host}:{port}"
        if host == "localhost" or host == "0.0.0.0": # Adjust for actual external access if local
             public_base_url = f"http://localhost:{port}" # Agent card URL for local test
    print(f"Determined public base URL for Agent Card: {public_base_url}")

    client_for_notifier = httpx.AsyncClient() # For InMemoryPushNotifier

    a2a_http_handler = DefaultRequestHandler(
        agent_executor=AdkWarehouseAgentExecutor(),
        task_store=InMemoryTaskStore(),
        push_notifier=InMemoryPushNotifier(client_for_notifier),
    )
    current_agent_card = get_a2a_agent_card(public_base_url="https://adk-agent-service-direct-395311854449.us-central1.run.app/") # hardcoded as quick fix;

    a2a_sdk_app_config = A2AStarletteApplication(
        agent_card=current_agent_card,
        http_handler=a2a_http_handler
    )
    starlette_app = a2a_sdk_app_config.build()
    starlette_app.state.agent_card = current_agent_card

    # Add custom routes
    custom_routes = [Route("/", endpoint=root_test_endpoint, methods=["GET"], name="root_test")]
    if os.path.exists(ORD_DOC_PATH):
        custom_routes.append(Route("/open-resource-discovery/v1/documents/1", endpoint=get_ord_document_route, methods=["GET"], name="ord_document"))
    custom_routes.append(Route("/check_agent", endpoint=health_check_route, methods=["GET"], name="health_check"))
    starlette_app.router.routes.extend(custom_routes)
    
    print(f"A2A Starlette application created for agent: {current_agent_card.name}. Listening for /tasks.")
    return starlette_app

app = create_app()
