define([
    'args',
    'simplekey/App3',
    'simplekey/Filter',
    'simplekey/FilterController'
], function(args, App3, _Filter, _FilterController) {

    // Dojo code needs globals, so we create some.
    global_speciessectionhelper = null;
    Filter = _Filter;
    FilterController = _FilterController;

    App3.taxa = Ember.Object.create({
        len: 'Loading',   // placeholder until we have an integer to display
        show_list: false  // whether to show list or grid
    });

    App3.image_types = Ember.ArrayProxy.create({
        content: []
    });

    App3.filter_controller = FilterController.create();

    App3.TaxaView = Ember.View.extend({
        show_listBinding: 'App3.taxa.show_list',
        taxa_countBinding: 'App3.taxa.len',

        switch_photo_list: function(event) {
            // Tell the old Dojo species section helper to switch views.
            if (global_speciessectionhelper)
                global_speciessectionhelper.toggle_view(event);
        }
    });

    App3.FilterView = Ember.View.extend({
        items: function() {
            return _.map(App3.filter_controller.filters, function(f) {
                return {
                    filter: f,
                    is_normal: (f.slug !== 'family' && f.slug !== 'genus')
                };
            });
        }.property('App3.filter_controller.filters')
    });

    require([
        'simplekey/results_overlay',
        'simplekey/results_photo_menu'
    ]);

    require([
        'jquery.tools.min',
        'order!jscrollpane'   // sk/results.js
    ], function() {
        require([
            'order!dojo_config',
            'order!/static/js/dojo/dojo.js',
            'order!/static/js/layers/nls/sk_en-us.js',
            'order!/static/js/layers/sk.js'
        ], function() {
            require([
                'order!/static/gobotany/filters.js',
                'order!/static/gobotany/utils.js',
                'order!/static/gobotany/sk/glossary.js',
                'order!/static/gobotany/sk/photo.js',
                'order!/static/gobotany/sk/results.js',
                'order!/static/gobotany/sk/SpeciesSectionHelper.js',
                'order!/static/gobotany/sk/working_area.js',
                'order!/static/gobotany/sk/SearchSuggest.js'
            ], function() {
                require([
                    'order!simplekey/resources',   // now used in filters.js
                    'order!activate_search_suggest',
                    'order!activate_image_gallery',
                    'underscore-min',  // filters.js, etc
                    'sidebar',
                    'shadowbox',
                    'shadowbox_init'
                ], function() {
                    dojo.require('gobotany.sk.results');
                    dojo.addOnLoad(function() {
                        helper = gobotany.sk.results.ResultsHelper(args.pile_slug);
                    });
                });
            });
        });
    });
});
