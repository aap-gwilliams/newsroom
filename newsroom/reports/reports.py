from collections import defaultdict

import superdesk
from bson import ObjectId
from flask_babel import gettext
from flask import request, current_app as newsroom_app, json
from superdesk.utc import utcnow
from copy import deepcopy
from newsroom.agenda.agenda import get_date_filters
from flask import abort
from newsroom.utils import query_resource, get_entity_dict, get_items_by_id
from .content_activity import get_content_activity_report  # noqa
from eve.utils import ParsedRequest
from newsroom.news_api.api_tokens import API_TOKENS
from newsroom.news_api.utils import format_report_results


def get_company_names(companies):
    service = superdesk.get_resource_service('companies')
    enabled_companies = []
    disabled_companies = []
    for company in companies:
        company = service.find_one(req=None, _id=company)
        if company:
            if not company.get('is_enabled'):
                disabled_companies.append(company.get('name'))
            else:
                enabled_companies.append(company.get('name'))
    return {'enabled_companies': enabled_companies, 'disabled_companies': disabled_companies}


def get_product_names(products):
    sorted_products = sorted(products, key=lambda k: (k['product_type'], k['name']))
    product_list = []
    for p in sorted_products:
        product_list.append('{} ({})'.format(p.get('name', ''), get_section_name(p.get('product_type', ''))))
    return '\r\n'.join(product_list)


def get_products(args):
    lookup = {}
    if args.get('section'):
        lookup = {'product_type': args.get('section')}
    if args.get('product'):
        lookup = {'_id': ObjectId(args.get('product'))}
    results = list(query_resource('products', lookup=lookup))

    lookup = {}
    if args.get('section') and args.get('section') != 'monitoring':
        lookup = {'product_type': args.get('section')}
    if args.get('product'):
        lookup = {'_id': ObjectId(args.get('product'))}
    monitoring = query_resource('monitoring', lookup=lookup)

    for m in monitoring:
        company = m.get('company', None)
        if company:
            m['product_type'] = 'monitoring'
            m['companies'] = [str(company)]
            results.append(m)

    return sorted(results, key=lambda k: (k['product_type'], k['name']))


def get_section_name(section):
    return next((sec for sec in newsroom_app.sections if sec.get('_id') == section), {}).get('name') or section


def get_user_names(users):
    enabled_users = []
    disabled_users = []
    for u in users:
        if not u.get('is_enabled'):
            disabled_users.append('{} {} ({})'.format(u.get('first_name'), u.get('last_name'), u.get('email')))
        else:
            enabled_users.append('{} {} ({})'.format(u.get('first_name'), u.get('last_name'), u.get('email')))
    return {'enabled_users': enabled_users, 'disabled_users': disabled_users}


def get_company_saved_searches():
    """ Returns number of saved searches by company """
    args = deepcopy(request.args.to_dict())

    results = []
    company_topics = defaultdict(int)
    lookup = {'company': ObjectId(args.get('company'))} if args.get('company') else None
    users = get_entity_dict(query_resource('users', lookup=lookup))
    topics = query_resource('topics')

    for topic in topics:
        company = users.get(topic.get('user', ''), {}).get('company')
        if company:
            company_topics[company] += 1

    if args.get('aggregations'):
        return {'companies': [str(company) for company in company_topics]}

    lookup = {'_id': ObjectId(args.get('company'))} if args.get('company') else None
    companies = get_entity_dict(query_resource('companies', lookup=lookup))

    for _id, topic_count in company_topics.items():
        results.append({
            '_id': _id,
            'name': companies.get(_id, {}).get('name'),
            'is_enabled': companies.get(_id, {}).get('is_enabled'),
            'topic_count': topic_count
        })

    sorted_results = sorted(results, key=lambda k: k['name'])
    response = {'results': sorted_results, 'name': gettext('Saved searches per company')}
    if args.get('export'):
        header_map = {'_id': 'ID', 'name': 'Company', 'is_enabled': 'Is Enabled',
                      'topic_count': 'Number of Saved Searches'}
        csv_results = [dict(zip(map(lambda x: header_map[x], r.keys()), r.values())) for r in sorted_results]
        response = {
            'headers': ['Company', 'Is Enabled', 'Number of Saved Searches'],
            'results': csv_results
        }
    return response


