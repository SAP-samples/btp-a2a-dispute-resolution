import cds from "@sap/cds";
import express from "express";
import path from "path";

import { A2AServer } from "./vendor/a2a/server/server";
import { InMemoryTaskStore } from "./vendor/a2a/server/store";

const WELL_KNOWN = path.join(__dirname, "well-known");
const store = new InMemoryTaskStore(); // Or new FileStore()
export const a2aServer = new A2AServer({
    taskStore: store,
    card: require(path.join(WELL_KNOWN, "agent.json")),
    basePath: "/a2a-service"
});

cds.on("bootstrap", (app: express.Application) => {
    // .well-known/agent.json already exposed via A2AServer
    //@ts-ignore
    app = a2aServer.start(app);
});
