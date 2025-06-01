const xpr_objects = require("/xpr/request");
const api = xpr_objects.XprApi;
const www = xpr_objects.XprWeb;
const request = xpr_objects.XprRequest();
const _ = require("/xpr/underscore");
const xpr_utils = require("/xpr/utilities");

//const moment = require("/xpr/moment");

// stock media keys
const VECTEEZY_KEY = "gpRCJxxVDkHqxMMrNFSfar5d";
const PIXABAY_KEY = "46297390-bb2756cc0ae8b35e5b17f7721";
const assets_per_page = 30;

// expresia token
const token_expresia = "b8109689ce2c329485b17a0c0c58b28c845654017ad6e384";

// check authentication
exports.checkAuth = function checkAuth(accessToken) {    
    let token = api({
        uri: "/auth/tokens/",
        method: "GET",
        params: { "Token__eq": accessToken }
    });
    if (!token.length) return { error: "token not found."};
    let expiry = (new Date(token[0].Expiry)).toISOString();
    let today = (new Date()).toISOString();
    return ((Date.parse(expiry) >= Date.parse(today) && token.length)) ? { status: "valid token." } : { error: "invalid/expired token." };
}

// check customer privilege - using domain
exports.checkCustomerPrivilege = function checkCustomerPrivilege() {
    let options = {
        uri: `https://www.expresia.com/elementAjax/DashboardUtils/CheckInstanceCustomerPrivilege?Domain=${request.domain.Slug}`,
        responseType: "json",
        headers: {
            Authorization: `Bearer ${token_expresia}`,
            "Content-Type": "application/json"
        },
        method: "GET"
    }
    let requests = www(options);
    let response = JSON.parse(requests.body);
    return response;
}

// get pagination
exports.pagination = function pagination(data) {
    // for collections with "collectionFormat" set to "hal"
    let total_items = data.total || 0;
    let pagination = {};
    let per_page = data.per_page || 10;
    let page = Number(data.page) || Number(1);
    pagination.totalPages = Math.ceil(total_items / per_page);
    if (page < pagination.totalPages) pagination.nextPage = page+1;
    if (page > 1) pagination.prevPage = page-1;
    return pagination;
}

// get boson context
exports.get_boson_context = function(bosonId, retries = 5) {
    function attempt(remaining) {
        try {
            let boson_context = api({
                uri: "/bosons/" + bosonId,
                method: "GET",
                params: {
                    with: "_Context"
                }
            });
            return boson_context;
        } catch (error) {
            xpr_utils.__errlog("get_boson_context retries left: " + remaining);
            if (remaining > 0) {
                return attempt(remaining - 1);
            }
            throw error;
        }
    }

    return attempt(retries);
}

// get random image
exports.get_random_image = function get_random_image(query, disable_random_assets, total_per_page) {
    let per_page = total_per_page || assets_per_page;
    // alternate provider
    function use_alternate_provider(retries = 3) {  
        let options = {
            uri: `https://pixabay.com/api/?q=${query}&key=${PIXABAY_KEY}&image_type=photo&orientation=horizontal&per_page=${per_page}`,
            responseType: "json",
            headers: {
                "Content-Type": "application/json"
            },
            method: "GET"
        }
        let requests = www(options);
        let request_body;
        try {
            request_body = JSON.parse(requests.body);
            let total_photos = per_page;
            let random_index = disable_random_assets ? 0 : Math.floor(Math.random() * total_photos);
            let alternate_image_response = total_per_page ? request_body.hits : request_body.hits[random_index];
            return alternate_image_response;
        } catch (error) {
            if (retries > 0) 
                return use_alternate_provider(retries - 1);
            else 
                return "https://placehold.co/600x400";
        }
    }

    // primary provider
    let options = {
        uri: `https://api.vecteezy.com/v1/resources?term=${query}&content_type=photo&per_page=${per_page}&orientation=horizontal&family_friendly=true`,
        responseType: "json",
        headers: {
            "Authorization": `Bearer ${VECTEEZY_KEY}`,
            "Content-Type": "application/json"
        },
        method: "GET"
    }
    let requests = www(options);
    let request_body = JSON.parse(requests.body);

    try {
        if (request_body.errors)
            return use_alternate_provider();
        let total_photos = per_page;
        let random_index = disable_random_assets ? 0 : Math.floor(Math.random() * total_photos);
        let image_response = total_per_page ? request_body.resources : request_body.resources[random_index];
        return image_response;
    } catch (e) {
        return use_alternate_provider();
    }
}

