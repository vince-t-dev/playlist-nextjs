// ajax handler: element
const xpr_objects = require("/xpr/request");
const www = xpr_objects.XprWeb;
const library = require("./library");
const _ = require("/xpr/underscore");
const xpr_utils = require("/xpr/utilities");

// domain tokens
const token_expresia = "b8109689ce2c329485b17a0c0c58b28c845654017ad6e384";

exports.process = function(context, options) {
    var api = xpr_objects.XprApi;
    let request = xpr_objects.XprRequest();
    let jsonData = request.body ? JSON.parse(request.body) : {};
    let response = {};

    // clean up json data, remove _links and empty fields
    function cleanJSON(obj) {
        if (Array.isArray(obj)) {
            return obj.map(cleanJSON).filter(el => el !== null);
        } else if (typeof obj === "object" && obj !== null) {
            const cleanedObj = {};
            for (const key in obj) {
                if (key === "_links") continue;

                const value = cleanJSON(obj[key]);
                if (value !== null && value !== "") {
                    cleanedObj[key] = value;
                }
            }
            return Object.keys(cleanedObj).length > 0 ? cleanedObj : null;
        }
        return obj;
    }

    // detect section vs. article url
    function endsWithSlash(url) {
        var path = url.split("?")[0];
        return path.charAt(path.length - 1) === "/";
    }

    // format playlist data
    function findSchemaForBundle(bundlePath, playlistsSchema) {
        return playlistsSchema.find(schema => schema._bundlePath == bundlePath) || null;
    }
    
    function formatPlaylistData(data, schema) {
        if (!data || typeof data !== "object" || !schema) {
            return data;
        }
        const result = Array.isArray(data) ? [] : {};
        for (const key in schema) {
            if (schema[key] === "String" || schema[key] === "Long string" || schema[key] === "Date string") {
                result[key] = data[key];
            } else if (schema[key] === "Image" || schema[key] === "Video") { 
                const image = data[key];
                result[key] = image
                    ? {
                          Id: image.Id,
                          Name: image.Name,
                          FilePath: image.FilePath,
                          SourcePath: image.SourcePath
                      }
                    : null;
            } else if (typeof schema[key] === "object") {
                result[key] = formatPlaylistData(data[key], schema[key]); 
            }
        }
        return result;
    }
    function transformPlaylistData(playlistData, playlistsSchema) {
        const bundlePath = playlistData.RendererBundlePath;
        const selectedSchema = findSchemaForBundle(bundlePath, playlistsSchema);
        if (!selectedSchema) {
            xpr_utils.__errlog(`Schema not found for bundlePath: ${bundlePath}`);
            return null;
        }
        const transformedData = { ...playlistData };
        delete transformedData._embedded;
        const playlistContentSchema = selectedSchema._playlistSchema.playlist_content || {};
        Object.assign(transformedData, formatPlaylistData(playlistData, playlistContentSchema));
        if (playlistData._embedded && playlistData._embedded.PlaylistItems) {
            const playlistItemsSchema = selectedSchema._playlistSchema.playlist_items;
            transformedData._embedded = {
                PlaylistItems: playlistData._embedded.PlaylistItems.map(item => {
                    const article = (item._embedded && item._embedded.Article) ? item._embedded.Article : {};
                    return {
                        Id: item.Id,
                        _embedded: {
                            Article: {
                                Id: article.Id,
                                ...formatPlaylistData(article, playlistItemsSchema)
                            }
                        }
                    };
                })
            };
        }
        return transformedData;
    }

    // map playlist data to schema metadata
    function mapPlaylistDataToSchema(playlist_data, elementId) {
        let playlist_data_schema = library.getPlaylistsMetaData();
        let playlist_schema = playlist_data_schema.find(a => a._bundlePath == playlist_data.RendererBundlePath);
        // let playlist_schema = findSchemaForBundle(playlist_data.RendererBundlePath, playlist_data_schema);
        
        // process datasources data
        let datasources_data = [];
        if (playlist_schema && playlist_schema.datasources) {
            playlist_schema.datasources.map(a=> {
                let boson = library.get_boson_context(elementId);
                let datasource_data = (boson._context) ? boson._context[a.Name] : {};
                datasources_data.push(cleanJSON(datasource_data));
            });
        }
        let datasources_data_obj = {datasource_articles: datasources_data};
        return {
            playlist_schema: playlist_schema,
            playlist_data_schema: { 
                ...transformPlaylistData(playlist_data, playlist_data_schema),
                ...datasources_data_obj
            }
        }
    }

    switch (jsonData.action) {
        // auth: login
        case "login":
            try {
                // get token
                response = api({
                    uri: "/auth/admin/login",
                    method: "POST",
                    data: {
                        UserLogin: jsonData.UserLogin,
                        UserPassword: jsonData.UserPassword,
                        TwoFactorCode: jsonData.TwoFactorCode,
                        UserType: "token"
                    }
                });

                // get basic user info
                let user = api({
                    uri: "/users/",
                    method: "GET",
                    params: { 
                        _noUnhydrated: 1,
                        with: "CustomFields",
                        Username__eq: jsonData.UserLogin 
                    }
                })
                // curently use ProfileImage cf
                let profile_image = user[0]._embedded.CustomFields._embedded ? user[0]._embedded.CustomFields._embedded.ProfileImage : {};
                let user_obj = {
                    Id: user[0].Id,
                    FirstName: user[0].FirstName,
                    LastName: user[0].LastName,
                    Username: user[0].Username,
                    City: user[0].City,
                    ActiveFrontendBranch: user[0].ActiveFrontendBranch,
                    ActiveDevelopmentBranch: user[0].ActiveDevelopmentBranch,
                    _embedded: {
                        CustomFields: { _embedded: { ProfileImage: profile_image } }
                    } 
                }
                response.user = user_obj;
            } catch(error) {
                response.error = error.status;
                return response;
            }

            return response;
        break;

        // auth: logout
        case "logout":
            // delete token
            var token = api({
                uri: "/auth/tokens/",
                method: "GET",
                params: { "Token__eq": request.headers.Auth }
            });
            api({
                uri: "/auth/tokens/"+token[0].Id,
                method: "DELETE"
            });
            // logout
            response = api({
                uri: "/auth/admin/logout",
                method: "GET"
            });
    		return response;
    	break;

        // auth: reset password
        case "resetPassword":
            response = api({
                uri: "/auth/admin/login",
                method: "POST",
                data: {
                    UserLogin: jsonData.UserLogin,
                    action: "reset"
                }
            });
    		return response;
    	break;

        // set password 
        case "setPassword":
            var token = api({
                uri: "/auth/tokens/",
                method: "GET",
                params: {
                    Type__eq: "password-reset",
                    Token__eq: jsonData.token,
                    per_page: 1,
                    with: "User"
                }
            });
            
            if (!token.length) {
                response = { error: true, message: "Invalid Token" };
                return response;
            }
            
            token = token[0];
            
            // if (moment(token.Expiry) < moment()) {
            //     var token = api({
            //         uri: "/auth/tokens/" + token.Id,
            //         method: "DELETE",
            //     });
            //     return { error:true, message:"Invalid Token" };
            // }  

            // set new passwordd
            var user = api({
                uri: "/users/" + token._embedded.User.Id,
                method: "PUT",
                data: {
                    Password: jsonData.UserPassword
                }
            });
            
            // delete token once it has been used
            var token = api.call({
                uri: "/auth/tokens/" + token.Id,
                method: "DELETE",
            });
            
            response = { message: "Success" };
            return response;
        break;

        // validate token
        case "checkAuth":
            response = library.checkAuth(request.headers.Auth);
            response.request = request;
            return response;
        break;

        // check customer privilege - using domain instead of user id
        case "checkCustomerPrivilege":
            response = library.checkCustomerPrivilege();
            return response;
        break;

        // post data
        case "postData":  
            var token = library.checkAuth(request.headers.Auth);
            if (token.error) return token;
            response = api({
                method: "POST",
                uri: jsonData.uri,
                data: jsonData.data
            });
            
            return response;
        break;
        
        // put data
        case "putData":  
            var token = library.checkAuth(request.headers.Auth);
            if (token.error) return token;
            response = api({
                method: "PUT",
                uri: jsonData.uri,
                data: jsonData.data
            });

            return response;
        break;

        // get data
        case "getData":  
            var token = library.checkAuth(request.headers.Auth);
            if (token.error) return token;
            response = api({
                method: "GET",
                uri: jsonData.uri,
                params: jsonData.params
            });
            
            return response;
        break;

        // delete data
        case "deleteData":  
            var token = library.checkAuth(request.headers.Auth);
            if (token.error) return token;
            response = api({
                method: "DELETE",
                uri: jsonData.uri
            });    
            
            return response;
        break;

        // FEE related
        // get current page info
        case "getCurrentPage":
            var token = library.checkAuth(request.headers.Auth);
            if (token.error) return token;

            if (!request.urlParams) request.urlParams = {};
            // url reverse lookup
            if (request.urlParams.url && request.urlParams.url != "/") {
                let url = (request.urlParams.url.startsWith("http"))
                    ?  request.urlParams.url
                    : `${request.domain.CanonicalUrl}${request.urlParams.url}`;

                // workaround to help with api hydration issue
                let is_section_url = endsWithSlash(request.urlParams.url);
                let current_url_params = {url: url};
                current_url_params.with = (is_section_url) ? "Section" : "Section,Article";

                let current_url = api({
                    method: "GET",
                    uri: "/routingUrl/lookup",
                    params: current_url_params
                });
                if (current_url._embedded) { 
                    if (current_url._embedded.Article) {
                        response = {
                            ...current_url._embedded.Article,
                            LanguageId: current_url.LanguageId
                        }
                    } else if (current_url._embedded.Section) {
                        response = {
                            ...current_url._embedded.Section,
                            LanguageId: current_url.LanguageId
                        }
                    }
                }
            }

            // attempt to load home page if url is not specified 
            // workaround, use sections endpoint for home until routingUrl is fixed
            if (!request.urlParams.url || request.urlParams.url == "/") {
                let home_section = api({
                    method: "GET",
                    uri: `/sections/`,
                    params: {
                        Type__eq: "domain",
                        with: "DomainLanguages"
                    }
                });
                response = home_section[0];
                response.LanguageId = home_section[0]._embedded.DomainLanguages[0]._embedded.Language.Id;
            }

            // get sample images data
            // backward-compat: check for existing sample images from v1
            var sample_images_array = [];
            try {
                var existing_sample_images = api({
                    method: "GET",
                    uri: "/bundles/",
                    params: {
                        Name__eq: "FEE"
                    }
                });
                var bundle_config = JSON.parse(existing_sample_images[0].Configuration);
                if (bundle_config.PlaceholderImage1) sample_images_array.push(bundle_config.PlaceholderImage1);
                if (bundle_config.PlaceholderImage2) sample_images_array.push(bundle_config.PlaceholderImage2);
                if (bundle_config.PlaceholderImage3) sample_images_array.push(bundle_config.PlaceholderImage3);
            } catch(error) {}

            response.SampleImages = api({
                method: "GET",
                uri: "/files/",
                params: {
                    Name__in: (sample_images_array.length > 0) 
                        ? sample_images_array.join(",")
                        : jsonData.sampleImages,
                    select_fields: "Id,Name"
                },
                parseHAL: false
            });

            return response;

        break;

        // get sitemap
        case "getSitemap":
            response = api({
                uri: "/sections/7",
                method: "GET",
                params: {
                    Invisible__eq: false,
                    related_Children_Invisible__eq: false,
                    Status__eq: 1,
                    related_Children_Status__eq: 1,
                    with: "Children(Children),CustomFields,Categories",
                    order_fields: "SortOrder",
                    order_dirs: "ASC",
                    order_Section_Children_fields: "SortOrder",
                    order_Section_Children_dirs: "ASC",
                    max_depth: 5
                }
            });
            return response;
        break;

        // get playlists
        case "getPlaylists":
            let playlists_params = {
                with: "CustomFields,PlaylistItems(Article(Categories,CustomFields,Language,Picture))",
                order_field: "SortOrder",
                order_Playlist_PlaylistItems_fields: "SortOrder",
                order_dir: "asc",
                Locale__eq: "en_CA", // request.language.Locale
                per_page: "all"
            }
            if (jsonData.slug) 
                playlists_params.related_Section_Slug__eq = jsonData.slug;
            else
                playlists_params.related_Section_Id__eq = 7;
            let playlists = api({
                uri: "/playlists/",
                method: "GET",
                params: playlists_params
            });

            // only show published articles
            playlists = _.each(playlists, function (playlist) {
                if (playlist._embedded && playlist._embedded.PlaylistItems) {
                    _.each(playlist._embedded.PlaylistItems, function (article) {
                        if (!article._embedded || !article._embedded.Article || !article._embedded.Article.Active) 
                            article._embedded.Article = {};
                    });
                }
            });
            return playlists;
        break;

        // get playlist and playlist items 
    	case "getPlaylist":
            let params = jsonData.hydrated ? {with: "PlaylistItems(Article(Picture,CustomFields)),CustomFields", _noUnhydrated: 1} : {with: "PlaylistItems(Article)"};
            response = api({
      			uri: "/playlists/" + jsonData.playlistId,
      			method: "GET",
      			params: params
    		});
            let cleaned_response = cleanJSON(response);
    		if (cleaned_response._embedded && cleaned_response._embedded.PlaylistItems) {
                cleaned_response._embedded.PlaylistItems = _.sortBy(cleaned_response._embedded.PlaylistItems, "SortOrder");
            }
            if (jsonData.hydrated) cleaned_response = mapPlaylistDataToSchema(cleaned_response, jsonData.elementId);
            return cleaned_response; 
        break;

        // get playlists
        case "getAIPlaylists":
            // get compatible playlist skins
            var playlists_bosons = api({
                uri: "/bosons/",
                method: "GET",
                parseHAL: false,
                params: {
                    with: "ModuleContentTypeDefinition(TagDefinition(ListOptions))",
                    per_page: "all",
                    Template__like: "%data-fee-%",
                    Name__like: "%master%",
                    IsModule__eq: 1,
                    _noUnhydrated: 1
                }
            });
            var playlists_custom_fields = api({
                uri: "/customFields/definitions/",
                method: "GET",
                parseHAL: false,
                params: {
                    _noUnhydrated: 1,
                    with: "ListOptions,ForeignKeyType",
                    per_page: "all"
                }
            });

            // get meta data "PlaylistsMetaData"
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
            
            // map playlists data to meta data array
            var tag_definitions = [];
            if (playlists_bosons.Total > 0) {
                _.each(all_playlists_meta_data, function(playlist_metadata) {
                    try {
                        let playlists_boson = playlists_bosons._embedded.Boson.find(a => a._bundlePath == playlist_metadata._bundlePath);
                        // let playlists_boson = findSchemaForBundle(playlist_metadata.RendererBundlePath, playlists_bosons._embedded.Boson);
                        if (playlists_boson) {
                            playlist_metadata.Id = playlists_boson.Id;
                            if (playlists_boson._embedded && playlists_boson._embedded.ModuleContentTypeDefinition) {
                                tag_definitions.push({
                                    Id: playlists_boson.Id,
                                    _embedded: {
                                        ModuleContentTypeDefinition:  playlists_boson._embedded.ModuleContentTypeDefinition
                                    }
                                });
                            }
                        }
                    } catch(error) {
                        xpr_utils.__errlog("playlists data mapping failed", error);
                    }
                });
            }

            response.playlists = all_playlists_meta_data;
            response.customfields = (playlists_custom_fields.Total > 0) ? playlists_custom_fields._embedded.CustomFieldDefinition : [];
            response.tag_definitions = tag_definitions;

            return response;
        break;

        // get meta data "PlaylistsMetaData"
        case "getPlaylistsMetaData":  
            return library.getPlaylistsMetaData();
        break;

        // update playlist/article data and re-render playlist
        case "updatePlaylistData":  
            if (jsonData.uri == "/store/products/") {
                // format ProductImages as expected from api
                if (jsonData._embedded && jsonData._embedded.ProductImages) {
                    _.each(jsonData._embedded.ProductImages, function(image) {
                        if (!image._embedded) 
                            image._embedded = { File: { Id: image.Id } };
                    });
                }
            }
            // product variants: same thing
            if (jsonData.uri == "/store/productVariants/") {
                // format Images as expected from api
                if (jsonData._embedded && jsonData._embedded.Images) {
                    _.each(jsonData._embedded.Images, function(image) {
                        if (!image._embedded) 
                            image._embedded = { File: { Id: image.Id } };
                    });
                }
            }
            response = api({
                method: "PUT",
                uri: jsonData.uri + jsonData.Id,
                data: jsonData.data
            });
            // fetch bundle path if necessary
            if (jsonData.bundlePath) {
                response._bundle = { "RendererBundlePath" : jsonData.bundlePath };
            } else {
                response._bundle = api({
          			uri: "/playlists/" + jsonData.playlistId,
          			method: "GET",
          			params: { select_fields: "RendererBundlePath" }
        		});
            }
            return response;
        break;

        // get stock images
        case "getRandomImage":
            return library.get_random_image(jsonData.params.query, jsonData.params.disable_random_assets, jsonData.params.per_page);
        break;

        // get stock videos
        case "getRandomVideo":
            return library.get_random_video(jsonData.params.query, jsonData.params.disable_random_assets, jsonData.params.per_page);
        break;

        // download resource
        case "downloadResource":
            return library.download_resource(jsonData.id, jsonData.file_type, jsonData.resource_dimensions, jsonData.requested_size);
        break;

        // track download status
        case "trackDownloadStatus":
            return library.track_download_status(jsonData.download_status_url);
        break;

        // update sort order
        case "updateSortOrder":   
            let orders_list = JSON.parse(jsonData.data);
            _.each(orders_list, function(obj) { 
        	    try {
                    response = api({
              			uri: jsonData.uri + obj.Id,
              			method: "PATCH",
              			data: { "SortOrder": obj.SortOrder }
            		});
        	    } catch (error) {
                    response.error = error;
                }
            });
            return response;
        break;

        // get edit code url
    	case "getEditCodeURL":
    	    let boson = api({
    	        uri: "/bosons/" + jsonData.Id,
    	        method: "GET",
    	        params: { with: "BundleEntities" }
    	    });
    	    response = {url: "/xpr/bundles/edit/" + boson._embedded.BundleEntities[0].BundleId + "/" + boson._embedded.BundleEntities[0].Id}
    	    return response;
    	break;

        // get media explorer
    	case "getImages":  
            var page = jsonData.page ? parseInt(jsonData.page) : 1;
            var keyword = jsonData.q ? jsonData.q : null;
            var per_page = 40;
            var type = jsonData.type ? jsonData.type : "";
            var imageParams = {
                page: page,
                per_page: per_page,
                order_dir: "desc",
                order_field: "DateUploaded",
                with: "CNode,CustomFields,Categories",
                select_fields: "Id,Name,Type"
            };
            if (jsonData.type) imageParams.Type__like = jsonData.type;
            if (keyword) imageParams.q = keyword;
            
            var imageList = api({
                method: "GET",
                uri: "/files/",
                params: imageParams,
                parseHAL: false
            });
            var totalItems = imageList.Total;
            var totalPages = Math.ceil(totalItems / per_page);
            // format id to integer
            _.each(imageList._embedded.File, function(file) { file.Id = Number(file.Id); });
            if (imageList.Total > 0) {
                return { 
                    data: "success", 
                    imageList: imageList._embedded.File, 
                    totalItems: totalItems,
                    totalPages: totalPages,
                    type : type
                };
            } else {
                return { error: "fetch image failed", imageList: false };
            }
        break;

        // upload file
        case "uploadFile":
            var token = library.checkAuth(request.headers.Auth);
            if (token.error) return token;
            let match_file_type = jsonData.base64_file.match(/^data:(.+);base64,/);
            let base64_file = jsonData.base64_file.replace(/^data:(image\/(png|jpg|jpeg|webp|svg\+xml)|video\/mp4|application\/(pdf|octet-stream));base64,/, "");
            let file_extension = match_file_type[1].split("/")[1];
            let file_name = jsonData.file_name ? jsonData.file_name : `xpr-ai-${Math.random().toString(36).substring(2, 12)}.${file_extension}`;

            let new_file = api({
                uri: "/files/",
                method: "POST",
                data: {
                    Name: file_name,
                    Type: match_file_type[1],
                    Description: "AI generated file",
                    Payload: base64_file,
                    Encoding: "base64"
                }
            });
            return new_file;
        break;

        // get intro from expresia.com
        case "showIntro":
            try {
                var requests = www({
                    uri: `https://www.expresia.com/elementAjax/Osad/FEE Intro`,
                    headers: {
                        Authorization: `Bearer ${token_expresia}`
                    },
                    method: "GET"
                });
                return JSON.parse(requests.body);
                
            } catch(error) {  
                xpr_utils.XprConsole.log("expresia intro error", error);
            }
        break;

        // get json document
        case "getJsonDocument":
            response = api({
                uri: "/jsonDocument/",
                method: "GET",
                params: jsonData.params
            });
            return response;
        break;

        // get producer
        case "getProducer":
            var token = library.checkAuth(request.headers.Auth);
            if (token.error) return token;
            var requests = www({
                uri: `https://www.expresia.com/api/custom/ProducerProfile/?Published__eq=1&order_field=SortOrder&order_dir=ASC`,
                headers: {
                    Authorization: `Bearer ${token_expresia}`
                },
                method: "GET"
            });
            response = JSON.parse(requests.body);
            var random_response;
            if (response.Total > 0) {
                random_response = _.sample(response._embedded.Custom_ProducerProfile);
            }
            return random_response;
        break;
    }

    return response;
}