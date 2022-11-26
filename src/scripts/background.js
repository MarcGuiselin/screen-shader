// ============================
// Screen Shader
// Copyright 2022 Marc Guiselin
// ============================

const SELFURL = chrome.runtime.getURL('')
const DEFAULTCOLORS = [
        [255, 129, 0],
        [255, 147, 41],
        [255, 165, 0],
        [250, 197, 99],
        [241, 178, 116],
        [245, 83, 83],
        [197, 184, 145],
        [250, 229, 145],
        [245, 214, 91],
        [255, 191, 250],
        [145, 214, 243]
    ]
const MAXSHADE = .8
const MAXDARKNESS = .6

const LENGTHSLEEP = 9.18/24
const TRANSITIONSPEEDS = [0, .04/24, .3/24, 1/24, 1.6/24]
    
const DEFAULT_SETTINGS = {
        color: [255, 147, 41],
        customColors: [],
        enabled: true, // False if ss is not enabled, true if ss is enabled, or a time when screen shader should turn on
        
        colorBlending: 'multiply',
        transitionSpeed: 3,
        shadedScrollbar: true,
        shadeFullscreen: true,
        widerBlendingRange: false,

        hasLocation: false,
        locationName: '',
        latitude: 0,
        longitude: 0,

        darkness: 0,
        shadeDay: 0,
        shadeNight: 0.3,
        shadeSleep: 0.5,
        shadeNewAlgo: true,
        wakeupTime: 7.5/24,

        disabledSites: [], // 'example.com', '*://*.google.com/*'
        disableDeveloperWarning: false
    }
const DEFAULT_SAVED = {
        menuOpens: 0,

        showedLocationHint: false,
        warnedUserAboutNewTab: false
    }

// #region Functions
/**
 * Promisifies chrome.storage.local.get
 * @returns {Promise<Object>} containing all local storage objects
 */
const getLocalStorage = () => 
    new Promise(resolve => chrome.storage.local.get(null, resolve))

/**
 * Promisifies chrome.storage.local.get
 * @returns {Promise<undefined>}
 */
const setLocalStorage = (data) => 
    new Promise(resolve => chrome.storage.local.set(data, resolve))

/**
 * Sets the location setting using geoip data
 * Returned promise will wait for geoip fetch to fail or succeed, or 1500ms whichever comes first
 * @returns {Promise<undefined>}
 */
const setLocationFromGeoIp = () => 
    new Promise(async (resolve) => {
        setTimeout(resolve, 1500) // TODO: test

        try {
            const response = await fetch('http://www.geoplugin.net/json.gp')
            const json = await response.json()
        
            const geo = {}
            for(const key of Object.keys(json)){
                const simpkey = key.replace('geoplugin_', '')
                geo[simpkey] = ['latitude', 'longitude'].includes(simpkey) ? parseFloat(json[key]) : json[key]
            }
        
            if(geo.latitude && geo.longitude && geo.countryName){
                const { settings } = await getLocalStorage()
                settings.hasLocation = true
                settings.latitude = geo.latitude
                settings.longitude = geo.longitude
                if(!geo.city && !geo.regionCode)
                    settings.locationName = 'Unidentified public network in ' + geo.countryName
                else
                    settings.locationName = (geo.city || geo.regionName || geo.regionCode) + ', ' + geo.countryName
                await setLocalStorage({ settings })
            }else{
                throw Error()
            }
        }catch(error){
            const { settings } = await getLocalStorage()
            settings.hasLocation = false
            settings.locationName = 'Could not determine location'
            settings.latitude = 0
            settings.longitude = 0
            await setLocalStorage({ settings })
        }
        resolve()
    })

const isShadeableTab = (url) => 
    url.trim() && !url.includes('://chrome.google.com/webstore') && 
    !url.startsWith('chrome://') && !(url.startsWith('chrome-extension://') && !url.startsWith(SELFURL))

/**
 * Promisifies chrome.windows.getAll
 * @returns Promise<TabDetails[]>
 */
const getAllTabs = () => 
    new Promise(resolve => 
        chrome.windows.getAll({ populate: true }, windows => 
            resolve(windows.flatMap(window => window.tabs))))

/**
 * Is screen shader enabled?
 * @param {Object} Settings 
 * @returns {Boolean}
 */
const isScreenShaderEnabled = ({ enabled }) =>
    typeof enabled == 'boolean' ? enabled : enabled < Date.now()

