const xpr_objects = require("/xpr/request");
const xpr_utils = require("/xpr/utilities");

exports.process = function(context, options) {
    var api = xpr_objects.XprApi;
    let request = xpr_objects.XprRequest();
    
    // pop. language if not available
    if (!request.language) {
        let language = api({
            uri: "/languages/",
            method: "GET",
            params: { Id__eq: request.urlParams.language_id ? request.urlParams.language_id : 1 }
        });
        request.language = language[0];
    }
    
    // fetch playlist content and render it on page refresh
    let playlist;
    if (request.urlParams.refreshPlaylist) {
        playlist = api({
            uri: "/playlists/" + request.urlParams.playlistId,
            method: "GET",
            params: { 
                _noUnhydrated: 1, 
                with: "PlaylistItems(Article(Picture,CustomFields,Categories)),CustomFields",
                order_field: "SortOrder",
                order_Playlist_PlaylistItems_fields: "SortOrder",
                order_dir: "asc",
                Locale__eq: request.language.Locale,
                per_page: "all"
            }
        });
    }
    // use template renderer to get html with context
    try {
        let boson = api({
            uri: "/bundles/entities/Boson/" + request.urlParams.bundlePath,
            method: "GET"
        });
        // let template_context;
        // for playlists with datasources, render the element with context
        // if (request.urlParams.keepXprContext) {
        let boson_context = library.get_boson_context(boson.Id);
        let template_renderer_context = boson_context._context || {};
        // } 
        // let template_renderer_context = {xpr: { element: { id: boson.Id }, request: request }};
        // if (template_context) template_renderer_context = template_context;
        let template_content = xpr_utils.XprTemplateRenderer(boson.Template, { playlist: playlist, ...template_renderer_context });

        return template_content;
    } catch(error) {
        xpr_utils.__error("Error in playlist_renderer: " + error);
    }
}