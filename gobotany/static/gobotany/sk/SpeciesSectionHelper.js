define([
    'dojo/_base/fx',
    'dojo/query',
    'dojo/io-query',
    'dojo/dom-attr',
    'dojo/dom-class',
    'dojo/dom-construct',
    'dojo/NodeList-dom',
    'dojo/fx',
    'dojo/NodeList-fx',
    'bridge/jquery',
    'simplekey/results_photo_menu',
    'simplekey/resources',
    'simplekey/App3',
    'gobotany/utils',
    'util/sidebar',
    'bridge/shadowbox',
    'bridge/underscore'
], function(fx, query, ioQuery, domAttr, domClass,
        domConstruct, NodeList_dom, coreFx, NodeList_fx,
        $, results_photo_menu, resources, App3, utils, sidebar, Shadowbox, _) {

    var SpeciesSectionHelper = function() {};
    var methods = SpeciesSectionHelper.prototype = {};

    methods.init = function(pile_slug, plant_divs_ready) {
        // summary:
        //   Manages the species section of the results page

        this.PHOTOS_VIEW = 'photos';
        this.LIST_VIEW = 'list';
        this.animation = null;
        this.pile_slug = pile_slug;
        this.plant_list = query('#main .plant-list')[0];
        this.plant_data = [];
        this.plant_divs = [];
        this.plant_divs_displayed_yet = false;
        this.plant_divs_ready = plant_divs_ready;
        this.current_view = this.PHOTOS_VIEW;

        resources.pile_species(pile_slug).done(
            $.proxy(this, 'create_plant_divs')
        );

        // No delay for scrolling allows images to load during the pressing
        // and holding of a cursor key.
        var SCROLL_WAIT_MS = 0;
        var scroll_timer;
        $(window).scroll($.proxy(function() {
            clearTimeout(scroll_timer);
            scroll_timer = setTimeout(this.lazy_load_images, SCROLL_WAIT_MS);
        }, this));

        var RESIZE_WAIT_MS = 500;
        var resize_timer;
        $(window).resize($.proxy(function() {
            clearTimeout(resize_timer);
            resize_timer = setTimeout(this.lazy_load_images, RESIZE_WAIT_MS);
        }, this));

        // Wire up tabs and a link for toggling between photo and list views.
        query('#results-tabs a').on('click', $.proxy(this, 'toggle_view'));

        // Set the initial view for showing the results.
        var hash_object = ioQuery.queryToObject(window.location.hash);
        if (hash_object._view !== undefined) {
            this.current_view = hash_object._view;
            this.set_navigation_to_view(this.current_view);
        }
    };

    methods.default_image = function(species) {
        var i;
        for (i = 0; i < species.images.length; i += 1) {
            var image = species.images[i];
            if (image.rank === 1 && image.type === 'habit') {
                return image;
            }
        }
        return {};
    };

    methods.get_multivalue_list = function(display_value, is_compact) {
        // Return a HTML list for presenting multiple character values.
        var list, i;

        if (typeof(display_value) !== 'string') {
            list = '<ul';
            if (is_compact) {
                list += ' class="compact"';
            }
            list += '>';
            for (i = 0; i < display_value.length; i++) {
                list += '<li';
                if (i === display_value.length - 1) {
                    list += ' class="last"';
                }
                list += '>' + display_value[i] + '</li>';
            }
            list += '</ul>';
        }
        else {
            list = display_value;
        }

        return list;
    };

    methods.connect_plant_preview_popup = function(plant_link, plant) {

        $(plant_link).click($.proxy(function(event) {
            event.preventDefault();

            // A few characters get a "compact" list for multiple values.
            var COMPACT_EX = /^habitat|habitat_general|state_distribution$/;

            // Populate the hidden content area with information about
            // this plant.
            var name = plant.scientific_name + ' <span>' +
                plant.common_name + '</span>';
            query('#plant-detail-modal h3')[0].innerHTML = name;

            // Call the API to get more information.

            var d1 = resources.taxon_info(plant.scientific_name);
            var d2 = resources.pile(this.pile_slug);
            $.when(d1, d2).done(
                $.proxy(function(taxon, pile_info) {
                    // Fill in Facts About.
                    query(
                        '#plant-detail-modal div.details p.facts'
                    )[0].innerHTML = taxon.factoid;

                    // Fill in Characteristics.
                    var MAX_CHARACTERS = 6;
                    var characters = pile_info.plant_preview_characters;
                    var characters_html = '';
                    var characters_displayed = 0;
                    for (var i = 0; i < characters.length; i++) {
                        var ppc = characters[i];

                        if (ppc.partner_site === gobotany_sk_partner_site) {

                            var display_value = '';
                            var character_value =
                                taxon[ppc.character_short_name];
                            if (character_value !== undefined &&
                                character_value !== null) {

                                display_value = character_value;
                                if (ppc.value_type === 'LENGTH') {
                                    var min = character_value[0];
                                    var max = character_value[1];
                                    var min_mm = utils.convert(
                                        min, ppc.unit, 'mm');
                                    var max_mm = utils.convert(
                                        max, ppc.unit, 'mm');
                                    display_value =
                                        utils.pretty_length(
                                        ppc.unit, min_mm, false) + '&#8211;' +
                                        utils.pretty_length(
                                        ppc.unit, max_mm);
                                }
                                else {
                                    // For multiple-value characters,
                                    // make a list.
                                    if (typeof(display_value) !== 'string') {
                                       var is_compact = (COMPACT_EX.test(
                                            ppc.character_short_name));
                                        display_value =
                                            this.get_multivalue_list(
                                                display_value, is_compact);
                                    }
                                }
                            }

                            // Only display this character if it has a value
			                // and if the maximum number of characters for the
                            // popup has not been exceeded.
                            if (display_value !== undefined &&
                                display_value !== '') {
				                if (characters_displayed < MAX_CHARACTERS) {
                                    characters_html += '<dl><dt>' +
                                        ppc.friendly_name + '</dt><dd>' +
                                        display_value + '</dd></dl>';
				                    characters_displayed += 1;
                                }
                            }
                        }
                    }
                    var characters_list = query(
                        '#plant-detail-modal .details .characteristics')[0];
                    characters_list.innerHTML = characters_html;

                    // Wire up the Go To Species Page button.
                    var path = window.location.pathname.split('#')[0];
                    var url = path +
                        plant.scientific_name.toLowerCase().replace(' ',
                        '/') + '/';
                    var button = query(
                        '#plant-detail-modal a.go-to-species-page')[0];
                    domAttr.set(button, 'href', url);

                    // Add images.
                    var images_html = '';
                    var clicked_image = $('img', plant_link).attr('src');

                    if (clicked_image !== undefined)
                        clicked_image = clicked_image.substr(
                            clicked_image.lastIndexOf('/') + 1);

                    var is_missing_image = $('div.missing-image', plant_link
                                            ).length ? true : false;
                    for (i = 0; i < taxon.images.length; i++) {
                        var taxon_image = taxon.images[i];
                        var new_image = '<img src="' +
                            taxon_image.large_thumb_url + '" alt="' +
                            taxon_image.title + '">';
                        var taxon_image = taxon_image.large_thumb_url;
                        taxon_image = taxon_image.substr(
                            taxon_image.lastIndexOf('/') + 1);
                        if (clicked_image === taxon_image &&
                            !is_missing_image) {
                            // Since this is the same image as was
                            // clicked, show it first.
                            images_html = new_image + images_html;
                        } else {
                            images_html += new_image;
                        }
                    }
                    query('#plant-detail-modal div.images')[0].innerHTML = 
                        images_html;

                    // Open the Shadowbox modal dialog with a copy of the
                    // HTML in the hidden content area.
                    var content_element = query('#plant-detail-modal')[0];
                    // On small screens, skip the popup entirely for now.
                    if ($(window).width() <= 600) {
                        window.location.href = url;
                    }
                    else {
                        Shadowbox.open({
                            content: content_element.innerHTML,
                            player: 'html',
                            height: 520,
                            width: 935,
                            options: {
                                handleOversize: 'resize',
                                onFinish: $.proxy(function() {
                                    var $sb = $('#sb-container');
                                    var $children = $sb.find('p, dt, dd, li');
                                    $sb.find('.img-container').scrollable();
                                    glossarize($children);
                                }, this)
                            }
                        });
                    }
                }, this)
            );
        }, this));
    };

    methods.set_navigation_to_view = function(view) {

        var HIDDEN_CLASS = 'hidden';
        var CURRENT_TAB_CLASS = 'current';
        var photos_tab = query('#results-tabs li:first-child a')[0];
        var list_tab = query('#results-tabs li:last-child a')[0];
        var photos_show_menu = query('.show')[0];       

        if (view === this.PHOTOS_VIEW) {
            domClass.remove(list_tab, CURRENT_TAB_CLASS);
            domClass.add(photos_tab, CURRENT_TAB_CLASS);
            domClass.remove(photos_show_menu, HIDDEN_CLASS);
        } else if (view === this.LIST_VIEW) {
            domClass.remove(photos_tab, CURRENT_TAB_CLASS);
            domClass.add(list_tab, CURRENT_TAB_CLASS);
            domClass.add(photos_show_menu, HIDDEN_CLASS);
        } else {
           console.log('Unknown view name: ' + view);
        }
    };

    methods.toggle_view = function(event) {

        if (event.target.innerHTML.toLowerCase() === this.current_view) {
            // If the same tab as the current view was clicked, do nothing.
            return;
        }

        var HIDDEN_CLASS = 'hidden';
        var CURRENT_TAB_CLASS = 'current';
        var photos_tab = query('#results-tabs li:first-child a')[0];
        var list_tab = query('#results-tabs li:last-child a')[0];
        var photos_show_menu = query('.show')[0];

        if (this.current_view === this.PHOTOS_VIEW) {
            App3.taxa.set('show_list', true);
            this.current_view = this.LIST_VIEW;
        } else {
            App3.taxa.set('show_list', false);
            this.current_view = this.PHOTOS_VIEW;
        }

        this.set_navigation_to_view(this.current_view);
        this.display_results(App3.filtered_sorted_taxadata);
    };

    methods.get_number_of_rows_to_span = function(items, start) {
        /* From a starting point in a list of plant items, return the number
           of rows it takes to get to the next genus (or the end of the
           list). */

        var rows = 1;
        var i;
        for (i = start; i < items.length; i += 1) {
            var is_last_item = (i === items.length - 1);
            if (is_last_item || items[i].genus !== items[i + 1].genus) {
                break;
            }
            else {
                rows += 1;
            }
        }

        return rows;
    };

    methods.get_image = function(item, image_type) {
        /* From a species JSON record, return the first image encountered
         * with the specified image type. If no images of that type exist,
         * return the first image. */

        var i, image_index;

        image_index = 0;   // Fallback: first image
        for (i = 0; i < item.images.length; i++) {
            if (item.images[i].type === image_type) {
                image_index = i;
                break;
            }
        }

        return item.images[image_index];
    };

    methods.display_in_list_view = function(items) {
        /* Display plant results in a list view. Use a table, with hidden
           caption and header row for accessibility. */

        query('.plant.in-results').removeClass('in-results');
        query('.plant-list table').orphan();

        var html =
            '<caption class="hidden">List of matching plants</caption>' +
            '<tr class="hidden"><th>Genus</th><th>Scientific Name</th>' +
            '<th>Common Name</th><th>Details</th></tr>';
        var i;
        for (i = 0; i < items.length; i += 1) {
            if (i > 0) {
                html += '<tr>';
            }
            else {
                html += '<tr class="first-visible">';
            }
            if (i === 0 || (items[i].genus !== items[i - 1].genus)) {
                var rowspan = this.get_number_of_rows_to_span(items, i);
                html += '<td class="genus" rowspan="' + String(rowspan) +
                    '">Genus: ' + items[i].genus + '</td>';
            }
            html += '<td class="scientific-name">';
            var image = this.get_image(items[i], 'habit');
            if (image !== undefined) {
                html += '<a href="' + image.large_thumb_url + '" ' +
                        'title="Photo">' +
                        '<img src="/static/images/icons/icon-camera.png" ' +
                        'alt=""></a>';
            }
            html += items[i].scientific_name + '</td>';
            html += '<td class="common-name">' + items[i].common_name +
                '</td>';
            html += '<td class="details"><a href="' +
                items[i].scientific_name.toLowerCase().replace(' ', '/') +
                '/">Details</a></td>';
            html += '</tr>';
        }

        var table = domConstruct.create('table', {'innerHTML': html},
                                this.plant_list);

        /* Remove any explicit style="height: ..." that might be left
           over from image animations, since it will not apply to the
           list format. */
        $('.plant-list').removeAttr('style');

        sidebar.set_height();

        Shadowbox.setup('.plant-list table td.scientific-name a', 
                        {title: ''});
    };

    methods.create_plant_divs = function(species_list) {
        // Sort the species so the plant divs are created in the correct
        // initial order for display in the UI, where they are to appear
        // sorted alphabetically by scientific name and grouped by genus.
        var sorted_species_list = species_list.sort(function(a, b) {
            return a.scientific_name < b.scientific_name ? -1 : 1;
        });

        var WIDTH = 160 + 18;
        var HEIGHT = 210 + 4;

        for (var i = 0; i < sorted_species_list.length; i++) {
            var species = sorted_species_list[i];

            var plant = domConstruct.create('div', {'class': 'plant'},
                                    this.plant_list);

            var path = window.location.pathname.split('#')[0];
            var url = (path + species.scientific_name.toLowerCase()
                       .replace(' ', '/') + '/');
            var plant_link = domConstruct.create('a', {'href': url}, plant);
            domConstruct.create('div', {'class': 'frame'}, plant_link);

            var image_container = domConstruct.create('div', {
                'class': 'plant-img-container'
            }, plant_link);
            var image = domConstruct.create('img', {'alt': ''}, image_container);
            domAttr.set(image, 'x-plant-id', species.scientific_name);
            var thumb_url = this.default_image(species).thumb_url;
            if (thumb_url) { // undefined when no image available
                // Set the image URL in a dummy attribute, so we can
                // lazy-load images, switching to the proper
                // attribute when the image comes into view.
                domAttr.set(image, 'x-tmp-src', thumb_url);
            }

            var name_html = '<span class="latin">' +
                species.scientific_name + '</span>';
            if (species.common_name) {
                name_html += ' ' + species.common_name;
            }
            domConstruct.create('p', {'class': 'plant-name',
                              'innerHTML': name_html}, plant_link);

            // Connect a "plant preview" popup. Pass species as
            // context in the connect function, which becomes 'this'
            // to pass along as the variable plant.
            this.connect_plant_preview_popup(plant_link, species);

            this.plant_data.push(species);
            this.plant_divs.push(plant);
        }
        this.plant_divs_ready.resolve();
    };

    methods.display_in_photos_view = function(items) {
        /* Display plant results as a grid of photo thumbnails with
           captions.
           */

        query('.plant-list table').orphan();

        var visible_species = {};
        for (var i = 0; i < items.length; i++)
            visible_species[items[i].id] = 1;

        var SPECIES_PER_ROW = 4;
        var WIDTH = 178;
        var HEIGHT = 232;

        var anim_list = [];
        var displayed_plants = [];
        var displayed_divs = [];

        var n = 0;  // count of plants actually displayed
        for (var i = 0; i < this.plant_divs.length; i++) {

            var plant = this.plant_data[i];
            var div = this.plant_divs[i];

            if (visible_species[plant.id] === 1) {
                displayed_plants.push(plant);
                displayed_divs.push(div);

                var destx = WIDTH * (n % SPECIES_PER_ROW);
                var desty = HEIGHT * Math.floor(n / SPECIES_PER_ROW);
                n += 1;

                domClass.remove(div, 'genus_alt');
                domClass.remove(div, 'genus_join_left');
                domClass.remove(div, 'genus_join_right');

                if (!domClass.contains(div, 'in-results')) {
                    // bring new species in from the far right
                    domClass.add(div, 'in-results');
                    div.style.top = desty + 'px';
                    anim_list.push(fx.animateProperty({
                        node: div,
                        properties: {left: {
                            start: 2800,
                            end: destx
                        }}
                    }));
                } else {
                    // move the species from its current screen location
                    anim_list.push(fx.animateProperty({
                        node: div,
                        properties: {left: {end: destx}, top: {end: desty}}
                    }));
                }
            } else {
                domClass.remove(div, 'in-results');
            }
        }
        var species_section_helper = this;
        anim_list.push(fx.animateProperty({
            node: this.plant_list,
            properties: {height: {end: desty + HEIGHT}},
            onEnd: function() {
                this.animation = null;
                sidebar.set_height();
                species_section_helper.lazy_load_images();

                // Set up genus colors now that everyone has arrived!
                var last_species_in_row = SPECIES_PER_ROW - 1;
                var genus_alt = false;
                var plant = displayed_plants[0];

                for (var n = 0; n < displayed_plants.length; n++) {
                    var div = displayed_divs[n];
                    if (genus_alt)
                        domClass.add(div, 'genus_alt');
                    if (n < displayed_plants.length - 1) {
                        var genus = plant.genus;
                        var plant = displayed_plants[n + 1];
                        if (plant.genus === genus) {
                            if (n % SPECIES_PER_ROW != last_species_in_row) {
                                domClass.add(div, 'genus_join_right');
                                domClass.add(displayed_divs[n + 1],
                                              'genus_join_left');
                            }
                        } else {
                            genus_alt = ! genus_alt;
                        }
                    }
                }
            }
        }));
        this.animation = coreFx.combine(anim_list);
        this.animation.play();
    };

    methods.display_results = function(query_results) {

        if (this.animation !== null) {
            this.animation.stop();
            this.animation = null;
        }

        // Show the "Show" drop-down menu for image types, if necessary.
        if (this.current_view === this.PHOTOS_VIEW) {
            var show_menu = query('.show')[0];
            domClass.remove(show_menu, 'hidden');
        }

        // Remove the "wait" spinner.
        query('.wait', this.plant_list).orphan();

        // Display the results in the appropriate tab view.
        if (this.current_view === this.LIST_VIEW) {
            this.display_in_list_view(query_results);
        } else {
            this.display_in_photos_view(query_results);
        }

        // Show the "See a list" (or "See photos") link.
        var see_link = query('.list-all').removeClass(see_link, 'hidden');

        if (this.current_view === this.PHOTOS_VIEW) {
            this.populate_image_types(query_results);
            this.lazy_load_images();
        }
    };

    methods.populate_image_types = function(query_results) {
        var menu_config = results_photo_menu[this.pile_slug];

        var image_list = _.flatten(_.pluck(query_results, 'images'));
        var all_image_types = _.uniq(_.pluck(image_list, 'type'));
        var image_types = _.difference(all_image_types, menu_config['omit']);

        // Add image types to the <select> and set the default value.
        image_types.sort();

        if (_.isEqual(App3.image_types.get('content'), image_types))
            // Avoid generating events when nothing has changed.
            return;

        App3.image_types.set('content', image_types);

        var old = App3.get('image_type');
        if (image_types.indexOf(old) === -1) {
            var default_type = menu_config['default'];
            if (image_types.indexOf(default_type) === -1)
                default_type = image_types[0];
            App3.set('image_type', default_type);
        }
    };

    methods.lazy_load_images = function() {
        // If the current view is the List view, do nothing. This allows
        // event handlers for the photos view to remain in effect without
        // awkwardly removing and adding them when the user toggles views.
        //
        // Check the DOM instead of the SpeciesSectionHelper object, because
        // when this function is called via setTimeout, the 'this' context
        // is not what we need, and passing a saved reference to 'this', as
        // recommended for these situations, did not work.

        var list_view_table_nodes = query('.plant-list table');
        if (list_view_table_nodes.length > 0) {
            return;
        }

        var viewport_height = $(window).height();
        var scroll_top = 0;
        var scroll_left = 0;

        if (window.pageYOffset || window.pageXOffset) {
            scroll_top = window.pageYOffset;
            scroll_left = window.pageXOffset;
        }
        else if (document.documentElement &&
                 document.documentElement.scrollTop) {
            scroll_top = document.documentElement.scrollTop;
            scroll_left = document.documentElement.scrollLeft;
        }
        else if (document.body) {
            scroll_top = document.body.scrollTop;
            scroll_left = document.body.scrollLeft;
        }

        var image_elements = query('div.plant-list img');
        var i;
        for (i = 0; i < image_elements.length; i += 1) {
            var element = image_elements[i];

            if (element.style.display !== 'none') {

                var current_element = element;
                var total_offset_left = current_element.offsetLeft;
                var total_offset_top = current_element.offsetTop;

                while (current_element.offsetParent !== null) {
                    current_element = current_element.offsetParent;
                    total_offset_left += current_element.offsetLeft;
                    total_offset_top += current_element.offsetTop;
                }

                var is_element_visible = false;
                // Only worry about top/bottom scroll visibility, not also
                // left/right scroll visibility.
                if (total_offset_top > (scroll_top - element.height) &&
                    total_offset_top < (viewport_height + scroll_top)) {

                    is_element_visible = true;
                }

                if (is_element_visible === true) {
                    var image_url = domAttr.get(element, 'x-tmp-src');
                    if (image_url !== null) {
                        // Set the attribute that will make the image load.
                        domAttr.set(element, 'src', image_url);
                    }
                }
            }
        }
    };

    return SpeciesSectionHelper;
});
