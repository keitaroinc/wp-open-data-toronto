var $ = jQuery.noConflict(),
    state = history.state || {
        'filters': {},
        'page': 0,
        'size': 1
    };

$.extend(config, {
    'isInitializing': true,
    'cataloguePages': 0,                                                        // Total number of pages within the catalogue
    'datasetsPerPage': 10,                                                      // Number of datasets to display per page
    'filters': {
        'checkboxes': ['dataset_category', 'resource_formats'],
        'dropdowns': ['owner_division', 'vocab_tags'],
        'filters': ['dataset_category', 'owner_division', 'resource_formats', 'vocab_tags']
    },
    'select2': {
        'language': {
            'noResults': function() {
                return 'Start typing search term...';
            }
        },
        'width': '100%'
    }
});

function buildCatalogue(response) {
    var data = response['result'];
    state['size'] = Math.ceil(data['count'] / config['datasetsPerPage']);

    // If no datasets are returned (due to searches/filters)
    if (data['results'].length == 0) {
        $('.table-list').append('<div class="row">' +
                                  '<div class="col-md-12">' +
                                    '<h2>No datasets found </h2>' +
                                  '</div>' +
                                '</div>');
        return;
    }

    // Iterrates over each of the results and build the HTML for each of the dataset
    for (var i = 0; i < data['results'].length; i++) {
        var row = data['results'][i];

        // Build the format tags
        var formats = row['resource_formats'].split(' '),
            formatEle = '';

        for (var j = 0; j < formats.length; j++) {
            formatEle += '<li class=' + formats[j].toLowerCase() + '>' + formats[j] + '</li>';
        }

        // Build the dataset card with field values
        var ele = '<div class="row">' +
                    '<div class="col-md-8">' +
                      '<h2><a href="/package/' + row['name'] + '">' + row['title'] + '</a></h2>' +
                      row['excerpt'] +
                      '<div class="formats-available">' +
                        '<h3 class="sr-only">Formats Available for ' + row['title'] + '</h3>' +
                        '<ul class="tag-list">' + formatEle + '</ul>' +
                      '</div>' +
                    '</div>' +
                    '<div class="col-md-4 text-right attributes">' +
                      '<p>' +
                        '<span class="sr-only">Last Updated: </span>' +
                        getFullDate(row['published_date'].split('-')) + '&nbsp; ' +
                        '<span class="fa fa-clock-o" aria-hidden="true"></span>' +
                      '</p>' +
                      '<p>' +
                        '<span class="sr-only">Data Type: </span>' +
                        row['dataset_category'] + '&nbsp; ' +
                        '<span class="fa fa-bar-chart" aria-hidden="true"></span>' +
                      '</p>' +
                    '</div>' +
                  '</div>';

        $('.table-list').append(ele);
    }

    // Build the catalogue page navigation
    // This needs to be built on every catalogue refresh because total number of pages changes based on searches and filters
    if (data['count'] > config['datasetsPerPage']) {
        $('#nav-catalogue .page-remove').remove();

        // Build the page buttons
        for (var i = 0; i < state['size']; i++) {
            var pageNumber = i + 1 + '';

            if (i == 0 || i == (state['size'] - 1) || Math.abs(state['page'] - i) <= 2) {
                $('#nav-catalogue li:last-child').before('<li class="page-item page-remove">' +
                                                           '<a class="page-link" href="#" aria-label="Go to page ' + pageNumber + '" data-page=' + i + '>' +
                                                              pageNumber +
                                                           '</a>' +
                                                         '</li>');
            } else if (Math.abs(state['page'] - i) == 3) {
                $('#nav-catalogue li:last-child').before('<li class="page-item page-remove disabled">' +
                                                           '<a class="page-link" href="#" aria-label="...">' +
                                                              '...' +
                                                           '</a>' +
                                                         '</li>');
            }
        }

        // Disable/enable the previous/next page buttons on either sides of the page navigation based on current page
        switch(state['page']) {
            case 0:
                $('#nav-catalogue .page-keep').first().addClass('disabled');
                $('#nav-catalogue .page-keep').last().removeClass('disabled');
                break;
            case (state['size'] - 1):
                $('#nav-catalogue .page-keep').last().addClass('disabled');
                $('#nav-catalogue .page-keep').first().removeClass('disabled');
                break;
            default:
                $('#nav-catalogue .page-keep').removeClass('disabled');
        }

        $('[data-page="' + state['page'] + '"]').parent('li').addClass('active');

        // Event function needs to be re-created as the page number buttons are recreated each time the catalogue is loaded
        $('#nav-catalogue .page-remove a').on('click', function() {
            state['page'] = $(this).data('page');
            $(this).addClass('active');

            loadCatalogue();
        });

        $('#nav-catalogue').show();
    }

    if (config['isInitializing']) buildUI();
}

