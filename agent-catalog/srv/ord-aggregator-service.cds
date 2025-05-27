@protocol: ['rest']
@path    : '/ord-aggregator'
service ORDAggregator {
    // TODO: define custom type for return
    function listAgentsCatalog()                           returns array of {};

    action   metadata(
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

    action   callback(
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