// get random video
exports.get_random_video = function get_random_video(query, disable_random_assets, total_per_page) {
    let per_page = total_per_page || assets_per_page;
    // alternate provider
    function use_alternate_video_provider(retries = 3) {  
        let options = {
            uri: `https://pixabay.com/api/videos/?q=${query}&key=${PIXABAY_KEY}&video_type=film&per_page=${per_page}`,
            responseType: "json",
            headers: {
                "Content-Type": "application/json"
            },
            method: "GET"
        }
        let requests = www(options);
        let request_body;
        try {
            request_body = JSON.parse(requests.body);
    
            let total_videos = per_page;
            let random_index = disable_random_assets ? 0 : Math.floor(Math.random() * total_videos);
            let alt_video_response = total_per_page ? request_body.hits : request_body.hits[random_index];
            return alt_video_response;
        } catch (error) {
            if (retries > 0)
                return use_alternate_video_provider(retries - 1);
            else
                return "https://placehold.co/600x400";
        }
    }
    let video_params = {
        uri: `https://api.vecteezy.com/v1/resources?term=${query}&content_type=video&per_page=${per_page}&family_friendly=true`,
        responseType: "json",
        headers: {
            "Authorization": `Bearer ${VECTEEZY_KEY}`,
            "Content-Type": "application/json"
        },
        method: "GET"
    }
    let video_request = www(video_params);
    let video_request_body = JSON.parse(video_request.body);
    let total_videos = per_page;
    let random_index = disable_random_assets ? 0 : Math.floor(Math.random() * total_videos);
    try {
        if (video_request_body.errors)
            return use_alternate_video_provider();
        let video_response = total_per_page ? video_request_body.resources : video_request_body.resources[random_index];
        return video_response;
    } catch(error)  {
        return use_alternate_video_provider();
    }
}

// record download usage
exports.record_download_usage = function record_download_usage(total_download_count) {
    let update_metrics = api({
        uri: `/aimetrics/addAIImages/`,
        method: "POST",
        data: {
            Images: total_download_count
        }
    }); 
    return update_metrics;
}

// download vecteezy resource
exports.download_resource = function download_resource(id, file_type, resource_dimensions, requested_size) {
    // check current usage record
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
        var customer_requests = www({
            uri: `https://www.expresia.com/api/custom/ExpressionCustomer/?related_UserId__eq=${expresia_user_id}`, 
            headers: {
                Authorization: `Bearer ${token_expresia}`
            },
            method: "GET"
        });
        let customer = JSON.parse(customer_requests.body);
        customer_id = customer._embedded.Custom_ExpressionCustomer[0].Id;
    }
    if (!customer_id) 
        return { error: "customer not found." };
    // with customer id, check current usage record
    let current_usage_record = www({
        uri: `https://www.expresia.com/api/custom/AIMonthlyMetric/?related_ExpressionCustomer_Id__eq=${customer_id}&Date__eq=${new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString().slice(0, 10)}`,
        headers: {
            Authorization: `Bearer ${token_expresia}`
        },
        method: "GET"
    });
    let ai_monthly_metrics = JSON.parse(current_usage_record.body);

    // validate usage quota
    if (ai_monthly_metrics.Total > 0) {
        let ai_monthly_metric = ai_monthly_metrics._embedded.Custom_AIMonthlyMetric[0];

        // validate usage quota 
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

    // start download request
    const { width, height } = resource_dimensions;
    let file_size = determine_file_size(file_type, width, height, requested_size);
    
    if (!file_size) {
        throw new Error("Invalid file size request. Cannot upscale.");
    }
    
    let options = {
        uri: `https://api.vecteezy.com/v1/resources/${id}/download?file_type=${file_type}&file_size=${file_size}`,
        responseType: "json",
        headers: {
            "Authorization": `Bearer ${VECTEEZY_KEY}`,
            "Content-Type": "application/json"
        },
        method: "GET"
    };
    
    let requests = www(options);
    let request_body = JSON.parse(requests.body);

    // track record usage
    this.record_download_usage(1);

    return request_body.download_status_url;
}

