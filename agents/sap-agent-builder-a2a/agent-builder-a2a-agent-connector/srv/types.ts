// -----------------
// --- Requests ---
// -----------------
export interface Config {
    name: string;
    value: string;
}

export interface BaseRequest {
    tenantId: string;
    agentId: string;
    chatId: string;
    toolId: string;
}

export interface MetadataRequest extends BaseRequest {}

export interface CallbackRequest extends BaseRequest {
    toolInput: string;
}

export interface ConfigChangedRequest extends BaseRequest {
    config: Config[];
}

export interface ResourcesChangedRequest extends ConfigChangedRequest {
    addedOrUpdatedResources: string[];
    deletedResources: string[];
}

// -----------------
// --- Responses ---
// -----------------
export interface MetadataResponse {
    name: string;
    description: string;
    schema: string;
}

export interface CallbackResponse {
    response: string;
}

export interface ErrorResponse {
    error?: string;
}
