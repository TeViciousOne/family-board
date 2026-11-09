/* Weather from Open-Meteo (free, no account or key needed). Cached so the board still shows something offline. */
(function (root) {
  'use strict';
  var FB = (root.FB = root.FB || {});
  var W = (FB.weather = {});
  var CACHE_KEY = 'fb.weather.v2';
  var MAX_AGE = 25 * 60 * 1000; /* refresh after 25 minutes */

  W.DEFAULT_PLACE = { name: 'Tirana', country: 'Albania', lat: 41.3275, lon: 19.8187 };

  /* WMO weather code -> icon kind + translation key */
  W.kindOf = function (code, isDay) {
    if (code === 0) return isDay === 0 ? 'moon' : 'sun';
    if (code === 1) return isDay === 0 ? 'moon' : 'sun';
    if (code === 2) return 'partly';
    if (code === 3) return 'cloud';
    if (code === 45 || code === 48) return 'fog';
    if (code >= 51 && code <= 57) return 'drizzle';
    if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
    if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
    if (code >= 95) return 'storm';
    return 'cloud';
  };
  W.labelKey = function (code) {
    if (code === 0) return 'wx.clear';
    if (code === 1) return 'wx.mostlyClear';
    if (code === 2) return 'wx.partly';
    if (code === 3) return 'wx.cloudy';
    if (code === 45 || code === 48) return 'wx.fog';
    if (code >= 51 && code <= 57) return 'wx.drizzle';
    if ((code >= 61 && code <= 67)) return 'wx.rain';
    if (code >= 80 && code <= 82) return 'wx.showers';
    if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'wx.snow';
    if (code >= 95) return 'wx.storm';
    return 'wx.cloudy';
  };

  /* small inline icons; they use currentColor for the cloud and fixed warm/cool accents */
  var SVG = {
    sun: '<circle cx="32" cy="32" r="11" fill="#F2B531"/><g stroke="#F2B531" stroke-width="4" stroke-linecap="round"><path d="M32 8v7M32 49v7M8 32h7M49 32h7M15 15l5 5M44 44l5 5M15 49l5-5M44 20l5-5"/></g>',
    moon: '<path d="M40 10a22 22 0 1 0 14 38A18 18 0 0 1 40 10z" fill="#C9D3E6"/>',
    cloud: '<path d="M18 46a10 10 0 0 1 1-20 14 14 0 0 1 27 3 8.5 8.5 0 0 1-1 17z" fill="currentColor" opacity=".78"/>',
    partly: '<circle cx="24" cy="25" r="9" fill="#F2B531"/><g stroke="#F2B531" stroke-width="3.5" stroke-linecap="round"><path d="M24 9v4M8 25h4M12.5 13.5l3 3M35.5 13.5l-3 3"/></g><path d="M23 50a9 9 0 0 1 1-18 12.5 12.5 0 0 1 24 3 7.5 7.5 0 0 1-1 15z" fill="currentColor" opacity=".8"/>',
    fog: '<g stroke="currentColor" stroke-width="4" stroke-linecap="round" opacity=".7"><path d="M12 24h40M8 34h40M14 44h38"/></g>',
    drizzle: '<path d="M18 36a9 9 0 0 1 1-18 13 13 0 0 1 25 3 7.5 7.5 0 0 1-1 15z" fill="currentColor" opacity=".78"/><g stroke="#3E8FD8" stroke-width="3.5" stroke-linecap="round"><path d="M24 44v4M34 44v4M44 44v4"/></g>',
    rain: '<path d="M18 34a9 9 0 0 1 1-18 13 13 0 0 1 25 3 7.5 7.5 0 0 1-1 15z" fill="currentColor" opacity=".78"/><g stroke="#3E8FD8" stroke-width="4" stroke-linecap="round"><path d="M22 42l-3 9M33 42l-3 9M44 42l-3 9"/></g>',
    snow: '<path d="M18 34a9 9 0 0 1 1-18 13 13 0 0 1 25 3 7.5 7.5 0 0 1-1 15z" fill="currentColor" opacity=".78"/><g fill="#8FB8E8"><circle cx="22" cy="46" r="3"/><circle cx="33" cy="50" r="3"/><circle cx="44" cy="46" r="3"/></g>',
    storm: '<path d="M18 34a9 9 0 0 1 1-18 13 13 0 0 1 25 3 7.5 7.5 0 0 1-1 15z" fill="currentColor" opacity=".85"/><path d="M34 36l-8 12h7l-3 10 11-15h-7l3-7z" fill="#F2B531"/>'
  };
  W.icon = function (kind, size) {
    var s = size || 48;
    return '<svg class="wx-icon" width="' + s + '" height="' + s + '" viewBox="0 0 64 64" aria-hidden="true">' + (SVG[kind] || SVG.cloud) + '</svg>';
  };

  /* hours from the current hour onwards (device clock), at most n */
  W.hoursFrom = function (data, n) {
    var d = new Date(), pad = function (x) { return String(x).padStart(2, '0'); };
    var cut = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':00';
    return ((data && data.hours) || []).filter(function (h) { return h.time >= cut; }).slice(0, n);
  };

  function readCache() {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); } catch (e) { return null; }
  }
  function placeKey(p) { return p.lat.toFixed(3) + ',' + p.lon.toFixed(3); }

  /* returns {data, fetchedAt, stale} ; never throws */
  W.load = function (place, force) {
    var cache = readCache();
    var key = placeKey(place);
    var fresh = cache && cache.key === key && Date.now() - cache.fetchedAt < MAX_AGE;
    if (fresh && !force) return Promise.resolve({ data: cache.data, fetchedAt: cache.fetchedAt, stale: false });

    var url = 'https://api.open-meteo.com/v1/forecast?latitude=' + place.lat + '&longitude=' + place.lon +
      '&current=temperature_2m,apparent_temperature,weather_code,is_day,wind_speed_10m' +
      '&hourly=temperature_2m,weather_code,precipitation_probability,is_day' +
      '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max' +
      '&forecast_days=7&timezone=auto';
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error('weather ' + r.status);
      return r.json();
    }).then(function (json) {
      var data = {
        current: {
          temp: json.current.temperature_2m, feels: json.current.apparent_temperature,
          code: json.current.weather_code, isDay: json.current.is_day, wind: json.current.wind_speed_10m
        },
        /* next 48 hours, local times like '2026-11-09T14:00'; the view picks the ones from "now" on */
        hours: json.hourly ? json.hourly.time.slice(0, 48).map(function (t, i) {
          return {
            time: t, temp: json.hourly.temperature_2m[i], code: json.hourly.weather_code[i],
            rain: json.hourly.precipitation_probability ? json.hourly.precipitation_probability[i] : null, isDay: json.hourly.is_day ? json.hourly.is_day[i] : 1
          };
        }) : [],
        days: json.daily.time.map(function (t, i) {
          return {
            date: t, code: json.daily.weather_code[i], max: json.daily.temperature_2m_max[i],
            min: json.daily.temperature_2m_min[i], rain: json.daily.precipitation_probability_max ? json.daily.precipitation_probability_max[i] : null
          };
        })
      };
      var entry = { key: key, fetchedAt: Date.now(), data: data };
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(entry)); } catch (e) { /* storage full or blocked */ }
      return { data: data, fetchedAt: entry.fetchedAt, stale: false };
    }).catch(function () {
      if (cache && cache.key === key) return { data: cache.data, fetchedAt: cache.fetchedAt, stale: true };
      return { data: null, fetchedAt: 0, stale: true };
    });
  };

  W.searchCity = function (name, lang) {
    var q = String(name || '').trim();
    if (q.length < 2) return Promise.resolve([]);
    var url = 'https://geocoding-api.open-meteo.com/v1/search?name=' + encodeURIComponent(q) +
      '&count=6&language=' + (lang === 'sq' ? 'sq' : 'en') + '&format=json';
    return fetch(url).then(function (r) { return r.ok ? r.json() : { results: [] }; }).then(function (j) {
      return (j.results || []).map(function (r) {
        return { name: r.name, country: r.country || '', region: r.admin1 || '', lat: r.latitude, lon: r.longitude };
      });
    }).catch(function () { return []; });
  };
})(typeof window !== 'undefined' ? window : globalThis);
