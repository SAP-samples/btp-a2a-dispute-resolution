# Client Communication with the A2A Server

### Request to fetch ORD document from A2A Server

*   **URL:** `https://a2aazureserver3-d6fgfwabbmbph9cp.eastus2-01.azurewebsites.net/open-resource-discovery/v1/documents/1`
*   **Method:** `GET`


### Request to fetch Agent Card from A2A Server

*   **URL:** `https://a2aazureserver3-d6fgfwabbmbph9cp.eastus2-01.azurewebsites.net/.well-known/agent.json`
*   **Method:** `GET`
*   **Response:**
    ```json
    {
        "name": "Dispute_Email_Agent",
        "description": "Analyzes dispute and using provided additional information, drafts a response email.",
        "url": "url",
        "provider": {
            "organization": "Azure",
            "url": "azure_a2a_example.sap.com"
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
                "id": "policy_lookup_tool",
                "name": "Policy Lookup Tool",
                "description": "Generates an email response for a given dispute shared by a customer.",
                "tags": [
                    "dispute resolution",
                    "customer",
                    "dispute email"
                ],
                "examples": [
                    "Generate a response for dispute by Customer CUST001, order ORD0001, where only 90 of the ordered 100 items were delivered."
                ],
                "outputModes": [
                    "text/plain"
                ]
            }
        ]
    }


### Send a request to the A2A Server.

*   **URL:** `https://a2aazureserver-ftfpeaf7hpdegbhm.eastus2-01.azurewebsites.net/`
*   **Method:** `POST`

-------------------------------
### Azure Agent A2A Server Deployment Steps

This guide provides the steps to deploy the `AzureAgent` to Azure Web Apps using the Azure VS Code extension.

1. Create the Web App instance in Azure.

2. Set up the run command under **Settings -> Configurations -> Startup Command**. In the box, please put `uvicorn main:app --host 0.0.0.0 --port 8000`.
3. Set the environment variables in **Settings -> Environment Variables** as provided in the `.env.sample` file.
4. Install the Azure extension in VS Code.
5. Navigate from the tree to the configured web app, which will be under **App Services**. 
6. Right click on the above and click **Deploy to Web App** and navigate to the right folder.
7. After successful deployment, the app URL will be available as **Default Domain** in the Overview tab, under the **Essentials** list. For this app it is: `a2aazureserver-ftfpeaf7hpdegbhm.eastus2-01.azurewebsites.net`.
