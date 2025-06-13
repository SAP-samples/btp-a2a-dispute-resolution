# Client Communication with the A2A Server

### Request to fetch ORD document from A2A Server

*   **URL:** `<service-url>/open-resource-discovery/v1/documents/1`
*   **Method:** `GET`

### Request to fetch Agent Card from A2A Server

*   **URL:** `<service-url>/.well-known/agent.json`
*   **Method:** `GET`
*   **Response:**
    ```json
    {
      "name": "Warehouse_Insight_Agent",
      "description": "Tracks stock movements across the warehouse and their causes in real-time.",
      "url": "<service-url>",
      "provider": {
        "organization": "GCP ADK Example",
        "url": "gcp_a2a_example.sap.com"
      },
      "version": "0.0.1",
      "authentication": null,
      "defaultInputModes": [
        "text/plain"
      ],
      "defaultOutputModes": [
        "text/plain"
      ],
      "capabilities": {
        "streaming": false,
        "pushNotifications": false
      },
      "skills": [
        {
          "id": "warehouse-insight",
          "name": "Warehouse Insight",
          "description": "Tracks stock movements across the warehouse and their causes in real-time.",
          "tags": [
            "warehouse",
            "stock",
            "analysis"
          ],
          "examples": [
            "why did the stock level for Item X drop this morning?",
            "which orders caused stock changes for Item Y in the last 24 hours?",
            "has the stock for Item Z been replenished since the last outbound shipment?"
          ],
          "outputModes": [
            "text/plain"
          ]
        }
      ]
    }

### Send a `tasks/send` request to the A2A Server.

*   **URL:** `<service-url>`
*   **Method:** `POST`
*   **Body (JSON):**
    ```json
    {
    "jsonrpc": "2.0",
    "id": "client_req_1",
    "method": "tasks/send",
    "params": {
        "id": "",
        "message": {
            "role": "user",
            "parts": [
                {
                    "type": "text",
                    "text": "Can you get me shipping details for ORDER0006"
                }
            ]
        },
        "metadata": {}
      }
    }
*   **Response:**
    ```json
    {
      "jsonrpc": "2.0",
      "id": "client_req_1",
      "result": {
        "id": "",
        "sessionId": "024d2591-9570-40df-8810-21563aa3d97a",
        "status": {
          "state": "COMPLETED",
          "message": null
        },
        "artifacts": [
          {
            "name": "adk_agent_response",
            "parts": [
              {
                "type": "text",
                "text": "Here are the shipping details for order ORD0006:\n\n- Customer ID: CUST0006\n\n- Product ID: K00001\n\n- Ordered Product Count: 1000\n\n- Delivered Product Count: 900\n\n- Damaged Product Count: 100\n\n- Freight Details: TRK1126\n"
              }
            ]
          }
        ],
        "metadata": null
      },
      "error": null
    }


#### Please note this testing pattern assumes unauthenticated invokes are allowed.

--------------------------
### ADK Agent A2A Server Deployment Steps

This guide provides the steps to deploy the `adk_agent` to Google Cloud Run using the `gcloud` CLI and Docker, and how to test its API endpoints using `curl`.

**Prerequisites:**

*   Google Cloud SDK (`gcloud` CLI) installed.
*   A `.env` file in the `warehouse-insights-agent` directory containing your project ID, region, and potentially Vertex AI usage flag (e.g., `GOOGLE_CLOUD_PROJECT=your-project-id`, `GOOGLE_CLOUD_LOCATION=us-central1`, `GOOGLE_GENAI_USE_VERTEXAI=True`). Copy `.env.sample` to get started.

## Initial Google Cloud Setup

Log in to your Google Cloud account and set your active project.

1.  **Log in to Google Cloud**

    Open your **bash terminal** and run:

    ```bash
    gcloud auth login
    ```
    Follow the prompts to complete the authentication process in your web browser.

2.  **Set Your Google Cloud Project**

    Replace `<your-project-id>` with your actual Google Cloud project ID. The current project is hosted in project `sap-paa-gcp`.

    ```bash
    gcloud config set project <your-project-id>
    ```

## Deploy to Google Cloud Run

Navigate to your project's root directory in your **bash terminal**.

1.  **Set Environment Variables**

    Load environment variables from your `.env` file into your current bash session.

    ```bash
    set -a; source Warehouse_Insight_Agent/.env; set +a
    ```

2.  **Deploy the Service**

    Build your Docker image and deploy it to Cloud Run. We want to use `--allow-unauthenticated` for easy API access for testing purposes in this guide.

    ```bash
    gcloud run deploy <agent-service-name> \
      --source . \
      --region $GOOGLE_CLOUD_LOCATION \
      --project $GOOGLE_CLOUD_PROJECT \
      --allow-unauthenticated \
      --set-env-vars="GOOGLE_CLOUD_PROJECT=$GOOGLE_CLOUD_PROJECT,GOOGLE_CLOUD_LOCATION=$GOOGLE_CLOUD_LOCATION,GOOGLE_GENAI_USE_VERTEXAI=$GOOGLE_GENAI_USE_VERTEXAI"
    ```

    *   `agent-service-name`: The name given to your GCP Cloud Run service. For this project it is `adk-agent-service-direct`.

    `gcloud` will build the Docker image, push it to Artifact Registry, and deploy it to Cloud Run. Upon completion, it will output the **Service URL**. Copy this URL as you will need it for testing.