def get_user_saved_searches():
    """ Returns number of saved searches by user """
    args = deepcopy(request.args.to_dict())

    results = []
    lookup = {}
    user_topics = defaultdict(int)
    if args.get('company'):
        lookup = {'company': ObjectId(args.get('company'))}
    if args.get('user'):
        lookup = {'_id': args.get('user')}
    users = get_entity_dict(query_resource('users', lookup=lookup))
    topics = query_resource('topics')

    for topic in topics:
        company = users.get(topic.get('user', ''), {}).get('company')
        if company:
            user_topics[topic['user']] += 1

    if args.get('aggregations'):
        response = get_company_saved_searches()
        response['users'] = [str(user) for user in user_topics]
        return response

    lookup = {'_id': ObjectId(args.get('company'))} if args.get('company') else None
    companies = get_entity_dict(query_resource('companies', lookup=lookup))

    for _id, topic_count in user_topics.items():
        results.append({
            '_id': _id,
            'name': '{} {}'.format(users.get(_id, {}).get('first_name'), users.get(_id, {}).get('last_name')),
            'last_name': users.get(_id, {}).get('last_name'),
            'is_enabled': users.get(_id, {}).get('is_enabled'),
            'company': companies.get(users.get(_id, {}).get('company', ''), {}).get('name'),
            'topic_count': topic_count
        })

    sorted_results = sorted(results, key=lambda k: (k['company'], k['last_name']))
    response = {'results': sorted_results, 'name': gettext('Saved searches per user')}
    if args.get('export'):
        header_map = {'_id': 'ID', 'name': 'User', 'last_name': 'Surname', 'is_enabled': 'Is Enabled',
                      'company': 'Company', 'topic_count': 'Number of Saved Searches'}
        csv_results = [dict(zip(map(lambda x: header_map[x], r.keys()), r.values())) for r in sorted_results]
        response = {
            'headers': ['Company', 'User', 'Is Enabled', 'Number of Saved Searches'],
            'results': csv_results
        }
    return response


def get_company_products():
    """ Returns products by company """
    args = deepcopy(request.args.to_dict())

    results = []
    company_products = {}
    lookup = {'_id': ObjectId(args.get('company'))} if args.get('company') else None
    companies = get_entity_dict(query_resource('companies', lookup=lookup))
    products = get_products(args)

    for product in products:
        for company in product.get('companies', []):
            company_product = company_products.get(company, {})
            products = company_product.get('products', [])
            p = {'_id': product.get('_id', None), 'name': product.get('name', None),
                 'product_type': product.get('product_type', None), 'is_enabled': product.get('is_enabled', False),
                 'query': product.get('query', None)}
            products.append(p)
            company_product['products'] = products
            company_products[company] = company_product

    if args.get('aggregations'):
        return {'companies': [company for company in company_products]}

    for _id, details in company_products.items():
        if companies.get(ObjectId(_id)):
            results.append({
                '_id': _id,
                'name': companies[ObjectId(_id)]['name'],
                'is_enabled': companies[ObjectId(_id)]['is_enabled'],
                'products': details.get('products', [])
            })

    sorted_results = sorted(results, key=lambda k: k['name'])
    response = {'results': sorted_results, 'name': gettext('Products per company')}
    if args.get('export'):
        header_map = {'_id': 'ID', 'name': 'Company', 'is_enabled': 'Company Enabled', 'products': 'Products'}
        mapped_results = [dict(zip(map(lambda x: header_map[x], r.keys()), r.values())) for r in sorted_results]
        csv_results = []
        for r in mapped_results:
            sorted_products = sorted(r.get('Products', []), key=lambda k: (k['product_type'], k['name']))
            for p in sorted_products:
                product = {'Section': get_section_name(p.get('product_type')), 'Product': p.get('name'),
                           'Product Enabled': p.get('is_enabled'),
                           'Query': p.get('query') if args.get('showQueries') else None}
                result = deepcopy(r)
                result.update(product)
                csv_results.append(result)

        response = {
            'headers': ['Company', 'Company Enabled', 'Section', 'Product', 'Product Enabled',
                        'Query' if args.get('showQueries') else None],
            'results': csv_results
        }
    return response


