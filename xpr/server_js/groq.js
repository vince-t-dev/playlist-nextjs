const _ = require("/xpr/underscore");
const xpr_objects = require("/xpr/request");
const www = xpr_objects.XprWeb;
const request = xpr_objects.XprRequest();
const api = xpr_objects.XprApi;
const xpr_utils = require("/xpr/utilities");
const library = require("./library");
const api_key = "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";
const base_url = "https://api.groq.com/openai/v1";

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

function groq_request(resource, method, data, headers) {
    try {
        var options = {
            uri: base_url + resource,
            method: method,
            headers: {
                Authorization: "Bearer " + api_key,
                "Content-Type": "application/json"
            },
            // options: {
            //     timeout: 30000
            // }
            // responseType: "stream"
        };
        if (headers) options.headers = { ...options.headers, ...headers };
        if (data && method == "GET") {
            const url_params = objectToUrlParams(data);
            options.uri = `${options.uri}?${url_params}`;
        }
        if (data && (method == "PUT" || method == "POST")) options.data = JSON.stringify(data);
        if (method == "PUT" || method == "POST") options.data_format = "body";
        var req = www(options);
        xpr_utils.XprConsole.log("groq response", req);
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
    var groq_response = groq_request(`/chat/completions`, "POST", data);

    // track token usage
    // get total tokens from groq - we only care about total right now
    let total_groq_usage = groq_response[0].usage.total_tokens;
    
    // update usage record
    let update_metrics = api({
        uri: `/aimetrics/addAITokens/`,
        method: "POST",
        data: {
            Tokens: total_groq_usage
        }
    }); 

    return groq_response;
}