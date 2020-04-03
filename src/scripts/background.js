// ============================
// Screen Shader
// Copyright 2019 Marc Guiselin
// ============================

const
    SELFURL = chrome.extension.getURL(''),

    DEFAULTCOLORS = [
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
    ],
    MAXSHADE = .8, 
    MAXDARKNESS = .6,

    LENGTHSLEEP = 9.18/24,
    TRANSITIONSPEEDS = [0, .04/24, .3/24, 1/24, 1.6/24];

var settings = {
        color: [255, 147, 41],
        customColors: [],
        enabled: true, // False if ss is not enabled, true if ss is enabled, or a time when screen shader should turn on
        
        colorBlending: 'multiply',
        transitionSpeed: 3,
        shadedScrollbar: true,
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
    },
    saved = {
        inst: GetInst(2),
        menuOpens: 0,

        showedLocationHint: false,
        warnedUserAboutNewTab: false
    };


if(chrome.contextMenus && chrome.contextMenus.removeAll && chrome.contextMenus.onClicked){
    chrome.contextMenus.removeAll(() => {
        chrome.contextMenus.create({
            title: 'Common Issues Page',
            type: 'normal',
            id: 'common-issues',
            contexts: ['browser_action']
        });
        chrome.contextMenus.create({
            title: 'Configure Keyboard Shortcuts',
            type: 'normal',
            id: 'configure-commands',
            contexts: ['browser_action']
        });
        chrome.contextMenus.create({
            title: '',
            type: 'separator',
            id: 'separator-1',
            contexts: ['browser_action']
        });
        chrome.contextMenus.create({
            title: 'Support Development',
            type: 'normal',
            id: 'support-development',
            contexts: ['browser_action']
        });
    });

    chrome.contextMenus.onClicked.addListener(({menuItemId}) => {
        if(menuItemId == 'support-development')
            chrome.tabs.create({url: 'https://bit.ly/screen-shader-donate', active: true});

        else if (menuItemId == 'common-issues')
            chrome.tabs.create({url: chrome.extension.getURL('common-issues.html'), active: true});

        else if (menuItemId == 'configure-commands') {
            let chromeVersion = /(Chrome|Chromium)\/([0-9]+)/.exec(navigator.userAgent);
            // Open old or new extension shortcuts page
            if(chromeVersion && parseInt(chromeVersion[2]) < 65)
                chrome.tabs.create({url: 'chrome://extensions/configureCommands/#ScreenShader', active: true});
            else
                chrome.tabs.create({url: 'chrome://extensions/shortcuts', active: true});
        }
    });
}

// Grab options and stats, merge with default settings, and save
chrome.storage.local.get(null, res => {
    settings = Object.assign(settings, res.settings);
    saved = Object.assign(saved, res.saved);

    // Load old Screen Shader settings
    if(localStorage.length){
        let color = localStorage.getItem('color'),
            darkness = parseFloat(localStorage.getItem('darkdim')),
            colorBlending = localStorage.getItem('mixBlendMode');

        settings.enabled = localStorage.getItem('ss_on') !== 'false';

        if(color && /rgb\(\d+,\s*\d+,\s*\d+\)/.test(color.trim())){
            color = color.replace(/rgb\(|\)|\s+/g, '').split(',').map(c => parseInt(c));
            // Color is valid
            if(color.every(c => c >= 0 && c <= 255)){
                settings.color = color;
                // If this color doesn't exist in our colors, create a custom color
                let allColors = DEFAULTCOLORS.concat(settings.customColors);
                if(allColors.every(color => color[0] != settings.color[0] || color[1] != settings.color[1] || color[2] != settings.color[2]))
                    settings.customColors.push(color);
            }
        }

        if(!isNaN(darkness))
            settings.darkness = Math.min(MAXDARKNESS, Math.max(0, darkness));

        if(colorBlending == 'multiply' || colorBlending == 'darken' || colorBlending == 'normal')
            settings.colorBlending = colorBlending;
        
        localStorage.clear();
    }

    // Save
    chrome.storage.local.set({
        settings,
        saved
    });

    UpdateAllTabIcons(false);
});

// Whenever settings change
chrome.storage.onChanged.addListener(changes => {
    if(changes.saved){
        let newSaved = changes.saved.newValue;

        // Clear badge text on new tab pages
        if(newSaved.warnedUserAboutNewTab && !saved.warnedUserAboutNewTab)
            UpdateAllTabIcons(true);

        saved = newSaved;
    }

    if(changes.settings){
        let newSettings = changes.settings.newValue,
            updateIcons = settings.enabled != newSettings.enabled || settings.disabledSites.some((v, i) => v != newSettings.disabledSites[i]);

        settings = newSettings;

        // Update all icons if enabled or disabledSites changed
        if(updateIcons)
            UpdateAllTabIcons(false);
    }
});

