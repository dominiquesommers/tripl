import json


trips = [{'id': 1, 'name': 'Wereldreis'}]
plans = [{'id': 27, 'name': 'v1.3 Borneo met Marit', 'start_date': '2026-04-23', 'note': None, 'priority': -3.5,
          'lat': 111.53775498472487, 'lng': 1.1009214790479405, 'zoom': 5.464522016500074, 'trip_id': 1}]

countries = []
with open('public/mocks/countries.json', 'r') as json_file:
  data = json.load(json_file)
  for id, raw_country in data.items():
    countries.append({'id': id, 'name': raw_country['name']})

seasons = []
with open('public/mocks/seasons.json', 'r') as json_file:
  data = json.load(json_file)
  for id, raw_season in data.items():
    raw_season['country_id'] = raw_season.pop('country')
    seasons.append({'id': id, **raw_season})

places = []
with open('public/mocks/places.json', 'r') as json_file:
  data = json.load(json_file)
  for id, raw_place in data.items():
    places.append({
      'id': id,
      'name': raw_place['name'],
      'lat': raw_place['coordinates']['lat'],
      'lng': raw_place['coordinates']['lng'],
      'country_id': raw_place['country_id'],
      'season_id': raw_place['season_id'],
      'trip_id': 1,
      'accommodation_cost': raw_place['estimated_costs']['accommodation'],
      'food_cost': raw_place['estimated_costs']['food'],
      'miscellaneous_cost': raw_place['estimated_costs']['miscellaneous']
    })

routes = []
with open('public/mocks/routes.json', 'r') as json_file:
  data = json.load(json_file)
  for id, raw_route in data.items():
    route_str = str(raw_route['route']).replace(' ', '')
    routes.append({**raw_route, 'route': route_str})

visits = []
edges = []
with open('public/mocks/visits2.json', 'r') as json_file:
  data = json.load(json_file)
  for id, raw_visit in data.items():
    visits.append({
      'id': id,
      'place_id': raw_visit['place'],
      'plan_id': 27,
      'nights': raw_visit['nights'],
      'included': raw_visit['included']
    })
    for edge in raw_visit.get('outgoing_edges', []):
      edges.append({
        'id': f"{id}-{edge['destination_id']}-{edge['route_id']}",
        'source_visit_id': id,
        'target_visit_id': edge['destination_id'],
        'route_id': edge['route_id'],
        'priority': edge['priority'],
        'rent_until': edge['rent_until'],
        'includes_accommodation': edge['includes_accommodation'],
        'plan_id': 27
      })

activities = []
with open('public/mocks/activities.json', 'r') as json_file:
  data = json.load(json_file)
  for place_id, place_activities in data.items():
    for raw_activity in place_activities:
      activities.append({
        'id': raw_activity['id'],
        'place_id': raw_activity['place_id'],
        'description': '',
        'category': raw_activity['category'],
        'estimated_cost': raw_activity['estimated_cost'],
        'actual_cost': raw_activity['actual_cost'],
        'included': raw_activity['included'],
        'paid': raw_activity['paid'],
        'trip_id': 1
      })

place_notes = []
with open('public/mocks/place_notes.json', 'r') as json_file:
  data = json.load(json_file)
  for place_id, place_notes_ in data.items():
    for raw_place_note in place_notes_:
      place_notes.append({
        'id': raw_place_note['id'],
        'place_id': raw_place_note['place_id'],
        'description': '',
        'category': raw_place_note['category'],
        'estimated_cost': raw_place_note['estimated_cost'],
        'actual_cost': raw_place_note['actual_cost'],
        'included': raw_place_note['included'],
        'paid': raw_place_note['paid'],
        'trip_id': 1
      })

country_notes = []
with open('public/mocks/country_notes.json', 'r') as json_file:
  data = json.load(json_file)
  for country_id, country_notes_ in data.items():
    for raw_country_note in country_notes_:
      country_notes.append({
        'id': raw_country_note['id'],
        'country_id': raw_country_note['country_id'],
        'description': '',
        'category': raw_country_note['category'],
        'estimated_cost': raw_country_note['estimated_cost'],
        'actual_cost': raw_country_note['actual_cost'],
        'included': raw_country_note['included'],
        'paid': raw_country_note['paid'],
        'trip_id': 1
      })

route_notes = []
with open('public/mocks/route_notes.json', 'r') as json_file:
  data = json.load(json_file)
  for route_id, route_notes_ in data.items():
    for raw_route_note in route_notes_:
      route_notes.append({
        'id': raw_route_note['id'],
        'route_id': raw_route_note['route_id'],
        'description': '',
        'trip_id': 1
      })

with open('db.json', 'w', encoding='utf-8') as json_file:
  print(f'Wrote {len(trips)} trips, {len(plans)} plans, {len(countries)} countries, {len(seasons)} seasons, {len(places)} places, {len(routes)} routes, {len(visits)} visits, {len(edges)} edges, {len(activities)} activities, {len(place_notes)} place_notes, {len(country_notes)} country_notes, {len(route_notes)} route_notes to db.json.')
  json.dump({
    'trips': trips,
    'plans': plans,
    'countries': countries,
    'seasons': seasons,
    'places': places,
    'routes': routes,
    'visits': visits,
    'traverses': edges,
    'activities': activities,
    'place_notes': place_notes,
    'country_notes': country_notes,
    'route_notes': route_notes
  }, json_file, indent=2, ensure_ascii=False)
