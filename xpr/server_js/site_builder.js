// ajax handler: element
const xpr_objects = require("/xpr/request");
const library = require("./library");
const www = xpr_objects.XprWeb;
const xpr_utils = require("/xpr/utilities");
const _ = require("/xpr/underscore");
const groq = require("./groq");

// domain tokens
const token_expresia = "b8109689ce2c329485b17a0c0c58b28c845654017ad6e384";

exports.process = function(context, options) {
    var api = xpr_objects.XprApi;
    let request = xpr_objects.XprRequest();
    let jsonData = request.body ? JSON.parse(request.body) : {};
    let response = {};

    var token = library.checkAuth(request.headers.Auth);
    if (token.error) return token;

    switch (jsonData.action) {
        // finalize template
        case "finalizeTemplate":
            var current_section_id = jsonData.schema.id ? jsonData.schema.id : 7;
            var is_new_section = current_section_id.toString().startsWith("new");
            var updated_section;
            
            // create section if id starts with "new-"
            if (is_new_section) {
                // get domain metadata
                let domain_metadata = api({
                    uri: "/jsonDocument/",
                    method: "GET",
                    params: {
                        Tag__eq: "domain_meta_data"
                    }
                });
                let domain_metadata_json = JSON.parse(domain_metadata[0].Payload);
                let domain_templates = JSON.parse(domain_metadata_json.domain.Templates);
                let default_template = domain_templates[0].value;

                let new_section_data = {
                    Name: jsonData.schema.title,
                    Title: jsonData.schema.title,
                    Description: jsonData.schema.Description,
                    Type: "template",
                    UsesPlaylists: true,
                    Invisible: 0,
                    Status: 1,
                    RendererBundlePath: default_template,
                    _embedded: {
                        Parent: {
                            Id: jsonData.schema.parent_id || 7
                        }
                    }
                }
                if (jsonData.schema.SortOrder) new_section_data.SortOrder = jsonData.schema.SortOrder;
                if (jsonData.schema.MetaTagDescription) new_section_data.MetaTagDescription = jsonData.schema.MetaTagDescription;
                let new_section = api({
                    uri: "/sections/",
                    data: new_section_data,
                    method: "POST"
                });
                current_section_id = new_section.Id;
                updated_section = new_section;
            }

            // create playlists
            _.each(jsonData.schema.playlists, function(playlist, index) {
                var target_section_id = (is_new_section) 
                    ? current_section_id 
                    : jsonData.schema.id 
                        ? jsonData.schema.id 
                        : 7;
                var target_playlist_id;
                var target_categories;
                // external datasources handling
                // NOTE: the following needs to be refined as we go
                if (playlist.datasources) {
                    _.each(playlist.datasources, function(datasource) {
                        if (datasource.section_id) target_section_id = datasource.section_id;
                        if (datasource.category_id) target_categories = datasource.category_id.split(",").map(id => ({ Id: parseInt(id.trim(), 10) }));
                    });
                }

                // create playlist
                let playlist_data = {
                    ...playlist,
                    SortOrder: index, 
                    Locale: jsonData.locale || "en_CA", 
                    _embedded: {
                        Section: {
                            Id: target_section_id
                        }, 
                        PlaylistLanguage: [
                            { Locale: jsonData.locale || "en_CA", _embedded: {} }
                        ],
                        ...playlist._embedded
                    }
                }
                delete playlist_data.Id;
                if (playlist_data._embedded.PlaylistItems) delete playlist_data._embedded.PlaylistItems;
                var new_playlist = api({
                    uri: "/playlists/",
                    data: playlist_data,
                    method: "POST"
                });
                if (!target_playlist_id) target_playlist_id = new_playlist.Id;
                
                // create playlist items
                if (playlist._embedded && playlist._embedded.PlaylistItems) {
                    _.each(playlist._embedded.PlaylistItems, function(playlist_item, index) {
                        let default_params = {
                            Active: 1,
                            _embedded: { 
                                Section: { 
                                    Id: target_section_id
                                }, 
                                Language: {
                                    Id: jsonData.language_id || 1
                                }
                            }
                        }

                        // process and upload files in playlist item
                        if (playlist_item._embedded && playlist_item._embedded.Article) {
                            let playlist_article = playlist_item._embedded.Article;
                            
                            // create article
                            let article_data = {
                                ...default_params,
                                ...playlist_article,
                                _embedded: {
                                    ...default_params._embedded,
                                    ...playlist_article._embedded
                                }
                            }

                            if (target_categories) article_data._embedded.Categories = target_categories;

                            delete article_data.Id;
                            var new_article = api({
                                uri: "/articles/",
                                data: article_data,
                                method: "POST"
                            });

                            let playlist_item_data = {
                                SortOrder: index, 
                                _embedded: {
                                    Playlist: {
                                        Id: target_playlist_id
                                    }, 
                                    Article: {
                                        Id: new_article.Id
                                    }
                                }
                            };
                            delete playlist_item_data.Id;

                            var new_playlist_item = api({
                                uri: "/playlistItems/",
                                data: playlist_item_data,
                                method: "POST"
                            });
                        }
                    });
                }
            });

            // existing section: update playlists meta data
            // let current_meta_keywords = (!is_new_section) ? JSON.parse(jsonData.sitemap[0].playlists) : "";
            let section_meta_data = {is_created: true, ai_enabled: true}; 
            // if (current_meta_keywords) section_meta_data.playlists = current_meta_keywords.playlists;
            let current_section_meta_data = api({
                uri: `/jsonDocument/`,
                method: "GET",
                params: {
                    Tag__eq: `section_meta_data_${current_section_id}`
                }
            })
            if (current_section_meta_data.length > 0) {
                api({
                    uri: `/jsonDocument/${current_section_meta_data[0].Id}`,
                    data: {
                        Payload: JSON.stringify(section_meta_data)
                    },
                    method: "PUT"
                });
            } else {
                api({
                    uri: `/jsonDocument/`,
                    data: {
                        Tag: `section_meta_data_${current_section_id}`,
                        Payload: JSON.stringify(section_meta_data),
                        UUID: `section_meta_data_${current_section_id}`
                    },
                    method: "POST"
                });
            }

            // force clearing cache...
            updated_section = api({
                uri: "/sections/" + current_section_id,
                method: "GET",
                params: {
                    ts: Date.now()
                }
            })
        
            return {status: "success", updated_section: updated_section};
        break;

        // get ai usage record
        case "getAIUsageRecord":
            // get customer ai metrics usage data starts
            var ret = {};
            try {
                // from group discussion, stripe billing cycle always starts at the 1st and end at the end of the month so we should be safely to pull data from the current month
                var requests = www({
                    uri: `https://www.expresia.com/api/custom/AIMonthlyMetric/?related_ExpressionCustomer_Id__eq=${jsonData.customer_id}&Date__eq=${new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString().slice(0, 10)}`,
                    headers: {
                        Authorization: `Bearer ${token_expresia}`
                    },
                    method: "GET"
                });

                // it's probably more accurate to get record for tokens and images from the instance
                let instance_record = api({
                    uri: `/aimetrics/`,
                    method: "GET",
                    params: {
                        Date__eq: new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString().slice(0, 10)
                    }
                });

                var ai_monthly_metrics = JSON.parse(requests.body);
                let total_ai_metrics;
                if (ai_monthly_metrics.Total > 0) {
                    total_ai_metric = ai_monthly_metrics._embedded.Custom_AIMonthlyMetric[0];
                    total_ai_metrics = { 
                        AITokenTotal: instance_record[0].Totalaitokensused/*total_ai_metric.AITokenTotal*/ || 0,
                        AIImageTotal: instance_record[0].Totalaiimagesused/*total_ai_metric.AIImageTotal*/ || 0, 
                        DeveloperHours: total_ai_metric.DeveloperHours || -5, // negative values are for stripe one-time setup
                        ProducerHours: total_ai_metric.ProducerHours || -2   
                    }
                } else {
                    total_ai_metrics = { AITokenTotal: 0, AIImageTotal: 0, DeveloperHours: -5, ProducerHours: -2 };
                }
                ret.AIMetrics = total_ai_metrics;

                // validate usage quota 
                const max_ai_tokens = 2000000;
                const max_image_tokens = 30;
                let quota_reached = {};
                if (total_ai_metrics.AITokenTotal >= max_ai_tokens) quota_reached.max_ai_tokens = true;
                if (total_ai_metrics.AIImageTotal >= max_image_tokens) quota_reached.max_image_tokens = true;
                if (total_ai_metrics.DeveloperHours >= 0) quota_reached.max_developer_hours = true;
                if (total_ai_metrics.ProducerHours >= 0) quota_reached.max_producer_hours = true;
                if (Object.keys(quota_reached).length)
                    ret.quota_reached = quota_reached;
            } catch (error) {
                xpr_utils.__errlog("Error fetching AI monthly metrics: " + error);
                ret.AIMetrics = { AIImageTotal: 0, AITokenTotal: 0, DeveloperHours: -5, ProducerHours: -2 };
                return ret;
            }
            return ret;
            // get customer ai metrics usage data ends
        break;
    }

    return response;
}