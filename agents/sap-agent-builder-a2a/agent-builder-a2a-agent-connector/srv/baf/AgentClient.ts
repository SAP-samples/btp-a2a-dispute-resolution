import axios, { AxiosInstance } from "axios";

export class TokenFetching {
    constructor(
        private readonly tokenServiceUrl: string,
        private readonly clientId: string,
        private readonly clientSecret: string
    ) {}

    private lastToken?: {
        token: string;
        expiresAt: number;
    };

    private getCurrentTimeInSeconds(): number {
        return Math.floor(Date.now() / 1000);
    }

    public async getToken(): Promise<string> {
        // Ensure token is not outdated
        if (!this.lastToken || this.lastToken.expiresAt * 0.9 < this.getCurrentTimeInSeconds()) {
            this.lastToken = await this.getNewAuthToken(this.tokenServiceUrl, this.clientId, this.clientSecret);
        }

        return this.lastToken?.token;
    }

    private async getNewAuthToken(
        tokenServiceUrl: string,
        clientId: string,
        clientSecret: string
    ): Promise<{
        token: string;
        expiresAt: number;
    }> {
        const formData = {
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: "client_credentials"
        };

        // Fetch token from uaa
        const xsuaaResponseObj = await axios.post<{
            access_token: string;
            expires_in: number;
        }>(tokenServiceUrl, new URLSearchParams(formData), {
            headers: {
                "content-type": "application/x-www-form-urlencoded",
                accept: "application/json"
            }
        });

        return {
            token: xsuaaResponseObj.data.access_token,
            expiresAt: this.getCurrentTimeInSeconds() + xsuaaResponseObj.data.expires_in
        };
    }
}

export class AgentClient {
    constructor(
        private readonly tokenFetcher: TokenFetching,
        private readonly baseUrl: string
    ) {}

    public createClient(): AxiosInstance {
        const instance = axios.create({
            baseURL: this.baseUrl,
            timeout: 1000 * 60 * 5
        });

        // Add authorization header with token to each request
        instance.interceptors.request.use(async (config) => {
            const token = await this.tokenFetcher.getToken();
            config.headers.setAuthorization("Bearer " + token);
            return config;
        });

        return instance;
    }
}

async function sleep(ms: number) {
    return await new Promise((resolve) => setTimeout(resolve, ms));
}