const getDisabledSitePatterns = (settings) =>
    settings.disabledSites.map(pattern => 
        new RegExp(
            '^[^/]*' + pattern
            .replace(/\./g, '\\.') // Escape dots
            .replace(/^(?:\*\\\.)?([^/]+)(.*?)\/?\*?$/, (_, domain, path) => // Split into domain and path, removing /* at the end, and *. at the start
                domain
                    .replace(/\*/g, '[^/]*')                    // \* is regex for [^/]*
                + path
                    .replace(/\/\*\//g, '(?:\\/.+\\/|\\/)')     // /*/ is regex for (?:\/.+\/|\/)  so it matches no path \/ or other \/.+\/
                    .replace(/\*\//g, '.*\\/')                  // */ is regex for .*\/
                    .replace(/\/\*/g, '\\/.*')                  // /* is regex for \/.*
            )
        )
    )

/**
 * Update the browser action icon for a tab
 */
const updateTabIcon = (screenShaderEnabled, disabledSitePatterns, saved, tabId, url) => {
    if(screenShaderEnabled){
        const lurl = url.toLowerCase()
        
        if(!saved.warnedUserAboutNewTab && lurl.startsWith('chrome://newtab')){
            chrome.action.setBadgeText({text: '!!', tabId})
            chrome.action.setBadgeBackgroundColor({color: '#FF0000', tabId})
        }

        if(isShadeableTab(lurl)){
            const disabled = disabledSitePatterns.some(patterns => patterns.test(lurl))
            if(disabled){
                chrome.action.setIcon({path: '/img/grey19.png', tabId})
                chrome.action.setTitle({title: 'Screen Shader is disabled on this site', tabId})
            }else{
                chrome.action.setIcon({path: '/img/icon19.png', tabId})
                chrome.action.setTitle({title: 'Screen Shader is enabled', tabId})
            }
        }else{
            chrome.action.setIcon({path: '/img/grey19.png', tabId})
            chrome.action.setTitle({title: 'Screen Shader can\'t work on this page', tabId})
        }
    }else{
        chrome.action.setIcon({path: '/img/grey19.png', tabId})
        chrome.action.setTitle({title: 'Screen Shader is disabled', tabId})
    }
}

/**
 * Update the browser action icon for all tabs
 */
const updateAllTabIcons = async () => {
    const [{ settings, saved }, tabs] = await Promise.all([getLocalStorage(), getAllTabs()])
    const screenShaderEnabled = isScreenShaderEnabled(settings)
    const disabledSitePatterns = getDisabledSitePatterns(settings)

    tabs.forEach(tab =>
        updateTabIcon(screenShaderEnabled, disabledSitePatterns, saved, tab.id, tab.url))
}

const o = (n) => (n + 10) % 1

const getPercentInDay = (d) => (d - new Date(d).setHours(0,0,0,0)) / 86400000
// #endregion

// Whenever settings change
chrome.storage.onChanged.addListener(async changes => {
    if(changes.saved?.oldValue){
        const { newValue, oldValue } = changes.saved

        // User was just warned about issues shading the new tab, so the exclamation points by the badge can be removed
        if(newValue.warnedUserAboutNewTab && !oldValue.warnedUserAboutNewTab){
            (await getAllTabs()).forEach((tab) => 
                chrome.action.setBadgeText({ text: '', tabId: tab.id }))
        }
    }

    if(changes.settings?.oldValue){
        const { newValue, oldValue } = changes.settings
        
        // Update all icons if enabled or disabledSites changed
        if(oldValue.enabled != newValue.enabled || oldValue.disabledSites.some((v, i) => v != newValue.disabledSites[i])){
            updateAllTabIcons()
        }
    }
})

// Recieve keyboard shortcut commands
chrome.commands.onCommand.addListener(async command => {
    const { settings } = await getLocalStorage()

    // Toggle Screen Shader on/off
    if(command == '0-toggle')
        settings.enabled = !isScreenShaderEnabled(settings);

    // Increase/decrease current shade
    else if(command == '1-increase-shade' || command == '2-decrease-shade'){
        // Get sunset and sunrise time
        let DEGTORAD = Math.PI / 180,
            PI2 = 2 * Math.PI,
            SunsetH = Math.sin(-0.833 * DEGTORAD),

            lw = DEGTORAD * (settings.hasLocation ? -settings.longitude : new Date().getTimezoneOffset() / 60 / 24 * 360),
            lwp = lw / PI2,
            phi = settings.hasLocation ? DEGTORAD * settings.latitude : 0,

            JulianDate = Math.floor(Date.now() / 86400000 + 2440587.5),
            DaysSince2000 = JulianDate - 2451545,
            nnn = Math.round(DaysSince2000 - 0.0009 - lwp),

            M = DEGTORAD * (357.5291 + 0.98560028 * DaysSince2000),
            L = M + (DEGTORAD * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M))) + 4.93818571,
            dec = 0.39778370 * Math.sin(L),

            Jtransit = 2451545.0009 + nnn + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L),
            
            Jnoon = lwp + Jtransit,
            Jset = (Math.acos((SunsetH - Math.sin(phi) * dec) / (Math.cos(phi) * Math.sqrt(1 - dec * dec))) + lw) / PI2 + Jtransit,
            Jrise = Jnoon - Jset + Jnoon,

            whenSunrise = getPercentInDay((Jrise - 2440587.5) * 86400000),
            whenSunset = getPercentInDay((Jset - 2440587.5) * 86400000),
            whenPolarNight = dec < 0 ? phi >= 0 : phi < 0;

        // Use modified algorithm to figure out what current shade setting to change
        let n = getPercentInDay(Date.now()),
    
            _noSunCycle = isNaN(whenSunrise) || whenSunrise == whenSunset,
            _midnightSun = _noSunCycle && !whenPolarNight,
            _transition = TRANSITIONSPEEDS[settings.transitionSpeed] + .0001,

            _sleepStart = o(settings.wakeupTime - LENGTHSLEEP - _transition / 2), // When the time to sleep starts
            _timeStartingAtSleepStart = o(n - _sleepStart), // Move time so the time is 0 right before the transition to sleep shade happens

            _midDay = _noSunCycle ? NaN : o((whenSunrise + whenSunset) / 2 + (whenSunrise < whenSunset ? 0 : .5)), // Mid Day
            _dayLength = _noSunCycle ? NaN : Math.min(1, Math.max(_transition, o(whenSunset - whenSunrise)) + _transition), // Length of day. Must be long/not too short to accomodate transitions
            _sunset = o(_midDay + _dayLength / 2),
            _sunrise = o(_midDay - _dayLength / 2),

            currentShadeEditing;

        // Is the time between when we first transition to sunset shade and when we transition out of sunset shade
        if(settings.shadeNewAlgo && _timeStartingAtSleepStart < LENGTHSLEEP + _transition / 2){
            if(_timeStartingAtSleepStart < _transition){
                let _sleepStartsDuringDay = o(_sleepStart - _sunrise - _transition) < _dayLength - _transition;
                currentShadeEditing = _timeStartingAtSleepStart / _transition < .5 ? (_sleepStartsDuringDay || _midnightSun ? 'day' : 'night') : 'sleep';
            }else if(_timeStartingAtSleepStart < LENGTHSLEEP - _transition / 2){
                currentShadeEditing = 'sleep';
            }else{
                let _sleepEndsDuringDay = o(settings.wakeupTime - _sunrise) < _dayLength - _transition;
                currentShadeEditing = (_timeStartingAtSleepStart - LENGTHSLEEP + _transition / 2) / _transition < .5 ? 'sleep' : (_sleepEndsDuringDay || _midnightSun ? 'day' : 'night');
            }
        }
        // If there is no sun cycle
        else if(_noSunCycle)
            currentShadeEditing = _midnightSun ? 'day' : 'night';
        // If the time is between the start of sunrise transition and end of sunset transition
        else{
            let _timeStartingAtSunrise = o(n - _sunrise);
            if(_timeStartingAtSunrise < _transition){
                let _sleepStartsRightAfterSunrise = settings.shadeNewAlgo && o(_sleepStart - _sunrise) < _transition,
                    _sleepEndsRightBeforeSunrise = settings.shadeNewAlgo && o(settings.wakeupTime - _sunrise) < _transition;

                if(_sleepStartsRightAfterSunrise)
                    // Don't transition to a day shade since whe are transitioning to sleep shade soon anyway
                    currentShadeEditing = 'night';
                else if(_sleepEndsRightBeforeSunrise)
                    // Don't transition to a day shade since we are transition from sleep shade soon anyway
                    currentShadeEditing = 'day';
                else
                    // Night to day
                    currentShadeEditing = _timeStartingAtSunrise / _transition < .5 ? 'night' : 'day';
            }else if(_timeStartingAtSunrise < _dayLength - _transition){
                // Day
                currentShadeEditing = 'day';
            }else if(_timeStartingAtSunrise < _dayLength){
                let _sleepStartsRightAfterSunset = settings.shadeNewAlgo && o(_sleepStart - _sunset + _transition) < _transition,
                    _sleepEndsRightBeforeSunset = settings.shadeNewAlgo && o(settings.wakeupTime - _sunset + _transition) < _transition;

                if(_sleepStartsRightAfterSunset)
                    // Don't transition to a night shade since whe are transitioning to sleep shade soon anyway
                    currentShadeEditing = 'day';
                else if(_sleepEndsRightBeforeSunset)
                    // Don't transition to a night shade since whe are transitioning from sleep shade soon anyway
                    currentShadeEditing = 'night';
                else
                    // Day to night
                    currentShadeEditing = (_timeStartingAtSunrise - _dayLength + _transition) / _transition < .5 ? 'day' : 'night';
            }else{
                // Night
                currentShadeEditing = 'night';
            }
        }

        // Edit current shade
        let add = command == '1-increase-shade' ? 0.02 : -0.02;
        let maxShade = settings.widerBlendingRange ? 1 : MAXSHADE
        if(currentShadeEditing == 'day'){
            let shade = Math.max(0, Math.min(maxShade, settings.shadeDay + add));
            settings.shadeDay = shade;
            settings.shadeNight = Math.max(settings.shadeNight, shade);
            settings.shadeSleep = Math.max(settings.shadeSleep, shade);
        }else if(currentShadeEditing == 'night'){
            let shade = Math.max(0, Math.min(maxShade, settings.shadeNight + add));
            settings.shadeDay = Math.min(settings.shadeDay, shade);
            settings.shadeNight = shade;
            settings.shadeSleep = Math.max(settings.shadeSleep, shade);
        }else if(currentShadeEditing == 'sleep'){
            let shade = Math.max(0, Math.min(maxShade, settings.shadeSleep + add));
            settings.shadeDay = Math.min(settings.shadeDay, shade);
            settings.shadeNight = Math.min(settings.shadeNight, shade);
            settings.shadeSleep = shade;
        }
    }

    // Increase/decrease darkness
    else if(command == '3-increase-darkness' || command == '4-decrease-darkness')
        settings.darkness = Math.max(0, Math.min(MAXDARKNESS, settings.darkness + (command == '3-increase-darkness' ? .1 : -.1) * MAXDARKNESS));
    
    // Iterate through colors
    else if(command == '5-change-color'){
        let allColors = DEFAULTCOLORS.concat(settings.customColors),
            currentColorIndex = allColors.findIndex(color => color[0] == settings.color[0] && color[1] == settings.color[1] && color[2] == settings.color[2]),
            newColorIndex = currentColorIndex == allColors.length - 1 ? 0 : currentColorIndex + 1;

        settings.color = allColors[newColorIndex];
    }
    
    // Toggle Shaded Scrollbar on and off
    else if(command == '6-toggle-shaded-scrollbar')
        settings.shadedScrollbar = !settings.shadedScrollbar;

    // Toggle Shaded Scrollbar on and off
    else if(command == '7-toggle-shade-fullscreen')
        settings.shadeFullscreen = !settings.shadeFullscreen;

    await setLocalStorage({ settings })
})

