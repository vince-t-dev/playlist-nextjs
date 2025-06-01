const _ = require("/xpr/underscore");
const xpr_objects = require("/xpr/request");
const www = xpr_objects.XprWeb;
const request = xpr_objects.XprRequest();
const api = xpr_objects.XprApi;
const xpr_utils = require("/xpr/utilities");
const library = require("./library");
const api_key = "FJLUq4do9aA3OBNmT8kYomOn2O5lCg9zV2XTA81rCzZbWEtPsV9J4bPKmIt7UCEn";
const api_project_id = "SZeGyBYxUT";
const base_url = "https://api.trinity.xpr.cloud";

// domain tokens
const token_expresia = "b8109689ce2c329485b17a0c0c58b28c845654017ad6e384";

// convert object to url params
const objectToUrlParams = (obj) => {
    const paramArray = [];
    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            paramArray.push(`${encodeURIComponent(key)}=${encodeURIComponent(obj[key])}`);
        }
    }
    return paramArray.join('&');
};  

function trinity_request(resource, method, data, headers) {
    try {
        const request = {
            project_id: api_project_id,
            ...data
        }
        var options = {
            uri: base_url + resource,
            method: method,
            headers: {
                "x-api-key": api_key,
                "content-type": "application/json"
            },
            options: {
                timeout: 10000
            }
            // responseType: "stream"
        };
        if (headers) options.headers = { ...options.headers, ...headers };
        if (request && method == "GET") {
            const url_params = objectToUrlParams(request);
            options.uri = `${options.uri}?${url_params}`;
        }
        if (request && (method == "PUT" || method == "POST")) options.data = JSON.stringify(request);
        if (method == "PUT" || method == "POST") options.data_format = "body";
        var req = www(options);
        return [JSON.parse(req.body), req.status_code];
    } catch (error) {
        return [{error: true, details: error}, "server error"];
    }
}

/* chat completions */

exports.create_chat_completions = (data, customerId) => {
    // check customer privilege
    var user_privilege = library.checkCustomerPrivilege();
    if (user_privilege && !user_privilege.AIEnabledFEE) return { error: "ai service disabled." };

    // check current usage record
    var requests = www({
        uri: `https://www.expresia.com/api/custom/AIMonthlyMetric/?related_ExpressionCustomer_Id__eq=${customerId}&Date__eq=${new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString().slice(0, 10)}`, 
        headers: {
            Authorization: `Bearer ${token_expresia}`
        },
        method: "GET"
    });
    let ai_monthly_metrics = JSON.parse(requests.body); 

    // validate usage quota 
    let ai_monthly_metric;
    if (ai_monthly_metrics.Total > 0) {
        ai_monthly_metric = ai_monthly_metrics._embedded.Custom_AIMonthlyMetric[0];
        const max_ai_tokens = 2000000;
        // TODO: use customer subscription start date to check images per year when it's available in the ddm
        const max_image_tokens = 30;
        let quota_reached = {};
        if (ai_monthly_metric.AITokenTotal >= max_ai_tokens) quota_reached.max_ai_tokens = true;
        if (ai_monthly_metric.AIImageTotal >= max_image_tokens) quota_reached.max_image_tokens = true;
        if (ai_monthly_metric.DeveloperHours >= 0) quota_reached.max_developer_hours = true;
        if (ai_monthly_metric.ProducerHours >= 0) quota_reached.max_producer_hours = true;
        if (Object.keys(quota_reached).length)
            return { quota_reached: true, ...quota_reached };
    }

    // init. chat request
    var trinity_response = trinity_request(`/chat/`, "POST", data);

    // track token usage
    // get total tokens from trinity - we only care about total right now
    var trinity_usage = trinity_response[0].usage;
    let total_trinity_usage = 0;
    for (var model in trinity_usage) {
        if (trinity_usage.hasOwnProperty(model)) {
            total_trinity_usage += (trinity_usage[model].tokens_in || 0) + (trinity_usage[model].tokens_out || 0);
        }
    }
    
    // update usage record
    let update_metrics = api({
        uri: `/aimetrics/addAITokens/`,
        method: "POST",
        data: {
            Tokens: total_trinity_usage
        }
    }); 

    return trinity_response;
}

exports.get_chat_messages = (chat_id) => {
    var trinity_response = trinity_request(`/chat_messages/${chat_id}`, "GET");
    return trinity_response;
}