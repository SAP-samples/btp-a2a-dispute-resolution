# Dispute Resolution with Multi-Agent Orchestration
[![REUSE status](https://api.reuse.software/badge/github.com/SAP-samples/btp-a2a-dispute-resolution)](https://api.reuse.software/info/github.com/SAP-samples/btp-a2a-dispute-resolution)

> [!NOTE]
> **Experimental**: The current source code and architecture are experimental, intended for research and proof-of-concept purposes, and are subject to change.

This repository demonstrates an end-to-end scenario where multiple organizations collaborate through domain-specific AI agents to resolve a customer dispute.
The agents use an open [Agent-to-Agent (A2A)](https://github.com/google/A2A) communication protocol and [Open Resource Discovery (ORD)](https://github.com/open-resource-discovery/specification) to dynamically discover each other's capabilities and collaborate on complex tasks that exceed the scope of a single agent.

## Architecture

![Architecture Diagram](./docs/architecture.svg)
> [!NOTE]
> This architecture illustrates AI agents integrated via point-to-point connections, as currently implemented. Alternatively, a centralized orchestrator per platform could be introduced.

## Scenario

XStore disputes an invoice from Cymbal Direct after receiving a short shipment of 900 t-shirts instead of the expected 1,000. Vicky, an employee of Cymbal Direct, uses **Joule** to resolve the issue with the help of several backend agents representing different organizations and capabilities. Watch the demo video to see the scenario in action:

<video src="https://video.sap.com/embed/secure/iframe/entryId/1_kcgq0nd4/uiConfId/54310412/st/0" controls preload></video>

### Scenario Breakdown

- **User Prompt**: Vicky reports a shipment discrepancy via Joule.
- **Joule as Orchestrator Agent Planning**:
  - Identifies required agents from the Agent Catalog.
  - Creates a task plan for orchestration.
- **Agent Orchestration**:
  - **Dispute Resolution Agent (SAP)**: Confirms invoice and shipment data from SAP S/4HANA; expected 1,000 units.
  - **Warehouse Insights Agent (Google)**: Analyzes logistics and retrieves a packaging slip showing only 900 t-shirts shipped.
  - **Dispute Policy & Email Agent (Microsoft)**: Retrieves communication logs and creates an email draft to the customer according to the dispute policy.
- **Response to User**:
  - Confirmation of dispute resolution creation and customer email.

## Prerequisites

To run this project, ensure you have access to the following components:

- SAP BTP Subaccount
- Cloud Foundry Runtime enabled
- Business Agent Foundation (BAF) / Project Agent Builder subscription
- One or more A2A-enabled agent runtimes:
  - Google Vertex AI Agent or Google Cloud Run
  - Azure AI Foundry Agent or Azure Web Apps


## Walkthrough & Hands-on Tutorial

1.  [Provision A2A Agents](docs/setup.md#provision-a2a-agents)
2.  [Deploy the Agent Catalog](docs/setup.md#deploy-the-agent-catalog)
3.  [Set up the Orchestrator as Scenario Entry Point](docs/setup.md#set-up-the-orchestrator-as-scenario-entry-point)
4.  [Develop & Run locally](docs/setup.md#develop--run-locally)
5.  [Test It Yourself](docs/setup.md#test-it-yourself)

## Repository Structure
### [agent-catalog](/agent-catalog/): Agent discovery and routing services 
  - `ord-aggregator`: Acts as `AGENT_CATALOG`, aggregates Agent Cards across catalogs (SAP, GCP, Azure) using ORD.
  - `a2a-router`: Acts as `AGENT_ROUTER` which connects to `ord-aggregator` and routes requests to appropriate agents using A2A protocol (A2A Client)

### [agents](/agents/): A2A agents on SAP, GCP and Azure
  - [sap-agent-builder-a2a](/agents/sap-agent-builder-a2a/)
      - agent-builder-a2a-agent-conntector: CAP application that wraps an Agent running on Agent Builder (SAP BTP) to enable A2A and exposing its Agent Card via Open Resource Discovery (ORD). 
      - agent-builder-agent-exports: Exported agents from BAF
          - `orchestrator`: Joule's main entry point for the scenario
          - `dispute-resolution-agent`: Agent running on Agent Builder (SAP BTP) that handles dispute resolution.
  - [gcp-adk-a2a](/agents/gcp-adk-a2a/): Agent deployed on GCP based on A2A and exposed Agent Card via Open Resource Discovery (ORD).
      - `warehouse-insights-agent`: Tracks stock movements across the warehouse and their causes in real-time.
  - [azure-ai-foundry-a2a](/agents/azure-ai-foundry-a2a/): Agent deployed on Azure based on A2A and exposed Agent Card via Open Resource Discovery (ORD).
      - `dispute-email-agent`: Agent that creates email drafts according to specific dispute policies for dispute resolution.

## Known Issues
No known issues.

## How to obtain support
[Create an issue](https://github.com/SAP-samples/<repository-name>/issues) in this repository if you find a bug or have questions about the content.
 
For additional support, [ask a question in SAP Community](https://answers.sap.com/questions/ask.html).

## Contributing
If you wish to contribute code, offer fixes or improvements, please send a pull request. Due to legal reasons, contributors will be asked to accept a DCO when they create the first pull request to this project. This happens in an automated fashion during the submission process. SAP uses [the standard DCO text of the Linux Foundation](https://developercertificate.org/).

## License
Copyright (c) 2024 SAP SE or an SAP affiliate company. All rights reserved. This project is licensed under the Apache Software License, version 2.0 except as noted otherwise in the [LICENSE](LICENSE) file.
