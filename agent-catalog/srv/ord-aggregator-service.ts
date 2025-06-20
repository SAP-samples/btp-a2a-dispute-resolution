import cds from "@sap/cds";
import { CallbackResponse, MetadataRequest, MetadataResponse } from "./types";

const ORD_DOCUMENT_PATH = "/open-resource-discovery/v1/documents/1";

const { AGENT_BUILDER_AGENT_CONNECTOR_HOST, GCP_AGENT_HOST, AZURE_AGENT_HOST } = cds.env.requires.credentials;
const ORDPointers = [
    {
        ID: "a8a630f8-cbca-4037-991b-bfb84899817d",
        host: AGENT_BUILDER_AGENT_CONNECTOR_HOST,
        provider: "SAP",
    },
    {
        ID: "6439ec3e-2d44-4c23-9f7f-2df4c57be793",
        host: GCP_AGENT_HOST,
        provider: "Google"
    },
    {
        ID: "53a2636a-bbc4-4c04-ba24-4adc2381bb36",
        host: AZURE_AGENT_HOST,
        provider: "Microsoft"
    }
];

export default class ORDAggregator extends cds.ApplicationService {
    private readonly log = cds.log("ORDAggregator");

    async init(): Promise<void> {
        this.log.info("init ORD aggregator service");
        await super.init();
        this.on("listAgentsCatalog", this.listAgentsCatalog);
        this.on("metadata", this.onMetadata);
        this.on("callback", this.onCallback);
    }

    // TODO: add return type for Agents Catalog
    private listAgentsCatalog = async (): Promise<any> => {
        const catalog = [];
        for (const ordPointer of ORDPointers) {
            if (ordPointer.host) {
                const ordDocUrl = `https://${ordPointer.host}${ORD_DOCUMENT_PATH}`;

                try {
                    const ordSpec = await (await fetch(ordDocUrl)).json();
                    for (const resource of ordSpec.apiResources) {
                        // find url of Agent Card
                        for (const resourceDefinition of resource.resourceDefinitions) {
                            if (resourceDefinition.customType && resourceDefinition.customType.includes("agent-card")) {
                                const agentCardUrl = `https://${ordPointer.host}${resourceDefinition.url}`;
                                const agentCard = await (await fetch(agentCardUrl)).json();
                                delete agentCard.provider;
                                delete agentCard.authentication;

                                catalog.push({
                                    ordVersion: ordSpec.openResourceDiscovery,
                                    ordDocUrl: ordDocUrl,
                                    provider: ordPointer.provider,
                                    agentCardUrl,
                                    agent: agentCard
                                });
                            }
                        }
                    }
                } catch (e) {
                    this.log.error("Could not get Agent Card details for", ordPointer.provider, "Agent. Skipping for now.", e);
                }
            }
        }

        return { catalog };
    };

    private onMetadata = async (request: cds.Request): Promise<MetadataResponse> => {
        const payload = request.data as MetadataRequest;
        this.log.info("Payload on Metadata", payload);

        return {
            name: "Agents Catalog",
            description:
                "This tool acts as an Agent Catalog through which you can discover available agents and their skills/capabilities.",
            schema: JSON.stringify({})
        };
    };

    private onCallback = async (request: cds.Request): Promise<CallbackResponse> => {
        const catalog = await this.listAgentsCatalog();
        return {
            response: `The following agents are available in the Agents Catalog: ${JSON.stringify(catalog)}`
        };
    };
}
