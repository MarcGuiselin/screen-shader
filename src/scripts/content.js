// ============================
// Screen Shader
// Copyright 2019 Marc Guiselin
// ============================

// This content script runs in the context of every page including iframes.
// That is done because Screen Shader injects a transparent overlay over every page that uses css mix-blend-mode to alter the coloration of the page.
// If any element goes into full screen (including elements in iframes), Screen Shader will move that transparent overlay into the full screened element so it is shaded
// You'd think that would be pretty simple, however there are many bugs and other issues with this overlay.

if(
    !(document.doctype == null && document.documentElement.nodeName != 'HTML')// Don't run on non-html display pages, especially xml document displays
    && window.innerWidth > 2 && window.innerHeight > 2 // Don't run in pixel iframes or similar
    // eslint-disable-next-line block-scoped-var
    && !$html // Only run if this content script wasn't already run before
){
    var $html = document.documentElement;

    const INIFRAME = (function(){
                try {
                    return window.self !== window.top;
                } catch (e) {
                    return true;
                }
          })(),
          UPDATESHADETIME = 800,
          TEMPORARYSETTINGSTIME = 800,
          NEUTRALSTYLES = {display: 'block', transition: 'none', margin: '0px', padding: '0px', borderRadius: '0px', border: 'none', outline: 'none', visibility: 'visible', maxHeight: 'none', maxWidth: 'none', minHeight: 'none', minWidth: 'none', clip: 'unset', overflowX: 'visible', overflowY: 'visible', opacity: 1},
          FILLSCREENSTYLES = {position: 'fixed', top: '-10%', right: '-10%', bottom: '-10%',left: '-10%', width: 'auto', height: 'auto'},
          COLORALGORITHMS = {
            normal: (a, b, o) => Math.round((a * (1 - o) + b * o) * (1 - settings.darkness)),
            multiply: (a, b, o) => Math.round((a * (1 - o) + (a * b / 255) * o) * (1 - settings.darkness)),
            darken: (a, b, o) => Math.round((b >= a ? a : a * (1 - o) + b * o) * (1 - settings.darkness)),
            difference: (a, b, o) => Math.round(Math.abs(a - b * o) * (1 - settings.darkness))
          },
          LENGTHSLEEP = 9.18/24,
          TRANSITIONSPEEDS = [0, .04/24, .3/24, 1/24, 1.6/24];

    let $screenshader = document.createElement('screen-shader'),
        $darkdim = document.createElement('div'),
        $mainshader = document.createElement('div'),
        $style = document.createElement('style'),
        $scrollbarstyle = document.createElement('style'),

        settings,
        updateShadeInterval,
        pageloaded = false,
        lastScrollbarSettings = '',
        mouseOverScrollbar = false,
        shadeElementInDom = false,
        justUpdatedSettings = false,
        scrollbarsVisible = false,

        oldPageUrl = '',
        disabledByUrlMatch = false,

        extensionDisabled = false,

        now = Date.now() - 20,
        whenJulian = 0,
        whenSunset,
        whenSunrise,
        whenPolarNight,

        timeExpireTemporarySettings = 0,
        temporaryShade,
        temporaryColor,

        domContentLoaded = false,
        needToRunScrollbarOverride = true,

        scrollArrowDrawCanvas;

    // #region Create shader element
    StyleSet($screenshader, NEUTRALSTYLES);
    StyleSet($darkdim,      NEUTRALSTYLES, FILLSCREENSTYLES, {zIndex: 2147483646, background: 'black', opacity: 0}); // Removed: transition: 'opacity 0.05s',
    StyleSet($mainshader,   NEUTRALSTYLES, FILLSCREENSTYLES, {zIndex: 2147483645, background: '#111'}); // Removed: transition: 'background 0.05s',

    $style.innerHTML = 'screen-shader{pointer-events: none !important;}'; // html>body{z-index: 0 !important;position: relative !important;}html,body{height: 100%}

    $screenshader.appendChild(document.createComment('This is an element that contains all the html for the screen shader extension to work'));
    $screenshader.appendChild($darkdim);
    $screenshader.appendChild($mainshader);
    $screenshader.appendChild($style);
    $screenshader.appendChild($scrollbarstyle);

    if(!INIFRAME){ // Don't actually place element anywhere cause we are in an inframe
        shadeElementInDom = true;
        $html.appendChild($screenshader);
    }
    // #endregion

    // #region Event listeneners
    document.addEventListener('visibilitychange', OnVisibilityChange);

    document.addEventListener('fullscreenchange', OnWebkitFullscreenChange, false);
    document.addEventListener('webkitfullscreenchange', OnWebkitFullscreenChange, false);
    document.addEventListener('mozfullscreenchange', OnWebkitFullscreenChange, false);

    if(!INIFRAME){
        // If scrollbars suddenly become visible, shade them immediately
        window.addEventListener('resize', e => {
            if(e.isTrusted && settings && settings.shadedScrollbar && !mouseOverScrollbar && scrollbarsVisible != (window.innerWidth != $html.clientWidth || window.innerHeight != $html.clientHeight))
                window.requestAnimationFrame(UpdateShade);
        });

        // Keep track that the mouse is over the scrollbars
        $html.addEventListener('mousemove', e => {
            if(e.isTrusted){
                mouseOverScrollbar = e.clientX > $html.clientWidth || e.clientY > $html.clientHeight;
                if(mouseOverScrollbar)
                    lastScrollbarSettings = '';// Reset 
            }
        });

        $html.addEventListener('mouseleave', () => mouseOverScrollbar = false);
    }

    // #endregion

    // #region Bug fixers
    if(!INIFRAME){
        // #region Bug #1 and 2 - Page flashes white before it loads - Background issues on a multitude of websites
        
        // Get original html background. Most sites don't have one, so set it to white in that case
        let htmlBackgroundColor = GetStyle($html, 'background-color').replace(/\s/g, '');
        if(['', 'transparent', 'rgba(0,0,0,0)', '#00000000', 'hsla(0,0%,0%,0)', 'inherit', 'initial', 'unset', 'none'].includes(htmlBackgroundColor))
            htmlBackgroundColor = 'white';

        // Set html background to a dark color to avoid white flash
        StyleSet($html, {backgroundColor: '#111', transition: '.15s background-color'}); // #D3D3D3

        // Checks and runs code only when the body exists and the content script received the settings and the screen shader element is populated
        function BodyExistsChecker(){
            if(document.body && settings){
                // Remove our forceful colororation of the html
                if($html.hasAttribute('style'))
                    $html.setAttribute('style', $html.getAttribute('style').replace(/\s*background-color:\s*#111\s*;?\s*/i, ''));

                // Set the html back to its starting color
                StyleSet($html, {backgroundColor: htmlBackgroundColor});

                // Creates a fake html and body element placed in screen shader
                let $htmlbackground = document.createElement('html'),
                    $bodybackground = document.createElement('div');
                StyleSet($htmlbackground, NEUTRALSTYLES, FILLSCREENSTYLES, {zIndex: -2147483647});
                StyleSet($bodybackground, NEUTRALSTYLES, FILLSCREENSTYLES, {zIndex: -2147483646}, {background: GetStyle(document.body, 'background')});
                $screenshader.appendChild($htmlbackground);
                $screenshader.appendChild($bodybackground);

                // Observe for potential change in style of body background and apply to fake
                let recentlyUpdatedBodyBackground = false;
                new MutationObserver(() => {
                    if(!recentlyUpdatedBodyBackground){
                        recentlyUpdatedBodyBackground = true;
                        StyleSet($bodybackground, {background: GetStyle(document.body, 'background')});
                        setTimeout(() => {
                            StyleSet($bodybackground, {background: GetStyle(document.body, 'background')});
                            recentlyUpdatedBodyBackground = false;
                        }, 400);
                    }
                })
                .observe(document.body, {attributes: true});

                // Set screen shader as last element in html immediately
                if(!GetFullscreenElement())
                    $html.appendChild($screenshader);
            }else{
                window.requestAnimationFrame(BodyExistsChecker);
            }
        }
        BodyExistsChecker();
        // #endregion

        // #region Bug #3 - Add video element to page to fix flashing background problem on https://www.nexusmods.com/  Not sure why but it works

        // Keeping a video element in the page seems to prevent background not correctly being blended on sites like https://www.nexusmods.com/
        if(location.hostname == 'www.nexusmods.com'){// TODO: test if nexusmods really is the only website with this problem
            let $vid = document.createElement('video');
            StyleSet($vid, {position: 'fixed', background: 'red', top: 0, left: 0, opacity: 0, zIndex: 1000000});
            $screenshader.appendChild(document.createComment('The video element forces chrome to render the body color correctly'));
            $screenshader.appendChild($vid);
        }

        // #endregion

        // #region Bug #4 - Fix high z-index elements showing over Screen Shader. Since applying position relative to the body breaks a couple websites, Screen Shader only applies this fix when its needed
        
        let appliedfix = false,
            observer;
        function CheckElementZIndex($el){
            // Element is visible
            if($el.offsetWidth || $el.offsetHeight || $el.getClientRects().length)
                if(parseInt(GetStyle($el, 'z-index')) >= 2147483646)
                    ApplyZIndexFix();
        }
        function StartObservingZIndex(){
            // Check every element in page
            for(let $el of document.body.querySelectorAll('DIV, IFRAME'))
                CheckElementZIndex($el);

            if(!appliedfix){
                // Whenever new elements are added to the dom, make sure they all have a z-index below Screen Shader
                observer = new MutationObserver(mutations => {
                    for(let mutation of mutations){
                        // Node added
                        if(mutation.type == 'childList'){
                            for(let $el of mutation.addedNodes){
                                if($el.nodeName == 'DIV'){
                                    CheckElementZIndex($el);

                                    // Children of added nodes must also be checked
                                    let children = $el.querySelectorAll('DIV, IFRAME');
                                    if(children.length < 100)
                                        for(let $child of children)
                                            CheckElementZIndex($child);
                                }else if($el.nodeName == 'IFRAME'){
                                    CheckElementZIndex($el);
                                }
                            }
                        }
                        // Attribute changed
                        else if(mutation.type == 'attributes' && mutation.target !== $screenshader ){
                            if(mutation.target.nodeType == 1 && (mutation.target.nodeName == 'DIV' || mutation.target.nodeName == 'IFRAME'))
                                CheckElementZIndex(mutation.target);
                        }
                    }
                });
                observer.observe(document.body, {childList: true, subtree: true, attributes: true}); // , attributeFilter: ['class', 'style']
            }
        }
        function ApplyZIndexFix(){
            if(!appliedfix){
                if(observer)
                    observer.disconnect();
                $style.innerHTML += 'html > body{z-index: 0 !important;position: relative !important;}';
                
                // Fix mightytext.net/web8/ and w3schools.com/html/tryit.asp?filename=tryhtml_default and potentially other fullpage applications
                if(document.body.offsetHeight < 200)
                    $style.innerHTML += 'html, body{height: 100%;}';

                appliedfix = true;
            }
        }

        // Run observer only when body exists
        if(document.body)
            StartObservingZIndex();
        else
            window.addEventListener('DOMContentLoaded', StartObservingZIndex);

        // #endregion
    }
    // #endregion


    chrome.storage.local.get(['settings'], res => {
        settings = res.settings;

        // Since content script might run after page load event happens
        if(document.readyState === 'complete' || document.readyState === 'loaded'){
            setTimeout(OnLoad, 200);
        }else{
            window.addEventListener('load', OnLoad);
            setTimeout(OnLoad, 1000);
        }

        OnVisibilityChange();

        if(!settings.disableDeveloperWarning)
            console.log('%c' +
                '  Developers, remember to disable the Screen Shader chrome extension and reload the page when developing.  \n' +
                '  Screen Shader updates the dom often and might cause lag in the devtools!                                 \n' +
                '  You can disable this warning in Screen Shader\'s settings.                                                ',
                'background: rgb(177, 149, 45);color: white;font-size:16px;'
            );
    });

    chrome.storage.onChanged.addListener(changes => { 
        if(changes.settings){
            if(justUpdatedSettings){
                justUpdatedSettings = false;
            }else{
                let newSettings = changes.settings.newValue;

                // If location changed get the sunset and sunrise times again
                if(whenJulian && (settings.latitude != newSettings.latitude || settings.longitude != newSettings.longitude || settings.hasLocation != newSettings.hasLocation))
                    whenJulian = 0;

                settings = newSettings;

                // Check if url is disabled
                CheckUrlMatchDisabled();

                // If screen shader or shaded scrollbar was disabled 
                if(!settings.shadedScrollbar || !(typeof settings.enabled == 'boolean' ? settings.enabled : settings.enabled < now))
                    $html.classList.remove('ss-shaded-scrollbars');

                // Update shade as soon as possible
                if(!document.hidden)
                    window.requestAnimationFrame(UpdateShade);
            }
        }
    });

    chrome.runtime.onMessage.addListener(msg => {
        if(!document.hidden && msg.instruction == 'temporary-settings'){
            temporaryShade = msg.temporaryShade;
            temporaryColor = msg.temporaryColor;
            timeExpireTemporarySettings = Date.now() + TEMPORARYSETTINGSTIME;
            window.requestAnimationFrame(UpdateShade);
        }
    });

    document.addEventListener('DOMContentLoaded', () => {
        domContentLoaded = true;
        CustomScrollbarOverride();
    });


    // #region Functions
    function UpdateShade(){
        // Prevent Shade from updating too often
        let n = Date.now();
        if(now > n - 20)
            return;
        now = n;

        // Only update the shade if the page is visible, or if the shade element wasn't appended to the page when it should have been
        if(settings && (!document.hidden || (!INIFRAME && !shadeElementInDom)) && !extensionDisabled){
            let $fs = GetFullscreenElement();

            // Detect url changes
            let newPageUrl = location.href.toLowerCase();
            if(oldPageUrl != newPageUrl){
                oldPageUrl = newPageUrl;
                CheckUrlMatchDisabled();
            }

            // If there is a fullscreened element and screen shader element isn't in it, then put it in it
            if ($fs && $fs.appendChild && $fs.lastChild != $screenshader){
                shadeElementInDom = true;
                $fs.appendChild($screenshader);
                $html.classList.remove('ss-shaded-scrollbars');
            }

            // If there is no fullscreened element
            if (!$fs){ 
                // If we are in an iframe but screenshader is in the dom, remove it
                if (INIFRAME && $screenshader.parentElement) { 
                    shadeElementInDom = false;
                    $screenshader.parentElement.removeChild($screenshader);
                }
                
                // If we arn't in iframe but screenshader is not in the dom, put it back
                if (!INIFRAME && $html.lastChild != $screenshader) {
                    shadeElementInDom = true;
                    $html.appendChild($screenshader);
                }
            }

            // Only actually update appearance of shade when the shade element is in the page
            if(shadeElementInDom){
                // Determine if Screen Shader is enabled
                let enabledIsBool = typeof settings.enabled == 'boolean',
                    enabled = disabledByUrlMatch ? false : (enabledIsBool ? settings.enabled : settings.enabled < now);

                // Enable the shade as soon as the timer runs out
                if(!disabledByUrlMatch && !enabledIsBool && !enabled && settings.enabled - now < UPDATESHADETIME)
                    setTimeout(() => window.requestAnimationFrame(UpdateShade), settings.enabled - now);

                // Disable the temporary shade as soon as the timer runs out
                let useTempSettings = timeExpireTemporarySettings > now;
                if(useTempSettings && timeExpireTemporarySettings - now < UPDATESHADETIME)
                    setTimeout(() => window.requestAnimationFrame(UpdateShade), timeExpireTemporarySettings - now);

                let opacity = useTempSettings && temporaryShade != undefined ? temporaryShade : ScreenShaderShadeAlgorithm(),
                    color = useTempSettings && temporaryColor || settings.color,
                    newRGBAColor = `rgba(${color.join(', ')}, ${opacity.toFixed(3)})`;
                
                // Update styles
                StyleSet($mainshader, {opacity: enabled ? 1 : 0, background: newRGBAColor, mixBlendMode: settings.colorBlending});
                StyleSet($darkdim, {opacity: enabled ? settings.darkness : 0});

                // Shaded scrollbars are only for non-iframes
                if(!INIFRAME && settings.shadedScrollbar && !$fs && enabled){
                    scrollbarsVisible = (window.innerWidth != $html.clientWidth || window.innerHeight != $html.clientHeight);
                    if(scrollbarsVisible){
                        // Only update scrollbars if the color changed and the mouse isn't above them and there even are scrollbars
                        let newScrollbarSettings = newRGBAColor + settings.colorBlending + settings.darkness;
                        if(newScrollbarSettings != lastScrollbarSettings && !mouseOverScrollbar){
                            lastScrollbarSettings = newScrollbarSettings;

                            if(opacity == 0 && settings.darkness == 0){
                                $scrollbarstyle.innerHTML = '';
                            }else{
                                if(!scrollArrowDrawCanvas)
                                    scrollArrowDrawCanvas = document.createElement('canvas');

                                let algorithm = COLORALGORITHMS[settings.colorBlending] || COLORALGORITHMS.normal,
                                    solveColor = (r, g, b) => 'rgb(' + [algorithm(r, settings.color[0], opacity), algorithm(g, settings.color[1], opacity), algorithm(b, settings.color[2], opacity)].join(', ') + ')',
                                    color1 = solveColor(241, 241, 241),
                                    color2 = solveColor(210, 210, 210),
                                    color3 = solveColor(193, 193, 193),
                                    color4 = solveColor(168, 168, 168),
                                    color5 = solveColor(120, 120, 120),
                                    ctx = scrollArrowDrawCanvas.getContext('2d'),
                                    scrollbarButtonVerticalUpURL, scrollbarButtonVerticalDownURL, scrollbarButtonHorizontalUpURL, scrollbarButtonHorizontalDownURL;

                                // Setup canvas to draw vertical arrows on scrollbars
                                scrollArrowDrawCanvas.width = 7;
                                scrollArrowDrawCanvas.height = 4;
                                ctx.fillStyle = color4;

                                // Clear canvas, draw triangle and grab URL
                                ctx.clearRect(0, 0, 7, 4);
                                ctx.beginPath();
                                ctx.moveTo(0, 4);
                                ctx.lineTo(3.5, 0);
                                ctx.lineTo(7, 4);
                                ctx.closePath();
                                ctx.fill();
                                scrollbarButtonVerticalUpURL = scrollArrowDrawCanvas.toDataURL();

                                // Clear canvas, draw triangle and grab URL
                                ctx.clearRect(0, 0, 7, 4);
                                ctx.beginPath();
                                ctx.moveTo(0, 0);
                                ctx.lineTo(3.5, 4);
                                ctx.lineTo(7, 0);
                                ctx.closePath();
                                ctx.fill();
                                scrollbarButtonVerticalDownURL = scrollArrowDrawCanvas.toDataURL();

                                // Setup canvas to draw horizontal arrows on scrollbars
                                scrollArrowDrawCanvas.width = 4;
                                scrollArrowDrawCanvas.height = 7;
                                ctx.fillStyle = color4;

                                // Clear canvas, draw triangle and grab URL
                                ctx.clearRect(0, 0, 4, 7);
                                ctx.beginPath();
                                ctx.moveTo(4, 0);
                                ctx.lineTo(0, 3.5);
                                ctx.lineTo(4, 7);
                                ctx.closePath();
                                ctx.fill();
                                scrollbarButtonHorizontalUpURL = scrollArrowDrawCanvas.toDataURL();

                                // Clear canvas, draw triangle and grab URL
                                ctx.clearRect(0, 0, 4, 7);
                                ctx.beginPath();
                                ctx.moveTo(0, 0);
                                ctx.lineTo(4, 3.5);
                                ctx.lineTo(0, 7);
                                ctx.closePath();
                                ctx.fill();
                                scrollbarButtonHorizontalDownURL = scrollArrowDrawCanvas.toDataURL();

                                const targetTag = ':root.ss-shaded-scrollbars';

                                // Set style
                                $scrollbarstyle.innerHTML = `
                                    ${targetTag}::-webkit-scrollbar {
                                        background: ${color1} !important;
                                        width: 17px !important;
                                        height: 17px !important;
                                        -webkit-appearance: unset !important;
                                    }

                                    ${targetTag}::-webkit-scrollbar-track {
                                        background: transparent !important;
                                    }

                                    ${targetTag}::-webkit-scrollbar-corner{
                                        background: ${color2} !important;
                                        box-shadow: none !important;
                                        border-radius: unset !important;
                                    }

                                    ${targetTag}::-webkit-scrollbar-thumb{
                                        background: ${color3} !important;
                                        border: 2px solid ${color1} !important;
                                        box-shadow: none !important;
                                        border-radius: unset !important;
                                    }
                                    ${targetTag}::-webkit-scrollbar-thumb:vertical{
                                        border-bottom-width: 0 !important;
                                        border-top-width: 0 !important;
                                    }
                                    ${targetTag}::-webkit-scrollbar-thumb:horizontal{
                                        border-left-width: 0 !important;
                                        border-right-width: 0 !important;
                                    }
                                    ${targetTag}::-webkit-scrollbar-thumb:hover {
                                        background: ${color4} !important;
                                    }
                                    ${targetTag}::-webkit-scrollbar-thumb:active {
                                        background: ${color5} !important;
                                    }

                                    ${targetTag}::-webkit-scrollbar-button{
                                        background-color: ${color1} !important;
                                        background-repeat: no-repeat !important;
                                        background-position: center !important;
                                        box-shadow: none !important;
                                        border-radius: unset !important;
                                    }
                                    ${targetTag}::-webkit-scrollbar-button:active{
                                        background-color: ${color5} !important; /* also arrow image should be white */
                                    }
                                    ${targetTag}::-webkit-scrollbar-button:hover{
                                        background-color: ${color2} !important;
                                    }


                                    ${targetTag}::-webkit-scrollbar-button:vertical:decrement {
                                        background-image: url(${scrollbarButtonVerticalUpURL}) !important;
                                    }
                                    ${targetTag}::-webkit-scrollbar-button:vertical:increment {
                                        background-image: url(${scrollbarButtonVerticalDownURL}) !important;
                                    }
                                    ${targetTag}::-webkit-scrollbar-button:horizontal:decrement {
                                        background-image: url(${scrollbarButtonHorizontalUpURL}) !important;
                                    }
                                    ${targetTag}::-webkit-scrollbar-button:horizontal:increment {
                                        background-image: url(${scrollbarButtonHorizontalDownURL}) !important;
                                    }
                                `;
                                
                                // Chrome doesn't update the scrollbar colors even when the css changes
                                // Hacky force browser to redraw scrollbar from https://stackoverflow.com/questions/5170779#answer-15603340
                                $html.classList.remove('ss-shaded-scrollbars');
                                $html.offsetHeight;
                            }
                        }
                        
                        
                        $html.classList.add('ss-shaded-scrollbars');

                        CustomScrollbarOverride();
                    }
                }
            }
        }
    }

    // All the magic happens here :)
    // A little overcomplicated? Maybe....
    function ScreenShaderShadeAlgorithm(){
        let newJulian = Math.floor(Date.now() / 86400000 + 2440587.5);
        if(whenJulian != newJulian)
            LoadSunriseSunsetTime(newJulian);

        let _time = GetPercentInDay(now),
        
            _noSunCycle = isNaN(whenSunrise),
            _midnightSun = _noSunCycle && !whenPolarNight,
            _transition = TRANSITIONSPEEDS[settings.transitionSpeed],
    
            _sleepStart = o(settings.wakeupTime - LENGTHSLEEP - _transition / 2), // When the time to sleep starts
            _timeStartingAtSleepStart = o(_time - _sleepStart), // Move time so the time is 0 right before the transition to sleep shade happens
    
            _midDay = _noSunCycle ? NaN : o((whenSunrise + whenSunset) / 2 + (whenSunrise < whenSunset ? 0 : .5)), // Mid Day
            _dayLength = _noSunCycle ? NaN : Math.min(1, Math.max(_transition, o(whenSunset - whenSunrise)) + _transition), // Length of day. Must be long/not too short to accomodate transitions
            _sunset = o(_midDay + _dayLength / 2),
            _sunrise = o(_midDay - _dayLength / 2);
    
        // Is the time between when we first transition to sunset shade and when we transition out of sunset shade
        if(settings.shadeNewAlgo && _timeStartingAtSleepStart < LENGTHSLEEP + _transition / 2){
            if(_timeStartingAtSleepStart < _transition){
                let _sleepStartsDuringDay = o(_sleepStart - _sunrise - _transition) < _dayLength - _transition;
                return ShadeEaseLerp(
                    _sleepStartsDuringDay || _midnightSun ? settings.shadeDay : settings.shadeNight,
                    settings.shadeSleep,
                    _timeStartingAtSleepStart / _transition
                );
            }else if(_timeStartingAtSleepStart < LENGTHSLEEP - _transition / 2){
                return settings.shadeSleep;
            }else{
                let _sleepEndsDuringDay = o(settings.wakeupTime - _sunrise) < _dayLength - _transition;
                return ShadeEaseLerp(
                    settings.shadeSleep,
                    _sleepEndsDuringDay || _midnightSun ? settings.shadeDay : settings.shadeNight,
                    (_timeStartingAtSleepStart - LENGTHSLEEP + _transition / 2) / _transition
                );
            }
        }
    
        // If there is no sun cycle
        else if(_noSunCycle)
            return _midnightSun ? settings.shadeDay : settings.shadeNight;
    
        // If the time is between the start of sunrise transition and end of sunset transition
        else{
            let _timeStartingAtSunrise = o(_time - _sunrise);
            if(_timeStartingAtSunrise < _transition){
                let _sleepStartsRightAfterSunrise = settings.shadeNewAlgo && o(_sleepStart - _sunrise) < _transition,
                    _sleepEndsRightBeforeSunrise = settings.shadeNewAlgo && o(settings.wakeupTime - _sunrise) < _transition;
    
                if(_sleepStartsRightAfterSunrise)
                    // Don't transition to a day shade since whe are transitioning to sleep shade soon anyway
                    return settings.shadeNight;
                else if(_sleepEndsRightBeforeSunrise)
                    // Don't transition to a day shade since we are transition from sleep shade soon anyway
                    return settings.shadeDay;
                else
                    // Night to day
                    return ShadeEaseLerp(
                        settings.shadeNight,
                        settings.shadeDay,
                        _timeStartingAtSunrise / _transition
                    );
            }else if(_timeStartingAtSunrise < _dayLength - _transition){
                // Day
                return settings.shadeDay;
            }else if(_timeStartingAtSunrise < _dayLength){
                let _sleepStartsRightAfterSunset = settings.shadeNewAlgo && o(_sleepStart - _sunset + _transition) < _transition,
                    _sleepEndsRightBeforeSunset = settings.shadeNewAlgo && o(settings.wakeupTime - _sunset + _transition) < _transition;
    
                if(_sleepStartsRightAfterSunset)
                    // Don't transition to a night shade since whe are transitioning to sleep shade soon anyway
                    return settings.shadeDay;
                else if(_sleepEndsRightBeforeSunset)
                    // Don't transition to a night shade since whe are transitioning from sleep shade soon anyway
                    return settings.shadeNight;
                else
                    // Day to night
                    return ShadeEaseLerp(
                        settings.shadeDay,
                        settings.shadeNight,
                        (_timeStartingAtSunrise - _dayLength + _transition) / _transition
                    );
            }else{
                // Night
                return settings.shadeNight;
            }
        }
    }

    function ShadeEaseLerp(from, to, t) {
        let p = t < .5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
        return from * (1 - p) + to * p;
    }

    function o(n){
        return (n + 10) % 1;
    }

    function GetPercentInDay(d) {
        let e = new Date(d);
        return (d - e.setHours(0,0,0,0)) / 86400000;
    }

    function LoadSunriseSunsetTime(JulianDate){
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

    function OnLoad(){
        if(!pageloaded){
            // Page is fully loaded
            pageloaded = true;
            domContentLoaded = true;
            window.requestAnimationFrame(UpdateShade);
        }
    }

    function CustomScrollbarOverride(){
        if(needToRunScrollbarOverride && (domContentLoaded || pageloaded) && scrollbarsVisible){
            needToRunScrollbarOverride = false;

            let old = $html.style.overflow,
                oldX = $html.style.overflowX,
                oldY = $html.style.overflowY;
            $html.style.overflow = 'hidden';
            $html.style.overflowX = 'hidden';
            $html.style.overflowY = 'hidden';
            $html.offsetHeight;
            $html.style.overflow = old;
            $html.style.overflowX = oldX;
            $html.style.overflowY = oldY;
        }
    }

    function StyleSet($el, ...styles){
        if($el){
            for(let style of styles){
                for(let key in style){
                    // + ' !important'
                    $el.style[key] = style[key].toString().trim();// .replace(/[A-Z]/g, t => '-' + t.toLowerCase())
                }
            }
        }
    }

    function OnVisibilityChange(){
        // When page is made visible again update the shade
        UpdateShade();

        // Run an interval that updates the shade when the page is visible
        // This timer will be started by OnWebkitFullscreenChange for iframes
        if(!INIFRAME){
            // Test if the extension was disabled or uninstalled
            try{
                chrome.runtime.sendMessage({});
                extensionDisabled = false;
            }catch(e){
                extensionDisabled = e.message.startsWith('Invocation of form runtime.connect(null, )');
                // Remove shade from page if shade is disabled
                if(extensionDisabled){
                    if($screenshader.parentElement)
                        $screenshader.parentElement.removeChild($screenshader);
                    $html.classList.remove('ss-shaded-scrollbars');
                }
            }

            // Run an interval that updates the shade when the page is visible
            // This timer will be started by OnWebkitFullscreenChange for iframes
            if(document.hidden){
                if(updateShadeInterval){
                    clearInterval(updateShadeInterval);
                    updateShadeInterval = undefined;
                }
            }else{
                if(!updateShadeInterval)
                    updateShadeInterval = setInterval(() => window.requestAnimationFrame(UpdateShade), UPDATESHADETIME);
            }
        }
    }

    function OnWebkitFullscreenChange(){
        window.requestAnimationFrame(UpdateShade);
        
        // Run an interval that updates the shade when this iframe is fullscreen
        if(INIFRAME){
            if(!GetFullscreenElement()){
                if(updateShadeInterval){
                    clearInterval(updateShadeInterval);
                    updateShadeInterval = undefined;
                }
            }else{
                if(!updateShadeInterval)
                    updateShadeInterval = setInterval(() => window.requestAnimationFrame(UpdateShade), UPDATESHADETIME);
            }
        }
    }

    function GetFullscreenElement(){
        return document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement;
    }

    function GetStyle($el, css) {
        return document.defaultView.getComputedStyle($el, null).getPropertyValue(css);
    }

    function CheckUrlMatchDisabled(){
        let url = location.href.substr(location.protocol == 'file:' ? 0 : location.protocol.length + 2).toLowerCase();
        disabledByUrlMatch = settings.disabledSites.some(pattern => 
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
            ).test(url)
        );
    }
    // #endregion
}