def get_product_stories():
    """ Returns the story count per product for today, this week, this month ..."""
    args = deepcopy(request.args.to_dict())
    results = []
    products = get_products(args)

    if args.get('aggregations'):
        return {'products': [str(product.get('_id', None)) for product in products]}

    section_filters = superdesk.get_resource_service('section_filters').get_section_filters_dict()

    for product in products:
        product_stories = {
            '_id': product['_id'],
            'name': product.get('name'),
            'is_enabled': product.get('is_enabled'),
            'product_type': product.get('product_type'),
        }
        counts = superdesk.get_resource_service('wire_search').get_product_item_report(product, section_filters)
        for key, value in counts.hits['aggregations'].items():
            product_stories[key] = value['buckets'][0]['doc_count']

        results.append(product_stories)

    response = {'results': results, 'name': gettext('Stories per product')}
    if args.get('export'):
        header_map = {'_id': 'ID', 'product_type': 'Section', 'name': 'Product', 'is_enabled': 'Is Enabled',
                      'today': 'Today', 'last_24_hours': 'Last 24 hours', 'this_week': 'This week',
                      'last_7_days': 'Last 7 days', 'this_month': 'This month', 'previous_month': 'Previous month',
                      'last_6_months': 'Last 6 months'}
        mapped_results = [dict(zip(map(lambda x: header_map[x], r.keys()), r.values())) for r in results]
        csv_results = []
        for r in mapped_results:
            r['Section'] = get_section_name(r.get('Section', ''))
            csv_results.append(r)
        response = {
            'headers': ['Section', 'Product', 'Is Enabled', 'Today', 'Last 24 hours', 'This week', 'Last 7 days',
                        'This month', 'Previous month', 'Last 6 months'],
            'results': csv_results
        }
    return response


def get_company_report():
    """ Returns products by company """
    args = deepcopy(request.args.to_dict())
    terms = []
    lookup = {}
    if args.get('company'):
        terms.append({'_id': ObjectId(args.get('company'))})
    if args.get('status'):
        terms.append({'is_enabled': superdesk.default_settings.strtobool(args.get('status'))})
    if args.get('account_manager'):
        if args.get('account_manager') == 'None':
            terms.append({'$or': [{'account_manager': ''}, {'account_manager': {'$exists': 0}}]})
        else:
            terms.append({'account_manager': args.get('account_manager')})

    if len(terms) > 0:
        lookup = {'$and': terms}

    results = []
    company_products = {}
    companies = get_entity_dict(query_resource('companies', lookup=lookup))
    products = get_products(args)

    for product in products:
        for company in product.get('companies', []):
            company_product = company_products.get(ObjectId(company), {})
            products = company_product.get('products', [])
            p = {'_id': product.get('_id', None), 'name': product.get('name', None),
                 'product_type': product.get('product_type', None)}
            products.append(p)
            company_product['products'] = products
            company_products[ObjectId(company)] = company_product

    for _id, details in companies.items():
        users = list(query_resource('users', lookup={'company': _id}))
        company_product = []
        if company_products.get(_id):
            company_product = company_products[_id].get('products', [])
        if not args.get('section') or (args.get('section') and len(company_product) > 0):
            u = sorted([{'is_enabled': u.get('is_enabled', False), 'first_name': u.get('first_name', None),
                         'last_name': u.get('last_name', None), 'email': u.get('email', None)} for u in users],
                       key=lambda k: k['last_name'])
            c = {'_created': details.get('_created', None), 'expiry_date': details.get('expiry_date', None),
                 'contact_name': details.get('contact_name', None), 'contact_email': details.get('contact_email', None),
                 'phone': details.get('phone', None)}
            results.append({
                '_id': str(_id),
                'name': details['name'],
                'is_enabled': details['is_enabled'],
                'products': company_product,
                'users': u,
                'company': c,
                'account_manager': details.get('account_manager'),
            })

    sorted_results = sorted(results, key=lambda k: k['name'])
    response = {'results': sorted_results, 'name': gettext('Company')}
    if args.get('export'):
        header_map = {'_id': 'ID', 'name': 'Company', 'is_enabled': 'Is Enabled', 'products': 'Products',
                      'users': 'Users', 'company': 'Details', 'account_manager': 'Account Manager'}
        mapped_results = [dict(zip(map(lambda x: header_map[x], r.keys()), r.values())) for r in sorted_results]
        csv_results = []
        for r in mapped_results:
            users = get_user_names(r.get('Users', []))
            details = r.get('Details', {})
            r['Created'] = details.get('_created')
            r['Expiry Date'] = details.get('expiry_date')
            r['Enabled users'] = '\r\n'.join(users.get('enabled_users', []))
            r['Disabled users'] = '\r\n'.join(users.get('disabled_users', []))
            r['Contact'] = '{} ({}) Tel: {}'.format(details.get('contact_name'), details.get('contact_email'),
                                                    details.get('phone'))
            r['Products'] = get_product_names(r.get('Products', []))
            csv_results.append(r)
        response = {
            'headers': ['Company', 'Is Enabled', 'Account Manager', 'Created', 'Expiry Date', 'Contact',
                        'Enabled users', 'Disabled users', 'Products'],
            'results': csv_results
        }
    return response


