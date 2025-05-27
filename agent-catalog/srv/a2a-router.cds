@protocol: ['rest']
@path    : '/a2a-router'
service A2ARouterService {

    action metadata(
                    @mandatory
                    tenantId : String not null,
                    @mandatory
                    agentId : String not null,
                    @mandatory
                    chatId : String not null,
                    @mandatory
                    toolId : String not null)            returns {
        name : String;
        description : String;
        schema : String;
    };

    action callback(
                    @mandatory
                    toolInput : String not null,
                    @mandatory
                    tenantId : String not null,
                    @mandatory
                    agentId : String not null,
                    @mandatory
                    chatId : String not null,
                    @mandatory
                    toolId : String not null,
                    @mandatory
                    callbackHistoryId : String not null) returns {
        response : String;
    };
}