// On install
chrome.runtime.onInstalled.addListener(async ({ reason }) => {
    let { settings, saved } = await getLocalStorage()

    // Merge default settings with old
    settings = Object.assign({}, DEFAULT_SETTINGS, settings)
    saved = Object.assign({}, DEFAULT_SAVED, saved)
    await setLocalStorage({ settings, saved })

    // Try loading location before screenshader executes on all tabs
    if(!settings.hasLocation)
        await setLocationFromGeoIp()

    if(reason == 'install'){
        // Show install page
        await chrome.tabs.create({
            url: chrome.runtime.getURL('welcome.html'),
            active: true
        })

        // Inject content script into every page
        const tabs = await getAllTabs()
        tabs.filter(tab => isShadeableTab(tab.url))
            .forEach(tab => chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['scripts/content.js']
            }))
    }

    await updateAllTabIcons()
})

// Whenever tab url updates update its icon
chrome.tabs.onUpdated.addListener(async (tabId, _, { url }) => {
    const { settings, saved } = await getLocalStorage()
    const screenShaderEnabled = isScreenShaderEnabled(settings)
    const disabledSitePatterns = getDisabledSitePatterns(settings)

    updateTabIcon(screenShaderEnabled, disabledSitePatterns, saved, tabId, url)
})

console.log(`here, have a cupcake:

                   000000
                  00000  00
                 0000000   0
                0000000000000
            000000000000000000000
         00000   00000000000    00000
      0000         0000000          000
     000      0                    0  000
    00        00  00     00  000        00
   00               00  00     000       00
  00                                      0
 00                                        0
 00                                        0
  000                                    00
    00000                            00000
     00 0000000000000000000000000000000 0
      0    0     0    00    0     00   00
      0    00    0    00    0     0    0
      00    0    00   00   00    00   00
       0    00   00   00   00    0    0
       00    0   00   00   00   00   00
        0    00   0   00   0    00   0
        00   00   0   00   0    0   00
         0    00  00  00  00   00   0
         00    0   0  00  0   00  00
          0000000000000000000000000`)