def get_subscriber_activity_report():
    args = deepcopy(request.args.to_dict())

    # Elastic query
    aggregations = {'action': {'terms': {'field': 'action', 'size': 0}}}
    must_terms = []
    source = {}

    if args.get('company'):
        must_terms.append({'term': {'company': args.get('company')}})

    if args.get('action'):
        must_terms.append({'term': {'action': args.get('action')}})

    if args.get('section'):
        must_terms.append({'term': {'section': args.get('section')}})

    date_range = get_date_filters(args)
    if date_range.get('gt') or date_range.get('lt'):
        must_terms.append({"range": {"versioncreated": date_range}})

    source['sort'] = [{'versioncreated': 'desc'}]
    if len(must_terms) > 0:
        source['query'] = {'bool': {'must': must_terms}}

    source['size'] = 25
    source['from'] = int(args.get('from', 0))
    source['aggs'] = aggregations

    if source['from'] >= 1000:
        # https://www.elastic.co/guide/en/elasticsearch/guide/current/pagination.html#pagination
        return abort(400)

    # Get the results
    results = superdesk.get_resource_service('history').fetch_history(source, args.get('export'))
    docs = results['items']
    hits = results['hits']

    # Enhance the results
    wire_ids = []
    agenda_ids = []
    company_ids = []
    user_ids = []
    for doc in docs:
        if doc.get('section') == 'agenda':
            agenda_ids.append(doc.get('item'))
        else:
            wire_ids.append(doc.get('item'))

        company_ids.append(ObjectId(doc.get('company')))
        user_ids.append(ObjectId(doc.get('user')))

    agenda_items = get_entity_dict(get_items_by_id(agenda_ids, 'agenda'))
    wire_items = get_entity_dict(get_items_by_id(wire_ids, 'items'))
    company_items = get_entity_dict(get_items_by_id(company_ids, 'companies'), True)
    user_items = get_entity_dict(get_items_by_id(user_ids, 'users'), True)

    for doc in docs:
        if doc.get('item') in wire_items:
            doc['item'] = {
                'item_text': wire_items[doc['item']].get('headline'),
                '_id': wire_items[doc['item']]['_id'],
                'item_href': '/{}?item={}'.format(doc['section'] if doc['section'] != 'news_api' else 'wire',
                                                  doc['item'])
            }
        elif doc.get('item') in agenda_items:
            doc['item'] = {
                'item_text': (agenda_items[doc['item']].get('name') or agenda_items[doc['item']].get('slugline')),
                '_id': agenda_items[doc['item']]['_id'],
                'item_href': '/agenda?item={}'.format(doc['item'])
            }

        if doc.get('company') in company_items:
            doc['company'] = company_items[doc.get('company')].get('name')

        if doc.get('user') in user_items:
            user = user_items[doc.get('user')]
            doc['user'] = "{0} {1}".format(user.get('first_name'), user.get('last_name'))

        doc['section'] = get_section_name(doc['section'])
        doc['action'] = doc['action'].capitalize() if doc['action'].lower() != 'api' else 'API retrieval'

    response = {
        'results': docs,
        'name': gettext('SubscriberActivity'),
        'aggregations': hits.get('aggregations')
    }
    if args.get('export'):
        csv_results = []
        for doc in docs:
            row = {
                'Company': doc.get('company'),
                'Section': doc.get('section'),
                'Item': (doc.get('item') or {})['item_text'],
                'Action': doc.get('action'),
                'User': doc.get('user'),
                'Created': doc.get('versioncreated').strftime('%H:%M %d/%m/%y'),
            }
            csv_results.append(row)
        response = {
            'headers': ['Company', 'Section', 'Item', 'Action', 'User', 'Created'],
            'results': csv_results
        }

    return response


