// Keyword → OpenStreetMap tag mapping for the niches lead-gen users search most.
export const CATEGORY_TAGS = {
  dentist: [['amenity', 'dentist'], ['healthcare', 'dentist']],
  doctor: [['amenity', 'doctors'], ['healthcare', 'doctor']],
  physio: [['healthcare', 'physiotherapist']],
  physiotherapist: [['healthcare', 'physiotherapist']],
  chiropractor: [['healthcare', 'chiropractor']],
  veterinarian: [['amenity', 'veterinary']],
  vet: [['amenity', 'veterinary']],
  pharmacy: [['amenity', 'pharmacy']],
  optician: [['shop', 'optician']],
  restaurant: [['amenity', 'restaurant']],
  cafe: [['amenity', 'cafe']],
  coffee: [['amenity', 'cafe']],
  bar: [['amenity', 'bar'], ['amenity', 'pub']],
  pub: [['amenity', 'pub']],
  takeaway: [['amenity', 'fast_food']],
  'fast food': [['amenity', 'fast_food']],
  bakery: [['shop', 'bakery']],
  butcher: [['shop', 'butcher']],
  hotel: [['tourism', 'hotel']],
  'bed and breakfast': [['tourism', 'guest_house']],
  gym: [['leisure', 'fitness_centre'], ['amenity', 'gym']],
  'personal trainer': [['leisure', 'fitness_centre']],
  yoga: [['leisure', 'fitness_centre'], ['sport', 'yoga']],
  spa: [['leisure', 'spa'], ['shop', 'beauty']],
  salon: [['shop', 'hairdresser'], ['shop', 'beauty']],
  hairdresser: [['shop', 'hairdresser']],
  barber: [['shop', 'hairdresser']],
  'beauty salon': [['shop', 'beauty']],
  'nail salon': [['shop', 'beauty']],
  tattoo: [['shop', 'tattoo']],
  plumber: [['craft', 'plumber']],
  electrician: [['craft', 'electrician']],
  builder: [['craft', 'builder'], ['craft', 'carpenter']],
  carpenter: [['craft', 'carpenter']],
  roofer: [['craft', 'roofer']],
  painter: [['craft', 'painter']],
  landscaper: [['craft', 'gardener'], ['shop', 'garden_centre']],
  gardener: [['craft', 'gardener']],
  locksmith: [['craft', 'locksmith'], ['shop', 'locksmith']],
  cleaner: [['shop', 'dry_cleaning'], ['shop', 'laundry'], ['craft', 'cleaning']],
  'cleaning company': [['craft', 'cleaning'], ['office', 'company']],
  mechanic: [['shop', 'car_repair']],
  'car repair': [['shop', 'car_repair']],
  'car dealer': [['shop', 'car']],
  'car wash': [['amenity', 'car_wash']],
  'estate agent': [['office', 'estate_agent']],
  realtor: [['office', 'estate_agent']],
  lawyer: [['office', 'lawyer'], ['amenity', 'lawyer']],
  solicitor: [['office', 'lawyer']],
  accountant: [['office', 'accountant']],
  bookkeeper: [['office', 'accountant']],
  insurance: [['office', 'insurance']],
  'financial advisor': [['office', 'financial_advisor'], ['office', 'financial']],
  architect: [['office', 'architect']],
  'marketing agency': [['office', 'advertising_agency'], ['office', 'marketing']],
  'advertising agency': [['office', 'advertising_agency']],
  'it company': [['office', 'it'], ['office', 'company']],
  'web design': [['office', 'it'], ['office', 'advertising_agency']],
  'travel agent': [['shop', 'travel_agency']],
  florist: [['shop', 'florist']],
  jeweller: [['shop', 'jewelry']],
  photographer: [['craft', 'photographer'], ['shop', 'photo']],
  printer: [['shop', 'copyshop'], ['craft', 'printer']],
  'driving school': [['amenity', 'driving_school']],
  school: [['amenity', 'school']],
  nursery: [['amenity', 'kindergarten']],
  childcare: [['amenity', 'childcare'], ['amenity', 'kindergarten']],
  'funeral director': [['shop', 'funeral_directors']],
  'pet groomer': [['shop', 'pet_grooming']],
  'pet shop': [['shop', 'pet']],
  furniture: [['shop', 'furniture']],
  hardware: [['shop', 'hardware'], ['shop', 'doityourself']],
  supermarket: [['shop', 'supermarket']],
  'clothing store': [['shop', 'clothes']],
  'shoe shop': [['shop', 'shoes']],
  'bike shop': [['shop', 'bicycle']],
  'phone repair': [['shop', 'mobile_phone'], ['shop', 'electronics']],
  'storage': [['shop', 'storage_rental']],
  'removals': [['office', 'moving_company']],
  'security company': [['office', 'security'], ['shop', 'security']],
};

/** Keys worth scanning when a keyword isn't in the curated map. */
export const GENERIC_KEYS = ['shop', 'amenity', 'office', 'craft', 'healthcare', 'leisure', 'tourism', 'cuisine'];

export function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\"]/g, '\\$&');
}

/** Exact tag pairs for a keyword, or [] when we should fall back to regex search. */
export function tagsForKeyword(keyword) {
  const key = String(keyword).trim().toLowerCase();
  if (CATEGORY_TAGS[key]) return CATEGORY_TAGS[key];
  const singular = key.replace(/(?:ies)$/, 'y').replace(/s$/, '');
  if (CATEGORY_TAGS[singular]) return CATEGORY_TAGS[singular];
  const partial = Object.keys(CATEGORY_TAGS).find((k) => key.includes(k) || k.includes(key));
  return partial ? CATEGORY_TAGS[partial] : [];
}

/** Human-readable category from an OSM tag bag. */
export function categoryFromTags(tags = {}) {
  for (const key of ['shop', 'amenity', 'office', 'craft', 'healthcare', 'leisure', 'tourism']) {
    if (tags[key] && tags[key] !== 'yes') return String(tags[key]).replace(/_/g, ' ');
  }
  return tags.cuisine ? String(tags.cuisine).replace(/[_;]/g, ' ') : '';
}