// Recieve keyboard shortcut commands
chrome.commands.onCommand.addListener(command => {
    // Toggle Screen Shader on/off
    if(command == '0-toggle')
        settings.enabled = !ScreenShaderEnabled();

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

            whenSunrise = GetPercentInDay((Jrise - 2440587.5) * 86400000),
            whenSunset = GetPercentInDay((Jset - 2440587.5) * 86400000),
            whenPolarNight = dec < 0 ? phi >= 0 : phi < 0;

        // Use modified algorithm to figure out what current shade setting to change
        let n = GetPercentInDay(Date.now()),
    
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
        if(currentShadeEditing == 'day'){
            let shade = Math.max(0, Math.min(GetMaxShade(), settings.shadeDay + add));
            settings.shadeDay = shade;
            settings.shadeNight = Math.max(settings.shadeNight, shade);
            settings.shadeSleep = Math.max(settings.shadeSleep, shade);
        }else if(currentShadeEditing == 'night'){
            let shade = Math.max(0, Math.min(GetMaxShade(), settings.shadeNight + add));
            settings.shadeDay = Math.min(settings.shadeDay, shade);
            settings.shadeNight = shade;
            settings.shadeSleep = Math.max(settings.shadeSleep, shade);
        }else if(currentShadeEditing == 'sleep'){
            let shade = Math.max(0, Math.min(GetMaxShade(), settings.shadeSleep + add));
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

    chrome.storage.local.set({settings});
});

// On install
chrome.runtime.onInstalled.addListener(({reason}) => {
    if(!settings.hasLocation)
        SetGeoIpTime();

    if(reason == 'install'){
        // Wait for background page to set settings 
        setTimeout(() => {
            // Show install page
            chrome.tabs.create({url: chrome.extension.getURL('welcome.html'), active: true});

            // Inject content script into every page
            chrome.tabs.query({}, tabs => {
                for (let {id, url} of tabs) {
                    if(IsValidUrl(url)){
                        chrome.tabs.executeScript(id, { file: 'scripts/content.js' });
                    }
                }
            });
        }, 1500);
    }
});

// Whenever tab url updates update its icon
chrome.tabs.onUpdated.addListener((tabId, _, {url}) => {
    // If url of tab updated
    if(url)
        UpdateTabIcon(tabId, url);
}); 

// Open up google form when someone uninstalls
// chrome.runtime.setUninstallURL('https://goo.gl/X2svhA');


// #region Functions
function SetGeoIpTime(){
    fetch('http://www.geoplugin.net/json.gp')
        .then(response => response.json())
        .then(response => {
            let geo = {};
            for(let key of Object.keys(response)){
                let simpkey = key.replace('geoplugin_', '');
                geo[simpkey] = ['latitude', 'longitude'].includes(simpkey) ? parseFloat(response[key]) : response[key];
            }

            if(geo.latitude && geo.longitude && geo.countryName){
                settings.hasLocation = true;
                settings.latitude = geo.latitude;
                settings.longitude = geo.longitude;
                if(!geo.city && !geo.regionCode)
                    settings.locationName = 'Unidentified public network in ' + geo.countryName;
                else
                    settings.locationName = (geo.city || geo.regionName || geo.regionCode) + ', ' + geo.countryName;
            }else{
                throw Error();
            }
        })
        .catch(() => {
            settings.hasLocation = false;
            settings.locationName = 'Could not determine location';
            settings.latitude = 0;
            settings.longitude = 0;
        })
        .then(() => {
            chrome.storage.local.set({settings});
        });
}

function GetInst(i){
    return Math.floor(Date.now() / 234e6 - i);
}

function GetPercentInDay(d) {
    let e = new Date(d);
    return (d - e.setHours(0,0,0,0)) / 86400000;
}

function o(n){
    return (n + 10) % 1;
}

function GetMaxShade(){
    return settings.widerBlendingRange ? 1 : MAXSHADE;
}

function UpdateAllTabIcons(clearBadgeText){
    // Update every tab's icons
    chrome.windows.getAll({populate: true}, windows => {
        for(let window of windows){
            for(let {id: tabId, url} of window.tabs){
                UpdateTabIcon(tabId, url);
                if(clearBadgeText)
                    chrome.browserAction.setBadgeText({text: '', tabId});
            }
        }
    });
}

function IsValidUrl(url){
    return url.trim() && !url.includes('://chrome.google.com/webstore') && !url.startsWith('chrome://') && !(url.startsWith('chrome-extension://') && !url.startsWith(SELFURL));
}

function ScreenShaderEnabled(){
    return typeof settings.enabled == 'boolean' ? settings.enabled : settings.enabled < Date.now();
}

function CheckUrlMatchDisabled(url){
    let testurl = url.replace(/^https?:\/\//, '');
    return settings.disabledSites.some(pattern => 
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
        ).test(testurl)
    );
}


function UpdateTabIcon(tabId, url){
    if(ScreenShaderEnabled()){
        let lurl = url.toLowerCase(),
            valid = IsValidUrl(lurl);
        
        if(!saved.warnedUserAboutNewTab && lurl.startsWith('chrome://newtab')){
            chrome.browserAction.setBadgeText({text: '!!', tabId});
            chrome.browserAction.setBadgeBackgroundColor({color: '#FF0000', tabId});
        }

        if(valid){
            if(CheckUrlMatchDisabled(lurl)){
                chrome.browserAction.setIcon({path: 'img/grey19.png', tabId});
                chrome.browserAction.setTitle({title: 'Screen Shader is disabled on this site', tabId});
            }else{
                chrome.browserAction.setIcon({path: 'img/icon19.png', tabId});
                chrome.browserAction.setTitle({title: 'Screen Shader is enabled', tabId});
            }
        }else{
            chrome.browserAction.setIcon({path: 'img/grey19.png', tabId});
            chrome.browserAction.setTitle({title: 'Screen Shader can\'t work on this page', tabId});
        }
    }else{
        chrome.browserAction.setIcon({path: 'img/grey19.png', tabId});
        chrome.browserAction.setTitle({title: 'Screen Shader is disabled', tabId});
    }
}
// #endregion


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
          0000000000000000000000000`);