# Live weather: Open-Meteo

The configured provider uses Open-Meteo's public geocoding and forecast APIs. The widget displays current temperature/condition and seven daily high/low forecasts, with attribution to Open-Meteo. No API key or account is bundled. The public endpoint is intended for personal/non-commercial use under Open-Meteo's terms; a commercial distribution should select the appropriate service plan before release.

Primary documentation: [forecast API](https://open-meteo.com/en/docs), [geocoding API](https://open-meteo.com/en/docs/geocoding-api), [terms](https://open-meteo.com/en/terms).

## Requests and privacy

- The typed city is sent to `https://geocoding-api.open-meteo.com/v1/search`. Use city plus country/admin area to disambiguate; the returned place/country is shown beside conditions.
- Resolved latitude/longitude are sent to `https://api.open-meteo.com/v1/forecast`. Requested fields are current `temperature_2m,weather_code` and daily `weather_code,temperature_2m_max,temperature_2m_min`, seven days, `timezone=auto`, `timeformat=unixtime`.
- Only these two exact HTTPS origins have host permissions and connect-src access. Cookies and referrers are omitted. No GPS, photos, video, notes, tasks, dashboard image or other dashboard data is sent.
- A city is saved locally and weather is requested when that widget opens/changes city. There is no request for an empty city. The UI discloses the city request before a reading is available and always provides attribution.

Current responses are cached in memory for 15 minutes per provider/city. Geocoded locations are cached for 24 hours. Both maps are bounded to 20 entries; weather snapshots are copied to prevent accidental cache mutation. Visible widgets check periodically at 15 minutes and on focus/online/visibility; fresh cache responses avoid unnecessary network requests. Refresh bypasses the weather cache. Each request chain has a 15-second timeout and respects abort on city change/unmount. Responses from an aborted city cannot overwrite a new city. Celsius/Fahrenheit changes do not fetch again.

Responses are validated for finite/bounded temperatures, known WMO codes, real timezone, seven unique consecutive local dates, matching arrays and high/low ordering. Forecast dates and today use the selected city's timezone. The current condition and update timestamp are genuine provider data. Offline, timeout, invalid city, malformed data and rate-limit/service errors stay explicit. A failed same-city refresh retains the current on-screen readings with a last-update message. Cache is not persisted across reloads: an offline fresh tab shows unavailable weather while local media/widgets remain usable.

## Verification

63 integrity tests include provider response/error parsing, cache/forced refresh/cancellation, exact request hosts, credentials/referrer omission, timezone dates and invalid forecast rejection. Browser fixture tests cover conditions, seven icon/high-low pills, conversion, refresh failure preservation and invalid-city recovery. A separate real service smoke test and an isolated installed Edge check fetched genuine current conditions and seven forecast days, verifying actual host grants/CSP. Network availability and provider data remain external dependencies.
