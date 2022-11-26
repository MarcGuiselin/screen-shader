// ============================
// Screen Shader
// Copyright 2019 Marc Guiselin
// ============================

/* global citiesDB countriesDB */

// Constants
const
    SELFURL = chrome.runtime.getURL(''),
    TORADS = Math.PI / 180,

    GEOMAPWIDTH = 536,
    GEOMAPHEIGHT = 268,
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
    TRANSITIONSPEEDS = [0, .04/24, .3/24, 1/24, 1.6/24],

    UPDATETEMPSETTINGSINTERVAL = 600,

    SCREENSHADERPRESETS = {
        recommended: {
            shadeDay: 0,
            shadeNight: 0.3,
            shadeSleep: 0.5
        },
        'eye-strain': {
            shadeDay: 0.25,
            shadeNight: 0.45,
            shadeSleep: 0.65
        },
        'working-late': {
            shadeDay: 0,
            shadeNight: 0,
            shadeSleep: 0.7
        },
        warmest: {
            shadeDay: 0.7,
            shadeNight: 0.7,
            shadeSleep: 0.8
        },
        coldest: {
            shadeDay: 0,
            shadeNight: 0.15,
            shadeSleep: 0.15
        },
        classic: {
            shadeDay: 0.1,
            shadeNight: 0.6,
            shadeSleep: 0.6
        }
    },

    DEFAULTSETTINGS = {
        color: [255, 147, 41],
        customColors: [],
        enabled: true,
        
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

        disabledSites: [],
        disableDeveloperWarning: false
    };

// Elements
const
    $body = document.body,

    $pageButtons = document.querySelectorAll('.page-button'),
    $pageUnderliner = document.getElementById('page-underliner'),
    $pages = document.querySelectorAll('.page'),

    $closeHints = document.getElementById('close-hints'),
    $themeHintLink = document.getElementById('screen-shader-theme-hint-link'),
    $copyright = document.getElementById('copyright'),

    $onOffToggle = document.getElementById('on-off-toggle'),
    $onOffToggleText = $onOffToggle.querySelector('.primary-text'),

    $disablePicker = document.getElementById('disable-picker'),
    $disableForeverButton = document.getElementById('disable-forever-button'),
    $disableUntilSunriseButton = document.getElementById('disable-until-sunrise-button'),
    $disableForTimeButton = document.getElementById('disable-for-time-button'),
    $disableForTimeInput = document.getElementById('disable-for-time-input'),
    $disableOnWebsiteButton = document.getElementById('disable-on-website-button'),
    $disableOnWebsiteInput = document.getElementById('disable-on-website-input'),
    $disableCancelButton = document.getElementById('disable-cancel-button'),

    $temperatureSettingSelector = document.getElementById('temperature-setting-selector'),
    $temperatureWhenText = document.getElementById('temperature-when-text'),

    $temperatureWakeupTime = document.getElementById('temperature-wakeup-time'),
    $temperatureWakeupUpButton = document.getElementById('temperature-wakeup-up-button'),
    $temperatureWakeupDownButton = document.getElementById('temperature-wakeup-down-button'),

    $temperatureGraph = document.getElementById('temperature-graph'),
    $temperatureGraphPreviewButton = document.getElementById('temperature-graph-preview-button'),
    $temperatureGraphShowSlidersButton = document.getElementById('temperature-graph-show-sliders-button'),
    $temperatureGraphFill = document.getElementById('temperature-graph-fill'),
    $temperatureGraphFillGradient = document.getElementById('temperature-graph-fill-gradient'),
    $temperatureGraphSineWave = document.getElementById('temperature-graph-sine-wave'),
    $temperatureGraphText = document.getElementById('temperature-graph-text'),
    $temperatureGraphRegionDay1 = document.getElementById('temperature-graph-region-day-1'),
    $temperatureGraphRegionDay2 = document.getElementById('temperature-graph-region-day-2'),
    $temperatureGraphRegionDay3 = document.getElementById('temperature-graph-region-day-3'),
    $temperatureGraphRegionSleep1 = document.getElementById('temperature-graph-region-sleep-1'),
    $temperatureGraphRegionSleep2 = document.getElementById('temperature-graph-region-sleep-2'),
    $temperatureGraphPreviewTimeText = document.getElementById('temperature-graph-preview-time-text'),
    $temperatureGraphOffset = document.getElementById('temperature-graph-offset'),
    $temperatureGraphSun = document.getElementById('temperature-graph-sun'),

    $temperatureSingleSliderInput = document.getElementById('temperature-single-slider-input'),
    $temperatureSingleSliderFill = document.getElementById('temperature-single-slider-fill'),

    $showTemperatureHint = document.getElementById('show-temperature-hint'),

    $temperatureSlidersBack = document.getElementById('temperature-sliders-back'),
    $shadeDaySliderInput = document.getElementById('shade-day-slider-input'),
    $shadeDaySliderFill = document.getElementById('shade-day-slider-fill'),
    $shadeNightSliderInput = document.getElementById('shade-night-slider-input'),
    $shadeNightSliderFill = document.getElementById('shade-night-slider-fill'),
    $shadeSleepSliderInput = document.getElementById('shade-sleep-slider-input'),
    $shadeSleepSliderFill = document.getElementById('shade-sleep-slider-fill'),

    $darknessSliderInput = document.getElementById('darkness-slider-input'),
    $darknessSliderFill = document.getElementById('darkness-slider-fill'),
    $darknessSliderLabel = document.getElementById('darkness-slider-label'),

    $colorChoices = document.getElementById('color-choices'),
    $addNewColor = $colorChoices.querySelector('.add-new'),
    $showColorHint = document.getElementById('show-color-hint'),

    $locationSearch = document.getElementById('location-search'),
    $locationSearchInput = $locationSearch.querySelector('input'),
    $locationUnderliner = $locationSearch.querySelector('.underliner'),
    $locationResults = document.getElementById('location-results'),
    $locationAutofindButton = document.getElementById('location-autofind'),
    $locationLatInput = document.getElementById('location-lat'),
    $locationLonInput = document.getElementById('location-lon'),
    $locationName = document.getElementById('location-name'),
    $locationMap = document.getElementById('location-map'),
    $locationMapPointer = document.getElementById('location-map-pointer'),
    $showLocationHint = document.getElementById('show-location-hint'),

    $settingTransitionSpeed = document.getElementById('setting-transition-speed'),
    $settingColorBlending = document.getElementById('setting-color-blending'),
    $settingShadedScrollbar = document.getElementById('setting-shaded-scrollbar'),
    $settingShadeFullscreen = document.getElementById('setting-shade-fullscreen'),
    $settingWiderBlendingRange = document.getElementById('setting-wider-blending-range'),
    $settingDisableDeveloperWarning = document.getElementById('setting-disable-developer-warning'),
    $settingEditKeyboardShortcut = document.getElementById('settings-edit-keyboard-shortcut'),
    $settingResetSettings = document.getElementById('settings-reset-settings'),
    $settingIssueResolutionPage = document.getElementById('settings-issue-resolution-page'),

    $colorPickerHueCanvas = document.getElementById('color-picker-canvas-hue'),
    $colorPickerTriangleCanvas = document.getElementById('color-picker-canvas-triangle'),
    $colorPickerHuePointer = document.getElementById('color-picker-hue-pointer'),
    $colorPickerTrianglePointer = document.getElementById('color-picker-triangle-pointer'),
    $colorPickerHexInput = document.getElementById('color-picker-hex'),
    $colorPickerRedInput = document.getElementById('color-picker-red'),
    $colorPickerGreenInput = document.getElementById('color-picker-green'),
    $colorPickerBlueInput = document.getElementById('color-picker-blue'),
    $colorPickerAdd = document.getElementById('color-picker-add'),
    $colorPickerSet = document.getElementById('color-picker-set'),
    $colorPickerCancel = document.getElementById('color-picker-cancel');


// Variables
let settings = {},
    saved = {},
    justUpdatedStorage = false,

    showedNewTabHint = false,
    showedMapHint = false,

    selectedTabUrl = '',
    selectedTabMatchPattern = false,
    disabledByUrlMatch = false,
    activeTabIds = [],
    mouseDownOverMap = false,

    wakeupTimeIncreaseTimeout,
    wakeupTimeIncrease = 0,

    singleSliderEditing = 'night',
    singleSliderMax,

    shadeDay,
    shadeNight,
    shadeSleep,
    shadeSliderMouseDown = false,
    shadeSliderMax,
    temporaryShadeUpdaterInterval,
    toggleSlidersShowTimeout,

    previewingShade = false,
    previewShadeOffset = 0,
    previewShadeLastLoop,

    whenJulian = 0,
    whenSunrise,
    whenSunset,
    whenPolarNight,

    darknessSliderMax,

    colorPickerButtons = [],
    editingColorPickerButton,

    oldLocationQuery = '',

    colorPickerHueActive = false,
    colorPickerTriangleActive = false,
    colorPickerHue = 0,
    colorPickerSaturation = .5,
    colorPickerLightness = .5,
    temporaryColorUpdaterInterval,

    settingsResetClickAgain = false,
    settingsResetButtonTimeout;


// #region Run Everything

