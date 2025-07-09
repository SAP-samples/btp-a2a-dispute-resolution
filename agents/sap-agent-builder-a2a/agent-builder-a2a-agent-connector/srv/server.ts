import cds from "@sap/cds";
import { Express } from "express";
import { InMemoryTaskStore, A2AExpressApp, DefaultRequestHandler } from "@a2a-js/sdk";
import { BAFAgentExecutor } from "./AgentExecutor";

// @ts-ignore
cds.on("bootstrap", (app: Express) => {
    const taskStore = new InMemoryTaskStore();
    const agentExecutor = new BAFAgentExecutor();
    const requestHandler = new DefaultRequestHandler(agentCard, taskStore, agentExecutor);
    const appBuilder = new A2AExpressApp(requestHandler);
    app = appBuilder.setupRoutes(app);
    app.get("/open-resource-discovery/v1/documents/1", (_, res) => {
        res.redirect("/ord/v1/documents/ord-document")
      })
});

const vcap = process.env.VCAP_APPLICATION;
const a2aServerUrl = vcap ? `https://${JSON.parse(vcap).application_uris[0]}/` : "http://localhost:4004/";
const agentCard = {
    name: "SAP Dispute Resolution Agent",
    description: "Resolve disputes, manage business processes, and analyze data in the cloud",
    url: a2aServerUrl,
    provider: { organization: "SAP", url: "https://www.sap.com" },
    version: "0.0.1",
    capabilities: { streaming: false, pushNotifications: false, stateTransitionHistory: false },
    defaultInputModes: ["text"],
    defaultOutputModes: ["text"],
    skills: [
        {
            id: "dispute-management",
            name: "Dispute Management",
            description: "Manage and resolve business disputes efficiently",
            tags: ["dispute", "management", "resolution"],
            examples: [
                "list all open dispute cases",
                "resolve dispute case #12345",
                "provide details of dispute case #67890"
            ],
            outputModes: ["text/plain", "application/html"]
        },
        {
            id: "business-data-cloud-analysis",
            name: "Business Data Cloud Analysis",
            description: "Analyze business data using cloud-based tools",
            tags: ["data analysis", "business", "cloud"],
            examples: [
                "analyze financial data for the past quarter",
                "generate a report on sales performance metrics",
                "compare customer engagement data across regions"
            ],
            outputModes: ["application/html", "text/csv"]
        }
    ]
};
