define([
    'args',
    'jquery',
    'underscore-min',
    'simplekey/App3',
    'simplekey/Filter',
    'simplekey/FilterController',
    'simplekey/resources',
    'simplekey/ResultsPageState'
], function(args, x, x, App3, _Filter, _FilterController, resources,
            ResultsPageState) {

    var pile_slug = args.pile_slug;
    var helper;  // legacy object; gets set way down at the bottom of this file
    var document_is_ready = $.Deferred();

    $(document).ready(function() {
        document_is_ready.resolve();
    });

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

    App3.TaxaView = Ember.View.extend({
        show_listBinding: 'App3.taxa.show_list',
        taxa_countBinding: 'App3.taxa.len',

        switch_photo_list: function(event) {
            // Tell the old Dojo species section helper to switch views.
            if (global_speciessectionhelper)
                global_speciessectionhelper.toggle_view(event);
        }
    });

    /* Async resources and deferreds. */

    var async_key_vector = resources.key_vector('simple');
    var async_pile_taxadata = resources.pile_species(pile_slug);
    var filter_controller_is_built = $.Deferred();

    var pile_taxa_ready = $.Deferred();
    async_pile_taxadata.done(function(taxadata) {
        pile_taxa_ready.resolve(_.pluck(taxadata, 'id'));
    });

    /* Various parts of the page need random access to taxa. */

    App3.taxa_by_sciname = {};
    async_pile_taxadata.done(function(taxadata) {
        _.each(taxadata, function(datum) {
            App3.taxa_by_sciname[datum.scientific_name] = datum;
        });
    });

    /* The FilterController can be activated once we know the full list
       of species that it will be filtering. */

    $.when(async_key_vector, async_pile_taxadata).done(function(kv, taxadata) {
        var simple_key_taxa = kv[0].species;
        var taxadata = _.filter(taxadata, function(taxon) {
            return _.indexOf(simple_key_taxa, taxon.id) != -1;
        });
        App3.set('taxadata', taxadata);  // TODO: put this somewhere else?

        var fc = FilterController.create({
            taxadata: taxadata,
            plain_filters: [],
            add: function(filter) {
                // Keep a separate list of only non-family/genus filters.
                this._super(filter);
                if (filter.slug != 'family' && filter.slug != 'genus')
                    this.plain_filters.addObject(filter);
            }
        });
        App3.set('filter_controller', fc);
        App3.set('family_filter', fc.filtermap.family);
        App3.set('genus_filter', fc.filtermap.genus);
        filter_controller_is_built.resolve();

        // Hide the "Loading..." spinner.
        $('.loading').hide();
    });

    /* The Family and Genus filters are Ember-powered <select> elements
       that the following logic keeps updated at all times with the set
       of legal family and genus values. */

    var choices_that_leave_more_than_zero_taxa = function(filter) {
        var other_taxa = App3.filter_controller.compute(filter);
        var keepers = _.filter(filter.values, function(value) {
            return _.intersect(value.taxa, other_taxa).length;
        });
        var choices = _.pluck(keepers, 'choice');
        choices.sort();
        choices.splice(0, 0, '');  // to "not select" a family or genus
        return choices;
    };

    App3.reopen({
        family_choices: function() {
            return choices_that_leave_more_than_zero_taxa(App3.family_filter);
        }.property('filter_controller.@each.value'),

        genus_choices: function() {
            return choices_that_leave_more_than_zero_taxa(App3.genus_filter);
        }.property('filter_controller.@each.value')
    });

    $('#family_clear').live('click', function(event) {
        App3.family_filter.set('value', '');
    });
    $('#genus_clear').live('click', function(event) {
        App3.genus_filter.set('value', '');
    });

    /* Other filters appear along the left sidebar, mediated through
       this convenient FilterView. */

    App3.FilterView = Ember.View.extend({
        templateName: 'filter-view',
        filterBinding: 'content',  // 'this.filter' makes more readable code
        classNameBindings: ['answered'],

        answered: function() {
            // Return whether to assign the "answered" CSS class.
            return !! this.filter.value;
        }.property('filter.value'),

        display_value: function() {
            var filter = this.get('filter');
            var value = filter.get('value');

            if (value === null)
                return '';   // Do not display a "don't know" value

            if (value === 'NA')
                return 'does not apply';

            if (filter.value_type === 'TEXT')
                return filter.choicemap[value].friendly_text || value;

            if (filter.is_length()) {
                var units = filter.display_units || 'mm';
                return gobotany.utils.pretty_length(units, value);
            }

            return value + '';
        }.property('filter.value'),

        clear: function(event) {
            if (helper.filter_section.working_area)
                helper.filter_section.working_area.dismiss();
            this.filter.set('value', null);
        },

        click: function(event) {
            if ($(event.target).hasClass('clear-filter'))
                return;

            var filter = this.get('filter');
            var $target = $(event.target).closest('li');

            $('.option-list li .active').removeClass('active');
            $target.addClass('active');

            var y = $target.offset().top - 15;
            var async = resources.character_vector(this.filter.slug);
            $.when(pile_taxa_ready, async).done(function(pile_taxa, values) {
                filter.install_values({pile_taxa: pile_taxa, values: values});
                helper.filter_section.show_filter_working_onload(filter, y);
            });
        }
    });

    /* The FilterView above is automatically instantiated and managed by
       this CollectionView, which is careful to use the 'plain_filters'
       attribute that omits the family and genus filters. */

    $.when(document_is_ready, filter_controller_is_built).done(function() {
        App3.filters_view = Ember.CollectionView.create({
            tagName: 'ul',
            classNames: ['option-list'],
            contentBinding: 'App3.filter_controller.plain_filters',
            itemViewClass: App3.FilterView
        });
        App3.filters_view.appendTo('#questions-go-here');
    });

    /* Because filters would otherwise constantly change the height of
       the sidebar, we give them their own scrollbar. */

    var scroll_pane = null;
    var user_is_scrolling = true;

    require(['lib/jquery.jscrollpane'], function() {
        scroll_pane = $('.scroll')
            .bind('jsp-scroll-y', function(event) {
                if (user_is_scrolling)  // because this could be a reinitialise
                    if (helper.filter_section.working_area)
                        helper.filter_section.working_area.dismiss();
            })
            .jScrollPane({
                maintainPosition: true,
                stickToBottom: true,
                verticalGutter: 0,
                showArrows: true
            });

        setInterval(function() {
            user_is_scrolling = false;
            scroll_pane.data('jsp').reinitialise(); // sends jsp-scroll-y!
            user_is_scrolling = true;
        }, 500);
    });

    /* All filters can be cleared with a single button click. */

    $('#sidebar a.clear-all-btn').click(function() {
        _.each(App3.filter_controller.get('content'), function(filter) {
            filter.set('value', null);
        });
    });

    /* Filters need to be loaded. */

    var use_hash = (window.location.hash !== '') ? true : false;
    if (use_hash) {
        // Restore the state of the page from a URL hash.

        var results_page_state = ResultsPageState.create({
            'hash': window.location.hash
        });
        var filter_slugs = results_page_state.filter_names();
        var filter_values = results_page_state.filter_values();

        $.when(
            filter_controller_is_built,
            resources.pile(pile_slug),
            resources.pile_characters(pile_slug)
        ).done(function(x, pile_info, character_list) {

            var character_map = {};
            var all_filters = character_list.concat(pile_info.default_filters);
            _.each(all_filters, function(info) {
                character_map[info.short_name] = info;
            });

            var default_slugs = _.map(pile_info.default_filters, function(f) {
                return f.short_name;
            });

            var other_slugs = _.difference(filter_slugs, default_slugs);
            var all_slugs = default_slugs.concat(other_slugs);

            _.each(all_slugs, function(slug) {
                if (!_.has(character_map, slug))
                    return;

                // Start an async load in case the user uses the filter.
                resources.character_vector(slug);

                // Create the filter if it does not exist already.
                var info = character_map[slug];
                if (!_.has(App3.filter_controller.filtermap, slug)) {
                    App3.filter_controller.add(Filter.create({
                        slug: info.short_name,
                        value_type: info.value_type,
                        info: info
                    }));
                }

                // Set the filter's value if the hash specified one.
                if (_.has(filter_values, slug)) {
                    var filter = App3.filter_controller.filtermap[slug];
                    var value = filter_values[slug];
                    var async = resources.character_vector(slug);
                    $.when(pile_taxa_ready, async)
                        .done(function(pile_taxa, values) {
                        filter.install_values({
                            pile_taxa: pile_taxa,
                            values: values
                        });
                        filter.set('value', value);
                    });
                }
            });
        });
    } else {
        // With no hash on the URL, load the default filters for this
        // plant subgroup for a "fresh" load of the page.

        resources.pile(pile_slug).done(function(pile_info) {
            _.each(pile_info.default_filters, function(filter_info) {
                App3.filter_controller.add(Filter.create({
                    slug: filter_info.short_name,
                    value_type: filter_info.value_type,
                    info: filter_info
                }));
                // Go ahead and start an async fetch, to make things
                // faster in case the user clicks on the filter.
                resources.character_vector(filter_info.short_name);
            });
        });
    }

    /* More filters can be fetched with the "Get More Questions" button. */

    var checked_groups = [];  // remembers choices from last time

    $('#sidebar .get-choices').click(function() {
        if (helper.filter_section.working_area !== null)
            helper.filter_section.working_area.dismiss();

        Shadowbox.open({
            content: $('#modal').html(),
            player: 'html',
            height: 450,
            options: {
                fadeDuration: 0.1,
                onFinish: function() {
                    // Re-check any check boxes that were set last time.
                    $('#sb-container input').each(function(i, input) {
                        var value = $(input).val();
                        var check = (_.indexOf(checked_groups, value) != -1);
                        $(input).prop('checked', check);
                    });
                    $('#sb-container a.get-choices')
                        .addClass('get-choices-ready');  // for tests
                }
            }
        });
    });

    $('#sb-container a.get-choices').live('click', function() {
        checked_groups = [];  // reset array in enclosing scope
        $('#sb-container input').each(function(i, input) {
            if ($(input).prop('checked'))
                checked_groups.push($(input).val());
        });

        var existing = [];
        _.each(App3.filter_controller.content, function(filter) {
            existing.push(filter.slug);
        });

        simplekey_resources.pile_best_characters({
            pile_slug: pile_slug,
            species_ids: App3.filter_controller.taxa,
            character_group_ids: checked_groups,
            exclude_characters: existing
        }).done(receive_new_filters);

        Shadowbox.close();
    });

    var receive_new_filters = function(items) {
        if (items.length === 0) {
            gobotany.utils.notify(
                'No more questions left for the boxes checked');
            return;
        }
        _.each(items, function(filter_info) {
            App3.filter_controller.add(Filter.create({
                slug: filter_info.short_name,
                value_type: filter_info.value_type,
                info: filter_info
            }));
        });
        gobotany.utils.notify('More questions added');
        helper.save_filter_state();
    };

    //

    require([
        'simplekey/results_overlay',
        'simplekey/results_photo_menu'
    ]);

    if (true) {
        require([
            'order!dojo_config',
            'order!/static/js/dojo/dojo.js',
            'order!/static/js/layers/nls/sk_en-us.js',
            'order!/static/js/layers/sk.js'
        ], function() {

            /* Glue: tell Dojo when the set of selected species
               changes. */

            App3.reopen({
                tell_dojo: function() {
                    var taxa = App3.filter_controller.taxa;
                    var t = _.filter(App3.taxadata, function(item) {
                        return _.indexOf(taxa, item.id) != -1;
                    });
                    t.sort(function(a, b) {
                        return a.scientific_name < b.scientific_name ? -1 : 1;
                    });
                    dojo.publish('/filters/query-result', [{species_list: t}]);
                }.observes('filter_controller.taxa')
            });

            require([
                'order!/static/gobotany/utils.js',
                'order!/static/gobotany/sk/glossary.js',
                'order!/static/gobotany/sk/photo.js',
                'order!/static/gobotany/sk/results.js',
                'order!/static/gobotany/sk/SpeciesSectionHelper.js',
                'order!/static/gobotany/sk/working_area.js',
                'order!/static/gobotany/sk/SearchSuggest.js'
            ], function() {
                require([
                    'order!activate_search_suggest',
                    'order!activate_image_gallery',
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
    }
});
