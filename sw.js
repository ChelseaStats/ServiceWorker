/**
 * Name of the cache.
 *
 * @type {string}
 */
const CACHE_NAME = 'zero';
const CACHE_VERSION = 'v1.0.2';
const OFFLINE_URL = 'offline.html';
const FOUR_OH_FOUR_URL = '404.html';
const CACHE_REF = CACHE_NAME + '::' + CACHE_VERSION;

/**
 * Service worker will be installed when all these are cached.
 *
 * @type {string[]}
 */
const CACHE_FILES_PRIORITY = [
    '/',
    'app.js',
    'app.css',
    'index.html',
    'offline.html',
];

/**
 * Added to the cache in their own time.
 *
 * @type {string[]}
 */
const CACHE_FILES_BACKGROUND = [
    'images/animated.gif'
];


/**
 * Update the cache with the files specified in `CACHE_FILES_PRIORITY`
 * and `CACHE_FILES_BACKGROUND` constants.
 *
 * @return {Promise}
 */
const updateCache = () => {
    return caches.open(CACHE_REF)
        .then((cache) => {
            cache.addAll(CACHE_FILES_BACKGROUND);
            return cache.addAll(CACHE_FILES_PRIORITY)
        });
};


/**
 * Any request that comes through we will be serving it from the cache.
 * If a request isn't in the cache, we serve `offline.html` instead.
 *
 * @return {Promise}
 */
const requestFromCache = (request) => {

    return caches.match(request)
        .then(response => {
            console.log(request);

            if (request.method !== 'GET') {
                return fetch(request);
            }

            if (request.headers.get('Accept').indexOf('text/html') !== -1) {
                // If a HTML request then we want to return the file from cache
                // OR the `offline.html` file if `undefined`
                return response || caches.match(FOUR_OH_FOUR_URL)
            }

            // All other responses we can check if it's in the cache and return
            // OR if `undefined` then return the request in hopes
            // we get something
            return response || fetch(request);
        })
        .catch(error => {
            // If the `fetch()` function didn't work then we can deal with
            // requests we cannot resolve.
            if (request.headers.get('Accept').indexOf('image') !== -1) {
                // If an image then we should return a placeholder.
                // Using an SVG like this means we aren't relying on any
                // external resource and provide feedback to the view.
                return new Response(
                    '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><text style="text-anchor: middle; font-family: sans-serif;" fill-opacity="0.25" x="50%" y="50%">image unavaliable offline</text></svg>',
                    {headers: {'Content-Type': 'image/svg+xml'}}
                );
            }
            return new Response();
        });
};


/**
 * Clears the cache if the key is different to the one specfied
 * in `CACHE_REF`.
 *
 * @return {Promise}
 */
const clearCache = () => {
    return caches.keys()
        .then(keys => {
            return Promise.all(keys.map((key, i) => {
                if (key !== CACHE_REF){
                    return caches.delete(keys[i]);
                }
            }))
        });
};


self.addEventListener('install', event => {
    event.waitUntil(updateCache());
});


// NOTE: the fetch event is triggered for every request on the page. So for every individual CSS, JS and image file.
self.addEventListener('fetch', (event) => {
    // only respond if navigating for a HTML page
    // see https://googlechrome.github.io/offline.html/service-worker/custom-offline-page/ for more details
    if (event.request.mode === 'navigate' ||
        (event.request.method === 'GET' && event.request.headers.get('accept').includes('text/html'))) {
        event.respondWith(
            // make sure the request we are making isn't in the cache
            fetch(createCacheBustedRequest(event.request.url))
                .then((response) =>{
                    // if the response has a 404 code, serve the 404 page
                    if(response.status === 404){
                        return caches.match(OFFLINE_URL);
                    } else {
                        // check see if the response is in the cache, if not fetch it from the network
                        return caches.match(event.request)
                            .then((response) => response || fetch(event.request));
                    }
                })
                // If catch is triggered fetch has thrown an exception meaning the server is most likely unreachable
                .catch((error) => caches.match(OFFLINE_URL))
        );
    } else {
        // respond to all the other fetch events
        event.respondWith(
            caches.match(event.request)
            // if the request is in the cache, send back the cached response. If not fetch from the network
                .then((response) => response || fetch(event.request))
        );
    }
});



self.addEventListener('activate', (event) => {
    // extend the events lifetime until the promise resolves
    event.waitUntil(
        // return a Promise that resolves to an array of cache names
        caches.keys()
            .then((cacheNames) => {
                // passes an array of values from all the promises in the iterable object
                return Promise.all(
                    // map over the cacheNames array
                    cacheNames.map((cacheName) => {
                        // if any existing caches don't match the current used cache, delete them
                        if (currentCacheNames.indexOf(cacheName) === -1) {
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
    );
});