function buildCatalogueSidebar(response) {
    var data = {};

    for (var i in response['result']['search_facets']) {
        var field = response['result']['search_facets'][i],
            title = field['title'];

        for (var j in field['items']) {
            data[field['title']] = data[field['title']] || [];

            if (['resource_formats'].indexOf(field['title']) !== -1) {          // Convert array fields stored on CKAN
                var splits = field['items'][j]['name'].split(' ');

                for (var k in splits) {
                    if (data[field['title']].indexOf(splits[k]) == -1) {
                        data[field['title']].push(splits[k]);
                    }
                }
            } else {
                data[field['title']].push(field['items'][j]['name']);
            }
        }
    }

    for (var field in data) {
        for (var i = 0; i < data[field].length; i++) {
            var value = data[field][i],
                selected = state['filters'][field];

            if (config['filters']['dropdowns'].indexOf(field) !== -1) {         // Select2 dropdowns filters
                var checked = !!selected && selected.indexOf(value) !== -1 ? ' selected="selected" ' : ' ';
                $('.filter-' + field + ' select').prepend('<option' + checked + 'data-field="' + field + '" value="' + value + '">' +
                                                            value +
                                                          '</option>');
            } else if (config['filters']['checkboxes'].indexOf(field) !== -1) { // Checkboxes filters
                var checked = !!selected && selected.indexOf(value) !== -1 ? ' checked="true" ' : ' ',
                    labelChecked = !!selected && selected.indexOf(value) !== -1 ? ' class="checkbox-checked" ' : ' ';

                $('.filter-' + field + ' ul').prepend('<li class="checkbox checkbox-filter">' +
                                                        '<label' + labelChecked + '>' +
                                                          '<input type="checkbox"' + checked + 'data-field="' + field + '" value="' + value + '">' + '&nbsp;' + value +
                                                        '</label>' +
                                                      '</li>');
            }
        }
    }

    if (!!state['filters']['search']) {
        for (var i in state['filters']['search']) {
            var value = state['filters']['search'][i];

            $('.filter-search select').prepend('<option selected="selected" value="' + value + '">' + value + '</option>');
        }
    }

    buildUISidebar();
}

var buildUI = function() {
    // Controls the previous and next navigation buttons for pagination
    $('#nav-catalogue .page-keep a').on('click', function() {
        switch($(this).data('page')) {
            case 'previous':
                state['page'] -= 1;
                break;
            case 'next':
                state['page'] += 1;
                break;
        }

        loadCatalogue();
    });

    config['isInitializing'] = false;                                           // Set isInitializing to false to prevent duplication of events
}

function buildUISidebar() {
    $('#select-division').select2($.extend({}, config['select2'], { 'maximumSelectionLength': 1 }));
    $('#select-search').select2($.extend({}, config['select2'], { 'tags': true }));
    $('#select-vocab_tags').select2(config['select2']);

    $('.select-select2').on('change.select2', function() {
        state['filters'][$(this).data('field')] = $(this).val();
        loadCatalogue();
    });

    $('.checkbox-filter input').on('click', function() {
        $(this).parent('label').toggleClass('checkbox-checked');

        state['filters'][$(this).data('field')] = [];
        $.each($('[data-field="' + $(this).data('field') + '"]:checked'), function(idx, el) {
            state['filters'][$(this).data('field')].push($(el).val());
        });
        loadCatalogue();
   });
}

function loadCatalogue() {
    if (state['page'] != 0 && (state['page'] < 0 || state['page'] >= state['size'])) return;

    $('.table-list').empty();
    $('#nav-catalogue').hide();

    var filters = {};

    if (config['isInitializing']) {
        var redirectFilters = ['search', 'vocab_tags'];

        for (i in redirectFilters) {
            var k = redirectFilters[i],
                v = getURLParam(redirectFilters[i]);

            if (!!v) {
                filters[k] = filters[k] || [];
                filters[k].push(v);
            }
        }

        state['filters'] = $.extend(true, state['filters'], filters);
        history.replaceState(state, '', '/catalogue');
    }

    for (var f in state['filters']) {
        if (!state['filters'][f] || !state['filters'][f].length) continue;

        filters[f] = [];
        if (config['filters']['checkboxes'].indexOf(f) !== -1) {                // Filter from checkboxes
            var checks = [];
            for (var i in state['filters'][f]) {
                checks.push('*' + state['filters'][f][i] + '*');
            }

            filters[f].push(f + ':(' + checks.join(' AND ') + ')');
        } else {
            $.each(state['filters'][f], function(idx, val) {
                if (config['filters']['dropdowns'].indexOf(f) !== -1) {         // Filter for CKAN field
                    filters[f].push(f + ':"' + val + '"');
                } else if (f == 'search') {                                     // Filter from search
                    filters[f].push('title:"' + val + '"');

                    var tokens = val.split(' ');
                    for (var i = 0; i < tokens.length; i++) {
                        tokens[i] = '*' + tokens[i] + '*';
                    }
                    filters[f].push('excerpt:(' + tokens.join(' AND ') + ')');
                }
            });
        }
    }

    var q = [];                                                                 // Merge searches with multiple values per field searched by OR
    for (var i in filters) {
        q.push('(' + filters[i].join(' OR ') + ')');
    }

    var params = {
        'q': q.join(' AND '),                                                   // Merge searches with multiple fields by AND
        'rows': config['datasetsPerPage'],
        'sort': 'name asc',
        'start': state['page'] * config['datasetsPerPage']
    }

    history.replaceState(state, '');
    getCKAN('package_search', params, buildCatalogue);
}

function loadCatalogueSidebar() {
    var params = {
        'q': [''],
        'rows': [0],
        'facet': ['on'],
        'facet.limit': [-1],
        'facet.field': config['filters']['filters']
    }

    var query = []
    for (var key in params) {
        for (var i in params[key]) {
            query.push(key + '=' + params[key][i])
        }
    }

    getCKAN('package_search?' + query.join('&'), {}, buildCatalogueSidebar);
}

function init() {
    loadCatalogue();
    loadCatalogueSidebar();
}
