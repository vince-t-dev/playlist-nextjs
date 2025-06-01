const xpr_objects = require("/xpr/request");
const api = xpr_objects.XprApi;
const www = xpr_objects.XprWeb;
const groq = require("./groq");
const library = require("./library");
const xpr_utils = require("/xpr/utilities");

// domain tokens
const token_expresia = "b8109689ce2c329485b17a0c0c58b28c845654017ad6e384";

exports.process = function(context, options) {
    let request = xpr_objects.XprRequest();
    let jsonData = request.body ? JSON.parse(request.body) : {};
    let response = {};
    
    // validate token
    let token = library.checkAuth(request.headers.Auth);
    if (token.error) return token;

    // retrieve customer id from json document
    let json_document_domain_data = api({
        uri: "/jsonDocument/",
        method: "GET",
        params: {
            Tag__eq: "domain_meta_data"
        }
    });
    let json_document_domain_payload = JSON.parse(json_document_domain_data[0].Payload);
    let customer_id = json_document_domain_payload.customer_id;  
    if (!customer_id) {
        let expresia_user_id = JSON.parse(json_document_domain_data[0].Payload).user_id;  
        var requests = www({
            uri: `https://www.expresia.com/api/custom/ExpressionCustomer/?related_UserId__eq=${expresia_user_id}`, 
            headers: {
                Authorization: `Bearer ${token_expresia}`
            },
            method: "GET"
        });
        let customer = JSON.parse(requests.body);
        customer_id = customer._embedded.Custom_ExpressionCustomer[0].Id;
    }

    if (!customer_id) 
        return { error: "customer not found." };

    switch (jsonData.action) {
        // chat completions
        case "create_chat_completions":
            return groq.create_chat_completions(jsonData.data, customer_id, request.headers.Auth);
        break;
    }

    return response;
}