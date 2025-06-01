const xpr_objects = require("/xpr/request");
const xpr_utils = require("/xpr/utilities");
const library = require("./library");
const mail = xpr_objects.XprMail;
const _ = require("/xpr/underscore");

exports.process = function(context, options) {
    var api = xpr_objects.XprApi;
    let request = xpr_objects.XprRequest();
    let jsonData = request.body ? JSON.parse(request.body) : {};
    let response = {};
    
    // pop. language if not available
    if (!request.language) {
        let language = api({
            uri: "/languages/",
            method: "GET",
            params: { Id__eq: request.urlParams.language_id ? request.urlParams.language_id : 1 }
        });
        request.language = language[0];
    }

    /* generate preview for ai content */
    
    // get playlist name and bundle path
    try {
        // render playlist
        if (jsonData.action == "render_playlist") {
            let playlist;
            let bundlePath;

            // get playlist info and populate content
            if (jsonData.ai_content) {
                // get playlist data
                let playlist_data = api({
                    uri: "/playlists/" + jsonData.ai_content.Id,
                    method: "GET"
                })
                let playlist_json = jsonData.ai_content;
                if (!playlist_json.Name) playlist_json.Name = playlist_data.Name;
                playlist_json.RendererBundlePath = playlist_data.RendererBundlePath;

                // populate playlist content with stock assets
                let populated_playlist = library.getStockAssets(playlist_json, jsonData.disable_random_assets);
                playlist = populated_playlist;
                bundlePath = playlist_data.RendererBundlePath;
            }
            
            // use template renderer to get html with context
            let boson = api({
                uri: `/bundles/entities/Boson/${bundlePath}`,
                method: "GET"
            });
            // get boson context (for playlist with datasources)
            let boson_context = library.get_boson_context(boson.Id);
            let template_renderer_context = boson_context._context || {};

            let boson_template = jsonData.hbs_template ? jsonData.hbs_template : boson.Template;
            let template_content = xpr_utils.XprTemplateRenderer(boson_template, { AI: (jsonData.playlist_action == "edit-playlist-content"), playlist: playlist, ...template_renderer_context , xpr: { element: { id: boson.Id }, request: request }});

            return {template_html: template_content, playlist_data: playlist};
        }

        // publish playlist
        if (jsonData.action == "publish_playlist" && jsonData.playlist_data) {
            // update playlist
            if (jsonData.playlist_data.edit_playlist) {
                try {
                    let updated_playlist = JSON.parse(JSON.stringify(jsonData.playlist_data.edit_playlist));
                    delete updated_playlist.Id;  
                    let updated_playlist_data = api({
                        uri: "/playlists/" + jsonData.playlist_data.edit_playlist.Id,
                        method: "PUT",
                        data: updated_playlist
                    });
                    response.updated_playlist_data = updated_playlist_data;
                } catch(error) {xpr_utils.__errlog("playlist update error", error)}
            }

            // update playlist items (articles)
            if (jsonData.playlist_data.edit_playlist_items) {
                let playlist_items_data = jsonData.playlist_data.edit_playlist_items;
                let updated_playlist_items_data = [];
                for (let article of playlist_items_data) {
                    let article_data = JSON.parse(JSON.stringify(article._embedded.Article));
                    delete article_data.Id; 
                    try {
                        let updated_article = api({
                            uri: "/articles/" + article._embedded.Article.Id,
                            method: "PUT",
                            data: article_data
                        });
                        updated_playlist_items_data.push(updated_article);
                    } catch(error) {xpr_utils.__errlog("article update error", error)}
                }
                response.updated_playlist_items_data = updated_playlist_items_data; 
            }

            // add playlist items/articles
            if (jsonData.playlist_data.add_playlist_items) {
                jsonData.playlist_data.add_playlist_items.forEach(playlist_item => {
                    // new article
                    let article = playlist_item._embedded.Article;
                    delete article.Id;
                    let article_data = {
                        ...article,
                        Active: 1, 
                        _embedded: { 
                            ...article._embedded,
                            Section: { 
                                Id: jsonData.section_id
                            }, 
                            Language: {
                                Id: jsonData.language_id
                            }
                        }
                    };
                    let new_article = api({
                        uri: "/articles/",
                        method: "POST",
                        data: article_data
                    });
                    // new playlist item
                    let playlist_item_data = {
                        ...playlist_item,
                        _embedded: {
                            Playlist: {
                                Id: jsonData.publish_playlist_id
                            }, 
                            Article: {
                                Id: new_article.Id
                            }
                        }
                    };
                    let new_playlist_item = api({
                        uri: "/playlistItems/",
                        method: "POST",
                        data: playlist_item_data
                    });
                });
            }

            // delete playlist items/articles
            if (jsonData.playlist_data.delete_playlist_items) {
                jsonData.playlist_data.delete_playlist_items.forEach(playlist_item => {
                    let playlist_item_data = api({
                        uri: "/playlistItems/" + playlist_item.Id,
                        method: "GET"
                    })
                    if (playlist_item_data) {
                        try {
                            api({
                                uri: "/articles/" + playlist_item_data._embedded.Article.Id,
                                method: "DELETE"
                            });
                        } catch(error) {xpr_utils.__errlog("article delete error", error)}
                        try {
                            api({
                                uri: "/playlistItems/" + playlist_item.Id,
                                method: "DELETE"
                            });
                        } catch(error) {xpr_utils.__errlog("playlist item delete error", error)}
                    }
                });
            }
            return response;
        }

        // publish element
        if (jsonData.action == "publish_element" && jsonData.element_data) {
            let element_data = {
                Template: jsonData.element_data
            };
            
            // save copy: create new element
            if (jsonData.save_copy) {
                // get old element
                let old_element = api({
                    uri: `/bosons/${jsonData.element_id}`,
                    method: "GET",
                    params: {
                        with: "BoundDatasources"
                    }
                });
                if (old_element) {
                    // create new boson
                    let new_element_name = "xpr-ai-" + String(Date.now()).slice(-4) + " (" + old_element._bundlePath + ")";
                    let bundle_id = old_element._embedded.BundleEntities[0].BundleId;
                    let preview_image = (old_element._embedded && old_element._embedded.PlaylistPreviewImage)
                        ? {PlaylistPreviewImage: { Id: old_element._embedded.PlaylistPreviewImage.Id }}
                        : {};
                    let bosons_data = {
                        Name: new_element_name,
                        IsTemplate: false,
                        IsModule: true,
                        Cachelifetime: null,
                        Template: jsonData.element_data,
                        _embedded: {
                            BoundDatasources: old_element._embedded.BoundDatasources,
                            DanglingDatasources: [],
                           ...preview_image
                        }
                    }           
                    let new_element = api({
                        uri: `/bosons/`,
                        method: "POST",
                        data: bosons_data
                    });
                    let bundle_entities_data = {
                        ManagedAssetName: false,
                        Path: new_element_name,
                        EntityType: "Boson",
                        BundleId: bundle_id,
                        _embedded: {
                            PostHandler: null,
                            CustomScript: null,
                            LibraryInclude: null,
                            Boson: {
                                Id: new_element.Id
                            },
                            BosonDatasource: old_element._embedded.BoundDatasources,
                            TextContentObject: null
                        }
                    }         
                    // create bundle entities to bind bosons to bundle
                    let bundle_entities = api({
                        uri: `/bundleEntities/`,
                        method: "POST",
                        data: bundle_entities_data
                    });
                
                    // set it to the new playlist
                    let updated_playlist = api({
                        uri: "/playlists/" + jsonData.playlist_id,
                        method: "PUT",
                        data: {
                            RendererBundlePath: bundle_entities.FullPath
                        }
                    });

                    // add new meta data to the playlists schema
                    let all_playlists_schema = library.getPlaylistsMetaData();
                    let old_schema_obj = all_playlists_schema.find(obj => obj._bundlePath == old_element._bundlePath);
                    let old_element_bundle_name = old_element._bundlePath.split("/")[0];
                    let new_schema_obj = {
                        ...old_schema_obj,
                        _bundlePath: old_element_bundle_name + "/" + new_element_name
                    }
                    // update the schema to all schema objects found
                    var playlists_meta_data = api({
                        uri: "/textContentObjects/",
                        method: "GET",
                        parseHAL: false,
                        params: {
                            Name__like: "%PlaylistsMetaData%"
                        }
                    });
                    if (playlists_meta_data.Total > 0) {    
                        let text_content_objects = playlists_meta_data._embedded.TextContentObject;
                        _.each(text_content_objects, function(text_content_object) {
                            let current_playlist_schema = JSON.parse(text_content_object.Text);
                            current_playlist_schema.push(new_schema_obj);
                            api({
                                uri: `/textContentObjects/${text_content_object.Id}`,
                                method: "PUT",
                                data: {
                                    Text: JSON.stringify(current_playlist_schema)
                                }
                            });
                        });
                    }

                    return updated_playlist;
                }
            // existing element, update template
            } else {
                response = api({
                    uri: `/bosons/${jsonData.element_id}`,
                    method: "PUT",
                    data: element_data
                });
            }

            return response;
        }

        // contact producer
        if (jsonData.action == "contact_producer") {
            let email_html = `
                <h2>You may have an upcoming schedule call with a project. Here's some info:</h2>
                <p>Project ID: ${jsonData.project_id}</p>
                <p>Instance URL: ${jsonData.instance_url}</p>
                <p>Project URL: ${jsonData.project_url}</p>
                <p>Expresia Team</p>
            `;
            response = mail({
                "from": "info@expresia.com",
                "to": jsonData.email,
                "subject": `Producer Call Schedule for ${jsonData.instance_url}`,
                "body": email_html
            });
            return response;
        }
    } catch(error) {
        return {error: error};
    }
}