def get_company_api_usage():
    args = deepcopy(request.args.to_dict())
    date_range = get_date_filters(args)

    if not date_range.get('gt') and date_range.get('lt'):
        abort(400, 'No date range specified.')

    source = {}
    must_terms = [{"range": {"created": date_range}}]
    source['query'] = {'bool': {'must': must_terms}}
    source['sort'] = [{'created': 'desc'}]
    source['size'] = 200
    source['from'] = int(args.get('from', 0))
    source['aggs'] = {"items": {
        "aggs": {
            "endpoints": {
                "terms": {
                    "size": 0,
                    "field": "endpoint"
                }
            }
        },
        "terms": {
            "size": 0,
            "field": "subscriber"
        }
    }}
    company_ids = [t['company'] for t in query_resource(API_TOKENS)]
    source['query']['bool']['must'].append({"terms": {"subscriber": company_ids}})
    companies = get_entity_dict(query_resource('companies', lookup={'_id': {'$in': company_ids}}), str_id=True)
    req = ParsedRequest()
    req.args = {'source': json.dumps(source)}

    if source['from'] >= 1000:
        # https://www.elastic.co/guide/en/elasticsearch/guide/current/pagination.html#pagination
        return abort(400)

    unique_endpoints = []
    search_result = superdesk.get_resource_service('api_audit').get(req, None)
    results = format_report_results(search_result, unique_endpoints, companies)

    response = {
        'results': results,
        'name': gettext('Company News API Usage'),
        'result_headers': unique_endpoints,
    }
    if args.get('export'):
        csv_results = []
        for r in results:
            result = {'Company': r}
            result.update(results[r])
            csv_results.append(result)

        response = {
            'headers': ['Company'] + unique_endpoints,
            'results': csv_results
        }

    return response


def get_product_company():
    args = deepcopy(request.args.to_dict())
    products = get_products(args)

    if args.get('aggregations'):
        return {'products': [str(product.get('_id', None)) for product in products]}

    res = [{
        '_id': product.get('_id'),
        'product': product.get('name'),
        'product_type': product.get('product_type'),
        'companies': product.get('companies', [])} for
        product in products]

    for r in res:
        r.update(get_company_names(r.get('companies', [])))

    response = {
        'results': res,
        'name': gettext('Companies permissioned per product')
    }
    if args.get('export'):
        header_map = {'_id': 'ID', 'product': 'Product', 'product_type': 'Section', 'companies': 'Companies',
                      'enabled_companies': 'Enabled Companies', 'disabled_companies': 'Disabled Companies'}
        mapped_results = [dict(zip(map(lambda x: header_map[x], r.keys()), r.values())) for r in res]
        csv_results = []
        for r in mapped_results:
            r['Section'] = get_section_name(r.get('Section', ''))
            r['Enabled Companies'] = '\r\n'.join(r.get('Enabled Companies', []))
            r['Disabled Companies'] = '\r\n'.join(r.get('Disabled Companies', []))
            csv_results.append(r)

        response = {
            'headers': ['Section', 'Product', 'Enabled Companies', 'Disabled Companies'],
            'results': csv_results
        }

    return response


def get_expired_companies():
    args = deepcopy(request.args.to_dict())
    lookup = {'expiry_date': {'$lte': utcnow().replace(hour=0, minute=0, second=0)},
              'is_enabled': superdesk.default_settings.strtobool(args.get('status')) if args.get('status') else {
                  '$exists': True}}

    expired = [{'_id': company.get('_id'),
                'name': company.get('name'),
                'is_enabled': company.get('is_enabled'),
                '_created': company.get('_created'),
                'expiry_date': company.get('expiry_date')}
               for company in list(superdesk.get_resource_service('companies').find(lookup))]

    response = {
        'results': expired,
        'name': gettext('Expired companies')
    }
    if args.get('export'):
        header_map = {'_id': 'ID', 'name': 'Company', 'is_enabled': 'Is Enabled', '_created': 'Created',
                      'expiry_date': 'Expiry Date'}
        csv_results = [dict(zip(map(lambda x: header_map[x], r.keys()), r.values())) for r in expired]

        response = {
            'headers': ['Company', 'Is Enabled', 'Created', 'Expiry Date'],
            'results': csv_results
        }
    return response