// Get selectedTabUrl and selectedTabMatchPattern and determine if this is a page this chrome extension can work on
chrome.tabs.query({ 
    active: true,
    currentWindow: true,
}, ([tab]) => {
    let url = tab && tab.url;
    if(url){
        selectedTabUrl = url.replace(/^https?:\/\//, '').toLowerCase();
        if(url.startsWith('file:///')){
            selectedTabMatchPattern = 'file:///*';
        }else if(url.startsWith('http://chrome.google.com') || url.startsWith('https://chrome.google.com')){
            selectedTabMatchPattern = false;
        }else if(url.startsWith('http://') || url.startsWith('https://')){ // Works with: 'http://desmos.com', 'https://www.desmos.com/calculator', 'https://www.dsaasd.desmos.com?sdaasd', 'https://dsaasd.desmos.com#gasdsad', 'https://dsaasd.asddsa.desmos.com/calculator/adsdas?asdasd#sdaasd'
            let m = url.match(/https?:\/\/(www\.)?([^/?#]+)/i);
            selectedTabMatchPattern = m ? m[2] : '';
        }

        if(!selectedTabMatchPattern && !url.startsWith(SELFURL))
            $onOffToggle.classList.add('cant-work');

        if(settings.disabledSites){
            CheckUrlMatchDisabled();
            UpdateOnOffToggleUI();
        }
    }
});

// Generate list of active tabs
chrome.tabs.query({active: true}, tabs => {
    activeTabIds = tabs.map(t => t.id);
});

// Load settings and update menu
chrome.storage.local.get(null, res => {
    settings = res.settings;
    saved = res.saved;
    shadeDay = settings.shadeDay;
    shadeNight = settings.shadeNight;
    shadeSleep = settings.shadeSleep;

    CheckUrlMatchDisabled();

    UpdateUI();
    setTimeout(() => $body.classList.add('enable-animations'), 300);
    document.dispatchEvent(new CustomEvent('got-settings'));
});

// Whenever settings change
chrome.storage.onChanged.addListener(changes => {
    if (changes.settings) {
        if (justUpdatedStorage) {
            justUpdatedStorage = false;
        }else{
            settings = changes.settings.newValue;
            if(shadeDay != settings.shadeDay || shadeNight != settings.shadeNight || shadeSleep != settings.shadeSleep){
                shadeDay = settings.shadeDay;
                shadeNight = settings.shadeNight;
                shadeSleep = settings.shadeSleep;
                UpdateTemperatureGraph(true);
            }
            UpdateUI();
        }
    }
});

// Remove hints when the button is pressed
$closeHints.addEventListener('click', RemoveHints);


// If user clicks link, don't show new tab hint again
$themeHintLink.addEventListener('click', () => {
    ChangeSaved({warnedUserAboutNewTab: true});
})

// #endregion


// #region Header

// Set up header
document.addEventListener('got-settings', () => {
    // Request animation frames so donate button is visible before calculating position of underliner when we show the teperature page
    window.requestAnimationFrame(() => {
        // Show donate button once user has opened up menu 4 times.  I'd rather not have it distract users the first time they open the menu
        if(saved.menuOpens > 3)
            $body.classList.add('show-donate-button');

        // Show temperature page on load
        window.requestAnimationFrame(() => ClickPageButton('temperature', true));
    });

    // Add click event listeners to page buttons
    for(let $pageButton of $pageButtons)
        $pageButton.addEventListener('click', evt => ClickPageButton(evt.target, false));

    // Update On Off toggle often, since the amount of time until Screen Shader is enabled could have decreased
    setInterval(UpdateOnOffToggleUI, 1000);

    // Set copyright text to round robin
    $copyright.innerHTML = 'Made with hard work by Marc Guiselin and a crew of ' + [
        'unicorns <span>&#x1F984;</span>',
        'wizards <span>&#x1F9D9;</span>',
        'monkeys <span>&#x1F435;</span>',
        'dinosaurs <span>&#x1F996;</span>',
        'cowboys <span>&#x1F920;</span>'
    ][saved.menuOpens % 5];

    // Add 1 to the number of times the menu was opened
    ChangeSaved({
        menuOpens: saved.menuOpens + 1
    });

    // Show new tab hint if it hasn't been shown yet
    if(!saved.warnedUserAboutNewTab){
        chrome.tabs.query({ 
            active: true,
            currentWindow: true,
        }, ([tab]) => {
            if(tab && tab.url && tab.url.toLowerCase().startsWith('chrome://newtab')){
                showedNewTabHint = true;
                $body.classList.add('show-new-tab-hint');
            }
        });
    }
});

// Clicking toggle enables/disables Screen Shader
$onOffToggle.addEventListener('click', () => {
    CancelPreviewShade();

    if(disabledByUrlMatch){
        disabledByUrlMatch = false;
        ChangeSettings({
            disabledSites: settings.disabledSites.filter(s => !PatternMatcher(s)),
            enabled: true
        });
    }else{
        ChangeSettings({
            enabled: !(typeof settings.enabled == 'boolean' ? settings.enabled : settings.enabled < Date.now())
        });
    }
    
    if(!settings.enabled){
        $body.classList.add('show-disable-picker');

        $disableOnWebsiteButton.classList.toggle('hidden', !selectedTabMatchPattern);
        $disableOnWebsiteInput.classList.toggle('hidden', !selectedTabMatchPattern);
        $disableOnWebsiteInput.value = selectedTabMatchPattern;
        $disableForTimeInput.value = '1 Hour';
    }
});

// Clicking out of disable menu closes it and re-enables screen shader
$disablePicker.addEventListener('click', e => {
    if(e.target == $disablePicker) // If this element was clicked directly
        HeaderSetEnabled(true);
});

// Disable button forever
$disableForeverButton.addEventListener('click', () => HeaderSetEnabled(false));

// Disable until sunrise
$disableUntilSunriseButton.addEventListener('click', () => {
    let n = GetPercentInDay(Date.now()),
        s = whenSunrise;

    // Sunrise already happened, so get tomorrow's sunrise
    if(n > s)
        s++;

    HeaderSetEnabled(Date.now() + (s - n) * 86400000);
});

// Disable on website button
$disableOnWebsiteButton.addEventListener('click', () => {
    $body.classList.remove('show-disable-picker');
    
    let url = UrlMatchClean($disableOnWebsiteInput.value);
    if(url){
        settings.enabled = true;
        if(!settings.disabledSites.includes(url))
            settings.disabledSites.push(url);
        chrome.storage.local.set({settings, saved});

        CheckUrlMatchDisabled();
        ApplySettingsChanges();
        UpdateUI();
    }
});

// Disable on website input
$disableOnWebsiteInput.addEventListener('focus', () => $disableOnWebsiteInput.select());
$disableOnWebsiteInput.addEventListener('input', () => $disableOnWebsiteInput.classList.toggle('incorrect', !UrlMatchIsValid($disableOnWebsiteInput.value)));
$disableOnWebsiteInput.addEventListener('change', () => {
    $disableOnWebsiteInput.classList.remove('incorrect');
    $disableOnWebsiteInput.blur();

    if(!UrlMatchIsValid($disableOnWebsiteInput.value))
        $disableOnWebsiteInput.value = selectedTabMatchPattern;
});

// Disable for some time button
$disableForTimeButton.addEventListener('click', () => HeaderSetEnabled(Date.now() + ParseDisableTime($disableForTimeInput.value)));

// Disable for some time imnut
$disableForTimeInput.addEventListener('focus', () => $disableForTimeInput.select());
$disableForTimeInput.addEventListener('input', () => $disableForTimeInput.classList.toggle('incorrect', ParseDisableTime($disableForTimeInput.value) == undefined));
$disableForTimeInput.addEventListener('change', () => {
    $disableForTimeInput.classList.remove('incorrect');
    $disableForTimeInput.blur();

    let parsed = ParseDisableTime($disableForTimeInput.value),
        time = parsed ? (parsed + 10000) / 36e5 : 1,
        hours = Math.floor(time),
        minutes = Math.floor((time - hours) * 60),
        newVal = '';

    if(hours == 0 && minutes == 0){
        newVal = '0 Hours';
    }else{
        if(hours == 1)
            newVal = '1 Hour ';
        else if(hours > 1)
            newVal = hours + ' Hours ';

        if(minutes == 1)
            newVal += '1 Minute';
        else if(minutes > 1)
            newVal += minutes + ' Minutes';
    }

    $disableForTimeInput.value = newVal.trim();
});

// Disable cancel or click outside menu
$disableCancelButton.addEventListener('click', () => HeaderSetEnabled(true));
$disablePicker.addEventListener('click', e => {
    if(e.target == $disablePicker) // If this element was clicked directly
        HeaderSetEnabled(true);
});

function ParseDisableTime(time){
    time = time.trim().toLowerCase();

    // If time is just a number, parse and return hour to ms
    if(/^\d+\.?\d*$|^\.\d+$/.test(time)){
        let parsed = parseFloat(time);
        return isNaN(parsed) ? undefined : Math.min(parsed, 4320) * 36e5; // No longer than 180 days
    }
    
    // If time is in hh:mm time format
    let hhmm = time.match(/^(\d+):(\d\d?)$/);
    if(hhmm){
        let ms = parseInt(hhmm[1]) * 36e5 + parseInt(hhmm[2]) * 6e4;
        return isNaN(ms) ? undefined : Math.min(ms, 15552e6); // No longer than 180 days
    }

    // Last try parse time in format: 1 Day 12.2 hours 1 minute
    if(/^((\d+\.?\d*|^\.\d+)\s+[a-z]+\s*)+$/.test(time)){
        let reg = /(\d+\.?\d*|^\.\d+)\s+([a-z]+)/g,
            ms = 1,
            m;
        
        while(m = reg.exec(time)){
            if(m[2] == 'd' || m[2] == 'day' || m[2] == 'days')
                ms += parseFloat(m[1]) * 864e5;
            else if(m[2] == 'h' || m[2] == 'hr' || m[2] == 'hour' || m[2] == 'hours')
                ms += parseFloat(m[1]) * 36e5;
            else if(m[2] == 'm' || m[2] == 'min' || m[2] == 'minute' | m[2] == 'minutes')
                ms += parseFloat(m[1]) * 6e4;
            else
                return;
        }

        return isNaN(ms) ? undefined : Math.min(ms, 15552e6); // No longer than 180 days
    }
}

function HeaderSetEnabled(value){
    $body.classList.remove('show-disable-picker');
    if(value != undefined && !isNaN(value) && settings.enabled !== value)
        ChangeSettings({enabled: value})
}

function UrlMatchIsValid(pattern){
    // Trim, lowercase
    pattern = pattern.trim().toLowerCase();

    if(pattern.startsWith('file:///')){
        pattern = pattern.substring(8);
        if(pattern == '')
            return false;

        // Valid characters
        return !/[^\-a-z0-9+&@#/%?=~_|!,.;*]/.test(pattern);
    }else{
        // Remove protocol
        pattern = pattern.replace(/^\*:\/\/|https?:\/\//, '');

        // Longer than 3 characters, no other protocols allowed, only valid characters, must not start with period or slash or end with period
        return pattern.length > 3 && !/:\/\//.test(pattern) && !/[^\-a-z0-9+&@#/%?=~_|!,.;*:]/.test(pattern) && pattern[0] != '.' && pattern[0] != '/' && pattern.substr(-1) != '.';
    }
}

function UrlMatchClean(pattern){
    // Trim, lowercase
    pattern = pattern.trim().toLowerCase();

    if(UrlMatchIsValid(pattern))
        // Remove protocol except for file:///
        return pattern.replace(/^\*:\/\/|https?:\/\//, '');
}

// #endregion


// #region Temperature Page

document.addEventListener('got-settings', () => {
    // Set single slider max
    singleSliderMax = Math.max(400, $temperatureSingleSliderInput.getBoundingClientRect().width);
    $temperatureSingleSliderInput.max = singleSliderMax;

    // Set shade slider maxes
    shadeSliderMax = Math.max(400, $shadeDaySliderInput.getBoundingClientRect().width);
    $shadeDaySliderInput.max = shadeSliderMax;
    $shadeNightSliderInput.max = shadeSliderMax;
    $shadeSleepSliderInput.max = shadeSliderMax;

    // Update time text periodically
    UpdateSunsetTimeText();
    setInterval(UpdateSunsetTimeText, 1000);

    // Update temperature graph periodically
    UpdateTemperatureGraph(true);
    setInterval(() => UpdateTemperatureGraph(false), 300);

    // Set preset selector dropdown
    if(settings.shadeNewAlgo){
        $temperatureSettingSelector.value = 'custom';
        for(let [name, preset] of Object.entries(SCREENSHADERPRESETS))
            if(Object.keys(preset).every(k => preset[k] == settings[k]))
                $temperatureSettingSelector.value = name;
    }else{
        $temperatureSettingSelector.value = 'classic';
        $body.classList.add('classic-algorithm');
    }
});

// Preset selector dropdown
$temperatureSettingSelector.addEventListener('change', () => {
    let val = $temperatureSettingSelector.value,
        preset = SCREENSHADERPRESETS[val],
        shadeNewAlgo = val != 'classic';
    
    if(preset){
        shadeDay = preset.shadeDay;
        shadeNight = preset.shadeNight;
        shadeSleep = preset.shadeSleep;
    }

    ChangeSettings({
        shadeNewAlgo,
        shadeDay,
        shadeNight,
        shadeSleep
    });
    $body.classList.toggle('classic-algorithm', !shadeNewAlgo);

    UpdateTemperatureGraph(true);
    UpdateSunsetTimeText();
});

// Clicking and/or holding the arrow buttons down that increase/decrease wakeup time
$temperatureWakeupUpButton.addEventListener('mousedown', () => WakeupTimeMouseDownInputs(1));
$temperatureWakeupDownButton.addEventListener('mousedown', () => WakeupTimeMouseDownInputs(-1));
$body.addEventListener('mouseup', () => WakeupTimeMouseDownInputs(0));

// Manually typing wakeup time
$temperatureWakeupTime.addEventListener('focus', () => $temperatureWakeupTime.select());
$temperatureWakeupTime.addEventListener('input', () => $temperatureWakeupTime.classList.toggle('incorrect', ParseWakeupTime($temperatureWakeupTime.value) == undefined));
$temperatureWakeupTime.addEventListener('change', () => {
    $temperatureWakeupTime.classList.remove('incorrect');
    let wakeupTime = ParseWakeupTime($temperatureWakeupTime.value);
    if(wakeupTime != undefined){
        ChangeSettings({wakeupTime});
        UpdateTemperatureGraph(true);
        UpdateSunsetTimeText();
    }else{
        UpdateUI();
    }
    $temperatureWakeupTime.blur();
});

// Single slider
$temperatureSingleSliderInput.addEventListener('input', () => ShadeSlidersInput(singleSliderEditing, $temperatureSingleSliderInput.value / singleSliderMax));
$temperatureSingleSliderInput.addEventListener('mousedown', ShadeSlidersMouseDown);
$temperatureSingleSliderInput.addEventListener('mouseup', ShadeSlidersMouseUp);

// Shade day, night and sleep slider events
$shadeDaySliderInput.addEventListener('input', () => ShadeSlidersInput('day', $shadeDaySliderInput.value / shadeSliderMax));
$shadeNightSliderInput.addEventListener('input', () => ShadeSlidersInput('night', $shadeNightSliderInput.value / shadeSliderMax));
$shadeSleepSliderInput.addEventListener('input', () => ShadeSlidersInput('sleep', $shadeSleepSliderInput.value / shadeSliderMax));

$shadeDaySliderInput.addEventListener('mousedown', ShadeSlidersMouseDown);
$shadeNightSliderInput.addEventListener('mousedown', ShadeSlidersMouseDown);
$shadeSleepSliderInput.addEventListener('mousedown', ShadeSlidersMouseDown);

$shadeDaySliderInput.addEventListener('mouseup', ShadeSlidersMouseUp);
$shadeNightSliderInput.addEventListener('mouseup', ShadeSlidersMouseUp);
$shadeSleepSliderInput.addEventListener('mouseup', ShadeSlidersMouseUp);

// Clicking on show slider button shows them immediately
$temperatureGraphShowSlidersButton.addEventListener('click', evt => {
    evt.stopPropagation();
    clearTimeout(toggleSlidersShowTimeout);
    $body.classList.toggle('show-temperature-sliders');
});

// Clicking on hide slider button hides them immediately
$temperatureSlidersBack.addEventListener('click', () => {
    clearTimeout(toggleSlidersShowTimeout);
    $body.classList.remove('show-temperature-sliders')
});

// Clicking on shade preview runs it
$temperatureGraphPreviewButton.addEventListener('click', StartPreviewShade, true);

// Clicking once on graph shows sliders, double clicking shows shade preview
$temperatureGraph.addEventListener('click', () => {
    if(!previewingShade){
        clearTimeout(toggleSlidersShowTimeout);
        toggleSlidersShowTimeout = setTimeout(() => $body.classList.toggle('show-temperature-sliders'), 600);
    }
});
$temperatureGraph.addEventListener('dblclick', StartPreviewShade);

// Show temperature hint
$showTemperatureHint.addEventListener('click', () => $body.classList.add('show-temperature-hint'));


// Parse hour:minute time and return julian time
function ParseWakeupTime(time){
    // [1](HHMM) [2](HH) [3](MM) [4](A or P)
    let match = time.trim().toLowerCase().match(/^(?:(\d\d\d\d?)|(\d\d?)\s*[;:,.]?\s*(\d?\d?))\s*(?:([ap])\.?\s*m?\.?)?$/);
    if(match){
        let hour = parseInt(match[1] ? match[1].slice(0, -2) : match[2]) || 0,
            minutes = parseInt(match[1] ? match[1].slice(-2) : match[3]) || 0,
            am = match[4] == 'a',
            pm = match[4] == 'p';

        // Minutes should be between 0 and 59
        if(minutes > 59)
            return;
        // Hour should never be above 24
        if(hour > 24)
            return;
        // 12AM is 00:00
        if(am && hour == 12)
            hour = 0;
        // Add 12 to hour of all pm times since 6PM is 18:00
        if(pm && hour < 12)
            hour += 12;
        // Keep within 0-1 with o(), and round result to 6 decimal places
        return Math.round(o(hour / 24 + minutes / 24 / 60) * 1000000) / 1000000;
    }
}

function WakeupTimeMouseDownInputs(change){
    CancelPreviewShade();

    if(change != undefined)
        wakeupTimeIncrease = change;

    if(wakeupTimeIncrease != 0){
        ChangeSettings({
            // Convert wakeupTime from julian to 15 minute chunks, add the time increase, back to julian, keep within 0-1 with o(), and round result to 6 decimal places
            wakeupTime: Math.round(o(Math.round(settings.wakeupTime * 96 + wakeupTimeIncrease) / 96) * 1000000) / 1000000
        });
        UpdateTemperatureGraph(true);
        UpdateSunsetTimeText();

        clearTimeout(wakeupTimeIncreaseTimeout);
        wakeupTimeIncreaseTimeout = setTimeout(WakeupTimeMouseDownInputs, change == undefined ? 150 : 700);
    }
}

function StartPreviewShade(evt){
    evt.stopPropagation();
    if(!previewingShade){
        clearTimeout(toggleSlidersShowTimeout);
        $body.classList.remove('show-temperature-sliders')
        previewingShade = true;
        previewShadeLastLoop = Date.now();
        $body.classList.add('preview-shade');
        window.requestAnimationFrame(RunPreviewShade);
    }
}

function RunPreviewShade(){
    if(previewingShade){
        previewShadeOffset += (Date.now() - previewShadeLastLoop) * 12000;
        previewShadeLastLoop = Date.now();
        if(previewShadeOffset >= 86400000){
            CancelPreviewShade();
        }else{
            UpdateTemperatureGraph();
            window.requestAnimationFrame(RunPreviewShade);
        }
    }
}

function CancelPreviewShade(){
    if(previewingShade){
        previewingShade = false;
        previewShadeOffset = 0;
        $body.classList.remove('preview-shade');
        UpdateTemporaryShade(undefined);
        UpdateTemperatureGraph();
    }
}

function UpdateSunsetTimeText(){
    LoadSunriseSunsetTime();

    if(!shadeSliderMouseDown){
        let n = GetPercentInDay(Date.now()),
            text;

        // If there is 24 hour day/night
        if(isNaN(whenSunset)){
            text = whenPolarNight ? 'Polar night \uD83C\uDF1B' : 'Midnight sun \uD83C\uDF1E';
        }else{
            let t = o(n - whenSunrise), // Normalize time so 0 is right as sunrise happens
                normSunset = o(whenSunset - whenSunrise),
                isDay = t < normSunset,
                distanceToSunrise = Math.min(t, 1 - t) * 24,
                distanceToSunset = Math.abs(t - normSunset) * 24,
                sunriseCloser = distanceToSunrise < distanceToSunset,
                dist = sunriseCloser ? distanceToSunrise : distanceToSunset,
                after = sunriseCloser ? (isDay ? 'after sunrise \uD83C\uDF1E' : 'before sunrise \uD83C\uDF1B') : (isDay ? 'before sunset \uD83C\uDF1E' : 'after sunset \uD83C\uDF1B');

            if(dist > 1.5)
                text = `${Math.round(dist)} hours ${after}`;
            else if(dist > 1)
                text = `1 hour ${after}`;
            else if(dist > 1.5 / 60)
                text = `${Math.round(dist * 60)} minutes ${after}`;
            else
                text = `1 minute ${after}`;
        }

        if(settings.shadeNewAlgo){
            let t = o(n + LENGTHSLEEP - settings.wakeupTime), // Normalize time so 0 is right as sleep start happens
                isSleep = t < LENGTHSLEEP,
                distanceToSleep = Math.min(t, 1 - t) * 24,
                distanceToWake = Math.abs(t - LENGTHSLEEP) * 24,
                sleepCloser = distanceToSleep < distanceToWake,
                dist = sleepCloser ? distanceToSleep : distanceToWake,
                after = sleepCloser ? (isSleep ? 'after bedtime \uD83D\uDECC' : 'before bedtime \uD83D\uDCBB') : (isSleep ? 'before wakeup \uD83D\uDECC' : 'after wakeup \uD83D\uDCBB');

            if(dist > 1.5)
                text += `\n${Math.round(dist)} hours ${after}`;
            else if(dist > 1)
                text += `\n1 hour ${after}`;
            else if(dist > 1.5 / 60)
                text += `\n${Math.round(dist * 60)} minutes ${after}`;
            else
                text += `\n1 minute ${after}`;
        }

        $temperatureWhenText.textContent = text;
    }
}

function LoadSunriseSunsetTime(reset){
    let JulianDate = Math.floor(Date.now() / 86400000 + 2440587.5);
    if(reset || whenJulian != JulianDate){
        let DEGTORAD  = Math.PI / 180,
            PI2 = 2 * Math.PI,
            SunsetH = Math.sin(-0.833 * DEGTORAD),

            lw = DEGTORAD * (settings.hasLocation ? -settings.longitude : new Date().getTimezoneOffset() / 60 / 24 * 360),
            lwp = lw / PI2,
            phi = settings.hasLocation ? DEGTORAD * settings.latitude : 0,

            DaysSince2000 = JulianDate - 2451545,
            n = Math.round(DaysSince2000 - 0.0009 - lwp),

            M = DEGTORAD * (357.5291 + 0.98560028 * DaysSince2000),
            L = M + (DEGTORAD * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M))) + 4.93818571,
            dec = 0.39778370 * Math.sin(L),

            Jtransit = 2451545.0009 + n + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L),
            
            Jnoon = lwp + Jtransit,
            Jset = (Math.acos((SunsetH - Math.sin(phi) * dec) / (Math.cos(phi) * Math.sqrt(1 - dec * dec))) + lw) / PI2 + Jtransit,
            Jrise = Jnoon - Jset + Jnoon;

        whenJulian = JulianDate;
        whenSunrise = GetPercentInDay((Jrise - 2440587.5) * 86400000);
        whenSunset = GetPercentInDay((Jset - 2440587.5) * 86400000);
        whenPolarNight = dec < 0 ? phi >= 0 : phi < 0;
    }
}

function GetPercentInDay(d) {
    let e = new Date(d);
    return (d - e.setHours(0,0,0,0)) / 86400000;
}

function ShadeEaseLerp(from, to, t) {
    let p = t < .5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
    return from * (1 - p) + to * p;
}

// Very useful function for keeping a number within 0 and 1. Looping it back around if its over or under
function o(n){
    return (n + 10) % 1;
}

function UpdateTemperatureGraph(updateFillPath){
    const
        _width = 574,
        _height = 100,
        _padTop = 12,
        _padBottom = 13,
        _movementHeight = _height - _padTop - _padBottom,
        _daySunColor = [243, 206, 112],
        _nightSunColor = [144, 175, 240],
        _backgroundColor = [245, 245, 245];

    let n = GetPercentInDay(Date.now() + previewShadeOffset),
    
        _noSunCycle = isNaN(whenSunrise) || whenSunrise == whenSunset,
        _midnightSun = _noSunCycle && !whenPolarNight,
        _transition = TRANSITIONSPEEDS[settings.transitionSpeed] + .0001,

        _sleepStart = o(settings.wakeupTime - LENGTHSLEEP - _transition / 2), // When the time to sleep starts
        _timeStartingAtSleepStart = o(n - _sleepStart), // Move time so the time is 0 right before the transition to sleep shade happens

        _midDay = _noSunCycle ? NaN : o((whenSunrise + whenSunset) / 2 + (whenSunrise < whenSunset ? 0 : .5)), // Mid Day
        _dayLength = _noSunCycle ? NaN : Math.min(1, Math.max(_transition, o(whenSunset - whenSunrise)) + _transition), // Length of day. Must be long/not too short to accomodate transitions
        _sunset = o(_midDay + _dayLength / 2),
        _sunrise = o(_midDay - _dayLength / 2),

        _shade, // Shade determined by algorithm (sun position)
        _suncolor, // Sun color as determined by algorithm

        newSingleSliderEditing;

    // #region Algorithm

    // Is the time between when we first transition to sunset shade and when we transition out of sunset shade
    if(settings.shadeNewAlgo && _timeStartingAtSleepStart < LENGTHSLEEP + _transition / 2){
        if(_timeStartingAtSleepStart < _transition){
            let _sleepStartsDuringDay = o(_sleepStart - _sunrise - _transition) < _dayLength - _transition,
                ease = _timeStartingAtSleepStart / _transition;
            newSingleSliderEditing = ease < .5 ? (_sleepStartsDuringDay || _midnightSun ? 'day' : 'night') : 'sleep';
            _shade = ShadeEaseLerp(_sleepStartsDuringDay || _midnightSun ? shadeDay : shadeNight, shadeSleep, ease);
        }else if(_timeStartingAtSleepStart < LENGTHSLEEP - _transition / 2){
            newSingleSliderEditing = 'sleep';
            _shade = shadeSleep;
        }else{
            let _sleepEndsDuringDay = o(settings.wakeupTime - _sunrise) < _dayLength - _transition,
                ease = (_timeStartingAtSleepStart - LENGTHSLEEP + _transition / 2) / _transition;
            newSingleSliderEditing = ease < .5 ? 'sleep' : (_sleepEndsDuringDay || _midnightSun ? 'day' : 'night');
            _shade = ShadeEaseLerp(shadeSleep, _sleepEndsDuringDay || _midnightSun ? shadeDay : shadeNight, ease);
        }
    }
    // If there is no sun cycle
    else if(_noSunCycle){
        newSingleSliderEditing = _midnightSun ? 'day' : 'night';
        _shade = _midnightSun ? shadeDay : shadeNight;
    }
    // If the time is between the start of sunrise transition and end of sunset transition
    else{
        let _timeStartingAtSunrise = o(n - _sunrise);
        if(_timeStartingAtSunrise < _transition){
            let _sleepStartsRightAfterSunrise = settings.shadeNewAlgo && o(_sleepStart - _sunrise) < _transition,
                _sleepEndsRightBeforeSunrise = settings.shadeNewAlgo && o(settings.wakeupTime - _sunrise) < _transition;

            if(_sleepStartsRightAfterSunrise){
                // Don't transition to a day shade since whe are transitioning to sleep shade soon anyway
                newSingleSliderEditing = 'night';
                _shade = shadeNight;
            }else if(_sleepEndsRightBeforeSunrise){
                // Don't transition to a day shade since we are transition from sleep shade soon anyway
                newSingleSliderEditing = 'day';
                _shade = shadeDay;
            }else{
                // Night to day
                let ease = _timeStartingAtSunrise / _transition;
                newSingleSliderEditing = ease < .5 ? 'night' : 'day';
                _shade = ShadeEaseLerp(shadeNight, shadeDay, ease);
            }
        }else if(_timeStartingAtSunrise < _dayLength - _transition){
            // Day
            newSingleSliderEditing = 'day';
            _shade = shadeDay;
        }else if(_timeStartingAtSunrise < _dayLength){
            let _sleepStartsRightAfterSunset = settings.shadeNewAlgo && o(_sleepStart - _sunset + _transition) < _transition,
                _sleepEndsRightBeforeSunset = settings.shadeNewAlgo && o(settings.wakeupTime - _sunset + _transition) < _transition;

            if(_sleepStartsRightAfterSunset){
                // Don't transition to a night shade since whe are transitioning to sleep shade soon anyway
                newSingleSliderEditing = 'day';
                _shade = shadeDay;
            }else if(_sleepEndsRightBeforeSunset){
                // Don't transition to a night shade since whe are transitioning from sleep shade soon anyway
                newSingleSliderEditing = 'night';
                _shade = shadeNight;
            }else{
                // Day to night
                let ease = (_timeStartingAtSunrise - _dayLength + _transition) / _transition;
                newSingleSliderEditing = ease < .5 ? 'day' : 'night';
                _shade = ShadeEaseLerp(shadeDay, shadeNight, ease);
            }
        }else{
            // Night
            newSingleSliderEditing = 'night';
            _shade = shadeNight;
        }
    }

    // Determine sun color
    if(_noSunCycle){
        _suncolor = _midnightSun ? _daySunColor : _nightSunColor;
    }else{
        let _tsunrise = o(n - _sunrise); // Normalize time so 0 is right before the transition to day happens
        if(_tsunrise < _transition)
            // Transitioning from night to day
            _suncolor = ColorLerp(_nightSunColor, _daySunColor, ShadeEaseLerp(0, 1, _tsunrise / _transition));
        else if(_tsunrise < _dayLength - _transition)
            // Day
            _suncolor = _daySunColor;
        else if(_tsunrise < _dayLength)
            // Transitioning from day to night
            _suncolor = ColorLerp(_daySunColor, _nightSunColor, ShadeEaseLerp(0, 1, (_tsunrise - _dayLength + _transition) / _transition));
        else
            // Night
            _suncolor = _nightSunColor;
    }

    // #endregion Algorithm

    // Update UI id singleSliderEditing changed. only change when not previewing shade and when user isn't holding down any slider.
    if(!previewingShade && !shadeSliderMouseDown && newSingleSliderEditing != singleSliderEditing){
        singleSliderEditing = newSingleSliderEditing;
        UpdateUI();
    }

    // Position sun and set its color
    $temperatureGraphSun.setAttribute('transform', `translate(0 ${(_shade / GetMaxShade() * _movementHeight + _padTop).toFixed(1)})`);
    $temperatureGraphSun.setAttribute('fill', `rgb(${_suncolor.join(', ')})`);

    // Update circadian response text
    $temperatureGraphText.textContent = `Circadian Response: ${Math.round(100 - _shade * 100)}%`;

    // When previewing shade, update the preview time text and update temporary shade
    if(previewingShade){
        let date = new Date(Date.now() + previewShadeOffset);
        date.setMinutes(0);
        $temperatureGraphPreviewTimeText.textContent = ToLocalTimeString(date);
        UpdateTemporaryShade(_shade);
    }
    
    // Offset fill path so it is correctly timed
    if(settings.shadeNewAlgo)
        // Normalize time so 0 is right before the transition to sleep happens. Add .5 so the center is the right time
        $temperatureGraphOffset.setAttribute('transform', `translate(${(0 - o(n - _sleepStart + .5) * _width).toFixed(1)})`);
    else if(!_noSunCycle)
        // Normalize time so 0 is right before the transition to day happens. Add .5 so the center is the right time
        $temperatureGraphOffset.setAttribute('transform', `translate(${(0 - o(n - _sunrise + .5) * _width).toFixed(1)})`);

    // Offset fill path so it is correctly timed
    $temperatureGraphSineWave.setAttribute('transform', `translate(${(0 - o(n) * _width).toFixed(1)})`);

    if(updateFillPath){
        let _yday = (shadeDay / GetMaxShade() * _movementHeight + _padTop).toFixed(1),
            _ynight = (shadeNight / GetMaxShade() * _movementHeight + _padTop).toFixed(1),
            _ysleep = (shadeSleep / GetMaxShade() * _movementHeight + _padTop).toFixed(1),

            _xtransition = _transition * _width, // Transition duration
            _xt0 = -1, // Transition point 0
            _xt1 = _xtransition * .65, // Transition point 1
            _xt2 = _xtransition * .35, // Transition point 2
            _xt3 = _xtransition, // Transition point 3
            _xend = _width * 2 + 1, // End x point

            _colorDay = `rgb(${ColorLerp(_backgroundColor, settings.color, shadeDay).join(', ')})`,
            _colorNight = `rgb(${ColorLerp(_backgroundColor, settings.color, shadeNight).join(', ')})`,

            _grad = [];

        // If we are using the new shade algorithm
        if(settings.shadeNewAlgo){
            let _xsleep = (LENGTHSLEEP - _transition / 2) * _width, // How long the sleep period lasts until we have to transition out of it

                _sleepStartsDuringDay = o(_sleepStart - _sunrise - _transition) < _dayLength - _transition,
                _sleepEndsDuringDay = o(settings.wakeupTime - _sunrise) < _dayLength - _transition,

                _yTransitionToNight = _sleepStartsDuringDay || _midnightSun ? _yday : _ynight,
                _yTransitionFromNight = _sleepEndsDuringDay || _midnightSun ? _yday : _ynight,

                _colorSleep = `rgb(${ColorLerp([245, 245, 245], settings.color, shadeSleep).join(', ')})`,
                _colorToNight = _sleepStartsDuringDay || _midnightSun ? _colorDay : _colorNight,
                _colorFromNight = _sleepEndsDuringDay || _midnightSun ? _colorDay : _colorNight,

                _sunriselen = o(_sunrise - _sleepStart),
                _xsunrise = _sunriselen * _width,
                _sunsetlen = o(_sunset - _sleepStart - _transition),
                _xsunset = _sunsetlen * _width,
                _drawsunrise = _xsunrise > _xsleep + _xt3 && _xsunrise < _width - _xtransition,
                _drawsunset = _xsunset > _xsleep + _xt3 && _xsunset < _width - _xtransition,

                _fill = [`M ${_xt0} ${_height}`];

            // Loop that runs twice
            for(let _loop = 0; _loop < 2; _loop++){
                let _xadd = _loop * _width;

                // Sleep transition to and from sleep
                _fill.push(`L ${(_xadd + _xt0).toFixed(1)} ${_yTransitionToNight} C ${(_xadd + _xt1).toFixed(1)} ${_yTransitionToNight}, ${(_xadd + _xt2).toFixed(1)} ${_ysleep}, ${(_xadd + _xt3).toFixed(1)} ${_ysleep}`);
                _fill.push(`L ${(_xadd + _xsleep + _xt0).toFixed(1)} ${_ysleep} C ${(_xadd + _xsleep + _xt1).toFixed(1)} ${_ysleep}, ${(_xadd + _xsleep + _xt2).toFixed(1)} ${_yTransitionFromNight}, ${(_xadd + _xsleep + _xt3).toFixed(1)} ${_yTransitionFromNight}`);

                // If we have a sun cycle show it
                if(!_noSunCycle){
                    if(_drawsunrise)
                        _fill.push(`L ${(_xadd + _xsunrise + _xt0).toFixed(1)} ${_ynight} C ${(_xadd + _xsunrise + _xt1).toFixed(1)} ${_ynight}, ${(_xadd + _xsunrise + _xt2).toFixed(1)} ${_yday}, ${(_xadd + _xsunrise + _xt3).toFixed(1)} ${_yday}`);
                    if(_drawsunset)
                        _fill.push(`L ${(_xadd + _xsunset + _xt0).toFixed(1)} ${_yday} C ${(_xadd + _xsunset + _xt1).toFixed(1)} ${_yday}, ${(_xadd + _xsunset + _xt2).toFixed(1)} ${_ynight}, ${(_xadd + _xsunset + _xt3).toFixed(1)} ${_ynight}`);

                    // Sunset happens before sunrise, so the order of both have to be reversed
                    if(_drawsunrise && _drawsunset && _sleepStartsDuringDay && _sleepEndsDuringDay)
                        _fill.splice(_fill.length - 2, 0, _fill.pop());
                }
            }

            _fill.push(`L ${_xend} ${_yTransitionToNight} L ${_xend} ${_height}`);
            $temperatureGraphFill.setAttribute('d', _fill.join());

            // Set color of gradient stops
            _grad.push({color: _colorToNight,   offset: 0});
            _grad.push({color: _colorSleep,     offset: _transition});
            _grad.push({color: _colorSleep,     offset: LENGTHSLEEP - _transition / 2});
            _grad.push({color: _colorFromNight, offset: LENGTHSLEEP + _transition / 2});
            if(!_noSunCycle){
                if(_drawsunrise && _drawsunset && _sleepStartsDuringDay && _sleepEndsDuringDay){
                    _grad.push({color: _colorDay,   offset: _sunsetlen});
                    _grad.push({color: _colorNight, offset: _sunsetlen + _transition});
                    _grad.push({color: _colorNight, offset: _sunriselen});
                    _grad.push({color: _colorDay,   offset: _sunriselen + _transition});
                }else{
                    if(_drawsunrise){
                        _grad.push({color: _colorNight, offset: _sunriselen});
                        _grad.push({color: _colorDay,   offset: _sunriselen + _transition});
                    }
                    if(_drawsunset){
                        _grad.push({color: _colorDay,   offset: _sunsetlen});
                        _grad.push({color: _colorNight, offset: _sunsetlen + _transition});
                    }
                }
            }

            // Position region rects
            let _regionday = o(_sunrise - _sleepStart + _transition / 2) * _width,
                _regionwidth = o(_sunset - _sunrise - _transition) * _width;
            $temperatureGraphRegionDay1.setAttribute('x', (_regionday - _width).toFixed(1));
            $temperatureGraphRegionDay1.setAttribute('width', _regionwidth.toFixed(1));
            $temperatureGraphRegionDay2.setAttribute('x', _regionday.toFixed(1));
            $temperatureGraphRegionDay2.setAttribute('width', _regionwidth.toFixed(1));
            $temperatureGraphRegionDay3.setAttribute('x', (_regionday + _width).toFixed(1));
            $temperatureGraphRegionDay3.setAttribute('width', _regionwidth.toFixed(1));
            $temperatureGraphRegionSleep1.setAttribute('x', (_xtransition / 2).toFixed(1));
            $temperatureGraphRegionSleep1.setAttribute('width', _xsleep.toFixed(1));
            $temperatureGraphRegionSleep2.setAttribute('x', (_width + _xtransition / 2).toFixed(1));
            $temperatureGraphRegionSleep2.setAttribute('width', _xsleep.toFixed(1));
        }
        // If we are using the old shade algorithm, but there is no sun cycle
        else if(_noSunCycle){
            // Generate fill path
            let _y = _midnightSun ? _yday : _ynight;
            $temperatureGraphFill.setAttribute('d', `M ${_xt0} ${_height} L ${_xt0} ${_y} L ${_xend} ${_y} L ${_xend} ${_height}`);

            // Set color of gradient stops
            _grad.push({color: _midnightSun ? _colorDay : _colorNight, offset: 0});

            // Position region rects
            $temperatureGraphRegionDay1.setAttribute('x', 0);
            $temperatureGraphRegionDay1.setAttribute('width', whenPolarNight ? 0 : _xend);
            $temperatureGraphRegionDay2.setAttribute('x', 0);
            $temperatureGraphRegionDay2.setAttribute('width', 0);
            $temperatureGraphRegionDay3.setAttribute('x', 0);
            $temperatureGraphRegionDay3.setAttribute('width', 0);
            $temperatureGraphRegionSleep1.setAttribute('x', 0);
            $temperatureGraphRegionSleep1.setAttribute('width', 0);
            $temperatureGraphRegionSleep2.setAttribute('x', 0);
            $temperatureGraphRegionSleep2.setAttribute('width', 0);
        }
        // If we are using the old shade algorithm
        else{
            let _xdaylen = (_dayLength - _transition) * _width;

            // Generate fill path
            // _yday:     x2 /x3----x4\ x5     x10 /x11----x12\ x13
            //              /          \          /            \
            // _ynight:  x0/ x1      x6 \x7----x8/ x9       x14 \x15----x16
            //            |                                              |
            // _height:  x0                                             x16
            $temperatureGraphFill.setAttribute('d', 
                `M ${_xt0} ${_height}` +
                `L ${_xt0} ${_ynight} C ${_xt1} ${_ynight}, ${_xt2} ${_yday}, ${_xt3} ${_yday}` +
                `L ${_xdaylen + _xt0} ${_yday} C ${_xdaylen + _xt1} ${_yday}, ${_xdaylen + _xt2} ${_ynight}, ${_xdaylen + _xt3} ${_ynight}` +
                `L ${_width + _xt0} ${_ynight} C ${_width + _xt1} ${_ynight}, ${_width + _xt2} ${_yday}, ${_width + _xt3} ${_yday}` +
                `L ${_width + _xdaylen + _xt0} ${_yday} C ${_width + _xdaylen + _xt1} ${_yday}, ${_width + _xdaylen + _xt2} ${_ynight}, ${_width + _xdaylen + _xt3} ${_ynight}` +
                `L ${_xend} ${_ynight} L ${_xend} ${_height}`);
                

            // Set position of color gradient stops
            _grad.push({color: _colorNight, offset: 0});
            _grad.push({color: _colorDay, offset: _transition});
            _grad.push({color: _colorDay, offset: _dayLength - _transition});
            _grad.push({color: _colorNight, offset: _dayLength});

            // Position region rects
            $temperatureGraphRegionDay1.setAttribute('x', _xtransition / 2);
            $temperatureGraphRegionDay1.setAttribute('width', _xdaylen);
            $temperatureGraphRegionDay2.setAttribute('x', _width + _xtransition / 2);
            $temperatureGraphRegionDay2.setAttribute('width', _xdaylen);
            $temperatureGraphRegionDay3.setAttribute('x', 0);
            $temperatureGraphRegionDay3.setAttribute('width', 0);
            $temperatureGraphRegionSleep1.setAttribute('x', 0);
            $temperatureGraphRegionSleep1.setAttribute('width', 0);
            $temperatureGraphRegionSleep2.setAttribute('x', 0);
            $temperatureGraphRegionSleep2.setAttribute('width', 0);
        }

        // Remove all gradient stops
        while($temperatureGraphFillGradient.firstElementChild){
            $temperatureGraphFillGradient.removeChild($temperatureGraphFillGradient.firstElementChild);
        }

        // Generate gradient stops
        for(let _loop = 0; _loop < 2; _loop++){
            for(let {offset, color} of _grad){
                let $stop = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
                $stop.setAttribute('offset', ((_loop + offset) / 2).toFixed(4));
                $stop.setAttribute('stop-color', color);
                $temperatureGraphFillGradient.appendChild($stop);
            }
        }
    }
}

function GetMaxShade(){
    return settings.widerBlendingRange ? 1 : MAXSHADE;
}

function ShadeSlidersInput(set, value){
    let shade = Math.round(value * GetMaxShade() * 1000) / 1000;
    
    if(set == 'day'){
        shadeDay = shade;
        shadeNight = Math.max(settings.shadeNight, shade);
        shadeSleep = Math.max(settings.shadeSleep, shade);
    }else if(set == 'night'){
        shadeDay = Math.min(settings.shadeDay, shade);
        shadeNight = shade;
        shadeSleep = Math.max(settings.shadeSleep, shade);
    }else if(set == 'sleep'){
        shadeDay = Math.min(settings.shadeDay, shade);
        shadeNight = Math.min(settings.shadeNight, shade);
        shadeSleep = shade;
    }

    CancelPreviewShade();

    if(settings.shadeNewAlgo)
        $temperatureSettingSelector.value = 'custom';

    if(shadeSliderMouseDown){
        // Show temporary shade on pages since when user releases mouse the shade will update
        UpdateTemporaryShade(shade);
        clearInterval(temporaryShadeUpdaterInterval);
        temporaryShadeUpdaterInterval = setInterval(() => UpdateTemporaryShade(shade), UPDATETEMPSETTINGSINTERVAL);

        // Update temperature graph fill
        UpdateTemperatureGraph(true);

        // Display active 
        if(set == 'day')
            $temperatureWhenText.textContent = `Daytime shade: ${Math.round(100 - shadeDay * 100)}% \uD83C\uDF1E`;
        else if(set == 'night')
            $temperatureWhenText.textContent = `Night shade: ${Math.round(100 - shadeNight * 100)}% \uD83C\uDF1B`;
        else if(set == 'sleep')
            $temperatureWhenText.textContent = `Bedtime shade: ${Math.round(100 - shadeSleep * 100)}% \uD83D\uDECC`;
    }else{
        // User may have used arrow keys to modify value while focused on slider. In that case just update the shade immediately
        ChangeSettings({
            shadeDay,
            shadeNight,
            shadeSleep
        });
    }

    UpdateUI();
}

function ShadeSlidersMouseDown(evt){
    // Left click only
    if(evt.button == 0){
        $body.classList.add('slider-mousedown');
        shadeSliderMouseDown = true;

        // Re-enable shade
        disabledByUrlMatch = false;
        ChangeSettings({
            disabledSites: settings.disabledSites.filter(s => !PatternMatcher(s)),
            enabled: true
        });

        // If user highlighted text and tries to drag a slider, the slider would never get a mouseup event. So just clear the user's selection.
        ClearSelection();
    }
}

function ShadeSlidersMouseUp(){
    if(shadeSliderMouseDown){
        $body.classList.remove('slider-mousedown');
        shadeSliderMouseDown = false;

        clearInterval(temporaryShadeUpdaterInterval);
        ChangeSettings({
            shadeDay,
            shadeNight,
            shadeSleep
        });

        // Set text back to what it used to be
        UpdateSunsetTimeText();
    }
}

function UpdateTemporaryShade(temporaryShade){
    for(let id of activeTabIds){
        chrome.tabs.sendMessage(id, {
            instruction: 'temporary-settings',
            temporaryShade
        });
    }
}

// #endregion


// #region Color Menu

document.addEventListener('got-settings', () => {
    darknessSliderMax = Math.max(500, $darknessSliderInput.getBoundingClientRect().width);
    $darknessSliderInput.max = darknessSliderMax;

    // Generate buttons for default colors
    for(let rgb of DEFAULTCOLORS)
        AddNewColorPickerButton(rgb, false, false);

    // Generate buttons for default colors
    for(let rgb of settings.customColors)
        AddNewColorPickerButton(rgb, true, false);
});

$darknessSliderInput.addEventListener('input', () => ChangeSettings({darkness: Math.round($darknessSliderInput.value / darknessSliderMax * MAXDARKNESS * 1000) / 1000}));
$darknessSliderInput.addEventListener('mousedown', evt => {
    if(evt.button == 0){
        $body.classList.add('slider-mousedown');

        // If user highlighted text and tries to drag a slider, the slider would never get a mouseup event. So just clear the user's selection.
        ClearSelection();
    }
});
$darknessSliderInput.addEventListener('mouseup', () => $body.classList.remove('slider-mousedown'));

$addNewColor.addEventListener('click', () => ShowColorPicker(...settings.color, true));

// Show colors hint
$showColorHint.addEventListener('click', () => $body.classList.add('show-color-hint'));

function AddNewColorPickerButton(color, customColor, setAsNewColor){
    let $button = document.createElement('div'),
        $fill = document.createElement('div'),
        colorPickerButton = {
            $button,
            $fill,
            color,
            customColor
        };

    $button.classList.add('color');
    $colorChoices.insertBefore($button, $addNewColor);

    $fill.classList.add('fill');
    $fill.style.backgroundColor = `rgb(${color.join(', ')})`;
    $fill.addEventListener('click', () => ClickColorPickerButton(colorPickerButton));
    $button.appendChild($fill);

    if(customColor){
        // Create icons to delete or edit this color
        let $delete = document.createElement('div'),
            $edit = document.createElement('div');
        $delete.classList.add('delete');
        $edit.classList.add('edit');
        $delete.setAttribute('title', 'Delete this color');
        $edit.setAttribute('title', 'Edit this color');
        $delete.addEventListener('click', () => ClickColorPickerButtonDelete(colorPickerButton));
        $edit.addEventListener('click', () => ClickColorPickerButtonEdit(colorPickerButton));
        $button.appendChild($delete);
        $button.appendChild($edit);
    }

    // Should this button be selected as the new color
    if(setAsNewColor){
        ClickColorPickerButton(colorPickerButton);
    }
    // As soon as a button is created and it is the current color, select it and unselect others
    else if(ColorsEqual(settings.color, color)){
        for(let c of colorPickerButtons)
            c.$button.classList.remove('selected');
        $button.classList.add('selected');
    }

    // Add our button to the array
    colorPickerButtons.push(colorPickerButton);
    return colorPickerButton;
}

function ClickColorPickerButton(colorPickerButton){
    let {$button, color} = colorPickerButton;

    for(let c of colorPickerButtons)
        c.$button.classList.remove('selected');
    $button.classList.add('selected');

    // If the color isn't al
    if(!ColorsEqual(settings.color, color)){
        ChangeSettings({color});
        UpdateTemperatureGraph(true);
    }
}

function ClickColorPickerButtonDelete(colorPickerButton){
    let {$button, color} = colorPickerButton;

    // Remove button from html and from colorPickerButtons array
    $colorChoices.removeChild($button);
    colorPickerButtons.splice(colorPickerButtons.indexOf(colorPickerButton), 1);

    // If this button is selected, some other button should be selected once its removed
    if($button.classList.contains('selected')){
        let sameColorButton = colorPickerButtons.find(c => ColorsEqual(c.color, color))

        // If any other button exists with the same color, then select that button instead
        // Otherwise select another
        ClickColorPickerButton(sameColorButton || colorPickerButtons[0]);
    }

    // Since no other button has this color, remove it from the customColors list
    UpdateCustomColors();
}

function ClickColorPickerButtonEdit(colorPickerButton){
    editingColorPickerButton = colorPickerButton;
    ShowColorPicker(...colorPickerButton.color, false);
}

function SetEditingColorPickerButtonColor(newColor){
    if(editingColorPickerButton){
        let {$button, $fill, color} = editingColorPickerButton;

        if(!ColorsEqual(color, newColor)){
            editingColorPickerButton.color = newColor;
            $fill.style.backgroundColor = `rgb(${newColor.join(', ')})`;

            // If button was selected, set the color to this new edited color
            console.log($button.classList.contains('selected'))
            if($button.classList.contains('selected')){
                ChangeSettings({color: newColor});
                UpdateTemperatureGraph(true);
            }

            UpdateCustomColors();
        }

        editingColorPickerButton = undefined;
    }
}

function ColorPickerAddNewColor(color){
    // Create a new color button setting it as the new color
    AddNewColorPickerButton(color, true, true);
    UpdateCustomColors();
}


function UpdateCustomColors(){
    let customColors = [];
    for(let colorPickerButton of colorPickerButtons){
        let {color, customColor} = colorPickerButton;
        // Is custom color, isn't in DEFAULTCOLORS, and wasn't already added to customColors
        if(customColor && DEFAULTCOLORS.every(c => !ColorsEqual(c, color)) && customColors.every(c => !ColorsEqual(c, color)))
            customColors.push(color);
    }
    ChangeSettings({customColors});
}


function ColorsEqual(color1, color2){
    return  color1[0] === color2[0] && color1[1] === color2[1] && color1[2] === color2[2];
}

// #endregion


// #region Location Page

// Clicking autofind button will query geoip plugin for geolocation info
$locationAutofindButton.addEventListener('click', LocationAutoFind);

// Clicking outside the location search will close it
$locationSearch.addEventListener('mousedown', evt => evt.stopPropagation());
$body.addEventListener('mousedown', () => $locationSearch.classList.remove('focused'));

// Clicking the location search opens the results menu and loads queries (query may have changed because user used arrow keys and enter to select a result)
$locationSearchInput.addEventListener('focus', () => {
    $locationSearchInput.select();
    $locationSearch.classList.add('focused');
    LocationQueryResultsLoad();
    LocationUnderlinerUpdateWidth();
});

// Update underline to be same width as text in search input
$locationSearchInput.addEventListener('input', LocationUnderlinerUpdateWidth);

// Update location query results
$locationSearchInput.addEventListener('keyup', LocationQueryResultsLoad);

// Process some keyboard shortcuts used to select location results
$locationSearchInput.addEventListener('keydown', evt => {
    // Bluring the input using tab should unfocus the location search
    if(evt.key == 'Tab'){
        $locationSearch.classList.remove('focused')
    }
    // Arrow up moves the selection up one result
    else if(evt.key == 'ArrowUp'){
        if($locationResults.firstChild){
            let $selectedResult = $locationResults.querySelector('.select') || $locationResults.firstChild,
                $newSelected = $selectedResult !== $locationResults.firstChild ? $selectedResult.previousSibling : $locationResults.lastChild;

            evt.preventDefault();
            $selectedResult.classList.remove('select');
            $newSelected.classList.add('select');
        }
    }
    // Arrow down moves the selection down one result
    else if(evt.key == 'ArrowDown'){
        if($locationResults.firstChild){
            let $selectedResult = $locationResults.querySelector('.select') || $locationResults.lastChild,
                $newSelected = $selectedResult !== $locationResults.lastChild ? $selectedResult.nextSibling : $locationResults.firstChild;

            evt.preventDefault();
            $selectedResult.classList.remove('select');
            $newSelected.classList.add('select');
        }
    }
    // Enter clicks the selected result or the first result if nothing is selected
    else if(evt.key == 'Enter'){
        if($locationResults.firstChild){
            let $selectedResult = $locationResults.querySelector('.select') || $locationResults.firstChild;

            $selectedResult.click();
            $locationSearchInput.value = settings.locationName;
        }

        evt.preventDefault();
        $locationSearchInput.blur();
        $locationSearch.classList.remove('focused');
    }
    // Escape un-focuses the input and consumes the event, which would otherwise close the extension popup menu
    else if(evt.key == 'Escape'){
        evt.preventDefault();
        $locationSearchInput.blur();
        $locationSearch.classList.remove('focused');
    }
});

// When user clicks down and moves mouse arround over map, update location. When user finally releases mouse, show move animation.
$locationMap.addEventListener('mousedown', evt => {
    if(evt.button == 0 && !mouseDownOverMap){
        mouseDownOverMap = true;
        $locationMapPointer.classList.remove('move-animate');
        LocationMapUpdateEvent(evt);
    }
});
$body.addEventListener('mouseup', evt => {
    if(evt.button == 0 && mouseDownOverMap){
        mouseDownOverMap = false;
        setTimeout(() => $locationMapPointer.classList.add('move-animate'));
    }
});
$locationMap.addEventListener('mousemove', evt => LocationMapUpdateEvent(evt));

// Process changes to latititude and longitude input boxes
$locationLatInput.addEventListener('focus', () => $locationLatInput.select());
$locationLatInput.addEventListener('input', () => LocationInputChange(true, true));
$locationLatInput.addEventListener('change', () => LocationInputChange(false, true));
$locationLonInput.addEventListener('focus', () => $locationLonInput.select());
$locationLonInput.addEventListener('input', () => LocationInputChange(true, false));
$locationLonInput.addEventListener('change', () => LocationInputChange(false, false));

// Clicking the show hint button shows the hint
$showLocationHint.addEventListener('click', () => $body.classList.add('show-location-hint'));

// Clicking the show hint button shows the hint
function ClickLocationSearchResult(result){
    ChangeSettings({
        hasLocation: true,
        locationName: result.name + ', ' + countriesDB[result.countryid],
        latitude: result.lat,
        longitude: result.lon
    });

    LoadSunriseSunsetTime(true);
    UpdateTemperatureGraph(true);

    $locationSearch.classList.remove('focused');

    $locationMapPointer.classList.remove('move-animate');
    setTimeout(() => $locationMapPointer.classList.add('move-animate'));
}

function LocationMapUpdateEvent(evt){
    if(mouseDownOverMap){
        let rect = $locationMap.getBoundingClientRect(),
            x = evt.pageX - rect.left,
            y = evt.pageY - rect.top,
            lon = Math.round((x / GEOMAPWIDTH * 360 % 360 - 180) * 10) / 10,
            lat = Math.round(Math.max(-90, Math.min(90, (y + 16) / GEOMAPHEIGHT * -180 + 90)) * 10) / 10;
        
        LocationSetCustomCoordinate(lat, lon);
    }
}

function LocationInputChange(isInputEvent, isLatitude){
    let $input = isLatitude ? $locationLatInput : $locationLonInput,
        value = $input.value.toUpperCase().replace(/[\u00B0\s]/g, '').replace(/,/g, '.'), // Remove degree symbol, spaces, and replace commas with decimals
        parsed = parseFloat(value) * (value.endsWith(isLatitude ? 'S' : 'W') ? -1 : 1), // Parse value, inverting its value with the presence of north or south
        valid = (isLatitude ? /^-?\d*\.?\d*(N|S)?$/ : /^-?\d*\.?\d*(E|W)?$/).test(value) && !isNaN(parsed) && parsed <= 90 && parsed >= -90;

    if(isInputEvent){
        $input.classList.toggle('incorrect', !valid);
    }else{
        $input.classList.remove('incorrect');

        if(valid){
            if(isLatitude)
                LocationSetCustomCoordinate(parsed, settings.longitude);
            else
                LocationSetCustomCoordinate(settings.latitude, parsed);
            
            $locationMapPointer.classList.remove('move-animate');
            setTimeout(() => $locationMapPointer.classList.add('move-animate'));
        }else{
            UpdateUI();
        }

        $input.blur();
    }
}

function LocationUnderlinerUpdateWidth(){
    $locationUnderliner.style.width = GetInputTextWidth($locationSearchInput);
}

function LocationQueryResultsLoad(){
    let query = $locationSearchInput.value.replace(/[()[\]{}|/\\,.'"_\-+=!@#$%^&*~`:;<>?]/g, '').replace(/\s+/, ' ').trim();

    if(oldLocationQuery != query){
        oldLocationQuery = query;
    
        // Remove all
        while($locationResults.firstChild)
            $locationResults.removeChild($locationResults.firstChild);

        if(query.length > 1){
            let queryBigram = bigrams(query),
                // Cache our query's similarity to each country, since we'll be needing these many times
                countryNameRelevance = countriesDB.map(country => {
                    let cr = contains(queryBigram, bigrams(country));
                    return cr * cr * cr;
                }),
                // Get 10 highest cities that match our query
                results = citiesDB.map(([lat, lon, countryid, cityascii, city]) => {
                    // Get greater relevance of "city" or "cityascii"
                    let relevance = similarity(queryBigram, bigrams(cityascii.replace(/[(),'".]/g, '')));
                    if(city)
                        relevance = Math.max(relevance, similarity(queryBigram, bigrams(city.replace(/[(),'".]/g, ''))));

                    // Add relvance to country name
                    relevance += countryNameRelevance[countryid];

                    return {
                        name: (city || cityascii),
                        countryid,
                        lat,
                        lon,
                        relevance
                    };
                }).filter(c => c.relevance > .3).sort((a, b) => b.relevance - a.relevance).slice(0, 8);

            if(results.length)
                results = results.filter(c => c.relevance > results[0].relevance - .4);

            for(let result of results){
                let $li = document.createElement('li');
                $li.textContent = result.name + ', ' + countriesDB[result.countryid];
                $li.addEventListener('click', () => ClickLocationSearchResult(result));
                $locationResults.appendChild($li);
            }
        }
    }
}

function LocationSetCustomCoordinate(lat, lon){
    if(lat != settings.latitude || lon != settings.longitude){
        let nearestCityIndex = -1,
            nearestCityDistSquared = 5 * 5, // Nearest city has to be decently close
            locationName;

        for(let i = citiesDB.length; i-- > 0;){
            let a = citiesDB[i][0] - lat,
                b = citiesDB[i][1] - lon,
                distSquared = a * a + b * b;
            if(distSquared < nearestCityDistSquared){
                nearestCityIndex = i;
                nearestCityDistSquared = distSquared;
            }
        }

        if(nearestCityIndex == -1){
            locationName = 'Custom Coordinate';
        }else{
            let [_, __, countryid, cityascii, city] = citiesDB[nearestCityIndex];
            locationName = (nearestCityDistSquared < .04 ? '' : 'Custom Coordinate near ') + (city || cityascii) + ', ' + countriesDB[countryid];
        }

        ChangeSettings({
            hasLocation: true,
            locationName,
            latitude: lat,
            longitude: lon
        });
        LoadSunriseSunsetTime(true);
        UpdateTemperatureGraph(true);
    }else{
        UpdateUI();
    }
}

function LocationAutoFind(){
    $locationAutofindButton.classList.add('fetching');
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
            LoadSunriseSunsetTime(true);
            UpdateTemperatureGraph(true);
            ApplySettingsChanges();
            UpdateUI();

            $locationAutofindButton.classList.remove('fetching');

            $locationMapPointer.classList.remove('move-animate');
            setTimeout(() => $locationMapPointer.classList.add('move-animate'));
        });
}

// #endregion


// #region Settings Page

// Process changes to setting inputs
$settingTransitionSpeed.addEventListener('change', () => {
    ChangeSettings({transitionSpeed: $settingTransitionSpeed.value});
    UpdateTemperatureGraph(true);
});
$settingColorBlending.addEventListener('change', () => ChangeSettings({colorBlending: $settingColorBlending.value}));
$settingShadedScrollbar.addEventListener('change', () => ChangeSettings({shadedScrollbar: $settingShadedScrollbar.checked}));
$settingShadeFullscreen.addEventListener('change', () => ChangeSettings({shadeFullscreen: $settingShadeFullscreen.checked}));
$settingWiderBlendingRange.addEventListener('change', () => {
    let checked = $settingWiderBlendingRange.checked;

    if(!checked){
        shadeDay = Math.min(MAXSHADE, shadeDay);
        shadeNight = Math.min(MAXSHADE, shadeNight);
        shadeSleep = Math.min(MAXSHADE, shadeSleep);
    }

    ChangeSettings({
        widerBlendingRange: checked,
        shadeDay,
        shadeNight,
        shadeSleep
    });

    UpdateTemperatureGraph(true);
});
$settingDisableDeveloperWarning.addEventListener('change', () => ChangeSettings({disableDeveloperWarning: $settingDisableDeveloperWarning.checked}));



$settingEditKeyboardShortcut.addEventListener('click', () => {
    let chromeVersion = /(Chrome|Chromium)\/([0-9]+)/.exec(navigator.userAgent);
    // Open old or new extension shortcuts page
    if(chromeVersion && parseInt(chromeVersion[2]) < 65)
        chrome.tabs.create({url: 'chrome://extensions/configureCommands/#ScreenShader', active: true});
    else
        chrome.tabs.create({url: 'chrome://extensions/shortcuts', active: true});
});

$settingResetSettings.addEventListener('click', () => {
    clearTimeout(settingsResetButtonTimeout);
    if(!settingsResetClickAgain){
        settingsResetClickAgain = true;
        $settingResetSettings.classList.add('click-again');
        settingsResetButtonTimeout = setTimeout(() => {
            settingsResetClickAgain = false;
            $settingResetSettings.classList.remove('click-again');
        }, 5000);
    }else{
        // Reset Settings
        ChangeSettings(Object.assign({}, DEFAULTSETTINGS));
        shadeDay = settings.shadeDay;
        shadeNight = settings.shadeNight;
        shadeSleep = settings.shadeSleep;

        // Draw graph again
        UpdateTemperatureGraph(true);

        // Find location
        setTimeout(LocationAutoFind, 100);

        // Return to temperature page and reset preset selector
        $temperatureSettingSelector.value = 'recommended';
        ClickPageButton('temperature', false);

        // Reset button
        settingsResetClickAgain = false;
        $settingResetSettings.classList.remove('click-again');
    }
});

$settingIssueResolutionPage.addEventListener('click', () => {
    chrome.tabs.create({url: chrome.runtime.getURL('common-issues.html'), active: true});
});

// #endregion


// #region Color Picker

// Initially draw Color Picker
document.addEventListener('got-settings', () => {
    // Draw hue circle on hue canvas
    let ctx = $colorPickerHueCanvas.getContext('2d'),
        center = $colorPickerHueCanvas.width / 2,

        points = 20,
        angle = 360 / points,
        radLarge = center + 2,
        radSmall = radLarge - 22;

    for (let i = 1; i <= points; i++) {
        // Arc points
        let a = i * angle,
            b = (i - 1) * angle;
        
        // Gradient vector
        let radius = radSmall + (radLarge - radSmall) / 2,
            x1 = Math.cos(a * TORADS) * radius + center,
            y1 = Math.sin(a * TORADS) * radius + center,
            x2 = Math.cos(b * TORADS) * radius + center,
            y2 = Math.sin(b * TORADS) * radius + center;

        // Gradient
        let g = ctx.createLinearGradient(x1, y1, x2, y2);
        g.addColorStop(0, `hsl(${a}, 100%, 50%)`);
        g.addColorStop(1, `hsl(${b}, 100%, 50%)`);
        // Draw arc
        let o = 0.01;
        ctx.beginPath();
        ctx.arc(center, center, radLarge, b * TORADS - o, a * TORADS + o, false);
        ctx.arc(center, center, radSmall, a * TORADS + o, b * TORADS - o, true);
        ctx.fillStyle = g;
        ctx.fill();
    }
});

// Color picker events
$colorPickerHueCanvas.addEventListener('mousedown', evt => { 
    colorPickerHueActive = true;
    colorPickerTriangleActive = false;
    UpdateColorPickerHueEvent(evt);
});
$colorPickerTriangleCanvas.addEventListener('mousedown', evt => { 
    colorPickerHueActive = false;
    colorPickerTriangleActive = true;
    UpdateColorPickerTriangleEvent(evt);
});
$body.addEventListener('mouseup', () => colorPickerHueActive = colorPickerTriangleActive = false);
$body.addEventListener('mousemove', evt => {
    if(colorPickerHueActive)
        UpdateColorPickerHueEvent(evt);
    else if(colorPickerTriangleActive)
        UpdateColorPickerTriangleEvent(evt);
});

// Hex input events
$colorPickerHexInput.addEventListener('focus', () => $colorPickerHexInput.select());
$colorPickerHexInput.addEventListener('input', () => ColorPickerHexInput(true));
$colorPickerHexInput.addEventListener('change', () => ColorPickerHexInput(false));

// Red, green and blue input events
$colorPickerRedInput.addEventListener('focus', () => $colorPickerRedInput.select());
$colorPickerRedInput.addEventListener('input', () => ColorPickerRGBInput($colorPickerRedInput, true));
$colorPickerRedInput.addEventListener('change', () => ColorPickerRGBInput($colorPickerRedInput, false));
$colorPickerGreenInput.addEventListener('focus', () => $colorPickerGreenInput.select());
$colorPickerGreenInput.addEventListener('input', () => ColorPickerRGBInput($colorPickerGreenInput, true));
$colorPickerGreenInput.addEventListener('change', () => ColorPickerRGBInput($colorPickerGreenInput, false));
$colorPickerBlueInput.addEventListener('focus', () => $colorPickerBlueInput.select());
$colorPickerBlueInput.addEventListener('input', () => ColorPickerRGBInput($colorPickerBlueInput, true));
$colorPickerBlueInput.addEventListener('change', () => ColorPickerRGBInput($colorPickerBlueInput, false));

// Add New Color, Set Color and Cancel buttons
$colorPickerAdd.addEventListener('click', () => {
    // Add new color picker button
    ColorPickerAddNewColor(hslToRgb(colorPickerHue, colorPickerSaturation, colorPickerLightness));

    ColorPickerClose();
});
$colorPickerSet.addEventListener('click', () => {
    // Set the color of the color picker button currently being edited
    SetEditingColorPickerButtonColor(hslToRgb(colorPickerHue, colorPickerSaturation, colorPickerLightness));

    ColorPickerClose();
});
$colorPickerCancel.addEventListener('click', ColorPickerClose);


function ShowColorPicker(r, g, b, addNewColor){
    if(addNewColor){
        $colorPickerAdd.style.display = 'block';
        $colorPickerSet.style.display = 'none';
    }else{
        $colorPickerAdd.style.display = 'none';
        $colorPickerSet.style.display = 'block';
    }

    [colorPickerHue, colorPickerSaturation, colorPickerLightness] = rgbToHsl(r, g, b);
    UpdateColorPicker();
    $body.classList.add('show-color-picker');
}

function UpdateColorPickerHueEvent(evt){
    let rect = $colorPickerHueCanvas.getBoundingClientRect(),
        x = evt.pageX - (rect.left + rect.right) / 2,
        y = evt.pageY - (rect.top + rect.bottom) / 2;

    colorPickerHue = Math.round(Math.atan2(y, x) / TORADS * 100) / 100;
    UpdateColorPicker();
}

// Big thanks to timjb for his work on https://github.com/timjb/colortriangle
// Much of the math here is copied and pasted from his :)
function UpdateColorPickerTriangleEvent(evt){
    let rect = $colorPickerTriangleCanvas.getBoundingClientRect(),
        x = evt.pageX - (rect.left + rect.right) / 2,
        y = evt.pageY - (rect.top + rect.bottom) / 2,

        center = $colorPickerTriangleCanvas.width / 2,
        triangleRadius = center - 7,
        triangleSideLength = Math.sqrt(3) * triangleRadius,

        rad = Math.atan2(-y, x),
        rad0 = (rad + 2 * Math.PI + colorPickerHue * TORADS) % (2 * Math.PI),
        rad1 = rad0 % ((2 / 3) * Math.PI) - (Math.PI / 3),
        a    = 0.5 * triangleRadius,
        b    = Math.tan(rad1) * a,
        r    = Math.sqrt(x*x + y*y),
        maxR = Math.sqrt(a*a + b*b);

    // If mouse is outside triangle
    if(r > maxR) {
        let dx = Math.tan(rad1) * r,
            rad2 = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, Math.atan(dx / maxR)));

        rad += rad2 - rad1;
        
        rad0 = (rad + 2 * Math.PI + colorPickerHue * TORADS) % (2 * Math.PI);
        rad1 = rad0 % ((2/3) * Math.PI) - (Math.PI / 3);
        b = Math.tan(rad1) * a;
        r = maxR = Math.sqrt(a*a + b*b);
    }

    x = Math.round( Math.cos(rad) * r);
    y = Math.round(-Math.sin(rad) * r);

    let l = ((Math.sin(rad0) * r) / triangleSideLength) + 0.5,
        widthShare = 1 - (Math.abs(l - 0.5) * 2),
        s = (((Math.cos(rad0) * r) + (triangleRadius / 2)) / (1.5 * triangleRadius)) / widthShare;

    colorPickerLightness = l;
    colorPickerSaturation = Math.max(0, Math.min(1, s));

    $colorPickerTrianglePointer.style.backgroundColor = `hsl(${colorPickerHue}, ${colorPickerSaturation * 100}%, ${colorPickerLightness * 100}%)`;
    $colorPickerTrianglePointer.style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px)`;

    UpdateColorPickerInputs();
}

function UpdateColorPicker(){
    let ctx = $colorPickerTriangleCanvas.getContext('2d'),
        center = $colorPickerTriangleCanvas.width / 2,
        triangleRadius = center - 7,

        // White point
        wx = Math.cos((colorPickerHue + -120) * TORADS) * triangleRadius + center,
        wy = Math.sin((colorPickerHue + -120) * TORADS) * triangleRadius + center,
        // Colored point
        hx = Math.cos(colorPickerHue * TORADS) * triangleRadius + center,
        hy = Math.sin(colorPickerHue * TORADS) * triangleRadius + center,
        // Black point
        bx = Math.cos((colorPickerHue + 120) * TORADS) * triangleRadius + center,
        by = Math.sin((colorPickerHue + 120) * TORADS) * triangleRadius + center,
        // End of hue gradient
        hmx = (wx + bx) / 2,
        hmy = (wy + by) / 2,
        // End of white gradient
        wmx = (hx + bx) / 2,
        wmy = (hx + by) / 2;

    // Position pointer over right hue
    $colorPickerHuePointer.style.backgroundColor = `hsl(${colorPickerHue}, 100%, 50%)`;
    $colorPickerHuePointer.style.transform = `translate(${(110 * Math.cos(colorPickerHue * TORADS)).toFixed(2)}px, ${(110 * Math.sin(colorPickerHue * TORADS)).toFixed(2)}px) rotate(${colorPickerHue}deg)`;

    // Position pointer over triangle
    let mx = (bx + wx) / 2,
		my = (by + wy) / 2,
		a  = (1 - 2 * Math.abs(colorPickerLightness - .5)) * colorPickerSaturation,
		x = bx + (wx - bx) * colorPickerLightness + (hx - mx) * a, // (hx * colorPickerSaturation + (wx * colorPickerLightness + bx * (1 - colorPickerLightness)) * (1 - colorPickerSaturation))
		y = by + (wy - by) * colorPickerLightness + (hy - my) * a; // (hy * colorPickerSaturation + (wy * colorPickerLightness + by * (1 - colorPickerLightness)) * (1 - colorPickerSaturation))
    $colorPickerTrianglePointer.style.backgroundColor = `hsl(${colorPickerHue}, ${colorPickerSaturation * 100}%, ${colorPickerLightness * 100}%)`;
    $colorPickerTrianglePointer.style.transform = `translate(${(x - center).toFixed(2)}px, ${(y - center).toFixed(2)}px)`;

    // Clear triangle canvas
    ctx.clearRect(0, 0, $colorPickerTriangleCanvas.width, $colorPickerTriangleCanvas.height);

    // Fill with black
    ctx.beginPath();
    ctx.moveTo(wx, wy);
    ctx.lineTo(hx, hy);
    ctx.lineTo(bx, by);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'black';
    ctx.fill();

    // Gradient 1: hue => transparent hue
    var g1 = ctx.createLinearGradient(hx, hy, hmx, hmy)
    g1.addColorStop(0, `hsla(${colorPickerHue}, 100%, 50%, 1)`);
    g1.addColorStop(1, `hsla(${colorPickerHue}, 100%, 50%, 0)`);
    
    ctx.beginPath();
    ctx.moveTo(wx, wy);
    ctx.lineTo(hx, hy);
    ctx.lineTo(bx, by);
    ctx.fillStyle = g1;
    ctx.fill();

    // Gradient 2: white => transparent white
    var g2 = ctx.createLinearGradient(wx, wy, wmx, wmy);
    g2.addColorStop(0, 'rgba(255, 255, 255, 1)');
    g2.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.beginPath();
    ctx.moveTo(wx, wy);
    ctx.lineTo(hx, hy);
    ctx.lineTo(bx, by);
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = g2;
    ctx.fill();

    UpdateColorPickerInputs();
}

function UpdateColorPickerInputs(){
    let color = hslToRgb(colorPickerHue, colorPickerSaturation, colorPickerLightness),
        [r, g, b] = color;
    $colorPickerHexInput.value = rgbToHex(r, g, b);
    $colorPickerRedInput.value = r;
    $colorPickerGreenInput.value = g;
    $colorPickerBlueInput.value = b;

    UpdateTemporaryColor(color);
    clearInterval(temporaryColorUpdaterInterval);
    temporaryColorUpdaterInterval = setInterval(() => UpdateTemporaryColor(color), UPDATETEMPSETTINGSINTERVAL);
}

function ColorPickerHexInput(isInputEvent){
    let cleaned = $colorPickerHexInput.value.trim().replace(/^#/, ''),
        isShort = cleaned.length == 3,
        valid = (isShort || cleaned.length == 6) && /^[\dA-F]+$/i.test(cleaned);

    if(isInputEvent){
        $colorPickerHexInput.classList.toggle('incorrect', !valid);
    }else{
        $colorPickerHexInput.classList.remove('incorrect');

        if(valid){
            let [r, g, b] = isShort ? cleaned.split('') : cleaned.match(/../g);
    
            r = parseInt(isShort ? r + r : r, 16);
            g = parseInt(isShort ? g + g : g, 16);
            b = parseInt(isShort ? b + b : b, 16);
    
            [colorPickerHue, colorPickerSaturation, colorPickerLightness] = rgbToHsl(r, g, b);
    
            UpdateColorPicker();
        }else{
            UpdateColorPickerInputs();
        }
    }
}

function ColorPickerRGBInput($input, isInputEvent){
    let cleaned = $input.value.replace(/[^\d]/g, ''),
        parsed = parseInt(cleaned),
        valid = !isNaN(parsed) && parsed >= 0 && parsed <= 255;

    if(isInputEvent){
        $input.value = cleaned;
        $input.classList.toggle('incorrect', !valid);
    }else{
        $input.classList.remove('incorrect');

        if(valid){
            let r = parseInt($colorPickerRedInput.value),
                g = parseInt($colorPickerGreenInput.value),
                b = parseInt($colorPickerBlueInput.value);
    
            [colorPickerHue, colorPickerSaturation, colorPickerLightness] = rgbToHsl(r, g, b);
    
            UpdateColorPicker();
        }else{
            UpdateColorPickerInputs();
        }
    }
}

function ColorPickerClose(){
    // Stop updating temporary color
    clearInterval(temporaryColorUpdaterInterval);

    // Hide color picker
    $body.classList.remove('show-color-picker');
}

function UpdateTemporaryColor(temporaryColor){
    for(let id of activeTabIds){
        chrome.tabs.sendMessage(id, {
            instruction: 'temporary-settings',
            temporaryColor
        });
    }
}

// #endregion


// #region Functions

function UpdateUI(){
    UpdateOnOffToggleUI();

    let sliderDayFill = `linear-gradient(to right, hsl(216, 100%, 85%), hsl(216, 100%, ${Math.round(65 + (1 - shadeDay / GetMaxShade()) * 20)}%))`,
        sliderNightFill = `linear-gradient(to right, hsl(38, 100%, 85%), hsl(38, 100%, ${Math.round(55 + (1 - shadeNight / GetMaxShade()) * 30)}%))`,
        sliderSleepFill = `linear-gradient(to right, hsl(12, 100%, 80%), hsl(12, 100%, ${Math.round(60 + (1 - shadeSleep / GetMaxShade()) * 20)}%))`;

    // Update Temperature page single slider
    let singleSliderShade = (singleSliderEditing == 'day' ? shadeDay : (singleSliderEditing == 'night' ? shadeNight : shadeSleep)) / GetMaxShade();
    $temperatureSingleSliderInput.value = singleSliderShade * singleSliderMax;
    $temperatureSingleSliderFill.style.width = `calc((100% - 10px) * ${singleSliderShade.toFixed(4)} + 5px)`;
    $temperatureSingleSliderFill.style.background = singleSliderEditing == 'day' ? sliderDayFill : (singleSliderEditing == 'night' ? sliderNightFill : sliderSleepFill);

    // Update Temperature page sliders
    $shadeDaySliderInput.value = shadeDay / GetMaxShade() * shadeSliderMax;
    $shadeDaySliderFill.style.width = `calc((100% - 10px) * ${(shadeDay / GetMaxShade()).toFixed(4)} + 5px)`;
    $shadeDaySliderFill.style.background = sliderDayFill;

    $shadeNightSliderInput.value = shadeNight / GetMaxShade() * shadeSliderMax;
    $shadeNightSliderFill.style.width = `calc((100% - 10px) * ${(shadeNight / GetMaxShade()).toFixed(4)} + 5px)`;
    $shadeNightSliderFill.style.background = sliderNightFill;

    $shadeSleepSliderInput.value = shadeSleep / GetMaxShade() * shadeSliderMax;
    $shadeSleepSliderFill.style.width = `calc((100% - 10px) * ${(shadeSleep / GetMaxShade()).toFixed(4)} + 5px)`;
    $shadeSleepSliderFill.style.background = sliderSleepFill;

    // Display wake time. Also add 10 seconds and round down time so minute never gets rounded down due to impreciseness
    let wakeupDate = new Date(new Date(2000, 0, 1, 0, 0, 0).valueOf() + settings.wakeupTime * 86400000 + 10000);
    $temperatureWakeupTime.value = ToLocalTimeString(wakeupDate);

    // Update color page
    $darknessSliderLabel.textContent = settings.darkness == 0 ? 'None' : ToLocalFixed(settings.darkness * 100, 0) + '%';
    $darknessSliderInput.value = settings.darkness / MAXDARKNESS * darknessSliderMax;
    $darknessSliderFill.style.width = `calc((100% - 10px) * ${(settings.darkness / MAXDARKNESS).toFixed(4)} + 5px)`;
    $darknessSliderFill.style.background = `linear-gradient(to right, hsl(27, 10%, 76%), hsl(27, 10%, ${Math.round(30 + (1 - settings.darkness / MAXDARKNESS) * (90 - 30) / 2)}%))`;

    // Update location page
    if(settings.hasLocation){
        $locationLatInput.value = ToLocalFixed(Math.abs(settings.latitude), 1) + (settings.latitude < 0 ? '\u00B0 S' : '\u00B0 N');
        $locationLonInput.value = ToLocalFixed(Math.abs(settings.longitude), 1) + (settings.longitude < 0 ? '\u00B0 W' : '\u00B0 E');
        $locationName.textContent = settings.locationName;
    
        $locationMapPointer.style.display = 'initial';
        $locationMapPointer.style.left = ((180 + settings.longitude) / 360 * GEOMAPWIDTH).toFixed(1) + 'px';
        $locationMapPointer.style.top = ((90 - settings.latitude) / 180 * GEOMAPHEIGHT - 16).toFixed(1) + 'px';
    }else{
        $locationLatInput.value = '?';
        $locationLonInput.value = '?';
        $locationName.textContent = 'Could not determine location';
        $locationMapPointer.style.display = 'none';
    }

    // Update setting page
    $settingTransitionSpeed.value = settings.transitionSpeed;
    $settingColorBlending.value = settings.colorBlending;
    $settingShadedScrollbar.checked = !!settings.shadedScrollbar;
    $settingShadeFullscreen.checked = !!settings.shadeFullscreen;
    $settingWiderBlendingRange.checked = !!settings.widerBlendingRange;
    $settingDisableDeveloperWarning.checked = !!settings.disableDeveloperWarning;
}

function UpdateOnOffToggleUI(){
    if(disabledByUrlMatch){
        $onOffToggle.classList.remove('enabled');
        $onOffToggleText.classList.remove('small-text');
        $onOffToggleText.textContent = 'Disabled';
    }else{
        let isBool = typeof settings.enabled == 'boolean';

        if(isBool ? settings.enabled : settings.enabled < Date.now()){
            $onOffToggle.classList.add('enabled');
            $onOffToggleText.classList.remove('small-text');
            $onOffToggleText.textContent = 'Enabled';
        }else{
            $onOffToggle.classList.remove('enabled');
            if(isBool){
                $onOffToggleText.classList.remove('small-text');
                $onOffToggleText.textContent = 'Disabled';
            }else{
                $onOffToggleText.classList.add('small-text');
                let t = (settings.enabled - Date.now()) / 1000;
                if(t <= 60)
                    $onOffToggleText.textContent = `Disabled for\n${Math.ceil(t)} seconds`;
                else if(t <= 5400)
                    $onOffToggleText.textContent = `Disabled for\n${Math.ceil(t / 60)} minutes`;
                else
                    $onOffToggleText.textContent = `Disabled for\n${Math.round(t / 3600)} hours`;
            }
        }
    }
}

function CheckUrlMatchDisabled(){
    if(selectedTabUrl)
        disabledByUrlMatch = settings.disabledSites.some(PatternMatcher);
}

function PatternMatcher(pattern){
    return new RegExp(
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
    ).test(selectedTabUrl);
}

function ChangeSettings(changes){
    let changed = Object.entries(changes).some(([key, value]) => key in settings && settings[key] != value);
    
    if(changed){
        Object.assign(settings, changes);

        // Some settings trigger the shade to re-enable
        if(!('enabled' in changes) && ['darkness', 'color', 'shadeDay', 'shadeNight', 'shadeSleep'].some(s => s in changes)){
            disabledByUrlMatch = false;
            settings.disabledSites = settings.disabledSites.filter(s => !PatternMatcher(s)),
            settings.enabled = true;
        }

        ApplySettingsChanges();
        UpdateUI();
    }
}

function ChangeSaved(changes){
    let changed = Object.entries(changes).some(([key, value]) => key in saved && saved[key] != value);
    
    if(changed){
        Object.assign(saved, changes);
        chrome.storage.local.set({saved});
    }
}

function ApplySettingsChanges(){
    justUpdatedStorage = true;
    chrome.storage.local.set({settings});
}

function ClickPageButton(input, firstLoad){
    let $clicked, pageName;

    // Accept page name or button id as input
    if(typeof input == 'string'){
        pageName = input.toLowerCase();
        $clicked = Array.from($pageButtons).find($el => $el.getAttribute('name') == pageName);
    }else{
        $clicked = input || $pageButtons[0];
        pageName = $clicked.getAttribute('name')
    }

    // Always remove hints when user clicked on page button because a confused user might click on the same tab and it should be expected to go away
    if(!firstLoad)
        RemoveHints();

    // Hide temperature sliders 
    $body.classList.remove('show-temperature-sliders');

    ClearSelection();

    // If this button wasn't already selected
    if(!$clicked.classList.contains('selected')){
        // Add selected class to only this button
        for(let $button of $pageButtons)
            $button.classList.toggle('selected', $button == $clicked);

        // Add selected class to page
        for(let $page of $pages)
            $page.classList.toggle('selected', $page.getAttribute('name') == pageName);

        // Cancel preview shade if it is hapenning
        CancelPreviewShade();

        // Show hint if it hasn't been shown already
        if(pageName == 'location' && !saved.showedLocationHint){
            showedMapHint = true;
            $body.classList.add('show-location-hint');
        }
        
        // Move page underliner so it underlines this clicked button
        let rect = $clicked.getBoundingClientRect();
        $pageUnderliner.style.left = 5 + rect.left;
        $pageUnderliner.style.width = rect.width - 10;
    }
}

function RemoveHints(){
    $body.classList.remove('show-temperature-hint', 'show-location-hint', 'show-color-hint', 'show-color-picker', 'show-new-tab-hint');

    // Stop showing hint when user navigates out of it
    if(showedNewTabHint){
        showedNewTabHint = false;
        ChangeSaved({warnedUserAboutNewTab: true});
    }

    // Stop showing hint when user navigates out of it
    if(showedMapHint){
        showedMapHint = false;
        ChangeSaved({showedLocationHint: true});
    }
}

// Get width of text in input
function GetInputTextWidth($input){
    let compIn = window.getComputedStyle($input),
        $el = document.createElement('div');
    $el.style.whiteSpace = 'pre';
    $el.style.visibility = 'hidden';
    $el.style.width = 'fit-content';
    $el.style.maxWidth = (window.innerWidth - 1) + 'px'; // Because otherwise it would make the extension window bigger

    $el.style.font = compIn.font;
    $el.textContent = $input.value;

    $body.appendChild($el);
    let width = Math.min($el.offsetWidth, parseInt(compIn.width) - parseInt(compIn.paddingLeft) - parseInt(compIn.paddingRight));
    $body.removeChild($el);
    return width;
}

// Returns an array of bigrams from a string. ex: bigrams('Hello') -> ['He', 'el', 'll', 'lo']
function bigrams(string) {
    let s = ' ' + string.toLowerCase() + ' ',
        len = s.length - 1,
        v = new Array(len);
    for (let i = 0; i < len; i++)
        v[i] = s.slice(i, i + 2);
    return v;
}

// Returns a percentage that is the ratio of bigram pairs shared between pair1 and pair2
// Modified from https://stackoverflow.com/questions/23305000/javascript-fuzzy-search-that-makes-sense#answer-23305385
function similarity(pairs1, pairs2) { 
    let count = 0;
    for (let x of pairs1)
        for (let y of pairs2)
            if (x === y)
                count++;
    return 2 * count / (pairs1.length + pairs2.length);
}

// Returns a percentage that is the ratio of pairs from pair2 in pair1.
// Hence contains(bigrams('New York, United states'), bigrams('United states')) = 1 where with similarity it would be 0.842
function contains(pairs1, pairs2) { 
    let count = 0;
    for (let x of pairs1)
        for (let y of pairs2)
            if (x === y)
                count++;
    return Math.min(1, count / pairs2.length);
}

// Like n.toFixed(d) but adds a comma or period depending on locale
function ToLocalFixed(n, d){
    return (n || 0).toLocaleString(undefined, {minimumFractionDigits: d == undefined ? 0 : d, maximumFractionDigits: d == undefined ? 4 : d});
}

// Returns local hour:minute time depending on locale
function ToLocalTimeString(date){
    date.setSeconds(0, 0);
    return date.toLocaleTimeString(undefined, {hour: '2-digit', minute:'2-digit'});
}

function hslToRgb(h, s, l) {
    h = (h / 360) % 1;
    if (s == 0) { // Achromatic
        let a = Math.round(l * 255);
        return [a, a, a];
    } else {
        let q = l < 0.5 ? l * (1 + s) : l + s - l * s,
            p = 2 * l - q;

        return [
            Math.round(hue2rgb(p, q, h + 1/3) * 255),
            Math.round(hue2rgb(p, q, h) * 255),
            Math.round(hue2rgb(p, q, h - 1/3) * 255)
        ];
    }
}

function hue2rgb(p, q, t) {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
}

function rgbToHsl(r, g, b) {
    r = Math.max(0, Math.min(1, r / 255));
    g = Math.max(0, Math.min(1, g / 255));
    b = Math.max(0, Math.min(1, b / 255));
 
    let maxColor = Math.max(r,g,b),
        minColor = Math.min(r,g,b),
        l = (maxColor + minColor) / 2,
        s = 0,
        h = 0;

    if(maxColor != minColor){
        if(l < 0.5)
            s = (maxColor - minColor) / (maxColor + minColor);
        else
            s = (maxColor - minColor) / (2.0 - maxColor - minColor);

        if(r == maxColor)
            h = (g-b) / (maxColor - minColor);
        else if(g == maxColor)
            h = 2.0 + (b - r) / (maxColor - minColor);
        else
            h = 4.0 + (r - g) / (maxColor - minColor);
    }
 
    h = h * 60;
    if(h < 0)
        h += 360;
    
    return [Math.round(h * 10) / 10, Math.round(s * 1000) / 1000, Math.round(l * 1000) / 1000];
}

function rgbToHex(r, g, b){
    return '#' + ((r < 16 ? '0' : '') + r.toString(16) + (g < 16 ? '0' : '') + g.toString(16) + (b < 16 ? '0' : '') + b.toString(16)).toUpperCase();
}

// Lerp between 2 rgb colors
function ColorLerp([r1, g1, b1], [r2, g2, b2], lerp){
    let l = Math.max(0, Math.min(1, lerp)),
        i = 1 - lerp;
    return [Math.round(r1 * i + r2 * l), Math.round(g1 * i + g2 * l), Math.round(b1 * i + b2 * l)];
}

// Clear user selection
function ClearSelection(){
    if (window.getSelection)
        window.getSelection().removeAllRanges();
    else if (document.selection)
        document.selection.empty();
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