function determine_file_size(file_type, width, height, requested_size) {
    const photo_sizes = {
        "large": 2400,
        "medium": 1920,
        "small": 640
    };
    
    const video_sizes = {
        "small": { width: 1280, height: 720 },
        "medium": { width: 1920, height: 1080 },
        "large": { width: 2560, height: 1440 },
        "x-large": { width: 3840, height: 2160 }
    };
    
    if (requested_size === "compressed") {
        return "compressed";
    }
    // vecteezy only supports jpg and mp4 according to their email
    if (file_type == "jpg" && photo_sizes[requested_size]) {
        return width >= photo_sizes[requested_size] ? requested_size : null;
    }
    
    if (file_type == "mp4" && video_sizes[requested_size]) {
        let { width: reqWidth, height: reqHeight } = video_sizes[requested_size];
        if (reqWidth < width && reqHeight < height) {
            return requested_size;
        }
    }
    
    return "medium"; // default fallback
}

// check vecteezy download status
exports.track_download_status = function track_download_status(download_status_url) {
    let response = www({
        uri: download_status_url,
        responseType: "json",
        headers: {
            "Authorization": `Bearer ${VECTEEZY_KEY}`,
            "Content-Type": "application/json"
        },
        method: "GET"
    });
    let download_status = JSON.parse(response.body);
    return download_status;
}

// get stock assets
exports.getStockAssets = function getStockAssets(obj, disable_random_items) {
    let disable_random_assets = (obj.disable_random_assets || disable_random_items) ? true : false;
    if (!obj || typeof obj !== "object") return obj;
    if (obj._image_query || obj.Image) {
        const stock_image = this.get_random_image(obj._image_query, disable_random_assets);
        const stock_image_url = stock_image.preview_url || stock_image.previewURL;
        obj._url = stock_image_url;
        obj.resource_id = stock_image.id;
        obj.file_types = stock_image.file_types;
        obj.dimensions = stock_image.dimensions;
        
        obj.SourcePath = stock_image_url;
        obj.Name = stock_image_url;
    }
    if (obj._video_query) {
        const stock_video = this.get_random_video(obj._video_query, disable_random_assets);
        const stock_video_url = stock_video.preview_url || stock_video.videos.medium.url;
        obj._url = stock_video_url;
        obj.resource_id = stock_video.id;
        obj.file_types = stock_video.file_types;
        obj.dimensions = stock_video.dimensions;
        
        obj.SourcePath = stock_video_url;
        obj.Name = stock_video_url;
    }
    for (const key in obj) {
        if (obj[key] && typeof obj[key] === "object") {
            obj[key] = this.getStockAssets(obj[key], disable_random_items);
        }
    }
    return obj;
}

// get playlists meta data
exports.getPlaylistsMetaData = function getPlaylistsMetaData() {
    var playlists_meta_data = api({
        uri: "/bundleEntities/",
        method: "GET",
        parseHAL: false,
        params: {
            Path__eq: "PlaylistsMetaData",
            with: "TextContentObject"
        }
    });
    let all_playlists_meta_data = [];
    let metadata_json = [];
    if (playlists_meta_data.Total > 0) {
        _.each(playlists_meta_data._embedded.BundleEntity, function(metadata) {
            metadata_json = JSON.parse(metadata._embedded.TextContentObject.Text);
            all_playlists_meta_data = all_playlists_meta_data.concat(metadata_json);
        });
    }
    return all_playlists_meta_data;
}