const enMain = require("./en/main.json");
const enNavigate = require("./en/navigate.json");
const enOnboarding = require("./en/onboarding.json");
const enPlace = require("./en/place.json");
const enRoutePlanning = require("./en/routePlanning.json");
const enSearch = require("./en/search.json");
const enSettings = require("./en/settings.json");
const enTripHistory = require("./en/trip_history.json");
const enPoiSearch = require("./en/poi_search.json");
const frMain = require("./fr/main.json");
const frNavigate = require("./fr/navigate.json");
const frOnboarding = require("./fr/onboarding.json");
const frPlace = require("./fr/place.json");
const frRoutePlanning = require("./fr/routePlanning.json");
const frSearch = require("./fr/search.json");
const frSettings = require("./fr/settings.json");
const frTripHistory = require("./fr/trip_history.json");
const frPoiSearch = require("./fr/poi_search.json");

const enShareLocation = require("./en/share_location.json");
const enShareLocationView = require("./en/share_location_view.json");
const frShareLocation = require("./fr/share_location.json");
const frShareLocationView = require("./fr/share_location_view.json");
const enStopDetails = require("./en/stop_details.json");
const frStopDetails = require("./fr/stop_details.json");

const translations = {
  fr: {
    onboarding: frOnboarding,
    main: frMain,
    routePlanning: frRoutePlanning,
    navigate: frNavigate,
    search: frSearch,
    settings: frSettings,
    place: frPlace,
    trip_history: frTripHistory,
    poi_search: frPoiSearch,
    share_location: frShareLocation,
    share_location_view: frShareLocationView,
    stop_details: frStopDetails,
  },
  en: {
    onboarding: enOnboarding,
    main: enMain,
    routePlanning: enRoutePlanning,
    navigate: enNavigate,
    search: enSearch,
    settings: enSettings,
    place: enPlace,
    trip_history: enTripHistory,
    poi_search: enPoiSearch,
    share_location: enShareLocation,
    share_location_view: enShareLocationView,
    stop_details: enStopDetails,
  },
};

export default translations;
