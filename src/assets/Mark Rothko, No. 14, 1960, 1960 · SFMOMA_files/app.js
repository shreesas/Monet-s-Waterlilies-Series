

var APP = typeof APP === 'undefined' ? {} : window.APP;
APP.data = typeof APP.data === 'undefined' ? {} : APP.data;
APP.init = typeof APP.init === 'undefined' ? {} : APP.init;
;(function ( $, APP, window, document, undefined ) {
	$(document).ready(function() {
// Accordion.js
window.APP = window.APP || {}
APP.Accordion = {
	toMs : (dur) => {
		if (typeof dur === 'number') return dur
		if (dur === 'fast') return 200
		if (dur === 'slow') return 600
		return 400 // 'normal'
  	},
	setVar : ($el, name, value) => {
    	if ($el && $el[0]) $el[0].style.setProperty(name, value)
  	},
	setTargetHeight : ($panel, opts) => {
		var el = $panel && $panel[0]
		if (!el) return 0
		var options = opts || {}

		// Determine the child's TARGET height:
		// - default: its natural (scroll) height
		// - when closing: use options.target = 0
		var prevDisp, wasDisplayNone = false
		var cs = window.getComputedStyle(el)
		if (cs.display === 'none') {
			wasDisplayNone = true
			prevDisp = el.style.display
			el.style.display = 'block'
		}

		var prevH = el.style.height
		var prevOv = el.style.overflow
		el.style.height = 'auto'
		el.style.overflow = 'visible'

		var natural = el.scrollHeight
		var targetH = (options && typeof options.target === 'number') ? options.target : natural

		// Write child's --h (so its own open state animates to the right size)
		APP.Accordion.setVar($panel, '--h', targetH + 'px')

		// Compute delta between where child is *now* and where it *should* end up
		// (offsetHeight reflects current painted px height — possibly mid-transition or locked)
		var currentChildPx = el.offsetHeight
		var delta = targetH - currentChildPx

		// Restore child's inline styles we temporarily changed
		el.style.height = prevH
		el.style.overflow = prevOv
		if (wasDisplayNone) el.style.display = prevDisp

		// --- Bubble the change up the chain of OPEN ancestors ---
		// Each ancestor's new target = its current natural + cumulative delta from this child.
		var cumulativeDelta = delta
		$panel.parents('.accordionmodule-row-content').each(function () {
			var ancEl = this
			var $anc = $(ancEl)

			var $ancRow = $anc.closest('.accordionmodule-row')
			var isOpen = $ancRow.hasClass('is-open') ||
			$ancRow.find('> .accordionmodule-row-header [aria-expanded="true"]').length > 0
			if (!isOpen) return

			// Lock current pixel height so the change will transition smoothly
			var hadInlineHeight = !!ancEl.style.height
			if (!hadInlineHeight) {
			ancEl.style.height = ancEl.offsetHeight + 'px'
			// force reflow
			// eslint-disable-next-line no-unused-expressions
			ancEl.offsetHeight
			}

			// Measure the ancestor's "natural" height as of *right now*
			var prevH2 = ancEl.style.height
			var prevOv2 = ancEl.style.overflow
			ancEl.style.height = 'auto'
			ancEl.style.overflow = 'visible'
			var parentNatural = ancEl.scrollHeight

			// Apply the child's delta to the ancestor
			var newH = Math.max(0, parentNatural + cumulativeDelta)
			APP.Accordion.setVar($anc, '--h', newH + 'px')

			// Hand control back to CSS (height: var(--h)) so it animates to the new value
			requestAnimationFrame(function () {
			ancEl.style.height = ''
			})

			// Clean up overflow at the end of the height transition
			ancEl.addEventListener('transitionend', function onEnd (e) {
			if (e.target !== ancEl || e.propertyName !== 'height') return
			ancEl.removeEventListener('transitionend', onEnd)
			ancEl.style.overflow = prevOv2 || ''
			}, { once: true })
			// Note: cumulativeDelta is the same for all higher ancestors (they all need the same net change)
		})

		return targetH
		},
	lockCurrentHeight : ($panel) => {
		var el = $panel && $panel[0]
		if (!el) return
		var h = el.offsetHeight
		$panel.css({ height: h + 'px', overflow: 'hidden' })
		// force reflow so next change transitions
		void el.offsetHeight
	},
	AccordionRow : function (button) {
		// elements (row-scoped safe for nesting)
		this.button  = $(button)
		this.header  = this.button.closest('.accordionmodule-row-header')
		this.row     = this.header.parent('.accordionmodule-row')
		this.content = this.row.children('.accordionmodule-row-content').first()
		this.$parents = this.content.parents('.accordionmodule-row-content')
		this.spacer  = this.header.find('> .accordionmodule-row-header-left .accordionmodule-row-header-left-spacer')

		// state
		this.isOpen  = this.button.attr('aria-expanded') === 'true'

		// options
		this.duration = 300
		this.easing   = 'cubic-bezier(.2,.7,.2,1)'

		// cleanup fallback timer
		this.cleanupTimer = null

		// entry
		this._init = function () {
			// clear any legacy inline display so measuring works
			if (this.content[0] && this.content[0].style.display === 'none') {
				this.content[0].style.display = ''
			}

			// set CSS vars for this panel (duration/easing)
			APP.Accordion.setVar(this.content, '--dur', this.duration + 'ms')
			APP.Accordion.setVar(this.content, '--eas', this.easing)

			// normalize initial DOM to aria-expanded
			if (this.isOpen) {
				APP.Accordion.setTargetHeight(this.content)
				this.row.addClass('is-open')
				//this.content.prop('hidden', false).css({ height: 'auto', opacity: 1, filter: 'none' })
				this.content.prop('hidden', false).css({ height: '', opacity: '', filter: '' })

				if (this.spacer.length) this.spacer.show()
			} 
			else {
				this.row.removeClass('is-open')
				this.content.prop('hidden', true).css({ height: '0px', overflow: 'hidden' })
				APP.Accordion.setVar(this.content, '--h', '0px')
				if (this.spacer.length) this.spacer.hide()
			}

			// events
			this.button.on('click', this._buttonClickHandler.bind(this))
			this.header.on('click', this._headerClickHandler.bind(this))

			// update measurement on resize when open
			var self = this
			var resizeTimer
			$(window).on('resize', function () {
				clearTimeout(resizeTimer)
				resizeTimer = setTimeout(function () {
					if (self.isOpen) APP.Accordion.setTargetHeight(self.content)
				}, 100)
			})
		}

		// header click -> delegate to real button
		this._headerClickHandler = function (e) {
			e.stopPropagation()

			var $t = $(e.target)

			// if click originated on the button, let button handler run
			if ($t.closest('.accordionmodule-row-header-status-indicator').length) return

			// don't hijack clicks on native interactive elements
			var isInteractive =
				$t.is('a, button, input, select, textarea, [role="button"], [tabindex]') ||
				$t.closest('a, button, input, select, textarea, [role="button"], [tabindex]').length > 0
			if (isInteractive) return

			// don't toggle during text selection
			var sel = window.getSelection && window.getSelection()
			if (sel && sel.toString().length) return

			// delegate to button for a11y
			this.button.trigger('focus')
			this.button.trigger('click')
		}

		// button click
		this._buttonClickHandler = function (e) {
			e.stopPropagation()
			// ignore clicks on CTAs inside the header
			if ($(e.target).hasClass('accordionmodule-row-content-main-buttons-button') ||
				$(e.target).hasClass('accordionmodule-row-header-left-buttoncontainer-button')) {
				return
			}
			this._toggleOpenClose()
		}

		// toggle
		this._toggleOpenClose = function () {
			if (!this.content.length) return
			if (this.isOpen) { this._close() } else { this._open() }
		}

		// open with class-toggled CSS animation
		this._open = function () {
			var self = this
			var dur = APP.Accordion.toMs(this.duration)

			// clear any pending cleanup
			clearTimeout(this.cleanupTimer)
			this.content.off('.accordion')

			// measure first (writes --h)
			APP.Accordion.setTargetHeight(this.content)

			// a11y + state
			this.content.prop('hidden', false)
			this.content[0].style.height = ''
			this.button.attr('aria-expanded', 'true')

			// remove inline overflow after opening
			this.content.css({ height: '', overflow: '' })
			void this.content[0].offsetHeight

			this.row.addClass('is-open')
			this.isOpen = true
			
			// after height transition completes, let content grow naturally
			this.content.one('transitionend.accordion', function (ev) {
				if (ev.target !== self.content[0] || (ev.originalEvent && ev.originalEvent.propertyName) !== 'height') return
				self.content.css({ height: 'auto', overflow: '' })
			})

			if (this.spacer.length) this.spacer.stop(true, true).fadeIn(dur)
		}

		// close with class-toggled CSS animation
		this._close = function () {
			var self = this
			var dur = APP.Accordion.toMs(this.duration)

			// clear any pending cleanup
			clearTimeout(this.cleanupTimer)
			this.content.off('.accordion')

			// Lock current px height so CSS transitions have a start point
			APP.Accordion.lockCurrentHeight(this.content)
			// Recompute parent --h values with child's target = 0 (closing)
			APP.Accordion.setTargetHeight(this.content, { target: 0 })
			this.row.removeClass('is-open')
			this.button.attr('aria-expanded', 'false')
			APP.Accordion.setVar(this.content, '--h', '0px')
			this.isOpen = false

			// cleanup function
			var cleanup = function() {
				self.content.prop('hidden', true).css({ height: '', overflow: 'hidden' })
				APP.Accordion.setVar(self.content, '--h', '0px')
			}

			// listen for transitionend
			this.content.one('transitionend.accordion', function (ev) {
				if (ev.target !== self.content[0] || (ev.originalEvent && ev.originalEvent.propertyName) !== 'height') return
				cleanup()
			})

			// fallback timeout in case transitionend doesn't fire
			this.cleanupTimer = setTimeout(cleanup, dur + 50)

			if (this.spacer.length) this.spacer.stop(true, true).fadeOut(dur)
		}
	},
}
APP.AccordionHandler = {
    rows: $('.accordionmodule-row-header .accordionmodule-row-header-status-indicator'),
    accordionRows: [],
    _init: function () {
      var self = this
      self.accordionRows = []
      self.rows.each(function (index, el) {
        var a = new APP.Accordion.AccordionRow(el)
        a._init()
        self.accordionRows.push(a)
      })
    }
}

// init on DOM ready
APP.AccordionHandler._init()
// Ensure the APP namespace exists
APP.Animate = {
    elements : {},
    names : {},
    processingOverlayElement : document.querySelector( '.overlay' ),
	_init : function() {

         // Only process cards within containers that have the style class
        var cardContainers = document.querySelectorAll('.style--show-text-on-hover')
        if ( ! cardContainers.length ) return

        // Check if device supports hover (fine pointer like mouse/trackpad)
        var canHover = (
            window.matchMedia &&
            window.matchMedia('(hover:hover) and (pointer:fine)').matches
        )

        cardContainers.forEach(function(container) {
            APP.Animate._processCards(container, canHover)
        })
    },
    animationConstructor : ( element, index ) => {
        console.log( 'this', this )
        console.log('index',  index )
        console.log('element',  element )
        let _element = {}

        _element.element = element
        _element.Wrapper = _element.element.parentNode
        _element.Content = _element.element.querySelector('*')
        _element._animate = false
        _element._nFrames = 60
        _element._collapsed
        _element._index = index
        APP.Animate.elements[index] = _element
        APP.Animate.names[index] = {}
        APP.Animate.names[index]['_sectionExpandAnimationName'] = ''
        APP.Animate.names[index]['_sectionExpandContentsAnimationName'] = ''
        APP.Animate.names[index]['_sectionCollapseAnimationName'] = ''
        APP.Animate.names[index]['_sectionCollapseContentsAnimationName'] = ''

        APP.Animate._calculateStartScaleY( index, element, 100 )
        APP.Animate._createEaseAnimations( index )

    },
    createKeyframeCSS : ( animationType = 'scale', startElement, endElement  ) => {
        // Figure out the size of the element when collapsed.
        let { x, y } = APP.Animate.calculateCollapsedScale( startElement, endElement )
        let animation = {
            name : '',
            animation : ''
        }
        let inverseAnimation = {
            name : '',
            animation : ''
        }
      
        for ( let step = 0; step <= 100; step++ ) {
          // Remap the step value to an eased one.
          let easedStep = APP.Animate._ease( step / 100 )
      
          // Calculate the scale of the element.
          const xScale = x + (1 - x) * easedStep
          const yScale = y + (1 - y) * easedStep
      
          animation.animation += `${step}% {
            transform: ${animationType}(${xScale}, ${yScale})
          }`
      
          // To avoid stretching / skewing, inverse for the contents.
          const invXScale = 1 / xScale
          const invYScale = 1 / yScale
          inverseAnimation.animation += `${step}% {
            transform: ${animationType}(${invXScale}, ${invYScale})
          }`
      
        }
        return `
        @keyframes ${animation.name} {
          ${animation.animation}
        }
        @keyframes ${inverseAnimation.name} {
          ${inverseAnimation.animation}
        }`
    },
    _applyAnimation : ( index, { expand } = opts ) => {
        APP.Animate.elements[index].element.classList.remove('state--expanded')
        APP.Animate.elements[index].element.classList.remove('state--collapsed')
        if ( expand ) {
            APP.Animate.elements[index].element.classList.add('state--expanded')
            return
        }
        APP.Animate.elements[index].element.classList.add('state--collapsed')
    },
    _calculateStartScaleX : ( startElement, endElement ) => {
        const start = startElement.getBoundingClientRect()
        const end = endElement.getBoundingClientRect()
        return {
            x: start.width / end.width,
        }
    },
    _calculateStartScaleY : ( index, endElement, startHeight = 0 ) => {
        const end = endElement.getBoundingClientRect()
        const finished = {
            y: startHeight / end.height
        }
        // create css variable with collapsed height, to apply on the wrapper
        //APP.Animate.elements[index]._sectionWrapper.style.setProperty ( '--title-height', parseInt( end.height ) + 'px' )
        APP.Animate.elements[index]._collapsed = finished
        return finished
    },
    _createEaseAnimations : ( index ) => {
        var sectionEase = document.querySelector( '.element-animations' )
        if ( ! sectionEase ) {
            sectionEase = document.createElement( 'style' )
            sectionEase.classList.add( 'element-animations' )
        }
        var sectionExpandAnimation = []
        var sectionExpandContentsAnimation = []
        var sectionCollapseAnimation = []
        var sectionCollapseContentsAnimation = []

        var percentIncrement = 100 / APP.Animate.elements[index]._nFrames

        for ( var i = 0; i <= APP.Animate.elements[index]._nFrames; i++ ) {
            var step = APP.Animate._ease(i / APP.Animate.elements[index]._nFrames).toFixed(5)
            var percentage = (i * percentIncrement).toFixed(5)
            var startY = APP.Animate.elements[index]._collapsed.y
            var endY = 1

            // Expand animation.
            APP.Animate._append({
                percentage,
                step,
                startY,
                endY,
                outerAnimation: sectionExpandAnimation,
                innerAnimation: sectionExpandContentsAnimation
            })

            // Collapse animation.
            APP.Animate._append({
                percentage,
                step,
                startY: 1,
                endY: APP.Animate.elements[index]._collapsed.y,
                outerAnimation: sectionCollapseAnimation,
                innerAnimation: sectionCollapseContentsAnimation
            })
        }
        
        // Create unique Animation names, useful for multiple section patterns
        APP.Animate._createAnimationsNames( index )
        
        sectionEase.textContent += `
        @keyframes ${APP.Animate.names[index]['_sectionExpandAnimationName']} {
            ${sectionExpandAnimation.join('')}
        }
        @keyframes ${APP.Animate.names[index]['_sectionCollapseAnimationName']} {
            ${sectionCollapseAnimation.join('')}
        }
         @keyframes ${APP.Animate.names[index]['_sectionCollapseContentsAnimationName']} {
            ${sectionCollapseContentsAnimation.join('')}
        }
         @keyframes ${APP.Animate.names[index]['_sectionExpandContentsAnimationName']} {
            ${sectionExpandContentsAnimation.join('')}
        }`

        document.head.appendChild( sectionEase )
        return sectionEase
    },
    _append : ( {
            percentage,
            step,
            startY,
            endY,
            outerAnimation,
            innerAnimation } = opts ) => {

    
        var yScale = (startY + (endY - startY) * step).toFixed(5)

        var invScaleY = (1 / yScale).toFixed(5)

        outerAnimation.push(`
            ${percentage}% {
                transform: scaleY(${yScale})
            }`)

        innerAnimation.push(`
            ${percentage}% {
                transform: scaleY(${invScaleY})
            }`)
    },
    _createAnimationsNames : ( index ) => {
        APP.Animate.names[index]._sectionExpandAnimationName = "sectionExpandAnimation" + index
        APP.Animate.names[index]['_sectionExpandContentsAnimationName'] = "sectionExpandContentsAnimation" + index
        APP.Animate.names[index]['_sectionCollapseAnimationName'] = "sectionCollapseAnimation" + index
        APP.Animate.names[index]['_sectionCollapseContentsAnimationName'] = "sectionCollapseContentsAnimation" + index

        /// Create CSS Var of each animation
        APP.Animate.elements[index].element.style.setProperty('--sectionExpandAnimation', APP.Animate.names[index]['_sectionExpandAnimationName'])
        APP.Animate.elements[index].element.style.setProperty('--sectionCollapseAnimation', APP.Animate.names[index]['_sectionCollapseAnimationName'])
        $( APP.Animate.elements[index].element ).find( '.collapse--wrapper' ).get(0).style.setProperty('--sectionExpandContentsAnimation', APP.Animate.names[index]['_sectionExpandContentsAnimationName'])
        $( APP.Animate.elements[index].element ).find( '.collapse--wrapper' ).get(0).style.setProperty('--sectionCollapseContentsAnimation', APP.Animate.names[index]['_sectionCollapseContentsAnimationName'])
    },
    _clamp :  ( value, min, max ) => {
        return Math.max( min, Math.min( max, value ) )
    },
    _ease : ( v, pow=4 ) => {
        v = APP.Animate._clamp(v, 0, 1)
        return 1 - Math.pow( 1 - v, pow)
    },
    // Ease in out function you can experiment with different easing functions
    easeInOutQuad :  ( time, start, change, duration ) => {
        time /= duration / 2
        if (time < 1) return change / 2 * time * time + start
        time--
        return -change / 2 * (time * (time - 2) - 1) + start
    },
    easeInOutProgress : ( progress ) => {
        return progress < 0.5
        ? 2 * progress * progress
        : -1 + (4 - 2 * progress) * progress
    },
    smoothScrollTo : ( element, target, duration ) => {
        // if element is a jquery object, get the DOM element
        if ( element instanceof jQuery ) {
            element = element.get(0)
        }
        let start = element.scrollLeft,
            change = target - start,
            currentTime = 0,
            increment = 20 // Adjust for smoothness

        const animateScroll = () => {
            currentTime += increment
            element.scrollLeft = APP.Animate.easeInOutQuad( currentTime, start, change, duration )
            if ( currentTime < duration ) {
                window.requestAnimationFrame( animateScroll )
            }
        }
        animateScroll()
    },
    _showProcessingOverlay : ( message = "Searching..." ) => {
        // Update the message if needed
        document.getElementById('processing-message').textContent = message
        // Show the overlay
        APP.Animate.processingOverlayElement.classList.add('overlay--active')
        APP.Animate.processingOverlayElement.setAttribute('aria-hidden', 'false')
        // Optional: Set aria-busy on the main content
        document.querySelector('main').setAttribute('aria-busy', 'true');
    },
    _hideProcessingOverlay : () => {
        // Hide the overlay
        APP.Animate.processingOverlayElement.classList.remove('overlay--active');
        APP.Animate.processingOverlayElement.setAttribute('aria-hidden', 'true');
        // Reset aria-busy
        document.querySelector('main').setAttribute('aria-busy', 'false');
    },
    /**
     * [_processCards setup flip functionality for cards in a container]
     */
    _processCards: function(container, canHover) {
        function el(tag, cls){ var n=document.createElement(tag); if(cls) n.className=cls; return n; }

        var cards = container.querySelectorAll('.module--logos-figure-wrapper .module--logos-figure');

        cards.forEach(function(card) {
            // build once
            var stage = card.querySelector('.figure__flip');
            var img, desc;

            if (!stage) {
                var rawImg = card.querySelector('img.module--logos-image');
                var rawDesc = card.querySelector('.description');
                if (!rawImg || !rawDesc) return;

                stage = el('div', 'figure__flip');
                var front = el('div', 'figure__face figure__face--front');
                var back  = el('div', 'figure__face figure__face--back');

                front.appendChild(rawImg);
                back.appendChild(rawDesc);
                card.insertBefore(stage, card.firstChild);
                stage.appendChild(front);
                stage.appendChild(back);

                img  = rawImg;
                desc = rawDesc;
            } else {
                img  = card.querySelector('.figure__face--front > img.module--logos-image');
                desc = card.querySelector('.figure__face--back > .description');
            }

            // ✨ Critical: never keep a fixed height; clear any legacy inline height
            stage.style.height = ''; // remove "0px" if present

            // Make keyboard-reachable
            card.tabIndex = 0;

            // Seed aspect-ratio so Safari can size without measuring
            function setStageARFrom(imgEl) {
                var w = imgEl.naturalWidth, h = imgEl.naturalHeight;
                if ((!w || !h) && imgEl.hasAttribute('width') && imgEl.hasAttribute('height')) {
                    w = parseInt(imgEl.getAttribute('width'), 10);
                    h = parseInt(imgEl.getAttribute('height'), 10);
                }
                if (w && h) {
                    // stage.style.aspectRatio = w + ' / ' + h;                // inline wins reliably
                    stage.style.setProperty('--img-ar', w + ' / ' + h);     // optional CSS var
                    return true;
                }
                return false;
            }

            // If sizes was accidentally set to 1px earlier, scrub it
            var s = img.getAttribute('sizes');
            if (s && /\b1px\b/.test(s)) img.removeAttribute('sizes');

            // Initialize AR now; retry on load if needed
            if (!setStageARFrom(img)) {
                if (img.decode) img.decode().then(function(){ setStageARFrom(img); }).catch(function(){});
                if (!img.complete) img.addEventListener('load', function(){ setStageARFrom(img); }, { once:true });
            } else {
                // refresh AR on responsive srcset swaps
                img.addEventListener('load', function(){ setStageARFrom(img); });
            }

            // interactions (unchanged)
            if (canHover) {
                card.addEventListener('mouseenter', function(){ card.classList.add('is-flipped'); });
                card.addEventListener('mouseleave', function(){ card.classList.remove('is-flipped'); });
                card.addEventListener('keydown', function(e){
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); card.classList.toggle('is-flipped'); }
                });
                card.addEventListener('blur', function(){ card.classList.remove('is-flipped'); }, true);
            } else {
                card.addEventListener('click', function(e){
                var t = e.target, interactive = ['A','BUTTON','INPUT','TEXTAREA','SELECT','LABEL'];
                if (interactive.indexOf(t.tagName) === -1) {
                    card.classList.toggle('is-flipped');
                    if (card.closest('a')) e.preventDefault();
                }
                });
                card.addEventListener('keydown', function(e){
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); card.classList.toggle('is-flipped'); }
                });
            }
        });

        // Optional: iOS orientation quirk—refresh ratios once
        window.addEventListener('orientationchange', function(){
            cards.forEach(function(card){
            var stage = card.querySelector('.figure__flip');
            var img   = card.querySelector('.figure__face--front > img.module--logos-image');
            if (stage && img) setStageAR(stage, img);
            });
        }, { passive:true });
    },
}
APP.Animate._init()
/**
 * [ArchiveFilter for the querying and filtering of the filtered archive resources grid]
 * @type {Object}
 */
APP.ArchiveFilter = {
    // archive--filter-subgroup archive--filter-group-toggle
    $archiveGrid : $( '.archive--grid' ),
    $archiveFilterElement : $( '#archive--filters' ),
    $archiveFilters : $( '.archive--filters' ),
    $archiveNoResults : $( '.archive--no-results' ),
	$filterButtons : $( '.archive--filter-group-button' ),
    $filterClearElement : $( '.archive--filter-clear' ),
	$filterDownload : $( '.archive--filter-group-pdf-switch' ),
    $filterHasAudio : $( ".archive--filter-group-toggle-switch[data-switch-type='has_audio']" ).closest( '.archive--filter-group-toggle' ),
    $filterHasImage : $( ".archive--filter-group-toggle-switch[data-switch-type='has_image']" ),
    $filterHasVideo : $( ".archive--filter-group-toggle-switch[data-switch-type='has_video']" ).closest( '.archive--filter-group-toggle' ),
    $filterOnView : $( ".archive--filter-group-toggle-switch[data-switch-type='on_view']" ),
    $filterShowPrevious : $( ".archive--filter-group-toggle-switch[data-switch-type='show_previous']" ),
    $filterToggle: $( '.archive--filter-group-toggle-switch' ).closest( '.archive--filter-group-toggle' ),
    $filterToggleButton : $( '.archive--filter-suggestions' ),
	$filterGroupItem : $( '.archive--filter-group-item' ),
    $filterHeader : $( '.archive--filter-header' ),
	$filterGroupHeader : $( '.archive--filter-group-menu-header' ),
    $filterGroupMenu : $('.archive--filter-group-menu'),
    $filterSortItem : $('.archive--filter-sort-item'),
    $filterSearch : $( '.inpagetab-items-list-search'),
    $filterDateButton : $('.archive--filter-group-date-range-button'),
    $filterSaveButton : $('.archive--filter-group-save-button'),
    $featuredImages : $( "#archive--results > div.archive--double-feature > div.archive--grid-wrapper-grid > div:nth-child( -n + 2 ) > a > img.is--queuable" ),
	$filterDateContainer : $('.archive--filter-group-date-range'),
    $filterDateRangeContainer : $('.archive--filter-group-range-container' ),
    $filterSearchInputElement : $('.archive--filter-group-menu-wrapper .archive--filter-group-item-search-wrapper'),
    //$filterSearchIcon : $('.archive--filter-group-item-search-wrapper .sficon.sficon-search' ),
    $filterDateRadios : $('.archive--filter-group-input-radios input'),
	$filterDateContent : undefined,
	$grid : $( '.archive--grid-wrapper-grid' ),
	$gridItems : $( '.archive--grid-wrapper-grid-item' ),
    $paginationContainer : $( '.pagination--container' ),
    $tabLinkItems : $( '.inpagetab-items-item' ),
	$titleCount : $( '.archive--grid-wrapper-results-count' ),
	/**
	 * [titleRelation the text saying "relating to" in the title]
	 * @type {jQuery obj}
	 */
	$titleRelation : $( '.archive--grid-wrapper-title-relation' ),
	/**
	 * [titleTags the text that will contain the tag names in the title]
	 * @type {jQuery obj}
	 */
	$titleTags : $( '.archive--grid-wrapper-title-tag' ),
    /**
	 * [activeDateRange of active term ids]
	 * @type {array}
	 */
	activeDateRange : [],
    /**
	 * [activeFilters active filters]
	 * @type {array}
	 */
	activeFilters : { 
        artist_maker : [],
        artist_place : [],
        classification : [],
        collection : [],
        collection_id : [],
        dates : [], 
        date_created : [], 
        date_acquired : [],
        floor : [],
        has_audio : false,
        has_image : true,
        has_video : false, 
        on_view : true, 
        parents : [], 
        pdf : false, 
        search : '',
        s : '',
        type : '',
        show_previous : true,
        terms : {}, 
    },
	/**
	 * [activeSort current grid sorting ]
	 * @type {array}
	 */
	activeSort : [ 'default__desc' ],
    allImageLoaded : false,
    artistFilterDebounceTimer : null,
    artworkSearchDebounceTimer : null,
    _boundScrollFallback : null,
    classes : {
        'supertitle' : 'archive--grid-wrapper-grid-item-text-supertitle',
        'title' : 'archive--grid-wrapper-grid-item-text-title',
        'results_message' : 'archive--grid-wrapper-results',
        'artwork_artist' : 'archive--grid-wrapper-grid-item-text-artist',
        'artwork_created' : 'archive--grid-wrapper-grid-item-text-year',
        'artist_bio' : 'archive--grid-wrapper-grid-item-text-bio',
        'grid' : 'archive--grid-wrapper-grid',
        'grid_item' :  'archive--grid-wrapper-grid-item',
        'grid_filtered'  : 'archive--grid-filtered',
        'grid_empty' : 'archive--grid--no-results',
        'grid_wrapper' : 'archive--grid-wrapper-grid',
        'text_wrapper' : 'archive--grid-wrapper-grid-item-text',
        'image' : 'archive--grid-wrapper-grid-item-image',
        'link' : 'archive--grid-wrapper-grid-item-link',
        'subtitle' : 'archive--grid-wrapper-grid-item-text-subtitle',
        'featured' : 'archive--grid-wrapper-grid-item-pick-text-title',
        'filter_search' : 'archive--filter-group-item-search',
        'group' : 'archive--filter-group',
        'group_menu' : 'archive--filter-group-menu',
        'group_menu_wrapper' : 'archive--filter-group-menu-wrapper',
        'group_menu_active' : 'archive--filter-group-menu--active',
        'group_menu_has_valid' : 'archive--filter-group-menu--has-valid',
        'group_menu_is_valid' : 'archive--filter-group-menu--is-valid',
        'group_menu_has_active' : 'archive--filter-group-menu--has-active',
        'group_button' : 'archive--filter-group-button',
        'button_active' : 'archive--filter-group-button--active',
        'item_selected' : 'archive--filter-group-button--has-selection',
        'button_has_active' : 'archive--filter-group-button--has-active',
        'item_valid' : 'archive--filter-group-button--is-valid',
        'item_active' : 'archive--filter-group-item--active',
        'default_active' : 'archive--filter-default-active',
        'suggested_active' : 'archive--filter-suggestion--has-active',
        'toggle_button' : 'archive--filter-group-toggle-button'
        // [Symbol.iterator]() {
        //     return Object.values( this )
        // },
    },
    /**
	 * [closedEventDates placeholder for the closed event dates]
	 * @type {array|undefined}
	 */
	closedEventDates : undefined,
    currentAction : 'collection_filter',
    currentItemCount : 0,
    currentPage : 1,
    currentPath : window.location.pathname,
    currentQueryString : 'undefined' !== typeof window.location.search ? new URLSearchParams( window.location.search ).toString() : '',
    currentSearchGroup : '',
    defaultDates : [],
    defaultPostsPerPage : 32,
    defaultVisibleItems: 12,
    defaultVisibleRows: APP.data && APP.data['grid_rows_visible_initial'] ? APP.data['grid_rows_visible_initial'] : 3,
    dateRangeSliders : [],
    dateRangeSlidersInitialized : false,
    /**
	 * [featuredImagesComplete whether featured images are finsihed loading ]
	 * @type {boolean|false}
	 */
    featuredImagesComplete : false,
    filterArtworkDates : [
        document.getElementById('range--year-start'),
        document.getElementById('range--year-end'),
        document.getElementById('range-acquire--year-start'),
        document.getElementById('range-acquire--year-end'),
    ],
    filterDate : undefined,
    filterCache : {},
    fnCallbacks : { },
    featuredFillerOffets : {
        'xxsmall' : { 'margin' : 40, 'height' : 200 },
        'xsmall' : { 'margin' : 40, 'height' : 200 },
        'small' : { 'margin' : 40, 'height' : 200 },
        'medium' : { 'margin' : 0, 'height' : 200 },
        'large' :  { 'margin' : 0, 'height' : 200 },
        'largeplus' :  { 'margin' : 0, 'height' : 200 },
        'xlarge' :  { 'margin' : 0, 'height' : 200 } ,
        'xxlarge' :  { 'margin' : 0, 'height' : 200 } ,
    },
    featuredFillerOffet : 200,
    featuredFillerMargin : 0,
    httpLastRequest : null,
    lastMouseDownX : 0,
    lastMouseDownY : 0,
    lastMouseDownWasOutside : false,
    lastVisibleItem: null,
    local : {
        'en' : {
            days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
            daysShort: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
            daysMin: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'],
            months: ['January','February','March','April','May','June', 'July','August','September','October','November','December'],
            monthsShort: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'],
            today: 'Today',
            clear: 'Clear',
            dateFormat: 'mm/dd/yyyy',
            timeFormat: 'hh:ii aa',
            firstDay: 0
        }, 
    },
    observer : null,
    perPage : 32,
    performDirectSearch : false,
    postID : '',
     /**
	 * [posts list of posts that have been retreived from a response but maybe not displayed]
	 * @type {array}
	 */
	posts : undefined,
    promoDataKey : 'archive-promo',
    queues : {
        imageLoad : [],
    },
    queryKeys : {
        page : '_page',
        pdf :'_pdf',
        terms : '_terms',
        daterange : '_daterange',
        show_previous : '_show_previous',
        search : '_search',
        s: 's',
        sort : '_sort',
        type : 'type',
    },
    queryTransferMode : 'local',
    queryContent : [],
    resultsCache: {},
    searchParams : {},
    searchGroups : [],
    scope : 'collection',
	scrollToOffets : { 
       'medium' : 100,
       'large' : 115,
       'xlarge' : 165,
       'xxlarge' : 375,
    },
    scrollY : 0,
    startYear : 1900,
    createdStartYear : 1500,
    acquiredStartYear : 1935,
    svg: APP.data.SetupTheme.svg_input_check,
    svgArrowPrevious : APP.data.SetupTheme.svg_arrow_previous,
    svgArrowNext : APP.data.SetupTheme.svg_arrow_next,
    todayISO : new Date(),
    totalPage : 1,
    /**
	 * [upcomingEventDates placeholder for the upcoming event dates]
	 * @type {array|undefined}
	 */
	upcomingEventDates : undefined,
    /**
	 * [_init entry point]
	 */
	_init : () => {
		// we on the filtered archive page template & is posts & terms stored globally on this page?
		if ( (
                $( 'body' ).hasClass( 'page-template-page-filter-archive' ) 
                || $( 'body' ).hasClass( 'page-template-page-events-new' )
                || $( 'body' ).hasClass( 'page-template-page-collection-search' )
          )
            && typeof APP.data['archive_filter_posts'] != 'undefined' && typeof APP.data['archive_filter_terms'] != 'undefined' ) {
            // set the dafaults, event handing and active filters
            APP.ArchiveFilter._setDefaultValues()
            APP.ArchiveFilter._setDefaultEventHandling()
            APP.ArchiveFilter._parseUrlParams()
            APP.ArchiveFilter._setActiveFilters()
        }
	},
    _areArraysIdentical : (a, b) => a.length === b.length && JSON.stringify( a.sort() ) === JSON.stringify( b.sort() ),
    _bodyClickHandler : ( e ) => {
        let $target = $( e.target )       
        if ( ! $target.parents( `.${APP.ArchiveFilter.classes.group_menu_active}` ).length 
            && $( `.${APP.ArchiveFilter.classes.button_active}` ).length 
            && $target.children( '.archive--filter-group-icon' ).length === 0
            && ! $target.is( '.archive--filter-group-icon' )
            && ! $target.is( '.archive--filter-group-item-input-wrapper' )
            && ! $target.is( '.archive--filter-group-item-checkbox-wrapper' )
            && ! $target.is( '.input--check-svg' )
            && ! $target.is( '.input--check-path' )
            && ! $target.is( `.${APP.ArchiveFilter.classes.group_menu}` )
            && ! $target.is( '.air-datepicker *' )
            && ! $target.is( '.air-datepicker-cell')
            && ! $target.is( '.air-datepicker-nav--title')
            && ! $target.parent().is( '.air-datepicker-nav--action' )
            ) {
                APP.ArchiveFilter._toggleFilterGroup( $( `.${APP.ArchiveFilter.classes.button_active}` ) )
        }
    },
    _bodyKeyUpHandler : ( e ) => {
        if ( e.which == 27 ) {
            APP.ArchiveFilter._toggleFilterGroup( $( `.${APP.ArchiveFilter.classes.button_active}` ) )
        }
    },
    _breakpointHandler : ( e ) => {
        if ( APP.Breakpoint._is ( '<', 'medium' ) ) {
            APP.ArchiveFilter.scrollToOffet = APP.ArchiveFilter.scrollToOffets['medium']
            APP.ArchiveFilter.featuredFillerOffet = APP.ArchiveFilter.featuredFillerOffets['medium']['height']
            APP.ArchiveFilter.featuredFillerMargin = APP.ArchiveFilter.featuredFillerOffets['medium']['margin']
        }
        else if ( APP.Breakpoint._is ( '<=', 'large' ) ) {
            APP.ArchiveFilter.scrollToOffet = APP.ArchiveFilter.scrollToOffets['large']
            APP.ArchiveFilter.featuredFillerOffet = APP.ArchiveFilter.featuredFillerOffets['large']['height']
            APP.ArchiveFilter.featuredFillerMargin = APP.ArchiveFilter.featuredFillerOffets['large']['margin']
        }
        else if ( APP.Breakpoint._is ( '<=', 'xlarge' ) ) {
            APP.ArchiveFilter.scrollToOffet = APP.ArchiveFilter.scrollToOffets['xlarge']
            APP.ArchiveFilter.featuredFillerOffet = APP.ArchiveFilter.featuredFillerOffets['xlarge']['height']
            APP.ArchiveFilter.featuredFillerMargin = APP.ArchiveFilter.featuredFillerOffets['xlarge']['margin']
        }
        else if ( APP.Breakpoint._is ( '>=', 'xlarge' ) ) {
            APP.ArchiveFilter.scrollToOffet = APP.ArchiveFilter.scrollToOffets['xxlarge']
            APP.ArchiveFilter.featuredFillerOffet = APP.ArchiveFilter.featuredFillerOffets['xxlarge']['height']
            APP.ArchiveFilter.featuredFillerMargin = APP.ArchiveFilter.featuredFillerOffets['xxlarge']['margin']
        }
        // cosmetic changes
        if ( APP.Breakpoint.name !== '' ) {
        }    
    },
    _calculateInitialItemsToShow( gridContainer ) {
        const style = getComputedStyle( gridContainer ),
              columns = style.getPropertyValue( 'grid-template-columns' ).split(' ').length
              rows = gridContainer.getAttribute( 'data-visible-rows') || APP.ArchiveFilter.defaultVisibleRows
              APP.ArchiveFilter.defaultVisibleItems = columns * rows
    },
    _camalize : (str) => {
        return str.toLowerCase().replace(/[^a-zA-Z0-9]+(.)/g, (m, chr) => chr.toUpperCase())
    },
    _checkLoaded : ( index, value ) => {
        if ( $( value ).get(0).complete ) {
           APP.ArchiveFilter._deQueue( {
                'name' : 'imageLoad',
                'item' : value,
            } )
           APP.ArchiveFilter._checkQueue()
        }
    },
    _checkQueue( queue = { 'name' : 'imageLoad', 'callback' : '_fixMaxHeight' } ) {
        if ( 'undefined' !== typeof APP.ArchiveFilter.queues[ queue.name ] 
            && APP.ArchiveFilter.queues[ queue.name ].length === 0 ) {
                // now fix max height
                // '_checkQueue passed, calling ', queue.callback, APP.ArchiveFilter.queues[ queue.name ] )
               APP.ArchiveFilter[ queue.callback ]()
        }
    },
    _chooseArtworkDateRange : ( dateRange, rangeType = 'date_created' ) => {
        const $dateFilterElement = $( 'button[data-filter-type="date"]' )
        $input = $('.datepicker--value')
        const $dateFilterContainer = $dateFilterElement.next( `.${APP.ArchiveFilter.classes.group_menu}` )
        if ( 'undefined' === typeof dateRange ) {
            return []
        }
        let dates = []
        if ( Array.isArray( dateRange ) ) {
            dates = dateRange
        }
        else {
            dates = dateRange.split( ' - ' )
        }
    },
    /**
     *  Add these values into the date picker ui to show current dates
     *  and make the button active state 
     */
    _chooseDateRange : ( dateRange ) => {
        const $dateFilterElement = $( 'button[data-filter-type="date"]' )
              $input = $('.datepicker--value')
        const $dateFilterContainer = $dateFilterElement.next( `.${APP.ArchiveFilter.classes.group_menu}` )
        if ( 'undefined' === typeof dateRange ) {
            return []
        }
        let dates = []
        if ( Array.isArray( dateRange ) ) {
            dates = dateRange
        }
        else {
            dates = dateRange.split( ' - ' )
        }
        $dateFilterContainer.removeClass( APP.ArchiveFilter.classes.item_selected )
        $dateFilterContainer.removeClass( APP.ArchiveFilter.classes.group_menu_has_valid )
        $input.removeClass( APP.ArchiveFilter.classes.item_active )
        if ( 'undefined' !== typeof APP.ArchiveFilter.datePicker ) {
            // Set the datepicker range
            if ( Array.isArray( dates ) && 6 === dates.length ) {
                // month is zero indexed, which is why the minus 1 is used for the second argument.
                APP.ArchiveFilter.datePicker.selectDate( new Date( dates[0], ( dates[1] - 1 ), dates[2] ) )
                APP.ArchiveFilter.datePicker.selectDate( new Date( dates[3], ( dates[4] - 1 ), dates[5] ) )
                // add classes
                $dateFilterElement.addClass( APP.ArchiveFilter.classes.button_has_active )
                $dateFilterContainer.addClass( APP.ArchiveFilter.classes.group_menu_has_valid )
                $input.addClass( APP.ArchiveFilter.classes.item_active )
            }
        }
        else if ( 'undefined' !== typeof APP.ArchiveFilter.activeFilters.dates || APP.ArchiveFilter.activeFilters.dates.length === 0 ) {
            APP.ArchiveFilter.activeFilters.dates[0] = `${dates[0]}-${ ( dates[1] - 1 ) }-${dates[2]}`
            APP.ArchiveFilter.activeFilters.dates[1] = `${dates[3]}-${ ( dates[4] - 1 ) }-${dates[5]}`
        }
    },
    _chooseSort : ( $label, value ) => {
       APP.ArchiveFilter._getActiveSort().removeClass('archive--filter-sort-item--active')
        // Toggle active class on the label
        if ( typeof value === 'undefined' ) {
            $label.toggleClass( 'archive--filter-sort-item--active' )
        }
        else if ( 1 === Number( value ) ) {
            $label.addClass( 'archive--filter-sort-item--active' )
        }
        else if ( 0 === Number( value ) ) {
            $label.removeClass( 'archive--filter-sort-item--active' )
        }

        if ( $label.hasClass( 'archive--filter-sort-item--active' ) ) {
            $label
                .find( '.archive--filter-group-item-radio' )
                .prop( 'checked', true )
        }
        else {
            $label
                .find( '.archive--filter-group-item-radio' )
                .prop( 'checked', false )
        }
    },
    _clearDatePicker : () => {
        //const dateFilterElement = document.querySelector( 'button[data-filter-type="date"]' )
        const $dateFilterElement = $( 'button[data-filter-type="date"]' )
        const $dateFilterContainer = $dateFilterElement.next( `.${APP.ArchiveFilter.classes.group_menu}` )

        // reset posts and post count
        APP.ArchiveFilter.posts = [ ...APP.data['archive_filter_posts'] ]
        APP.ArchiveFilter.currentItemCount = APP.ArchiveFilter.posts.length

        // clear the datepicker
        APP.ArchiveFilter.datePicker.hide()
        APP.ArchiveFilter.datePicker.clear()
        // Reset calendar view
        APP.ArchiveFilter.datePicker.setViewDate( APP.ArchiveFilter.todayISO )
        APP.ArchiveFilter.datePicker.show()
        // clear the local date filter
        APP.ArchiveFilter.activeFilters.dates = []
        $( '.air-datepicker-cell' ).removeClass( '-selected- -range-from- -in-range- -range-to- -super-in-range-' )
        $dateFilterElement
            .removeClass( APP.ArchiveFilter.classes.button_has_active )
        $dateFilterContainer 
            .removeClass( APP.ArchiveFilter.classes.button_has_active )
        $dateFilterContainer 
            .removeClass( APP.ArchiveFilter.classes.item_selected )
        $dateFilterContainer 
            .removeClass( APP.ArchiveFilter.classes.item_valid )
        $('.datepicker--value').removeClass( APP.ArchiveFilter.classes.item_active )
    },
    _clearDateRanges : ( $target = null ) => {
        if ( ! APP.ArchiveFilter.filterArtworkDates.length || null === APP.ArchiveFilter.filterArtworkDates[ 0 ] ) {
            return
        }
        const createdDates = [ null, null ],
        acquiredDates = [ null, null ]
        for ( const dateInput of APP.ArchiveFilter.filterArtworkDates ) {
            let dateYear = 2023
            if ( dateInput.id === 'range--year-start' ) {
                dateYear = APP.ArchiveFilter.createdStartYear
                createdDates[0] = dateYear
            }
            else if ( dateInput.id === 'range--year-end' ) {
                createdDates[1] = dateYear
            }
            else if ( dateInput.id === 'range-acquire--year-start' ) {
                dateYear = APP.ArchiveFilter.acquiredStartYear
                acquiredDates[0] = dateYear
            }
            else if ( dateInput.id === 'range-acquire--year-end' ) {
                acquiredDates[1] = dateYear
            }
            $( dateInput ).val( dateYear )
            if ( ! $target ) {
                $target = $( dateInput )
            }
        }
        let i = 0
        for ( const dateRangeSlider of APP.ArchiveFilter.dateRangeSliders ) {
            if ( 0 === i ) {
                dateRangeSlider.set( createdDates )
                i++
            }
            else {
                dateRangeSlider.set( acquiredDates )
            }
        }
        const $groupMenu = $target.parents( `.${APP.ArchiveFilter.classes.group_menu }` ),
        $menuButton = $groupMenu.prev( `.${APP.ArchiveFilter.classes.group_button}` )
        // remove active classes
        $groupMenu.removeClass( APP.ArchiveFilter.classes.group_menu_has_valid )
        $groupMenu.removeClass( APP.ArchiveFilter.classes.group_menu_has_active )
        $menuButton.removeClass( APP.ArchiveFilter.classes.button_has_active )
        APP.ArchiveFilter.activeFilters.date_created = []
        APP.ArchiveFilter.activeFilters.date_acquired = []
    },
    _clearFilterSearch : ( groupMenu ) => {
        if ( ! groupMenu ) {
            return
        }
        // If wrapper is an array, loop through all items, calling this function on each
        if ( Array.isArray( groupMenu ) ) {
            for ( const item of groupMenu ) {
                APP.ArchiveFilter._clearFilterSearch( item )
            }
            return
        }
        const wrapper = groupMenu.querySelector( `.${APP.ArchiveFilter.classes.group_menu_wrapper}` )
        if ( ! wrapper ) {
            return
        }
        const input = wrapper.querySelector( `input.${APP.ArchiveFilter.classes.filter_search}`)
        if ( wrapper && input ) {
            wrapper.classList.remove( 'is--filtered', 'is--queried' )
            input.value = ''
        }
    },
    _clearSearch : () => {
        const searchFilterInput = document.querySelector( 'input.inpagetab-items-search' )
        $( searchFilterInput ).parent().removeClass( 'has--searched is--searching' )
        $( searchFilterInput ).val( '' )
        APP.ArchiveFilter.activeFilters.search = ''
        if ( 'site' === APP.ArchiveFilter.scope ) {
            APP.ArchiveFilter.activeFilters.s = ''
        }
    },
    _closeFilterGroupClickHander : ( e ) => {
        e.preventDefault()
        const $target = $( e.target )
        const $wrapper = $target.parents( `.${APP.ArchiveFilter.classes.group_menu_active}` )
        const filterGroupButton = $wrapper.prev( `.${APP.ArchiveFilter.classes.button_active}` )
        if ( filterGroupButton.length ) {
            $.each( filterGroupButton, ( index, value ) => {
               APP.ArchiveFilter._toggleFilterGroup( $( value ) )
            })
        }
    },
    /** 
     *   Helper function to find the closest ancestor that matches a selector 
    */
    _closestAncestor : ( element, selector ) => {
        let currentElement = element
        while (currentElement && !currentElement.matches( selector ) ) {
            currentElement = currentElement.parentElement
        }
        return currentElement
    },
    _createDateRangeHistograms : () => {
        let thisYear = APP.ArchiveFilter.todayISO.getFullYear(),
            startYear = APP.ArchiveFilter.createdStartYear,
            startDates = [ Number( startYear ), Number( thisYear ) ]

        const format = {
            to:  value => Math.round( value ),
            from: value => Math.round( value ) 
        },
        // create a noUiSlider instance
        rangeOptions = {
            range: {
                'min': startYear,
                'max': thisYear
            },
            step: 1,
            start: startDates,
            margin: 1,
            orientation: 'horizontal',
            behaviour: 'tap-drag',
            pips: {
                mode: 'range',
                stepped: true,
                density: 1
            },
            format: format
        }
        for ( let i = 0; i < APP.ArchiveFilter.$filterDateRangeContainer.length; i++ ) {
            const item = APP.ArchiveFilter.$filterDateRangeContainer[i]
            const minYear = typeof item !== 'undefined' ? Number( item.dataset.startYear ) : APP.ArchiveFilter.createdStartYear
            const rangeId = item.dataset.range_id
            
            // set the range min
            rangeOptions.range['min'] = minYear
            
            // Handle created date range
            if ( rangeId === 'range--slider ') {
                if ( APP.ArchiveFilter.searchParams[ APP.ArchiveFilter.queryKeys.date_created ] ) {
                    const createdDateValue = APP.ArchiveFilter.searchParams[ APP.ArchiveFilter.queryKeys.date_created ]
                    rangeOptions.start = createdDateValue.includes( '-' ) 
                        ? createdDateValue.split( '-' ).map( Number )
                        : [ Number( createdDateValue ), thisYear ]
                }
            }
            // Handle acquired date range
            else if ( rangeId === 'range-acquire--slider' ) {
                if ( APP.ArchiveFilter.searchParams[ APP.ArchiveFilter.queryKeys.date_acquired ] ) {
                    const acquiredDateValue = APP.ArchiveFilter.searchParams[ APP.ArchiveFilter.queryKeys.date_acquired ]
                    rangeOptions.start = acquiredDateValue.includes( '-' )
                        ? acquiredDateValue.split( '-' ).map( Number )
                        : [ Number( acquiredDateValue ), thisYear ]
                } 
                else {
                    rangeOptions.start = [minYear, thisYear]
                }
            }

            // Create slider and bind events
            const slider = noUiSlider.create(document.getElementById(rangeId), rangeOptions)
            
            // Update corresponding input fields when slider changes
            slider.on( 'update', ( values, handle ) => {
                const isAcquiredSlider = rangeId === 'range-acquire--slider'
                const inputIndex = isAcquiredSlider ? handle + 2 : handle
                const input = APP.ArchiveFilter.filterArtworkDates[ inputIndex ]
                
                if (input) {
                    input.value = values[handle]
                    // Preserve the input value
                    $( input ).attr('data-last-value', values[ handle ] )
                }
            })

            // Handle slider set event
            slider.on( 'set', ( values, handle ) => {
                const isAcquiredSlider = rangeId === 'range-acquire--slider'
                const inputIndex = isAcquiredSlider ? handle + 2 : handle
                const input = APP.ArchiveFilter.filterArtworkDates[ inputIndex ]
                
                if (input) {
                    $(input)
                        .parents('.archive--filter-group-menu')
                        .addClass( APP.ArchiveFilter.classes.group_menu_has_valid )
                    
                    // Ensure the value stays set
                    input.value = values[handle]
                    $( input ).attr('data-last-value', values[handle])
                }
            })
            // Store the slider
            APP.ArchiveFilter.dateRangeSliders.push( slider )
        }
        // listen to APP.ArchiveFilter.filterArtworkDates change
        APP.ArchiveFilter.filterArtworkDates.forEach( ( dateInput, index ) => {
            $(dateInput).on('change', function() {
                const value = this.value
                const isAcquiredInput = index >= 2 // First two are for created date
                const sliderIndex = isAcquiredInput ? 1 : 0
                const handleIndex = isAcquiredInput ? index - 2 : index
                if ( value ) {
                    // Update slider
                    const slider = APP.ArchiveFilter.dateRangeSliders[ sliderIndex ]
                    if ( slider ) {
                        const currentValues = slider.get()
                        currentValues[handleIndex] = value
                        slider.set( currentValues )
                    }
                    // Store the value
                    $(this).attr( 'data-last-value', value )
                    // Add valid class
                    $(this)
                        .parents( '.archive--filter-group-menu' )
                        .addClass( APP.ArchiveFilter.classes.group_menu_has_valid )
                }
            })
        })
    },
    _decodeURL : s => {
        // Handle non-string input
        if ( typeof s !== 'string' ) {
            return s
        }
        return decodeURIComponent( s.replace(/\+/g, " ") )
    },
    _deQueue : ( config = { 'name' : 'imageLoad', 'item' : null } ) => {
        APP.ArchiveFilter.queues[config.name] = $( APP.ArchiveFilter.queues[config.name] ).not( config.item )
    }, 
    _documentReadyHandler : ( e ) => {
        // prepare gridItems
        APP.ArchiveFilter._prepareGridItems()
        // Load images
        APP.ArchiveFilter._imageLowResLoader()
        // check if event datepicker is acive
        if ( APP.ArchiveFilter.$filterDateContainer.length > 0 ) {
            // set up and store datepicker instance
            APP.ArchiveFilter.datePicker = new AirDatepicker( APP.ArchiveFilter.$filterDateContainer.get(0), APP.ArchiveFilter._getDatePickerConfig() )
            // set the datepicker content
            APP.ArchiveFilter.$filterDateContent = $( '.datepicker--content', APP.ArchiveFilter.$filterDateContainer )
            // listen for mouseleave events on the datepicker content
            APP.ArchiveFilter.$filterDateContent.on( 'mouseleave', APP.ArchiveFilter._filterDateContentMouseleaveHandler )
        }
        // check for date range container
        if ( APP.ArchiveFilter.$filterDateRangeContainer.length > 0 ) {
            APP.ArchiveFilter._createDateRangeHistograms()
        }
        // unhide pagination
        if ( APP.ArchiveFilter.$paginationContainer.hasClass( 'pagination--first-load' ) ) {
           APP.ArchiveFilter.$paginationContainer.removeClass( 'pagination--first-load' ) 
        }
        // find which filters/pages is active
        APP.ArchiveFilter._updateFilters( e )
        // find which breakpoint is active
        APP.ArchiveFilter._breakpointHandler( e )
        // Save results to cache
        const cacheKey = APP.ArchiveFilter._filterRemoteRequestCacheKey()
        APP.ArchiveFilter.resultsCache[ cacheKey ] = {
            found_pagination : APP.data.found_pagination,
            found_posts: APP.data.found_posts,
            found_query : APP.data.found_query,
            max_num_pages : APP.data.max_num_pages,
            posts : APP.ArchiveFilter.posts,
        }
    },
    _featuredImageLoadHandler : ( e ) => {
        // remove this item from the imageLoad queue
       APP.ArchiveFilter._deQueue( {
            'name' : 'imageLoad',
            'item' : $( e.target ),
        } )
        // check the queue
       APP.ArchiveFilter._checkQueue()
    },
    _filterArchiveGridTransition : ( scrollToResults, updateURL = true, updateActiveFilterValues = true, updatePagination = false ) => {
        let resize = false
        if ( updateURL ) {
            //  update URL
            APP.ArchiveFilter._filterArchiveURLTransition()
            updatePagination = true
        }
        // Hide grid
        APP.ArchiveFilter.$archiveGrid
            .add( APP.ArchiveFilter.$archiveFilters )
            .add( '.footernav' )
            .addClass( 'pagination--transition' )
            // add pagenumber to grid if > 1
            if ( APP.ArchiveFilter._hasPaginationApplied() ) {
               APP.ArchiveFilter.$archiveGrid
                    .addClass( 'archive--grid-pagination--active' )
            }
            else {
               APP.ArchiveFilter.$archiveGrid
                    .removeClass( 'archive--grid-pagination--active' )
            }
        // update grid
        APP.ArchiveFilter._updateGrid( updateActiveFilterValues )
        if ( updatePagination ) {
            // render pagination now that url has been determined.
		    APP.ArchiveFilter._renderPagination()

            // maybe show no results
            if ( APP.ArchiveFilter.currentItemCount === 0 ) {
                APP.ArchiveFilter.$archiveNoResults.addClass( 'archive--no-results--active' )
                APP.ArchiveFilter.$archiveGrid.addClass( 'archive--grid--no-results' )
                if (  $('.archive--no-results--contact-form').length )  {
                    $('.archive--no-results--contact-form')[0].scrollIntoView( { block: 'start',  behavior: 'smooth' } )
                }
                else if ( APP.data.no_results_message ) {
                    // render no results message no_results_message
                    APP.ArchiveFilter.$grid.append( APP.data.no_results_message )
                    // render promo item
                    APP.ArchiveFilter._renderPromoItem( APP.ArchiveFilter.currentItemCount )
                    // @TODO: append the search links after the no results message
                }
            }
            else {
                APP.ArchiveFilter.$archiveNoResults.removeClass( 'archive--no-results--active' )
                APP.ArchiveFilter.$archiveGrid.removeClass( 'archive--grid--no-results' )
            }
        }
        // resize grid
        if ( 'results' === scrollToResults || null === scrollToResults ) {
            resize = true
        }
        else if ( APP.ArchiveFilter.currentPage === 1 ) {
            resize = true
        }
        // wheter to scroll
        scrollToResults = typeof scrollToResults !== 'undefined' && scrollToResults ? scrollToResults : false
        // slight delay before update
        setTimeout( () => {
            let resultsOffset = APP.ArchiveFilter.$archiveFilterElement.offset()  
            if ( 'results' === scrollToResults && typeof resultsOffset !== 'undefined' && APP.Scroll.lastScrollTop > APP.ArchiveFilter.scrollToOffet ) {
                window.scrollTo( {
                    top: APP.ArchiveFilter.scrollToOffet, ///gridOffset.top,
                    left: 0,
                    behavior: "smooth",
                  }  )
            }
            // Show grid
            APP.ArchiveFilter.$archiveGrid
                .add( APP.ArchiveFilter.$archiveFilters )
                .add( '.footernav' )
                .removeClass( 'pagination--transition' )

            // Masonry, if it exists and _init is callable
            if ( typeof APP.MasonryLayout !== 'undefined' && typeof APP.MasonryLayout._init === 'function' ) {
                APP.MasonryLayout._init()
            }
            // Fix grid heights
            if ( resize && APP.ArchiveFilter.$featuredImages.length ) {
                // reset load queue
               APP.ArchiveFilter.$featuredImages.each( APP.ArchiveFilter._checkLoaded )
               APP.ArchiveFilter.$featuredImages.on( 'load', APP.ArchiveFilter._featuredImageLoadHandler )
            }
        }, 3 )
    },
    _filterArchiveGridUpdate : ( remoteOptions = { action : '', callbacks : [], options : {} }, gridTransition = { scrollToResults : undefined, updateURL : true, updateActiveFilterValues : true  } ) => {
        const { scrollToResults, updateURL, updateActiveFilterValues } = gridTransition
        let { action, callbacks, options } = remoteOptions
        if ( '' === action  ) {
            action = APP.ArchiveFilter.currentAction
        }
        if ( 'remote' === APP.ArchiveFilter.queryTransferMode )  {
            // Make a remote request
            let preFilter = true
            if ( 'undefined' !== typeof options && 'undefined' !== typeof options.origin && 'pagination' === options.origin  ) {
                preFilter = false
            }
            APP.ArchiveFilter._filterRemoteRequest( action, callbacks, options, preFilter )
        }
        else {
            // transition to an updated grid
            APP.ArchiveFilter._filterArchiveGridTransition( scrollToResults, updateURL, updateActiveFilterValues )
        }
    },
    _filterArchiveURLTransition : ( transition = {}, activatePushState = true ) => {
        transition = APP.ArchiveFilter._getTransition( transition )
        if ( activatePushState ) {
            history.pushState( transition, null, transition.url )
            // update history state
            APP.URLParams._popStateHandler()
        }
    },
	_filterButtonClickHandler : ( e ) => {
        let $target = $( e.target )
        // probs not needed but w/e
        e.preventDefault
        if ( $target.is( 'i' ) ) {
            $target = $target.parent( `.${APP.ArchiveFilter.classes.group_button}` )
        }
        else if ( $target.hasClass( 'sficon' ) ) {
            $target = $target.parent( `.${APP.ArchiveFilter.classes.group_button}` )
        }
        // Toggle the filger group
        APP.ArchiveFilter._toggleFilterGroup( $target )
        // close other filter groups
        const otherFilterGroups = $( `.${APP.ArchiveFilter.classes.button_active}` ).not( $target )
        if ( otherFilterGroups.length ) {
            $.each( otherFilterGroups, ( index, value ) => {
               APP.ArchiveFilter._toggleFilterGroup( $(value) )
            })
        }
	},
    _filterClearAll : ( $otherFilterGroups, isClearAll = false ) => {
        if ( $otherFilterGroups.length ) {
            $.each( $otherFilterGroups, ( index, value ) => {
                const $label = $( value )
                // labels are tax terms
                if ( $label.is( 'label' ) ) {
                    const valueKey = $label.parent().data( 'queryParam' ).substring( 1 )
                    // uncheck filter term checkboxes
                    APP.ArchiveFilter._toggle( $label, false, 'checkbox', true, true )
                    APP.ArchiveFilter.activeFilters[ valueKey ] = []
                }
                // button is the pdf/file toggle
                else if ( $label.is( 'button' ) ) {
                    // which button type is this?
                    // This is a toggle button
                    if ( $label.hasClass( APP.ArchiveFilter.classes.toggle_button ) ) {
                        $label.parent().removeClass( 'archive--filter-suggestion--has-active' )
                        if ( $label.data('searchType') && 'artist_geo_live_work' === $label.data('searchType') ) {
                            APP.ArchiveFilter.activeFilters.artist_place = []
                        }
                        else if ( $label.data('searchType') && 'collection_id' === $label.data('searchType') ) {
                            APP.ArchiveFilter.activeFilters.collection_id = []
                        }
                        else if ( $label.data('searchType') && 'collection_name' === $label.data('searchType') ) {
                            APP.ArchiveFilter.activeFilters.collection = []
                        }
                        else if ( $label.data('searchType') && 'random' === $label.data('searchType') ) {

                        }
                        else if ( $label.data('searchType') && 'new_acquisitions' === $label.data('searchType') ) {
                            APP.ArchiveFilter.activeFilters.date_acquired = []
                        }
                    }
                    // this is a pdf switch
                    else if ( $('.archive--filter-group-pdf-switch-wrapper' ).length ){
                        APP.ArchiveFilter.activeFilters.pdf = 0
                        $label.removeClass( 'archive--filter-group-pdf-switch--active' )
                        $label.find( '.archive--filter-group-pdf-switch-wrapper > svg' )
                            .remove()
                    }
                    else {
                        // check to see if this toggle is active by default, and if so activate it.
                        const toggleValue = $label.hasClass( APP.ArchiveFilter.classes.default_active ) ? true : false
                        APP.ArchiveFilter._toggle( $label, toggleValue, 'toggle', true, true )
                        // handle $has_audio and has_video
                        if ( 'has_audio' === $label.data( 'switchType' ) ) {
                            APP.ArchiveFilter.activeFilters.has_audio = 0
                        }
                        else if ( 'has_video' === $label.data( 'switchType' ) ) {
                            APP.ArchiveFilter.activeFilters.has_video = 0
                        }
                    }
                }
                // input is the date filter value
                else if ( $label.is( 'input.datepicker--value' ) ) {
                   APP.ArchiveFilter._clearDatePicker()
                }
                else if ( $label.is( 'input[type="number"]' ) ) {
                    // Likely a date range input
                }
                else if ( $label.hasClass( 'inpagetab-items-search' ) ) {
                    // Likely a search input
                    APP.ArchiveFilter._clearSearch()
                }
            } )
            if ( isClearAll ) {
                $( `.${APP.ArchiveFilter.classes.group_menu_has_active}`).removeClass( APP.ArchiveFilter.classes.group_menu_has_active )
                $( `.${APP.ArchiveFilter.classes.button_has_active}`).removeClass( APP.ArchiveFilter.classes.button_has_active )
                APP.ArchiveFilter._clearDateRanges()
            }
        }
        if ( isClearAll && APP.ArchiveFilter._getActiveSearch() ) {
            APP.ArchiveFilter._clearSearch()
        }
    },
    _filterClearHandler : ( e ) => {
        let $otherFilterGroups
        const $target = $( e.target ),
              $groupMenu = $target.parents( `.${APP.ArchiveFilter.classes.group_menu }` ),
              $menuButton = $groupMenu.prev( `.${APP.ArchiveFilter.classes.group_button}` ),
              targetData = $target.data(),
              isClearAll = $target.is( '#archive--clear-all' )

        e.preventDefault()
        if ( isClearAll ) {
            if ( 'remote' !== APP.ArchiveFilter.queryTransferMode )  {
                // reset posts and post count to original:
                APP.ArchiveFilter.posts = [ ...APP.data['archive_filter_posts'] ]
                APP.ArchiveFilter.currentItemCount = APP.ArchiveFilter.posts.length
                APP.ArchiveFilter.maxNumPages = APP.data['max_num_pages']
                APP.ArchiveFilter.foundPosts = APP.data['found_posts']
                APP.ArchiveFilter.foundQuery = APP.data['found_query']
                APP.ArchiveFilter.foundPagination = APP.data['found_pagination']
            }
            // Get a list of active filters to clear
            $otherFilterGroups = APP.ArchiveFilter._getActiveFilterButtons()
            // Add pdf filter if it exists
            if ( $( '.archive--filter-group-pdf-switch--active' ).length ) {
                $otherFilterGroups = $otherFilterGroups.add( '.archive--filter-group-pdf-switch--active' )
            }
            // Add date filter if it exists
            if ( $( `.${APP.ArchiveFilter.classes.button_has_active}[data-filter-type="date"]` ).length ) {
                $otherFilterGroups = $otherFilterGroups.add( '.archive--filter-group-date-range--active' )
            }
            const $activeToggle = $( '.archive--filter-suggestion--has-active > button' )
            if ( $activeToggle.length ) {
                $otherFilterGroups = $otherFilterGroups.add( $activeToggle )
            }
            let foundDates = []
            $('.archive--filter-group-menu--has-active .range--input-text').each( ( index, el ) => {
                if ( 'range--year-start' === el.id && Number( el.value ) !== APP.ArchiveFilter.createdStartYear ) {
                    foundDates[0] = el
                }
                else if ( 'range--year-end' === el.id && Number( el.value ) !== APP.ArchiveFilter.todayISO.getFullYear() ) {
                    foundDates[1] = el
                }
                if ( 'range-acquire--year-start' === el.id && Number( el.value ) !== APP.ArchiveFilter.acquiredStartYear  ) {
                    foundDates[2] = el
                }
                else if ( 'range-acquire--year-end' === el.id && Number( el.value ) !== APP.ArchiveFilter.todayISO.getFullYear() ) {
                    foundDates[3] = el
                }
            } )
            if ( foundDates.length ) {
                foundDates.forEach( ( item ) => {
                    $otherFilterGroups = $otherFilterGroups.add( $( item ) )
                } )
            }
            // If an active search exists, add that to the $otherFIlterGroups
            if ( APP.ArchiveFilter._getActiveSearch() ) {
                $otherFilterGroups = $otherFilterGroups.add( '.inpagetab-items-search' )
            }
            // clear filter limiting searches
            APP.ArchiveFilter._clearFilterSearch( APP.ArchiveFilter._getActiveFilterSearches() )
            // clear has_video and has_audio
            APP.ArchiveFilter.activeFilters.has_video = 0
            APP.ArchiveFilter.activeFilters.has_audio = 0
        }
        else if ( ! $groupMenu.hasClass( `${APP.ArchiveFilter.classes.group_menu_has_valid}` ) &&  ! $groupMenu.hasClass( `${APP.ArchiveFilter.classes.group_menu_has_active}` ) ) {
            return
        }
        else if ( ! targetData || 'undefined' === typeof targetData.clearKey ) {
            return
        }
        else {
            // find all active checkboxes & checkboxes in the group
            $otherFilterGroups = $groupMenu.find( `.${APP.ArchiveFilter.classes.item_active}` )
            // @TODO Find any active date ranges or toggles ouside of a group
            if ( ! $otherFilterGroups.length && $groupMenu.is( `.${APP.ArchiveFilter.classes.group_menu_has_active}` ) ) {
                $otherFilterGroups.forceClear = true
                const groupMenuData = $groupMenu.find( `.${APP.ArchiveFilter.classes.group_menu_wrapper}` ).data()
                let valueKey
                if ( groupMenuData && 'undefined' !== typeof groupMenuData.queryParam ) {
                    valueKey = groupMenuData.queryParam.substring( 1 )
                }
                else if ( $groupMenu.find('.archive--filter-group-date-range-container') ) {
                    APP.ArchiveFilter.activeFilters.date_acquired = []
                    APP.ArchiveFilter.activeFilters.date_created = []
                }
                // If APP.ArchiveFilter.activeFilters[ valueKey ] is not empty, clear it out
                if ( valueKey && APP.ArchiveFilter.activeFilters[ valueKey ] ) {
                    APP.ArchiveFilter.activeFilters[ valueKey ] = []
                }
            }
            APP.ArchiveFilter._clearFilterSearch( $groupMenu[0] )
        }
        if ( $target.is( '[data-clear-key="date"]' ) && $target.is( '[data-clear-type="date"]' ) ) {
            // clear all date picker values
            APP.ArchiveFilter._clearDatePicker()
            APP.ArchiveFilter._filterArchiveGridUpdate()
        }
        else if ( $target.is( '[data-clear-key="date"]' ) && $target.is( '[data-clear-type="multi"]' ) ) {
            // clear all date picker values
            APP.ArchiveFilter._clearDateRanges( $target )
            APP.ArchiveFilter._filterArchiveGridUpdate()
        }
        else if ( $otherFilterGroups.length || 'undefined' !== typeof $otherFilterGroups.forceClear ) {
            // reset pagination 
            APP.ArchiveFilter.currentPage = 1
            APP.ArchiveFilter._filterClearAll( $otherFilterGroups, isClearAll )
            if ( ! isClearAll ) {
                $groupMenu.removeClass( APP.ArchiveFilter.classes.group_menu_has_active )
                $groupMenu.removeClass( APP.ArchiveFilter.classes.group_menu_has_valid )
                $menuButton.removeClass( APP.ArchiveFilter.classes.button_has_active )
            }
            APP.ArchiveFilter.$archiveGrid.removeClass( 'archive--grid-pagination--active' )
            APP.ArchiveFilter._filterArchiveGridUpdate()
        }
    },
    _filterDateContentMouseleaveHandler : ( e ) => {
        // if rangeto and rangefrom are present
        if ( $ ('.datepicker--cell.-selected-', APP.ArchiveFilter.$filterDateContent).length != 2 ) {
            // remove classes from datepicker content
            $( '.datepicker--cell', APP.ArchiveFilter.$filterDateContent )
                .removeClass( '-range-from- -in-range- -range-to-' )
        }
    },
    _filterDownloadClickHander : ( e ) => {
        let $target = $( e.target )
        if ( $target.not( 'button' ) && $target.hasClass( 'archive--filter-group-pdf-switch-wrapper' ) ) {
            $target = $target.parent( '.archive--filter-group-pdf-switch' )
        }
        else if ( $target.not( 'button' ) && $target.hasClass( 'input--check-svg' ) ) {
            $target = $target.parents( '.archive--filter-group-pdf-switch' )
        }
        // toggle the buttonswitch
        APP.ArchiveFilter._toggle( $target, undefined, 'pdf', false, false )
        // reset pagination 
        APP.ArchiveFilter.currentPage = 1
        // transition to an updated grid
        APP.ArchiveFilter._filterArchiveGridTransition()
    },
    _filterGroupCheckboxClickHandler : function( e ) {
        e.preventDefault()
        const $target = $( e.target )
        let $label = $target.parents( '.archive--filter-group-item' )
        if ( $target.is( 'input' ) ) {
            $label = $target.closest( '.archive--filter-group-item' )
        }
        else if ( $target.hasClass( 'archive--filter-group-item' ) || $target.is( 'label' ) ) {
            $label = $target
        }
        APP.ArchiveFilter._toggle( $label, undefined, 'checkbox', true, true )
    },
    _filterHeaderClickHander : ( e ) => {
        e.preventDefault()
        let $target = $( e.target )

        if ( ! $target.is( APP.ArchiveFilter.$filterHeader) ) {
            $target = $( e.target ).closest( APP.ArchiveFilter.$filterHeader )
        }
        if ( $target.is( APP.ArchiveFilter.$filterHeader ) ) {
            $target.toggleClass( 'archive--filter-header--active' )
            if ( $target.find( '.sficon' ).hasClass( 'sficon-arrow-down' ) ) {
                $target.find( '.sficon' )
                    .removeClass( 'sficon-arrow-down' )
                    .addClass( 'sficon-arrow-up' )
            }
            else {
                $target.find( '.sficon' )
                    .removeClass( 'sficon-arrow-up' )
                    .addClass( 'sficon-arrow-down' )
            }
            if ( $target.hasClass( 'archive--filter-header--active' ) ) {
                $target.next( '.archive--filter-wrapper' ).removeClass( 'archive--filter-wrapper--hidden' )
            }
            else{
                $target.next( '.archive--filter-wrapper' ).addClass( 'archive--filter-wrapper--hidden' )
            }
        }
    },
    _filterDateRangeClickHandler : ( e ) => {
        const $target = $( e.target ),
              dateFilterElement = document.querySelector( 'button[data-filter-type="date"]' )
              $filterGroup = $( dateFilterElement ).next()

		// init selected dates array
		// find the selected dates
        APP.ArchiveFilter.activeFilters.dates = []
		APP.ArchiveFilter.datePicker.selectedDates.map( ( el, index ) => {
			// add to selected dates
            const date = new Date( el )
            const [ withoutTime ] = date.toISOString().split('T')
            if ( index < 2 && 'undefined' !== typeof withoutTime )  {
               APP.ArchiveFilter.activeFilters.dates.push( withoutTime )
            }
		} )
        if ( APP.ArchiveFilter.activeFilters.dates.length < 2 ) {
            return
        }
        // this will remove the active class from the (hopefuly only) active menu
        APP.ArchiveFilter._toggleFilterGroup( $( `.${APP.ArchiveFilter.classes.button_active}` ) )
        // toggle active class for button if a item is still active.
        let delay = false
        if ( 2 === APP.ArchiveFilter.activeFilters.dates.length ) {
            $( dateFilterElement ).addClass( APP.ArchiveFilter.classes.button_has_active )
            $( dateFilterElement )
                .next( `.${APP.ArchiveFilter.classes.group_menu}` )
                .addClass( APP.ArchiveFilter.classes.button_has_active )
            $('input.datepicker--value').addClass( APP.ArchiveFilter.classes.item_active )            
            // if from date is in the past, then we will need to hit the server for older dates
            if ( new Date( APP.ArchiveFilter.activeFilters.dates[0] ) < APP.ArchiveFilter.todayISO ) {
                // show that this might take some time
                APP.Animate._showProcessingOverlay()
                // setup data obj for http request
                const data = {
                    action : 'archive_events_filter',
                    selected_dates : APP.ArchiveFilter.activeFilters.dates,
                    // @TODO this will need to be corrected for format
                    selected_terms : APP.ArchiveFilter.activeFilters.terms,
                    id : APP.ArchiveFilter.postID > 0 ? APP.ArchiveFilter.postID : '',
                }
                // binding selectedTerms & selectedDates to build messages/titles
                $.post( APP.data.SetupTheme.ajaxurl,
                    data,
                    APP.ArchiveFilter._handleEventDatesRequest.bind( null, APP.ArchiveFilter.activeFilters.terms, APP.ArchiveFilter.activeFilters.dates )
                )
                delay = true
            }
        }
        // reset pagination 
        APP.ArchiveFilter.currentPage = 1
        if ( ! delay ) {
            // transition to an updated grid
            APP.ArchiveFilter._filterArchiveGridTransition()
        }
	},
    filteringObject : ( filterQuery, filterTarget ) => {
        const container = filterTarget.parentNode.parentNode
        // Check if query exists in cache
        if ( APP.ArchiveFilter.filterCache[ filterQuery.toLowerCase() ] ) {
            // Use cached labels
            // container.innerHTML = cache[ filterQuery ]
            container.classList.add( 'is--filtered' )
            APP.ArchiveFilter._processLabels( container, filterQuery )
            return
        }
        if ( filterQuery.length ) {
            container.classList.add( 'is--filtering' )
        }
        else {
            container.classList.remove( 'is--filtered' )
            delete filterTarget.dataset.currentSearch
        }
        const matched = APP.ArchiveFilter._processLabels( container, filterQuery )
        // Cancel the last request if pending
        if ( APP.ArchiveFilter.httpLastRequest ) {
            APP.ArchiveFilter.httpLastRequest.abort()
        }
        // Send an AJAX request to fetch more labels
        if ( 'undefined' !== typeof filterTarget.dataset.filterAction ) {
            // Only send the query if it's longer than 3 chars
            if ( filterQuery.length >= 3 ) {
                APP.ArchiveFilter.httpLastRequest = $.post( APP.data.SetupTheme.ajaxurl, {
                    action: filterTarget.dataset.filterAction,
                    query: filterQuery
                }).done( ( response ) => APP.ArchiveFilter._filterStateChangeHandler( response, filterQuery, container, filterTarget ) )
            }
        }
        else if ( filterQuery.length ) {
            container.classList.remove( 'is--filtering')
            container.classList.add( 'is--filtered', 'is--queried' )
            filterTarget.dataset.currentSearch = filterQuery
        }
    },
    _filterRemoteRequest : ( action = '', callbacks = [], options = {}, preFilter = true ) => {
        if ( '' === action  ) {
            action = APP.ArchiveFilter.currentAction
        }
        //  update URL right away
        APP.ArchiveFilter._filterArchiveURLTransition()
        // hide overlay when query is complete
        if ( 'undefined' !== typeof options.overlay && false === options.overlay ) {
            // No overlay
        }
        else {
		   // show that this might take some time
            APP.ArchiveFilter._gridWrapperTransition()
        }
        // Generate the cache key
        options.cacheKey = APP.ArchiveFilter._filterRemoteRequestCacheKey()
        // Check if the requested data is already in the cache
        if ( APP.ArchiveFilter.resultsCache[ options.cacheKey ] ) {
            // Use cached data
            APP.ArchiveFilter._filterRemoteCachedResults( APP.ArchiveFilter.resultsCache[ options.cacheKey ], options )
            return
        }
        // setup data obj for http request by prepending each key from
        // APP.ArchiveFilter.activeFilters with an _ (underscore)
        const data = {
            id : APP.ArchiveFilter.postID > 0 ? APP.ArchiveFilter.postID : '',
            action : action,
            scope : APP.ArchiveFilter.scope,
        }
        // Loop through active filters and add them to the data object
        for ( const [ key, value ] of Object.entries( APP.ArchiveFilter.activeFilters ) ) {
            let processed = value
            switch ( key ) {
                case 's':
                    //continue
                case 'search':
                    if ( ! value || value === '' ) {
                        continue
                    }
                    break
                case 'artist_place':
                case 'collection':
                case 'collection_id':
                case 'classification':
                case 'dates':
                case 'parents':
                case 'terms':
                    if ( ! value || ! value.length ) {
                        continue
                    }
                    break
                case 'has_audio':
                case 'has_video':
                case 'pdf':
                    if ( ! value ) {
                        continue
                    }
                    processed = Number( value )
                    break
                case 'show_previous':
                    if ( value ) {
                        // since show_previous is currently defaulted to true, skip this
                        continue
                    }
                    processed = Number( value )
                    break
                case 'on_view':
                    if ( value ) {
                        continue
                    }
                case 'has_image':
                    if ( value && 'collection' === APP.ArchiveFilter.scope || ( 'site' === APP.ArchiveFilter.scope && ! value ) ) {
                        continue
                    }
                    processed = Number( value )
                    break
                case 'date_created':
                case 'date_acquired':
                    const minYear = key === 'date_created' ? APP.ArchiveFilter.createdStartYear : APP.ArchiveFilter.acquiredStartYear
                    if ( value && value.length ) {
                        if ( value.length === 1 && 
                            ( 
                            value[0] && minYear === Number( value[0] ) ||
                            value[1] && APP.ArchiveFilter.todayISO.getFullYear() === Number( value[1] )
                            ) 
                        ) {
                            continue
                        }
                        else if ( value.length === 2 
                            && value[0] && minYear === Number( value[0] )
                            && value[1] && APP.ArchiveFilter.todayISO.getFullYear() === Number( value[1] ) 
                            ) {
                            continue
                        }
                    }
                    break
            }
            // if process is an array an is empty, continue
            if ( Array.isArray( processed ) && ! processed.length ) {
                continue
            }
            // handle type key separately
            if ( 'type' === key || 's' === key ) {
                data[ key ] = processed
            }
            else if ( 'site' === APP.ArchiveFilter.scope && 'search' === key ) {
                // do nothing
            }
            else {
                // console.log( 'setting data to be sent: ' + key + ':" + value + " processed to ' + typeof processed + ' ' + processed )
                data[`_${key}`] = processed
            }
        }

        // if data has exactly two keys that starts with an _ (underscore) and one key is not `_page` nor `_on_view` then set _on_view to 1
        if ( 'collection' === APP.ArchiveFilter.scope && preFilter && APP.ArchiveFilter._filterSaveBasedOnKeys( data, false ) ) {
            // Set _on_view to 0
            data['_on_view'] = 0
            // Also toggle off the on view element using vanilla JS
            const onview = document.querySelector( 'button[data-switch-type="on_view"]' )
            if ( onview ) {
                // Using the _toggle function disalbe the on view element
                APP.ArchiveFilter._toggle( $( onview ), false, 'toggle', true, true )
                APP.ArchiveFilter._filterArchiveURLTransition()
            }
            // get a new cache key based on changes
            options.cacheKey = APP.ArchiveFilter._filterRemoteRequestCacheKey()
        }
        // Add page number to data object if it's greater than 1
        if ( Number( APP.ArchiveFilter.currentPage ) > 1 ) {
            data._page = Number( APP.ArchiveFilter.currentPage )
        }
        // add ppp if it's not the default (APP.ArchiveFilter.defaultPostsPerPage)
        if ( APP.ArchiveFilter.perPage !== APP.ArchiveFilter.defaultPostsPerPage ) {
            data.ppp = APP.ArchiveFilter.perPage
        }
        // Look for sorting
        if ( 'collection' === APP.ArchiveFilter.scope && '' !== APP.ArchiveFilter.activeSort[0] && 'default__desc' !== APP.ArchiveFilter.activeSort[0] ) {
            data['_sort'] = APP.ArchiveFilter.activeSort[0]
        }
        if ( APP.ArchiveFilter.httpLastRequest ) {
            APP.ArchiveFilter.httpLastRequest.abort()
        }
        APP.ArchiveFilter.httpLastRequest = $.post(
            APP.data.SetupTheme.ajaxurl,
            data, 
            APP.ArchiveFilter._filterSaveResponsepHandler.bind( null, callbacks, options )
        )
        .done( APP.ArchiveFilter._filterSaveResponseDone )
        .fail( APP.ArchiveFilter._filterSaveResponseFail )
        .always( APP.ArchiveFilter._filterSaveResponseAlways )
    },
    // Function to generate a unique cache key based on active filters and page number
    _filterRemoteRequestCacheKey : () => {
        const currentFilters = APP.ArchiveFilter.activeFilters || {}
        // Filter out empty strings and arrays from activeFilters
        const nonEmptyFilters = Object.fromEntries(
            Object.entries( currentFilters ).filter(([_, value]) => {
                if (Array.isArray(value)) return value.length > 0
                if (typeof value === 'string') return value.length > 0
                return true // Keep all other values (booleans, numbers, etc)
            })
        )

        // Convert filters to string and clean up
        const filterString = JSON.stringify(nonEmptyFilters)
            .replace(/-|_|\,|\:|"|\[|\]|\{|\}/g, '')
            .replace(/true/g, '1')
            .replace(/false/g, '0')

        // Current sort (unchanged)
        const sortString = JSON.stringify(APP.ArchiveFilter.activeSort)
            .replace(/-|_|\,|\:|"|\[|\]|\{|\}/g, '')
            .replace(/true/g, '1')
            .replace(/false/g, '0')

        return `page${APP.ArchiveFilter.currentPage}:filters:${filterString}:sort:${sortString}`
    },
    _filterSaveBasedOnKeys( data, considerHasImage = false ) {
        const underscoreKeys = Object.keys(data).filter( key => key.startsWith('_') )
        // Helper function to check if a key is one of the specific keys
        const isSpecificKey = (key, includePage = false) => {
            const specificKeys = [ '_date_acquired', '_date_created' ]
            if ( includePage ) specificKeys.push('_page')
            return specificKeys.includes( key )
        }
        // Check if a key is not _page and optionally not _on_view or _has_image
        const isOtherKey = key => key !== '_page' && ( ! considerHasImage ? key !== '_on_view' : key !== '_on_view' && key !== '_has_image' )
        // Check for the new date conditions
        const isDateConditionMet = underscoreKeys.length === 2 && underscoreKeys.every(key => isSpecificKey(key)) || underscoreKeys.length === 3 && underscoreKeys.every(key => isSpecificKey(key, true))
        // Scenario a) Exactly one key that starts with an underscore, satisfying the isOtherKey condition
        const oneUnderScore = underscoreKeys.length === 1 && isOtherKey( underscoreKeys[0] )
        // Scenario b) Exactly two keys that start with an underscore, one of them is _page and the other satisfies the isOtherKey condition
        const twoUnderScoreKeys = underscoreKeys.length === 2 && underscoreKeys.includes('_page') && underscoreKeys.some( isOtherKey )
        if ( oneUnderScore || twoUnderScoreKeys || isDateConditionMet ) {
            return true
        }
    },
    _filterSaveClickHandler: ( e ) => {
        const target = e.target,
              groupMenu = target.closest( `.${APP.ArchiveFilter.classes.group_menu}` ),
              menuButton = groupMenu.previousElementSibling,
              targetData = target.dataset,
              groupMenuWrapper = groupMenu.querySelector( `.${APP.ArchiveFilter.classes.group_menu_wrapper}` ),
              groupMenuWrapperData = groupMenuWrapper.dataset
    
        // Do nothing if the group menu is not validated
        if ( ! groupMenu.classList.contains(`${APP.ArchiveFilter.classes.group_menu_has_valid}`) ) {
            return
        }
        // Early return if targetData.saveKey is undefined
        if ( ! targetData || 'undefined' === typeof targetData.saveKey ) {
            return
        }
        // Remove the active class from the currently active menu
        const activeButton = document.querySelector( `.${APP.ArchiveFilter.classes.button_active}` )
        if ( activeButton ) {
            APP.ArchiveFilter._toggleFilterGroup( activeButton )
        }
        // Update filter values based on the group menu
        APP.ArchiveFilter._updateActiveFilterValues( groupMenu )
    
        let activeFilters = []
        // Check if queryParam and parentTermid/parentType are present
        if ( groupMenuWrapperData.queryParam ) {
            const queryParam = groupMenuWrapperData.queryParam.substr(1)
            if ( APP.ArchiveFilter.activeFilters[ queryParam ] ) {
                const activeFilterGroup = APP.ArchiveFilter.activeFilters[ queryParam ],
                    subKey = groupMenuWrapperData.parentTermid || groupMenuWrapperData.parentType
                activeFilters = activeFilterGroup
                if ( subKey && activeFilterGroup[ subKey ] ) {
                    activeFilters = activeFilterGroup[ subKey ]
                }
            }
        }
        // Handle toggle switches
        const toggleSwitches = groupMenu.querySelectorAll( '.archive--filter-group-toggle-switch' )
        toggleSwitches.forEach( container => {
            const switchType = container.dataset.switchType
            if ( APP.ArchiveFilter.activeFilters[ switchType ] ) {
                activeFilters.push( switchType )
            }
        } )
        // Handle date range filters
        const dateRangeContainers = groupMenu.querySelectorAll( '.archive--filter-group-date-range-container' )
        dateRangeContainers.forEach( container => {
            const dateRangeKey = `date_${container.dataset.dateRange}`
            activeFilters = APP.ArchiveFilter.activeFilters[ dateRangeKey ] || activeFilters
        })
        const hasActiveFilters = activeFilters.length > 0
        // Toggle filter classes based on active filters
        APP.ArchiveFilter._toggleFilterButtonClasses( menuButton, groupMenu, hasActiveFilters )
        // Reset pagination with the new filter
        APP.ArchiveFilter.currentPage = 1
        APP.ArchiveFilter._filterArchiveGridUpdate( 
            { },
            { 
                'scrollToResults' : undefined, 
                'updateURL' : true, 
                'updateActiveFilterValues' : false 
            }
        )
    },
    _filterSaveResponseAlways() {
    },
    _filterSaveResponseDone() {
    },
    _filterSaveResponseFail() {
        if ( APP.Animate.processingOverlayElement.length && APP.Animate.processingOverlayElement[0].classList.contains( 'overlay--active' ) ) {
            // hide overlay when query is complete
            APP.ArchiveFilter._gridWrapperTransition( false )
        }
    },
    _filterRemoteCachedResults : ( response, options ) => {
        if ( 'undefined' !== typeof options.overlay && false === options.overlay ) {
            // No overlay
        }
        else {
            // hide overlay when query is complete
            APP.ArchiveFilter._gridWrapperTransition( false )
        }
        APP.ArchiveFilter._filterSaveResponseSuccess( response )
        const scrollTo = 'undefined' !== typeof options.scrollTo && options.scrollTo ? options.scrollTo : undefined
        // transition to an updated grid
        APP.ArchiveFilter._filterArchiveGridTransition( scrollTo )
        APP.ArchiveFilter._prepareGridItems()
        APP.ArchiveFilter._imageLowResLoader()
        //APP.MasonryLayout._init()
    },
    /**
	 * [_filterSaveResponsepHandler handles a http request that is returning historical events]
	 * @param  {string} response the response from the server
	 * @param  {string} status   the http status code
	 */
    _filterSaveResponsepHandler : ( callbacks, options, rawResponse, status, jqXHR ) => {
        // parse the response
        try {
            response = JSON.parse( rawResponse )
            // if options has a cache key, add the response to the cache
            if ( 'undefined' !== typeof options.cacheKey ) {
                APP.ArchiveFilter.resultsCache[ options.cacheKey ] = response
            }
        }
        catch ( e ) {
            console.error( 'The response from the server is not valid JSON.' )
            APP.ArchiveFilter._gridWrapperTransition( false )
            return
        }
		// hide overlay when query is complete
        if ( 'undefined' !== typeof options.overlay && false === options.overlay ) {
            // No overlay
        }
        else {
            APP.ArchiveFilter._gridWrapperTransition( false )
        }

		if ( 'success' === status ) {
            APP.ArchiveFilter._filterSaveResponseSuccess( response )
        }
        else {
            console.error( 'non success status', status )
        }

        if ( callbacks.length ) {
            for ( const callback of callbacks ) {
                let parts = callback.split( '.' )
                let callbackFunction = window
                for ( let part of parts ) {
                    callbackFunction = callbackFunction[ part ]
                    if ( ! callbackFunction ) break
                }
                if ( 'function' === typeof callbackFunction ) callbackFunction( response, options )
            }
        }
        let scrollTo
        if ( 'undefined' !== typeof options.scrollTo && options.scrollTo ) {
            scrollTo = options.scrollTo
        }
        // transition to an updated grid
        APP.ArchiveFilter._filterArchiveGridTransition( scrollTo, false, true, true )
        APP.ArchiveFilter._prepareGridItems()
    },
    _filterSaveResponseSuccess : ( response ) => {
        let countDifference = 0
        APP.ArchiveFilter.foundPosts = response.found_posts
        APP.ArchiveFilter.foundQuery = response.found_query
        APP.ArchiveFilter.foundPagination = response.found_pagination
        APP.ArchiveFilter.maxNumPages = response.max_num_pages
        if ( response.promos ) {
            APP.ArchiveFilter.promoBlock = response.promos
        }
        // Should current count always be set to 0?
        APP.ArchiveFilter.currentItemCount = 0
        APP.ArchiveFilter.posts = []
        // Posts found
        if ( response.posts.length ) {
            // update the posts
            APP.ArchiveFilter.posts = [ ...response.posts ]
            APP.ArchiveFilter.currentItemCount = APP.ArchiveFilter.posts.length
            // sort array
            APP.ArchiveFilter.posts.sort( ( a, b ) => a.order - b.order )
            // find the element with class archive--grid-wrapper-grid-no-results and remove it
            const noResults = document.querySelector( '.archive--grid-wrapper-grid-no-results' )
            if ( noResults ) {
                noResults.remove()
            }
        }
          // Find the correct data-count-type for the current search group, and update the value with the found posts
          if ( APP.ArchiveFilter.currentSearchGroup ) {
            // Find the span with data-count-type matching the current search group
            const tabCountSpan = document.querySelector( `.inpagetab-items-item span[data-count-type="${APP.ArchiveFilter.currentSearchGroup}"]` )
            // convert tabCountSpan textContent to a number and compare it to the found posts
            const tabCount = typeof tabCountSpan !== 'undefined' && tabCountSpan ? Number( tabCountSpan.textContent ) : 0
            if ( tabCountSpan && tabCount !== APP.ArchiveFilter.foundPosts ) {
                tabCountSpan.textContent = Number( APP.ArchiveFilter.foundPosts )
                countDifference = APP.ArchiveFilter.foundPosts - tabCount
                // subtract the difference from the total count
                const totalCountSpan = document.querySelector( `.inpagetab-items-item span[data-count-type="all"]` )
                if ( totalCountSpan ) {
                    totalCountSpan.textContent = Number( totalCountSpan.textContent ) + countDifference
                }
            }
            else {
                // Tab count span not found.. Mabye need to add it.
            }
            const headerCountSpan = document.querySelector( `.archive--grid-wrapper-section-header-text span[data-count-type="${APP.ArchiveFilter.currentSearchGroup}"]` )
            if ( headerCountSpan && headerCountSpan.textContent !== APP.ArchiveFilter.foundPosts ) {
                headerCountSpan.textContent = APP.ArchiveFilter.foundPosts
            }
            else {
                // Header count span not found.. Mabye need to add it.
            }
        }
    },
    _filterSearchHandler: (event) => {
        if (event.defaultPrevented) {
            return
        }
    
        const target = event.target
        let wrapper = null,
            container = null,
            input = null,
            control = null,
            searchText = '',
            previousQuery = '',
            handled = false
    
        // Locate the wrapper and container based on the event target
        if (target.classList.contains(`${APP.ArchiveFilter.classes.group_menu_wrapper}`)) {
            wrapper = target
            container = target.querySelector('.archive--filter-group-item-search-wrapper')
        } 
        else {
            wrapper = APP.ArchiveFilter._closestAncestor(target, `.${APP.ArchiveFilter.classes.group_menu_wrapper}`)
            container = APP.ArchiveFilter._closestAncestor(target, '.archive--filter-group-item-search-wrapper')
        }
    
        // Find the input and control elements
        if (container) {
            input = container.querySelector('input[type="text"]')
            control = container.querySelector('i.sficon.sficon-search')
        }
    
        // Retrieve the search text if input exists
        if (input) {
            searchText = input.value.trim()
            previousQuery = input.dataset.currentSearch || ''
        }
    
        const isRemote = container?.classList.contains('is--remote')
        const isQueried = wrapper?.classList.contains('is--queried')
    
        // If clicking the search icon after a search, clear the search
        if (target.tagName === 'I' && isQueried) {
            wrapper.classList.remove('is--filtered', 'is--queried')
            input.value = ''
            input.focus()
            handled = true
        }
        // Prevent searching if the input is empty or contains only spaces
        else if (searchText === '') {
            return
        }
        // Handle live filtering for non-remote searches
        else if (event.type === 'input' && !isRemote) {
            APP.ArchiveFilter._reduceItems(searchText, input, false)
            handled = true
        }
        // Handle remote searches
        else if (isRemote) {
            if (event.key === 'Enter' || (event.type === 'click' && target.tagName === 'I')) {
                handled = true
            }
    
            if (handled) {
                APP.ArchiveFilter._reduceItems(searchText, input, searchText.length > 0)
            } else if (previousQuery && searchText !== previousQuery) {
                wrapper.classList.remove('is--queried')
            }
        }
    
        if (handled) {
            event.preventDefault()
        }
    },
    _filterSortRadioClickHandler : ( e ) => {
        e.preventDefault()
        const $target = $( e.target )
        let $label = $target.parents( '.archive--filter-sort-item' )
        if ( $target.is( 'input' ) ) {
            $label = $target.closest( '.archive--filter-sort-item' )
        }
        else if ( $target.hasClass( 'archive--filter-sort-item' ) || $target.is( 'label' ) ) {
            $label = $target
        }
        // toggle the buttonswitch to active a new sort
        APP.ArchiveFilter._chooseSort( $label )
        // close the sort menu
        const $sortMenu = $label.parents( `.${APP.ArchiveFilter.classes.group_menu}` )
        APP.ArchiveFilter._toggleFilterGroup( $sortMenu.prev( `.${APP.ArchiveFilter.classes.group_button}` ) )
        // reset sort & pagination
        APP.ArchiveFilter.currentPage = 1
        // update grid & grid items. depending on the number of results to sort,
        // this might require a remote request
        if ( APP.ArchiveFilter._remoteRequestRequired() ) {
            // Update all values, or just sort?
            APP.ArchiveFilter.activeSort = APP.ArchiveFilter._findActiveSort(  APP.ArchiveFilter._getActiveSort() )
            // Make a remote request
            APP.ArchiveFilter._filterRemoteRequest()
            return
        }
        // transition to an updated grid
        APP.ArchiveFilter._filterArchiveGridTransition()
    },
    _filterStateChangeHandler : ( response, filterQuery, container, filterTarget  ) => {
        const newLabels = $(APP.ArchiveFilter.httpLastRequest.responseText).filter( 'label' )
        // Loop through each new label and append it only if it doesn't already exist
        newLabels.each( function( index, newLabel ) {
            let newTermId, selectorKey
            if ( newLabel.dataset ) {
                if ( newLabel.dataset.termid ) {
                    newTermId = newLabel.dataset.termid
                    selectorKey = 'data-termid'
                }
                else if ( newLabel.dataset.id ) {
                    newTermId = newLabel.dataset.id
                    selectorKey = 'data-id'
                }
            }
            // Check if a label with the same termid already exists in the container
            if ( ! container.querySelector( `label[${selectorKey}="${newTermId}"]` ) ) {
                // No duplicate found, so append the new label
                const labels = container.querySelectorAll('label'),
                    lastLabel = labels[ labels.length - 1 ]
                if ( lastLabel ) {
                    lastLabel.insertAdjacentHTML( 'afterend', newLabel.outerHTML )
                    APP.ArchiveFilter.filterCache[ filterQuery.toLowerCase() ] = container.innerHTML
                    APP.ArchiveFilter._processLabels( container, filterQuery )
                }
            }
        })
        // re-initialize the event handlers
        APP.ArchiveFilter.$filterGroupItem.off( 'click', APP.ArchiveFilter._filterGroupCheckboxClickHandler )
        APP.ArchiveFilter.$filterGroupItem = $( '.archive--filter-group-item' )
        APP.ArchiveFilter.$filterGroupItem.on( 'click', APP.ArchiveFilter._filterGroupCheckboxClickHandler )
        container.classList.remove( 'is--filtering')
        container.classList.add( 'is--filtered', 'is--queried' )
        filterTarget.dataset.currentSearch = filterQuery
        
    },
    _filterToggleButtonClickHander : ( e ) => {
        let $target = $( e.target ),
            action, value, active
        if ( $target.hasClass( 'archive--filter-suggestions') ) {
            return
        }
        if ( $target.is( 'button' ) && $target.hasClass( APP.ArchiveFilter.classes.toggle_button ) ) {
            $('.archive--filter-suggestion').not( $target.parent() ).removeClass( 'archive--filter-suggestion--has-active' )
            $target.parent().toggleClass ( 'archive--filter-suggestion--has-active'  )
            action = $target[0].dataset.searchType
            value = $target[0].dataset.searchString
            active = $target.parent().hasClass( 'archive--filter-suggestion--has-active' )
        }
        else if ( $target.not( 'button' ) && $target.hasClass( 'archive--filter-suggestion' ) ) {
            if ( $target.length ) {
                $('.archive--filter-suggestion').not( $target ).removeClass( 'archive--filter-suggestion--has-active' )
                // and make the current one active
                $target.toggleClass ('archive--filter-suggestion--has-active' )
                active = $target.hasClass( 'archive--filter-suggestion--has-active' )
            }
            action = $target.find('>button')[0].dataset.searchType
            value = $target.find('>button')[0].dataset.searchString
        }
        // Depending on what kind of action the button defines
        if ( 'artist_geo_live_work' === action ) {
            APP.ArchiveFilter.activeFilters.collection = []
            APP.ArchiveFilter.activeFilters.collection_id = []
            // @TODO clear other suggested filters
            APP.ArchiveFilter._clearDateRanges()
            // set artist_place to value
            if ( active ) {
                APP.ArchiveFilter.activeFilters.artist_place = [ value ]
            }
            else {
                APP.ArchiveFilter.activeFilters.artist_place = []
            }
        }
        else if ( 'collection_id' === action ) {
            APP.ArchiveFilter.activeFilters.collection = []
            APP.ArchiveFilter.activeFilters.artist_place = []
            // @TODO clear other suggested filters
            APP.ArchiveFilter._clearDateRanges()
            // set artist_place to value
            if ( active ) {
                APP.ArchiveFilter.activeFilters.collection_id = [ value ]
            }
            else {
                APP.ArchiveFilter.activeFilters.collection_id = []
            }
        }
        else if ( 'collection_name' === action ) {
            APP.ArchiveFilter.activeFilters.collection_id = []
            APP.ArchiveFilter.activeFilters.artist_place = []
            // @TODO clear other suggested filters
            APP.ArchiveFilter._clearDateRanges()
            // set artist_place to value
            if ( active ) {
                APP.ArchiveFilter.activeFilters.collection = [ value ]
            }
            else {
                APP.ArchiveFilter.activeFilters.collection = []
            }
        }
        else if ( 'new_acquisitions' === action  ) {
            // clear date range filters
            APP.ArchiveFilter._clearDateRanges()
            APP.ArchiveFilter.activeFilters.artist_place = []
            APP.ArchiveFilter.activeFilters.collection = []
            APP.ArchiveFilter.activeFilters.collection_id = []
            // @TODO clear other suggested filters
            // set acquired date start date to value and end date to now    
            if ( active ) {
                let $saveButton
                APP.ArchiveFilter.activeFilters.date_acquired = [ Number( value ), APP.ArchiveFilter.todayISO.getFullYear() ]
                for ( const dateInput of APP.ArchiveFilter.filterArtworkDates ) {
                    if ( 'range-acquire--year-start' === dateInput.id ) {
                        $( dateInput ).val( Number( value ) )
                        $( dateInput ).change()
                        $saveButton = $( dateInput ).parents( '.archive--filter-group-menu--has-valid' ).find( '.archive--filter-group-save-button' )
                    }
                    else if ( 'range-acquire--year-end' === dateInput.id ) {
                        $( dateInput ).val( APP.ArchiveFilter.todayISO.getFullYear() )
                        $( dateInput ).change()
                    }
                }
                $saveButton.click()
                return
            }
            else {
                APP.ArchiveFilter.activeFilters.date_acquired = []
            }
        }
        else if ( 'random' === action ) {
            APP.ArchiveFilter.activeFilters.artist_place = []
            APP.ArchiveFilter.activeFilters.date_acquired = []
            APP.ArchiveFilter.activeFilters.date_created = []
        }        
        APP.ArchiveFilter.currentPage = 1
        // Make a remote request
        APP.ArchiveFilter._filterRemoteRequest()
    },
    _filterToggleClickHander : ( e ) => {
        let $target = $( e.target )

        if ( $target.not( 'button' ) && $target.hasClass( 'archive--filter-group-toggle-switch-wrapper' ) ) {
            $target = $target.parent( '.archive--filter-group-toggle-switch' )
        }
        else if ( $target.not( 'button' ) && $target.hasClass( 'archive--filter-group-toggle' ) ) {
            $target = $target.find('.archive--filter-group-toggle-switch' )
        }
        else if ( $target.not( 'button' ) && $target.hasClass( 'archive--filter-group-toggle-label' ) ) {
            $target = $target.next('.archive--filter-group-toggle-switch' )
        }
        else if ( $target.not( 'button' ) && $target.hasClass( 'input--check-svg' ) ) {
            $target = $target.parents( '.archive--filter-group-toggle-switch' )
        }
        // Find the group menu wrapper of this toggle item
        const $menuWrapper = $target.parents( `.${APP.ArchiveFilter.classes.group_menu_wrapper}` )
        // if toggle is in a dropdown 
        if ( $menuWrapper.length ) {
            // toggle the buttonswitch
            APP.ArchiveFilter._toggle( $target, undefined, true, true  )
        }
        else {
            APP.ArchiveFilter._toggle( $target, undefined, false, false )
            // This toggle isn't in a wrapper, so there isn't a save button to activate
            // the operation.
            APP.ArchiveFilter.currentPage = 1
            // Make a remote request with default params except for the final false which is there to prevent prefiltering
            APP.ArchiveFilter._filterRemoteRequest( APP.ArchiveFilter.currentAction, [], {}, false )
        }
    },
    /**
     * [ _findActiveFilterArtistMaker]
     * @param {bool} el elements
     * @return {array} array of active artist makers
     */
    _findActiveFilterArtistMaker : ( $el ) => {
        return $.makeArray( 
            $el.map( 
                ( index, el ) => {
                    if ( el.parentElement.dataset.parentType 
                        && 'artist' === el.parentElement.dataset.parentType 
                        && ! Number.isNaN( Number( el.dataset.id )  )
                        ) {
                        return  el.dataset.id ? Number( el.dataset.id ) : null
                    }
                    return null
                }
            )
        )
    },
    /**
     * [_findActiveFilterArtworkClassification ]
     * @param {bool} el elements
     * @return {array} array of active classifications
     */
    _findActiveFilterArtworkClassification : ( $el ) => {
        return $.makeArray( 
            $el.map( 
                ( index, el ) => {
                    if ( el.parentElement.dataset.parentType 
                        && 'artwork_classification' === el.parentElement.dataset.parentType 
                        && el.dataset.id !== ''
                        ) {
                        return  el.dataset.id ? el.dataset.id : null
                    }
                    return null
                }
            )
        )
    },
    /**
	 * [_findActiveFilterDates ]
	 * @param {array} datesArray an array of dates
	 * @return {array} array dates
	 */
    _findActiveFilterDates : ( datesArray ) => {
        if ( 'undefined' !== typeof datesArray && datesArray.length ) {
            return datesArray
        }
        return []
    },
    /**
     * [ _findActiveFilterDateAcquired ]
     * @param {bool} el elements
     * @return {array} array of active acquired dates
     */
    _findActiveFilterDateAcquired : ( datesArray ) => {
        if ( 'undefined' !== typeof datesArray && datesArray.length ) {
            return datesArray
        }
        return []
    },
    /**
     * [ findActiveFilterDateCreated ]
     * @param {bool} el elements
     * @return {array} array of active creation dates
     */
    _findActiveFilterDateCreated : ( datesArray ) => {
        if ( 'undefined' !== typeof datesArray && datesArray.length ) {
            return datesArray
        }
        return []
    },
    /**
	 * [_findActiveFilterParents ]
	 * @param {bool} $el jquery object of an element
	 * @return {array} array of post objects
	 */
	_findActiveFilterParents : ( $el ) => {
        return $.makeArray( 
                $el.map(
                    ( index, el ) => $( el ).parent().data( 'parentTermid' )
              )
          ).filter( 
                ( value, index, self ) => self.indexOf( value ) === index 
          )
    },
    /**
	 * [_findActiveFilterTerms ]
	 * @param {bool} $el jquery object of an element
	 * @return {array} array of post objects
	 */
    _findActiveFilterTerms : ( $el ) => {
        let activeTerms = {}
        // loop through all $el and fill activeTerms with the term ids keyed by the parent term id
        $el.each( ( index, el ) => {
            if ( el.parentElement.dataset.parentTermid ) {
                if ( Number( el.dataset.termid ) ) {
                    if ( ! activeTerms[ el.parentElement.dataset.parentTermid ] ) {
                        activeTerms[ el.parentElement.dataset.parentTermid ] = []
                    }
                    activeTerms[ el.parentElement.dataset.parentTermid ].push( Number( el.dataset.termid ) )
                }
            }
        } )
        return activeTerms
    },
    /* [_findActiveSort ]
    * @param {bool} $el jquery object of an element
    * @return {array} array of post objects
    */
    _findActiveSort : ( $el ) => {
        return $.makeArray( 
            $el.map( 
                ( index, el ) => el.dataset.sortid 
          ) 
      )
    },
    /* [_findActiveTerms ]
    * @param {bool} $el jquery object of an element
    * @return {array} array active terms
    */
    _findActiveTerms : ( $el ) => {
        return $.makeArray( 
            $el.map( ( index, el ) => {
                if ( el.parentElement.dataset.parentTermid ) {
                    return  el.dataset.termid
                }
            } )
      )  
    },
    _fixMaxHeight : ( e ) => {
        APP.debugEnabled = true
        const heightChanges = document.getElementsByClassName( 'js--normalize-height' )
        if ( typeof heightChanges !== 'undefined' && heightChanges.length && APP.ArchiveFilter.queues['imageLoad'].length === 0 ) {
            for ( const heightElement of heightChanges ) {
                if ( typeof heightElement.dataset !== 'undefined' &&  heightElement.clientHeight > 0 ) {
                    const container = document.querySelectorAll( heightElement.dataset.compareSelector ),
                          breakpointName = $(window).width() <= 575 ? 'small' : 'medium' // APP.Breakpoint.name is not reliable yet
                    // find the extra amount to grow the span by
                    const offsetMargin = APP.ArchiveFilter.featuredFillerOffets[ breakpointName ].margin
                    const offsetHeight = APP.ArchiveFilter.featuredFillerOffets[ breakpointName ].height
                    // make sure the correct breakpoint values are set
                    for ( const containerElement of container ) {
                        if ( 'undefined' !== typeof containerElement.clientHeight
                            && containerElement.clientHeight > APP.ArchiveFilter.featuredFillerOffet 
                      ) {
                            //if ( 'undefined' !== typeof APP.debugEnabled &&  APP.debugEnabled ) {
            
                            //}
                            APP.ArchiveFilter.featuredFillerOffet = ( containerElement.clientHeight + offsetMargin )
                            APP.ArchiveFilter.featuredFillerOffets[ breakpointName ]['height'] = APP.ArchiveFilter.featuredFillerOffet
                            APP.ArchiveFilter.featuredFillerOffets[ breakpointName ]['margin'] = 0
                        }
                        else if ( offsetHeight > APP.ArchiveFilter.featuredFillerOffet ) {
                            //if ( 'undefined' !== typeof APP.debugEnabled && APP.debugEnabled ) {
                            //}
                            //    APP.ArchiveFilter.featuredFillerOffet = offsetHeight
                            APP.ArchiveFilter.featuredFillerOffet = ( offsetHeight + offsetMargin )
                            APP.ArchiveFilter.featuredFillerOffets[ breakpointName ]['height'] = APP.ArchiveFilter.featuredFillerOffet
                            APP.ArchiveFilter.featuredFillerOffets[ breakpointName ]['margin'] = 0
                        }
                        else if ( 'undefined' !== typeof containerElement.clientHeight ) {
                            //if ( 'undefined' !== typeof APP.debugEnabled && APP.debugEnabled ) {
                            //}
                        }
                        //else if ( 'undefined' !== typeof APP.debugEnabled && APP.debugEnabled ) {
                        //}
                    }
                    $( heightElement ).css( 'max-height', APP.ArchiveFilter.featuredFillerOffet + 'px' )
                }
            }
        }
    },
    _getActiveArtistPlace : () => {
        const activeButton = document.querySelector('.archive--filter-suggestion--has-active button[data-search-type="artist_geo_live_work"]'),
            searchString = activeButton ? activeButton.getAttribute('data-search-string') : null
        if ( searchString )  {
            return [ searchString ]
        }
        else {
            return []
        }
    },
    _getActiveCollectionId : () => {
        const activeButton = document.querySelector('.archive--filter-suggestion--has-active button[data-search-type="collection_id"]'),
            searchString = activeButton ? activeButton.getAttribute('data-search-string') : null
        if ( searchString )  {
            return [ searchString ]
        }
        else {
            return []

        }
    },
    _getActiveCollectionName : () => {
        const activeButton = document.querySelector('.archive--filter-suggestion--has-active button[data-search-type="collection_name"]'),
            searchString = activeButton ? activeButton.getAttribute('data-search-string') : null
        if ( searchString )  {
            return [ searchString ]
        }
        else {
            return []
        }
    },
    _getActiveDates : () => {
        if ( typeof APP.ArchiveFilter.datePicker !== 'undefined' 
        && $('input.datepicker--value').hasClass( APP.ArchiveFilter.classes.item_active ) ) {
            return APP.ArchiveFilter.datePicker.selectedDates.map( ( value, index ) => {
                    // add to selected dates
                    const date = new Date( value )
                    const [withoutTime] = date.toISOString().split('T')
                    APP.ArchiveFilter.activeFilters.dates.push( withoutTime )
                    return withoutTime
            } )
        }
        else {
            return []
        }
    },
    _getActiveDateAcquired : () => {
        let foundDates = []
        const items = document.querySelectorAll('.archive--filter-group-menu--has-valid .range--input-text, .archive--filter-group-menu--has-active .range--input-text')    
        items.forEach((el) => {
            if (el.id === 'range-acquire--year-start' && el.value.trim() !== '' ) {
                foundDates[0] = Number(el.value)
            } 
            else if (el.id === 'range-acquire--year-end' && el.value.trim() !== '') {
                foundDates[1] = Number(el.value)
            }
        })
            return foundDates.length ? foundDates : []
    },
    _getActiveDateCreated : () => {
        let foundDates = []
        const $items = $('.archive--filter-group-menu--has-valid , .archive--filter-group-menu--has-active').find( '.range--input-text')
        $items.each( ( index, el ) => {
            if ( 'range--year-start' === el.id && el.value.trim() !== '' ) {
                foundDates[0] = Number( el.value )
            }
            else if ( 'range--year-end' === el.id && el.value.trim() !== '' ) {
                foundDates[1] = Number( el.value )
            }
        } )
        if ( foundDates.length )  {
            return foundDates
        }
        else {
            return []
        }
    },
    _getActiveFilterButtons : () => {
        let $active = $( `.${APP.ArchiveFilter.classes.item_active}` ),
            $defaultActive = $( `.${APP.ArchiveFilter.classes.default_active}` ),
            $all
        // remove $defaultActive from $active
        $all = $active.not( $defaultActive )
        // add $defaultActive to $active, but only if they do not have the active class
        $defaultActive.not( `.${APP.ArchiveFilter.classes.item_active}` ).each( ( index, el ) => {
            if ( ! $( el ).hasClass( APP.ArchiveFilter.classes.item_active ) ) {
                $all.push( el )
            }
        } )
        return $all
    },
    _getActiveFilterSearches : () => {
        // find all inputs with a filter search class that have a value
        const activeFilterSearches = []
        for ( const input of document.querySelectorAll( `input.${APP.ArchiveFilter.classes.filter_search}`) ) {
            if ( input.value ) {
                const $groupMenu = $( input ).parents( `.${APP.ArchiveFilter.classes.group_menu }` )
                activeFilterSearches.push( $groupMenu[0] )
            }
        }
        return activeFilterSearches
    },
    _getActiveHasAudio : () => {
        if ( document.querySelector( `button.${APP.ArchiveFilter.classes.item_active}[data-switch-type="has_audio"]` ) ) {
            return 1
        }
        else {
            return 0
        }
    },
    _getActiveHasImage : () => {
        if ( document.querySelector( `button.${APP.ArchiveFilter.classes.item_active}[data-switch-type="has_image"]` ) ) {
            return 1
        }
        else if ( document.querySelector( `button[data-switch-type="has_image"]` ) ) {
            return 0
        }
        else {
            return 1
        }
    },
    _getActiveHasVideo : () => {
        if ( document.querySelector( `button.${APP.ArchiveFilter.classes.item_active}[data-switch-type="has_video"]` ) ) {
            return 1
        }
        else {
            return 0
        }
    },
    _getActiveOnView : () => {
        if ( document.querySelector( `button.${APP.ArchiveFilter.classes.item_active}[data-switch-type="on_view"]` ) ) {
            return 1
        }
        else if ( document.querySelector( `button[data-switch-type="on_view"]` ) ) {
            return 0
        }
        else {
           return 1
        }
    },
    _getActiveSearch: () => {
        const element = document.querySelector( 'input.inpagetab-items-search' )
        if ( element ) {
            return element.value
        }
        else {
           return ''
        }
    },
    _getActiveShowPrevious : () => {
        if ( document.querySelector( `button.${APP.ArchiveFilter.classes.item_active}[data-switch-type="show_previous"]` ) ) {
            return 1
        }
        else if ( document.querySelector( `button[data-switch-type="show_previous"]` ) ) {
            return 0
        }
        else {
            return 1
        }
    },
    _getActiveSuggested : () => {
        return $( `.${APP.ArchiveFilter.classes.suggested_active}` )
    },
    _getArtistPlaceMessage : ( artistPlace ) => {
        return `Works by ${ artistPlace.charAt(0).toUpperCase() + artistPlace.slice(1) } artists`
    },
    _getDatePickerConfig : ( defaultDates ) => {
        const datePickerConfig = {
            // set language to english
            language : 'en',
            locale: APP.ArchiveFilter.local.en,
            format : 'yyyy-mm-dd',
            // allow date range
            range : true,
            dynamicRange : true,
            multipleDatesSeparator : ' - ',
            inline : true,
            // prevent toggling same-day on range
            toggleSelected : true,
            // remove comma from the title
            navTitles : {
                days: 'MMMM yyyy',
            },
            onRenderCell : APP.ArchiveFilter._onRenderDayCell,
            onSelect : APP.ArchiveFilter._onSelectDatepicker,
            // onChangeMonth : ( month, year ) => {},
            // onChangeView : ( currentView ) => {},
            // onChangeViewDate  : ( { month, year, decade } ) => {},
        }
        if ( 'undefined' !== typeof defaultDates && defaultDates.length ) {
            datePickerConfig.selectedDates = defaultDates
        }
        return datePickerConfig
    },
    _getActiveSort : () => {
        return $( '.archive--filter-sort-item--active' )
    },
    /**
	 * [_getPostsFromActiveFilters returns an array of post objects that have a term in the active term array]
	 * @param {bool} limit return only the first 20 if true
	 * @return {array} array of post objects
	 */
	_getPostsFromActiveFilters : function( limit ) {
		// set default
		if ( typeof limit == 'undefined' ) {
			limit = false
		}
		// init return array
		let tempArray = []
        // clone the active parents
        let activeParents = APP.ArchiveFilter.activeFilters.parents ? [ ...APP.ArchiveFilter.activeFilters.parents ] : []
        let parent = activeParents.pop()
        // loop through all the posts
        for ( const index in APP.ArchiveFilter.posts ) {
            const post = APP.ArchiveFilter.posts[ index ]
            if ( ! APP.ArchiveFilter._passesPdfFilter( post ) ) continue
            if ( 'undefined' !== typeof APP.ArchiveFilter.activeFilters.dates && APP.ArchiveFilter.activeFilters.dates.length ) {
                if ( ! APP.ArchiveFilter._passesDateFilter( post ) ) continue
                // date filter gate passed 
                if ( APP.ArchiveFilter.activeFilters.parents.length === 0 
                    || Object.keys( APP.ArchiveFilter.activeFilters.terms ).length === 0 ) {
                    // return all the posts
                    tempArray.push( post )
                    continue
                }
            }
            else if ( APP.ArchiveFilter.activeFilters.parents && APP.ArchiveFilter.activeFilters.parents.length === 0 || APP.ArchiveFilter.activeFilters.terms && Object.keys( APP.ArchiveFilter.activeFilters.terms ).length === 0 ) {
                // return all the posts
                tempArray.push( post )
                continue
            }
            else if ( 'site' === APP.ArchiveFilter.scope ) {
                // return all the posts
                tempArray.push( post )
                continue
            }
            // Check that for each term group, at least one term is in the active filter.
            const allGroupsPass = APP.ArchiveFilter.activeFilters.terms ?  Object.keys( APP.ArchiveFilter.activeFilters.terms ).every( parentID => {
                if (typeof post.term_groups[ parentID ] !== 'undefined' && post.term_groups[ parentID ].length ) {
                    const termsToFilter = post.term_groups[ parentID ]
                    const activeFilterTerms = APP.ArchiveFilter.activeFilters.terms[parentID] || []
                    return termsToFilter.some( value => activeFilterTerms.includes( value ) )
                }
                return false
            }) : false
            // If all term groups pass, add the post to the array.
            if ( allGroupsPass ) {
                tempArray.push( post )
            }
        }
        // Sort the posts
        tempArray = APP.ArchiveFilter._sortPosts( tempArray )
        // update the results & title counts, current item count & total pages
        const resultsString = tempArray.length == 0 || tempArray.length > 1 ? 'Results' : 'Result',
        resultCount = 'remote' === APP.ArchiveFilter.queryTransferMode ? APP.ArchiveFilter.foundPosts : tempArray.length
        // result filter values
        resultsFilters = APP.ArchiveFilter.activeFilters.terms ? Object.values( APP.ArchiveFilter.activeFilters.terms ).flat() : []
        // create a title count string
        titleCount = `${resultCount} ${resultsString} Found<span style="display:none;"class="active-terms">Selected Filters: ${ resultsFilters.join(',') }</span>`
        // Set the values to appear in the DOM
        APP.ArchiveFilter.$titleCount.html( titleCount )
        // If only filter applied is _artist_place then clear any existing text from .archive--grid-wrapper-results div and then add the message
        if ( APP.ArchiveFilter.activeFilters && APP.ArchiveFilter.activeFilters.artist_place && APP.ArchiveFilter.activeFilters.artist_place.length ) {
            $( `.${APP.ArchiveFilter.classes.results_message}`).html( APP.ArchiveFilter._getArtistPlaceMessage( APP.ArchiveFilter.activeFilters.artist_place[0] ) )
        }
        else {
            $( `.${APP.ArchiveFilter.classes.results_message}`).html( '' )
        }
        // find the current count of items in the current page of results set
        APP.ArchiveFilter.currentItemCount = 'remote' === APP.ArchiveFilter.queryTransferMode ? APP.ArchiveFilter.foundPosts : tempArray.length // + currentItemCount
        // Now find the total pages
        APP.ArchiveFilter.totalPage = Math.ceil( APP.ArchiveFilter.currentItemCount / APP.ArchiveFilter.perPage )
        // do we have a limit?
        if ( limit && tempArray.length > limit ) {
            // only show the first x results
            let startSlice = ( Number( APP.ArchiveFilter.currentPage ) - 1 ) * APP.ArchiveFilter.perPage
            let limitArray = []
            limitArray = tempArray.map( a => ( {...a} ) ).slice( startSlice, startSlice + limit )
            if ( limitArray.length < 1 ) {
                // find a page number that works, and then update APP.ArchiveFilter.currentPage and url if necessary
                for ( let testStart = Number( APP.ArchiveFilter.currentPage ) - 1; testStart > 0; testStart-- ) {
                    startSlice = ( testStart - 1 ) * APP.ArchiveFilter.perPage
                    limitArray = tempArray.map( a => ( {...a} )).slice( startSlice, startSlice + limit )
                    if ( limitArray.length ) {
                        tempArray = limitArray
                        // replace state of current page in url if this works.
                        APP.ArchiveFilter.currentPage = testStart
                        APP.ArchiveFilter.totalPage = testStart
                        APP.ArchiveFilter.currentItemCount = tempArray.length
                        const transition = APP.ArchiveFilter._getTransition()
                        history.replaceState( transition, null, transition.url )
                        break
                    }
                }
            }
            else {
                tempArray = limitArray
            }
        }
        // return the array
        return tempArray
    },
    _getTransition : ( transition = {} ) => {
        let searchParams = {},
            href = window.location.href,
            hashIndex = href.indexOf( '#' ),
            fragment = '',
            newURL = ''

        const thisYear = APP.ArchiveFilter.todayISO.getFullYear()

        if ( hashIndex !== -1 ) {
            newURL = href.substring( 0, hashIndex )
            fragment = href.substring( hashIndex + 1 )
            // Check for '?' within the fragment and truncate it if it exists
            let questionIndex = fragment.indexOf( '?' )
            if ( questionIndex !== -1 ) {
                fragment = fragment.substring( 0, questionIndex )
            }
        }
        else {
            newURL = href
        }
        if ( typeof window.location.search !== 'undefined' &&  window.location.search.length ) {
            searchParams = new URLSearchParams( window.location.search.substring( 1 ) )
            for ( const [ key, value ] of searchParams.entries() ) {
                searchParams[ key ] = APP.ArchiveFilter._decodeURL( value )
             }
            newURL = newURL.split('?')[0]
        }
        else {
            newURL = newURL
        }
        if ( typeof transition.query === 'undefined' ) {
            transition.query = {}
        }
        // Page number
        if ( typeof transition.query.page === 'undefined' && APP.ArchiveFilter._hasPaginationApplied() ) {
            transition.query.page = APP.ArchiveFilter.currentPage
        }
        // Title
        if ( typeof transition.title === 'undefined' ) {
            transition.title = document.title
        }
        if ( 'site' === APP.ArchiveFilter.scope ) {
            // Search Site
            if ( typeof transition.query.s === 'undefined' && APP.ArchiveFilter.queryKeys.s ) {
                const searchSite = APP.ArchiveFilter.activeFilters.s ? APP.ArchiveFilter.activeFilters.s : ''
                if ( searchSite !== '' ) {
                    transition.query.s = searchSite
                }
            }
            // Search Type
            if ( typeof transition.query.type === 'undefined' &&  APP.ArchiveFilter.queryKeys.type ) {
                const searchType = APP.ArchiveFilter.activeFilters.type ? APP.ArchiveFilter.activeFilters.type : ''
                if ( searchType !== '' ) {
                    transition.query.type = searchType
                }
            }
            if ( typeof transition.query.has_image === 'undefined' 
                && ( 'artwork' === APP.ArchiveFilter.currentSearchGroup || 'artist' === APP.ArchiveFilter.currentSearchGroup )
                && APP.ArchiveFilter.activeFilters.has_image 
                && APP.ArchiveFilter.queryKeys.has_image ) {
                transition.query.has_image = 1
            }
            // show_previous (events)
            if ( 'events' === APP.ArchiveFilter.currentSearchGroup && APP.ArchiveFilter.queryKeys.show_previous
                && ! APP.ArchiveFilter.activeFilters.show_previous
                && typeof transition.query.show_previous === 'undefined' ) {
                transition.query.show_previous = APP.ArchiveFilter.activeFilters.show_previous ? 1 : '0'
            }
            else if ( 'exhibition'=== APP.ArchiveFilter.currentSearchGroup && APP.ArchiveFilter.queryKeys.show_previous
                && ! APP.ArchiveFilter.activeFilters.show_previous
                && typeof transition.query.show_previous === 'undefined' ) {
                transition.query.show_previous = APP.ArchiveFilter.activeFilters.show_previous ? 1 : '0'
            }
        }
        else if ( 'collection' === APP.ArchiveFilter.scope ) {
            // Search Collction
            if ( typeof transition.query.search === 'undefined' && APP.ArchiveFilter.queryKeys.search ) {
                const search = APP.ArchiveFilter.activeFilters.search ? APP.ArchiveFilter.activeFilters.search : ''
                if ( search !== '' ) {
                    transition.query.search = search
                }
            }
            // Sorting
            if ( typeof transition.sort === 'undefined' && APP.ArchiveFilter.queryKeys.sort ) {
                if ( '' !== APP.ArchiveFilter.activeSort[0] && 'default__desc' !== APP.ArchiveFilter.activeSort[0] ) {
                    transition.sort = APP.ArchiveFilter.activeSort[0]
                }
            }
            // On view (artworks)
            if ( typeof transition.query.on_view === 'undefined' && ! APP.ArchiveFilter.activeFilters.on_view && APP.ArchiveFilter.queryKeys.on_view ) {
                transition.query.on_view = 0
            }
            // Has image (artworks). This works different depending on the scope
            if ( typeof transition.query.has_image === 'undefined' 
                && ! APP.ArchiveFilter.activeFilters.has_image 
                && APP.ArchiveFilter.queryKeys.has_image ) {
                transition.query.has_image = 0 
            }
            // Has Audio (artworks)
            if ( typeof transition.query.has_audio === 'undefined' && APP.ArchiveFilter.activeFilters.has_audio && APP.ArchiveFilter.queryKeys.has_audio ) {
                transition.query.has_audio = 1
            }
            // Has Video (artworks)
            if ( typeof transition.query.has_video === 'undefined' && APP.ArchiveFilter.activeFilters.has_video && APP.ArchiveFilter.queryKeys.has_video ) {
                transition.query.has_video = 1
            }
            // artist maker (artworks)
            if ( typeof transition.query.artist_maker === 'undefined' && APP.ArchiveFilter.queryKeys.artist_maker  && APP.ArchiveFilter.activeFilters.artist_maker ) {
                let activeArtists = APP.ArchiveFilter.activeFilters.artist_maker.length > 0 && ! Number.isNaN( APP.ArchiveFilter.activeFilters.artist_maker[0] ) ? APP.ArchiveFilter.activeFilters.artist_maker : []
                if ( activeArtists.length ) {
                    transition.query.artist_maker = activeArtists.join(',')
                }
            }
            // artist place (artworks)
            if ( typeof transition.query.artist_place === 'undefined' && APP.ArchiveFilter.queryKeys.artist_place && APP.ArchiveFilter.activeFilters.artist_place ) {
                let activeArtistPlaces = APP.ArchiveFilter.activeFilters.artist_place.length > 0 && APP.ArchiveFilter.activeFilters.artist_place[0] ? APP.ArchiveFilter.activeFilters.artist_place : []
                if ( activeArtistPlaces.length ) {
                    transition.query.artist_place = activeArtistPlaces.join(',')
                }
            }
            // collection (artworks)
            if ( typeof transition.query.collection === 'undefined' && APP.ArchiveFilter.queryKeys.collection && APP.ArchiveFilter.activeFilters.collection ) {
                let activeCollections = APP.ArchiveFilter.activeFilters.collection.length > 0 && APP.ArchiveFilter.activeFilters.collection[0] ? APP.ArchiveFilter.activeFilters.collection : []
                if ( activeCollections.length ) {
                    transition.query.collection = activeCollections.join(',')
                }
            }
            // collection_id (artworks)
            if ( typeof transition.query.collection_id === 'undefined' && APP.ArchiveFilter.queryKeys.collection_id && APP.ArchiveFilter.activeFilters.collection_id ) {
                let activeCollectionIds = APP.ArchiveFilter.activeFilters.collection_id.length > 0 && APP.ArchiveFilter.activeFilters.collection_id[0] ? APP.ArchiveFilter.activeFilters.collection_id : []
                if ( activeCollectionIds.length ) {
                    transition.query.collection_id = activeCollectionIds.join(',')
                }
            }
            // classification (artworks)
            if ( typeof transition.query.classification === 'undefined' && APP.ArchiveFilter.queryKeys.classification && APP.ArchiveFilter.activeFilters.classification ) {
                let activeClassifications = APP.ArchiveFilter.activeFilters.classification.length > 0 && APP.ArchiveFilter.activeFilters.classification[0] ? APP.ArchiveFilter.activeFilters.classification : []
                if ( activeClassifications.length ) {
                    transition.query.classification = activeClassifications.join(',')
                }
            }
            // created date (artworks)
            if ( 'undefined' === typeof transition.date_created 
                //&& $('input.datepicker--value').hasClass( APP.ArchiveFilter.classes.item_active )
                && 'undefined' !== typeof APP.ArchiveFilter.activeFilters.date_created 
                && APP.ArchiveFilter.activeFilters.date_created.length && APP.ArchiveFilter.queryKeys.date_created ) {
                    // get filter date range
                    let activeCreationDates
                    if ( 2 === APP.ArchiveFilter.activeFilters.date_created.length 
                        && ( 
                            APP.ArchiveFilter.createdStartYear !== APP.ArchiveFilter.activeFilters.date_created[0]
                            || thisYear !== APP.ArchiveFilter.activeFilters.date_created[1] )
                        ) {
                        activeCreationDates = `${APP.ArchiveFilter.activeFilters.date_created[0]}-${APP.ArchiveFilter.activeFilters.date_created[1]}` 
                    }
                    else if ( 1 === APP.ArchiveFilter.activeFilters.date_created.length 
                        && 'undefined' === typeof APP.ArchiveFilter.activeFilters.date_created[1] 
                        && APP.ArchiveFilter.activeFilters.date_created[0] !== APP.ArchiveFilter.createdStartYear ) {
                        activeCreationDates = `${APP.ArchiveFilter.activeFilters.date_created[0]}-${thisYear}`
                    }
                    else if ( 1 === APP.ArchiveFilter.activeFilters.date_created.length 
                        && 'undefined' === typeof APP.ArchiveFilter.activeFilters.date_created[0] 
                        && APP.ArchiveFilter.activeFilters.date_created[1] !== thisYear ) {
                        activeCreationDates = `${APP.ArchiveFilter.createdStartYear}-${APP.ArchiveFilter.activeFilters.date_created[1]}` 
                    }
                    transition.date_created = activeCreationDates
            }
            // acquired date (artworks)
            if ( 'undefined' === typeof transition.date_acquired 
                //&& $('input.datepicker--value').hasClass( APP.ArchiveFilter.classes.item_active )
                && 'undefined' !== typeof APP.ArchiveFilter.activeFilters.date_acquired 
                && APP.ArchiveFilter.activeFilters.date_acquired.length && APP.ArchiveFilter.queryKeys.date_acquired ) {
                let activeAcquiredDates
                if ( 2 === APP.ArchiveFilter.activeFilters.date_acquired.length 
                    && ( 
                        APP.ArchiveFilter.acquiredStartYear !== APP.ArchiveFilter.activeFilters.date_acquired[0]
                        || thisYear !== APP.ArchiveFilter.activeFilters.date_acquired[1] )
                    ) {
                        activeAcquiredDates = `${APP.ArchiveFilter.activeFilters.date_acquired[0]}-${APP.ArchiveFilter.activeFilters.date_acquired[1]}`
                }
                else if ( 1 === APP.ArchiveFilter.activeFilters.date_acquired.length 
                    && 'undefined' === typeof APP.ArchiveFilter.activeFilters.date_acquired[1] 
                    && APP.ArchiveFilter.activeFilters.date_acquired[0] !== APP.ArchiveFilter.acquiredStartYear ) {
                        activeAcquiredDates = `${APP.ArchiveFilter.activeFilters.date_acquired[0]}-${thisYear}`
                }
                else if ( 1 === APP.ArchiveFilter.activeFilters.date_acquired.length 
                    && 'undefined' === typeof APP.ArchiveFilter.activeFilters.date_acquired[0] 
                    && APP.ArchiveFilter.activeFilters.date_acquired[1] !== thisYear ) {
                        activeAcquiredDates = `${APP.ArchiveFilter.acquiredStartYear}-${APP.ArchiveFilter.activeFilters.date_acquired[1]}` 
                }
                transition.date_acquired = activeAcquiredDates
            }
        }
        else if ( 'archive' === APP.ArchiveFilter.scope ) {
            // Terms
            if ( typeof transition.query.terms === 'undefined' && APP.ArchiveFilter.queryKeys.terms && APP.ArchiveFilter.activeFilters.terms) {
                if ( Object.keys( APP.ArchiveFilter.activeFilters.terms ).length !== 0 ) {
                    transition.query.terms = APP.ArchiveFilter.activeFilters.terms
                }
            }
            // PDF (multiple)
            if ( typeof transition.query.pdf === 'undefined' && APP.ArchiveFilter.activeFilters.pdf && APP.ArchiveFilter.queryKeys.pdf ) {
                transition.query.pdf = APP.ArchiveFilter.activeFilters.pdf ? 1 : 0
            }
            // date range (events)
            if ( 'undefined' === typeof transition.daterange 
                && $('input.datepicker--value').hasClass( APP.ArchiveFilter.classes.item_active )
                && 'undefined' !== typeof APP.ArchiveFilter.activeFilters.dates 
                && APP.ArchiveFilter.activeFilters.dates.length && APP.ArchiveFilter.queryKeys.daterange ) {
                // get filter date range
                let activeDates = APP.ArchiveFilter.activeFilters.dates.length > 0 ? `${APP.ArchiveFilter.activeFilters.dates[0]}-${APP.ArchiveFilter.activeFilters.dates[1]}` : ''
                transition.daterange = activeDates
            }
        }
        if ( typeof transition.url === 'undefined' ) {
            transition.url = newURL
            let newQuery = ''
            // search query
            if ( typeof transition.query.search !== 'undefined' && transition.query.search ) {
                newQuery += `&${APP.ArchiveFilter.queryKeys.search}=${transition.query.search}`
            }
            else if ( typeof transition.query.s !== 'undefined' && transition.query.s ) {
                newQuery += `&${APP.ArchiveFilter.queryKeys.s}=${transition.query.s}`
            }
            // search type
            if ( typeof transition.query.type !== 'undefined' && transition.query.type ) {
                newQuery += `&${APP.ArchiveFilter.queryKeys.type}=${transition.query.type}`
            }
            // add any queried terms
            if ( typeof transition.query.terms !== 'undefined' && Object.keys( transition.query.terms ).length ) {
                const termQueryString =  `&${Object.entries( transition.query.terms )
                    .map(( [ key, values ] ) => `${APP.ArchiveFilter.queryKeys.terms}[${key}]=${ values.join( ',' ) }` )
                    .join('&')}`
                newQuery += termQueryString.startsWith( '&' ) ? `&${termQueryString.slice( 1 )}` : `&${termQueryString}`
            }
            // add the download pdf filter
            if ( typeof transition.query.pdf !== 'undefined' && transition.query.pdf ) {
                newQuery += `&${APP.ArchiveFilter.queryKeys.pdf}=${transition.query.pdf}`
            }
            // add daterange if exposed
            if ( typeof transition.daterange !== 'undefined' ) {
                newQuery += `&${APP.ArchiveFilter.queryKeys.daterange}=${transition.daterange}`
            }
            // add aquired daterange if exposed
            if ( typeof transition.date_acquired !== 'undefined' && transition.date_acquired ) {
                newQuery += `&${APP.ArchiveFilter.queryKeys.date_acquired}=${transition.date_acquired}`
            }
            // add date_created if exposed
            if ( typeof transition.date_created !== 'undefined' && transition.date_created ) {
                newQuery += `&${APP.ArchiveFilter.queryKeys.date_created}=${transition.date_created}`
            }
            // show previous
            if ( typeof transition.query.show_previous !== 'undefined' ) {
                newQuery += `&${APP.ArchiveFilter.queryKeys.show_previous}=${transition.query.show_previous}`
            }
            // add the on view filter
            if ( typeof transition.query.on_view !== 'undefined' ) {
                newQuery += `&${APP.ArchiveFilter.queryKeys.on_view}=${transition.query.on_view}`
            }
            // add the has audio filter
            if ( typeof transition.query.has_audio !== 'undefined' ) {
                newQuery += `&${APP.ArchiveFilter.queryKeys.has_audio}=${transition.query.has_audio}`
            }
            // add the has image filter
            if ( typeof transition.query.has_image !== 'undefined' ) {
                newQuery += `&${APP.ArchiveFilter.queryKeys.has_image}=${transition.query.has_image}`
            }
            // add the has video filter
            if ( typeof transition.query.has_video !== 'undefined' ) {
                newQuery += `&${APP.ArchiveFilter.queryKeys.has_video}=${transition.query.has_video}`
            }
            // artist_maker
            if ( typeof transition.query.artist_maker !== 'undefined' ) {
                newQuery += `&${APP.ArchiveFilter.queryKeys.artist_maker}=${transition.query.artist_maker}`
            }
            // artist_place
            if ( typeof transition.query.artist_place !== 'undefined' ) {
                newQuery += `&${APP.ArchiveFilter.queryKeys.artist_place}=${transition.query.artist_place}`
            }
            // _collection
            if ( typeof transition.query.collection !== 'undefined' ) {
                newQuery += `&${APP.ArchiveFilter.queryKeys.collection}=${transition.query.collection}`
            }
            // _collection_id
            if ( typeof transition.query.collection_id !== 'undefined' ) {
                newQuery += `&${APP.ArchiveFilter.queryKeys.collection_id}=${transition.query.collection_id}`
            }
            // _classification
            if ( typeof transition.query.classification !== 'undefined' ) {
                newQuery += `&${APP.ArchiveFilter.queryKeys.classification}=${transition.query.classification}`
            }
            // add sort if exposed
            if ( typeof transition.sort !== 'undefined' ) {
                newQuery += `&${APP.ArchiveFilter.queryKeys.sort}=${transition.sort}`
            }
            // other query parameters needed for wp
            if ( typeof searchParams.page_id !== 'undefined' ) {
                newQuery += `&page_id=${Number(searchParams.page_id)}`
            }
            if ( typeof searchParams.preview !== 'undefined' ) {
                newQuery += `&preview=${searchParams.preview}`
            }
            if ( typeof searchParams.preview_id !== 'undefined' ) {
                newQuery += `&preview_id=${Number(searchParams.preview_id)}`
            }
            if ( typeof searchParams.preview_nonce !== 'undefined' ) {
                newQuery += `&preview_nonce=${searchParams.preview_nonce}`
            }
            if ( typeof searchParams._thumbnail_id !== 'undefined' ) {
                newQuery += `&_thumbnail_id=${Number(searchParams._thumbnail_id)}`
            }
            // add the posts per page and a couple other parameters
            if ( typeof searchParams.ppp !== 'undefined' ) {
                newQuery += `&ppp=${searchParams.ppp}`
            }
            if ( typeof searchParams.fc !== 'undefined' ) {
                newQuery += `&fc=${searchParams.fc}`
            }
            if ( typeof searchParams.generate !== 'undefined' ) {
                newQuery += `&generate=${searchParams.generate}`
            }
            if ( typeof transition.query.page !== 'undefined' ) {
                newQuery += `&${APP.ArchiveFilter.queryKeys.page}=${transition.query.page}`
            }
            if ( newQuery.length ) {
                APP.ArchiveFilter.currentQueryString = newQuery.substring( 1 )
                transition.url += `?${ APP.ArchiveFilter.currentQueryString.toString() }`
            }
            if ( fragment ) {
                transition.url += `#${fragment}` 
            }
        }
        if ( 'undefined' !== typeof APP.debugEnabled && APP.debugEnabled ) {

        }
        return transition
    },
    /**
	 * [_handleEventDatesRequest handles a http request that is returning historical events]
	 * @param  {string} response the response from the server
	 * @param  {string} status   the http status code
	 */
	_handleEventDatesRequest : ( selectedTerms, selectedDates, response, status, jqXHR ) => {
        // parse the response
        response = JSON.parse( response )
		// hide overlay when query is complete
        APP.Animate._hideProcessingOverlay()
		if ( 'success' === status && response.events.length ) {
            // if success offset the window to focus on the event results
            // if ( $('#results-grid').length ) {
            //     $(window).scrollTop($('#results-grid').offset().top-140 )
            // }
            // got some dates?
            if ( selectedDates.length != 0 ) {
                // date range?
                if ( selectedDates.length > 1 ) {
                    // APP.ArchiveFilter.posts = APP.ArchiveFilter.posts.splice( 0, 2 )
                    // APP.ArchiveFilter.posts.splice( 2, 0, ...response.events )
                    APP.ArchiveFilter.posts = [ ...response.events ]
                    // sort array
                    APP.ArchiveFilter.posts.sort( ( a, b ) => a.order - b.order )
                    // reset count for pagination
                    APP.ArchiveFilter.currentItemCount = APP.ArchiveFilter.posts.length
                }
                // single date?
                else {
                
                }
            }
        }
        // reset pagination aand transition to an updated grid
        APP.ArchiveFilter.currentPage = 1
        APP.ArchiveFilter._filterArchiveGridTransition()
    },
    _gridWrapperTransition : ( add = true ) => {
        const wrapper = document.querySelector( `.${APP.ArchiveFilter.classes.grid_wrapper}` )
        if ( add ) {
            wrapper.classList.add( 'is--transitioning' )
            APP.Animate._showProcessingOverlay()
            window.scrollTo( {
                top: APP.ArchiveFilter.scrollToOffet,
                left: 0,
                behavior: "smooth",
              }  )
        }
        else {
            wrapper.classList.remove( 'is--transitioning' )
            APP.Animate._hideProcessingOverlay()
        }
    },
    _hasFilterApplied : ( ) => {
        if ( APP.ArchiveFilter._getActiveFilterButtons().length > 0 
            || Number( APP.ArchiveFilter.activeFilters.pdf ) === 1 
            || Number( APP.ArchiveFilter.activeFilters.on_view ) === 0
            || ( 'collection' === APP.ArchiveFilter.scope ? Number( APP.ArchiveFilter.activeFilters.has_image ) === 0 : Number( APP.ArchiveFilter.activeFilters.has_image ) === 1 )
            || Number( APP.ArchiveFilter.activeFilters.has_audio ) === 1 
            || Number( APP.ArchiveFilter.activeFilters.show_previous ) === 0 
            || Number( APP.ArchiveFilter.activeFilters.has_video ) === 1 
            || ( APP.ArchiveFilter.activeFilters.artist_maker && APP.ArchiveFilter.activeFilters.artist_maker.length )
            || ( APP.ArchiveFilter.activeFilters.artist_place && APP.ArchiveFilter.activeFilters.artist_place.length )
            || ( APP.ArchiveFilter.activeFilters.collection && APP.ArchiveFilter.activeFilters.collection.length )
            || ( APP.ArchiveFilter.activeFilters.collection_id && APP.ArchiveFilter.activeFilters.collection_id.length )
            || ( APP.ArchiveFilter.activeFilters.classification && APP.ArchiveFilter.activeFilters.classification.length )
            || ( APP.ArchiveFilter.activeFilters.date_acquired && APP.ArchiveFilter.activeFilters.date_acquired.length === 2 && ( APP.ArchiveFilter.acquiredStartYear !== APP.ArchiveFilter.activeFilters.date_acquired[0] || APP.ArchiveFilter.todayISO.getFullYear() !== APP.ArchiveFilter.activeFilters.date_acquired[1] ) )
            || ( APP.ArchiveFilter.activeFilters.date_created && APP.ArchiveFilter.activeFilters.date_created.length === 2 && ( APP.ArchiveFilter.createdStartYear !== APP.ArchiveFilter.activeFilters.date_created[0] || APP.ArchiveFilter.todayISO.getFullYear() !== APP.ArchiveFilter.activeFilters.date_created[1] ) )
            || ( APP.ArchiveFilter.activeFilters.search && '' !== APP.ArchiveFilter.activeFilters.search )
            || ( APP.ArchiveFilter.activeFilters.s && '' !== APP.ArchiveFilter.activeFilters.s )
            ) {
            return true
        }
        else if ( $('input.datepicker--value').hasClass( APP.ArchiveFilter.classes.item_active )
            && 'undefined' !== typeof APP.ArchiveFilter.activeFilters.dates 
            && APP.ArchiveFilter.activeFilters.dates.length === 2 
            && APP.ArchiveFilter.defaultDates[0][0] !== APP.ArchiveFilter.activeFilters.dates[0]
            && APP.ArchiveFilter.defaultDates[1][0] !== APP.ArchiveFilter.activeFilters.dates[1] ) {
                return true
        }
        else if ( $('.archive--filter-suggestion--has-active').length ) {
            return true
        }
        else if ( false ) {
            // some checks to see if either create or acquired date are active.
        }
    },
    _hasPaginationApplied : () => {
        if ( APP.ArchiveFilter.currentPage > 1 ) {
            return true
        }
        return false
    },
    _imageLoader : ( img, callbackFunction, loadedCount, imageCount, lowRes = true ) => {
        if ( ! lowRes ) {
            img.classList.add( 'loading' )    
            if ( img.complete && img.naturalHeight !== 0 ) {
                img.classList.remove( 'loading', 'is--loading', 'image--lowres' )
                loadedCount['fullres']++
                APP.ArchiveFilter._imageLoaderFinished( loadedCount.highres, imageCount, callbackFunction )
            }
            else {
                img.addEventListener( 'load', () => {
                    img.classList.remove( 'loading', 'is--loading', 'image--lowres' )
                    loadedCount['fullres']++
                    APP.ArchiveFilter._imageLoaderFinished( loadedCount.fullres, imageCount, callbackFunction )
                })
                img.addEventListener( 'error', () => {
                    console.error( 'Failed to load full-res image' )
                    img.classList.remove('loading', 'is--loading' )
                    loadedCount['fullres']++
                    APP.ArchiveFilter._imageLoaderFinished( loadedCount.fullres, imageCount, callbackFunction )
                })
            }
            return
        }
        const srcsetData = img.getAttribute( 'data-srcset' )
        if ( ! srcsetData ) {
            console.error( 'img missing src-set', img )
            return
        }
        const imageWidth = img.getAttribute('width') || img.getAttribute( 'data-width' )
        const highResImage = new Image()
        highResImage.srcset = srcsetData
        img.classList.add( 'loading' )
        if ( highResImage.complete && highResImage.naturalHeight !== 0 ) {
            img.srcset = srcsetData
            // set the width
            if ( imageWidth ) {
                img.setAttribute( 'width', imageWidth )
            }
            img.removeAttribute( 'data-srcset' )
            img.classList.remove( 'loading', 'is--loading', 'image--lowres' )
            loadedCount['highres']++
            APP.ArchiveFilter._imageLoaderFinished( loadedCount.highres, imageCount, callbackFunction )
        }
        else {
            highResImage.addEventListener( 'load', () => {
                img.srcset = srcsetData
                // set the width
                if ( imageWidth ) {
                    img.setAttribute( 'width', imageWidth )
                }
                img.removeAttribute('data-srcset')
                img.classList.remove( 'loading', 'is--loading', 'image--lowres' )
                loadedCount['highres']++
                APP.ArchiveFilter._imageLoaderFinished( loadedCount.highres, imageCount, callbackFunction )
            })
            highResImage.addEventListener('error', () => {
                console.error('Failed to load high-res image')
                img.classList.remove('loading', 'is--loading' )
                loadedCount['highres']++
                APP.ArchiveFilter._imageLoaderFinished( loadedCount.highres, imageCount, callbackFunction )
            })
        }
    },
    _imageLoaderFinished : ( count, length, callbackFunction ) => {
        if ( count === length ) {
            APP.MasonryLayout._init()
            if ( 'function' == typeof callbackFunction ) {
                callbackFunction()
            }
        }
    },
    _imageLowResLoader : ( callbackFunction = null ) => {
        const fullImages = document.querySelectorAll( '.archive--grid-wrapper-grid-item-link > img:not(.image--lowres)' ),
            images = document.querySelectorAll( '.archive--grid-wrapper-grid-item-link > img.image--lowres' ),
            loadedCount = {
                'lowres' : 0,
                'fullres' : 0,
                'highres' : 0
            }
        if ( images.length ) {
            images.forEach( img => APP.ArchiveFilter._imageLoader( img, callbackFunction, loadedCount, images.length )  )    
        }
        else if ( fullImages.length ) {
            fullImages.forEach( img => APP.ArchiveFilter._imageLoader( img, callbackFunction, loadedCount, fullImages.length, false )  )
        }
    },
    _isEmptyElement : ( element, ignoreWhitespaceText ) => {
        // Check if the element exists
        if ( ! element ) {
            return true
        }
        // Check for child elements
        if ( element.children.length > 0 ) {
            return false
        }
        // If ignoring whitespace text nodes
        if ( ignoreWhitespaceText ) {
            // return true if all child nodes are whitespace text nodes
            return ! Array.from( element.childNodes ).some( node => 
                // returning if the node is not a text node and the trimmed text content is not empty
                node.nodeType === Node.TEXT_NODE && node.textContent.trim() !== ""
            )
        }
        // If considering all text nodes as content
        return element.childNodes.length === 0
    },
    _maybeHideHeader : ( showHide ) => {
        if ( typeof showHide !== 'undefined' ) {
            if ( showHide ) {
               APP.ArchiveFilter.$archiveGrid.addClass( APP.ArchiveFilter.classes.grid_filtered )
               APP.ArchiveFilter.$archiveFilterElement.addClass( APP.ArchiveFilter.classes.grid_filtered )
            }
            else {
               APP.ArchiveFilter.$archiveGrid.removeClass( `${APP.ArchiveFilter.classes.grid_filtered} ${APP.ArchiveFilter.classes.grid_empty}` )
               APP.ArchiveFilter.$archiveFilterElement.removeClass( `${APP.ArchiveFilter.classes.grid_filtered}` )
            }
        }
        else if ( APP.ArchiveFilter._hasFilterApplied() ) {
           APP.ArchiveFilter.$archiveGrid.addClass( APP.ArchiveFilter.classes.grid_filtered )
           APP.ArchiveFilter.$archiveFilterElement.addClass( APP.ArchiveFilter.classes.grid_filtered )
        }
        else {
            APP.ArchiveFilter.$archiveGrid.removeClass( `${APP.ArchiveFilter.classes.grid_filtered} ${APP.ArchiveFilter.classes.grid_empty}` )
            APP.ArchiveFilter.$archiveFilterElement.removeClass( `${APP.ArchiveFilter.classes.grid_filtered}` )
        }
    },
    _moveSearchBox : () => {
		// Move the search into another element when less than 768 px
		if ( $( 'body' ).hasClass( 'page-template-page-collection-search' ) ) {
			if ( typeof( APP.Breakpoint ) !== 'undefined' && typeof( APP.Breakpoint.prevWW ) !== 'undefined' && APP.Breakpoint.prevWW < 768 ) {
				$( 'li.inpagetab-items-list-search').appendTo( '.archive--filter-wrapper' )
                APP.ArchiveFilter.$filterSearch.on( 'keyup input change click', APP.ArchiveFilter._searchHandler )
			}
			else if ( ! $( '.inpagetab-items' ).find( '.inpagetab-items-list-search' ).length ) {
				$( 'li.inpagetab-items-list-search').appendTo( '.inpagetab-items' )
                APP.ArchiveFilter.$filterSearch.on( 'keyup input change click', APP.ArchiveFilter._searchHandler )
			}
		}
	},
    /**
    * [onRenderCell updates classnames for cells]
    * @param  {obj} date     a js date obj
    * @param  {string} cellType the cell's type
    * @return {obj}          see http://t1m0n.name/air-datepicker/docs/#sub-section-45 for details
    */
    _onRenderDayCell : ( { date, cellType, datepicker } ) => {
        // init return obj
        const obj = {
                html : '',
                classes : '',
                disabled : false,
                attrs : '',
        }
        // store the classes for the obj
        let classes = []

        // do we have access to datepicker instance and is the current cellType of day?
        if ( typeof APP.ArchiveFilter.datePicker != 'undefined' && cellType == 'day' ) {
            // store the dates as an array
            let rangeDates = APP.ArchiveFilter.datePicker.selectedDates
            // we got some range dates right?
            if ( rangeDates.length > 1 ) {
                // convert rangeDates values to datetime objects
                rangeDates = rangeDates.map(function(rangeDate){
                    return new Date(new Date(rangeDate).toLocaleString('en-US', {timeZone: 'America/Los_Angeles'}))
                })
                // if the date is between the range of dates
                if ( date > rangeDates[0] && date < rangeDates[1] ) {
                    //add the inrange class
                    //classes.push('-super-in-range-')
                }
                // local util func to return a date string in the format of Ymd (20180114 = Jan 14th 2018)
                function getYmd( d ) {
                    // init output
                    let ymd = ''
                    // get the year YYYY
                    ymd += d.getFullYear().toString()
                    // get the month and day (month is 0-11 so +1 to make it like calendar)
                    let md = [ d.getMonth() + 1, d.getDate() ]
                    // loop through month & day
                    md.forEach( ( el ) => {
                        // less than 10?
                        if ( el < 10 ) {
                            // add 0 to the beginning of the number string
                            ymd += 0 + el.toString()
                        }
                        // greater than or equal to 10?
                        else {
                            // just return the number string
                            ymd += el.toString()
                        }
                    } )
                    // return the output
                    return ymd
                }
                // if the date is the same as the start date
                if ( getYmd ( date ) == getYmd( rangeDates[0] ) ) {
                    // add range from class to smoothly continue the bg
                    // classes.push('-super-range-from-')
                }
                // if the date is the same as the end date
                if ( getYmd( date ) == getYmd( rangeDates[1] ) ) {
                    // add range from class to smoothly continue the bg
                    // classes.push('-super-range-to-')
                }
            }
        }
        if ( 'undefined' === date ) {
            // nothing, just to protect the following tests
        }
        // is the day a saturday?
        else if ( date.getDay() == 6 ){
            // set the class to saturday
            classes.push( 'saturday' )
        }
        // is the day a sunday?
        else if ( date.getDay() == 0 ) {
            // set the day to sunday
            classes.push( 'sunday' )
        }
        else if ( date.getDay() == 3 ) {
            //set the day to wednesday
            classes.push( 'wednesday' )
        }
        if ( APP.ArchiveFilter.todayISO > date ) {
            classes.push( 'past-date' )
        }
        else {
            classes.push( 'not-past-date' )
        }
        // do we have upcoming dates?
        if( APP.ArchiveFilter.upcomingEventDates != undefined && APP.ArchiveFilter.upcomingEventDates.length ) {
            APP.ArchiveFilter.upcomingEventDates.forEach( ( upcomingDate ) => {
                // convert the date an object
                var upcomingDate = new Date( upcomingDate )
                // make sure the hours are at 0 for comparisons sake
                upcomingDate.setHours(0)
                // got an upcoming date?
                if( upcomingDate.getTime() == date.getTime() ) {
                    // add the class
                    classes.push('upcoming')
                }
            } )
        }
        // do we have closed dates?
        if ( APP.ArchiveFilter.closedEventDates != undefined ) {
            APP.ArchiveFilter.closedEventDates.forEach( ( closedDate ) => {
                // convert the date from to an object
                let closedDateObject = new Date( closedDate )
                // make sure the hours are at 0 for comparisons sake
                closedDateObject.setHours( 0 )
                // got an closed date?
                if ( closedDateObject.getTime() == date.getTime() ) {
                    // add the class
                    classes.push( 'closed' )
                }
            })
        }
        // concat the classes via a space
        obj.classes = classes.join(' ')
        // return the obj
        return obj
    },
    /**
    * [onSelect fires when datepicker celll selected] see http://t1m0n.name/air-datepicker/docs/#events for details
    * @param  {string} formattedDate a datepicker instance
    * @param  {Date|array} date JavaScript Date object if  {multipleDates: true}, then it will be an array of js dates.
    * @param  {obj} inst a datepicker instance    
    */
    _onSelectDatepicker : ( { date, formattedDate, datepicker } ) => {
        const dateFilterElement = document.querySelector( 'button[data-filter-type="date"]' )
        const $dateFilterContainer = $( dateFilterElement ).next( `.${APP.ArchiveFilter.classes.group_menu}` )
        const range = 'undefined' !== typeof APP.ArchiveFilter.datePicker.selectedDates ? APP.ArchiveFilter.datePicker.selectedDates : []
        $( dateFilterElement ).next( `.${APP.ArchiveFilter.classes.group_menu}` ).addClass( APP.ArchiveFilter.classes.item_selected )
        if ( range.length === 2 || ( $('input.datepicker--value').hasClass( APP.ArchiveFilter.classes.item_active )
        && 'undefined' !== typeof APP.ArchiveFilter.activeFilters.dates 
        && APP.ArchiveFilter.activeFilters.dates.length === 2 
        && APP.ArchiveFilter.defaultDates[0][0] !== APP.ArchiveFilter.activeFilters.dates[0]
        && APP.ArchiveFilter.defaultDates[1][0] !== APP.ArchiveFilter.activeFilters.dates[1] ) ) {
            $dateFilterContainer.addClass( APP.ArchiveFilter.classes.group_menu_has_valid )
        }
        else {
            $dateFilterContainer.removeClass( APP.ArchiveFilter.classes.group_menu_has_valid )
        }
    },
    _paginationClickHander : ( e ) => {
        e.preventDefault()
        let $target = $( e.target )
        if ( $target.not( 'a.page-numbers' ) ) {
            $target = $( e.target ).closest( 'a.page-numbers' )
        }
        if ( $target.is( 'a.page-numbers' ) ) {
            const url = new URL( $target.prop( 'href' ) ),
                  urlParams = new URLSearchParams( url.search ),
                  pageNumber = urlParams.get( '_page' )

            // get the correct slice of the items
            APP.ArchiveFilter.currentPage = pageNumber > 1 ? Number( pageNumber ) : 1
            APP.ArchiveFilter._filterArchiveGridUpdate( 
                { 
                    'action' : APP.ArchiveFilter.currentAction, 
                    'callbacks': [], 
                    'options' : { 'scrollTo' : 'results', 'origin' : 'pagination' }  
                },
                { 'scrollToResults' : 'results' }
            )
            return false
        }
    },
    _parseUrlParams : ( ) => {
        let searchParams = new URLSearchParams( window.location.search )
        const hash = window.location.hash ? window.location.hash.substr(1) : null,
              parts = hash ? hash.split('?') : [],
              searchString = parts[1] || ''
    
        if ( ! searchParams.toString() && searchString ) {
            searchParams = new URLSearchParams( searchString )
        }
        for ( let [ key, value ] of searchParams.entries() ) {
            const cleanedKey = key.startsWith('_') ? key.substring(1) : key
            if ( key.startsWith('_terms[') ) {
                const subKey = cleanedKey.match(/\[(.*?)\]/)[1]
                APP.ArchiveFilter.searchParams['terms'] = APP.ArchiveFilter.searchParams['terms'] || {}
                APP.ArchiveFilter.searchParams['terms'][ subKey ] = APP.ArchiveFilter._decodeURL( value ).split(',')
            }
            else {
                if ( '_has_video' === key || '_has_audio' === key || '_has_image' === key || '_on_view' === key || '_show_previous' === key || '_pdf' === key ) {
                    value = ('1' === value || 1 === Number( value ) ) ? 1 : 0
                }
                else if ( '_artist_maker' === key || '_artist_place' === key || '_classification' === key || '_collection_id' === key || '_collection' === key || '_floor' === key ) {
                    // if value is a string (with commas), convert to array, otherwise leave as array
                    value = Array.isArray( value ) ? value : value.split(',')
                }
                else if ( '_dates' === key || '_date_created' === key || '_date_acquired' === key ) {
                    // If string value has a - (dash), convert treat as a date range and put the start date at 0 and end at 1
                    if ( Array.isArray( value ) || ! value.includes('-') ) {
                        // if value is a string (with commas), convert to array, otherwise leave as array
                        value = Array.isArray( value ) ? value : value.split(',')
                    }
                    else {
                        value = value.split('-')
                    }
                }
                else if ( '_terms' === key || '_parents' === key ) {
                    value = Array.isArray( value ) ? value : value.split(',')
                }
                APP.ArchiveFilter.searchParams[ cleanedKey ] = APP.ArchiveFilter._decodeURL( value )
            }
        }
    },
    _passesDateFilter: ( post ) => {
        if ( ( 'undefined' !== post.EndDate && '' !== post.EndDate )
            // beginning of selected filter is greater / after the end date of this event
            && APP.ArchiveFilter.activeFilters.dates[0] > post.EndDate
        ) {
            return false
        }
        else if ( ( 'undefined' !== post.StartDate && '' !== post.StartDate ) 
            // end of selected filter is less / before the start date of this event
            && APP.ArchiveFilter.activeFilters.dates[1] < post.StartDate 
        ) {
            return false
        }
        return true
    },
    _passesPdfFilter: (post) => {
        // remove posts that have nothing download if the pdf filter is acctive
        return ! ( APP.ArchiveFilter.activeFilters.pdf && post.download === '' )
    },
    _popStateHandler : ( e ) => {
        const originalEvent = e.originalEvent, substringKeyExclude = []
        if ( 'site' === APP.ArchiveFilter.scope ) {
            substringKeyExclude.push( 'type' )
            substringKeyExclude.push( 's' )
        }
        if ( originalEvent.state === null ) {
            const originalState = APP.URLParams._get( 0, substringKeyExclude )
            // @TODO what is this testing for?
            if ( 'collection' === APP.ArchiveFilter.scope  || 'archive' === APP.ArchiveFilter.scope ) {
                if ( 
                    typeof originalState.page !== 'undefined' &&  window.location.search !== '' 
                    &&  
                    ( ! window.location.search.includes( '_sort' ) || ! window.location.search.includes( '_pdf' ) 
                    || ! window.location.search.includes( '_page' ) || ! window.location.search.includes( '_terms' ) 
                    || ! window.location.search.includes( '_daterange' ) 
                ) 
            ) {
                APP.ArchiveFilter._updateFilters( null, originalState )
                }
                else {
                    APP.ArchiveFilter._updateFilters( null, {
                        page : 1, terms : '', pdf : 0, sort: '',
                    } )
                }
            }
            else {
                // @TODO what is this testing for?
                if ( 
                    typeof originalState.page !== 'undefined' && window.location.search !== '' 
                    &&  
                    ( ! window.location.search.includes( '_page' ) || ! window.location.search.includes( '_has_image' ) 
                    || ! window.location.search.includes( '_show_previous' ) || ! window.location.search.includes( 'type' ) 
                   )
                ) {
                   APP.ArchiveFilter._updateFilters( null, originalState )
                }
                else {
                    const updateOptions = {
                        page : 1,
                    }
                    // if the 'type' query paramater is present in location.search
                    if ( window.location.search.includes( 'type' ) ) {
                        // set the type query paramater to the value of the 'type' query paramater
                        updateOptions.type = APP.URLParams._get( 'type' )
                    }
                    APP.ArchiveFilter._updateFilters( null, updateOptions )
                }
            }
        }
        else if ( typeof originalEvent.state === 'object' && originalEvent.state && typeof originalEvent.state.query !== 'undefined' ) {
            APP.ArchiveFilter._updateFilters( originalEvent, originalEvent.state.query )
        }
    },
    _prepareGridItems : ( ) => {
        APP.ArchiveFilter.$archiveGrid.each( ( index, item ) => {
            APP.ArchiveFilter._calculateInitialItemsToShow( item )
            APP.ArchiveFilter._showInitialItems( item )
            APP.ArchiveFilter._setupScrollListener( item )
        } )
    },
    _processLabels : ( container, filterQuery, maxVisibleLabels = 9 ) => {
        let matched = false
        let visibleCount = 0
        let referencePoint = container.querySelector( 'div' )
        const labels = container.querySelectorAll( 'label' )
        let labelsArray = Array.from( labels )
        for ( const label of labelsArray ) {
            if ( ! filterQuery 
                || label.querySelector('input:checked') 
                || label.textContent.toLowerCase().includes( filterQuery.toLowerCase() ) ) {
                // Set label data to active for visibility
                label.dataset.filterState = 'active'
                visibleCount++
                matched = true
            } 
            else {
                label.dataset.filterState = 0
            }
        }
        // Then, sort the labels by the number in data-filter-count
        labelsArray.sort( ( a, b ) => {
            const countA = parseInt( a.dataset.filterCount, 10 ) || 0
            const countB = parseInt( b.dataset.filterCount, 10 ) || 0
            // Sort in descending order (b-a)
            return countB - countA
        })
        // Hide labels that exceed maxVisibleLabels
        if ( referencePoint.classList.contains('is--remote') && visibleCount > maxVisibleLabels ) {
            labelsArray.forEach( ( label ) => {
                if ( label.dataset.filterState === 'active' ) {
                    label.dataset.filterState = maxVisibleLabels > 0 ? 'active' : 'active-queue'
                    maxVisibleLabels--
                }
            })
            // Add "Show All" link if it doesn't exist yet
            if ( ! container.querySelector('.show-all-trigger' ) ) {
                const showAllLink = document.createElement('span')
                showAllLink.className = 'show-all-trigger'
                showAllLink.textContent = 'Show All'
                showAllLink.style.display = 'flex'
                showAllLink.style.cursor = 'pointer'
                showAllLink.style.border = 'none'
                showAllLink.style.textDecoration = 'underline'

                showAllLink.addEventListener( 'click', function( e ) {
                    e.preventDefault()
                    e.stopPropagation()
                    // Show hidden labels
                    container.querySelectorAll('label').forEach( label => {
                        if (label.dataset.filterState === 'active-queue') {
                            label.dataset.filterState = 'active'
                        }
                    })
                    // Hide/Remove "Show All"
                    this.style.display = 'none'
                    this.remove()
                    return false
                })
                container.appendChild( showAllLink )
            }
        }
        labelsArray.forEach(( label ) => {
            container.insertBefore( label, referencePoint.nextElementSibling )
            referencePoint = label
        })
        // labelsArray.forEach( label => container.appendChild( label ) )
        return matched
    },
    _removeActiveFilters : ( scope = 'site' ) => {
        if ( scope === 'site' ) {
            delete APP.ArchiveFilter.activeFilters.artist_maker
            delete APP.ArchiveFilter.activeFilters.artist_place
            delete APP.ArchiveFilter.activeFilters.collection
            delete APP.ArchiveFilter.activeFilters.collection_id
            delete APP.ArchiveFilter.activeFilters.classification
            delete APP.ArchiveFilter.activeFilters.dates
            delete APP.ArchiveFilter.activeFilters.date_created
            delete APP.ArchiveFilter.activeFilters.date_acquired
            delete APP.ArchiveFilter.activeFilters.floor
            delete APP.ArchiveFilter.activeFilters.has_video
            delete APP.ArchiveFilter.activeFilters.has_audio
            delete APP.ArchiveFilter.activeFilters.on_view
            delete APP.ArchiveFilter.activeFilters.pdf
            delete APP.ArchiveFilter.activeFilters.parents
            delete APP.ArchiveFilter.activeFilters.search
            delete APP.ArchiveFilter.activeFilters.terms
            if ( APP.ArchiveFilter.currentSearchGroup !== 'artwork' && APP.ArchiveFilter.currentSearchGroup !== 'artist' ) {
                delete APP.ArchiveFilter.activeFilters.has_image
            }
            if ( APP.ArchiveFilter.currentSearchGroup !== 'events' && APP.ArchiveFilter.currentSearchGroup !== 'exhibition' ) {
                delete APP.ArchiveFilter.activeFilters.show_previous
            }
        }
        else if ( scope === 'collection' ) {
            // unset activeFilters that are not in use for this scope
            delete APP.ArchiveFilter.activeFilters.s
            delete APP.ArchiveFilter.activeFilters.show_previous
            delete APP.ArchiveFilter.activeFilters.type
            delete APP.ArchiveFilter.activeFilters.dates
        }
        else if ( scope === 'archive' ) {
            delete APP.ArchiveFilter.activeFilters.artist_maker
            delete APP.ArchiveFilter.activeFilters.artist_place
            delete APP.ArchiveFilter.activeFilters.collection
            delete APP.ArchiveFilter.activeFilters.collection_id
            delete APP.ArchiveFilter.activeFilters.classification
            delete APP.ArchiveFilter.activeFilters.date_created
            delete APP.ArchiveFilter.activeFilters.date_acquired
            delete APP.ArchiveFilter.activeFilters.floor
            delete APP.ArchiveFilter.activeFilters.has_video
            delete APP.ArchiveFilter.activeFilters.has_audio
            delete APP.ArchiveFilter.activeFilters.on_view
            delete APP.ArchiveFilter.activeFilters.search
            delete APP.ArchiveFilter.activeFilters.s
            delete APP.ArchiveFilter.activeFilters.type
            delete APP.ArchiveFilter.activeFilters.show_previous
            delete APP.ArchiveFilter.activeFilters.has_image
        }
    },
    /**
	 * [_renderGridItem outputs the html of a grid item]
	 * @param  {obj} post post object
     * @param  {int} index the index of the post in the array
	 */
	_renderGridItem : ( post, index ) => {
        // spread (...) into an new object to avoid reference
        const classes = {...APP.ArchiveFilter.classes }
        let extraGridClasses = '',
            imageClasses = classes.image,
            imageHeight = '',
            imageLoading = '',
            imageWidth = '',
            imageOrientation = '',
            imgSrc = 'undefined' !== typeof post.image ? post.image.url : '',
            srcSet = ''
        if ( 'event' === post.post_type || 'event-series' === post.post_type || 'exhibition' === post.post_type ) {
            classes.grid_item += ' archive--type-event'
            if ( 'undefined' !== typeof post.expired ) {
                extraGridClasses += 'is--expired'
            }
            if ( 'undefined' !== typeof post.supertitle ) {
                // Add special supertitle classes if the event is a public meeting or free.
                if ( post.supertitle.toLowerCase().indexOf( 'public meeting' ) != -1 ) {
                    classes.supertitle += ' event--public-meeting'
                }
                else if ( post.supertitle.toLowerCase().indexOf( 'free' ) != -1 ) {
                    classes.supertitle += ' event--free'
                }
            }
            // handle exhibition labels
            // @TODO
        }
        else if ( 'artwork' === post.post_type ) {
            classes.grid_item += ' archive--artwork'
            if ( 'undefined' !== typeof post.artwork_artist ) {

            }
            if ( 'undefined' !== typeof post.artwork_created ) {
            
            }
        }
        else if ( 'artist' === post.post_type ) {
            classes.grid_item += '  archive--type-artist'
            imageClasses += ' archive--type-artist'
        }
        else {
            classes.grid_item += ' archive--type-' + post.post_type
        }
		// start the output html
        const fillerTypes = [ 'event', 'event-series' ]
		let outputHTML = `<div class="${classes.grid_item} ${extraGridClasses}">`
        if ( fillerTypes.includes( post.post_type ) && 0 === index && APP.ArchiveFilter.currentPage === 1 ) {
            outputHTML += `<span class="bg--filler bg--filler-left js--normalize-height" data-compare-selector=".${classes.grid} .${classes.grid_item.replace( ' archive--type-event', ':nth-child( -n + 2 )' )}"></span>`
        }
        if ( fillerTypes.includes( post.post_type ) && 1 === index && APP.ArchiveFilter.currentPage === 1 ) {
            outputHTML += `<span class="bg--filler bg--filler-right js--normalize-height" data-compare-selector=".${classes.grid} .${classes.grid_item.replace( ' archive--type-event', ':nth-child( -n + 2 )' )}"></span>`
        }
        outputHTML += `<h4 style="display:none;">ID: ${post.ID} Terms: ${post.terms.join(', ')}</h4>`
        outputHTML += `<a href="` + post.permalink + `" class="${classes.link}" `
        outputHTML += 'undefined' !== typeof post.linktarget && post.linktarget ? `target="_blank"` : '' 
        outputHTML +=` data-terms="` + post.terms.join( ',' ) + '" data-id="' + post.ID + '">'
		// build text
        const showFeaturedLabel = post.is_featured === true && 'event' === post.post_type && APP.data['featured_show_label']
        outputHTML += `<div class="${classes.text_wrapper}">`
        if ( showFeaturedLabel ) {
            let featuredLabel =  ''
            if ( 'undefined' !== typeof post.featured_label && post.order === 0 ) {
                featuredLabel = post.featured_label
            }
            else if ( 'undefined' !== typeof post.featured_label_1 && post.order === 1 ) {
                featuredLabel = post.featured_label_1
            }
            if ( '' !== featuredLabel ) {
                outputHTML +=  `<h6 class="${classes.featured}">${featuredLabel}</h6>`
            }
        }
        outputHTML += typeof post.title != 'undefined' && post.title != ''  ? `<h4 class="${classes.title}">` + post.title + '</h4>' : ''
		outputHTML +=  typeof post.subtitle != 'undefined' && post.subtitle != '' ? `<div class="${classes.subtitle}">` + post.subtitle + '</div>' : ''
        outputHTML += typeof post.supertitle != 'undefined' && post.supertitle != '' ? `<span class="${classes.supertitle}">` + post.supertitle + '</span>' : ''
        if ( 'artwork' === post.post_type ) {
            outputHTML += typeof post.artwork_artist != 'undefined'  && post.artwork_artist != '' ? `<div class="${classes.artwork_artist}">` + post.artwork_artist + '</div>' : ''
            outputHTML += typeof post.artwork_created != 'undefined' && post.artwork_created != ''? `<div class="${classes.artwork_created}">` + post.artwork_created + '</div>' : ''
        }
        else if ( 'artist' === post.post_type ) {
            outputHTML += typeof post.artist_bio != 'undefined' && post.artist_bio != '' ? `<div class="${classes.artist_bio}">` + post.artist_bio + '</div>' : ''
        }
        outputHTML += '</div>'

        // build image
        if ( post.image && ( 'undefined' === typeof post.image.imagesize || false === post.image.imagesize ) ) {
            outputHTML += `<div class="image--placeholder" data-id="${post.ID}"></div>`
            outputHTML += `<div class="container--image-unavailable" data-img-id="${post.image.id}"><div class="image--unavailable"></div></div></div>`
        }
		else if ( post.image && imgSrc ) {
            if ( 'undefined' !== typeof post.image.loading && 'lazy' === post.image.loading ) {
                imageLoading = 'loading="lazy" '
            }
            if ( 'undefined' !== typeof post.image.lowres && post.image.lowres && 'undefined' !== typeof post.image.src_set && post.image.src_set ) {
                imageClasses += ' image--lowres'
                imgSrc = post.image.lowres
                srcSet = ` data-srcset="${post.image.src_set}" `
            }
            else if ( 'undefined' === typeof post.image.src_set  || ! post.image.src_set  ) {
                srcSet = ''
            }
            else {
                srcSet = ` srcset="${post.image.src_set}" `
            }
            if ( 'undefined' !== typeof post.image.imagesize ) {
                imageWidth = ` width="${post.image.imagesize[0]}" data-width="${post.image.imagesize[0]}" `
                imageHeight = ` data-height="${post.image.imagesize[1]}" `
                imageOrientation = ` data-orientation="${post.image.imagesize[0] > post.image.imagesize[1] ? 'landscape' : 'portrait'}" `
            }
            else {
                if ( 'undefined' !== typeof post.image.width && post.image.width ) {
                    imageWidth = ` width="${post.image.width}" data-width="${post.image.width}" `
                }
                if ( 'undefined' !== typeof post.image.height && post.image.height ) {
                    // only data-height
                    imageHeight = ` data-height="${post.image.height}" `
                    if ( 'undefined' !== typeof post.image.width && post.image.width ) {
                        imageOrientation = ` data-orientation="${post.image.width > post.image.height ? 'landscape' : 'portrait'}" `
                    }                }
            }
            outputHTML += `<img class="${imageClasses}" ${imageLoading}alt="` + post.image.alt + '"'
			outputHTML += `${imageWidth} ${imageHeight}`
            if ( '' !== imageOrientation ) {
                outputHTML += imageOrientation
            }
            // look for a cache_key for the image
            if ( 'undefined' !== typeof post.image.cache_key ) {
                outputHTML += ` data-cache-id="${post.image.cache_key}" `
            }
			outputHTML += `src="${imgSrc}"${srcSet}`
			outputHTML += post.image.sizes ? 'sizes="' + post.image.sizes + '" />': '/>'
		}
        else if ( 'event' === post.post_type || 'event-series' === post.post_type ) {
            outputHTML += APP.data['event_placeholder_image']
        }
        else if ( 'artist' === post.post_type ) {
            outputHTML += `<div class="artist-placeholder" style="--placeholder-bgcolor:${APP.ColorManager.getBackgroundColor()};"></div>`
        }
		else {
			outputHTML += '<div class="container--image-unavailable"><div class="image--unavailable" style="min-heigth:100px;"></div></div>'
		}
        // close the link
        outputHTML += '</a>'
		outputHTML +=  post.download != '' && typeof post.download != 'undefined' ? '<div class="archive--grid-wrapper-grid-item-download"><a class="archive--grid-wrapper-grid-item-download-link" target="_blank" href="' +  post.download + '">' : ''
		outputHTML +=  post.download != '' && typeof post.download != 'undefined' ? '<i class="sficon sficon-download"></i><span class="icon-cta filetype--' + post.download.split(/[#?]/)[0].split( '.' ).pop().trim() + '"></span></a>' : ''
        // close the wrapper
        outputHTML += '</div>'
		// add the post
		APP.ArchiveFilter.$grid.append( outputHTML )
	},
    /**
	 * [_renderPagination outputs the html of a pager]
	 * @param  {obj} post post object
	 */
	_renderPagination : () => {
        // start the output html
        const queryParams = new URLSearchParams( APP.ArchiveFilter.currentQueryString ),
            nextPage = APP.ArchiveFilter.currentPage + 1,
            prevPage = APP.ArchiveFilter.currentPage - 1,
            currentSpan = `<span aria-current="page" class="page-numbers current">${APP.ArchiveFilter.currentPage}</span>`
        let outputHTML = '<div class="nav-links">'

        if ( APP.ArchiveFilter.totalPage > 1 ) {
            if ( APP.ArchiveFilter.currentPage === 1 ) {
                outputHTML += currentSpan
            }
            if ( APP.ArchiveFilter._hasPaginationApplied() ) {
                //outputHTML += `<a class="prev page-numbers" href="/?${APP.ArchiveFilter.queryKeys.page}=${prevPage}"><span class="search-arrow-icon icon-previous">${APP.ArchiveFilter.svgArrowPrevious}</span><span class="search-nav-text">Previous</span></a>`
                // Update the _page query parameter for the 'Previous' link
                queryParams.set( APP.ArchiveFilter.queryKeys.page, prevPage )
                // Construct the new href for the 'Previous' link
                const prevHref = `${APP.ArchiveFilter.currentPath}?${queryParams.toString()}`
                outputHTML += `<a class="prev page-numbers" href="${prevHref}"><span class="search-arrow-icon icon-previous">${APP.ArchiveFilter.svgArrowPrevious}</span><span class="search-nav-text">Previous</span></a>`
            }
            let onceBefore = false
            let onceAfter = false
            for ( let pagenumber = 1; pagenumber <= APP.ArchiveFilter.totalPage; pagenumber++ ) {
                // Update the _page query parameter
                queryParams.set( APP.ArchiveFilter.queryKeys.page, pagenumber )
                // Construct the new href
                const newHref = `${APP.ArchiveFilter.currentPath}?${queryParams.toString()}`

                if ( pagenumber === APP.ArchiveFilter.currentPage ) {
                    if ( APP.ArchiveFilter.currentPage !== 1 ) {
                        outputHTML += currentSpan
                    }
                }
                else if ( APP.ArchiveFilter.currentPage >= 2 && ( 1 === pagenumber || APP.ArchiveFilter.totalPage === pagenumber ) ) {
                    //outputHTML += `<a class="page-numbers" href="/?${APP.ArchiveFilter.queryKeys.page}=${pagenumber}">${pagenumber}</a>`
                    outputHTML += `<a class="page-numbers" href="${newHref}">${pagenumber}</a>`

                }
                else if ( pagenumber - 2 >= APP.ArchiveFilter.currentPage && pagenumber !== APP.ArchiveFilter.totalPage ) {
                    if ( ! onceBefore ) {
                        outputHTML += '<span class="page-numbers dots">&hellip;</span>'
                        onceBefore = true
                    }
                }
                else if ( pagenumber + 2 <= APP.ArchiveFilter.currentPage ) {
                    if ( ! onceAfter ) {
                        outputHTML += '<span class="page-numbers dots">&hellip;</span>'
                        onceAfter = true
                    }
                }
                else {
                    //outputHTML += `<a class="page-numbers" href="/?${APP.ArchiveFilter.queryKeys.page}=${pagenumber}">${pagenumber}</a>`
                    outputHTML += `<a class="page-numbers" href="${newHref}">${pagenumber}</a>`
                }
            }
            if ( APP.ArchiveFilter.currentPage < APP.ArchiveFilter.totalPage ) {
                //outputHTML += `<a class="next page-numbers" href="/?${APP.ArchiveFilter.queryKeys.page}=${nextPage}"><span class="search-nav-text">Next</span><span class="search-arrow-icon icon-next">${APP.ArchiveFilter.svgArrowNext}</span></a>`
                // Update the _page query parameter for the 'Previous' link
                queryParams.set( APP.ArchiveFilter.queryKeys.page, nextPage )
                // Construct the new href for the 'Previous' link
                const nextHref = `${APP.ArchiveFilter.currentPath}?${queryParams.toString()}`
                outputHTML += `<a class="next page-numbers" href="${nextHref}"><span class="search-nav-text">Next</span><span class="search-arrow-icon icon-next">${APP.ArchiveFilter.svgArrowNext}</span></a>`
            }
        }
        // close the wrapper
        outputHTML += '</div>'
        // remove existing pager
        APP.ArchiveFilter.$paginationContainer.find( '.nav-links' ).remove()
		// add the pager
		APP.ArchiveFilter.$paginationContainer.find( 'nav.pagination' ).append( outputHTML )
        APP.ArchiveFilter.$paginationContainer.find( '.page-numbers' ).on( 'click', APP.ArchiveFilter._paginationClickHander )
    },
    _renderPromoItem : ( index = 0 ) => {
        if ( 'site' !== APP.ArchiveFilter.scope || ! APP.ArchiveFilter.currentSearchGroup || APP.ArchiveFilter.currentPage > 1 ) {
            // skip to next iteration of forEach
            return
        }
        const totalItems = APP.ArchiveFilter.posts.length < APP.ArchiveFilter.perPage ?  APP.ArchiveFilter.posts.length : APP.ArchiveFilter.perPage
        // If the current post is the 4th one (index 3, since JS is 0-indexed)
        // OR if there are fewer than 4 items and this is the last item, insert the promo block
        if ( APP.ArchiveFilter.searchGroups.hasOwnProperty( APP.ArchiveFilter.currentSearchGroup ) &&
            (index === 3 || (totalItems <= 4 && index === totalItems - 1 ) ) ) {
                let promoKey = `${APP.ArchiveFilter.currentSearchGroup}_1_1`
                let promoBlock = APP.ArchiveFilter.promoBlock && APP.ArchiveFilter.promoBlock.hasOwnProperty( promoKey ) ? APP.ArchiveFilter.promoBlock[promoKey] : ''
                if ( promoBlock ) {
                    // Add desktop
                    APP.ArchiveFilter.$grid.append( promoBlock )
                }
        }
    },
    /**
     * Function to show only the first 7 label elements or the ones that match the query
     **/
    _reduceItems : ( query = '', target = null, debounce = true ) => {
        if ( debounce ) {
                // Clear the debounce timer if it exists
            if ( APP.ArchiveFilter.artistFilterDebounceTimer ) {
                clearTimeout( APP.ArchiveFilter.artistFilterDebounceTimer )
            }
            const delayed = () => APP.ArchiveFilter.filteringObject( query, target )
            APP.ArchiveFilter.artistFilterDebounceTimer = setTimeout( delayed , 150 )
        }
        else {
            APP.ArchiveFilter.filteringObject( query, target )
        }
    },
    _remoteRequestRequired : () => {
        // if current result set is not changing in size, but needs to be reordered or filtered from it's current set return false. Otherwise return true.
        if ( APP.ArchiveFilter.foundPosts <= APP.ArchiveFilter.perPage ) {
            return false
        }
        else if ( 'local' === APP.ArchiveFilter.queryTransferMode ){
            return false
        }
        return true
    },
    _scrollFallback : ( gridContainer ) => {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop,
            windowHeight = window.innerHeight,
            documentHeight = document.documentElement.scrollHeight,
            threshold = documentHeight - windowHeight - 100 // 100px from the bottom

        if ( scrollTop > threshold ) {
            APP.ArchiveFilter._showMoreItems( gridContainer )
            window.removeEventListener('scroll', () => {
                APP.ArchiveFilter._scrollFallback._scrollFallback( gridContainer )
            })
        }
        const allItemsVisible = ! gridContainer.querySelector('.archive--grid-wrapper-grid-item:not(.is--visible)')
        if ( allItemsVisible ) {
            window.removeEventListener( 'scroll', APP.ArchiveFilter._boundScrollFallback )
        }
    },
    _searchHandler: (event) => {
        if (event.defaultPrevented) {
            return
        }
    
        const target = event.target
        let container = null,
            input = null,
            control = null,
            searchText = '',
            previousQuery = '',
            handled = false
    
        // Locate the wrapper and container based on the event target
        if (target.classList.contains('inpagetab-items-list-search')) {
            container = target
        } 
        else {
            container = APP.ArchiveFilter._closestAncestor(target, '.inpagetab-items-list-search')
        }
    
        // Find the input and control elements
        if (container) {
            input = container.querySelector('input[type="text"]')
            control = container.querySelector('i.sficon.sficon-search')
        }
    
        // Retrieve the search text if input exists
        if (input) {
            APP.ArchiveFilter.$searchInput = $(input)
            searchText = input.value.trim()
            previousQuery = input.dataset.currentSearch || ''
        }
    
        const hasSearched = container?.classList.contains('has--searched')
    
        // If clicking the search icon after a search, clear the search
        if (target.tagName === 'I' && hasSearched) {
            container.classList.remove('is--searching', 'has--searched')
            input.value = ''
            input.focus()
            handled = true
        }
        // Prevent searching if the input is empty or contains only spaces
        else if (searchText === '') {
            return
        } 
        else {
            // Handle Enter key press
            if (event.key === 'Enter') {
                handled = true
            }
            // Handle click on search icon
            else if (event.type === 'click' && target.tagName === 'I') {
                handled = true
            }
    
            if (handled) {
                APP.ArchiveFilter._searchItems(searchText, input, searchText.length > 0 )
            } 
            else if (previousQuery && searchText && previousQuery !== searchText) {
                container.classList.remove('has--searched')
                input.dataset.currentSearch = searchText
            }
        }
    
        if (handled) {
            event.preventDefault()
        }
    },
    _searchItems: ( query = '', target = null, debounce = true ) => {
        if ( debounce ) {
            // Clear the debounce timer if it exists
           if ( APP.ArchiveFilter.artworkSearchDebounceTimer ) {
               clearTimeout( APP.ArchiveFilter.artworkSearchDebounceTimer )
           }
           const delayed = () => APP.ArchiveFilter._searchQuery( query, target )
           APP.ArchiveFilter.artworkSearchDebounceTimer = setTimeout( delayed , 150 )
       }
       else {
           APP.ArchiveFilter._searchQuery( query, target )
       }
    },
    _searchQuery : ( filterQuery, filterTarget ) => {
        const container = filterTarget.parentNode
        if ( filterQuery.length ) {
            container.classList.remove( 'has--searched' )
            container.classList.add( 'is--searching' )
        }
        else {
            container.classList.remove( 'is--searching' )
            delete filterTarget.dataset.currentSearch
        }
        if ( 'site' === APP.ArchiveFilter.scope ) {
            APP.ArchiveFilter.activeFilters.s = filterQuery
        }
        else {
            APP.ArchiveFilter.activeFilters.search = filterQuery
        }
        filterTarget.dataset.currentSearch = filterQuery
        // Directly search the site if the search is empty
        if (APP.ArchiveFilter.performDirectSearch && APP.ArchiveFilter.scope === 'site' && filterQuery.length ) {
            // Redirect to the search results page
            const searchUrl = `/?s=${encodeURIComponent( filterQuery )}`
            window.location.href = searchUrl
            return
        }

        APP.ArchiveFilter._filterRemoteRequest( APP.ArchiveFilter.currentAction, [ 'APP.ArchiveFilter._searchQueryHandler' ], { overlay: false, container : container  } )
    },
    _searchQueryHandler : ( response, options ) => {
        // the following line are for testing and show be in the onreadystatechange() callback ultimately
        if ( 'undefined' !== typeof options.container ) {
            options.container.classList.remove( 'is--searching')
            options.container.classList.add( 'has--searched' )
        }
        if ( 'site' === APP.ArchiveFilter.scope ) {
            // Update the links and search input after the AJAX search
            APP.ArchiveFilter._updateTabLinks( APP.ArchiveFilter._getActiveSearch() )
        }
        // update grid & grid items
        APP.ArchiveFilter.currentPage = 1
        // transition to an updated grid
        APP.ArchiveFilter._filterArchiveGridTransition()
    },
    _setActiveFilters : ( ) => {
        // Current search value
        const currentSearch = APP.ArchiveFilter._getActiveSearch()
        if ( currentSearch.length ) {
            APP.ArchiveFilter.activeFilters.search = currentSearch
            // if site is scope also set s.
            if ( 'site' === APP.ArchiveFilter.scope ) {
                APP.ArchiveFilter.activeFilters.s = currentSearch
            }
        }
        if ( APP.ArchiveFilter.queryContent.includes( 'event' && APP.ArchiveFilter.defaultDates.length === 2 ) ) {
           APP.ArchiveFilter.activeFilters.dates[0] = APP.ArchiveFilter.defaultDates[0][0]
           APP.ArchiveFilter.activeFilters.dates[1] = APP.ArchiveFilter.defaultDates[1][0]
        }
        // Set default date_created and date_acquired if APP.ArchiveFilter.queryContent contains 'artwork'
        // if ( APP.ArchiveFilter.queryContent.includes( 'artwork' ) ) {}
        // @TODO set default date_created and date_acquired
        if ( 'site' === APP.ArchiveFilter.scope ) {
            if ( 'artist' === APP.ArchiveFilter.currentSearchGroup || 'artwork' === APP.ArchiveFilter.currentSearchGroup ) {
                APP.ArchiveFilter.activeFilters.has_image = false
            }
        }
        // Merge provided parameters with parsed URL parameters
        APP.ArchiveFilter.activeFilters = { ...APP.ArchiveFilter.activeFilters, ...APP.ArchiveFilter.searchParams }
        if ( APP.ArchiveFilter.activeFilters.page ) {
            APP.ArchiveFilter.currentPage = Number( APP.ArchiveFilter.activeFilters.page ) || 1
        }
        // set option only for site search
        if ( 'site' === APP.ArchiveFilter.scope ) {
            APP.ArchiveFilter.classes.grid_wrapper = 'archive--grid-wrapper-overview'
            APP.ArchiveFilter.queryKeys.search = 's'
            APP.ArchiveFilter.$grid = $( '.archive--grid-wrapper-section-grid' )
        }
        // Remove default active values not in use for this scope
        APP.ArchiveFilter._removeActiveFilters( APP.ArchiveFilter.scope )
    },
    // Update the activeFilters (renamed to avoid conflict)
    _setActiveFilterState : ( valueKey, newValue ) => {
        // if valueKey is found in activeFilters, update it
        if ( APP.ArchiveFilter.activeFilters.hasOwnProperty( valueKey ) ) {
            APP.ArchiveFilter.activeFilters[ valueKey ] = newValue
        }
    },
    _setDefaultEventHandling : () => {
        // Event assignments
        // back button handling for filters/pagination. Not needed b/c load event seems to fire with back button.
        $(window).on( 'popstate', APP.ArchiveFilter._popStateHandler )
        // setup date range picker
        $(window).on( 'load', APP.ArchiveFilter._windowLoadHandler )
        // on window resize
        $(window).on( 'resize', APP.ArchiveFilter._windowResizeHandler )
        // things to do when the document has loaded
        $(document).on( 'ready', APP.ArchiveFilter._documentReadyHandler )
        // Close filters dropdowns, other display cleanup/reset
        $(document).on( 'click', APP.ArchiveFilter._bodyClickHandler )
        // Close filters dropdowns
        $(document).on( 'keyup', APP.ArchiveFilter._bodyKeyUpHandler )
        // breakpoints
        $(document).on( 'breakpoint', APP.ArchiveFilter._breakpointHandler )
        // track featured image loading: needed to correct gray background height element (span)
        if ( APP.ArchiveFilter.$featuredImages.length ) {
            // Set load queue
            APP.ArchiveFilter.$featuredImages.each( APP.ArchiveFilter._checkLoaded )
            APP.ArchiveFilter.$featuredImages.on( 'load', APP.ArchiveFilter._featuredImageLoadHandler )
        }            
        // listen for click events on the filter buttons
        APP.ArchiveFilter.$filterButtons.on( 'click', APP.ArchiveFilter._filterButtonClickHandler )
        // listen for click events on the filter items
        APP.ArchiveFilter.$filterGroupItem.on( 'click', APP.ArchiveFilter._filterGroupCheckboxClickHandler )
        // listen for click events on sort group
        APP.ArchiveFilter.$filterSortItem.on( 'click', APP.ArchiveFilter._filterSortRadioClickHandler )
        // listen for click events to clear group of filters
        APP.ArchiveFilter.$filterClearElement.on( 'click', APP.ArchiveFilter._filterClearHandler )
        // listen for click events on the filter items
        APP.ArchiveFilter.$filterDownload.on( 'click', APP.ArchiveFilter._filterDownloadClickHander )
        APP.ArchiveFilter.$filterToggle.on( 'click', APP.ArchiveFilter._filterToggleClickHander )
        APP.ArchiveFilter.$filterToggleButton.on( 'click', APP.ArchiveFilter._filterToggleButtonClickHander )
        // filter header
        APP.ArchiveFilter.$filterHeader.on( 'click', APP.ArchiveFilter._filterHeaderClickHander )
        // date filter save button
        APP.ArchiveFilter.$filterDateButton.on( 'click', APP.ArchiveFilter._filterDateRangeClickHandler )
        // all other save buttons
        APP.ArchiveFilter.$filterSaveButton.on( 'click', APP.ArchiveFilter._filterSaveClickHandler )
        // pagination links
        APP.ArchiveFilter.$paginationContainer.find( '.page-numbers' ).on( 'click', APP.ArchiveFilter._paginationClickHander )
        APP.ArchiveFilter.$filterGroupHeader.find( '.archive--filter-group-close' ).on( 'click', APP.ArchiveFilter._closeFilterGroupClickHander )
        // @TODO
        // Items below here should be moved to separate methods
        APP.ArchiveFilter.$filterDateRadios.on( 'input', ( event ) => {
            const value = event.target.value
            document.querySelector(  ".archive--filter-group-date-range-container[data-filter-active='true']" ).dataset.filterActive = false
            document.querySelector(  `.archive--filter-group-date-range-container[data-date-range='${value}']` ).dataset.filterActive = true
        })
        // Event listener for the input element to filter the label elements based on the entered text
        APP.ArchiveFilter.$filterSearchInputElement.on( 'keyup input change click', APP.ArchiveFilter._filterSearchHandler )
        APP.ArchiveFilter.$filterSearch.on( 'keyup input change click', APP.ArchiveFilter._searchHandler )
    },
    _setDefaultValues : () => {
        // Set values sent from the server in APP.data
        APP.ArchiveFilter.queryKeys = APP.data['queryKeys'] || APP.ArchiveFilter.queryKeys
        APP.ArchiveFilter.postID = APP.data['postID']
        // use spread to avoid reference
        APP.ArchiveFilter.posts = APP.data['archive_filter_posts'] !== null ? [ ...APP.data['archive_filter_posts'] ] : []
        APP.ArchiveFilter.currentItemCount = APP.ArchiveFilter.posts.length
        APP.ArchiveFilter.maxNumPages = APP.data['max_num_pages']
        APP.ArchiveFilter.foundPosts = APP.data['found_posts']
        APP.ArchiveFilter.foundQuery = APP.data['found_query']
        APP.ArchiveFilter.foundPagination = APP.data['found_pagination']
        APP.ArchiveFilter.perPage = typeof APP.data['archive_filter_items_per_page'] != 'undefined' ? APP.data['archive_filter_items_per_page'] : APP.ArchiveFilter.defaultPostsPerPage
        APP.ArchiveFilter.performDirectSearch = APP.data['performDirectSearch'] || APP.ArchiveFilter.performDirectSearch
        APP.ArchiveFilter.queryContent = APP.data['queryContent'] || APP.ArchiveFilter.queryContent
        APP.ArchiveFilter.queryTransferMode = APP.data['queryTransferMode'] || APP.ArchiveFilter.queryTransferMode
        APP.ArchiveFilter.currentAction = APP.data['ajaxAction'] || APP.ArchiveFilter.currentAction
        APP.ArchiveFilter.scope = APP.data['scope'] || APP.ArchiveFilter.scope
        APP.ArchiveFilter.currentSearchGroup = APP.data['activeFacet'] || APP.ArchiveFilter.currentSearchGroup
        APP.ArchiveFilter.searchGroups = APP.data['archive_search_groups'] || APP.ArchiveFilter.searchGroups
        APP.ArchiveFilter.promoDataKey = APP.data['promo_data_key'] || APP.ArchiveFilter.promoDataKey
        // set which callback to use when imageLoad queue is empty
        APP.ArchiveFilter.fnCallbacks['imageLoad'] = APP.ArchiveFilter._fixMaxHeight
        // Set default dates if APP.ArchiveFilter.queryContent contains 'event'
        if ( APP.ArchiveFilter.queryContent.includes( 'event' ) ) {
            // Set default dates, if required by current APP.ArchiveFilter.queryContent
            APP.ArchiveFilter.defaultDates[0] = APP.ArchiveFilter.todayISO.toISOString().split('T')
            APP.ArchiveFilter.defaultDates[1] = new Date( 
                ( APP.ArchiveFilter.todayISO.getFullYear() + 1 ), 
                ( APP.ArchiveFilter.todayISO.getMonth(), 1 ) 
            ).toISOString().split('T')
        }
    },
    _sortPosts : ( obj, sort_key = 'order' ) => {
        if ( Array.isArray( obj ) ) {
            return obj.sort( ( a, b ) => ( a[sort_key] > b[sort_key] ) )
        }
        // @TOOD implement sorting for objects
      // try a loop?
        // for ( const index in APP.ArchiveFilter.posts ) {
        // }
        // or try this?  
        // Object.entries( obj ).sort( ( a, b ) => a[sort_key] > b[sort_key] )
        // Or maybe this?
        // Object.keys( APP.ArchiveFilter.posts ).sort()
        // or this?
        // Object.values( APP.ArchiveFilter.posts ).flatMap( flatSort )
    },
    _setupScrollListener( gridContainer ) {
        if ( 'IntersectionObserver' in window ) {
            APP.ArchiveFilter.observer = new IntersectionObserver( entries => {
                const lastEntry = entries[ entries.length - 1 ]
                if ( lastEntry.isIntersecting ) {
                    APP.ArchiveFilter._showMoreItems( gridContainer )
                }
            }, {
                rootMargin: '100px',
            } )
            const visibleItems = gridContainer.querySelectorAll( '.archive--grid-wrapper-grid-item.is--visible' )
            if ( visibleItems.length && visibleItems[ visibleItems.length - 1 ] ) {
                const lastVisibleItem = visibleItems[visibleItems.length - 1]
                APP.ArchiveFilter.lastVisibleItem = lastVisibleItem
                APP.ArchiveFilter.observer.observe( lastVisibleItem )
            } 
            else {
                console.warn('No visible grid item found for Intersection Observer')
            }
        } 
        else {
            APP.ArchiveFilter._boundScrollFallback = () => {
                APP.ArchiveFilter._scrollFallback( gridContainer )
            }
            // also send gridContainer to _scrollFallback()
            window.addEventListener('scroll', APP.ArchiveFilter._boundScrollFallback )
        }
    },
    _showInitialItems( gridContainer ) {
        const allItems = gridContainer.querySelectorAll('.archive--grid-wrapper-grid-item' )
        allItems.forEach( (item, index ) => {
            if ( index < APP.ArchiveFilter.defaultVisibleItems ) {
                item.classList.add( 'is--visible' )
            }
        })
    },
    _showMoreItems( gridContainer ) {
        const hiddenItems = gridContainer.querySelectorAll('.archive--grid-wrapper-grid-item:not(.is--visible)')
        hiddenItems.forEach(( item, index) => {
            if ( index < APP.ArchiveFilter.defaultVisibleItems ) {
                item.classList.add( 'is--visible' )
            }
        })
        if ( 'IntersectionObserver' in window ) {
            // Update: Reassign the last visible item for the observer
            const newLastItem = gridContainer.querySelectorAll('.archive--grid-wrapper-grid-item.is--visible')
            if ( newLastItem.length && newLastItem[ newLastItem.length - 1 ] ) {
                APP.ArchiveFilter.observer.unobserve( APP.ArchiveFilter.lastVisibleItem )
                APP.ArchiveFilter.observer.observe( newLastItem[ newLastItem.length - 1 ] )
                APP.ArchiveFilter.lastVisibleItem = newLastItem[ newLastItem.length - 1 ]
            }
        }
        APP.MasonryLayout._init()
        const allItemsVisible = ! gridContainer.querySelector('.archive--grid-wrapper-grid-item:not(.is--visible)')
        if ( allItemsVisible && APP.ArchiveFilter.observer ) {
            APP.ArchiveFilter.observer.disconnect()
        }
    },
    _toggle : ( $toggle, value, type = 'toggle', container_has_active = true, menu_has_valid = true ) => {
        const { activeClass, wrapperSelector, valueKey, queryParam, parentTermId } = APP.ArchiveFilter._toggleExtractCommon( $toggle, type )
        // Toggle active class first, so that dirtyFilterValues will be correct
        APP.ArchiveFilter._toggleClass( $toggle, activeClass, value )
        // Now extract state data
        const { validValues, dirtyFilterValues } = APP.ArchiveFilter._toggleExtractState( $toggle, queryParam, parentTermId )
        // Update state/value based on type
        if ( ! $toggle.find('.archive--filter-group-item-checkbox').length ) {
            if ( 'has_audio' !== valueKey && 'has_video' !== valueKey ) {
                APP.ArchiveFilter._setActiveFilterState( valueKey, $toggle.hasClass( activeClass ) ? 1 : 0 )
            }
        }
        // SVG and Checkbox Handling
        APP.ArchiveFilter._toggleSVGAndCheckbox( $toggle, wrapperSelector, activeClass )
        // Menu and Container Status
        APP.ArchiveFilter._toggleMenuAndContainerStatus( $toggle, $toggle.hasClass( activeClass ) ? 1 : 0, container_has_active, menu_has_valid, validValues, dirtyFilterValues )
    },
    // Toggle the active class based on value
    _toggleClass : ( $toggle, activeClass, value, state = undefined ) => {
        if ( 'undefined' === typeof value ) {
            if ( 'undefined' === typeof condition ) {
                $toggle.toggleClass( activeClass )
            }
            else {
                $toggle.toggleClass( activeClass, state )
            }
        }
        else if ( 1 === Number( value ) ) {
            $toggle.addClass( activeClass )
        }
        else if ( 0 === Number( value ) ) {
            $toggle.removeClass( activeClass )
        }
    },
    _toggleDeviceHandler : ( $target, active = true ) => {
        if ( $( window ).width() < 768 ) {
            if ( active ) {
                APP.ArchiveFilter.scrollY = window.scrollY
                // assign lock to html element
                document.documentElement.classList.add( 'is--locked')
                // block pointer events
                $target.get(0).addEventListener( 'pointermove touchmove', ( e ) => e.preventDefault() )
                //$target.on( 'touchmove', ( e ) => ! e.target.closest( $target ) ? e.preventDefault() : true )
            }
            else {
                document.documentElement.classList.remove( 'is--locked' )
                // resume pointer events
                //$target.off( 'pointermove touchmove', ( e ) => e.preventDefault())
                $target.get(0).removeEventListener( 'pointermove touchmove', ( e ) => e.preventDefault() )
                //$target.on( 'touchmove',  ( e ) => ! e.target.closest( $target ) ? e.preventDefault() : true )
                window.scrollTo( 0, APP.ArchiveFilter.scrollY )
            }
        }
    },
    // Extract common variables based on the toggle type
    _toggleExtractCommon : ( $toggle, type ) => {
        let activeClass = `${APP.ArchiveFilter.classes.item_active}`
        let wrapperSelector, valueKey
        if ( 'pdf' === type ) {
            wrapperSelector = '.archive--filter-group-pdf-switch-wrapper'
            valueKey = type
            activeClass = 'archive--filter-group-pdf-switch--active'
        } 
        else if ( 'checkbox' === type ) {
            wrapperSelector = '.archive--filter-group-item-checkbox-wrapper > span'
            valueKey = ''
        } 
        else {
            wrapperSelector = '.archive--filter-group-toggle-switch-wrapper'
            valueKey = $toggle.data( 'switchType' )
        }
        const queryParam = $toggle.parent().data( 'queryParam' ) 
            ? $toggle.parent().data( 'queryParam' ).substring(1) 
            : $toggle.data('switchType') ? $toggle.data('switchType') : ''
        const parentTermId = $toggle.parent().data( 'parentTermid' ) 
            ? $toggle.parent().data( 'parentTermid' ) 
            : ''
        return { activeClass, wrapperSelector, valueKey, queryParam, parentTermId }
    },
    // Extract state data for current toggle
    _toggleExtractState : ( $toggle, queryParam, parentTermId ) => {
        const $groupMenu = $toggle.closest( `.${APP.ArchiveFilter.classes.group_menu}` ),
            validValues = APP.ArchiveFilter.activeFilters[ queryParam ] 
                ? APP.ArchiveFilter.activeFilters[ queryParam ][ parentTermId ] 
                    ? APP.ArchiveFilter.activeFilters[ queryParam ][ parentTermId ] 
                    : 'undefined' !== typeof APP.ArchiveFilter.activeFilters[ queryParam ] 
                        ? APP.ArchiveFilter.activeFilters[ queryParam ] 
                        : [] 
                : [],
            dirtyFilterValues = $groupMenu
                                    .find( `.${APP.ArchiveFilter.classes.item_active}` )
                                    .map( ( index, element ) => $( element ).data().termid || $( element ).data().id || ( APP.ArchiveFilter.activeFilters[ $( element ).data().switchType ] ) )
                                    .get()
        return { validValues, dirtyFilterValues }
    },
    _toggleFilterButtonClasses: ( groupButton, groupMenu, hasActiveFilters ) => {
        const { button_has_active, group_menu_has_active, group_menu_has_valid } = APP.ArchiveFilter.classes
        if ( hasActiveFilters ) {
            groupButton.classList.add( button_has_active )
            groupMenu.classList.add( group_menu_has_active )
            groupMenu.classList.remove( group_menu_has_valid )
        } 
        else {
            groupButton.classList.remove( button_has_active )
            groupMenu.classList.remove( group_menu_has_active, group_menu_has_valid )
        }
    },
    /**
     * Toggles active classes for the button that represents a group of filters.
     * @param {jQuery Object} $target 
     */
    _toggleFilterGroup : ( $target ) => {
        // if target is not a jquery object, make it one
        if ( ! ( $target instanceof jQuery ) ) {
            $target = $( $target )
        }
        const groupButtonClass = `${ APP.ArchiveFilter.classes.group_button }`
        const buttonActiveClass = `${ APP.ArchiveFilter.classes.button_active }`
        const groupMenuActiveClass = `${ APP.ArchiveFilter.classes.group_menu_active }`
    
        if ( $target.hasClass( groupButtonClass ) ) {
            // Toggle active classes for the button
            $target.toggleClass( buttonActiveClass )
            
            // Toggle arrow icons
            const $arrowIcon = $target.find( '.sficon' )
            const newArrowClass = $arrowIcon.hasClass( 'sficon-arrow-down' ) ? 'sficon-arrow-up' : 'sficon-arrow-down'
            $arrowIcon.removeClass( 'sficon-arrow-up sficon-arrow-down' ).addClass( newArrowClass )
    
            // Toggle active class for the menu
            const $groupMenu = $target.next( `.${ APP.ArchiveFilter.classes.group_menu }` )
            $groupMenu.toggleClass( groupMenuActiveClass )
    
            // Device-specific behavior
            APP.ArchiveFilter._toggleDeviceHandler( $target,  $(`.${APP.ArchiveFilter.classes.group_menu_active}`).length )
        }
    
        if ( $target.hasClass( groupMenuActiveClass ) ) {
            // Handle SVG and checkbox manipulations
            APP.ArchiveFilter._toggleSVG( $target, 'add' )
        } 
        else {
            APP.ArchiveFilter._toggleSVG( $target, 'remove' )
        }
    },
    _toggleClass : ( $toggle, activeClass, value, state = undefined ) => {
        if ( 'undefined' === typeof value ) {
            if ( 'undefined' === typeof state ) {
                $toggle.toggleClass( activeClass )
            }
            else {
                $toggle.toggleClass( activeClass, state )
            }
        }
        else if ( 1 === Number( value ) ) {
            $toggle.addClass( activeClass )
        }
        else if ( 0 === Number( value ) ) {
            $toggle.removeClass( activeClass )
        }
    },
    // Handle menu and container status based on valid and dirty values
    _toggleMenuAndContainerStatus : ( $toggle, isActive, container_has_active, menu_has_valid, validValues, dirtyFilterValues ) => {
        const $groupMenu = $toggle.closest( `.${ APP.ArchiveFilter.classes.group_menu }` )
        const areArraysIdentical = APP.ArchiveFilter._areArraysIdentical( validValues, dirtyFilterValues )
    
        // if $toggle has active class
        if ( isActive ) {
            if ( container_has_active ) {
                if ( ! APP.ArchiveFilter._areArraysIdentical( validValues, dirtyFilterValues ) ) {
                    APP.ArchiveFilter._toggleClass( $groupMenu, APP.ArchiveFilter.classes.group_has_active, 1 )
                }
            }
            if ( menu_has_valid ) {
                if ( APP.ArchiveFilter._areArraysIdentical( validValues, dirtyFilterValues ) ) {
                    APP.ArchiveFilter._toggleClass( $groupMenu, APP.ArchiveFilter.classes.group_menu_has_valid, 0 )
                }
                else {
                    APP.ArchiveFilter._toggleClass( $groupMenu, APP.ArchiveFilter.classes.group_menu_has_valid, 1 )
                }
            }
        }
        else {
            if ( container_has_active ) {
                if ( ! APP.ArchiveFilter._areArraysIdentical( validValues, dirtyFilterValues ) ) {
                    APP.ArchiveFilter._toggleClass( $groupMenu, APP.ArchiveFilter.classes.group_has_active, 0 )
                }
                //else if ( ! dirtyFilterValues.length ) {
                //}
            }
            if ( menu_has_valid ) {
                if ( APP.ArchiveFilter._areArraysIdentical( validValues, dirtyFilterValues ) ) {
                    APP.ArchiveFilter._toggleClass( $groupMenu, APP.ArchiveFilter.classes.group_menu_has_valid, 0 )
                }
                else if ( ! dirtyFilterValues.length ) {
                    APP.ArchiveFilter._toggleClass( $groupMenu, APP.ArchiveFilter.classes.group_menu_has_valid, 1 )
                }
                else {
                    APP.ArchiveFilter._toggleClass( $groupMenu, APP.ArchiveFilter.classes.group_menu_has_valid, 1 )
                }
            }
        }
    },
    _toggleSVG : ( $element, action = 'add' ) => {
        if ( action === 'add' ) {
            $element.append( APP.ArchiveFilter.svg )
        } 
        else {
            $element.find( 'svg' ).remove()
        }
    },
    // Handle SVG and Checkbox manipulations
    _toggleSVGAndCheckbox : ( $toggle, wrapperSelector, activeClass ) => {
        const $wrapper = $toggle.find( wrapperSelector )
        if ( $toggle.hasClass( activeClass ) ) {
            APP.ArchiveFilter._toggleSVG( $wrapper )            
            if ( $toggle.find( '.archive--filter-group-item-checkbox' ).length ) {
                $toggle.find( '.archive--filter-group-item-checkbox' ).prop( 'checked', true )
            }
        } 
        else {
            APP.ArchiveFilter._toggleSVG( $wrapper, 'remove' )
            if ( $toggle.find( '.archive--filter-group-item-checkbox' ).length ) {
                $toggle.find( '.archive--filter-group-item-checkbox' ).prop( 'checked', false )
            }
        }
    },
    /**
     * Updates filters based on URL params or passed object
     * @param {Event|null} e - Event object
     * @param {Object} urlParams - Optional parameters to use instead of URL params
     */
    _updateFilters: ( e = null, urlParams = null ) => {
        APP.ArchiveFilter._parseUrlParams()
        let repaint = false
        const mergedFilters = { ...APP.ArchiveFilter.searchParams, ...urlParams },
              filters = { ...APP.ArchiveFilter.activeFilters, ...mergedFilters }
        // reassign
        APP.ArchiveFilter.activeFilters = filters
        // page number
        if ( typeof filters.page !== 'undefined' && filters.page !== '' ) {
            repaint = true
            if (  Number( filters.page ) <= 1 || typeof Number( filters.page ) !== 'number'  ) {
                APP.ArchiveFilter.currentPage = 1
            }
            else {
                APP.ArchiveFilter.currentPage = Number( filters.page )
            }
        }
        // search type
        if ( typeof filters.type !== 'undefined' && filters.type !== '' ) {
            repaint = true
            APP.ArchiveFilter.activeFilters.type = filters.type
        }
        // pdf download
        if ( typeof filters.pdf !== 'undefined' && filters.pdf !== '' && APP.ArchiveFilter.$filterDownload.length ) {
            repaint = true
            // get the correct slice of the items
            if ( Number( filters.pdf ) === 1 ) {
               APP.ArchiveFilter._toggle( APP.ArchiveFilter.$filterDownload, 1, 'pdf', false, false ) 
            }
            else {
               APP.ArchiveFilter._toggle( APP.ArchiveFilter.$filterDownload, 0, 'pdf', false, false ) 
            }
        }
        // terms
        if ( typeof filters.terms !== 'undefined' ) {
            // if there are any terms in the url
            let allTerms = []
            Object.entries( filters.terms ).forEach( ( [ key, value ] ) => {
                value.forEach( ( item, index ) => {
                    const selectString = `.archive--filter-group-menu-wrapper[data-parent-termid='${ Number( key ) }'] label[data-termid='${ Number( value[ index ] ) }']`
                    const $term =  $( selectString )
                    // check filter term checkboxes
                    if ( $term.length ) {
                        const newValue = Number( value[ index ] )
                        if ( newValue ) { 
                            if ( 'undefined' === typeof APP.ArchiveFilter.activeFilters.terms[ key] )  {
                                APP.ArchiveFilter.activeFilters.terms[ key ] = []
                            }
                            if ( ! APP.ArchiveFilter.activeFilters.terms[ key ].includes( newValue ) ) {
                                APP.ArchiveFilter.activeFilters.terms[ key ].push( newValue )
                            }
                            const allTermsObject = {
                                element : $term
                            }
                            allTerms.push( [ allTermsObject  ] )
                        }
                    }
                })
            } )
            allTerms.forEach( ( [ term ] ) => {
                APP.ArchiveFilter._toggle( term.element, 1, 'checkbox', true, false )
            })
            repaint = true
        }
        // artwork classification
        if ( typeof filters.classification !== 'undefined' && filters.classification ) {
            // if there are any terms in the url
            if ( filters.classification !== '' && typeof filters.classification === 'string' ) {
                filters.classification.split( ',' ).forEach( ( item, index ) => {
                    const $term =  $( `label[data-id="${ item }"]` )
                    // uncheck filter term checkboxes
                    APP.ArchiveFilter._toggle( $term, 1, 'checkbox', true, false )
                } )
            }
            repaint = true
        }
        // artist_maker
        if ( typeof filters.artist_maker !== 'undefined' && filters.artist_maker ) {
            // if there are any terms in the url
            if ( filters.artist_maker !== '' && typeof filters.artist_maker === 'string' ) {
                filters.artist_maker.split( ',' ).forEach( ( item, index ) => {
                    const $term =  $( `label[data-id='${ Number( item ) }']` )
                    // uncheck filter term checkboxes
                   APP.ArchiveFilter._toggle( $term, 1, 'checkbox', true, false )
                } )
            }
            repaint = true
        }
        // artist_place
        if ( typeof filters.artist_place !== 'undefined' && filters.artist_place ) {
            // if there are any terms in the url
            if ( filters.artist_place !== '' && typeof filters.artist_place === 'string' ) {
                APP.ArchiveFilter.activeFilters.artist_place = []
                // if filters.artist_place  does not contain any commas, add one trailing comma
                if ( ! filters.artist_place.includes( ',' ) ) {
                    filters.artist_place += ','
                }
                filters.artist_place.split( ',' ).forEach( ( item, index ) => {
                    let selectString = ".archive--filter-suggestion"
                    selectString += " button[data-search-type='artist_geo_live_work'][data-search-string='"
                    const $button =  $( `${ selectString }${ item }']` )
                    if ( $button.length ) {
                        APP.ArchiveFilter.activeFilters.artist_place.push( item )
                    }
                    // triggering button with a click has side effect of repainting and changing the url
                    // $button.trigger( 'click' )
                } )
            }
            repaint = true
        }
        // collection_id
        if ( typeof filters.collection_id !== 'undefined' && filters.collection_id ) {
            // if there are any terms in the url
            if ( filters.collection_id !== '' && typeof filters.collection_id === 'string' ) {
                APP.ArchiveFilter.activeFilters.collection_id = []
                filters.collection_id.split( ',' ).forEach( ( item, index ) => {
                    let selectString = ".archive--filter-suggestion"
                    selectString += " button[data-search-type='collection_id'][data-search-string='"
                    const $button =  $( `${ selectString }${ item }']` )
                    if ( $button.length ) {
                        APP.ArchiveFilter.activeFilters.collection_id.push( item )
                    }
                    // triggering button with a click has side effect of repainting and changing the url
                    // $button.trigger( 'click' )
                } )
            }
            repaint = true
        }
        // collection
        if ( typeof filters.collection !== 'undefined' && filters.collection ) {
            // if there are any terms in the url
            if ( filters.collection !== '' && typeof filters.collection === 'string' ) {
                APP.ArchiveFilter.activeFilters.collection = []
                filters.collection.split( ',' ).forEach( ( item, index ) => {
                    let selectString = ".archive--filter-suggestion"
                    selectString += " button[data-search-type='collection'][data-search-string='"
                    const $button =  $( `${ selectString }${ item }']` )
                    if ( $button.length ) {
                        APP.ArchiveFilter.activeFilters.collection.push( item )
                    }
                    // triggering button with a click has side effect of repainting and changing the url
                    // $button.trigger( 'click' )
                } )
            }
            repaint = true
        }
        // show previous
        if ( typeof filters.show_previous !== 'undefined' && filters.show_previous !== '' ) {
            repaint = true
            const showPreviousValue =  Number( filters.show_previous ) === 1 ? 1 : 0
            APP.ArchiveFilter._toggle( APP.ArchiveFilter.$filterShowPrevious.find('button'), showPreviousValue, 'toggle', true, false )
        }
        // has audio
        if ( typeof filters.has_audio !== 'undefined' && filters.has_audio !== '') {
            repaint = true
            const hasAudioValue = Number( filters.has_audio ) === 1 ? 1 : 0
            APP.ArchiveFilter._toggle( APP.ArchiveFilter.$filterHasAudio.find('button'), hasAudioValue, 'toggle', true, false )
        }
        // has video
        if ( typeof filters.has_video !== 'undefined' && filters.has_video !== '' ) {
            repaint = true
            const hasVideoValue =  Number( filters.has_video ) === 1 ? 1 : 0
            APP.ArchiveFilter._toggle( APP.ArchiveFilter.$filterHasVideo.find('button'), hasVideoValue, 'toggle', true, false )
        }
        
        if ( 'site' === APP.ArchiveFilter.scope ){
            if ( typeof filters.has_image !== 'undefined' && filters.has_image !== '' ) {
                repaint = true
                const hasImageValue = Number( filters.has_image ) === 1 ? 1 : 0
                APP.ArchiveFilter._toggle( APP.ArchiveFilter.$filterHasImage, hasImageValue, 'toggle', false, false ) 
            }
        }
        else if ( 'collection' === APP.ArchiveFilter.scope ) {
            // has image. only show if has_image is not true because by default has_image will be active
            if ( typeof filters.has_image !== 'undefined' && filters.has_image !== '' ) {
                repaint = true
                const hasImageValue = Number( filters.has_image ) === 1 ? 1 : 0
                APP.ArchiveFilter._toggle( APP.ArchiveFilter.$filterHasImage, hasImageValue, 'toggle', false, false ) 
            }
        }
        // on view, only show if on_view is not true because by default on_view will be active
        if ( typeof filters.on_view !== 'undefined' && filters.on_view !== '' ) {
            repaint = true
            const onViewValue = Number( filters.on_view ) === 1 ? 1 : 0
            APP.ArchiveFilter._toggle( APP.ArchiveFilter.$filterOnView, onViewValue, false, false )
        }
        // daterange
        if ( typeof filters.daterange !== 'undefined' && filters.daterange !== ''  ) {
            const dateRange = filters.daterange.split( '-' )
            // Add these values into the date picker ui to show current dates
            // and make the button active state 
            // APP.ArchiveFilter._chooseDateRange( dateRange )
            repaint = true
        }
        // date_created
        if ( typeof filters.date_created !== 'undefined' && Array.isArray( filters.date_created ) && filters.date_created.length ) {
            //const dateCreated = filters.date_created.split( '-' )
            const dateCreated = Array.isArray( filters.date_created ) ? filters.date_created : filters.date_created
            // Add these values into the date picker ui to show current dates
            // and make the button active state 
            // APP.ArchiveFilter._chooseArtworkDateRange( dateCreated, 'date_created' )
            APP.ArchiveFilter._updateDateInputValues( '#range--year-start', '#range--year-end', dateCreated )
            repaint = true
        }
        // date_acquired
        if ( typeof filters.date_acquired !== 'undefined' && Array.isArray( filters.date_acquired ) && filters.date_acquired.length ) {
            const dateAcquired = Array.isArray( filters.date_acquired ) ? filters.date_acquired : filters.date_acquired.split( '-' )
            // Add these values into the date picker ui to show current dates
            // and make the button active state 
            // APP.ArchiveFilter._chooseArtworkDateRange( dateAcquired, 'date_acquired' )
            APP.ArchiveFilter._updateDateInputValues( '#range-acquire--year-start', '#range-acquire--year-end', dateAcquired )

            repaint = true
        }
        // sort
        if ( typeof filters.sort !== 'undefined' ) {
            const $sort =  $( `label[data-sortid='${ filters.sort }']` )
            // uncheck filter term checkboxes
            APP.ArchiveFilter._chooseSort( $sort, 1 )
            // button
            repaint = true
        }
        // if there are filters and the grid is not empty, but the event is not document ready
        if ( repaint && ( e && 'ready' !== e.type && e.target !== document ) ) {
            // transition to an updated grid
            APP.ArchiveFilter._filterArchiveGridTransition( null, false )
        }
        // if the grid is empty and the event is document ready
        else if ( APP.ArchiveFilter._isEmptyElement( APP.ArchiveFilter.$grid.get(0), true ) && repaint && ( e && 'ready' === e.type && e.target === document ) ) {
            APP.ArchiveFilter._filterArchiveGridTransition( null, false, true, 'archive' === APP.ArchiveFilter.scope ? true : false )
        }
        // @TODO should the url be updated here?
        //APP.ArchiveFilter.searchParams = filters
    },
    _updateFilterClean : ( ) => {
        $otherFilterGroups = APP.ArchiveFilter._getActiveFilterButtons()
        // Add pdf filter if it exists
        if ( $( '.archive--filter-group-pdf-switch--active' ).length ) {
            $otherFilterGroups.add( '.archive--filter-group-pdf-switch--active' )
        }
        // @TODO artist_maker & artist_place if either exists, and artwork classification if it exists or is 
        // that not neeeded b/c those items are checkboxes thus found above already?

        // @TODO if neccessary
        // Add date filter if it exists
        if ( $( '.archive--filter-group-button--has--active[data-filter-type="date"]' ).length ) {
            // @TODO this doesn't work b/c archive--filter-group-date-range--active doesn't exist
            //$otherFilterGroups.add( '.archive--filter-group-date-range--active' )
        }
        // created date if it exists
        if ( $( '.archive--filter-group-date-range-container--has--active[data-date-range="created"]' ).length ) {
             // @TODO this doesn't work
            //$otherFilterGroups.add( '.archive--filter-group-date-created-range--active' )
        }
        // acquired date if it exists 
        if ( $( '.archive--filter-group-date-range-container--has--active[data-date-range="acquired"]' ).length ) {
             // @TODO this doesn't work
            //$otherFilterGroups.add( '.archive--filter-group-date-acquired-range--active' )
        }
        // If any suggested items are active
        if ( $( '.archive--filter-suggestion--has-active' ).length ) {
            $otherFilterGroups.add( '.archive--filter-suggestion--has-active' )
        }
        // Do other active filters exist?
        if ( $otherFilterGroups.length ) {
           APP.ArchiveFilter._filterClearAll( $otherFilterGroups )
           APP.ArchiveFilter.$archiveGrid.removeClass( 'archive--grid-pagination--active' )
        }
    },
    /**
	 * [_updateGrid ]
	 */
	_updateGrid : ( updateFilterValues = true ) => {
        if ( updateFilterValues ) {
            // Update the active filter values
            APP.ArchiveFilter._updateActiveFilterValues()
        }
        // clear all posts from the grid
		APP.ArchiveFilter.$grid.empty()

        // apply the filters and render the new terms to each item
        //APP.ArchiveFilter._getPostsFromActiveFilters( APP.ArchiveFilter.perPage )
        //    .forEach( APP.ArchiveFilter._renderGridItem )

        // store the posts from the active filters
        const posts = APP.ArchiveFilter._getPostsFromActiveFilters( APP.ArchiveFilter.perPage )
        // iterate and render each post
        posts.forEach( (post, index) => {
            // Render the regular grid item
            APP.ArchiveFilter._renderGridItem( post )
            APP.ArchiveFilter._renderPromoItem( index )
        } )

        // new images were added
        APP.ArchiveFilter._imageLowResLoader()
        // maybe hide header?
		APP.ArchiveFilter._maybeHideHeader()
    },
    _updateActiveFilterValues : ( groupMenuElement = null ) => {
        const $activeButtonElement = APP.ArchiveFilter._getActiveFilterButtons(),
            activeDatesElement = APP.ArchiveFilter._getActiveDates(),
            activeDateCreatedElement = APP.ArchiveFilter._getActiveDateCreated(),
            activeDateAcquiredElement = APP.ArchiveFilter._getActiveDateAcquired(),
            $activeSuggested = APP.ArchiveFilter._getActiveSuggested(),
            $activeSortElement = APP.ArchiveFilter._getActiveSort()

        // Update global values
        if ( 'site' === APP.ArchiveFilter.scope ) {
            APP.ArchiveFilter.activeFilters.s = APP.ArchiveFilter._getActiveSearch()
            if ( APP.ArchiveFilter.currentSearchGroup === 'artwork' || APP.ArchiveFilter.currentSearchGroup === 'artist' ) {
                APP.ArchiveFilter.activeFilters.has_image = APP.ArchiveFilter._getActiveHasImage()
            }
            if ( 'events' === APP.ArchiveFilter.currentSearchGroup || 'exhibition' === APP.ArchiveFilter.currentSearchGroup ) {
                APP.ArchiveFilter.activeFilters.show_previous = APP.ArchiveFilter._getActiveShowPrevious()
            }
        }
        else if ( 'collection' === APP.ArchiveFilter.scope || 'archive' === APP.ArchiveFilter.scope ) {
            // find active sort
            APP.ArchiveFilter.activeSort = APP.ArchiveFilter._findActiveSort( $activeSortElement )
            // get terms from buttons with active classes. is this used at all?
            APP.ArchiveFilter.activeTerms = APP.ArchiveFilter._findActiveTerms( $activeButtonElement )
            // find active filter terms
            APP.ArchiveFilter.activeFilters.terms = APP.ArchiveFilter._findActiveFilterTerms( $activeButtonElement )
            // find active filter parents
            APP.ArchiveFilter.activeFilters.parents = APP.ArchiveFilter._findActiveFilterParents( $activeButtonElement )
            if ( 'collection' === APP.ArchiveFilter.scope ) {
                // find search filter
                APP.ArchiveFilter.activeFilters.search = APP.ArchiveFilter._getActiveSearch()
                // find active filter artwork has_image
                APP.ArchiveFilter.activeFilters.has_image = APP.ArchiveFilter._getActiveHasImage()
                // find active filter artwork on_view
                APP.ArchiveFilter.activeFilters.on_view = APP.ArchiveFilter._getActiveOnView()
                // find active filter dates
                APP.ArchiveFilter.activeFilters.dates = APP.ArchiveFilter._findActiveFilterDates( activeDatesElement )
                // find active filter arist_place
                APP.ArchiveFilter.activeFilters.artist_place = APP.ArchiveFilter._getActiveArtistPlace( $activeSuggested )
                // Find active filter collection_id
                APP.ArchiveFilter.activeFilters.collection_id = APP.ArchiveFilter._getActiveCollectionId( $activeSuggested )
                // Find active filter collection
                APP.ArchiveFilter.activeFilters.collection = APP.ArchiveFilter._getActiveCollectionName( $activeSuggested )
            }
        }
    
        // update values within groupMenuElement if it is passed
        if ( groupMenuElement && 'collection' === APP.ArchiveFilter.scope ) {
            // if groupMenuElement contains a createor or acquired date filter
            if ( groupMenuElement.querySelector( '.archive--filter-group-date-range-container' ) ) {
                // find active filter creation dates
                APP.ArchiveFilter.activeFilters.date_created = APP.ArchiveFilter._findActiveFilterDateCreated( activeDateCreatedElement )
                // find active filter acquired dates
                APP.ArchiveFilter.activeFilters.date_acquired = APP.ArchiveFilter._findActiveFilterDateAcquired( activeDateAcquiredElement )
            }
            else if ( groupMenuElement.querySelector( '#archive--filter-group-item-search-artwork_classification_filter_search' ) ) {
                // find active filter artwork classification
                APP.ArchiveFilter.activeFilters.classification = APP.ArchiveFilter._findActiveFilterArtworkClassification( $activeButtonElement )
            }
            else if ( groupMenuElement.querySelector( '#archive--filter-group-item-search-artist_filter_search' ) ) {
                // find active filter artist_maker
                APP.ArchiveFilter.activeFilters.artist_maker = APP.ArchiveFilter._findActiveFilterArtistMaker( $activeButtonElement )
            }
            else if ( groupMenuElement.querySelector( '[data-switch-type="has_audio"]' ) || groupMenuElement.querySelector( '[data-switch-type="has_video"]' ) ) {
                // find active filter artwork has_audio
                APP.ArchiveFilter.activeFilters.has_audio = APP.ArchiveFilter._getActiveHasAudio()
                // find active filter artwork has_video
                APP.ArchiveFilter.activeFilters.has_video = APP.ArchiveFilter._getActiveHasVideo()
            }
        }
    },
    /**
     * Updates the values of start and end inputs.
     * @param {string} startInputSelector - Selector for the start input element.
     * @param {string} endInputSelector - Selector for the end input element.
     * @param {Array} values - Array containing the start and end values [start, end].
     */
    _updateDateInputValues : ( startInputSelector, endInputSelector, values ) => {
        if ( ! Array.isArray( values ) || values.length !== 2 ) {
            console.error('Invalid values provided to updateInputValues:', values )
            return
        }
        const [ startValue, endValue ] = values
        $( startInputSelector ).val (startValue ).change()
        $( endInputSelector ).val (endValue ).change()
    },
    /**
     * [_updateTabLinks ]
     */
    _updateTabLinks : ( newQuery ) => {
        // Update the data-current-search attribute on the search input
        if ( APP.ArchiveFilter.$searchInput ) {
            APP.ArchiveFilter.$searchInput.get(0).value = newQuery
            APP.ArchiveFilter.$searchInput.get(0).setAttribute( 'data-current-search', newQuery )
        }
        // Update the href attributes in the tab links
        if ( APP.ArchiveFilter.$tabLinkItems && APP.ArchiveFilter.$tabLinkItems.length ){
            $.each( APP.ArchiveFilter.$tabLinkItems, ( index, link ) => {
                const url = new URL( link.href, window.location.origin )
                url.searchParams.set( 's', newQuery )
                link.href = url.toString()                
            })
        }
    },
    /**
     * [_windowLoadHandler set up datepicker]
     */
    _windowLoadHandler : () => {
        // move the search box depending on the screen size
        APP.ArchiveFilter._moveSearchBox()
        // Code below only works for events
        // return if UpcomingEventdates doesn't exist
        if ( typeof APP.data['UpcomingEventDates'] === 'undefined' ) {
            return
        }
        // try to get the upcoming dates
        if ( APP.data['UpcomingEventDates'].length > 0 ) {
           APP.ArchiveFilter.upcomingEventDates = APP.data['UpcomingEventDates']
        }
        // try to get the closed dates
        if ( typeof APP.data['ClosedEventDates'] != 'undefined' ) {
           APP.ArchiveFilter.closedEventDates = APP.data['ClosedEventDates']
        }
    },
    _windowResizeHandler : ( e ) => {
        document.documentElement.style.setProperty(
            '--window-inner-height',
            `${window.innerHeight}px`
        )
       APP.ArchiveFilter._fixMaxHeight() 
       APP.ArchiveFilter._moveSearchBox()
    },
}
APP.ArchiveFilter._init()
APP.ArtworkSingleImage = {
	wrapper : $('#artworkimage'),
	image : $('.artworksingleimage-image'),
	element : $('.artworksingleimage'),
	infobar : $('.artworkinfobar'),
	viewer : undefined,
	openSeaDragon : { 
		imagesPath : APP.data.SetupTheme.theme_url + '/js/vendor/osd-images/'
	},
	_init : function() {
		if ( APP.ArtworkSingleImage.image.length === 0 ) {
			return;
		}

		if ( typeof APP.data['openseadragon'] != 'undefined' && typeof APP.data['openseadragon']['images_path'] != 'undefined' ) {
			// reassign it if it exists
			APP.ArtworkSingleImage.openSeaDragon.imagesPath = APP.data['openseadragon']['images_path']
		}

		if ( APP.ArtworkSingleImage.image.hasClass( 'full' ) || APP.ArtworkSingleImage.image.hasClass( 'artwork-2000' ) || APP.ArtworkSingleImage.image.hasClass( 'ema_8000' ) ) {
			const showControls = APP.ArtworkSingleImage.image.hasClass( 'ema_8000' ) ? false : true
			APP.ArtworkSingleImage.zoomInButton = document.getElementById('zoom-in')
			APP.ArtworkSingleImage.zoomOutButton = document.getElementById('zoom-out')	
			APP.ArtworkSingleImage.viewer = OpenSeadragon( {
				id : 'artworksingleimage',
				element : APP.ArtworkSingleImage.element[0],
				prefixUrl : APP.ArtworkSingleImage.openSeaDragon.imagesPath,
				springStiffness : 10.5,
				gestureSettingsMouse :{
					scrollToZoom : false
				},
				visibilityRatio : 0.95,
				constrainDuringPan : true,
				zoomInButton : 'zoom-in',
				zoomOutButton : 'zoom-out',
				fullPageButton : 'zoom-full',
				homeButton : 'home-button',
				showNavigationControl : showControls ? true : false,
				showFullPageControl : showControls ? true : false,
				mouseNavEnabled : showControls ? true : false,
				tileSources : {
					buildPyramid: false,
					type : 'image',
					url : APP.ArtworkSingleImage.image.attr('src'),
					height:  APP.ArtworkSingleImage.image.height,
				},
				maxZoomPixelRatio : 1,
				minZoomImageRatio : .9,
			//	debugMode:  true,
			})			
			APP.ArtworkSingleImage.viewer.addHandler( 'full-screen', (event) => {
				if ( event.fullScreen ) {
					// add click event to zoom in and out buttons to zoom in and out
					APP.ArtworkSingleImage.zoomInButton = document.getElementById('zoom-in')
					APP.ArtworkSingleImage.zoomOutButton = document.getElementById('zoom-out')	

					APP.ArtworkSingleImage.zoomInButton.addEventListener('click', function() {
						APP.ArtworkSingleImage.viewer.viewport.zoomBy(1.2)
					})
					APP.ArtworkSingleImage.zoomOutButton.addEventListener('click', function() {
						APP.ArtworkSingleImage.viewer.viewport.zoomBy(0.8)
					})
				} 
				else {
					APP.ArtworkSingleImage.zoomInButton = document.getElementById('zoom-in')
					APP.ArtworkSingleImage.zoomOutButton = document.getElementById('zoom-out')	
					// remove click event to zoom in and out buttons to zoom in and out
					APP.ArtworkSingleImage.zoomInButton.removeEventListener('click', function() {
						APP.ArtworkSingleImage.viewer.viewport.zoomBy(1.2)
					})
					APP.ArtworkSingleImage.zoomOutButton.removeEventListener('click', function() {
						APP.ArtworkSingleImage.viewer.viewport.zoomBy(0.8)
					})
				}
			})

			APP.ArtworkSingleImage.viewer.addHandler( 'canvas-scroll', ( event ) => {
				event.preventDefault = false
			})

			if( typeof APP.ArtworkSingleImage.infobar !== 'undefined' ){
				APP.ArtworkSingleImage.infobar.clone().addClass('dark').appendTo(APP.ArtworkSingleImage.element);
				$('.artworkinfobar.dark #zoom-full').on( 'click', APP.ArtworkSingleImage._closeFullScreen);
			}
			// zoom out as far as possible when first loading the artwork
			APP.ArtworkSingleImage.viewer.addHandler('open', function() {
				APP.ArtworkSingleImage.viewer.viewport.zoomTo(0.1, null, true);
				APP.ArtworkSingleImage.viewer.viewport.applyConstraints();
			});
			APP.ArtworkSingleImage.viewer.addHandler('zoom', function() {
				if (window.outerWidth < 576 ) {
					var zoom = APP.ArtworkSingleImage.viewer.viewport.getZoom();
					if (zoom > APP.ArtworkSingleImage.viewer.minZoomImageRatio) {
						APP.ArtworkSingleImage._setInteractionEnabled(true);
					} else if (zoom <= APP.ArtworkSingleImage.viewer.minZoomImageRatio) {
						APP.ArtworkSingleImage._setInteractionEnabled(false);
					}
				}
			});
		}
		else {
			APP.ArtworkSingleImage.viewer = OpenSeadragon( {
				id : 'artworksingleimage',
				element : APP.ArtworkSingleImage.element[0],
				prefixUrl : APP.ArtworkSingleImage.openSeaDragon.imagesPath,
				tileSources : {
					buildPyramid: false,
					type : 'image',
					url : APP.ArtworkSingleImage.image.attr('src'),
					height:  APP.ArtworkSingleImage.image.height,
				},
				showNavigationControl : false,
				showFullPageControl : false,
				mouseNavEnabled :  false,
			//	debugMode:  true,
			} )
			// APP.ArtworkSingleImage.image.addClass('loaded')
		}
	},
	_setInteractionEnabled : function(value){
		APP.ArtworkSingleImage.viewer.setMouseNavEnabled(value);
		var touchAction = value ? 'none' : 'auto';
		if (typeof APP.ArtworkSingleImage.viewer.canvas.style.touchAction !== 'undefined') {
			APP.ArtworkSingleImage.viewer.canvas.style.touchAction = touchAction;
		} 
		else if (typeof APP.ArtworkSingleImage.viewer.canvas.style.msTouchAction !== 'undefined') {
			APP.ArtworkSingleImage.viewer.canvas.style.msTouchAction =  touchAction;
		}
	},
	_closeFullScreen : function(e){
		OpenSeadragon.exitFullScreen()
	}
}

APP.ArtworkSingleImage._init();
APP.ArtworkInfoBar = {
	/**
	 * [icon the info bar's icon]
	 * @type {jquery obj}
	 */
	icon : $('.sficon-info.artworkinfobar-icon'),
	/**
	 * [longDescription the long caption on the info bar]
	 * @type {jquery obj}
	 */
	longDescription : $('.artworkinfobar-longcaption'),
	/**
	 * [_init entry point, registers event listener for icon]
	 */
	_init : function(){
		APP.ArtworkInfoBar.icon.on('click', APP.ArtworkInfoBar._iconClickHandler);
	},
	/**
	 * [_iconClickHandler toggles the slide effect]
	 * @param  {obj} e event object
	 */
	_iconClickHandler : function(e){
		APP.ArtworkInfoBar.longDescription.slideToggle();
	}
};

// APP.ArtworkInfoBar._init();
// this is a global component used to determine which breakpoint we're at
// to listen for the event do $(document).on('breakpoint', eventHandlerCallback);
// callback accepts normal amount of params that a js event listener callback would have
// but there's a custom property added to the event object called "name"
// assuming in the callback the event object variable passed in is e: console.log(e.device);
APP.Breakpoint = {
	name : 'xxsmall',
	direction : '',
	orientation : '',
	orientationChecks : {},
	prevWW : '',
	mediaQueryList : window.matchMedia( "(orientation: landscape)" ),
	breakpoints : {
		'xxxlarge' : 1920,
		'xxlarge' : 1400,
		'xlarge' : 1200,
		'largeplus' : 1024,
		'large' : 992,
		'medium' : 768,
		'small' : 576,
		'xsmall' : 414,
		'xxsmall' : 375,
	},
	_init : () => {
		APP.Breakpoint.prevWW = $(window).width()
		$(window).on( 'resize load', APP.Breakpoint._resizeLoadHander )
		APP.Breakpoint.mediaQueryList.addListener( APP.Breakpoint._handleOrientationChange )
		APP.Breakpoint._handleOrientationChange()
	},
	_resizeLoadHander : (e) => {
		if ( e.type == 'resize' ) {
			APP.Breakpoint._handleOrientationChange()

			if ( APP.Breakpoint.prevWW > $(window).width() ){
				APP.Breakpoint.direction = 'down';
			}
			else {
				APP.Breakpoint.direction = 'up';	
			}
		}

		$.each( APP.Breakpoint.breakpoints, ( key, value ) => {
			var objkeys = Object.keys( APP.Breakpoint.breakpoints )
			// if last pair in breakpoints
			if( key == objkeys[ objkeys.length - 1 ] ){
				if( $(window).width() < objkeys[objkeys.indexOf(key) - 1] && APP.Breakpoint.name != key ){
					APP.Breakpoint.name = key;		
					APP.Breakpoint._dispatchEvent();
				}
			}
			// if first pair in breakpoints
			else if ( key == objkeys[0] ){
				if( $(window).width() > value - 1 && APP.Breakpoint.name != key ){
					APP.Breakpoint.name = key;
					APP.Breakpoint._dispatchEvent();
				}
			}
			// if other pairs in breakpoints
			else{
				if( $(window).width() <= APP.Breakpoint.breakpoints[objkeys[objkeys.indexOf(key) - 1]] - 1 && $(window).width() > value - 1 && APP.Breakpoint.name != key ){
					APP.Breakpoint.name = key;	
					APP.Breakpoint._dispatchEvent();
				}
			}
		});
	},
	/**
	 * [_is run conditional test on breakpoint name]
	 * @param  {string}  op   accepted operators are < > == <= >=
	 * @param  {string}  name accepted names are in breakpoints prop
	 * @return {bool}      
	 */
	_is : function( op, name ) {
		var objkeys = Object.keys( APP.Breakpoint.breakpoints ).reverse();
		var currentIndex = objkeys.indexOf( APP.Breakpoint.name );
		
		if ( objkeys.indexOf( name ) !== -1 ){
			if( op == '>' || op == '<' || op == '==' || op == '<=' || op == '>=' ){
				switch(op){
					case '>':
						return currentIndex > objkeys.indexOf(name);
						break;

					case '<':
						return currentIndex < objkeys.indexOf(name);
						break;

					case '==':
						return currentIndex == objkeys.indexOf(name);
						break;

					case '<=':
						return currentIndex <= objkeys.indexOf(name);
						break;

					case '>=':
						return currentIndex >= objkeys.indexOf(name);
						break;
				}
			}
			else{
				console.error('Invalid first param in _is. Current accepted values are >, <, ==, <= and >=');
			}
		}
		else{
			console.error('Invalid second param in _is');
		}
	},
	_handleOrientationChange : () => {
		const mql = APP.Breakpoint.mediaQueryList,
		checks = {
			'media' : mql.matches ? 'landscape' : 'portrait',
			'orientation' : '',
			'manual' : window.innerHeight > window.innerWidth ? 'portrait' : 'landscape',
			'degree' : 0,
		}
		if ( 'undefined' !== typeof screen ) {
			if ( 'undefined' !== typeof screen.orientation && 'undefined' !== typeof screen.orientation.angle ) {
				checks.degree = screen.orientation.angle
			}
			else if ( 'undefined' !== typeof screen.height && 'undefined' !== typeof screen.width ) {
				checks.degree = screen.height > screen.width ? 0 : 90
			}
		}
		else if ( 'undefined' !== typeof window.orientation ) {
			checks.degree = window.orientation
		}
		checks.orientation = checks.degree === 90 || checks.degree === -90 ? 'landscape' : 'portrait'	
		if ( checks.media === checks.manual === checks.orientation ) {
			APP.Breakpoint.orientation = checks.orientation
		}
		else if ( checks.media === checks.manual ) {
			APP.Breakpoint.orientation = checks.media
		}
		else if ( checks.media === checks.orientation ) {
			APP.Breakpoint.orientation = checks.orientation
		}
		else if ( checks.manual === checks.orientation ) {
			APP.Breakpoint.orientation = checks.orientation
		}
		else {
			APP.Breakpoint.orientation = checks.manual
		}
		APP.Breakpoint.orientationChecks = checks
		document.body.classList.remove( 'is--landscape' )
		document.body.classList.remove('is--portrait')
		document.body.classList.add( `is--${APP.Breakpoint.orientation}` )
	},
	_dispatchEvent : function(){
		$(document).trigger($.Event('breakpoint', {device: APP.Breakpoint.name, direction : APP.Breakpoint.direction}));
	},
}
APP.Breakpoint._init();
APP.ColorManager = class ColorManager {
    static defaultColors = [
      '#FF483B', // Warm Red
      '#B6DEBE', // Mint
      '#E2E735', // Chartreuse
      '#00513F', // Forest Green
      '#001489', // Dark Blue
      '#FFBB9A', // Melon
      '#C028B9', // Magenta
      '#5771E6', // Cornflower Blue
      '#FFEA99', // Yellow
      '#C9B6F4', // Lavender
      '#FFDFED', // Pale Pink
      '#FF98CA', // Bubblegum Pink
      '#FF7F40', // Orange
      '#00BC70'  // Green
    ]
  
    static #currentColorIndex = 0
    static #usedColors = new Set()
  
    static get colors() {
      // Check if APP.data['color_palette'] exists and has values
      return (typeof APP !== 'undefined' && 
              APP.data?.color_palette?.length > 0) 
        ? APP.data.color_palette 
        : ColorManager.defaultColors
    }
  
    static getBackgroundColor(mode = 'sequential') {
      if (mode === 'random') {
        // Get available colors by filtering out used ones
        const availableColors = ColorManager.colors.filter(
          color => !ColorManager.#usedColors.has(color)
        )
  
        // Reset if all colors have been used
        if (availableColors.length === 0) {
          ColorManager.#usedColors.clear()
          availableColors.push(...ColorManager.colors)
        }
  
        // Select random color from available ones
        const randomIndex = Math.floor(Math.random() * availableColors.length)
        const color = availableColors[randomIndex]
        
        // Add to used colors
        ColorManager.#usedColors.add(color)
        
        return color
      } 
      else if (mode === 'sequential') {
        const color = ColorManager.colors[ColorManager.#currentColorIndex]
        ColorManager.#currentColorIndex = (ColorManager.#currentColorIndex + 1) % ColorManager.colors.length
        return color
      }
    }
  
    // Add a method to reset the color index
    static reset() {
      ColorManager.#currentColorIndex = 0
      ColorManager.#usedColors.clear()
    }
  }
/**
 * The DisableRightClick estate has requested that we disable right-click-save-as for any of his images we use on the site
 * 
 */
APP.DisableRightClick = {
	/**
	 * [class to apply to images that should not be right clickable]
	 * @type {jquery obj}
	 */
	selection : $('.disablerightclick, .disablerightclick ~ .openseadragon-container'),
	/**
	 * [_init entry point, registers event listener for icon]
	 */
	_init : function(){
		APP.DisableRightClick.selection.bind('contextmenu', APP.DisableRightClick._selectionClickHandler);
	},
	/**
	 * [_selectionClickHandler prevents right clicks]
	 * @param  {obj} e event object
	 */
	_selectionClickHandler : function(e){
		return false;
	}
};

APP.DisableRightClick._init();
/**
 * [DigitalPublication for the querying and filtering of the filtered digital publication grid]
 * @type {Object}
 */
APP.DigitalPublication = {
	digitalPublicationGridSection : $('.publicationsgrid'),
	digitalPublicationGrid : $( '.publicationsgrid--grid' ),
	digitalPublicationFeatured : $('.publicationsgrid--grid-wrapper-grid-item-pick-text-title').parents('.publicationsgrid--grid-wrapper-grid-item'),
	digitalPublicationNoResultsFeatured : $('.publicationsgrid--no-results--featured'),
	/**
	 * [grids list of grids on the page]
	 * @type {array}
	 */
	 grids : [],
	/**
	 * [grids list of grids on the page]
	 * @type {array}
	 */
	gridData : [],
	/**
	 * [posts list of posts that have been retreived from a response but maybe not displayed]
	 * @type {array}
	 */
	posts : undefined,
	gridPosts : [],
	/**
	 * [grid the grid of items]
	 * @type {jQuery obj}
	 */
	grid : $( '.publicationsgrid--wrapper-grid > ul' ),
	/**
	 * [gridItems list of grid items that are being displayed]
	 * @type {jQuery obj}
	 */
	gridItems : $( '.publication--list-item' ),
	paginationContainers : $( '.pagination--use-js' ),
	paginationLinks : $( 'a.page-numbers' ),
	pagerQueryKey : '_page',
	/**
	 * [titleRelation the text saying "relating to" in the title]
	 * @type {jQuery obj}
	 */
	titleRelation : $( '.publicationsgrid--grid-wrapper-title-relation' ),
	/**
	 * [titleTags the text that will contain the tag names in the title]
	 * @type {jQuery obj}
	 */
	titleTags : $( '.publicationsgrid--grid-wrapper-title-tag' ),
	lastMouseDownX : 0,
	lastMouseDownY : 0,
	pageGroupCount : 12,
	lastMouseDownWasOutside : false,
	currentPage : {},
	totalPage : {},
	currentItemCount : {},
	perPage : {},
	footerLinks : {},
	scrollToOffets : { 
	   'medium' : 100,
	   'large' : 115,
	   'xlarge' : 165,
	   'xxlarge' : 375,
	},
	// svgs : {
	// 	arrow_previous : `<svg width="14" height="13" viewBox="0 0 14 13" fill="none" xmlns="http://www.w3.org/2000/svg">
	// 	<path fill-rule="evenodd" clip-rule="evenodd" d="M12.8257 13L14 11.6907L9.34763 6.5L14 1.30836L12.8258 -1.02656e-07L7 6.5L12.8257 13Z" fill="#636668"/>
	// 	<path fill-rule="evenodd" clip-rule="evenodd" d="M5.82575 13L7 11.6907L2.34763 6.5L7 1.30836L5.82575 -3.70877e-07L6.87457e-07 6.5L5.82575 13Z" fill="#636668"/>
	// 	</svg>`,
	// 	arrow_next : `<svg width="14" height="13" viewBox="0 0 14 13" fill="none" xmlns="http://www.w3.org/2000/svg">
	// 	<path fill-rule="evenodd" clip-rule="evenodd" d="M1.17425 0L0 1.30929L4.65237 6.5L0 11.6916L1.17425 13L7 6.5L1.17425 0Z" fill="#636668"/>
	// 	<path fill-rule="evenodd" clip-rule="evenodd" d="M8.17425 0L7 1.30929L11.6524 6.5L7 11.6916L8.17425 13L14 6.5L8.17425 0Z" fill="#636668"/>
	// 	</svg>`
	// },
	swipers : [],
	/**
	 * [_init entry point]
	 */
	_init : () => {
		// we on the filtered digitalPublication page template & is posts & terms stored globally on this page?
		if ( ( 
			$( 'body' ).hasClass( 'page-template-page-digital-publication' ) 
			|| $('body').hasClass('publication-template-page-digital-publication') 
			|| $('body').hasClass('dp--post-artist')
			|| $('body').hasClass('dp--post-essays')
			|| $('body').hasClass('dp--post-research-materials')
			|| $('body').hasClass('dp--post-watch')
			|| $('body').hasClass('dp--post-listen')
			) 
			&& typeof APP.data['publicationsgrid'] != 'undefined' ) {
			// reassign it if it exists
			APP.DigitalPublication.gridData = APP.data['publicationsgrid']
			// set current per page
			// APP.DigitalPublication.perPage = typeof APP.data['archive_filter_items_per_page'] != 'undefined' ? APP.data['archive_filter_items_per_page'] : 20
			
			// Event assignments
			// back button handling for filters/pagination. Not needed b/c load event seems to fire with back button.
			// $(window).on( 'popstate', APP.DigitalPublication._popStateHandler )
			// things to do on load
			// $(document).on( 'ready', APP.DigitalPublication._documentReadyHandler )
			// breakpoints
			// $(document).on( 'breakpoint', APP.DigitalPublication._breakpointHandler )
			// pagination links		
			APP.DigitalPublication.paginationLinks.on( 'click', APP.DigitalPublication._paginationClickHander )
			
			APP.DigitalPublication.digitalPublicationGridSection.get().forEach( ( item, index ) => {
				const data = $(item).data()
				if ( data && typeof APP.DigitalPublication.gridData[ data.pagerKey ] != 'undefined' ) {
					const posts = APP.DigitalPublication.gridData[ data.pagerKey ]
					posts.section = item
					APP.DigitalPublication.gridPosts[ data.pagerKey ] = posts
					APP.DigitalPublication.currentItemCount[ data.pagerKey ] = posts.length;
					APP.DigitalPublication.perPage[ data.pagerKey ] = typeof posts.items_per_page != 'undefined' ? posts.items_per_page : 6
					APP.DigitalPublication.footerLinks[ data.pagerKey ] = typeof posts.footer_link != 'undefined' ? posts.footer_link : {}

				}
			} )
			const switperContainer = $( '.swiper.publication--swiper' ).get()
			if ( $(switperContainer).hasClass('publicationsgrid--artwork') ) {
			}
			else {
				//	console.log(switperContainer, $(switperContainer) )
			}
			switperContainer.forEach( ( item, index ) => {
				let data = $( item ).find( '.swiper-wrapper' ).data()
				if ( typeof data === 'undefined' ) {
					return
				}
				let swiperParameters = {
					slidesPerGroup : typeof data.slidesPerGroup !== 'undefined' ? data.slidesPerGroup : 1,
					slidePerView : typeof data.slidesPerView !== 'undefined' ? data.slidesPerView : 1,
					// slidesPerView : typeof data.perPage !== 'undefined' ? data.perPage : 1,
					// loop: true,
					//grid : {
					//	rows : typeof data.perColumn !== 'undefined' ? data.perColumn : 1,
					//},
					on: {
						afterInit : APP.DigitalPublication.renderSwiperSlideChange,
						slideChange : APP.DigitalPublication.renderSwiperSlideChange
					},
					keyboard: {
						enabled: true,
						onlyInViewport: true,
					},
				}
				let pagesEl = null
				let nextEl = $( item ).parent().find( '.swiper-next' )
				let prevEl =  $( item ).parent().find( '.swiper-previous' )
				
				if ( $( item ).parent().find( '.pagination' ).length ) {
					pagesEl = $( item ).parent().find( '.pagination' )
				}
				else if ( $( item ).parent().prev( '.pagination' ).length ) {
					pagesEl = $( item ).parent().prev( '.pagination' )
				}
				if ( $( pagesEl ).length ) {
					swiperParameters.pagination = {
						el : $( pagesEl ).get(),
						type : 'custom', // bullets, custom, progressbar
						clickable : true,
						renderCustom : APP.DigitalPublication.renderSwiperPagination,
					}
				}
				if ( $( nextEl ).length ) {
					swiperParameters.navigation = {
						nextEl : $( nextEl ).get(),
						prevEl : $( prevEl ).get(),
					}
				}
				if ( true ) {
					swiperParameters.preloadImages = false
					swiperParameters.lazy = {
						loadPrevNext : true,
						loadPrevNextAmount : 2
					}
				}
				const swiper = new Swiper( item, swiperParameters )
				APP.DigitalPublication.swipers[ index ] = swiper
			})
		}
		// attach event listener
		$(window).on('load resize', APP.DigitalPublication._resizeLoadHandler )
	},
	/**
	 * [_resizeLoadHandler change the dropdown nav distance from the top if enable_ticker is true or the admin bar is enabled]
	 * @param  {obj} e the event object
	 */
	_resizeLoadHandler : function( e ) {
		// Move the table of contents items into another element when less than 500 px
		// @TODO on page resize, move the items back if necessary.
		if ( $( 'body' ).hasClass( 'page-template-page-toc' ) && $( 'body' ).hasClass( 'dp--active' ) ) {
			if ( typeof( APP.Breakpoint.prevWW ) !== 'undefined' && APP.Breakpoint.prevWW < 500 ) {
				$( '.inpagetab-items').appendTo( 'section.contenttypemain' )
			}
			else {
				$( '.inpagetab-items').insertBefore( '.inpagetab--content' )
			}
		}
	},
	_documentReadyHandler : ( e ) => {
		// unhide pagination
		APP.DigitalPublication.paginationContainers.foreach( ( item ) => {
			if ( $(item).hasClass('pagination--first-load') ) {
				$(item).removeClass('pagination--first-load') 
			}
		} )
		// find which filters/pages is active
		APP.DigitalPublication._updateFilters( e )
		// find which breakpoint is active
		APP.DigitalPublication._breakpointHandler( e )
	},
	_breakpointHandler : ( e ) => {
		// if ( APP.Breakpoint._is ( '<', 'medium' ) ) {
		//	 APP.DigitalPublication.scrollToOffet = APP.DigitalPublication.scrollToOffets['medium']
		// }
		// else if ( APP.Breakpoint._is ( '<', 'large' ) ) {
		//	 APP.DigitalPublication.scrollToOffet = APP.DigitalPublication.scrollToOffets['large']
		// }
		// else if ( APP.Breakpoint._is ( '<', 'xlarge' ) ) {
		//	 APP.DigitalPublication.scrollToOffet = APP.DigitalPublication.scrollToOffets['xlarge']
		// }
		// else if ( APP.Breakpoint._is ( '>=', 'xlarge' ) ) {
		//	 APP.DigitalPublication.scrollToOffet = APP.DigitalPublication.scrollToOffets['xxlarge']
		// }
	},
	_popStateHandler : ( e ) => {
		// const originalEvent = e.originalEvent
		// if ( originalEvent.state === null ) {
		//	 const originalState = APP.URLParams._get(0)
		//	 if ( typeof originalState.page !== 'undefined' && window.location.search !== '' && ! window.location.search.includes( '_page' ) ) {
		//		 APP.DigitalPublication._updateFilters( null, originalState )
		//	 }
		//	 else {
		//		 APP.DigitalPublication._updateFilters( null, {
		//			 page : 1, terms : '', pdf : 0,
		//		 } )
		//	 }
		// }
		// else if ( typeof originalEvent.state === 'object' && originalEvent.state && typeof originalEvent.state.query !== 'undefined' ) {
		//	 APP.DigitalPublication._updateFilters( originalEvent, originalEvent.state.query )
		// }
	},
	_updateFilters : ( e, urlParams = {}, pagerKey ) => {
		let repaint = false,
			searchParams = new URLSearchParams( window.location.search.substring( 1 ) ),
			decode = ( s ) => decodeURIComponent( s.replace( /\+/g, " " ) )
		if ( ! urlParams.length ) {
			for ( const [ key, value ] of searchParams.entries() ) {
				urlParams[ key.substr( 1 ) ] = decode( value )
			 }
		}
		// page
		if ( typeof urlParams.page !== 'undefined' && urlParams.page !== '' ) {
			// get the correct slice of the items
			APP.DigitalPublication.currentPage[ pagerKey ] = Number( urlParams.page ) < 1 || typeof Number( urlParams.page ) !== 'number' ? 1: Number( urlParams.page )
			repaint = true
		}
		if ( repaint ) {
			// transition to an updated grid
			APP.DigitalPublication._filterArchiveGridTransition( null, false )
		}
	},
	_paginationClickHander : ( e ) => {
		e.preventDefault()
		let $target = $( e.target )
		const info = {
			section : $target.parents('section'),
			pagerKey : $target.parents('section').data('pagerKey')
		}
		if ( $target.not( 'a.page-numbers' ) ) {
			$target = $( e.target ).closest( 'a.page-numbers' )
		}
		if ( $target.is( 'a.page-numbers' ) ) {
			const url = new URL( $target.prop( 'href' ) ),
				  urlParams = new URLSearchParams( url.search ),
				  pageNumber = urlParams.get( info.pagerKey )
			// set the correct slice of the items

			APP.DigitalPublication.currentPage[ info.pagerKey ] = Number( pageNumber )
			// transition to an updated grid
			APP.DigitalPublication._filterArchiveGridTransition( 'results', true, info )
			return false
		}
	},
	_filterArchiveURLTransition : ( transition = {}, activatePushState = true ) => {
		// transition = APP.DigitalPublication._getTransition( transition )
		// if ( activatePushState ) {
		//	 history.pushState( transition, null, transition.url )
		//	 // update history state
		//	 APP.URLParams._popStateHandler()
		// }
	},
	_getTransition : ( transition = {}, pagerKey = '' ) => {
		let searchParams = {}
			decode = ( s ) => decodeURIComponent( s.replace( /\+/g, " " ) ),
			newURL = ''
		if ( typeof window.location.search !== 'undefined' ) {
			searchParams = new URLSearchParams( window.location.search.substring( 1 ) )
			for ( const [ key, value ] of searchParams.entries() ) {
				searchParams[ key ] = decode( value )
			 }
			newURL = window.location.href.split('?')[0] + '?'
		}
		else {
			newURL = window.location.href + '?'
		}
		if ( typeof transition.query === 'undefined' ) {
			transition.query = {}
		}
		if ( typeof transition.query.page === 'undefined'  ) {
			transition.query.page = APP.DigitalPublication.currentPage[ pagerKey ]
		}
		if ( typeof transition.title === 'undefined' ) {
			transition.title = document.title
		}
		if ( typeof transition.url === 'undefined' ) {
			transition.url = newURL + `${pagerKey}=${transition.query.page}`
			
			if ( typeof searchParams.page_id !== 'undefined' ) {
				transition.url += `&page_id=${Number(searchParams.page_id)}`
			}
			if ( typeof searchParams.preview !== 'undefined' ) {
				transition.url += `&preview=${searchParams.preview}`
			}
			if ( typeof searchParams._ppp !== 'undefined' ) {
				transition.url += `&_ppp=${searchParams._ppp}`
			}
			
		}
		return transition
	},
	_filterArchiveGridTransition : ( scrollToResults, updateURL = true, info = {} ) => {
		// Hide grid
		$( info.section )
			// .add( APP.DigitalPublication.archiveFilters )
			// .add( '.footernav' )
			.addClass( 'pagination--transition' )
			// add pagenumber to grid if > 1
			if ( APP.DigitalPublication.currentPage[ info.pagerKey ] > 1 ) {
				$( info.section )
					.addClass( 'publicationsgrid--grid-pagination--active' )
			}
			else {
				$( info.section )
					.removeClass( 'publicationsgrid--grid-pagination--active' )
			}
		// update grid
		APP.DigitalPublication._updateGrid( info.pagerKey )
		if ( updateURL ) {
			//  update URL
			APP.DigitalPublication._filterArchiveURLTransition()
		}
		// wheter to scroll
		scrollToResults = typeof scrollToResults !== 'undefined' && scrollToResults ? scrollToResults : false
		// slight delay before update
		setTimeout( () => {
			let resultsOffset = $( '#publicationsgrid--filters' ).offset()
			if ( 'results' === scrollToResults && typeof resultsOffset !== 'undefined' && APP.Scroll.lastScrollTop > APP.Scroll.scrollToOffets ) {
				window.scrollTo( APP.Scroll.scrollToOffets, 0 )
			}
			// Show grid
			$( info.section )
				// .add( APP.DigitalPublication.archiveFilters )
				// .add( '.footernav' )
				.removeClass( 'pagination--transition' )
		 }, 3 )
	}, 
	/**
	 * [_updateGrid ]
	 */
	_updateGrid : ( pagerKey = '' ) => {
		// const $activeButtonElement = APP.DigitalPublication.getActiveFilterButtons()
		// // get terms from buttons with active classes
		// APP.DigitalPublication.activeTerms = $.makeArray( $activeButtonElement.map( ( index, el ) => el.dataset.termid ) )		
		// APP.DigitalPublication.activeFilters.terms = $.makeArray( $activeButtonElement.map( ( index, el ) => Number(el.dataset.termid ) ) )
		// APP.DigitalPublication.activeFilters.parents = $.makeArray( 
		// 											$activeButtonElement.map( ( index, el ) => Number( $( el ).parent().data( 'parentTermid' ) ) )
		// 										  ).filter( (value, index, self ) => self.indexOf( value ) === index )
		// clear all posts from the grid
		$( APP.DigitalPublication.gridPosts[ pagerKey ].section).find('.publicationsgrid--wrapper-grid > ul').empty()
		// apply the filters and render the new terms to each item
		APP.DigitalPublication
			._getPostsFromCurrentPage( APP.DigitalPublication.perPage[ pagerKey ], pagerKey )
			.forEach( ( item, index ) => APP.DigitalPublication._renderGridItem( item, pagerKey ) )
		// update pagination?
		APP.DigitalPublication._renderPagination( pagerKey )

		// reinitalize the masonry layout
		if ( $( '.grid--masonry' ).length ) {
			APP.MasonryLayout._init()
		}

		// maybe show no results
		if ( APP.DigitalPublication.currentItemCount[ pagerKey ] === 0 ) {
			//console.log( 'this need the correct grid' )
			// APP.DigitalPublication.archiveNoResults.addClass( 'publicationsgrid--no-results--active' )
			// APP.DigitalPublication.archiveGrid.addClass( 'publicationsgrid--grid--no-results' )
			// $('.publicationsgrid--no-results--contact-form')[0].scrollIntoView( { block: 'start',  behavior: 'smooth' } )
		}
		else {
			// APP.DigitalPublication.archiveNoResults.removeClass( 'publicationsgrid--no-results--active' )
			//console.log( 'this need the correct grid' )
			//APP.DigitalPublication.archiveGrid.removeClass( 'publicationsgrid--grid--no-results' )
		}
	},
	/**
	 * [_getPostsFromCurrentPage returns an array of post objects that have a term in the active term array]
	 * @param {bool} limit return only the first 20 if true
	 * @return {array} array of post objects
	 */
	_getPostsFromCurrentPage : function( limit, pagerKey ) {
		// set default
		if ( typeof limit == 'undefined' ) {
			limit = false
		}
		// init return array
		let tempArray = []
		// clone the active parents
		// let activeParents = [...APP.DigitalPublication.activeFilters.parents]
		// let parent = activeParents.pop()
		// loop through all the posts
		APP.DigitalPublication.gridPosts[ pagerKey ].posts.forEach( ( post, postIndex ) => {
			tempArray.push( post )
		} )
		// Sort the posts
		APP.DigitalPublication.gridPosts[ pagerKey ].posts.sort( (a, b) => (a.order > b.order) ? 1 : -1 )
		// update the restuls & title counts, current item count and total pages
		APP.DigitalPublication.currentItemCount[ pagerKey ] = tempArray.length
		APP.DigitalPublication.totalPage[ pagerKey ] = Math.ceil( APP.DigitalPublication.currentItemCount[ pagerKey ] / APP.DigitalPublication.perPage[ pagerKey ] )
		// do we have a limit?
		if ( limit && tempArray.length > limit ) {
			// only show the first x results
			let startSlice = ( Number( APP.DigitalPublication.currentPage[ pagerKey ] ) - 1 ) * APP.DigitalPublication.perPage[ pagerKey ]
			let limitArray = []
			limitArray = tempArray
								.map( a => ( { ...a } ) )
								.slice( startSlice, ( Number( startSlice ) + Number( limit ) ) )
			if ( limitArray.length < 1 ) {
				// find a page number that works, and then update APP.DigitalPublication.currentPage and url if necessary
				for ( let testStart = Number( APP.DigitalPublication.currentPage[ pagerKey ]  ) - 1; testStart > 0; testStart-- ) {
					startSlice = ( testStart - 1 ) * APP.DigitalPublication.perPage[ pagerKey ]
					limitArray = tempArray.map( a => ({...a})).slice( startSlice, startSlice + limit )
					if ( limitArray.length ) {
						tempArray = limitArray
						// replace state of current page in url if this works.
						APP.DigitalPublication.currentPage[ pagerKey ] = testStart
						APP.DigitalPublication.totalPage[ pagerKey ]  = testStart
						APP.DigitalPublication.currentItemCount[ pagerKey ]  = tempArray.length
						const transition = APP.DigitalPublication._getTransition( {}, pagerKey )
						// history.replaceState( transition, null, transition.url )
						break
					}
				}
			}
			else {
				tempArray = limitArray
			}
		}
		// return the array
		return tempArray
	},
	/**
	 * [_renderPagination outputs the html of a pager]
	 * @param  {obj} post post object
	 */
	_renderPagination : ( pagerKey ) => {
		// start the output html
		const nextPage = APP.DigitalPublication.currentPage[ pagerKey ] + 1
		const prevPage = APP.DigitalPublication.currentPage[ pagerKey ] - 1
		const currentSpan = `<span aria-current="page" class="page-numbers current">${APP.DigitalPublication.currentPage[ pagerKey ]}</span>`
		let outputHTML = '<div class="nav-links">'
		let pageNavigation = '<div class="controls--page-navigation">'
		if ( APP.DigitalPublication.totalPage[ pagerKey ] > 1 ) {
			if ( APP.DigitalPublication.currentPage[ pagerKey ] > 1 && APP.DigitalPublication.gridPosts[ pagerKey ].nav_arrows ) {
				pageNavigation = `<div class="controls--page-navigation"><a class="prev page-numbers" href="/?${pagerKey}=${prevPage}">${APP.DigitalPublication.gridData.svg_previous}</a>`
			}
			if ( APP.DigitalPublication.currentPage[ pagerKey ] < APP.DigitalPublication.totalPage[ pagerKey ] && APP.DigitalPublication.gridPosts[ pagerKey ].nav_arrows ) {
				pageNavigation += `<a class="next page-numbers" href="/?${pagerKey}=${nextPage}">${APP.DigitalPublication.gridData.svg_next }</a>`
			}
			pageNavigation += '</div><div class="controls--page-links">'
			outputHTML += pageNavigation
			if ( APP.DigitalPublication.currentPage[ pagerKey ] === 1 ) {
				outputHTML += currentSpan
			}
			let onceBefore = false
			let onceAfter = false
			for (let pagenumber = 1; pagenumber <= APP.DigitalPublication.totalPage[ pagerKey ]; pagenumber++ ) {
				if ( pagenumber === APP.DigitalPublication.currentPage[ pagerKey ] ) {
					if ( APP.DigitalPublication.currentPage[ pagerKey ] !== 1 ) {
						outputHTML += currentSpan
					}
				}
				else if ( APP.DigitalPublication.currentPage[ pagerKey ] >= 2 && ( 1 === pagenumber || APP.DigitalPublication.totalPage[ pagerKey ] === pagenumber ) ) {
					outputHTML += `<a class="page-numbers" href="/?${pagerKey}=${pagenumber}">${pagenumber}</a>`
				}
				else if ( pagenumber - 2 >= APP.DigitalPublication.currentPage[ pagerKey ] && pagenumber !== APP.DigitalPublication.totalPage[ pagerKey ] ) {
					if ( ! onceBefore ) {
						outputHTML += '<span class="page-numbers dots">&hellip;</span>'
						onceBefore = true
					}
				}
				else if ( pagenumber + 2 <= APP.DigitalPublication.currentPage[ pagerKey ] ) {
					if ( ! onceAfter ) {
						outputHTML += '<span class="page-numbers dots">&hellip;</span>'
						onceAfter = true
					}
				}
				else {
					outputHTML += `<a class="page-numbers" href="/?${pagerKey}=${pagenumber}">${pagenumber}</a>`
				}
			}
		}
		// close the wrapper
		outputHTML += '</div></div>'
		// remove existing pager
		$( APP.DigitalPublication.gridPosts[ pagerKey ].section ).find( '.nav-links' ).remove()
		// add the pager
		$( APP.DigitalPublication.gridPosts[ pagerKey ].section ).find( 'nav.pagination' ).append( outputHTML )
		$( APP.DigitalPublication.gridPosts[ pagerKey ].section ).find( '.page-numbers' ).on( 'click', APP.DigitalPublication._paginationClickHander )
		// update the message if it's visible
		if ( $( APP.DigitalPublication.gridPosts[ pagerKey ].section ).find('.pagination--status-wrapper').is( ':visible' ) ) {
			const resultCount = $( APP.DigitalPublication.gridPosts[ pagerKey ].section ).find('.publication--list-item').length
			const lastResultIndex = resultCount * APP.DigitalPublication.currentPage[ pagerKey ]
			let startResultIndex = lastResultIndex - APP.DigitalPublication.perPage[ pagerKey ] + 1
			if ( startResultIndex == lastResultIndex ) {
				startResultIndex = `#${startResultIndex}`
			}
			$( APP.DigitalPublication.gridPosts[ pagerKey ].section ).find('.pagination--status > .results--start-count' ).text( startResultIndex )
			$( APP.DigitalPublication.gridPosts[ pagerKey ].section ).find('.pagination--status > .results--current-count' ).text( lastResultIndex )
			$( APP.DigitalPublication.gridPosts[ pagerKey ].section ).find('.pagination--status > .results--total-count' ).text( APP.DigitalPublication.currentItemCount[ pagerKey ] )
		}
	},
	/**
	 * [_renderGridItem outputs the html of a grid item]
	 * @param  {obj} post post object
	 */
	_renderGridItem : function( post, pagerKey ) {
		// start the output html
		var outputHTML = `<li class="publication--list-item">`
		if ( 'watch' === post.post_type ) {
			outputHTML += APP.DigitalPublication._renderGridItemWatch( post )
		}
		else if ( 'listen' === post.post_type ) {
			outputHTML += APP.DigitalPublication._renderGridItemListen( post )
		}
		else if ( 'essays' === post.post_type ) {
			outputHTML += APP.DigitalPublication._renderGridItemEssay( post )
		}
		else if ( 'exhibition' === post.post_type ) {
			outputHTML += APP.DigitalPublication._renderGridItemExhibition( post )
		}
		else if ( 'artwork' === post.post_type ) {
			outputHTML += APP.DigitalPublication._renderGridItemArtwork( post )
		}
		else if ( 'research-materials' === post.post_type ) {
			outputHTML += APP.DigitalPublication._renderGridItemSource( post )
		}
		else {
			outputHTML += `<a href="${post.permalink}" class="${post.grid_classes}" data-id="${post.ID}">`
			// build image
			if ( post.image ) {
				outputHTML += '<img class="publicationsgrid--grid-item-image" loading="lazy" alt="' + post.image.alt + '"'
				// look for a cache_key for the image
				if ( 'undefined' !== typeof post.image.cache_key ) {
					outputHTML += ` data-cache-id="${post.image.cache_key}" `
				}
				outputHTML += 'data-width="' + post.image.width + '" data-height="' + post.image.height + '"'
				outputHTML += 'src="' + post.image.url + '"'
				outputHTML += post.image.src_set ? 'srcset="' + post.image.src_set + '"': ''
				outputHTML += post.image.sizes ? 'sizes="' + post.image.sizes + '" />': '/>'
			}
			else {
				outputHTML += '<div class="container--image-unavailable" style="width:30%;"><div class="image--unavailable" style="min-heigth:100px;"></div></div>'
			}
			// build text
			outputHTML += '<div class="publicationsgrid--grid-wrapper-grid-item-text">'
			outputHTML +=  post.supertitle != '' & typeof post.supertitle != 'undefined' ? '<h5 class="publicationsgrid--grid-wrapper-grid-item-text-supertitle">'+ post.supertitle + '</h5>' : ''
			outputHTML +=  post.title != '' & typeof post.title != 'undefined' ? '<h4 class="publicationsgrid--grid-wrapper-grid-item-text-title">' + post.title + '</h4>' : ''
			outputHTML +=  post.subtitle != '' & typeof post.subtitle != 'undefined' ? '<h6 class="publicationsgrid--grid-wrapper-grid-item-text-subtitle">' + post.subtitle + '</h6>' : ''
			// close the link
			outputHTML += '</div></a>'
		}
		// close the wrapper
		outputHTML += '</li>'
		// add the post
		const $section = $( APP.DigitalPublication.gridPosts[ pagerKey ].section )
		$section.find('.publicationsgrid--wrapper-grid > ul').append( outputHTML )
	},
	_renderGridItemEssay : function( post ) {
		var outputHTML = ``
		if ( typeof( post.preview_panel ) !== 'undefined' && post.preview_panel ) {
			outputHTML += `<div class="essays--info-wrapper">`
			outputHTML += `<a href="${post.permalink}" class="${post.grid_classes}">`
			outputHTML += `<h3 class="publicationsgrid--grid-item-title">${post.post_title}</h3></a>`
			if ( typeof( post.date ) !== 'undefined' && post.date ) {
				outputHTML += `<h5 class="publicationsgrid--grid-item-date">${post.date}</h5>`
			}
			if ( typeof( post.byline ) !== 'undefined' && post.byline ) {
				outputHTML += `<h5 class="publicationsgrid--grid-item-author">${post.byline }</h5>`
			}
			if ( typeof ( post.preview_text ) !== 'undefined' && post.preview_text ) {
				outputHTML += `</div><div class="essays--preview-wrapper">`
				outputHTML += `<div class="essays--preview">${post.preview_text}</div>`
				outputHTML += `<a href="${post.permalink}"` 
				outputHTML += `class="publicationsgrid--grid-item ${post.class}">`
				outputHTML += `<div class="essays--more-button" role="button">${post.more_button_text}</div>`
				outputHTML += `</a></div>`
			}
		}
		else {
			outputHTML += `<a href="${post.permalink}" class="${post.grid_classes}" data-id="${post.ID}">`
			outputHTML += `<h3 class="publicationsgrid--grid-item-title">${post.title}</h3>`
			if ( typeof( post.date ) !== 'undefined' && post.date ) {
				outputHTML += `<h5 class="publicationsgrid--grid-item-date">${post.date}</h5>`
			}
			if ( typeof( post.byline ) !== 'undefined' && post.byline ) {
				outputHTML += `<h5 class="publicationsgrid--grid-item-author">${post.byline}</h5>`
			}
			outputHTML += '</a>'
		}
		return outputHTML
	},
	_renderGridItemSource : function( post ) {
		var outputHTML = `<a href="${post.permalink}" class="${post.grid_classes}" data-id="${post.ID}">`

		if ( post.image ) {
			outputHTML += '<img class="publicationsgrid--grid-item-image" loading="lazy" alt="' + post.image.alt + '"'
			// look for a cache_key for the image
			if ( 'undefined' !== typeof post.image.cache_key ) {
				outputHTML += ` data-cache-id="${post.image.cache_key}" `
			}
			outputHTML += 'data-width="' + post.image.width + '" data-height="' + post.image.height + '"'
			outputHTML += 'src="' + post.image.url + '"'
			outputHTML += post.image.src_set ? 'srcset="' + post.image.src_set + '"': ''
			outputHTML += post.image.sizes ? 'sizes="' + post.image.sizes + '" />': '/>'
		}

		outputHTML += `<h3 class="publicationsgrid--grid-item-title">${post.title}</h3>`
		if ( typeof( post.source_publication_name ) !== 'undefined' && post.source_publication_name ) {
			outputHTML += `<h5 class="${post.source_publication_class}">${post.source_publication_name}</h5>`
		}
		if ( typeof( post.source_publication_date ) !== 'undefined' && post.source_publication_date ) {
			outputHTML += `<h5 class="publicationsgrid--grid-item-dater">${post.source_publication_date}</h5>`
		}
		if ( typeof( post.source_author ) !== 'undefined' && post.source_author ) {
			outputHTML += `<h5 class="publicationsgrid--grid-item-author">${post.source_author}</h5>`
		}
		if ( typeof( post.source_language ) !== 'undefined' && post.source_language ) {
			outputHTML += `<h5 class="publicationsgrid--grid-item-document">${post.source_language}</h5>`
		}
		outputHTML += '</a>'
		return outputHTML
	},
	_renderGridItemArtist : function( post ) {
	},
	_renderGridItemArtwork : function( post ) {
		var outputHTML = `<a aria-label="${post.aria_label}" href="${post.permalink}" class="${post.grid_classes}" data-id="${post.ID}">`
		// build image
		if ( post.image ) {
			outputHTML += '<img class="publicationsgrid--grid-item-image" loading="lazy" alt="' + post.image.alt + '"'
			// look for a cache_key for the image
			if ( 'undefined' !== typeof post.image.cache_key ) {
				outputHTML += ` data-cache-id="${post.image.cache_key}" `
			}
			outputHTML += 'data-width="' + post.image.width + '" data-height="' + post.image.height + '"'
			outputHTML += 'src="' + post.image.url + '"'
			outputHTML += post.image.src_set ? 'srcset="' + post.image.src_set + '"': ''
			outputHTML += post.image.sizes ? 'sizes="' + post.image.sizes + '" />': '/>'
		}
		else {
			outputHTML += '<div class="container--image-unavailable" style="width:30%;"><div class="image--unavailable" style="min-heigth:100px;"></div></div>'
		}
		outputHTML += `<h4 class="publicationsgrid--grid-item-artistname">${post.byline}</h4>`
		outputHTML += `<h3 class="publicationsgrid--grid-item-artworktitle">${post.object_title}</h3>`
		outputHTML += `<div class="publicationsgrid--grid-item--datecreated">${post.date_created}</div>`
		outputHTML += `</a>`
		return outputHTML
	},
	_renderGridItemExhibition : function( post ) {
		var outputHTML = `<figure><div class="exhibition--image">`
		if ( post.image ) {
			outputHTML += '<img class="publicationsgrid--grid-item-image" loading="lazy" alt="' + post.image.alt + '"'
			// look for a cache_key for the image
			if ( 'undefined' !== typeof post.image.cache_key ) {
				outputHTML += ` data-cache-id="${post.image.cache_key}" `
			}
			outputHTML += 'data-width="' + post.image.width + '" data-height="' + post.image.height + '"'
			outputHTML += 'src="' + post.image.url + '"'
			outputHTML += post.image.src_set ? 'srcset="' + post.image.src_set + '"': ''
			outputHTML += post.image.sizes ? 'sizes="' + post.image.sizes + '" />': '/>'
		}
		else {
			outputHTML += '<div class="container--image-unavailable" style="width:30%;"><div class="image--unavailable" style="min-heigth:100px;"></div></div>'
		}
		outputHTML += `</div><div class="exhibition--preview-wrapper">`
		outputHTML += `<h5 class="publicationsgrid--grid-type">${post.exhibition_related}</h5>`
		outputHTML += `<h2 class="publicationsgrid--exhibition-title">${post.exhibition_title}</h2>`
		outputHTML += `<h3 class="publicationsgrid--exhibition-subtitle">${post.exhibition_subtitle}</h3>`
		outputHTML += `<h4 class="publicationsgrid--exhibition-daterange">${post.exhibition_date}</h4>`
		if ( post.post_content !== '' )  {
			outputHTML += `<div class="publicationsgrid--exhibition-intro">${post.content}</div>`
		}
		outputHTML +=`<a href="${post.permalink}" class="${post.grid_classes}" data-id="${post.ID}">`
		outputHTML +=`<div class="publicationsgrid-exhibition--more" role="button">${post.cta_text}</div>`
		outputHTML +=`</a></div></figure>`
		return outputHTML
	},
	_renderGridItemListen : function( post, showDefaultImage = false ) {
		if ( typeof post.media === 'undefined' || ! post.media ) {
			var outputHTML = `<a href="${post.permalink}" class="${post.grid_classes}" data-id="${post.ID}"><figure>`
			// build image
			if ( post.image ) {
				outputHTML += '<img class="publicationsgrid--grid-item-image" loading="lazy" alt="' + post.image.alt + '"'
				// look for a cache_key for the image
				if ( 'undefined' !== typeof post.image.cache_key ) {
					outputHTML += ` data-cache-id="${post.image.cache_key}" `
				}
				outputHTML += 'data-width="' + post.image.width + '" data-height="' + post.image.height + '"'
				outputHTML += 'src="' + post.image.url + '"'
				outputHTML += post.image.src_set ? 'srcset="' + post.image.src_set + '"': ''
				outputHTML += post.image.sizes ? 'sizes="' + post.image.sizes + '" />': '/>'
			}
			else if ( showDefaultImage )  {
				outputHTML += '<div class="container--image-unavailable" style="width:30%;"><div class="image--unavailable" style="min-heigth:100px;"></div></div>'
			}
			outputHTML += `<figcaption class="publicationsgrid--grid-item-figcaption">`
			if ( post.runtime ) {
				outputHTML += `<div class="publicationsgrid--grid-item-details">${post.play_icon}`
				outputHTML += `<span class="publicationsgrid--grid-item-runtime">${post.runtime}</span></div>`
			}
			outputHTML += `<h3 class="publicationsgrid--grid-item-title publicationsgrid--grid-interview-title">${post.title_short}</h3>`
			outputHTML += `<h5 class="publicationsgrid--grid-item-caption">${post.caption}</h5>`
			outputHTML += '</figcaption></figure></a>'	
		}
		else {
			var outputHTML = `<div class="publicationsgrid--grid-item"><figure>`
			outputHTML += `<section class="media--listen">${post.media}</section>`
			outputHTML +=`<figcaption class="publicationsgrid--grid-item-figcaption">`
			if ( typeof post.transcripts !== 'undefined' && typeof post.transcripts.type !== 'undefined' && post.see_transcript ) {
				outputHTML +=`<a href="${post.permalink}" class="publicationsgrid--show-transcript"><div class="publicationsgrid--grid-item-show-transcript">`
				outputHTML +=`<span>${post.see_transcript}</span></div></a>`
			}
			else {
				//console.log( typeof post.transcripts, typeof post.transcripts.type  , post )
			}
			outputHTML +=`<a href="${post.permalink}" class="${post.grid_classes}" data-id="${post.ID}">`
			outputHTML += `<h3 class="publicationsgrid--grid-item-title publicationsgrid--grid-interview-title">${post.title_short}</h3>`
			outputHTML += `<h5 class="publicationsgrid--grid-item-caption">${post.caption}</h5>`
			outputHTML += '</a>'
			outputHTML +=`</figcaption></figure></div>`
		}
		return outputHTML
	},
	_renderGridItemWatch : function( post ) {
		if ( typeof post.media === 'undefined' || ! post.media ) {
			var outputHTML = `<a href="${post.permalink}" class="${post.grid_classes}" data-id="${post.ID}"><figure>`
			// build image
			if ( post.image ) {
				outputHTML += '<img class="publicationsgrid--grid-item-image" loading="lazy" alt="' + post.image.alt + '"'
				// look for a cache_key for the image
				if ( 'undefined' !== typeof post.image.cache_key ) {
					outputHTML += ` data-cache-id="${post.image.cache_key}" `
				}
				outputHTML += 'data-width="' + post.image.width + '" data-height="' + post.image.height + '"'
				outputHTML += 'src="' + post.image.url + '"'
				outputHTML += post.image.src_set ? 'srcset="' + post.image.src_set + '"': ''
				outputHTML += post.image.sizes ? 'sizes="' + post.image.sizes + '" />': '/>'
			}
			else {
				outputHTML += '<div class="container--image-unavailable" style="width:30%;"><div class="image--unavailable" style="min-heigth:100px;"></div></div>'
			}
			outputHTML += `<figcaption class="publicationsgrid--grid-item-figcaption">`
			outputHTML += `<div class="publicationsgrid--grid-item-details">${post.play_icon}`
			outputHTML += `<span class="publicationsgrid--grid-item-runtime">${post.runtime}</span></div>`
			outputHTML += `<h3 class="publicationsgrid--grid-item-title publicationsgrid--grid-interview-title">${post.title_short}</h3>`
			outputHTML += `<h5 class="publicationsgrid--grid-item-caption">${post.caption}</h5>`
			outputHTML += '</figcaption></figure></a>'	
		}
		else {
			var outputHTML = `<div class="publicationsgrid--grid-item"><figure>`
			outputHTML += `<section class="media--watch">${post.media}</section>`
			outputHTML +=`<figcaption class="publicationsgrid--grid-item-figcaption">`
			if ( typeof post.transcripts !== 'undefined' && typeof post.transcripts.type !== 'undefined' && post.see_transcript ) {
				outputHTML +=`<a href="${post.permalink}" class="publicationsgrid--show-transcript"><div class="publicationsgrid--grid-item-show-transcript">`
				outputHTML +=`<span>${post.see_transcript}</span></div></a>`
			}
			else {
				//console.log( typeof post.transcripts, typeof post.transcripts.type  , post )
			}
			outputHTML +=`<a href="${post.permalink}" class="${post.grid_classes}" data-id="${post.ID}">`
			outputHTML += `<h3 class="publicationsgrid--grid-item-title publicationsgrid--grid-interview-title">${post.title_short}</h3>`
			outputHTML += `<h5 class="publicationsgrid--grid-item-caption">${post.caption}</h5>`
			outputHTML += '</a>'
			outputHTML +=`</figcaption></figure></div>`
		}
		return outputHTML
	},
	renderSwiperSlideChange  : ( swiper ) => {
		jQuery('.pagination--arrow-prev').on('click', ( event, currentGroup = 1 ) => {
			const current = swiper.activeIndex
			if ( current >= APP.DigitalPublication.pageGroupCount ) {
				currentGroup = Math.ceil( current / APP.DigitalPublication.pageGroupCount )
			}
			const groupFloor = Math.min( Math.max( parseInt( ( currentGroup * APP.DigitalPublication.pageGroupCount ) - APP.DigitalPublication.pageGroupCount ), 0 ), swiper.slides.length )
			swiper.slideTo( groupFloor )
		})
		jQuery('.pagination--arrow-next').on('click', ( event, currentGroup = 1 ) => {
			const current = swiper.activeIndex
			if ( current >= APP.DigitalPublication.pageGroupCount ) {
				currentGroup = Math.ceil( current / APP.DigitalPublication.pageGroupCount ) + 1
			}
			const groupCeil = Math.min( Math.max( parseInt( Math.ceil( currentGroup * APP.DigitalPublication.pageGroupCount ) ), 0 ), swiper.slides.length )
			swiper.slideTo( groupCeil )
		})
	},
	renderSwiperPagination : ( swiper, current, total, currentGroup = 1 ) => {
		let paginationPrevClass = 'pagination--arrow-prev'
		let paginationNextClass = 'pagination--arrow-next'
		let groupBoundary = APP.DigitalPublication.pageGroupCount
		const totalGroups = Math.ceil( total / APP.DigitalPublication.pageGroupCount ) 
		let text = `<div class="pagination--wrapper">`;
		if ( current > APP.DigitalPublication.pageGroupCount ) {
			currentGroup = Math.ceil( current / APP.DigitalPublication.pageGroupCount )
		}
		const groupFloor = ( currentGroup * APP.DigitalPublication.pageGroupCount ) - APP.DigitalPublication.pageGroupCount + 1
		const groupCeil = currentGroup * APP.DigitalPublication.pageGroupCount
		for (let i = 1; i <= total; i++) {
			const iGroup = Math.ceil( i / APP.DigitalPublication.pageGroupCount )
			const slide = swiper.slides[ i - 1 ]
			const className = slide.className
			const slideImage = $(slide).find('> img ')
			const slideImageData = slideImage.length ? $(slideImage).data() : {}
			let itemClass = 'swiper-pagination-bullet'
			let thumb = '' // slide.data.src

			if ( slideImageData.thumbUrl ) {
				thumb  = slideImageData.thumbUrl
			}
			else if ( slideImageData.src ) {
				thumb = slideImageData.src
			}
			if ( ! thumb.length ) {
				if ( $(slide).find('img').length ) {
					thumb = $(slide).find('img').attr('src')
					if ( 'undefined' === typeof thumb ) {
						if ( $(slide).find('img').data('srcSet') ) {
							thumb = $(slide).find('img')
											.data('srcSet')
											.split( "," )
											.reduce(
							  (acc, item) => {
								let [url, width] = item.trim().split(" ")
								width = parseInt(width);
								if (width < acc.width) return acc
								return  { width, url }
							  },
							  { width: 0, url: "" }
							).url 
						}
						else if ( $(slide).find('img').data('src') ) {
							thumb = $(slide).find('img').data('src')
						}
					}
					if ( i >= groupFloor && i <= groupCeil ) {
						thumb = `<img src="${thumb}" class="pagination--controls-control" alt="pagination control thumbnail image" />`
					}
					else {
						thumb = `<span data-img-url="${thumb}" data-class="pagination--controls-control"></span>`
					}
				}
				else {
					thumb = $(slide).find('.container--image-unavailable').html()
				}
			}
			else if ( i >= groupFloor && i <= groupCeil ) {
				thumb = `<img src="${thumb}" class="pagination--controls-control" alt="pagination control thumbnail image" />`
			}
			else {
				thumb = `<span data-img-url="${thumb}" data-class="pagination--controls-control"></span>`
			}
			if ( current === i ) {
				itemClass += ' active'
			} 
			itemClass += i >= groupFloor && i <= groupCeil ? ' swiper-pagination--group-active' : '';
			if ( ( groupBoundary - APP.DigitalPublication.pageGroupCount + 1 ) === i ) {
				// itemClass += i >= groupFloor && i <= groupCeil ? ' swiper-pagination--group-active' : '';
				//text += `<div class="${ itemClass }" data-current-group="${ currentGroup }">`
			}
			//else if ( groupBoundary === i - 1 ) {
			//	itemClass += currentGroup === iGroup ? ' active' : '';
			//	text += `<div class="${ itemClass }" data-current-group="${ currentGroup }">`
			//}
			text += `<div class="${ itemClass }" data-current-group="${ currentGroup }">${ thumb }</div>`;
			if ( groupBoundary === i ) {
				//text += `</div>`
				groupBoundary += APP.DigitalPublication.pageGroup
			}
		}
		if ( 1 === groupFloor ) {
			paginationPrevClass += ' control--gray-out'
		}
		if ( total === groupCeil ) {
			paginationNextClass += ' control--gray-out'
		}
		let seeAllLink = {}
		const swiperSection = $( swiper.$el ).parents('.publicationsgrid')
		if ( swiperSection.length && 'undefined' !== typeof $( swiperSection ).data( 'pagerKey' ) 
			&&  'undefined' !== typeof APP.DigitalPublication.footerLinks[ $( swiperSection ).data( 'pagerKey') ] ) {
			seeAllLink = APP.DigitalPublication.footerLinks[ $( swiperSection ).data( 'pagerKey' ) ]
		}
		text += `</ul>`
		text += `<h4 class="pagination--controls-wrapper">`
		text += `<span class="${ paginationPrevClass }">${ APP.DigitalPublication.gridData.svg_previous_small }</span>`
		text += `<div class="pagination--pages-wrapper"><span class="pagination--page-begin">${ groupFloor }</span>-<span class="pagination--page-end">${ groupCeil }</span> of <span class="pagination--page-total">${ total }</span></div>`
		text += `<span class="${ paginationNextClass }">${ APP.DigitalPublication.gridData.svg_next_small }</span>`;
		if ( 'undefined' !== typeof seeAllLink.url && seeAllLink.url.length ) {
			const seeAllLinkText = 'undefined' !== typeof seeAllLink.title && seeAllLink.title.length ? seeAllLink.title : seeAllLink.url
			text += `<span class="pagination--see-all"><a href="${seeAllLink.url}">${seeAllLinkText}<span class="pagination--see-all-arrows">${ APP.DigitalPublication.gridData.svg_next_small }</span></a></span>`
		}
		text += `</h4>`;
		return text;
	}
}
APP.DigitalPublication._init()
/**
 * [EventsFilter manages the events filter]
 * @type {Object}
 */
APP.EventsFilter = {
	/**
	 * [toggle toggles the filters display]
	 * @type {jQuery obj}
	 */
	toggle : $('.eventsfilter-toggle-button'),
	/**
	 * [terms the taxonomy term buttons]
	 * @type {jQuery obj}
	 */
	terms : $('.eventsfilter-filter-types-type'),
	/**
	 * [termsContainer contains the terms]
	 * @type {jQuery obj}
	 */
	termsContainer : $('.eventsfilter-filter-types'),
	/**
	 * [termToggledClass the class to apply to a term when it's selected]
	 * @type {String}
	 */
	termToggledClass : 'eventsfilter-filter-types-type--toggled',
	/**
	 * [datePickerContainer the datepicker container]
	 * @type {jQuery obj}
	 */
	datePickerContainer : $('.eventsfilter-filter-daterange-datepicker'),
	/**
	 * [datePicker the datepicker instance]
	 * @type {air datepicker|undefined}
	 */
	datePicker : undefined,
	/**
	 * [datePickerContent placeholder for the dates UI in the datepicker]
	 * @type {[type]}
	 */
	datePickerContent : undefined,
	/**
	 * [upcomingEventDates placeholder for the upcoming event dates]
	 * @type {array|undefined}
	 */
	upcomingEventDates : undefined,
	/**
	 * [closedEventDates placeholder for the closed event dates]
	 * @type {array|undefined}
	 */
	closedEventDates : undefined,
	/**
	 * [filter the container of all the filters]
	 * @type {jQuery obj}
	 */
	filter : $('.eventsfilter-filter'),
	/**
	 * [filterButton the button used to trigger ajax request for filtered events]
	 * @type {jQuery obj}
	 */
	filterButton : $('.eventsfilter-filter-types-buttoncontainer-button'),
	/**
	 * [grid grid container]
	 * @type {jQuery obj}
	 */
	grid : $('.eventsgrid-wrapper-grid'),
	/**
	 * [message container for messages]
	 * @type {jQuery obj}
	 */
	messages : $('.eventsgrid-wrapper-message'),
	/**
	 * [upcomingEvents upcoming events container (only used if a result from a filter query is empty and a date is selected and terms is selected)]
	 * @type {jQuery obj}
	 */
	upcomingEvents : $('.upcomingeventsgrid'),
	/**
	 * [upcomingEventsGrid upcoming events grid (only used if a result from a filter query is empty and a date is selected and terms is selected)]
	 * @type {jQuery obj}
	 */
	upcomingEventsGrid : $('.upcomingeventsgrid-wrapper-grid'),
	/**
	 * [upcomingEventsTerms upcoming events grid title terms]
	 * @type {jQuery obj}
	 */
	upcomingEventsTerms : $('.upcomingeventsgrid-wrapper-title-terms'),
	/**
	 * [gridTitle the grid title]
	 * @type {jQuery obj}
	 */
	gridTitle : $('.eventsgrid-wrapper-title'),
	/**
	 * [_init entry point]
	 */
	_init : function(){
		// listen for load event on window
		$(window).on('load', APP.EventsFilter._loadHandler);
		// listen for click event on terms
		APP.EventsFilter.terms.on('click', APP.EventsFilter._termsClickHandler);
		// listen for click event on filter button
		APP.EventsFilter.filterButton.on('click', APP.EventsFilter._filterClickHandler);
		// listen for click event on the toggle button
		APP.EventsFilter.toggle.on('click', APP.EventsFilter._toggleClickHandler);
	},
	/**
	 * [_loadHandler set up datepicker]
	 */
	_loadHandler : function(){
		// bail early if UpcomingEventdates doesn't exist
		if( typeof UpcomingEventDates == 'undefined' ){
			return;
		}
		// try to get the upcoming dates
		if( UpcomingEventDates.length > 0 ){
			APP.EventsFilter.upcomingEventDates = UpcomingEventDates;
		}
		// try to get the closed dates
		if( ClosedEventDates.length > 0 ){
			APP.EventsFilter.closedEventDates = ClosedEventDates;
		}
		// do we have a datepicker?
		if( APP.EventsFilter.datePickerContainer.length > 0 ){
			// set up and store datepicker instance
			APP.EventsFilter.datePicker = APP.EventsFilter.datePickerContainer.datepicker({
				// set language to english
				language : 'en',
				// allow date range
				range : true,
				// prevent toggling same-day on range
				toggleSelected : true,
				// remove comma from the title
				navTitles : {
					days: 'MM yyyy',
				},
				/**
				 * [onRenderCell updates classnames for cells]
				 * @param  {obj} date     a js date obj
				 * @param  {string} cellType the cell's type
				 * @return {obj}          see http://t1m0n.name/air-datepicker/docs/#sub-section-45 for details
				 */
				onRenderCell : function(date, cellType){
					// init return obj
					var obj = {
						html : '',
						classes : '',
						disabled : '',
					};

					// store the classes for the obj
					var classes = [];

					// do we have access to datepicker instance and is the current cellType of day?
					if( typeof APP.EventsFilter.datePicker != 'undefined' && cellType == 'day' ){
						// store the dates as an array
						var rangeDates = APP.EventsFilter.datePicker.val().split(',');
						// we got some range dates right?
						if( rangeDates.length > 1 ){
							// convert rangeDates values to datetime objects
							rangeDates = rangeDates.map(function(rangeDate){
								return new Date(new Date(rangeDate).toLocaleString('en-US', {timeZone: 'America/Los_Angeles'}));
							});

							// if the date is between the range of dates
							if( date > rangeDates[0] && date < rangeDates[1] ){
								// add the inrange class
								classes.push('-super-in-range-');
							}
							// local util func to return a date string in the format of Ymd (20180114 = Jan 14th 2018)
							function getYmd(d){
								// init output
								var ymd = '';
								// get the year YYYY
								ymd += d.getFullYear().toString();
								// get the month and day (month is 0-11 so +1 to make it like calendar)
								var md = [d.getMonth() + 1, d.getDate()];
								// loop through month & day
								md.forEach(function(el){
									// less than 10?
									if( el < 10 ){
										// add 0 to the beginning of the number string
										ymd += 0 + el.toString()
									}
									// greater than or equal to 10?
									else{
										// just return the number string
										ymd += el.toString();
									}
								});
								// return the output
								return ymd;
							}

							// if the date is the same as the start date
							if( getYmd(date) == getYmd(rangeDates[0]) ){
								// add range from class to smoothly continue the bg
								classes.push('-super-range-from-');
							}
							// if the date is the same as the end date
							if( getYmd(date) == getYmd(rangeDates[1]) ){
								// add range from class to smoothly continue the bg
								classes.push('-super-range-to-');
							}
						}
					}

					// is the day a saturday?
					if( date.getDay() == 6 ){
						// set the class to saturday
						classes.push('saturday');
					}
					// is the day a sunday?
					else if( date.getDay() == 0 ){
						// set the day to sunday
						classes.push('sunday');
					}
					else if (date.getDay() == 3){
						//set the day to wednesday
						classes.push('wednesday');
					}

					var today = new Date();
					if(today > date) {
						classes.push('past-date');
					}
					else {
						classes.push('not-past-date');
					}

					// do we have upcoming dates?
					if( APP.EventsFilter.upcomingEventDates != undefined ){
						APP.EventsFilter.upcomingEventDates.forEach(function(upcomingDate){
							// convert the date from php to a js obj
							var upcomingDate = new Date(upcomingDate);
							// make sure the hours are at 0 for comparisons sake
							//console.log(upcomingDate);
							upcomingDate.setHours(0);
							// got an upcoming date?
							if( upcomingDate.getTime() == date.getTime() ){
								// add the class
								classes.push('upcoming');
							}
						});
					}
					// do we have closed dates?
					if( APP.EventsFilter.closedEventDates != undefined ){
						APP.EventsFilter.closedEventDates.forEach(function(closedDate){
							// convert the date from php to a js obj
							var closedDate = new Date(closedDate);
							// make sure the hours are at 0 for comparisons sake
							//console.log(closedDate);
							closedDate.setHours(0);
							// got an closed date?
							if( closedDate.getTime() == date.getTime() ){
								// add the class
								classes.push('closed');
							}
						});
					}
					// concat the classes via a space
					obj.classes = classes.join(' ');
					// return the obj
					return obj;
				},
			});
			// set the datepicker content
			APP.EventsFilter.datePickerContent = $('.datepicker--content', APP.EventsFilter.datePickerContainer);
			// listen for mouseleave events on the datepicker content
			APP.EventsFilter.datePickerContent.on( 'mouseleave', APP.EventsFilter._datePickerContentMouseleaveHandler);
		}
	},
	_datePickerContentMouseleaveHandler : (e) => {
		// if rangeto and rangefrom are present
		if ( $('.datepicker--cell.-selected-', APP.EventsFilter.datePickerContent).length != 2 ){
			// remove classes from datepicker content
			$('.datepicker--cell', APP.EventsFilter.datePickerContent).removeClass('-range-from- -in-range- -range-to-');
		}
	},
	/**
	 * [_termsClickHandler toggles the toggled css class]
	 * @param  {obj} e the event object
	 */
	_termsClickHandler : function(e){
		// toggle the toggled class
		$(e.target).toggleClass(APP.EventsFilter.termToggledClass);
	},
	/**
	 * [_toggleClickHandler slides the filter up and down]
	 */
	_toggleClickHandler : function(){
		// toggle the sliding
		APP.EventsFilter.filter.slideToggle();
	},
	/**
	 * [_filterClickHandler submit ajax request to get filtered results]
	 */
	_filterClickHandler : function(){
		// show overlay when button is clicked
		APP.Animate._showProcessingOverlay()
		// init selected terms array
		var selectedTerms = []
		// find the selected terms
		APP.EventsFilter.termsContainer.find('.' + APP.EventsFilter.termToggledClass).each(function(index, el){
			// add to selected terms
			selectedTerms.push( $(el).data('id') )
		})
		// init selected dates array
		var selectedDates = []
		// find the selected dates
		APP.EventsFilter.datePicker.data('datepicker').selectedDates.map(function(el, index){
			// add to selected dates
			selectedDates.push(new Date(el).toISOString())
		});
		// setup data obj
		var data = {
			action : 'eventsfilter', // corresponds to ajax callbacks in php
			selected_dates : selectedDates,
			selected_terms : selectedTerms,
		}
		// empty the messages
		// blast off
		// ajaxurl via APP.data.SetupTheme object
		// binding selectedTerms & selectedDates to build messages/titles
		$.post( APP.data.SetupTheme.ajaxurl,
			data,
			APP.EventsFilter._renderFilteredEvents.bind(null, selectedTerms, selectedDates)
		)
	},
	/**
	 * [_seeAllClickHandler ran if the see all button is clicked. performs another search without terms on the same day]
	 */
	_seeAllClickHandler : function(){
		// remove the toggled class from the terms & perform a search again
		APP.EventsFilter.terms.removeClass(APP.EventsFilter.termToggledClass);
		// run the search again
		APP.EventsFilter._filterClickHandler();
	},
	_buildTermNamesString : function(selectedTerms){
		// init termnames
		var termNames = [];
		// init return str
		var returnStr = '';
		// loop through the term ids
		selectedTerms.forEach( function(el, index) {
			// find the term names then add them to the termNames array
			termNames.push(APP.EventsFilter.termsContainer.find('div[data-id="' + el + '"]').html());
		});
		// build message string from term names
		//
		// got less than or equal to 2 term names?
		if( termNames.length <= 2 ){
			// just join with or
			returnStr += termNames.join(' or ') + ' ';
		}
		// otherwise perform a more complex joining of names
		else{
			// loop through the term names
			termNames.forEach(function(el, index){
				// are we at the end?
				if( index == termNames.length - 1 ){
					// just add or and name
					returnStr += ' or ' + el;
				}
				// are we at the beginning?
				else if( index == 0 ){
					// start off with the name
					returnStr += el;
				}
				// are we in the middle somewhere?
				else{
					// comma separate
					returnStr += ', ' + el;
				}
			});
		}
		return returnStr;
	},
	/**
	 * [_renderFilteredEvents renders the filtered events]
	 * @param  {string} response the response from php
	 * @param  {string} status   the http status code
	 */
	_renderFilteredEvents : function(selectedTerms, selectedDates, response, status, jqXHR){
		// convert json string to json object
		response = JSON.parse(response);
		// hide overlay when query is complete
		APP.Animate._hideProcessingOverlay()
		// did that work?
		if( status == 'success' ){
			//if success offset the window to focus on the event results
			var eventResults = $('#results-grid');
			if (eventResults.length) {
				$(window).scrollTop($('#results-grid').offset().top-140);
			}
			// make upcoming events section invisible
			APP.EventsFilter.upcomingEvents.removeClass('upcomingeventsgrid--active');
			// begin building messages
			// init message string
			var messageStr = '';
			// did we search for terms?
			if( selectedTerms.length != 0 ){
				// add the term names to the message string
				messageStr += APP.EventsFilter._buildTermNamesString(selectedTerms);
			}
			// prep for dates or end of string
			if( messageStr.length == 0 ){
				messageStr += 'Events scheduled';
			} 
			else{
				messageStr += ' events scheduled';
			}
			// got some dates?
			if( selectedDates.length != 0 ){
				// date range?
				if( selectedDates.length > 1 ){	
					// use between
					messageStr += ' from ';
					// init datestrings
					var dateStrings = [];
					// loop through selectedDates
					selectedDates.forEach(function(el, index){
						// add string name to dateStrings
						dateStrings.push(new Date(el).toLocaleDateString('en-US', {
							year: 'numeric',
							month: 'long',
							day: 'numeric',
						}));
					});
					// convert am pm to a.m. p.m.
					dateStrings = dateStrings.map(function(dateString){
						return dateString.replace('pm', 'p.m.').replace('am', 'a.m.');
					});
					// join the two dates with and
					messageStr += dateStrings.join(' to ');
				}
				// single date?
				else{
					// just add on and the date string
					var dateStr = new Date(selectedDates[0]).toLocaleDateString('en-US', {
						year: 'numeric',
						month: 'long',
						day: 'numeric',
					});
					// convert am to a.m. and pm to p.m.
					dateStr = dateStr.replace('pm', 'p.m.');
					// update the messsage string
					messageStr += ' on ' + dateStr;

				}
			}
			// update the grid title
			APP.EventsFilter.gridTitle.empty().append(messageStr);
			// got some events?
			if( response.events != 0 ){
				// add the events to the grid
				APP.EventsFilter.grid.empty().append(response.events);
				// clear the messages
				APP.EventsFilter.messages.empty();
			}
			// no events found
			else {
				// empty the grid
				APP.EventsFilter.grid.empty();
				// add the error message
				var dayOfWeek = new Date(selectedDates[0]).toLocaleDateString('en-US', {
					weekday: 'long',
				});

				if ( dayOfWeek.indexOf('Wednesday') != -1 || dayOfWeek.indexOf('Tuesday') != -1 ) {
					APP.EventsFilter.messages.empty().append('No events Wednesdays. Museum is closed.<br/>Our <a href="' + APP.data.SetupTheme.museum_store + '">Museum Store</a> is open from 10 a.m. to 5 p.m.');
				}
				else {
					APP.EventsFilter.messages.empty().append('There are no ' + messageStr);
				}
				// were there selected terms?
				if( selectedTerms.length > 0 ){
					// add a See all events on this date button
					APP.EventsFilter.messages.append('<div class="eventsgrid-wrapper-message-seeall">See all events on this date.</div>');
					// store the button
					APP.EventsFilter.seeAllButton = $('.eventsgrid-wrapper-message-seeall');
					// listen for the click on the button
					APP.EventsFilter.seeAllButton.on('click', APP.EventsFilter._seeAllClickHandler);
				}
				// were there selected terms AND a date and there's upcoming events
				if( selectedTerms.length > 0 && selectedDates.length > 0 && response.upcomingEvents != 0 ){
					// make the upcoming events section visible
					APP.EventsFilter.upcomingEvents.addClass('upcomingeventsgrid--active');
					// clear the upcoming events title terms and add the term names to the upcoming events title terms
					APP.EventsFilter.upcomingEventsTerms.empty().append( APP.EventsFilter._buildTermNamesString(selectedTerms) );
					// remove the old content in the upcoming events grid and add the new stuff
					APP.EventsFilter.upcomingEventsGrid.empty().append(response.upcomingEvents);
				}
			}
			
		}
	}
};

APP.EventsFilter._init();
/**
 * [EventSeriesEventsGrid handles the seeall button the events grid fade]
 * @type {Object}
 */
APP.EventSeriesEventsGrid = {
	/**
	 * [baseClasses the base classes to build Creators outta]
	 * @type {Array}
	 */
	baseClasses : [
		'eventsgridmodule-wrapper',
		'exhibitionsgrid-wrapper',
	],
	/**
	 * [_init entry point]
	 */
	_init : function(){
		// loop through base classes
		APP.EventSeriesEventsGrid.baseClasses.forEach(function(baseClass, index){
			// make a new creator
			var Creator = new APP.EventSeriesEventsGrid.Creator(baseClass);
			// tell the creator to build
			Creator._build();
		});
	},
	/**
	 * [Creator builds the slidey button thingy]
	 * @param {string} baseClass the base class of the selector
	 */
	Creator : function(baseClass){
		/**
		 * [seeall the see all button]
		 * @type {jQuery obj}
		 */
		this.seeall = $('.' + baseClass + '-seeall');
		/**
		 * [seeallicon the see all button's icon]
		 * @type {jQuery obj}
		 */
		this.seeallicon = $('.' + baseClass + '-seeall-icon');
		/**
		 * [hiddenItems the hide class applied to the grid items]
		 * @type {jQuery obj}
		 */
		this.hiddenItems = $('.' + baseClass + '-grid-item--hide');
		// reference to baseClass
		this.baseClass = baseClass;
		/**
		 * [_build entry point]
		 */
		this._build = function(){
			// do we have a see all button?
			if( this.seeall.length > 0 ){
				// if so then listen for the click event on it
				this.seeall.on('click', this._seeallClickHandler.bind(this));
			}
		};
		/**
		 * [_seeallClickHandler handles the click event on the see all button]
		 */
		this._seeallClickHandler = function(e){
			// slide down the hidden items & fade them in too
			this.hiddenItems.animate(
				{
					opacity: 'toggle',
					height: 'toggle',
					paddingTop: 'toggle',
					paddingBottom: 'toggle',
				},
				{
					step : function(now, tween){
						if( now != 0 ){
							$(this).css('display', 'inline-flex');
						}
					},
				}
			);
			// rotate that arrow
			this.seeallicon.toggleClass(this.baseClass + '-seeall-icon--up');
		};
	},
	
};

// blast off
APP.EventSeriesEventsGrid._init();
/**
 * [ExhibitionSlider handles the exhibition page slider]
 * @type {Object}
 */
APP.ExhibitionSlider = {
	sliderClass : '.exhibitionsslider',
	sliderElement : undefined,
	sliderConfig : {
		speed: 400,
		spaceBetween: 100,
		loop: true,
		autoplay: {
			delay: 8000,
		},
		navigation: {
			nextEl: '.exhibitionsslider-next',
			prevEl: '.exhibitionsslider-prev',
		},
		pagination: {
			el: '.exhibitionsslider-pagination',
			clickable : true,
		},
	},
	/**
	 * [_init entry point]
	 */
	_init : () => {
		APP.ExhibitionSlider.sliderElement = $( APP.ExhibitionSlider.sliderClass )
		if ( APP.ExhibitionSlider.sliderElement.lenth ) {
			APP.ExhibitionSlider.slider = new Swiper( APP.ExhibitionSlider.sliderClass, APP.ExhibitionSlider.sliderConfig )
		}
	}
};

APP.ExhibitionSlider._init();
APP.ExhibitionShare = {
	shareButton : $('.ecshare'),
	shareIcon : $('i[class*="share"]', '.ecshare'),
	shareText : $('span[class*="text"]', '.ecshare'),
	clipboard : undefined,
	_init : function(){
		if( APP.ExhibitionShare.shareButton.length > 0 ){
			// APP.ExhibitionShare.shareButton.on('click', APP.ExhibitionShare._buttonClickHandler);
			APP.ExhibitionShare.clipboard = new ClipboardJS(APP.ExhibitionShare.shareButton[0]);
			APP.ExhibitionShare.clipboard.on('success', APP.ExhibitionShare._buttonClickHandler);
		}
	},
	_buttonClickHandler : function(e){
		APP.ExhibitionShare.shareButton.addClass('ecshare--copied');
		APP.ExhibitionShare.shareText.html('Link Copied');
		APP.ExhibitionShare.shareIcon.removeClass('sficon-share').html('&#x2714;');
	},
};

APP.ExhibitionShare._init();
APP.ExhibitionCard = {
	card : $('.exhibitioncontainedhero ~ .exhibitioncard .exhibitioncard-wrapper'),
	_init : function(){
		if( APP.ExhibitionCard.card.length > 0 ){
			$(window).on('resize load', APP.ExhibitionCard._resizeLoadHandler);
		}
	},
	_resizeLoadHandler : function(e){
		if( APP.Breakpoint._is('>', 'small') ){
			APP.ExhibitionCard._setCardMarginTop();
		}
		else{
			APP.ExhibitionCard._removeCardMarginTop();
		}
	},
	_setCardMarginTop : function(){
		var marginTop = Number(APP.ExhibitionCard.card.css('paddingTop').replace('px', '')) + Number($('.exhibitioncard-wrapper-text', APP.ExhibitionCard.card).outerHeight());
		marginTop += 50; // for extra room
		APP.ExhibitionCard.card.css('marginTop', '-' + marginTop + 'px');
	},
	_removeCardMarginTop : function(){
		APP.ExhibitionCard.card.removeAttr('style');
	},
};

APP.ExhibitionCard._init();
APP.expandCollapse = {
    elements : [],
    controls : [],
	_init : function() {
        if ( 'querySelector' in document && 'addEventListener' in window ) {
            const expandSections = document.querySelectorAll( '.animate--expand-collapse' )
            const showSections = document.querySelectorAll( '.animate--show-hide' )
            let expands;
            for( let i = 0; i < expandSections.length; i++ ) {
                expands = expandSections[i]
                let collapsedHeight = expands.offsetHeight > 0 ? expands.offsetHeight : 200
                APP.expandCollapse.elements[i] = {
                    element : expands,
                    _expanded : false
                }
                expands.setAttribute( 'data-collapsed-height', collapsedHeight )
                //APP.Animate.animationConstructor( expands, i )
                //APP.expandCollapse.collapse( i )
                //APP.expandCollapse.collapse( expands )
                //APP.Animate.elements[i]._animate = true;
            }
            APP.expandCollapse._addEventListeners( )
        }
    },
    _addEventListeners : ( ) => {
        // Add click to the expand and collapse controls
        // const controls = 'artistlongbio--expand'
        // APP.expandCollapse.elements[ index ].element.addEventListener( 'click', ( e ) => APP.expandCollapse.toggle( index ) )
        // this._sectionItemTitle.addEventListener( 'click', this.toggleAnimation )
        const controls = document.querySelectorAll( '.controls--expand-collapse' )
        controls.forEach( ( listener ) => {
            APP.expandCollapse.controls.push( listener )
            const dataTarget = listener.getAttribute( 'data-animate-target' )
            listener.addEventListener( 'click', function(e) {
                if ( dataTarget ) {
                    const target = document.querySelector( dataTarget )
                    const result = APP.expandCollapse.toggle( false, target, listener )
                }
                else {
                    APP.expandCollapse.elements.forEach( ( section, i ) => {
                        APP.expandCollapse.toggle( i )
                    })
                }
            })
        })
    },
    toggle : ( index = 0, target = null, control = null ) => {
        const element = target !== null ? target : APP.expandCollapse.elements[index].element
        if ( typeof element === 'undefined' ) {
            console.log( 'element is undefined' )
            return
        }
        const dataStateCollapsed = element.getAttribute( 'data-collapsed' )
        if ( dataStateCollapsed === 'false' || element._expanded ) {
            // requestAnimationFrame( APP.expandCollapse.collapse )
            APP.expandCollapse.collapse( element )
            if ( control ) {
                control.classList.remove( 'state--expanded' )
                control.classList.add( 'state--collapsed' )
            }
            return
        }
        // requestAnimationFrame( APP.expandCollapse.expand )
        // element.setAttribute( 'data-collapsed', 'false' )
        APP.expandCollapse.expand( element )
        if ( control ) {
            control.classList.add( 'state--expanded' )
            control.classList.remove( 'state--collapsed' )
        }
        return
    },
    collapse : ( element = null ) => {
        if ( ! element._expanded ) {
            return
        }
        console.log( element )
        // get the height of the element's inner content, regardless of its actual size
        var sectionHeight = element.scrollHeight;
                
        // temporarily disable all css transitions
        var elementTransition = element.style.transition;
        element.style.transition = '';
        // on the next frame (as soon as the previous style change has taken effect),
        // explicitly set the element's height to its current pixel height, so we 
        // aren't transitioning out of 'auto'
        requestAnimationFrame( () => {
            element.style.height = sectionHeight + 'px'
            element.style.transition = elementTransition
            // on the next frame (as soon as the previous style change has taken effect),
            // have the element transition to starting height
            requestAnimationFrame( () => {
                element.style.height = element.getAttribute( 'data-collapsed-height' ) + 'px'
            })
        })
        // mark the section as "currently collapsed"
        element.setAttribute( 'data-collapsed', 'true' )
        element._expanded = false
        element.classList.remove( 'state--expanded' )
        element.classList.add( 'state--collapsed' )
        // scroll to previous expand position
        window.scroll({
            top: element.getBoundingClientRect().top + window.scrollY - 200,
            behavior: 'smooth'
        })

        //const index = 0
        //if ( ! APP.expandCollapse.elements[index]._expanded ) {
        //    return;
        //}
        //APP.expandCollapse.elements[index]._expanded = false;
        //var y = APP.Animate.elements[index]._collapsed.y;
        //var invY = 1 / y;
        //APP.Animate.elements[index].element.style.transform = `scaleY(${y})`;
        //$( APP.Animate.elements[index].element ).find( '.collapse--wrapper' ).get(0).style.transform = `scaleY(${invY})`
        ////APP.Animate.elements[index].element.style.transform = `scaleY(${invY})`
        //APP.expandCollapse._handleAccessbility(false)
        //if ( ! APP.Animate.elements[index]._animate ) {
        //    return;
        //}
        //APP.Animate._applyAnimation( index, { expand: false } )
    },
    expand : ( target = null ) => {
        if ( target._expanded ) {
            return;
        }
        let element = target
        // get the height of the element's inner content, regardless of its actual size
        var sectionHeight = element.scrollHeight
        // have the element transition to the height of its inner content
        element.style.height = sectionHeight + 'px'
        // when the next css transition finishes (which should be the one we just triggered)
        element.addEventListener( 'transitionend', function(e) {
            // remove this event listener so it only gets triggered once
            element.removeEventListener( 'transitionend', arguments.callee )
            // remove "height" from the element's inline styles, so it can return to its initial value
            // element.style.height = null
        });
        // mark the section as "currently not collapsed"
        element.setAttribute( 'data-collapsed', 'false' )
        element._expanded = true
        element.classList.remove( 'state--collapsed')
        element.classList.add( 'state--expanded')
        //const index = 0
        //if ( APP.expandCollapse.elements[index]._expanded ) {
        //    return;
        //}
        //APP.expandCollapse.elements[index]._expanded = true;
        //APP.Animate.elements[index].element.style.transform = `scaleY(1)`
        //$( APP.Animate.elements[index].element ).find( '.collapse--wrapper' ).get(0).style.transform = `scaleY(1)`
        //APP.expandCollapse._handleAccessbility(true)
        //if ( ! APP.Animate.elements[index]._animate ) {
        //    return;
        //}
        //APP.Animate._applyAnimation( index, { expand: true } )
    },
    _toggle : function(e) {
        e.preventDefault();
        var fullTextWrapper = e.parentElement.previousElementSibling;
        // Remove class from container
        if ( ! fullTextWrapper.classList.contains('showmore') ) {
            fullTextWrapper.classList.add('showmore');
            this.innerText = 'Read More';
            this.setAttribute('aria-expanded', false);
        }
        else {
            fullTextWrapper.classList.remove('showmore');
            this.innerText = 'Read Less';
            this.setAttribute('aria-expanded', true );
        }
        // change attributes and text if full text is shown/hidden
        // if ( ! fullTextWrapper.hasAttribute('hidden') ) {
        //     toggleButtonText.innerText = 'Show More';
        //     fullTextWrapper.setAttribute('hidden', true);
        //     toggleButton.setAttribute('aria-expanded', false);
        // } 
        // else {
        //     fullTextWrapper.removeAttribute('hidden');
        //     if ( ! toggleButton.classList.contains('hidden')) {
        //         toggleButton.classList.add( 'hidden' );
        //     }
        //     toggleButton.setAttribute('aria-expanded', true );
        //     toggleButtonText.innerText = 'Show Less';
        // }
    return false;
},
    _handleAccessbility : ( isExpand ) => {
        var tabindexValue = isExpand ? 0 : -1; 
        //this._sectionItemTitle.setAttribute('aria-expanded', isExpand)
        //this._sectionContent.setAttribute('aria-hidden', !isExpand)
        //this._sectionContent.setAttribute('tabindex', tabindexValue)
    },
}
APP.expandCollapse._init();
/**
 * [FilmSlider handles the films page slider]
 * @type {Object}
 */
APP.FilmSlider = {
	sliderClass : '.filmsslider',
	sliderElement : undefined,
	sliderConfig : {
		speed: 400,
		spaceBetween: 100,
		loop: true,
		autoplay: {
			delay: 8000,
		},
		navigation: {
			nextEl: '.filmsslider-next',
			prevEl: '.filmsslider-prev',
		},
		pagination: {
			el: '.filmsslider-pagination',
			clickable : true,
		},
	},
	/**
	 * [_init entry point]
	 */
	_init : () => {
		APP.FilmSlider.sliderElement = $( APP.FilmSlider.sliderClass )
		if ( APP.FilmSlider.sliderElement.lenth ) {
			APP.FilmSlider.slider = new Swiper( APP.FilmSlider.sliderClass, APP.FilmSlider.sliderConfig )
		}
	}
}
APP.FilmSlider._init()
APP.HHMessages = {
	messages : $('.homehero-messages-message'),
	index : 0,
	currentTimer : undefined,
	_init : function(){	
		$(window).on('load', function(){
			if( APP.Breakpoint._is('>=', 'medium') ){
				APP.HHMessages._feedMessages();
			}	
		});
		$(document).on('breakpoint', APP.HHMessages._breakpointHandler);
	},
	_feedMessages : function(){
		var messageTimeIn;
		if( APP.HHMessages.index === 0 ){
			// time from start of video when first message fades in
			messageTimeIn = $(APP.HHMessages.messages[APP.HHMessages.index]).attr('data-timein');
		}
		else{
			// time between messages
			messageTimeIn = $(APP.HHMessages.messages[APP.HHMessages.index - 1]).attr('data-timein') - $(APP.HHMessages.messages[APP.HHMessages.index]).attr('data-timeout');
		}

		// how long until fade out of current message
		var messageTimeOut = $(APP.HHMessages.messages[APP.HHMessages.index]).attr('data-timeout');	

		// time until fade in
		APP.HHMessages.currentTimer = setTimeout(function(){
			$(APP.HHMessages.messages[APP.HHMessages.index]).fadeIn(400, function(){
				// time until fade out
				APP.HHMessages.currentTimer = setTimeout(function(){
					$(APP.HHMessages.messages[APP.HHMessages.index]).fadeOut(400, function(){
						APP.HHMessages._updateIndex();
					});
				}, messageTimeOut);
			});
		}, messageTimeIn);
	},
	_updateIndex : function(){
		if( APP.HHMessages.index < APP.HHMessages.messages.length - 1 ){
			APP.HHMessages.index++;
			APP.HHMessages._feedMessages();
		}
		else{
			return;
		}
	},
	_resetFeed : function(){
		clearTimeout(APP.HHMessages.currentTimer);
		APP.HHMessages.messages.fadeOut(0);
		APP.HHMessages.currentTimer = undefined;
		APP.HHMessages.index = 0;
	},
	_breakpointHandler : function(e){
		if( APP.Breakpoint._is('<=', 'small') ){
			APP.HHMessages._resetFeed();
		}
		else if( e.device == 'medium' && e.direction == 'up' ){
			APP.HHMessages._resetFeed();
			APP.HHMessages._feedMessages();
		}
	},
}
APP.HHMessages._init();
APP.HHVideo = {
	hero : $('.homehero'),
	video : $('.homehero').length > 0 ? $('.homehero-video') : null,
	ended : false,
	_init : function(){
		if ( APP.HHVideo.video == null ) {
			return
		}
		APP.HHVideo.video.on( 'timeupdate', APP.HHVideo._timeupdateHandler );
		$(document).on( 'breakpoint', APP.HHVideo._breakpointHandler )
		APP.HHVideo.hero.on( 'click', APP.HHVideo._heroClickHandler )
		// $(window).on('scroll', APP.HHVideo._heroScrollkHandler )
	},
	_heroClickHandler : function(e){
		let heroLinkData = APP.HHVideo.hero.data( 'link' );
		if ( heroLinkData && heroLinkData.length > 0 && $(e.target).is('.homehero-footer-links-link, .homehero-footer-about') == false ){
			e.preventDefault()
			window.location.href = APP.HHVideo.hero.data('link')
		}
	},
	_heroScrollkHandler : function(e) {
		APP.HHVideo.ended = true
		APP.HHVideo.video.fadeOut(500)
	},
	_timeupdateHandler : function(e) {
		if ( APP.HHVideo.video.attr( 'loop' ) !== 'loop' && APP.HHVideo.video[0].currentTime * 1000 > APP.HHVideo.video[0].duration * 1000 - 1000 ){
			APP.HHVideo.ended = true
			APP.HHVideo.video.fadeOut(750)
		}
	},
	_breakpointHandler : function(e){
		if( e.device == 'medium' && e.direction == 'up' && APP.HHVideo.ended ){
			APP.HHVideo.ended = false
			APP.HHVideo.video.fadeIn(0)
			APP.HHVideo.video[0].currentTime = 0
			APP.HHVideo.video[0].play()
		}
	}
}
APP.HHVideo._init();
/**
 * [HeroFade controls the contextual hero & contained bg image (exhibition single pages) fade effect]
 * @type {Object}
 */
APP.HeroFade = {
	/**
	 * [hero the reference to the heroes]
	 * @type {jquery obj}
	 */
	hero : $('.contextualhero, .exhibitioncontainedhero-imagetagline, .exhibitionstandardhero-background, .exhibitionstandardhero-background-video, .legacyhero.fade'),
	/**
	 * [image the reference to the fade (this is the gradient layer)]
	 * @type {jQuery}
	 */
	bgImage : $('.legacyhero-background'),
	/**
	 * [fade the reference to the fade (this is the gradient layer)]
	 * @type {jQuery}
	 */
	fade : $('.contextualhero-background-fade, .exhibitionstandardhero-background-fade, .legacyhero-background-fade'),
	/**
	 * [tagline the contextual hero tagline]
	 * @type {jQuery obj}
	 */
	tagline : $('.contextualhero-background-tagline'),
	/**
	 * [legacy video contaier ]
	 * @type {jquery obj}
	 */
	legacyvideo : $('.legacyhero-video'),
	/**
	 * [hero the reference to the video]
	 * @type {jquery obj}
	 */
	video : $('.legacyhero-video').find( 'video' ),
	/**
	 * [has the video finished]
	 * @type boolean
	 */
	ended : false,
	/**
	 * [_init entry point]
	 */
	_init : function() {
		// check if hero exists
		if( APP.HeroFade.hero.length > 0 && ! $('body').hasClass('bc--no-hero-fade') ) {

			if ( $('.contextualhero').length > 0 ) {
				APP.HeroFade.heroType = $('.contextualhero')
			}
			else if ( $('.exhibitionstandardhero').length > 0 ) {
				APP.HeroFade.heroType = $('.exhibitionstandardhero-background')
			}
			// add event listener for scroll & load events on window
			$(window).on('scroll load', APP.HeroFade._scrollLoadHandler )
		}
		if ( APP.HeroFade.video.length > 0 ) { 
			if ( APP.HeroFade.bgImage.length ) {
				APP.HeroFade.video.on( 'ended timeupdate', APP.HeroFade._videoEnding )
			}
			// Breakpoint handler for med device in portrait orientatiion.
			$( document ).on( 'breakpoint', APP.HeroFade._breakpointHandler )
			// Prevent clicking from stopping the video
			APP.HeroFade.hero.on('click', APP.HeroFade._heroClickHandler )
		}
	},
	/**
	 * [_scrollLoadHandler handle the scroll & load events on the window obj]
	 * @param  {obj} e the event object
	 */
	_scrollLoadHandler : function(e){
		let mappedValue = 0
		// if it's the standard hero
		if ( APP.HeroFade.fade.hasClass( 'exhibitionstandardhero-background-fade' ) 
			|| APP.HeroFade.fade.hasClass( 'legacyhero-background-fade' ) ) {
			// map range of values as the distance between 0 and 40% the way to the bottom of the hero to the opacity of the hero from 1 to 0
			mappedValue = APP.HeroFade._map( $(window).scrollTop(), 0, APP.HeroFade.hero.outerHeight() * 0.40, 1, 0 )
			APP.HeroFade.hero.css('opacity', mappedValue );
		}
		// if it's the contextual hero
		else{
			// map range of values as the distance between 0 and 3/4 the way to the bottom of the hero to the opacity of the hero from 1 to 0
			mappedValue = APP.HeroFade._map( $(window).scrollTop(), 0, APP.HeroFade.hero.outerHeight() * 0.75, 1, 0 )
			APP.HeroFade.hero.css('opacity', mappedValue )
		}
		if ( mappedValue === 0 ) {
			APP.HeroFade.heroType.css('z-index', -1 )
		}
		else {
			APP.HeroFade.heroType.css('z-index', 0 )
		}
		// check if tagline exists
		if( APP.HeroFade.tagline.length > 0 ) {
			mappedValue = APP.HeroFade._map($(window).scrollTop(), 0, APP.HeroFade.hero.outerHeight() * 0.25, 1, 0)
			// add the fade effect
			APP.HeroFade.tagline.css('opacity', mappedValue )
		}
		// check for the fade
		if( APP.HeroFade.fade.length > 0 ){
			// is the contextual hero
			if ( APP.HeroFade.fade.hasClass( 'contextualhero-background-fade') ) {
				mappedValue = APP.HeroFade._map($(window).scrollTop(), 0, APP.HeroFade.hero.outerHeight() * 0.15, 0, 1 )
				// add fade effect to the fade
				APP.HeroFade.fade.css('opacity', mappedValue )
			}
			// is the standard hero
			else if ( APP.HeroFade.fade.hasClass( 'exhibitionstandardhero-background-fade' ) ) {
				// add fade effect to the fade
				APP.HeroFade.fade.css('transform', 'translate3d(0, ' + APP.HeroFade._map($(window).scrollTop(), 0, APP.HeroFade.hero.outerHeight(), 0, -1800) + 'px,0)');
			}
			else if ( APP.HeroFade.fade.hasClass( 'legacyhero-background-fade' ) ) {
				// add fade effect to the fade
				APP.HeroFade.fade.css('transform', 'translate3d(0, ' + APP.HeroFade._map($(window).scrollTop(), 0, APP.HeroFade.hero.outerHeight(), 0, -1800) + 'px,0)');
				// APP.HeroFade.fade.css( 'opacity', APP.HeroFade._map( $(window).scrollTop(), 0, APP.HeroFade.hero.outerHeight() * 0.15, 0, 1));
			}
		}
	},
	_heroClickHandler : function( e ) {
		e.preventDefault();
		return false;
	},
	_videoEnding : function( e ) {
		if ( APP.HeroFade.video[0].currentTime + 1 >= 27.264 ) {
			APP.HeroFade.ended = true;
			const imageURL = APP.HeroFade.bgImage.data('bg-image');
			APP.HeroFade.bgImage.css('background-image', 'url("' + imageURL + '")' ).fadeIn( 800 );
			APP.HeroFade.legacyvideo.find('>div').fadeOut( 800 );
		}
	},
	_breakpointHandler : function( e ){
		if ( e.device == 'medium' && e.direction == 'up' && APP.HeroFade.ended ) {
			APP.HeroFade.ended = false;
			APP.HeroFade.video.fadeIn(0);
			APP.HeroFade.video[0].currentTime = 0;
			APP.HeroFade.video[0].play();
		}
	},
	/**
	 * [_map amazing map function. remaps a range of numbers to another range based on high & low posts of two sets]
	 * @param  {number} v          the value to map
	 * @param  {number} e          the low point of the value
	 * @param  {number} g          the high point of the value
	 * @param  {number} a          the low point of the new value
	 * @param  {number} n          the high point of the new value
	 * @return {number}            the mapped value
	 */
	_map : function(v,e,g,a,n){return e>g?e>v?(v-e)*(n-a)/(g-e)+a:a:g>e?g>v?(v-e)*(n-a)/(g-e)+a:n:void 0;},
};

// blast off
APP.HeroFade._init();
APP.ImageLoader = {
	loadingClass : 'is--loading',
	/**
		 * [_init entry point]
		 */
	_init : () => {
		// console.log( 'image loader init' )
		$( document )
			.on( 'ready', ( e ) => {
			// console.log( 'document is ready' )
			const $images = $( 'img.is--loading' )
			// console.log( 'document images' , $images )
			if ( $images.length ) {
				$.each( $images, ( index, value ) => {
					if ( ! $images[ index ].complete ) {
						$images[ index ].addEventListener( 'load', APP.ImageLoader._handleImageLoad )
						$images[ index ].addEventListener( 'error', APP.ImageLoader._handleImageLoad )
					}
				} )
				APP.ImageLoader._fixCaptionWidth()
			}
		} ).on( 'breakpoint', APP.ImageLoader._breakpointHandler )
	},
	/**
	 * [_handleImageLoad handle loading of images ]
	 * @param {obj} e event object
	 */
	_handleImageLoad : ( e ) => {
		const $target = $( e.target )
		// const image = $target.get( 0 )
		if ( $target.length && $target.hasClass( APP.ImageLoader.loadingClass ) ) {
			$target.removeClass( APP.ImageLoader.loadingClass )
			$target.unbind( 'load', APP.ImageLoader._handleImageLoad )
			$target.unbind( 'error', APP.ImageLoader._handleImageLoad )
			//image.removeEventListener( 'load', APP.ImageLoader._handleImageLoad )
			//image.removeEventListener( 'error', APP.ImageLoader._handleImageLoad )
		}
	},
	_breakpointHandler : ( e ) => {
		APP.ImageLoader._fixCaptionWidth()
	},
	_fixCaptionWidth: () => {
		const imagesAndCaptions = [
		  ['.artistbioimage', '.artistbioimage-caption'],
		  ['.eventcard-wrapper-imagecontainer-image', '.eventcard-wrapper-imagecontainer-caption'],
		  ['.genericimage figure > a > img', '.genericimage figure > figcaption.genericimage-caption'],
		  ['.genericimage figure > img', '.genericimage figure > figcaption.genericimage-caption'],
		  ['.modulebuilder .featured-image-container > figure > img', '.modulebuilder .featured-image-container > figure > figcaption']
		]
		imagesAndCaptions.forEach( pair => {
		  const images = document.querySelectorAll(pair[0] )
		  const captions = document.querySelectorAll(pair[1] )
	  
		  // Check if there are matching pairs of images and captions
		  if ( images.length === captions.length && images.length > 0 ) {
			images.forEach((image, index) => {
			  const maxWidth = image.offsetWidth
			  captions[index].style.maxWidth = `${maxWidth}px`
			})
		  }
		})
	  }
}
APP.ImageLoader._init()
// ImageViewer.js — Vanilla JS only (no jQuery). Pan/zoom via anvaka/panzoom.
// --------------------------------------------------------------------------
window.APP = window.APP || {};

APP.ImageViewer = {
  version: '1.0.1-anvaka',
  initedAt: null,

  _inited: false,
  _els: {
    appRoot: null,
    stage: null,
    svgRoot: null,
    viewport: null,
    baseImage: null,
    status: null,
    anchorsNav: null,
    hotspots: null,
    zoomIn: null,
    zoomOut: null,
    reset: null,
    help: null,
    presetToggle: null,
    explainerDialog: null,
    completionDialog: null,
    toolbar: null
  },
  _pz: null,
  _cfg: null,
  _data: [],
  _state: {
    currentAnchorIndex: 0,
    currentHotspotIndex: -1,
    perAnchorTransform: new Map(),
    perAnchorTotals: new Map(),
    foundGlobal: new Set(),
    isDragging: false,
    dragLastX: 0,
    dragLastY: 0,
    baseScaleSafari: null,
    transform: { x: 0, y: 0, scale: 1 },
    firstTransformApplied: false,
    isTouchDevice: false,
    mobilePinchOnly: false,
    isPinching: false,
    lastPinchDistance: null,
    touchStartX: 0,
    touchStartY: 0,
    touchStartTime: 0,
    isNavigating: false ,
    hasSeenCompletionDialog: false
  },
  _defaultConfig: {
    domIds: {
      stage: 'stage',
      svgRoot: 'svgRoot',
      viewport: 'viewport',
      baseImage: 'baseImage',
      status: 'status',
      anchors: 'anchors',
      hotspots: 'hotspots',
      zoomIn: 'zoomIn',
      zoomOut: 'zoomOut',
      reset: 'reset',
      help: 'help',
      presetToggle: 'presetToggle',
      explainerDialog: 'explainerDialog',
      completionDialog: 'completionDialog',
      toolbar: 'toolbar'
    },
    ui: {
      minimalChrome: false,
      showStatus: true
    },
    viewer: {
      widthPx: null,
      heightPx: null,
      pixelLock: false,
      noLargerThanImage: false
    },
    behavior: {
      dragSensitivity: 60,
      wheelPanSensitivity: 60,
      hardBounds: false,
      arrowKeyPanDistance: 100,
      arrowKeyScaleWithZoom: false,
      mobilePinchOnly: false,
      requireCtrlToZoom: true
    },
    zoom: { min: 0.1, max: 100, speed: 0.4 },
    debugging: {
      enable: false,
      logs: false,
      enableCORS: false,
      enableDragLogs: false
    },
    hotspots: {
      effect: 'pulse',
      haloBlur: 0,
      pulseScale: 1.3,
      pulseDuration: 2
    }
  },

  _init: function () {
    if (this._inited) return;
    const maybeStageId = (window.CONFIG?.domIds?.stage) || this._defaultConfig.domIds.stage;
    if (!document.getElementById(maybeStageId)) return;

    this._inited = true;
    this.initedAt = Date.now();
    this._cfg = this._resolveConfig();
    this._data = Array.isArray(window.VIEWER_DATA) ? window.VIEWER_DATA : [];

    this._cacheDom();
    this._ensureBaseCss();
    this._applyViewerSizingAndTheme();
    this._initPanzoom();
    this._bindEvents();

    this._bootstrapImageAndFit()
      .then(() => {
        this._fadeInViewport();
        this._maybeShowExplainerOnLoad();
      })
      .catch((err) => this._log('bootstrap error:', err));
  },

  // -------- utils --------
  _log: function (...a) { if (this._cfg?.debugging?.enable && this._cfg?.debugging?.logs) console.log('[ImageViewer]', ...a); },
  _resolveConfig: function () {
    const deepMerge = (t, s) => {
      if (!s || typeof s !== 'object') return t;
      for (const k of Object.keys(s)) {
        const v = s[k];
        if (v && typeof v === 'object' && !Array.isArray(v)) {
          if (!t[k] || typeof t[k] !== 'object') t[k] = {};
          deepMerge(t[k], v);
        } else { t[k] = v; }
      }
      return t;
    };
    const cfg = JSON.parse(JSON.stringify(this._defaultConfig));
    const appRoot = document.getElementById('appRoot') || document.body;
    const presetFromDom = appRoot?.dataset?.preset || document.body?.dataset?.preset;
    if (presetFromDom && window.PRESETS?.[presetFromDom]) deepMerge(cfg, JSON.parse(JSON.stringify(window.PRESETS[presetFromDom])));
    if (window.CONFIG && typeof window.CONFIG === 'object') deepMerge(cfg, JSON.parse(JSON.stringify(window.CONFIG)));
    try {
      const q = new URLSearchParams(location.search);
      const toBool = (v) => (typeof v === 'boolean') ? v : (v === '1' || v === 'true' || v === 'yes');
      if (q.has('preset')) { const p = window.PRESETS?.[q.get('preset')]; if (p) deepMerge(cfg, JSON.parse(JSON.stringify(p))); }
      if (q.has('minimal')) cfg.ui.minimalChrome = toBool(q.get('minimal'));
      if (q.has('w')) cfg.viewer.widthPx = +q.get('w');
      if (q.has('h')) cfg.viewer.heightPx = +q.get('h');
      if (q.has('pixel')) cfg.viewer.pixelLock = toBool(q.get('pixel'));
      if (q.has('nolarger')) cfg.viewer.noLargerThanImage = toBool(q.get('nolarger'));
      if (q.has('drag')) cfg.behavior.dragSensitivity = +q.get('drag');
    } catch (_) {}
    return cfg;
  },
  _cacheDom: function () {
    const ids = this._cfg.domIds;
    const byId = (id) => document.getElementById(id);
    this._els.appRoot    = document.getElementById('appRoot') || document.body;
    this._els.stage      = byId(ids.stage);
    this._els.svgRoot    = byId(ids.svgRoot);
    this._els.viewport   = byId(ids.viewport);
    this._els.baseImage  = byId(ids.baseImage);
    this._els.status     = byId(ids.status);
    this._els.anchorsNav = byId(ids.anchors);
    this._els.hotspots   = byId(ids.hotspots);
    this._els.zoomIn     = byId(ids.zoomIn);
    this._els.zoomOut    = byId(ids.zoomOut);
    this._els.reset      = byId(ids.reset);
    this._els.help       = byId(ids.help);
    this._els.presetToggle = byId(ids.presetToggle);
    this._els.explainerDialog = byId(ids.explainerDialog);
    this._els.completionDialog = byId(ids.completionDialog);
    this._els.toolbar    = byId(ids.toolbar);
    if (this._els.stage && !this._els.stage.hasAttribute('tabindex')) this._els.stage.setAttribute('tabindex', '0');
  },
  _ensureBaseCss: function () {
    if (document.getElementById('image-viewer-base-css')) return;
    const s = document.createElement('style');
    s.id = 'image-viewer-base-css';
    s.textContent = `
      #${this._cfg.domIds.stage}{position:relative;width:100%;min-height:300px;touch-action:none;cursor:grab;margin:0 auto}
      @media (min-width: 768px) { }
      #${this._cfg.domIds.stage}:active{cursor:grabbing}
      #${this._cfg.domIds.svgRoot}{display:block;width:100%;height:100%}
    `.trim();
    document.head.appendChild(s);
  },

  // -------- image & fit --------
  _loadSvgImage: function (src, desiredW, desiredH) {
    return new Promise((resolve, reject) => {
      if (!src) return reject(new Error('Missing image src'));
      const img = new Image();
      if (this._cfg?.debugging?.enableCORS === true) img.crossOrigin = 'anonymous';
      img.onload = () => resolve({ naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight });
      img.onerror = () => reject(new Error('Failed to load image: ' + src));
      img.src = src;
    }).then(async dim => {
      const el  = this._els.baseImage;
      const bg  = document.getElementById('viewBkg') || document.getElementById('viewBgk');
      const svg = this._els.svgRoot;
      if (el) {
        el.removeAttribute('href');
        el.setAttribute('href', src);
        try { el.removeAttributeNS('http://www.w3.org/1999/xlink', 'href'); el.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', src); } catch (_) {}
        try { if (el.href && typeof el.href === 'object') el.href.baseVal = src; } catch (_) {}
        const w = desiredW || dim.naturalWidth  || 3000;
        const h = desiredH || dim.naturalHeight || 2000;
        el.setAttribute('width',  String(w));
        el.setAttribute('height', String(h));
        if (bg)  { bg.setAttribute('width',  String(w)); bg.setAttribute('height', String(h)); }
        if (svg) svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
        await new Promise(r => requestAnimationFrame(r));
        this._recomputeZoomCaps();
        return { w, h };
      }
      return dim;
    });
  },
  _applyViewerSizingAndTheme: function () {
    const cfg = this._cfg || {};
    const viewer = cfg.viewer || {};
    const stage = this._els && this._els.stage;
    const svg   = this._els && this._els.svgRoot;
    const bg    = document.getElementById('viewBkg') || document.getElementById('viewBgk');

    if (!stage) return;

    // Responsive sizing: Use provided dimensions as max-width and maintain aspect ratio
    const hasWidth = Number.isFinite(+viewer.widthPx) && +viewer.widthPx > 0;
    const hasHeight = Number.isFinite(+viewer.heightPx) && +viewer.heightPx > 0;
    
    if (hasWidth && hasHeight) {
      // Both dimensions provided - calculate aspect ratio and apply responsively
      const width = +viewer.widthPx;
      const height = +viewer.heightPx;
      const aspectRatio = width / height;
      
      // Use max-width so it shrinks on mobile but doesn't exceed desired size
      stage.style.maxWidth = `${width}px`;
      stage.style.width = '100%'; // Full width up to max
      
      // Maintain aspect ratio using modern CSS
      if (CSS.supports('aspect-ratio', `${aspectRatio}`)) {
        stage.style.aspectRatio = `${aspectRatio}`;
        stage.style.height = 'auto';
      } else {
        // Fallback for older browsers using padding-top technique
        stage.style.position = 'relative';
        stage.style.height = '0';
        stage.style.paddingTop = `${(height / width) * 100}%`;
        
        // SVG needs to be absolutely positioned for padding technique
        if (svg) {
          svg.style.position = 'absolute';
          svg.style.top = '0';
          svg.style.left = '0';
          svg.style.width = '100%';
          svg.style.height = '100%';
        }
      }
      
      // Set SVG viewBox preserveAspectRatio for proper scaling
      if (svg) {
        svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
      }
      
      this._log('Applied responsive sizing:', { width, height, aspectRatio });
    } else if (hasWidth) {
      // Only width provided - make responsive with max-width
      stage.style.maxWidth = `${+viewer.widthPx}px`;
      stage.style.width = '100%';
      if (svg) svg.setAttribute('width', `${+viewer.widthPx}`);
    } else if (hasHeight) {
      // Only height provided - less common but apply max-height
      stage.style.maxHeight = `${+viewer.heightPx}px`;
      stage.style.height = `${+viewer.heightPx}px`;
      if (svg) svg.setAttribute('height', `${+viewer.heightPx}`);
    }

    // Background color (stage or bg <rect> if present)
    const bgColor = viewer.backgroundColor || cfg.appearance?.backgroundColor;
    if (bgColor) {
      if (bg && bg.tagName && bg.tagName.toLowerCase() === 'rect') {
        bg.setAttribute('fill', bgColor);
      } else {
        stage.style.backgroundColor = bgColor;
      }
    }

    // Optional CSS variables (set on the stage so scoping is local)
    if (cfg.cssVars && typeof cfg.cssVars === 'object') {
      Object.entries(cfg.cssVars).forEach(([k, v]) => {
        // Accept keys as "--iv-foo" or "iv-foo"; normalize to CSS var
        const name = k.startsWith('--') ? k : `--${k}`;
        stage.style.setProperty(name, String(v));
      });
    }
  },
  _applyInitialFit: function (reason, anchor) {
  const stage = this._els.stage;
  const baseImage = this._els.baseImage;
  if (!stage || !baseImage || !this._pz) return;

  // Defensive viewport & image sizes
  const rect = stage.getBoundingClientRect ? stage.getBoundingClientRect() : { width: stage.clientWidth, height: stage.clientHeight };
  let viewW = Number(rect.width)  || Number(stage.clientWidth)  || 0;
  let viewH = Number(rect.height) || Number(stage.clientHeight) || 0;
  if (!Number.isFinite(viewW) || viewW <= 0) viewW = 1;
  if (!Number.isFinite(viewH) || viewH <= 0) viewH = 1;

  let imgW = Number(baseImage.getAttribute('width'))  || 0;
  let imgH = Number(baseImage.getAttribute('height')) || 0;
  if (!Number.isFinite(imgW) || imgW <= 0) imgW = 3000;
  if (!Number.isFinite(imgH) || imgH <= 0) imgH = 2000;

  const scaleX = viewW / imgW;
  const scaleY = viewH / imgH;
  let fitScale = Math.min(scaleX, scaleY);
  if (!Number.isFinite(fitScale) || fitScale <= 0) fitScale = 1;

  // Read any per-anchor zoom overrides
  let targetScale = fitScale;
  let targetX = 0, targetY = 0;
  if (anchor && anchor.image && anchor.image.zoom) {
    const z = anchor.image.zoom;
    // percent or scale factor
    const raw = z.scale ?? z.percent;
    if (raw !== undefined && raw !== '' && !isNaN(raw)) {
      const sFactor = Number(raw);
      // Scale is interpreted as percentage where 100 = fitScale (fit to viewport)
      // e.g., 100 = fitScale, 200 = 2x fitScale, 50 = 0.5x fitScale
      targetScale = (sFactor / 100) * fitScale;
    }
    if (z.position) {
      const zx = z.position.x, zy = z.position.y;
      const hasX = zx !== undefined && zx !== '' && !isNaN(zx);
      const hasY = zy !== undefined && zy !== '' && !isNaN(zy);
      if (hasX || hasY) {
        const scaledW = imgW * targetScale;
        const scaledH = imgH * targetScale;
        const centerX = (viewW - scaledW) / 2;
        const centerY = (viewH - scaledH) / 2;
        targetX = centerX + (hasX ? -Number(zx) * targetScale : 0);
        targetY = centerY + (hasY ? -Number(zy) * targetScale : 0);
      }
    }
  }

  // Respect runtime zoom caps (after _recomputeZoomCaps())
  const minS = Number(this._cfg?.zoom?.min ?? 0.1);
  const maxS = Number(this._cfg?.zoom?.max ?? 20);
  let s = Math.min(maxS, Math.max(minS, targetScale));
  if (!Number.isFinite(s) || s <= 0) s = fitScale;

  // If no custom position, center at chosen scale
  if (!Number.isFinite(targetX) || !Number.isFinite(targetY) || (targetX === 0 && targetY === 0)) {
    const scaledW = imgW * s;
    const scaledH = imgH * s;
    targetX = (viewW - scaledW) / 2;
    targetY = (viewH - scaledH) / 2;
  }

  // Zoom and move (finite guards)
  const cx = Number.isFinite(viewW) ? viewW / 2 : 0.5;
  const cy = Number.isFinite(viewH) ? viewH / 2 : 0.5;
  this._pz.zoomAbs(cx, cy, s);
  if (!Number.isFinite(targetX)) targetX = 0;
  if (!Number.isFinite(targetY)) targetY = 0;
  this._pz.moveTo(targetX, targetY);

  // One-frame clamp if hard bounds on
  if (this._cfg?.behavior?.hardBounds) {
    requestAnimationFrame(() => this._clampTransformByRects && this._clampTransformByRects());
  }

  this._log('initial fit', { reason, scale: s, x: targetX, y: targetY });
},
_recomputeZoomCaps: function () {
  const cfg = this._cfg || {};
  const viewer = cfg.viewer || {};
  const zoomCfg = cfg.zoom || {};
  const stage = this._els && this._els.stage;
  const baseImage = this._els && this._els.baseImage;
  if (!stage || !baseImage) return;

  const rect = stage.getBoundingClientRect ? stage.getBoundingClientRect() : { width: stage.clientWidth, height: stage.clientHeight };
  const viewW = Math.max(1, Number(rect.width)  || Number(stage.clientWidth)  || 1);
  const viewH = Math.max(1, Number(rect.height) || Number(stage.clientHeight) || 1);
  const imgW  = Math.max(1, Number(baseImage.getAttribute('width'))  || 1);
  const imgH  = Math.max(1, Number(baseImage.getAttribute('height')) || 1);

  const fitScale = Math.min(viewW / imgW, viewH / imgH) || 1;

  // Calculate max zoom
  let newMax = Number(zoomCfg.max);
  
  const pixelLock = viewer.pixelLock === true;
  const dpr = (pixelLock && window.devicePixelRatio) ? window.devicePixelRatio : 1;
  const noLargerThanImage = viewer.noLargerThanImage === true;
  
  if (noLargerThanImage) {
    // Cap at native size (1.0), but allow devicePixelRatio if pixelLock is on
    // Example: On 2x display with pixelLock, allow up to 2.0 (pixel-perfect on retina)
    const nativeMax = pixelLock ? dpr : 1.0;
    // But always allow at least fitScale so image can fill viewport
    newMax = Math.max(fitScale, nativeMax);
    this._log('noLargerThanImage: capping max zoom', { fitScale, nativeMax, dpr, finalMax: newMax });
  } else if (pixelLock) {
    // pixelLock without noLargerThanImage: use dpr as a sensible default but allow config override
    newMax = Math.max(dpr, Number(zoomCfg.max) || dpr);
    this._log('pixelLock: using devicePixelRatio', { dpr, configMax: zoomCfg.max, finalMax: newMax });
  } else {
    // Standard mode: use configured max or sensible default
    if (!Number.isFinite(newMax) || newMax <= 0) newMax = 20;
  }

  // Calculate min zoom
  let newMin = Number(zoomCfg.min);
  if (!Number.isFinite(newMin) || newMin <= 0) newMin = 0.1;
  
  const hardBounds = cfg.behavior?.hardBounds === true;
  if (hardBounds) {
    // Cover scale = image must be large enough to cover viewport entirely
    // Use MAX of width/height ratios (opposite of fitScale which uses MIN)
    const coverScale = Math.max(viewW / imgW, viewH / imgH);
    newMin = Math.max(newMin, coverScale);
    this._log('hardBounds: enforcing minimum cover scale', { coverScale, fitScale, newMin });
  } else {
    // Without hardBounds, allow zooming out to see full image
    newMin = Math.min(newMin, fitScale * 0.5);
  }

  // Update internal config
  this._cfg.zoom.min = newMin;
  this._cfg.zoom.max = newMax;

  // Update panzoom instance limits
  if (this._pz) {
    // Dispose old instance and create new one with updated limits
    const currentTransform = this._pz.getTransform();
    this._pz.dispose();
    
    // Reinitialize with new limits
    const requireCtrlToZoom = !!this._cfg.behavior.requireCtrlToZoom;
    this._pz = window.panzoom(this._els.viewport, {
      minZoom: newMin,
      maxZoom: newMax,
      zoomSpeed: this._cfg.zoom.speed,
      disableKeyboardInteraction: true,
      beforeWheel: (e) => requireCtrlToZoom && !e.ctrlKey && !e.metaKey,
      filterKey: function() { return true; }
    });
    
    // Restore transform (but clamp to new limits)
    const clampedScale = Math.max(newMin, Math.min(newMax, currentTransform.scale));
    this._pz.zoomAbs(viewW / 2, viewH / 2, clampedScale);
    this._pz.moveTo(currentTransform.x, currentTransform.y);
    
    // Re-bind transform listener
    this._pz.on('transform', this._onTransform.bind(this));
    
    this._log('Reinitialized panzoom with new limits', { newMin, newMax });
  }

  this._log('zoom caps computed', { 
    min: newMin, 
    max: newMax, 
    fitScale, 
    hardBounds,
    noLargerThanImage,
    pixelLock,
    devicePixelRatio: window.devicePixelRatio 
  });
},
  _bootstrapImageAndFit: async function () {
    const first = this._data?.[0];
    const existingHref = this._els.baseImage?.getAttribute('href') || this._els.baseImage?.getAttribute('xlink:href');
    const src = first?.image?.src || existingHref;
    
    if (src) {
      // Load image first
      await this._loadSvgImage(src, first?.image?.width, first?.image?.height).catch(err => this._log(err));
    }
    
    // DON'T call _recomputeZoomCaps here if hardBounds is on - let initial fit happen first
    const shouldDeferZoomCaps = this._cfg?.behavior?.hardBounds && first?.image?.zoom;
    
    if (!shouldDeferZoomCaps) {
      this._recomputeZoomCaps();
    }
    
    // Apply initial fit with any configured zoom/position
    this._applyInitialFit('bootstrap', first);
    
    // NOW recompute zoom caps after initial fit is applied
    if (shouldDeferZoomCaps) {
      // Allow one frame for initial fit to settle
      requestAnimationFrame(() => {
        this._recomputeZoomCaps();
      });
    }
    
    // Render initial hotspot SVG elements
    this._renderHotspots();
    // Initialize counter
    this._updateCounter();
    // Render hotspot navigation pips if enabled
    this._renderHotspotPips();
  },
  _fadeInViewport: function () {
    const vp = this._els.viewport;
    if (!vp) return;
    
    // Ensure smooth fade-in
    vp.style.opacity = '1';
    vp.style.transition = 'opacity 0.3s ease';
    
    this._log('Viewport faded in');
  },

  // -------- transform --------
  _setXform: function ({ x, y, scale }) {
    // Store transform state for tracking
    this._state.transform.x = x;
    this._state.transform.y = y;
    this._state.transform.scale = scale;
    
    // Don't manually set viewport transform - panzoom handles it now
    // The viewport SVG group gets transformed by panzoom directly
    
    if (this._cfg?.progress?.showStatus && this._els.status) {
      this._els.status.textContent = `Scale: ${scale.toFixed(2)} • (x: ${Math.round(x)}, y: ${Math.round(y)})`;
    }
    if (!this._state.firstTransformApplied) {
      this._state.firstTransformApplied = true;
      this._fadeInViewport();
    }
  },
  _clampXY: function (x, y, scale) {
    const stage = this._els.stage;
    const baseImage = this._els.baseImage;
    if (!stage || !baseImage) return { x, y };
    const imgW = +baseImage.getAttribute('width')  || 3000;
    const imgH = +baseImage.getAttribute('height') || 2000;
    const rect = stage.getBoundingClientRect();
    const viewW = rect.width, viewH = rect.height;
    const scaledW = imgW * scale, scaledH = imgH * scale;
    const minX = Math.min(0, viewW - scaledW);
    const minY = Math.min(0, viewH - scaledH);
    const centerX = (viewW - scaledW) / 2;
    const centerY = (viewH - scaledH) / 2;
    return {
      x: (imgW <= viewW)  ? centerX : Math.max(minX, Math.min(0, x)),
      y: (imgH <= viewH)  ? centerY : Math.max(minY, Math.min(0, y))
    };
  },

  // -------- panzoom --------
  _initPanzoom: function () {
    const stage = this._els.stage;
    const viewport = this._els.viewport;
    if (!stage || !viewport || !window.panzoom) { console.warn('[ImageViewer] panzoom not found/stage or viewport missing.'); return; }
    
    // Detect if we're on a touch device
    const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (navigator.msMaxTouchPoints > 0);
    const mobilePinchOnly = this._cfg?.behavior?.mobilePinchOnly ?? false;
    const requireCtrlToZoom = !!this._cfg.behavior.requireCtrlToZoom;
    
    // Store touch state for pinch-only mode
    this._state.isTouchDevice = isTouchDevice;
    this._state.mobilePinchOnly = mobilePinchOnly;
    this._state.isPinching = false;
    
    // Apply panzoom to the viewport SVG group directly, not the stage
    this._pz = window.panzoom(viewport, {
      minZoom: this._cfg.zoom.min,
      maxZoom: this._cfg.zoom.max,
      zoomSpeed: this._cfg.zoom.speed,
      disableKeyboardInteraction: true,
      beforeWheel: (e) => requireCtrlToZoom && !e.ctrlKey && !e.metaKey,
      // Filter mouse events - panzoom will handle them
      filterKey: function() { return true; }
    });
    
    this._pz.on('transform', this._onTransform.bind(this));
    const zoomStepMult = 1 + (this._cfg.zoom.speed / 4);
    requestAnimationFrame(() => this._clampTransformByRects());
    
    this._log('Panzoom initialized', { isTouchDevice, mobilePinchOnly });
  },

  // -------- events --------
  _bindEvents: function () {
    const stage = this._els.stage;
    if (!stage) return;
    stage.addEventListener('wheel', (e) => this._onWheel(e), { passive: false });
    stage.addEventListener('pointerdown', (e) => this._onPointerDown(e));
    stage.addEventListener('pointermove', (e) => this._onPointerMove(e));
    stage.addEventListener('pointerup',   (e) => this._onPointerUp(e));
    stage.addEventListener('pointercancel', (e) => this._onPointerUp(e));
    stage.addEventListener('pointerleave',  (e) => this._onPointerUp(e));
    stage.addEventListener('keydown', (e) => this._onKeydown(e));
    
    // Touch events for pinch detection (mobile pinch-only mode)
    if (this._state.isTouchDevice && this._state.mobilePinchOnly) {
      stage.addEventListener('touchstart', (e) => this._onTouchStart(e), { passive: false });
      stage.addEventListener('touchmove', (e) => this._onTouchMove(e), { passive: false });
      stage.addEventListener('touchend', (e) => this._onTouchEnd(e), { passive: false });
    }
    
    this._els.zoomIn  && this._els.zoomIn.addEventListener('click',  () => this._pz?.zoomIn());
    this._els.zoomOut && this._els.zoomOut.addEventListener('click', () => this._pz?.zoomOut());
    this._els.reset   && this._els.reset.addEventListener('click',   () => {
      this._state.perAnchorTransform.clear();
      this._applyInitialFit('reset', this._data[this._state.currentAnchorIndex]);
    });
    
    // Help button - show explainer dialog
    this._els.help && this._els.help.addEventListener('click', () => this._showExplainer());
    
    // Preset toggle - toggle minimal chrome mode
    this._els.presetToggle && this._els.presetToggle.addEventListener('click', () => this._togglePreset());
    
    // Hotspot navigation - next/prev buttons
    const nextBtn = document.getElementById('hotspotNext');
    const prevBtn = document.getElementById('hotspotPrev');
    if (nextBtn) nextBtn.addEventListener('click', () => this._goToNextHotspot());
    if (prevBtn) prevBtn.addEventListener('click', () => this._goToPrevHotspot());
    
    // Details dialog - close button and backdrop click
    const detailsDialog = document.getElementById('detailsDialog');
    if (detailsDialog) {
      // Close button
      const closeBtn = detailsDialog.querySelector('.iv-close, [value="cancel"], button[value="close"]');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => {
          detailsDialog.close();
          this._maybeShowModalOnCompleted();
        });
        detailsDialog.addEventListener('close', this._onModalClosed.bind(this));
        detailsDialog.addEventListener('cancel', this._onModalClosed.bind(this));
      }
      
      // Backdrop click to close
      detailsDialog.addEventListener('click', (e) => {
        if (e.target === detailsDialog) {
          detailsDialog.close();
        }
      });
    }
    
    // Delegated hotspot click handler on viewport (backup)
    if (this._els.viewport) {
      // Handle both click and touchend for better mobile support
      const handleHotspotActivation = (e) => {
        const hotspotEl = e.target.closest('.hotspot');
        if (hotspotEl) {
          e.preventDefault();
          e.stopPropagation();
          
          const hotspotId = hotspotEl.getAttribute('data-hotspot-id');
          const anchorIndex = parseInt(hotspotEl.getAttribute('data-anchor-index') || this._state.currentAnchorIndex, 10);
          
          if (hotspotId) {
            this._log('Hotspot activated:', hotspotId, 'via', e.type);
            this._state.lastTriggerEl = hotspotEl;
            this._activateHotspot(hotspotEl);
            
            const anchor = this._data[anchorIndex];
            const hotspot = anchor?.hotspots?.find(h => h.id === hotspotId);
            
            if (hotspot && hotspot.meta) {
              this._log('Found hotspot data, showing details');
              this._showHotspotDetails(hotspotId, hotspot.meta, anchorIndex);
            } else {
              this._log('WARNING: Hotspot found but no meta data', { hotspotId, anchor, hotspot });
            }
          }
        }
      };
      
      // Use click for desktop and touchend for mobile
      this._els.viewport.addEventListener('click', handleHotspotActivation, { capture: false });
      
      // Add touchend listener for more reliable mobile interaction
      if (this._state.isTouchDevice) {
        this._els.viewport.addEventListener('touchend', (e) => {
          // Only handle if it was a tap (not a drag)
          if (e.changedTouches && e.changedTouches.length > 0) {
            const touch = e.changedTouches[0];
            const dx = Math.abs(touch.clientX - (this._state.touchStartX || touch.clientX));
            const dy = Math.abs(touch.clientY - (this._state.touchStartY || touch.clientY));
            
            // If minimal movement, treat as tap
            if (dx < 10 && dy < 10) {
              handleHotspotActivation(e);
            }
          }
        }, { capture: false, passive: false });
      }
    }
    
    if (this._els.anchorsNav) {
      this._els.anchorsNav.addEventListener('click', (e) => {
        // Look for buttons with data-index or data-anchor-index
        const target = e.target.closest('[data-index]') || e.target.closest('[data-anchor-index]') || e.target.closest('a');
        if (!target) return;
        let idx = target.getAttribute('data-index');
        if (idx == null) idx = target.getAttribute('data-anchor-index');
        if (idx == null && target.dataset) idx = target.dataset.anchorIndex;
        if (idx == null && target.dataset) idx = target.dataset.index;
        if (idx == null) return;
        e.preventDefault();
        const n = parseInt(idx, 10);
        if (!Number.isNaN(n)) this._gotoAnchor(n);
      });
    }
    const stageEl = stage;
    stageEl.addEventListener('gesturestart', (e) => { e.preventDefault(); this._state.baseScaleSafari = this._state.transform.scale; }, { passive: false });
    stageEl.addEventListener('gesturechange', (e) => {
      if (this._state.baseScaleSafari == null) return; e.preventDefault();
      const next = Math.max(this._cfg.zoom.min, Math.min(this._cfg.zoom.max, this._state.baseScaleSafari * e.scale));
      const r = stage.getBoundingClientRect(); this._pz?.zoomAbs(r.width/2, r.height/2, next);
    }, { passive: false });
    stageEl.addEventListener('gestureend', () => { this._state.baseScaleSafari = null; }, { passive: false });
    window.addEventListener('resize', this._onResize.bind(this) );
  },
  _onResize: function () {
    if (!this._pz) return;
    this._recomputeZoomCaps();
    requestAnimationFrame(() => {
      if (this._clampTransformByRects) this._clampTransformByRects();
    });
  },
  _onWheel: function (e) {
    if (e.ctrlKey || e.metaKey) return;
    e.preventDefault();
    // Use wheelPanSensitivity if available, otherwise dragPanMultiplier
    const multiplier = this._cfg?.behavior?.wheelPanSensitivity ?? this._cfg?.behavior?.dragPanMultiplier ?? 1.5;
    const dx = -e.deltaX * multiplier;
    const dy = -e.deltaY * multiplier;
    this._pz?.moveBy(dx, dy);
    if (this._cfg?.debugging?.enableDragLogs) this._log('[WHEEL PAN]', { deltaX: e.deltaX, deltaY: e.deltaY, multiplier, appliedX: dx, appliedY: dy });
  },
  _onPointerDown: function (e) {
    if (e.button !== 0) return;
    
    const target = e.target;
    
    // 1. Ignore hotspots (existing behavior)
    if (target && (
      target.classList.contains('hotspot') ||
      target.closest('.hotspot') ||
      target.closest('.hotspot-group')
    )) {
      this._log('Clicked on hotspot, skipping drag');
      return; // Let the hotspot handle the click
    }

    // 2. NEW: ignore hotspot UI controls (pips + prev/next buttons + any future controls)
    if (target && (
      target.classList.contains('hotspot-pip') ||
      target.closest('.hotspot-pips') ||
      target.closest('.hotspot-nav')
    )) {
      this._log('Pointer down on hotspot nav UI, skipping drag');
      return; // Let the button/pip handle the click normally
    }

    // 3. FIXED: Only block touch drag during active pinch, not all the time
    if (this._state.isTouchDevice && this._state.mobilePinchOnly && e.pointerType === 'touch' && this._state.isPinching) {
      this._log('Currently pinching: blocking touch drag');
      return; // Don't start drag during an active pinch gesture
    }

    // 4. Start drag as before
    this._state.isDragging = true;
    this._state.dragLastX = e.clientX;
    this._state.dragLastY = e.clientY;

    this._state.currentHotspotIndex = -1;
    this._updateHotspotPips();
    
    // Only prevent default for mouse, not touch - let touch events bubble for clicks
    if (e.pointerType !== 'touch') {
      e.preventDefault();
    }
    e.stopImmediatePropagation();
    this._els.stage.setPointerCapture?.(e.pointerId);
    this._els.stage.style.cursor = 'grabbing';
  },
  _onPointerMove: function (e) {
    if (!this._state.isDragging || !this._pz) return;
    
    // For touch events, check if we've moved enough to be considered a drag vs tap
    if (e.pointerType === 'touch' && this._state.touchStartX !== undefined) {
      const dx = Math.abs(e.clientX - this._state.touchStartX);
      const dy = Math.abs(e.clientY - this._state.touchStartY);
      const dragThreshold = 10; // pixels
      
      // If we haven't moved much, don't consider this a drag yet
      if (dx < dragThreshold && dy < dragThreshold) {
        return;
      }
    }
    
    e.preventDefault();
    e.stopImmediatePropagation();
    const rawDX = e.clientX - this._state.dragLastX;
    const rawDY = e.clientY - this._state.dragLastY;
    this._state.dragLastX = e.clientX;
    this._state.dragLastY = e.clientY;
    
    // Use dragPanMultiplier if available, otherwise fall back to dragSensitivity calculation
    const multiplier = this._cfg?.behavior?.dragPanMultiplier ?? 1.5;
    const dx = rawDX * multiplier;
    const dy = rawDY * multiplier;
    
    this._pz.moveBy(dx, dy);
    if (this._cfg?.debugging?.enableDragLogs) this._log('[DRAG]', { rawDX, rawDY, multiplier, appliedDX: dx, appliedDY: dy });
  },
  _onPointerUp: function (e) {
    const wasDragging = this._state.isDragging;
    
    if (!wasDragging) return;
    
    // Check if this was a tap (minimal movement) vs a real drag
    let wasTap = false;
    if (e.pointerType === 'touch' && this._state.touchStartX !== undefined) {
      const dx = Math.abs(e.clientX - this._state.touchStartX);
      const dy = Math.abs(e.clientY - this._state.touchStartY);
      const dt = Date.now() - this._state.touchStartTime;
      const dragThreshold = 10; // pixels
      const timeThreshold = 300; // ms
      
      // If movement was minimal and quick, it's a tap
      wasTap = (dx < dragThreshold && dy < dragThreshold && dt < timeThreshold);
    }
    
    const target = e.target;
    if (target && (
      target.classList.contains('hotspot') ||
      target.closest('.hotspot') ||
      target.closest('.hotspot-group')
    )) {
      // If this was a tap on a hotspot, allow the click event
      if (wasTap) {
        this._state.isDragging = false;
        this._els.stage.releasePointerCapture?.(e?.pointerId);
        this._els.stage.style.cursor = '';
        return; // Don't prevent, let click fire
      }
      return;  // Was a drag, don't allow click
    }
    
    if (!wasTap) {
      e?.preventDefault?.();
      e?.stopImmediatePropagation?.();
    }
    this._els.stage.releasePointerCapture?.(e?.pointerId);
    this._state.isDragging = false;
    this._els.stage.style.cursor = '';
  },
  _onKeydown: function (e) {
    if (!this._pz) return;
    const panBase = this._cfg?.behavior?.arrowKeyPanDistance || 100;
    const factor = (this._cfg?.behavior?.arrowKeyScaleWithZoom ? (1 / (this._state.transform.scale || 1)) : 1);
    const step = Math.round(panBase * factor);
    const zoomStep = 1 + (this._cfg.zoom.speed / 4);
    const zoomTo = (mult) => { const r = this._els.stage.getBoundingClientRect(); this._pz.smoothZoomAbs(r.width/2, r.height/2, (this._state.transform.scale || 1) * mult); };
    switch (e.key) {
      case 'ArrowLeft':  e.preventDefault(); this._pz.moveBy( step,  0); break;
      case 'ArrowRight': e.preventDefault(); this._pz.moveBy(-step,  0); break;
      case 'ArrowUp':    e.preventDefault(); this._pz.moveBy( 0,     step); break;
      case 'ArrowDown':  e.preventDefault(); this._pz.moveBy( 0,    -step); break;
      case '+': case '=': case 'Add': case 'NumpadAdd':           e.preventDefault(); zoomTo( zoomStep); break;
      case '-': case '_': case 'Subtract': case 'NumpadSubtract': e.preventDefault(); zoomTo(1/zoomStep); break;
    }
  },

  // -------- touch events (mobile pinch-only mode) --------
  _onTouchStart: function (e) {
    if (e.touches.length === 2) {
      // Two finger touch = pinch gesture
      this._state.isPinching = true;
      this._state.lastPinchDistance = this._getTouchDistance(e.touches[0], e.touches[1]);
      this._log('Pinch started');
    } else if (e.touches.length === 1) {
      // Single touch - track for tap vs drag detection
      this._state.isPinching = false;
      this._state.touchStartX = e.touches[0].clientX;
      this._state.touchStartY = e.touches[0].clientY;
      this._state.touchStartTime = Date.now();
    }
  },
  
  _onTouchMove: function (e) {
    if (this._state.isPinching && e.touches.length === 2) {
      e.preventDefault(); // Prevent default zoom behavior
      const currentDistance = this._getTouchDistance(e.touches[0], e.touches[1]);
      const lastDistance = this._state.lastPinchDistance;
      
      if (lastDistance) {
        // Calculate zoom change with damping for smoother zoom
        const rawRatio = currentDistance / lastDistance;
        // Apply damping to make it less sensitive - only use 30% of the change
        const dampingFactor = 0.3;
        const scale = 1 + (rawRatio - 1) * dampingFactor;
        
        const currentScale = this._state.transform.scale || 1;
        const newScale = Math.max(this._cfg.zoom.min, Math.min(this._cfg.zoom.max, currentScale * scale));
        
        // Get center point between touches
        const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        
        // Apply zoom at the pinch center
        this._pz?.zoomAbs(centerX, centerY, newScale);
        
        if (this._cfg?.debugging?.enableDragLogs) {
          this._log('[PINCH]', { rawRatio, dampedScale: scale, currentScale, newScale, centerX, centerY });
        }
      }
      
      this._state.lastPinchDistance = currentDistance;
    } else if (e.touches.length === 1 && !this._state.isPinching) {
      // Allow single touch to pass through so hotspots can be clicked
      // Don't prevent default here - let click events fire
    }
  },
  
  _onTouchEnd: function (e) {
    if (e.touches.length < 2) {
      const wasPinching = this._state.isPinching;
      this._state.isPinching = false;
      this._state.lastPinchDistance = null;
      
      // Re-apply bounds after pinch ends
      if (wasPinching) {
        requestAnimationFrame(() => {
          this._clampTransformByRects();
          this._log('Pinch ended, bounds re-applied');
        });
      }
    }
  },
  
  _getTouchDistance: function (touch1, touch2) {
    const dx = touch2.clientX - touch1.clientX;
    const dy = touch2.clientY - touch1.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  },

  // -------- anchors --------
  _gotoAnchor: async function (index) {
    // return if already on this anchor
    if (this._state.currentAnchorIndex === index) return;

    if (!Array.isArray(this._data) || !this._data[index]) return;
    
    // 1. FIX: Save the OLD image's state immediately before we touch anything
    const oldIndex = this._state.currentAnchorIndex;
    if (this._pz) {
        const t = this._pz.getTransform();
        this._state.perAnchorTransform.set(oldIndex, { x: t.x, y: t.y, scale: t.scale });
    }

    // 2. FIX: Set flag to block _onTransform from overwriting state during load
    this._state.isSwitchingImage = true;
    
    // 3. Now safe to update index
    this._state.currentAnchorIndex = index;
    const anchor = this._data[index];

    // 4. Load the new image
    if (anchor?.image?.src) {
      await this._loadSvgImage(anchor.image.src, anchor.image.width, anchor.image.height)
        .catch((err) => this._log('anchor image load error', err));
    }

    // 5. Restore the NEW image's state (if it exists)
    const snap = this._state.perAnchorTransform.get(index);
    if (snap) {
      const r = this._els.stage.getBoundingClientRect();
      // Use snap.scale, fallback to 1 if invalid
      this._pz?.zoomAbs(r.width/2, r.height/2, snap.scale || 1);
      this._pz?.moveTo(snap.x || 0, snap.y || 0);
      this._log('Restored previous state for anchor', index, snap);
    } else {
      // First time visiting this anchor? Use default fit.
      this._applyInitialFit('anchor', anchor);
    }
    
    // 6. Render hotspots/UI updates (existing code)
    this._renderHotspots(index);
    this._updateCounter();
    this._state.currentHotspotIndex = -1;
    this._renderHotspotPips();
    
    if (this._els.anchorsNav) {
      this._els.anchorsNav.querySelectorAll('[data-index], [data-anchor-index]').forEach(el => {
        const btnIndex = parseInt(el.getAttribute('data-index') || el.dataset.index || el.getAttribute('data-anchor-index') || el.dataset.anchorIndex, 10);
        if (!Number.isNaN(btnIndex)) {
          const isActive = btnIndex === index;
          el.classList.toggle('is-active', isActive);
          el.classList.toggle('active', isActive);
          el.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        }
      });
    }

    // 7. FIX: Unblock updates, allowing new moves to be saved
    // Small timeout ensures the "restore" movement above settles first
    setTimeout(() => {
        this._state.isSwitchingImage = false;
    }, 50);
  },

  // -------- hotspots --------
  _renderHotspots: function (anchorIndex) {
    // if anchorIndex not provided, use current
    if ( anchorIndex == null ) {
        // continue to intialize hotspots on first load
        anchorIndex = this._state.currentAnchorIndex;
    }
    if (!this._data || !this._data[anchorIndex]) return;

    const anchor = this._data[anchorIndex];
    const hotspots = anchor.hotspots || [];
    const viewport = this._els.viewport;
    
    if (!viewport) return;
    
    // Remove all existing hotspot elements
    viewport.querySelectorAll('.hotspot, .hotspot-halo, .hotspot-group').forEach(el => el.remove());
    
    if (!hotspots.length) {
      this._log('No hotspots for anchor', anchorIndex);
      return;
    }
    
    // Create CSS for animations if needed
    let s = document.getElementById('hotspot-dynamic-styles');
    if (!s) { 
      s = document.createElement('style'); 
      s.id = 'hotspot-dynamic-styles'; 
      document.head.appendChild(s); 
    }
    let css = '';
    hotspots.forEach(hotspot => {
      const hsId = hotspot.id || 'unknown';
      const styles = hotspot.hot_styles || {};
      const globalConfig = this._cfg?.hotspots || {};
      const effect = styles.effect ?? globalConfig.effect ?? 'none';
    });
    s.textContent = css;
    // Now create the actual SVG elements for each hotspot
    hotspots.forEach(hotspot => {
      const { id, type, base } = hotspot;
      const styles = hotspot.hot_styles || {};
      const globalConfig = this._cfg?.hotspots || {};
      
      if (!base || !id) return;
      
      // Check if this hotspot was previously found
      const foundKey = `${anchorIndex}-${id}`;
      const wasFound = this._state.foundGlobal.has(foundKey);
      
      // Create a group for this hotspot
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.classList.add('hotspot-group');
      g.setAttribute('data-hotspot-id', id);
      
      // Apply found class to group if previously discovered
      if (wasFound) {
        g.classList.add('hotspot-group--found');
      }
      
      // Create the visible hotspot element (circle or rect)
      let hotspotEl;
      if (type === 'circle') {
        hotspotEl = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        hotspotEl.setAttribute('cx', base.cx || 0);
        hotspotEl.setAttribute('cy', base.cy || 0);
        hotspotEl.setAttribute('r', base.r || 22);
      } else if (type === 'rect') {
        hotspotEl = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        hotspotEl.setAttribute('x', base.x || 0);
        hotspotEl.setAttribute('y', base.y || 0);
        hotspotEl.setAttribute('width', base.width || 44);
        hotspotEl.setAttribute('height', base.height || 44);
        if (base.rx) hotspotEl.setAttribute('rx', base.rx);
      }
      
      if (!hotspotEl) return;

      // Apply base styles
      hotspotEl.classList.add('hotspot');
      hotspotEl.setAttribute('data-hotspot-id', id);
      hotspotEl.setAttribute('fill', 'var(--accent, #66c2ff)');
      hotspotEl.setAttribute('data-anchor-index', anchorIndex);
      hotspotEl.style.cursor = 'pointer';
      hotspotEl.style.pointerEvents = 'all';
      
      // Apply found class to hotspot element if previously discovered
      if (wasFound) {
        hotspotEl.classList.add('hotspot--found');
      }
      
      // Apply any custom inline styles
      if (base.style) {
        hotspotEl.setAttribute('style', base.style + '; cursor: pointer; pointer-events: all;');
      } else if (base.cstyle) {
        hotspotEl.setAttribute('style', base.cstyle + '; cursor: pointer; pointer-events: all;');
      }
      
      // Apply any custom data-* attributes
      if (base) {
        Object.keys(base).forEach(key => {
          if (key.startsWith('data-')) {
            hotspotEl.setAttribute(key, base[key]);
          }
        });
      }
      // Apply effect if needed
      // if style effct is pulse, add a second (ghost) element for the halo
      const effect = styles.effect ?? globalConfig.effect ?? 'none';
      if (effect === 'pulse' && ( ! wasFound || ! styles.stopPulseWhenFound ) ) {
        let haloEl;
        if (type === 'circle') {
          haloEl = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          haloEl.setAttribute('cx', base.cx || 0);
          haloEl.setAttribute('cy', base.cy || 0);
          haloEl.setAttribute('r', (base.r || 22) + 8);
        } else if (type === 'rect') {
          haloEl = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
          haloEl.setAttribute('x', (base.x || 0) - 4);
          haloEl.setAttribute('y', (base.y || 0) - 4);
          haloEl.setAttribute('width', (base.width || 44) + 8);
          haloEl.setAttribute('height', (base.height || 44) + 8);
          if (base.rx) haloEl.setAttribute('rx', base.rx + 4);
        }
        if (haloEl) {
          g.classList.add('pulse-group');
          haloEl.classList.add('hotspot--pulse-ghost');
          if ( wasFound ) {
            haloEl.classList.add('hotspot--found');
          }
          // if stopPulseWhenFound is enabled, add class to pulse group
          if (styles.stopPulseWhenFound) {
            hotspotEl.classList.add('pulse--stoppable');
          }
          if (base.style) {
            haloEl.setAttribute('style', base.style + '; cursor: pointer; pointer-events: none;');
          } else if (base.cstyle) {
            haloEl.setAttribute('style', base.cstyle + '; cursor: pointer; pointer-events: none;');
          }
          g.appendChild(haloEl);
        }
      }
      // Append hotspot element into group
      g.appendChild(hotspotEl);
      // And append group into viewport
      viewport.appendChild(g);
    });
    
    this._log('Rendered', hotspots.length, 'hotspot SVG elements for anchor', anchorIndex, 
      'with', Array.from(this._state.foundGlobal).filter(k => k.startsWith(`${anchorIndex}-`)).length, 'found');
  },
  
  _showHotspotDetails: function (hotspotId, meta, anchorIndex) {
    const dialog = document.getElementById('detailsDialog');
    if (!dialog) return;
    
    const title = dialog.querySelector('#dlgTitle');
    const body = dialog.querySelector('#dlgBody');
    const media = dialog.querySelector('#dlgMedia');
    const img = media?.querySelector('img');
    
    // Set title and body immediately
    if (title) title.textContent = meta?.title || 'Details';
    if (body) body.innerHTML = meta?.body || '';
    
    // Handle image loading
    if (img && meta?.image) {
      // CRITICAL: Hide media FIRST and clear src to prevent flash of old image
      if (media) media.hidden = true;
      img.src = '';
      img.alt = meta.title || '';
      
      // Preload the new image before displaying it
      const preloader = new Image();
      preloader.onload = () => {
        // Image is loaded, now set it and show
        img.src = meta.image;
        if (media) media.hidden = false;
        this._log('Hotspot image loaded:', meta.image);
      };
      preloader.onerror = () => {
        // Image failed to load, keep media hidden
        if (media) media.hidden = true;
        this._log('Failed to load hotspot image:', meta.image);
      };
      // Start preloading
      preloader.src = meta.image;
    } else if (media) {
      // No image, hide media container
      media.hidden = true;
    }
    
    // Mark as found
    this._state.foundGlobal.add(`${anchorIndex}-${hotspotId}`);
    const hotspotEl = document.querySelector(`.hotspot[data-hotspot-id="${hotspotId}"]`);
    if (hotspotEl) {
      hotspotEl.classList.add('hotspot--found');
      const pulseGhost = hotspotEl.closest('.pulse-group')?.querySelector('.hotspot--pulse-ghost');
      if (pulseGhost) {
        if (hotspotEl.classList.contains('pulse--stoppable' ) ) {
        // hide the ghost element
          const pulseGhost = hotspotEl.closest('.pulse-group')?.querySelector('.hotspot--pulse-ghost');
          if (pulseGhost) {
            pulseGhost.remove();
          }
        }
        else{
          pulseGhost.classList.add('hotspot--found');
        }
      }
      const group = hotspotEl.closest('.hotspot-group');
      if (group) group.classList.add('hotspot-group--found');
    }
    // Update counter
    this._updateCounter();
    
    // Update counter in modal if enabled
    if (this._cfg?.progress?.showCounterInModal) {
      const modalCounter = dialog.querySelector('#dlgCounter');
      const stageCounter = document.getElementById('counter');
      if (modalCounter && stageCounter) {
        modalCounter.textContent = stageCounter.textContent;
      }
    }
    
    // Update pips to mark this as found
    const pipContainer = document.getElementById('hotspotPips');
    if (pipContainer) {
      const foundIndex = this._data[anchorIndex]?.hotspots?.findIndex(h => h.id === hotspotId);
      if (foundIndex >= 0) {
        const pip = pipContainer.querySelector(`[data-hotspot-index="${foundIndex}"]`);
        if (pip) pip.classList.add('found');
      }
    }
    
    if (typeof dialog.showModal === 'function') {
      dialog.showModal();
      
      // Focus the close button for keyboard accessibility
      const closeBtn = dialog.querySelector('.iv-close');
      if (closeBtn) {
        setTimeout(() => closeBtn.focus(), 100);
      }
    }
    
    this._log('Showing hotspot details:', hotspotId);
  },
  
  _updateCounter: function () {
    const counter = document.getElementById('counter');
    if (!counter) return;
    
    // Get progress settings
    const showPerImage = this._cfg?.progress?.showPerImage ?? true;
    const showTotal = this._cfg?.progress?.showTotal ?? true;
    
    // Calculate per-image stats
    const currentAnchor = this._data[this._state.currentAnchorIndex];
    const totalHotspots = currentAnchor?.hotspots?.length || 0;
    const foundCount = Array.from(this._state.foundGlobal).filter(key => key.startsWith(`${this._state.currentAnchorIndex}-`)).length;
    
    // Calculate total stats across all images
    let totalHotspotsAllImages = 0;
    let totalFoundAllImages = 0;
    
    if (showTotal) {
      this._data.forEach((anchor, idx) => {
        const hotspotsInImage = anchor?.hotspots?.length || 0;
        totalHotspotsAllImages += hotspotsInImage;
        
        // Count found hotspots for this image
        const foundInImage = Array.from(this._state.foundGlobal).filter(key => key.startsWith(`${idx}-`)).length;
        totalFoundAllImages += foundInImage;
      });
    }
    
    // Build counter text based on settings
    const parts = [];
    
    if (showPerImage && this._data.length > 1) {
      // Only show "Image X:" prefix if there are multiple images
      parts.push(`Image ${this._state.currentAnchorIndex + 1}: ${foundCount}/${totalHotspots}`);
    } else if (showPerImage) {
      // Single image, just show count without prefix
      parts.push(`Found ${foundCount}/${totalHotspots}`);
    }
    
    if (showTotal && this._data.length > 1) {
      // Only show total if there are multiple images
      parts.push(`Total: ${totalFoundAllImages}/${totalHotspotsAllImages}`);
    }
    
    // Join parts with bullet separator
    counter.textContent = parts.join(' • ') || `Found ${foundCount}/${totalHotspots}`;
    
    this._log('Counter updated:', counter.textContent);
  },
  // -------- Hotspot Navigation --------
  _renderHotspotPips: function () {
    if (!this._cfg?.ui?.showHotspotPips) return;
    
    const container = document.getElementById('hotspotPips');
    if (!container) return;
    
    const anchor = this._data[this._state.currentAnchorIndex];
    const hotspots = anchor?.hotspots || [];
    
    // Clear existing pips
    container.innerHTML = '';
    
    if (!hotspots.length) {
      container.style.display = 'none';
      return;
    }
    
    container.style.display = 'flex';
    
    // Create a pip for each hotspot
    hotspots.forEach((hotspot, index) => {
      const pip = document.createElement('button');
      pip.className = 'hotspot-pip';
      pip.setAttribute('data-hotspot-index', index);
      pip.setAttribute('aria-label', `Go to ${hotspot.meta?.title || 'hotspot ' + (index + 1)}`);
      pip.setAttribute('title', hotspot.meta?.title || `Hotspot ${index + 1}`);
      
      // Mark as active if this is the current hotspot
      if (index === this._state.currentHotspotIndex) {
        pip.classList.add('active');
        pip.setAttribute('aria-pressed', 'true');
      } else {
        pip.setAttribute('aria-pressed', 'false');
      }
      
      // Mark as found if discovered - CHECK GLOBAL STATE
      const key = `${this._state.currentAnchorIndex}-${hotspot.id}`;
      if (this._state.foundGlobal.has(key)) {
        pip.classList.add('found');
      }
      
      // Click handler to zoom to hotspot
      pip.addEventListener('click', () => {
        this._zoomToHotspot(index);
      });
      
      container.appendChild(pip);
    });
    
    this._log('Rendered', hotspots.length, 'hotspot pips');
  },
  _zoomToHotspot: function (index) {
    const anchor = this._data[this._state.currentAnchorIndex];
    const hotspots = anchor?.hotspots || [];
    const hotspot = hotspots[index];
    if (!hotspot || !hotspot.base || !this._pz) return;

    // 1. Get Base Dimensions
    const stage = this._els.stage;
    const baseImage = this._els.baseImage;
    if (!stage || !baseImage) return;

    const rect = stage.getBoundingClientRect();
    const viewW = rect.width;
    const viewH = rect.height;
    
    // 2. Determine Hotspot Center (Unscaled Image Coordinates)
    let hx = 0, hy = 0; // Hotspot center X/Y
    const base = hotspot.base;
    if (hotspot.type === 'circle') {
      hx = Number(base.cx) || 0;
      hy = Number(base.cy) || 0;
    } else if (hotspot.type === 'rect') {
      hx = (Number(base.x) || 0) + (Number(base.width)  || 44) / 2;
      hy = (Number(base.y) || 0) + (Number(base.height) || 44) / 2;
    }

    // 3. Calculate Target Scale (Deterministic)
    // Use configured zoom level, clamped strictly by global min/max
    const configZoom = this._cfg?.hotspotNavigation?.zoomLevel || this._cfg?.behavior?.anchorZoomPercent / 100 || 2;
    const minZoom = this._cfg?.zoom?.min || 0.1;
    const maxZoom = this._cfg?.zoom?.max || 20;
    const finalScale = Math.max(minZoom, Math.min(maxZoom, configZoom));

    // 4. Calculate Ideal Target Position to Center the Hotspot
    // Formula: (ViewportCenter) - (HotspotPosition * Scale)
    let targetX = (viewW / 2) - (hx * finalScale);
    let targetY = (viewH / 2) - (hy * finalScale);

    // 5. Pre-Clamp Target Position (Respect Hard Bounds & Sizing)
    if (this._cfg?.behavior?.hardBounds) {
      const imgW = (Number(baseImage.getAttribute('width')) || 3000) * finalScale;
      const imgH = (Number(baseImage.getAttribute('height')) || 2000) * finalScale;

      // X Axis Logic
      if (imgW <= viewW) {
        // Image is smaller than viewport: Center it
        targetX = (viewW - imgW) / 2;
      } else {
        // Image is larger: Clamp edges to viewport edges
        const minX = viewW - imgW; // Right edge aligns with viewport right
        const maxX = 0;            // Left edge aligns with viewport left
        targetX = Math.max(minX, Math.min(maxX, targetX));
      }

      // Y Axis Logic
      if (imgH <= viewH) {
        targetY = (viewH - imgH) / 2;
      } else {
        const minY = viewH - imgH;
        const maxY = 0;
        targetY = Math.max(minY, Math.min(maxY, targetY));
      }
    }

    // 6. Idempotency Check (Fixes "Single Hotspot" jitter)
    // If we are already virtually at the target, do not animate.
    const current = this._pz.getTransform();
    const dist = Math.sqrt(Math.pow(current.x - targetX, 2) + Math.pow(current.y - targetY, 2));
    const scaleDiff = Math.abs(current.scale - finalScale);

    // Tolerance: 1px distance, 0.01 scale difference
    if (dist < 1 && scaleDiff < 0.01) {
      this._state.currentHotspotIndex = index;
      this._updateHotspotPips();
      return; 
    }

    // 7. Execute Smooth Animation
    // We disable the general clamp check during animation to prevent interference,
    // but since we Pre-Clamped (Step 5), the animation will land legally anyway.
    this._state.isNavigating = true;

    this._log('Navigating to hotspot', index, { 
      targetX, targetY, finalScale, 
      reason: 'link/pip click' 
    });

    // Use smoothZoomAbs on the Viewport Center to reach scale...
    this._pz.smoothZoomAbs(viewW / 2, viewH / 2, finalScale);
    
    // ...and immediately overwrite the Pan destination to our calculated center/clamp.
    // This ensures both Zoom and Pan resolve to the exact calculated coordinates.
    setTimeout(() => {
        this._pz.smoothMoveTo(targetX, targetY);
    }, 0);

    // Cleanup flag after animation duration (approx 400ms)
    setTimeout(() => {
      this._state.isNavigating = false;
    }, 450);
    
    // Update State
    this._state.currentHotspotIndex = index;
    this._updateHotspotPips();
  },
  
  _updateHotspotPips: function () {
    const container = document.getElementById('hotspotPips');
    if (!container) return;
    
    const pips = container.querySelectorAll('.hotspot-pip');
    pips.forEach((pip, index) => {
      if (index === this._state.currentHotspotIndex) {
        pip.classList.add('active');
        pip.setAttribute('aria-pressed', 'true');
      } else {
        pip.classList.remove('active');
        pip.setAttribute('aria-pressed', 'false');
      }
    });
  },
  
  _goToNextHotspot: function () {
    const anchor = this._data[this._state.currentAnchorIndex];
    const hotspots = anchor?.hotspots || [];
    
    if (!hotspots.length) return;
    
    const nextIndex = (this._state.currentHotspotIndex + 1) % hotspots.length;
    this._zoomToHotspot(nextIndex);
  },
  
  _goToPrevHotspot: function () {
    const anchor = this._data[this._state.currentAnchorIndex];
    const hotspots = anchor?.hotspots || [];
    
    if (!hotspots.length) return;
    
    let prevIndex = this._state.currentHotspotIndex - 1;
    if (prevIndex < 0) prevIndex = hotspots.length - 1;
    
    this._zoomToHotspot(prevIndex);
  },


  // -------- UI controls --------
  _showExplainer: function () {
    const dialog = this._els.explainerDialog;
    if (dialog && typeof dialog.showModal === 'function') {
      dialog.showModal();
      this._log('Showed explainer dialog');
    }
  },
  _showCompletion: function () {
    const dialog = this._els.completionDialog;
    if (dialog && typeof dialog.showModal === 'function') {
      dialog.showModal();
      this._state.hasSeenCompletionDialog = true;
      this._log('Showed completion dialog');
    }
  },
  _togglePreset: function () {
    const toolbar = this._els.toolbar;
    const presetToggle = this._els.presetToggle;
    const stage = this._els.stage;
    
    if (!toolbar) return;
    
    // Toggle minimal chrome class on stage or body
    const target = stage || document.body;
    const isMinimal = target.classList.toggle('minimal-chrome');
    
    // Update aria-pressed state
    if (presetToggle) {
      presetToggle.setAttribute('aria-pressed', isMinimal ? 'true' : 'false');
    }
    
    // Toggle visibility of toolbar controls (except anchors)
    const controls = toolbar.querySelectorAll('.right, #status, #zoomIn, #zoomOut, #reset, #help');
    controls.forEach(el => {
      if (isMinimal) {
        el.style.display = 'none';
      } else {
        el.style.display = '';
      }
    });
    
    this._log('Toggled preset mode:', isMinimal ? 'minimal' : 'full');
  },
  _maybeShowExplainerOnLoad: function () {
    this._log('Checking whether to show explainer on load: ' + this._cfg?.ui?.showExplainerOnLoad);
    if (this._cfg?.ui?.showExplainerOnLoad) {
      // Delay slightly to allow page to settle
      setTimeout(() => this._showExplainer(), 300);
    }
  },
  _maybeShowModalOnCompleted: function () {
    this._log('Checking whether to show completion modal: ' + this._cfg?.ui?.showModalOnCompletion);
    if (this._cfg?.ui?.showModalOnCompletion && ! this._state.hasSeenCompletionDialog ) {
      const allHotspotsCount = this._data.reduce((sum, anchor) => sum + (anchor.hotspots?.length || 0), 0);
      const foundCount = this._state.foundGlobal.size;
      this._log('Total hotspots:', allHotspotsCount, 'Found hotspots:', foundCount);
      if (allHotspotsCount > 0 && foundCount >= allHotspotsCount) {
        // All hotspots found - show explainer/modal
        setTimeout(() => this._showCompletion(), 500);
      }
    }
  },
  // ===== Added: Hard-bounds & Hotspot active-state helpers =====
  __clampLock: false,
  _getStageRect: function () {
    const el = this._els && this._els.stage;
    return el ? el.getBoundingClientRect() : null;
  },

  _getContentRect: function () {
    const el = this._els && this._els.viewport; // panzoom target
    return el ? el.getBoundingClientRect() : null;
  },

  _clampTransformByRects: function () {
    if (!this._cfg?.behavior?.hardBounds || !this._pz || this.__clampLock) return;
    const stage = this._getStageRect();
    const cont  = this._getContentRect();
    if (!stage || !cont) return;

    // NEW BEHAVIOR: Ensure content fully covers stage (no empty space visible)
    // Content edges must not be inside stage edges
    let dx = 0, dy = 0;

    // SAFETY: Check if content is large enough to cover stage at current scale
    // If not, don't try to clamp position - scale needs to be fixed first
    const contentW = cont.width;
    const contentH = cont.height;
    const stageW = stage.width;
    const stageH = stage.height;
    
    if (contentW < stageW || contentH < stageH) {
      // Content is too small to cover stage - this means zoom is below minimum
      // Don't try to clamp position, the scale enforcement in _onTransform will fix this
      this._log('Content too small to cover stage, skipping position clamp', {
        contentW, contentH, stageW, stageH
      });
      return;
    }
    
    // If content's right edge is inside stage's right edge, push left
    if (cont.right < stage.right) dx += stage.right - cont.right;
    // If content's left edge is inside stage's left edge, push right
    if (cont.left > stage.left) dx += stage.left - cont.left;
    // If content's bottom edge is inside stage's bottom edge, push up
    if (cont.bottom < stage.bottom) dy += stage.bottom - cont.bottom;
    // If content's top edge is inside stage's top edge, push down
    if (cont.top > stage.top) dy += stage.top - cont.top;

    if (dx !== 0 || dy !== 0) {
      const t = this._pz.getTransform();
      this.__clampLock = true;
      this._pz.moveTo(t.x + dx, t.y + dy);
      this.__clampLock = false;
      this._log('Clamped transform to cover stage', { dx, dy });
    }
  },
  _onTransform: function () {
    if (!this._pz) return;
    
    // 1. Clamp logic (existing)
    if (!this._state.isNavigating && !this._state.isPinching && !this.__clampLock) {
      this._clampTransformByRects();
    }
    
    // 2. Mirror to DOM (existing)
    const t = this._pz.getTransform();
    this._setXform(t);
    
    // 3. CHANGE: Persist per-image transform ONLY if not switching
    // This prevents the "poisoning" of the next image's state
    if (!this._state.isSwitchingImage) {
      const idx = this._state?.currentAnchorIndex ?? 0;
      if (this._state?.perAnchorTransform?.set) {
        this._state.perAnchorTransform.set(idx, { x: t.x, y: t.y, scale: t.scale });
      }
    }
  },

  _deactivateAllHotspots: function () {
    const root = this._els && this._els.viewport;
    if (!root) return;
    root.querySelectorAll('[data-hotspot-id]').forEach(el => {
      el.classList.remove('is-active','active','hotspot--active');
      el.removeAttribute('aria-pressed');
      el.removeAttribute('data-active');
    });
    this._state.lastActiveHotspot = null;
  },

  _activateHotspot: function (hotspotEl) {
    this._deactivateAllHotspots();
    if (!hotspotEl) return;
    hotspotEl.classList.add('is-active','hotspot--active');
    hotspotEl.setAttribute('aria-pressed','true');
    hotspotEl.setAttribute('data-active','1');
    this._state.lastActiveHotspot = hotspotEl;
  },

  _onModalClosed: function () {
    this._deactivateAllHotspots();
    if (this._state && this._state.lastTriggerEl) {
      try { this._state.lastTriggerEl.focus(); } catch(_) {}
    }
    
    // Clear modal content to prevent flash on next open
    const dialog = document.getElementById('detailsDialog');
    if (dialog) {
      const img = dialog.querySelector('#dlgMedia img');
      if (img) {
        img.src = ''; // Clear image source
        img.alt = '';
      }
      const media = dialog.querySelector('#dlgMedia');
      if (media) media.hidden = true; // Hide container
    }
  },
};

// Boot on DOM ready (vanilla)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => APP.ImageViewer._init());
} else {
  APP.ImageViewer._init();
}
/**
 * [InpageNav handles the inpage nav]
 * @type {Object}
 */
APP.InpageNav = {
	// define vars
	dummy : $('.inpagenav--dummy'),
	container : $('.inpagenav'),
	mainNav : $('.mainnav'),
	navBottom : $('.inpagenav-bottom'),
	items : $('.inpagenav-bottom-items-item'), // the nav items
	itemsWrapper : $('.inpagenav-bottom-items-wrapper'),
	rightArrow : $('.inpagenav--right-arrow'),
	leftArrow : $('.inpagenav--left-arrow'),
	backToTop : $('.inpagenav-bottom-backtotop-link'),
	sections : undefined, // holds a pointer to the sections the nav can animate to
	isOpen : false, // is the inpage nav open
	isSliding : false, // is transitioning between open/close states
	isAnimating : false, // is _animatePageScrollTop running or not
	offsets : {}, // holds the offsets of the links
	inpageTabs : $('.inpagetab-items'),
	isTargeted: false,        // opt-in via class on the nav
	homeAnchor: undefined,    // placeholder to return nav home
	isDockedAtTarget: false,  // whether nav is currently after the target
	alignRef: undefined, 	// reference element for alignment calculations
	triggerEl: undefined,     // element that triggers the inpage nav (defaults to container if null)
	_mainNavH: 0,             // cached header height if you use it
	fixedMode: 'full',          // 'full' | 'align' | 'custom'
	fixedWidth: null,           // number (px) when mode = custom
	fixedLeft: null,            // number (px) when mode = custom
	innerMax: null,             // number (px) for centering contents
	_eps: 1,                  // tolerance to avoid flicker at the boundary
	/**
	 * [_init entry point]
	 */
	_init : function() {
		// check for inpage nav
		if ( APP.InpageNav.container.length > 0 && APP.InpageNav.dummy.length > 0 ) {
			APP.InpageNav.isTargeted = APP.InpageNav.container.hasClass('inpagenav--targeted');

			// read the selector for the target block (e.g., data-target="#tickets--info")
			const sel = APP.InpageNav.isTargeted ? APP.InpageNav.container.data('target') : undefined;
			if (sel) {
				const $t = $(sel);
				if ($t.length) APP.InpageNav.triggerEl = $t;
			}

			// optional alignment reference (fallbacks to triggerEl, then container)
			// fixed mode options
			APP.InpageNav.fixedMode = (APP.InpageNav.container.data('fixed-mode') || 'full').toString();
			// alignment ref (only for align mode)
			const alignSel = APP.InpageNav.container.data('align') || '.layout-inner, .site-width, .entry-content';
			APP.InpageNav.alignRef = $(alignSel).filter(':visible').first();
			if (!APP.InpageNav.alignRef?.length) APP.InpageNav.alignRef = APP.InpageNav.triggerEl?.length ? APP.InpageNav.triggerEl : APP.InpageNav.container;

			// custom mode values
			const fw = APP.InpageNav.container.data('fixed-width');
			const fl = APP.InpageNav.container.data('fixed-left');
			APP.InpageNav.fixedWidth = isFinite(+fw) ? +fw : null;
			APP.InpageNav.fixedLeft  = isFinite(+fl) ? +fl : null;

			// optional inner centering
			const im = APP.InpageNav.container.data('inner-max');
			APP.InpageNav.innerMax = isFinite(+im) ? +im : null;
			if (APP.InpageNav.innerMax) {
				APP.InpageNav.container[0].style.setProperty('--inpagenav-inner-max', APP.InpageNav.innerMax + 'px');
			}

			// Create a home anchor to restore on close (only once)
			if (!APP.InpageNav.homeAnchor) {
				APP.InpageNav.homeAnchor = $('<span class="inpagenav--home-anchor" aria-hidden="true"></span>');
				APP.InpageNav.homeAnchor.insertBefore(APP.InpageNav.container);
			}

			// Create a portal root at <body> (only once)
			if (!APP.InpageNav.portalRoot) {
				APP.InpageNav.portalRoot = $('<div id="inpagenav-portal" aria-hidden="true"></div>').appendTo(document.body);
			}

			// cache header height
			APP.InpageNav._mainNavH = (APP.InpageNav.mainNav?.outerHeight()) || 0;

			// build sections
			$(window).on('load', function() {
				APP.InpageNav.sections = APP.InpageNav.items.map(function(index, el){
					if ($(el.hash).length > 0) return $(el.hash);
			});
			APP.InpageNav.offsets = APP.InpageNav.items.map(function(index, el){
					return $(el).offset().left;
				});
			});

			// started on the load event on the window because that's when _is() is able to perform as expected
			$(window).on('load scroll', APP.InpageNav._scrollLoadHandler);

			// clicks
			APP.InpageNav.items.on('click', APP.InpageNav._itemClickHandler);
			APP.InpageNav.backToTop.on('click', APP.InpageNav._backToTopClickHandler);
			APP.InpageNav.leftArrow.on('click', APP.InpageNav.scrollLeft);
			APP.InpageNav.rightArrow.on('click', APP.InpageNav.scrollRight);

			// handle arrow visibility
			APP.InpageNav.itemsWrapper.on('scroll load', APP.InpageNav._handleArrowVisibility);
		}
		else if ( APP.InpageNav.inpageTabs.length > 0 ) {
			APP.InpageNav.itemsWrapper = APP.InpageNav.inpageTabs.find('.inpagetab-bottom-items-wrapper');
			APP.InpageNav.navBottom = APP.InpageNav.inpageTabs;
			APP.InpageNav.items = APP.InpageNav.itemsWrapper.find('.inpagetab-items-item');
			$(window).on('load scroll', APP.InpageNav._scrollLoadHandler);
			APP.InpageNav.leftArrow.on('click', APP.InpageNav.scrollLeft);
			APP.InpageNav.rightArrow.on('click', APP.InpageNav.scrollRight);
			APP.InpageNav.itemsWrapper.on('scroll load', APP.InpageNav._handleArrowVisibility);
			$(document).ready(APP.InpageNav._initTabVisibility);
		}

		// keep height + alignment fresh
		$(window).on('resize orientationchange', APP.InpageNav._measure )
		$(window).on('resize orientationchange', function(){
			if (APP.InpageNav.isDockedAtViewport) APP.InpageNav._alignToViewport();
		});
	},
	/**
	 * [_animatePageScrollTop utility wrapper for smoothscrolling]
	 * @param  {float} val the value to scroll to (in pixels)
	 */
	_animatePageScrollTop : function(val){
		// set isAnimating
		APP.InpageNav.isAnimating = true
		// animate scrolling
		$('html, body').animate({
			scrollTop : val,
		}, 400, '', function() {
			// update isAnimating
			APP.InpageNav.isAnimating = false
			// so scrollLoadHandler fires - trigger a scroll event on the window
			$(window).trigger( 'scroll' )
		})
	},
	_handleArrowVisibility : () => {
		const item = APP.InpageNav.itemsWrapper.get(0)
		if ( ! item ) {
			return
		}
		const maxScrollLeft = item.scrollWidth - item.clientWidth - 5 // 5 is a fudge factor
		// Show the left arrow if scrolled to the right
		if (APP.InpageNav.itemsWrapper.get(0).scrollLeft > 0 ) {
			APP.InpageNav.leftArrow.get(0).style.display = 'block'
			APP.InpageNav.navBottom.get(0).classList.add('mask--left')
		} 
		else {
			APP.InpageNav.leftArrow.get(0).style.display = 'none'
			APP.InpageNav.navBottom.get(0).classList.remove('mask--left')

		}
		// Show the right arrow if there's more content to the right
		if ( APP.InpageNav.itemsWrapper.get(0).scrollLeft < maxScrollLeft ) {
			APP.InpageNav.rightArrow.get(0).style.display = 'block'
			APP.InpageNav.navBottom.get(0).classList.add('mask--right')
		} 
		else {
			APP.InpageNav.rightArrow.get(0).style.display = 'none'
			APP.InpageNav.navBottom.get(0).classList.remove('mask--right')
		}
	},
	/**
	 * [_itemClickHandler handles what happens when clicking on an inpagenav item]
	 * @param  {obj} e event object
	 */
	_itemClickHandler : function(e){
		let target = e.target
		// if target is not an anchor, check if direct parent is an anchor and if so make that the target
		if ( target.tagName !== 'A' && target.parentElement.tagName === 'A' ) {
			target = target.parentElement
		}
		const href = target.getAttribute('href')
		if ( typeof href !== 'undefined' && APP.InpageNav._isValidURL( href ) ) {
			return true
		}
		// prevent normal clicking on anchor tag
		e.preventDefault()
		// catch the error && bail if there's no module with that hash as an id
		if( $( target.hash ).offset() == undefined ){
			console.error("There's no module with " + target.hash + " as an id...\nMake sure you build your modules with the same IDs you have in your inpage nav or the inpage nav will not work correctly!")
			return false
		}
		// scroll to the section
		const $dest = $( target.hash )
		APP.InpageNav._animatePageScrollTop(
			$dest.offset().top - APP.InpageNav.container.outerHeight() + 5
		)
		// when the scroll ends, move keyboard focus to the section
		setTimeout(() => {
			$dest.attr('tabindex', '-1')
			$dest[0].focus({ preventScroll: true })
			$dest.on('blur', () => $dest.removeAttr('tabindex'))
		}, 420 )


		// find the index of the target in the array of items
		APP.InpageNav._updateActiveItem(  APP.InpageNav.items.index( target ) )
		// update the hash
		window.history.replaceState( null,null, target.attributes.href.nodeValue )
		// if the section is an accordionrow
		if( $( target.hash ).hasClass('accordionmodule-row') ) {
			// get row in AccordionHandler
			// 
			// loop through accordion rows
			APP.AccordionHandler.accordionRows.forEach(function(ar, index){
				// if the click target's hash is the same as the accordion rows hash (with a hash in front of it) and the accordion row is not open
				if( '#' + ar.hash == target.hash && ar.isOpen == false ) {
					// run the click handler for the accordion row
					// also fake event object's target atribute :D
					ar._headerClickHandler({
						target : ar.header
					})
				}
			})
		}
	},
	 _measure : function () {
		APP.InpageNav._mainNavH = (APP.InpageNav.mainNav?.outerHeight()) || 0;
		if (APP.InpageNav.isDockedAtViewport) APP.InpageNav._alignToViewport();
	},
	_alignToViewport : function () {
		// full = default: left:0; width:100%
		if (APP.InpageNav.fixedMode === 'full') {
			APP.InpageNav.container.css({ left: '0px', width: '100%' });
			return;
		}

		// align = match a ref element’s rect
		if (APP.InpageNav.fixedMode === 'align') {
			const $ref = (APP.InpageNav.alignRef?.length ? APP.InpageNav.alignRef : APP.InpageNav.triggerEl);
			if (!$ref?.length) return;
			const r = $ref[0].getBoundingClientRect();
			APP.InpageNav.container.css({
			width: Math.round(r.width) + 'px',
			left: Math.round(r.left) + 'px',
			right: 'auto'
			});
			return;
		}
		// custom = explicit width/left (px)
		if (APP.InpageNav.fixedMode === 'custom') {
			const w = (APP.InpageNav.fixedWidth != null) ? APP.InpageNav.fixedWidth : APP.InpageNav.container.outerWidth();
			const l = (APP.InpageNav.fixedLeft  != null) ? APP.InpageNav.fixedLeft  : 0;
			APP.InpageNav.container.css({ width: w + 'px', left: l + 'px', right: 'auto' });
  		}
	},
	_dockToViewport : function () {
		if (APP.InpageNav.isDockedAtViewport) return;
		APP.InpageNav.container.detach().appendTo(APP.InpageNav.portalRoot);
		APP.InpageNav.container.addClass('inpagenav--fixed'); // position:fixed via CSS
		APP.InpageNav.isDockedAtViewport = true;
		APP.InpageNav._alignToViewport();
	},

	_undockToHome : function () {
		if (!APP.InpageNav.isDockedAtViewport) return;
		APP.InpageNav.container.removeClass('inpagenav--fixed').attr('style',''); // clear inline left/width
		APP.InpageNav.container.detach();
		APP.InpageNav.homeAnchor.after(APP.InpageNav.container);
		APP.InpageNav.isDockedAtViewport = false;
	},

	/**
	 * [_backToTopClickHandler scrolls the page back to the top]
	 * @param  {obj} e event object
	 */
	_backToTopClickHandler : (e) => {
		e.preventDefault()
		// scroll to the top
		APP.InpageNav._animatePageScrollTop(0)
	},
	/**
	 * [_hasMadeContact if bottom of main nav has connected with the dummy (placed directly at the bottom of the inpagenav)]
	 * @return {Boolean}
	 */
	_getContact : () => {
		const scrollTop = $(window).scrollTop();
		const mainNavH  = APP.InpageNav._mainNavH || 0;

		if (APP.InpageNav.isTargeted && APP.InpageNav.triggerEl?.length) {
			const $t = APP.InpageNav.triggerEl;
			// show slightly before the exact end if desired (tweak the -10)
			const targetBottom = $t.offset().top + $t.outerHeight() - 10;
			return (scrollTop + mainNavH) >= (targetBottom - APP.InpageNav._eps);
		}

		// Legacy (non-targeted) behavior: use dummy thresholds
		if (APP.data?.SetupTheme?.enable_ticker) {
			return scrollTop >= APP.InpageNav.dummy.offset().top;
		}
		return (scrollTop + mainNavH) >= (
			APP.InpageNav.dummy.offset().top + APP.InpageNav.dummy.outerHeight()
		);
	},
	/**
	 * [_scrollLoadHandler controls how inpagenav is displayed based on where the scroll is on the page]
	 * @param  {obj} e event object
	 */
	_scrollLoadHandler : (e) => {
		// if we're at a screen thats greater than or equal to the medium breakpoint and we're not already sliding
		if ( APP.InpageNav.isSliding == false ) {
			// if we need to open
			if ( typeof APP.InpageNav.sections !== 'undefined' && APP.InpageNav._getContact() == true && APP.InpageNav.isOpen == false ){
				APP.InpageNav._open()
			}
			// if we need to close
			else if ( typeof APP.InpageNav.sections !== 'undefined' && APP.InpageNav._getContact() == false && APP.InpageNav.isOpen == true ){
				APP.InpageNav._close()
			}
		}
		// handle arrow visibility
		APP.InpageNav._handleArrowVisibility()
		// handle navitem active class placement
		if ( typeof APP.InpageNav.sections !== 'undefined' ) {
			// inASection is used to determine if we're actually in a section with an id
			let inASection = false
			// loop over the sections
			$.each( APP.InpageNav.sections, function(index, el ) {
				// check if el is the right kinda object
				if ( el.offset() !== undefined ) {
					// are we (the top of the window + the height of the inpage nav) in a section and is the nav not animating?
					if (
						$(window).scrollTop() + APP.InpageNav.container.outerHeight() >= el.offset().top &&
						$(window).scrollTop() + APP.InpageNav.container.outerHeight() < el.offset().top + el.outerHeight() &&
						APP.InpageNav.isAnimating == false
					){
						// we're in a section!
						inASection = true
						// update active class
						APP.InpageNav._updateActiveItem( index )
					}
				}
			})
			// if we're not in a section then remove all active classes on the items
			if ( ! inASection ) {
				APP.InpageNav.items.removeClass('inpagenav-bottom-items-item--active')
			}
		}
	},
	/**
	 * [_updateActiveItem updates active item's class so it turns red]
	 * @param  {int} index the position of the navitem in the array of nav items
	 */
	_updateActiveItem : function( index ) {
		index++
		const activeItem = $( '.inpagenav--link-wrapper:nth-child(' + index + ')' ),
			  notActive = $( '.inpagenav--link-wrapper:not(:nth-child(' + index + '))' )

		if ( activeItem.hasClass( 'inpagenav-bottom-items-item--active' ) ) {
			return
		}
		// update active classes
		activeItem.find('.inpagenav-bottom-items-item' ).addClass('inpagenav-bottom-items-item--active')
		notActive.find('.inpagenav-bottom-items-item').removeClass('inpagenav-bottom-items-item--active')
		// scroll to the active item
		//if ( APP.Breakpoint._is( '<', 'medium') ) {
			// animate to new scroll position
			const targetPosition = APP.InpageNav.offsets[ (index-1) ] - 20
			// animate to new scroll position
			// until working keep locally
			// APP.Animate.smoothScrollTo( APP.InpageNav.itemsWrapper, targetPosition, 150 )

			APP.InpageNav.smoothScrollTo( APP.InpageNav.itemsWrapper, targetPosition, 150 )
			//}
	},
	smoothScrollTo : ( element, target, duration ) => {
        // if element is a jquery object, get the DOM element
        if ( element instanceof jQuery ) {
            element = element.get(0)
        }
        let start = element.scrollLeft,
            change = target - start,
            currentTime = 0,
            increment = 20 // Adjust for smoothness

        const animateScroll = () => {
            currentTime += increment
            element.scrollLeft = APP.InpageNav.easeInOutQuad( currentTime, start, change, duration )
            if ( currentTime < duration ) {
                window.requestAnimationFrame( animateScroll )
            }
        }
        animateScroll()
    },
	easeInOutQuad :  ( time, start, change, duration ) => {
		time /= duration / 2
		if (time < 1) return change / 2 * time * time + start
		time--
		return -change / 2 * (time * (time - 2) - 1) + start
	},
	/**
	 * [_open opens the inpage nav & slides up the main nav]
	 */
	/**
	 * [_open opens the inpage nav & slides up the main nav]
	 */
	_open : function(){
		if (APP.InpageNav.isOpen) return;

		APP.InpageNav.isSliding = true;

		// Targeted → portal to body (fixed) to avoid clipping
		if (APP.InpageNav.isTargeted && !APP.InpageNav.isDockedAtViewport) {
			APP.InpageNav._dockToViewport();
		}

		// header slide
		APP.InpageNav.mainNav.addClass('mainnav--slideup');
		$('html').css('scrollPaddingTop', 0);

		// show nav (so height is measurable)
		APP.InpageNav.container.addClass('inpagenav--active');

		requestAnimationFrame(() => {
			const navH = (APP.data?.SetupTheme?.enable_ticker)
			? (APP.InpageNav.mainNav.outerHeight() || 0)
			: (APP.InpageNav.container.outerHeight() || 0);

			APP.InpageNav.dummy.height(navH);

			const onDone = () => {
			APP.InpageNav.isSliding = false;
			APP.InpageNav.isOpen = true;
			APP.InpageNav.mainNav.off('transitionend.inpagenav');
			};
			APP.InpageNav.mainNav.on('transitionend.inpagenav', onDone);
			setTimeout(onDone, 350);
		});
		},
	/**
	 * [_close closes the inpage nav & slides down the main nav]
	 */
	_close : function(){
		if (!APP.InpageNav.isOpen) return;

		APP.InpageNav.isSliding = true;

		APP.InpageNav.container.removeClass('inpagenav--active');

		if (APP.InpageNav.isTargeted && APP.InpageNav.isDockedAtViewport) {
			APP.InpageNav._undockToHome();
		}

		APP.InpageNav.dummy.height(0);
		APP.InpageNav.mainNav.removeClass('mainnav--slideup');
		$('html').css('scrollPaddingTop', APP.InpageNav.mainNav.outerHeight());

		const onDone = () => {
			APP.InpageNav.isSliding = false;
			APP.InpageNav.isOpen = false;
			APP.InpageNav.mainNav.off('transitionend.inpagenav');
		};
		APP.InpageNav.mainNav.on('transitionend.inpagenav', onDone);
		setTimeout(onDone, 350);
	},
	scrollLeft : ( e ) => {
		e.preventDefault()
		const el = e.target.parentElement
		el.scrollBy({
			left: -200,
			behavior: 'smooth'
		} )
	}, 
	scrollRight :  ( e ) => {
		e.preventDefault()
		const el = e.target.parentElement
		el.scrollBy({
		left: 200,
		behavior: 'smooth'
		})
	},
	_isValidURL : function( string ) {
		let url = null
		try {
			url = new URL( string )
		}
		catch ( error ) {
			const pattern = new RegExp('^(https?:\\/\\/)?'+ // protocol
            '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.?)+[a-z]{2,}|'+ // domain name
            '((\\d{1,3}\\.){3}\\d{1,3}))'+ // ip (v4) address
            '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*'+ //port
            '(\\?[;&amp;a-z\\d%_.~+=-]*)?'+ // query string
            '(\\#[-a-z\\d_]*)?$','i')
            url = pattern.test( string )
		}
		return url && window.location + string !== url.href ? url : false
	 },
	// Function to ensure active tab is visible
	_ensureActiveTabVisible : () => {
		// Get the container and active tab
		const container = document.querySelector('.inpagetab-bottom-items-wrapper')
		const activeTab = document.querySelector('.inpagetab-items-item[aria-selected="true"]')
		if ( ! container || ! activeTab) return
	
		// Get the active tab's parent list item
		const activeTabItem = activeTab.closest('.inpagetab-items-list-item')
		if ( ! activeTabItem ) return
	
		// Calculate positions
		const containerRect = container.getBoundingClientRect()
		const tabRect = activeTabItem.getBoundingClientRect()
	
		// Check if tab is outside visible area
		const isTabLeftOfView = tabRect.left < containerRect.left
		const isTabRightOfView = tabRect.right > containerRect.right

		if  (isTabLeftOfView ) {
			// Scroll to show tab at left with some padding
			container.scrollLeft += tabRect.left - containerRect.left - 16
		} 
		else if ( isTabRightOfView ) {
			// Scroll to show tab at right with some padding
			container.scrollLeft += tabRect.right - containerRect.right + 16
		}
	}, 
	_initTabVisibility : () => {
		// Initial check
		APP.InpageNav._ensureActiveTabVisible()
		// Watch for tab changes
		const observer = new MutationObserver((mutations) => {
			mutations.forEach((mutation) => {
				if ( mutation.attributeName === 'aria-selected' ) {
					APP.InpageNav._ensureActiveTabVisible()
				}
			})
		})
		// Observe all tabs for aria-selected changes
		document.querySelectorAll('.inpagetab-items-item').forEach(tab => {
			observer.observe(tab, { attributes: true })
		})

		// Handle window resize
		let resizeTimer
		window.addEventListener('resize', () => {
			clearTimeout(resizeTimer)
			resizeTimer = setTimeout( APP.InpageNav._ensureActiveTabVisible, 100)
		})
		// Handle URL changes for single-page apps
		window.addEventListener( 'popstate', APP.InpageNav._ensureActiveTabVisible )
	}
}
APP.InpageNav._init()
/**
 * [InpageTab handles the inpage tab]
 * @type {Object}
 */
APP.InpageTab = {
	// define vars
	container : $( '.inpagetab' ),
	contentPanel : $('.inpagetab--content'),
    mainNav : $( '.mainnav' ),
	grid :  $( '.inpagetab--grid' ),
    list  : $( '.inpagetab-items' ),
	items : $('.inpagetab-items-item' ), // the tab items
	parent : $('.inpagetab-items-parent'),
	sections : undefined, // holds a pointer to the sections the tab can animate to
	isOpen : false, // is the inpage tab open
	isSliding : false, // is transitioning between open/close states
	isAnimating : false, // is _animatePageScrollTop running or not
	accordionWrapper :	'<div class="inpagetab-tab-header"></div>',
	accordianArrow : '<div class="inpagetab-tab-header-arrowcontainer"><i class="inpagetab-tab-header-arrowcontainer-arrow sficon sficon-arrow-right"></i></div>',
	tabs : {},
	tabsSub : {},
	/**
	 * [_init entry point]
	 */
	_init : function() {
		// check for inpage tab
		if ( APP.InpageTab.container.length > 0 ) {	
			// add class to body
			APP.InpageTab.items.on( 'click', APP.InpageTab._ItemslickHandler )
			// build sections
			$(window).on( 'load', function() {
				// loop through sections
				APP.InpageTab.sections = APP.InpageTab.items.map( function( index, el ) {
					// if element exists then return it
					if ( $(el.hash).length > 0 ) return $(el.hash)
                });
				// show the tabs & panel
                APP.InpageTab.grid.removeClass( 'inpagetab--loading' )
				// setup tabby js
				const taDataID = 'data-tabs'
				const tabData = `[${taDataID}]`
				if ( document.querySelectorAll( tabData ).length ) {
					APP.InpageTab.tabs = new Tabby( tabData );
				}
				const subTaDataID = 'data-tabs-sub'
				const subTabData = `[${subTaDataID}]`
				if ( document.querySelectorAll( subTabData ).length ) {
					APP.InpageTab.tabsSub = new Tabby( subTabData, {
						default: '[data-tabby-sub-default]' // The selector to use for the default tab
					});
				}
				if ( window.location.hash ) {
					const selector = window.location.hash.substring(1)
					const element = document.querySelector(`[href*="#${selector}"]`)
					const $parent = $( element ).parents('.inpagetab-sub-items')
					if ( element && $parent.length ) {
						const parentTab = $parent.prev('a.inpagetab-items-subtab')
						// first toggle parent
						APP.InpageTab.tabs.toggle( $(parentTab).get(0) )
						if ( APP.InpageTab.tabsSub ) {
							APP.InpageTab.tabsSub.toggle( $(element).get(0) )
						}
					}
					else if ( element ) {
						APP.InpageTab.tabs.toggle( element )
					}
				}
			})
			$(document).on( 'tabby', APP.InpageTab._TabbyHandler )
		}
	},
	_TabbyHandler : ( e ) => {
		let tab = e.target
		let $target = $(tab)
		let content = e.detail.content

		if ( ! $target.is( 'li') ) {
			$target = $target.parent()
		}

		$('.inpagetab-items-subtab').removeClass('inpagetab-item--active')
		if ( $target.parent().hasClass('inpagetab-sub-items') ) {
			APP.InpageTab.items.not( [ tab, $target.parents('.inpagetab-items-parent').find( '> a' ) ] ).attr( "aria-selected", "false" )
			$target.parents('.inpagetab-items-parent').find( '> a' ).addClass('inpagetab-item--active')
		}
		else {
			APP.InpageTab.items.not( tab ).attr( "aria-selected", "false" )
		}

		if ( $target.hasClass( 'inpagetab-items-parent' ) ) {
			// Keep active
			$target.find('> a').addClass('inpagetab-item--active')
			// toggle default subtab
			APP.InpageTab.tabsSub.toggle( $('a[data-tabby-sub-default]' ).get(0) )
			// expand children
			$target.find( '.inpagetab-sub-items.hideall' )
					.removeClass( 'hideall' )
		}
		else if ( $target.parent().hasClass( 'inpagetab-sub-items' ) ) {

		}
        else {
			$('.inpagetab-items-subtab').removeClass('inpagetab-item--active')
			$('.inpagetab-sub-items').addClass('hideall')
		}
		if ( APP.InpageTab.items.length
		&& $( APP.InpageTab.items.get(0) ).parents( '.inpagetab-items').hasClass('layout--vertical') 
		&& ! $target.hasClass( 'inpagetab-items-parent' ) 
		&& $target.hasClass( 'inpagetab-items-list-item') ) {
			$('html,body').animate({ scrollTop: 100 }, 'slow' )
		}
	},

	_ItemslickHandler : ( e ) => {
		// console.log( e )
		// let $target = $(e.target)
		// if ( ! $target.is( 'li') ) {
		// 	$target = $target.parent()
		// }
        // // probs not needed but w/e
        // e.preventDefault
        // if ( $target.hasClass( 'inpagetab-items-parent' ) ) {
		// 	// expand children
		// 	console.log( $target.attr( "aria-selected" ) )
		// 	if ( $target.attr( "aria-selected" ) === 'true' ) {
		// 		console.log( 'show children')
		// 		$target.find('.inpagetab-sub-items.hideall').removeClass('hideall')
		// 	}
		// 	else {
		// 		console.log( 'hide children?')
		// 		$target.find('.inpagetab-sub-items.hideall').addClass('hideall')
		// 	}
		// }
        // else {
		// 	console.log( 'hide all subtabs?')
		// 	$('.inpagetab-sub-items').addClass('hideall')
		// }
	}
}

APP.InpageTab._init()
APP.Keypad = {
    stops : {},
    stopData : {},
    options : {},
    elementIDS : [ "number-input--output-zero" ],
    handleElements : document.querySelectorAll( '.number-input--handle' ),
    isDeviceKeypad : document.querySelectorAll( '.is--device-keypad' ).length ? true : false,
    wrapperElements : document.querySelectorAll( '.number-input--wrapper' ),
    numberInputs : document.querySelectorAll( '.number-input--digit' ),
    mediaQueryList : window.matchMedia( "(orientation: landscape)" ),
    /**
	 * [_init entry point]
	 */
	_init : () => {
        if ( 'undefined' !== typeof APP.Keypad.options.device_keypad && APP.Keypad.options.device_keypad ) {
            APP.Keypad.isDeviceKeypad = true;
        }
        if ( 0 === APP.Keypad.numberInputs.length && ! APP.Keypad.isDeviceKeypad ) {
            return
        }
        // Parse out stops
        APP.Keypad._parseStops()
        // use pageshow event to clear form
        window.addEventListener( 'pageshow', APP.Keypad.windowShow )
        $(document).on( 'ready', APP.Keypad._documentReadyHandler )
        $( '.number-input--digit' ).on( 'click', APP.Keypad.addInput )
        $( '#number-input--backspace' ).on( 'click', APP.Keypad.removeInput )
        $( '.number-input--handle' ).on( 'click', APP.Keypad._openCloseHandler )
        APP.Keypad.wrapperElements.forEach( ( el ) => {
            el.classList.remove( 'is--loading')
            el.classList.add( 'is--loaded')
        } )
        // Attach click events to the keypad handle
        // APP.Keypad.handleElements.forEach( element => element.addEventListener( 'click', APP.Keypad._openCloseHandler ) )

        // Restricts input for the given textbox to the given inputFilter function.
        APP.Keypad.elementIDS.forEach( ( elID, i ) => {
            // apply the input filter
            if ( 'number-input--output-zero' === elID ) {
                // if partent with class number-input--wrapper also has class is--expanded, focus on the first input
                if ( APP.Keypad.wrapperElements[i].classList.contains( 'is--expanded' ) ) {
                    $( `#${elID}`).focus()
                }
            }
            APP.Keypad.setInputFilter( document.getElementById( elID ), ( value ) => /^\d*?\d*$/.test( value ), 'Only numeric digits are allowed' )
        } )
        APP.Keypad.mediaQueryList.addListener( APP.Keypad._handleOrientationChange )
        // If native keypad, focus on the first input
        if ( ! APP.Keypad.isDeviceKeypad ) {
            // add "number-input--output-one", "number-input--output-two"  to elementIDS
            APP.Keypad.elementIDS.push( "number-input--output-one" )
            APP.Keypad.elementIDS.push( "number-input--output-two" )
        }
    },
    _parseStops : () => {
        // let stops, stopData = []
		if ( 'undefined' === typeof APP.data || ( 'undefined' === typeof APP.data['audio_stops'] && 'undefined' === typeof APP.data['audio_stops_path'] ) ) {
            setTimeout( () => { 
                APP.Keypad._init()
            }, 200 )
            return
        }
        // If audio_stops_path exists, use the path to fill StopData
        if ( 'undefined' !== typeof APP.data['audio_stops_path'] ) {
            APP.Keypad.stopData = APP.data['audio_stops_path']
        }
        // If audio_stops data exist, spread it into StopData
        else if ( 'object' === typeof APP.data['audio_stops'] && Object.keys( APP.data['audio_stops'] ).length ) {
            APP.Keypad.stopData = { ...APP.data['audio_stops'] }
        }
        if ( typeof APP.Keypad.stopData === 'string' && APP.Keypad.stopData.endsWith( '.json' ) ) {
            // If it's a URL, fetch the file and parse it as a JSON object
            fetch( APP.Keypad.stopData )
                .then( response => response.json() )
                .then( data => APP.Keypad.stops = data )
                .catch( error => console.error( 'Failed to fetch JSON file:', error ) )
        }
        else if ( typeof APP.Keypad.stopData === 'object' && APP.Keypad.stopData !== null && APP.Keypad.stopData.constructor === Object) {
            // If it's already an object, return it
            APP.Keypad.stops = APP.Keypad.stopData
        } 
        // Check if the input is a JSON string or URL
        else if ( typeof APP.Keypad.stopData === 'string') {
            try {
                // If it's a string, parse it as a JSON object
                APP.Keypad.stops = JSON.parse( APP.Keypad.stopData )
            } 
            catch ( e ) {
                console.error( 'Invalid JSON string ')
            }
        }
    },
    _documentReadyHandler : ( e ) =>  {
        const zeroInput = document.getElementById( 'number-input--output-zero' )
        if ( typeof APP.data !== 'undefined' && 'undefined' !== typeof APP.data['audio_stop'] ) {
            const digits = APP.data['audio_stop'].split('')
            // Loop through the digits and trigger click events on the corresponding elements
            digits.forEach( ( digit, index ) => {
                setTimeout(() => {
                    const element = [...APP.Keypad.numberInputs].find(el => el.dataset.value === digit)
                    if ( ! APP.Keypad.isDeviceKeypad && element ) {
                        element.click()
                    }
                    else {
                        // Add each digito to zeroInput by triggering the click event on the numbers
                        zeroInput.value += digit
                    }
                }, 300 )
            })
        }
        zeroInput.addEventListener( "focus", () => {
            // add the class .is--focused to the parent
            zeroInput.classList.add( 'is--focused' )
        })
        // on blur event, remove the class .is--focused from the parent
        zeroInput.addEventListener( "blur", () => {
            zeroInput.classList.remove( 'is--focused' )
        })
    },
    windowShow : ( e ) =>  {
        const zeroInput = document.getElementById( 'number-input--output-zero' ),
            inputContainer = document.getElementsByClassName( 'number-input--input-group' )
        inputContainer[0].classList.remove( 'is--valid' )
        inputContainer[0].classList.remove( 'is--invalid' )
        zeroInput.value = ''
        if ( ! APP.Keypad.isDeviceKeypad ) {
            const oneInput = document.getElementById( 'number-input--output-one' ),
            twoInput = document.getElementById( 'number-input--output-two' )
            oneInput.value = ''
            twoInput.value = ''
        }
    },
    _openCloseHandler : ( e ) => {
        APP.Keypad.wrapperElements.forEach( wrapperElement => {
            wrapperElement.classList.toggle( 'is--expanded' )
            if ( wrapperElement.classList.contains( 'is--expanded' ) ) {
                APP.Keypad._open()
            }
            else {
                APP.Keypad._close()
            }
        } )
    },
    _open : () => {
        const body = document.body
        body.classList.add( 'keypad--expanded' )
        // When the modal is shown, we want a fixed body but on if in portrait
        if ( 'landscape' !== APP.Breakpoint.orientation ) {
            const scrollY = document.documentElement.style.getPropertyValue( '--scroll-y' )
            body.style.position = 'fixed'
            body.style.top = `-${scrollY}`
        }
        else {
            body.style.position = ''
            body.style.top = ''
        }
        if ( APP.Keypad.isDeviceKeypad ) {
            // If native keypad, focus on the first input
            document.getElementById( 'number-input--output-zero' ).focus()  
        }
    },
    _close : () => {
        const body = document.body
        body.classList.remove( 'keypad--expanded' )
        if ( 'landscape' !== APP.Breakpoint.orientation ) {
            body.style.position = ''
            body.style.top = ''
        }
    },
    _handleOrientationChange : () => {
        APP.Keypad.wrapperElements.forEach( wrapperElement => {
            if ( wrapperElement.classList.contains( 'is--expanded' ) ) {
                APP.Keypad._open()
            }
        } )
    },
    addInput : ( e ) => {
        // Rule for input:
        // - characters must be entered via touch/click of numbers, paste, or via native numeric keypad
        // - maximum 3 characters allowed
        // - numbers typed or click after input is alredy full (or pasted strings longer max allowed) will be ignored
        // - input must be one of 0-9 number keys, cursor right or left, backspace, paste, or space keys
        // - upon entry of 3 numbers, attempt to redirect (automatically) to destination, or if automatic redirection is not possible, make the confirm/done button focused.
        if ( typeof e.target.dataset.value === 'undefined' || isNaN( +e.target.dataset.value ) ) {
            return
        }
        const zeroInput = document.getElementById( 'number-input--output-zero' ),
            statusLine = document.getElementById( 'number-input-status-line' ),
            inputContainer = document.getElementsByClassName( 'number-input--input-group' )

        let currentVal = [], stopValue = ''
        // Remove valid class on container
        inputContainer[0].classList.remove( 'is--valid' )
        inputContainer[0].classList.remove( 'is--invalid' )

        if ( APP.Keypad.isDeviceKeypad ) {
            if ( 'undefined' !== typeof zeroInput.value 
                && zeroInput.value !== '' 
                && zeroInput.value.length === 3 ) {
                    stopValue = zeroInput.value   
            }
            else {
                return
            }
        }
        else {
            const oneInput = document.getElementById( 'number-input--output-one' ),
            twoInput = document.getElementById( 'number-input--output-two' )
            if ( zeroInput.value !== '' ) {
                currentVal[0] = zeroInput.value
                if ( oneInput.value !== '' ) {
                    currentVal[1] = oneInput.value
                    if ( twoInput.value !== '' ) {
                        currentVal[2] = twoInput.value
                    }
                }
            }
            if ( typeof currentVal[0] === 'undefined' ) {
                zeroInput.value = +e.target.dataset.value
            }
            else if ( typeof currentVal[1] === 'undefined' ) {
                oneInput.value = +e.target.dataset.value
            }
            else if ( typeof currentVal[2] === 'undefined' ) {
                twoInput.value = +e.target.dataset.value
                // now that we have all 3 values, test to see if this stop exists
                stopValue = `${zeroInput.value}${oneInput.value}${twoInput.value}`
            }
        }

        // now that we have all 3 values, test to see if this stop exists
        if ( stopValue in APP.Keypad.stops ) {
            inputContainer[0].classList.add( 'is--valid' )
            inputContainer[0].classList.remove( 'is--invalid' )
            $( statusLine ).show( () => {
                const postID = APP.Keypad.stops[ stopValue ]
                if ( typeof postID.url !== 'undefined' ) {
                    window.location.href = postID.url
                }
                else {
                    // redirect to the page which has the audio stop
                    window.location.href = `//${window.location.hostname}/?_v=ags&p=${postID.id}`
                }
            } )
        }
        else {
            // stop not found. give feedback
            inputContainer[0].classList.remove( 'is--valid' )
            inputContainer[0].classList.add( 'feedback--shake' )
            inputContainer[0].classList.add( 'is--invalid' )
            //statusLine.style.display = 'none'
            // After a short delay to show shake feedback, remove input and return focus to first input
            setTimeout( () => { 
                if ( ! APP.Keypad.isDeviceKeypad ) {
                    twoInput.value = ''
                    oneInput.value = ''
                }
                zeroInput.value = ''
                inputContainer[0].classList.remove( 'feedback--shake' )
                zeroInput.readOnly = true
                zeroInput.focus()
                zeroInput.readOnly = false
            }, 500 )
        }
    },
    removeInput : ( e ) => {
        window.stop() 
        let currentVal = []
        const zeroInput = document.getElementById( 'number-input--output-zero' ),
            statusLine = document.getElementById( 'number-input-status-line' ),
            inputContainer = document.getElementsByClassName( 'number-input--input-group' )
        
        // Remove valid class on container
        inputContainer[0].classList.remove( 'is--valid' )
        inputContainer[0].classList.remove( 'is--invalid' )
        if ( APP.Keypad.isDeviceKeypad ) {
            if ( 'undefined' !== typeof zeroInput.value || zeroInput.value !== ''  ) {
                return
            }

            if ( zeroInput.value.length < 2 ) {
               // zeroInput.value = `${currentVal[0]}`
            }
            else if ( zeroInput.value.length < 3 ) {
                inputContainer[0].classList.remove( 'feedback--shake' )
            }
            else {
                zeroInput.value = ''
            }
        }
        else {
            const oneInput = document.getElementById( 'number-input--output-one' ),
            twoInput = document.getElementById( 'number-input--output-two' )
            twoInput.value = ''
            oneInput.value = ''
            if ( zeroInput.value !== '' ) {
                currentVal[0] = zeroInput.value
                if ( oneInput.value !== '' ) {
                    currentVal[1] = oneInput.value
                    if ( twoInput.value !== '' ) {
                        currentVal[2] = twoInput.value
                    }
                }
            }
            if ( typeof currentVal[0] === 'undefined' ) {
                return
            }
            else if ( typeof currentVal[2] !== 'undefined' ) {
                inputContainer[0].classList.remove( 'feedback--shake' )
                zeroInput.value = `${currentVal[0]}`
                oneInput.value = `${currentVal[1]}`
                twoInput.value = ''
            }
            else if ( typeof currentVal[1] !== 'undefined' ) {
                zeroInput.value = `${currentVal[0]}`
                oneInput.value = ''
    
            }
            else {
                zeroInput.value = ''
            }
        }
    },
    setInputFilter : ( el, inputFilter, errMsg ) => {
        const eventTypes = [ "input", "keydown", "keyup", "mousedown", "mouseup", "select", "contextmenu", "drop", "focusout" ]

        eventTypes.forEach( ( event ) => {
            el.addEventListener( event, ( e ) => {
                const inputContainer = document.getElementsByClassName( 'number-input--input-group' ),
                    targetEvent = document.getElementById( e.target.id )
                if ( inputFilter( targetEvent.value ) ) {
                    // Accepted value found.

                    // Remove error class and message if event type is keydown, mousedown, or focusout
                    if ( ! APP.Keypad.isDeviceKeypad && [ "keydown", "mousedown", "focusout" ].indexOf( e.type ) >= 0 ) {
                        targetEvent.classList.remove( "input-error" )
                        targetEvent.setCustomValidity( "" )
                        inputContainer[0].classList.remove( 'feedback--shake' )
                        inputContainer[0].classList.remove( 'is--valid' )
                    }
                    targetEvent.oldValue = targetEvent.value
                    targetEvent.oldSelectionStart = targetEvent.selectionStart
                    targetEvent.oldSelectionEnd = targetEvent.selectionEnd
                }
                else if ( targetEvent.hasOwnProperty( "oldValue" ) ) {
                    // Rejected value: restore the previous one.
                    targetEvent.classList.add( "input-error" )
                    inputContainer[0].classList.remove( 'is--valid' )
                    targetEvent.setCustomValidity( errMsg )
                    targetEvent.reportValidity()
                    targetEvent.value = targetEvent.oldValue
                    targetEvent.setSelectionRange( targetEvent.oldSelectionStart, targetEvent.oldSelectionEnd )
                }
                else {
                    // Rejected value: nothing to restore.
                    targetEvent.value = ""
                }

                if ( 'keydown' === e.type ) {
                    // If backspacing, goto previous element
                    if ( ! $( e.target ).is( ':first-child' ) && $( e.target ).val() === '' && ( e.which == 8 || e.which == 46 ) ) {
                        inputContainer[0].classList.remove( 'feedback--shake' )
                        $( e.target ).prev( 'input' ).focus()
                    }
                }
                else if ( 'keyup' === e.type ) {
                    // if not last input element move to next 
                    if ( APP.Keypad.isDeviceKeypad && ! $( e.target ).is( ':last-child' ) && $( e.target ).val().length >= $( e.target ).attr('maxlength' ) ) {
                        $( e.target ).next().focus()
                    }
                    let currentVal = [], stopValue = ''
                    const zeroInput = document.getElementById( 'number-input--output-zero' )
                    if ( APP.Keypad.isDeviceKeypad ) {
                        if ( 'undefined' !== typeof zeroInput.value 
                        && zeroInput.value !== '' 
                        && zeroInput.value.length === 3 ) {
                            stopValue = zeroInput.value   
                        }
                    }
                    else {
                        const oneInput = document.getElementById( 'number-input--output-one' ),
                        twoInput = document.getElementById( 'number-input--output-two' )
                        if ( zeroInput.value !== '' ) {
                            currentVal[0] = zeroInput.value
                            if ( oneInput.value !== '' ) {
                                currentVal[1] = oneInput.value
                                if ( twoInput.value !== '' ) {
                                    currentVal[2] = twoInput.value
                                }
                            }
                        }
                        if ( typeof currentVal[0] !== 'undefined' &&  typeof currentVal[1] !== 'undefined' && typeof currentVal[2] !== 'undefined' ) {
                            stopValue = `${zeroInput.value}${oneInput.value}${twoInput.value}`
                        }
                    }
                    if ( stopValue !== '' ) {
                        // now that we have all 3 values, test to see if this stop exists
                        if ( stopValue in APP.Keypad.stops ) {
                            inputContainer[0].classList.add( 'is--valid' )
                            if ( typeof APP.Keypad.stops[ stopValue ].url !== 'undefined' ) {
                                window.location.href = APP.Keypad.stops[ stopValue ].url
                            }
                            else {
                                // redirect to the page which has the audio stop
                                window.location.href = window.location.hostname + '/?_v=ags&p=' + APP.Keypad.stops[ stopValue ].id
                            }
                        }
                        else  {
                            // stop not found. give feedback
                            inputContainer[0].classList.add( 'feedback--shake' )
                            // After a short delay to show shake feedback, remove input and return focus to first input
                            setTimeout( () => { 
                                if ( ! APP.Keypad.isDeviceKeypad ) {
                                    twoInput.value = ''
                                    oneInput.value = ''
                                }
                                zeroInput.value = ''
                                zeroInput.focus()
                                inputContainer[0].classList.remove( 'feedback--shake' )
                            }, 500 )
                        }
                    }
                }
            })
        })
    }
}
APP.Keypad._init()
/**
 * [MainNav handles the main navigation menu]
 * @type {Object}
 */
 APP.MainNav = {
	/* [mainContentElements the elements to hide when the search is open]
	* @type {String}
	*/
	mainContentElements :  '.mainnav-dropdown, .overlay, body > section, body > .modulebuilder, .footernav',
	/* [nav the parent nav elment]
	* @type {jQuery obj}
	*/
	nav : $('nav.mainnav'),
	/**
	 * [toggle the clickable link to the toggle]
	 * @type {jQuery obj}
	 */
	toggle : $('#mainnav-toggle'),
	/**
	 * [toggleIcon the toggle's icon]
	 * @type {jQuery obj}
	 */
	toggleIcon : $('.mainnav-topbar-wrapper-left-link-icon'),
	/**
	 * [dropdown the dropdown menu]
	 * @type {jQuery}
	 */
	dropdown : $('#mainnav-dropdown-container'),
	/**
	 * [dpDropdown the DP dropdown menu]
	 * @type {jQuery}
	 */
	dpDropdown : $('.digital-publication--links'),
	/* [previouslyFocusedElement the element that had focus before opening the overlay ]
	* @type html element
	*/
	previouslyFocusedElement : null,
	/**
	 * [searchClose open the search button]
	 * @type {jQuery obj}
	 */
	searchClose : $('.mainnav-search-toggle, .mainnav-search-close'),
	/**
	 * [searchOpen open the search button]
	 * @type {jQuery obj}
	 */
	searchOpen : $('#open-search-overlay'),
	/**
	 * [search the search modal]
	 * @type {jQuery obj}
	 */
	search : $('#search-overlay'),
	SearchDebounceTimer : null,
	$siteSearch : $('.mainnav-search-form-input-wrapper'),
	/**
	 * [topbar the bar with the logo & icons]
	 * @type {jQuery obj}
	 */
	topbar : $('.mainnav-topbar'),
	/**
	 * [adminBar the wordpress admin bar]
	 * @type {jQuery obj}
	 */
	adminBar : $('#wpadminbar'),
	/**
	 * [inpageNav container for the inpage nav]
	 * @type {jQuery obj}
	 */
	inpageNav : $('.inpagenav:not(.inpagenav--targeted)'),
	newBodyPadding : 0,
	/**
	 * [_init entry point]
	 */
	_init : function(){
		// listen for click events on the toggle
		APP.MainNav.nav.on( 'click', APP.MainNav._navClickHandler )
		// listen for click events on the toggle
		APP.MainNav.toggle.on( 'click', APP.MainNav._menuClickHandler )
		// listen for click events on the search open and close buttons
		APP.MainNav.searchOpen.on( 'click', APP.MainNav._openSearchOverlay )
		APP.MainNav.searchClose.on( 'click', APP.MainNav._closeSearchOverlay )
		// listen for window resize/load events if tickers on or if there's an adminbar
		//if( APP.data.APP.data.SetupTheme.enable_ticker || APP.MainNav.adminBar.length > 0 ){
			// ticker enabled?
		if ( APP.data.SetupTheme.enable_ticker ) {
			// ref the ticker
			APP.MainNav.ticker = $('.mainnav-ticker')
		}
		// attach event listener
		$(window).on( 'load resize', APP.MainNav._resizeLoadHandler )
		$(document).ready( () => APP.MainNav._onDocumentReady() )
		APP.MainNav.$siteSearch.on( 'keyup input change click', APP.MainNav._searchHandler )
	},
	_onDocumentReady : (e) => {
		// Set the skip link to the first element on the page
		const skipLink = document.getElementById('skip-nav-link')
		const possibleTargets = ['#main-content','.contenttypemain',  '.pagetitle', '#artworkimage', '.artistbio-wrapper', '.homehero', '.stories--atf', '.primary-content', '.module-builder']
		let targetFound = false
		for ( let selector of possibleTargets ) {
			let target = document.querySelector(selector)
			if ( target ) {
				// if target.id is empty set it to the default 'content-begin'
				if ( ! target.id ) {
					target.setAttribute( 'id', 'content-begin' )
				}
				else {
					skipLink.setAttribute( 'href', `#${target.id}`)
				}
				targetFound = true
				break
			}
		}
		if ( ! targetFound ) {
			skipLink.style.display = 'none'
		}
		document.addEventListener( 'keydown', APP.MainNav._trapFocus )
		// Initialize the auto-grow textarea
		// Get the textarea element
		const textarea = document.getElementById("search-input")
		if ( ! textarea ) return

		// Get the form element
		const form = textarea.closest("form")

		// Get computed line height
		const computedStyle = window.getComputedStyle(textarea)
		const lineHeight = parseInt(computedStyle.lineHeight, 10)

		// Function to auto-grow/shrink the textarea
		const autoGrow = (element) => {
			// Reset height to minimum to properly calculate new height
			element.style.height = `${lineHeight}px`
			
			// Get the real content height without padding
			const contentHeight = element.scrollHeight
			const padding = parseInt(computedStyle.paddingTop, 10) + parseInt(computedStyle.paddingBottom, 10)
			const actualContentHeight = contentHeight - padding

			// If content needs more than one line, grow accordingly
			if (actualContentHeight > lineHeight) {
				element.style.height = `${actualContentHeight}px`
			}
			// Otherwise keep it at one line height
			else {
				element.style.height = `${lineHeight}px`
			}
		}

		// Initialize the textarea with the correct height (one line minimum)
		textarea.style.height = `${lineHeight}px`

		// Add event listeners for various content changes
		textarea.addEventListener("input", () => autoGrow(textarea))
		textarea.addEventListener("paste", () => setTimeout(() => autoGrow(textarea), 0))
		textarea.addEventListener("cut", () => setTimeout(() => autoGrow(textarea), 0))

		// Function to check if string contains at least one visible character
		const hasVisibleCharacters = (str) => {
			return /[^\s\n]/.test(str)
		}
	
		// Handle Shift+Enter and Enter behavior
		textarea.addEventListener("keydown", (event) => {
			if (event.key === "Enter") {
				if (event.shiftKey) {
					// Shift+Enter: Add a new line
					const cursorPosition = textarea.selectionStart
					textarea.value = textarea.value.slice(0, cursorPosition) + "\n" + textarea.value.slice(cursorPosition)
					textarea.selectionStart = textarea.selectionEnd = cursorPosition + 1
					event.preventDefault()
					autoGrow(textarea)
				} 
				else {
					// Only proceed if there's at least one visible character
					if (!hasVisibleCharacters(textarea.value)) {
						event.preventDefault()
						return
					}
					
					// Enter without Shift: Submit the form
					event.preventDefault()
					
					// First, clean up the search query
					let searchQuery = textarea.value
						.replace(/\n/g, " ") // Replace newlines with spaces
						.replace(/\s{2,}/g, " ") // Replace multiple spaces with a single space
						.trim() // Remove leading/trailing whitespace
					
					// Create a hidden input to carry the modified query
					const hiddenInput = document.createElement("input")
					hiddenInput.type = "hidden"
					hiddenInput.name = textarea.name // Use the same name as the textarea
					hiddenInput.value = searchQuery
					
					// Append the hidden input to the form and remove the textarea
					form.appendChild(hiddenInput)
					textarea.name = "" // Prevent the original textarea from submitting
					
					form.submit()
				}
			}
		})
	},
	/**
	 * [_resizeLoadHandler change the dropdown nav distance from the top if APP.data.SetupTheme.enable_ticker is true or the admin bar is enabled]
	 * @param  {obj} e the event object
	 */
	_resizeLoadHandler : function( e ) {
		let computedHeightDiff = 0,
		 	scrollOffset = 0 
		// if the tickers enabled and the admin bar is active
		if ( APP.data.SetupTheme.enable_ticker && APP.MainNav.adminBar.length > 0 ) {
			// get the height of the mainnav, ticker and admin bar
			computedHeightDiff = APP.MainNav.ticker.outerHeight() + APP.MainNav.topbar.outerHeight() + APP.MainNav.adminBar.outerHeight()
		}
		// otherwise if just the ticker is enabled
		else if ( APP.data.SetupTheme.enable_ticker && APP.MainNav.ticker.length && APP.MainNav.ticker.hasClass( 'hidden' ) ) {
			// get the height of the main nav and the ticker
			computedHeightDiff = APP.MainNav.topbar.outerHeight()
		}
		// otherwise if just the adminbar is just enabled
		else if ( APP.MainNav.adminBar.length > 0 ) {
			// get the height of the admin bar
			computedHeightDiff = APP.MainNav.adminBar.outerHeight()
		}
		else if ( APP.data.SetupTheme.enable_ticker ) {
			// get the height of the main nav and the ticker
			computedHeightDiff = APP.MainNav.ticker.outerHeight() + APP.MainNav.topbar.outerHeight()
		}
		scrollOffset = $('.mainnav').outerHeight()

		// set some adminbar specific stuff
		// if the admin bar is active
		if ( APP.MainNav.adminBar.length > 0 ) {
			var dropTop = APP.data.SetupTheme.enable_ticker ? 0 : APP.MainNav.adminBar.outerHeight();
			// set the topbar's top position to be the height of the admin bar so they don't overlap
			APP.MainNav.nav.css( 'top', dropTop )

			// if there's an inpage nav too
			if ( APP.MainNav.inpageNav.length > 0 ) {
				// set the margin top of the inpage nav so it works more seemlessly to be the height of the adminbar
				APP.MainNav.inpageNav.css( 'marginTop', APP.MainNav.adminBar.outerHeight() )
			}
		}	
		// if the ticker is enabled
		if ( APP.data.SetupTheme.enable_ticker && computedHeightDiff > 0 ) {
			// set the dropdown in the main nav top to the computed height diff
			// APP.MainNav.dropdown.css( 'top', computedHeightDiff )
		}
		// apply the computed height diff to the padding top of the body on every body tag except the one on the homepage
		if( APP.MainNav.adminBar.length && computedHeightDiff > 0 ) {
			APP.MainNav.newBodyPadding = APP.MainNav.newBodyPadding === 0 ? parseInt( $('body').css('paddingTop').slice( 0, -2 ) ) + computedHeightDiff : APP.MainNav.newBodyPadding
			$( 'body:not(.home)' ).css( 'paddingTop', APP.MainNav.newBodyPadding )
		}
		// set the homepage's logo css to fit in
		// $('body.home .homehero-logo').css({
		// 	top: computedHeightDiff,
		// 	height: 'calc(100vh - ' + (computedHeightDiff) + 'px)',
		// });
		// set scroll-padding-top: using all fixed header heights.
		$( 'html' ).css( 'scrollPaddingTop', scrollOffset )

		// if objectFitImages(); exists, call it to fix any image issues after a resize
		if ( typeof objectFitImages === 'function' ) {
			objectFitImages();
		}
	},
	_closeSearchOverlay : ( e ) => {
		e.preventDefault()
		// unlock the body
		document.documentElement.classList.remove( 'is--locked--portrait' )
		// hide the search with a fade out
		APP.MainNav.search.fadeOut(400, function() {
			APP.MainNav.search.removeClass('active')
		})
		// Update ARIA attributes
		APP.MainNav.searchOpen[0].setAttribute('aria-expanded', 'false')
		APP.MainNav.search[0].setAttribute('aria-hidden', 'true')
		APP.MainNav._setAriaHidden( 'false' )
		// Restore tabindex for all elements outside the modal
		document.querySelectorAll('[data-original-tabindex]').forEach(el => {
			const originalTabindex = el.getAttribute('data-original-tabindex')
			if (originalTabindex === '0' || originalTabindex === '') {
				el.removeAttribute('tabindex')
			} 
			else {
				el.setAttribute('tabindex', originalTabindex)
			}
			el.removeAttribute('data-original-tabindex')
		})
		//document.body.style.position = ''
		// Return focus to the element that had focus before the overlay was opened
		if ( APP.MainNav.previouslyFocusedElement ) {
			APP.MainNav.previouslyFocusedElement.focus()
		}
	},
	/**
	 * [_navClickHandler handles the click event on the menu]
	 * @param  {obj} e the event object
	 */
	 _navClickHandler : function(e) {
		// If click outside the menu area
		if ( $( 'body' ).hasClass( 'dp--active' ) && typeof( APP.Breakpoint.prevWW ) !== 'undefined' && APP.Breakpoint.prevWW < 500 ) {
			if ( APP.MainNav.dpDropdown.hasClass( 'state--expanded' ) && $( e.target ).hasClass( 'mainnav' ) ) {
				// close nav
				APP.MainNav.dpDropdown.addClass( 'state--collapsed' )
				APP.MainNav.dpDropdown.removeClass( 'state--expanded' )
				APP.MainNav.nav.removeClass( 'state--expanded' )
				APP.MainNav.toggleIcon.addClass( 'sficon-menu' )
				APP.MainNav.toggleIcon.removeClass( 'sficon-close' )
			}
		}
	},
	/**
	 * [_menuClickHandler handles the click event on the menu]
	 * @param  {obj} e the event object
	 */
	_menuClickHandler : function(e){
		// If a digital publication is active, do not opten sub menu.
		if ( $('body').hasClass( 'dp--active' ) && typeof( APP.Breakpoint.prevWW ) !== 'undefined' && APP.Breakpoint.prevWW < 500 ) {
			// prevent hash in url
			e.preventDefault()
			// close nav
			if ( APP.MainNav.dpDropdown.hasClass( 'state--expanded' ) ) {
				APP.MainNav.dpDropdown.addClass( 'state--collapsed' )
				APP.MainNav.dpDropdown.removeClass( 'state--expanded' )
				APP.MainNav.nav.removeClass( 'state--expanded' )
				APP.MainNav.toggleIcon.addClass( 'sficon-menu' )
				APP.MainNav.toggleIcon.removeClass( 'sficon-close' )
			}
			// open nav
			else {
				APP.MainNav.toggleIcon.addClass( 'sficon-close' )
				APP.MainNav.toggleIcon.removeClass( 'sficon-menu' )
				APP.MainNav.dpDropdown.addClass( 'state--expanded' )
				APP.MainNav.dpDropdown.removeClass( 'state--collapsed' )
				APP.MainNav.nav.addClass( 'state--expanded' )
			}
			return;
		}
		else if ( $('body').hasClass( 'dp--active' ) ) {
			return
		}
		// prevent hash in url
		e.preventDefault()
		const isOpen = APP.MainNav.dropdown.hasClass('active')
		// close nav
		if ( isOpen ) {
			APP.MainNav.toggleIcon.addClass('sficon-menu')
			APP.MainNav.toggleIcon.removeClass('sficon-close')
			APP.MainNav.dropdown.slideUp(400, function(){
				APP.MainNav.dropdown.removeClass('active')
			})
			APP.MainNav.toggle.attr('aria-expanded', true )
			APP.MainNav.dropdown.attr('aria-hidden', false )
		}
		// open nav
		else{
			APP.MainNav.toggleIcon.addClass('sficon-close')
			APP.MainNav.toggleIcon.removeClass('sficon-menu')
			APP.MainNav.dropdown.slideDown(400, function(){
				APP.MainNav.dropdown.addClass('active')
			})
			APP.MainNav.toggle.attr('aria-expanded', false )
			APP.MainNav.dropdown.attr('aria-hidden', true )
		}
	},
	_setAriaHidden : ( value ) => {
		document.querySelectorAll( APP.MainNav.mainContentElements ).forEach(el => {
			el.setAttribute('aria-hidden', value)
		}
		)
	},
	// Open search overlay
	_openSearchOverlay : ( e ) => {
		e.preventDefault()
		// Store the currently focused element to return to later
		APP.MainNav.previouslyFocusedElement = document.activeElement
		// lock the body
		document.documentElement.classList.add( 'is--locked--portrait' )
		// show the search
		APP.MainNav.search.fadeIn(400, function() {
			APP.MainNav.search.addClass('active')
		})
		// When the search is shown, we want a fixed body but on if in portrait
		if ( 'landscape' !== APP.Breakpoint.orientation ) {
			const scrollY = document.documentElement.style.getPropertyValue( '--scroll-y' )
			document.documentElement.style.top = `-${scrollY}`
		}

		// close the search if someone clicks Escape key, or clicks outside the search modal
		document.addEventListener( 'keydown', APP.MainNav._searchKeydownHandler )

		// Update ARIA attributes
		APP.MainNav.searchOpen[0].setAttribute('aria-expanded', 'true')
		APP.MainNav.search[0].setAttribute('aria-hidden', 'false')
		APP.MainNav._setAriaHidden( 'true' )
		
		// Set all focusable elements outside the modal to tabindex="-1"
		document.querySelectorAll('a[href], button, input, textarea, select, [tabindex]:not([tabindex="-1"])')
			.forEach(el => {
				if (! APP.MainNav.search[0].contains(el) && el !== APP.MainNav.searchOpen[0] ) {
					el.setAttribute('data-original-tabindex', el.getAttribute('tabindex') || '0')
					el.setAttribute('tabindex', '-1')
				}
			})
		
		// Focus the search input after a small delay to ensure the overlay is visible
		//setTimeout(() => {
		//	searchInput.focus()
		//}, 50)
	},
	_searchClickOutsideHandler : (e) => {
		if ( ! APP.MainNav.search[0].contains( e.target ) ) {
			APP.MainNav._closeSearchOverlay( e )
			document.removeEventListener( 'click', APP.MainNav._searchClickOutsideHandler )
			document.removeEventListener( 'keydown', APP.MainNav._searchKeydownHandler )
		}
	},
	_searchKeydownHandler : (e ) => {
		if ( e.key === 'Escape' ) {
			APP.MainNav._closeSearchOverlay( e )	
		}
	},
	_clearSearch : () => {
        const searchInput = document.querySelector( '#search-input' )
        $( searchInput ).parent().removeClass( 'has--searched is--searching' )
        $( searchInput ).val( '' )
        APP.ArchiveFilter.activeFilters.search = ''
        if ( 'site' === APP.ArchiveFilter.scope ) {
            APP.ArchiveFilter.activeFilters.s = ''
        }
    },
	_searchHandler: (event) => {
        if (event.defaultPrevented) {
            return
        }
        const target = event.target
		const searchSubmit = document.querySelector( '.mainnav-search-form-submit' )

        let container = null,
            input = null,
            control = null,
            searchText = '',
            previousQuery = '',
            handled = false
    
        // Locate the wrapper and container based on the event target
        if (target.classList.contains('mainnav-search-form-input-wrapper')) {
            container = target
        } 
        else {
            container = APP.ArchiveFilter._closestAncestor( target, '.mainnav-search-form-input-wrapper')
        }
        // Find the input and control elements
        if ( container ) {
            input = container.querySelector('textarea#search-input')
            control = container.querySelector('i.sficon.sficon-search')
        }
        // Retrieve the search text if input exists
        if (input) {
            searchText = input.value.trim()
            previousQuery = input.dataset.currentSearch || ''
        }
    
        const hasSearched = container?.classList.contains('has--searched')
        // If clicking the search icon after a search, clear the search
        if ( target.tagName === 'I' && hasSearched ) {
            container.classList.remove( 'is--searching', 'has--searched')
            input.value = ''
            input.focus()
            handled = true
        }
        // Prevent searching if the input is empty or contains only spaces
        else if ( searchText === '') {
            return
        } 
        else {
            // Handle Enter key press
            if ( 'Enter' === event.key ) {
                handled = true
            }
            // Handle click on search icon
            else if ( 'click' === event.type && 'I' === target.tagName ) {
                handled = true
            }
            if ( handled ) {
				APP.MainNav._searchItems( searchText, input, searchText.length > 0 )
            } 
			else if ( previousQuery && searchText && previousQuery !== searchText ) {
                container.classList.remove('has--searched')
                input.dataset.currentSearch = searchText
            }
        }
    
        if (handled) {
            event.preventDefault()
        }
    },
    _searchItems: ( query = '', target = null, debounce = true ) => {
        if ( debounce ) {
            // Clear the debounce timer if it exists
           if ( APP.MainNav.SearchDebounceTimer ) {
               clearTimeout( APP.MainNav.SearchDebounceTimer )
           }
           const delayed = () => APP.MainNav._searchQuery( query, target )
           APP.MainNav.SearchDebounceTimer = setTimeout( delayed , 150 )
       }
       else {
           APP.MainNav._searchQuery( query, target )
       }
    },
	_getFocusableElements : () => {
		return Array.from(
			APP.MainNav.search[0].querySelectorAll(
				'a[href], button, input, textarea, select, [tabindex]:not([tabindex="-1"])'
			)
		).filter (el => ! el.hasAttribute('disabled') )
	},
    _searchQuery : ( filterQuery, filterTarget ) => {
        const container = filterTarget.parentNode
        if ( filterQuery.length ) {
            container.classList.remove( 'has--searched' )
            container.classList.add( 'is--searching' )
        }
        else {
            container.classList.remove( 'is--searching' )
            delete filterTarget.dataset.currentSearch
        }
        if ( 'site' === APP.ArchiveFilter.scope ) {
            APP.ArchiveFilter.activeFilters.s = filterQuery
        }
        filterTarget.dataset.currentSearch = filterQuery
        // Directly search the site if the search is empty
        if ( filterQuery.length ) {
            // Redirect to the search results page
            const searchUrl = `/?s=${encodeURIComponent( filterQuery )}`
            window.location.href = searchUrl
            return
        }
    },
	_trapFocus : ( e ) => {
		if (e.key === 'Escape' && APP.MainNav.dropdown.hasClass('active')) {
			APP.MainNav.toggle.trigger('click');
			APP.MainNav.toggle.focus();
		}
		// Only process if the overlay is active
		if ( ! APP.MainNav.search[0].classList.contains('active') ) return
		const focusableElements = APP.MainNav._getFocusableElements()
		if ( focusableElements.length === 0 ) return
		// Get the first and last focusable elements
		const firstElement = focusableElements[0];
		const lastElement = focusableElements[focusableElements.length - 1];
		
		// If shift+tab is pressed and focus is on first element, move to last
		if ( e.key === 'Tab' && e.shiftKey && document.activeElement === firstElement ) {
			e.preventDefault()
			lastElement.focus()
		}
		// If tab is pressed and focus is on last element, move to first
		else if ( e.key === 'Tab' && !e.shiftKey && document.activeElement === lastElement ) {
			e.preventDefault()
			firstElement.focus()
		}
		// If Escape is pressed, close the overlay
		else if ( e.key === 'Escape' ) {
			APP.MainNav._closeSearchOverlay( e )
		}
	}
}
APP.MainNav._init()
/**
 * [MainTicker adds behavior involving the Main Ticker at the top of the Main Nav]
 * @type {Object}
 */
APP.MainTicker = {
	/**
	 * [_hideOnScroll set to true if you want the ticker to hide on scroll, 
	 * false if you want it to always be visible until it's closed]
	 * @type {Boolean}
	 */
	_hideOnScroll : false,
	/**
	 * [mainNav that contains the ticker]
	 * @type {jQuery obj}
	 */
	mainNav : $('.mainnav--hasticker'),
	/**
	 * [ticker the actual ticker]
	 * @type {jQuery obj}
	 */
	ticker : $('.mainnav-ticker'),
	/** 
	* [tickerContainer ]
	* @type {jQuery obj}
	*/
   	tickerContainer : $( '.ticker--banner' ),
	/**
	 * [modalClose close the modal button]
	 * @type {jQuery obj}
	 */
	tickerClose : $( '.ticker-notice-close' ),
	/**
	 * [mainNavDropdown ]
	 * @type {jQuery obj}
	 */
	mainNavDropdown : $('.mainnav-dropdown'),
	/**
	 * [fakeBlockNavBodyClasses list of body classes that indicate which pages should have their body tag's padding top set to the ehight of the mainnav with the ticker]
	 * @type {Array}
	 */
	fakeBlockNavBodyClasses : [
		'.single-exhibition',
		'.tax-event-series',
		'.single-event',
		'.page-template-default.page',
		'.single',
	],
	/**
	 * [fakeFullHeightDivClasses selectors for all the elements that are supposed to look like full height elements]
	 * @type {Array}
	 */
	fakeFullHeightDivClasses : [
		'.dphero',
		'.exhibitioncontainedhero'
	],
	height : 0,
	lastScrollY : 0,
	dropTop: 0,
	bodyPad: 0,
	/**
	 * [_init entry point]
	 */
	_init : function() {
		// do we got a ticker?
		if ( APP.MainTicker.ticker.length > 0 ) {
			if ( APP.MainTicker._getCookie( 'hide_ticker' ) !== 'True' ) {
				APP.MainTicker._toggleTickerHandler()
				// listen for the load and resize events
				$(window).on( 'resize load', APP.MainTicker._resizeLoadHandler )
				APP.MainTicker.tickerClose.on( 'click', () => APP.MainTicker._toggleTickerHandler( true ) )
			}
			else {
				APP.MainTicker._toggleTickerHandler( true )
				if ( typeof window.ticker_enable !== 'undefined') {
					ticker_enable = false
				}
			}
			// started on the load event on the window because that's when _is() is able to perform as expected
			$(window).on( 'load scroll', APP.MainTicker._scrollLoadHandler )
		}
	},
	/**
	 * [_scrollLoadHandler controls how inpagenav is displayed based on where the scroll is on the page]
	 * @param  {obj} e event object
	 */
	_scrollLoadHandler : function(e){
		if ( e.type === 'load' ) {
			APP.MainTicker.height = APP.MainTicker.tickerContainer.outerHeight()
			APP.MainTicker.dropTop = APP.MainTicker.mainNavDropdown.css('top').slice(0, -2)
			APP.MainTicker.bodyPad = $('body').css('paddingTop').slice(0, -2)
			return
		}
		// if the ticker is set to be hidden on scroll, do nothing
		if ( ! APP.MainTicker._hideOnScroll ) {
			return
		}
		if ( APP.Breakpoint._is('==', 'xxsmall' ) ) {

        }
        else if ( APP.Breakpoint._is('==', 'xsmall' ) ) {

		}
		else if ( APP.Breakpoint._is('==', 'small' ) ) {

        }
        else if ( APP.Breakpoint._is('==', 'medium' ) ) {

        }
        else if ( APP.Breakpoint._is('==', 'large' ) ) {

		}
        else if ( APP.Breakpoint._is('==', 'xlarge' ) ) {

        }
        else if ( APP.Breakpoint._is('==', 'xxlarge' ) ) {

        }
        else if ( APP.Breakpoint._is( '==', 'xxlarge' ) ) {

		}
		const newHeight = APP.MainTicker.height - window.pageYOffset > 0 ? APP.MainTicker.height - window.pageYOffset : 0
		const bodyPadding = APP.MainTicker.bodyPad - window.pageYOffset <= APP.MainTicker.bodyPad ? APP.MainTicker.bodyPad - window.pageYOffset : APP.MainTicker.bodyPad
		const newDropTop = ( APP.MainTicker.dropTop - APP.MainTicker.height ) + newHeight < APP.MainTicker.dropTop - APP.MainTicker.height ? APP.MainTicker.dropTop - APP.MainTicker.height : ( APP.MainTicker.dropTop - APP.MainTicker.height ) + newHeight	
		// console.log( `original height: ${APP.MainTicker.height}, current: ${APP.MainTicker.mainNavDropdown.css('top')}, new: ${newHeight}` )
		// console.log( `original top: ${APP.MainTicker.dropTop}, current: ${APP.MainTicker.mainNavDropdown.css('top')}, new: ${newDropTop}` )
		// console.log( `original padding: ${APP.MainTicker.bodyPad}, current: ${$('body').css('paddingTop')}, new: ${bodyPadding}`)
		if ( newHeight == 0 ) {
			// Set the hide the ticker and trigger cookie
			APP.MainTicker._toggleTickerHandler( true )
			return
		}

		if ( APP.MainTicker.tickerContainer.hasClass('hidden') ) {
			// Do nothing
		}
		else if ( APP.Scroll.lastScrollTop > window.pageYOffset ) {
			// console.log(`${window.pageYOffset} scrolling up`)
			// scrolling up
			if ( APP.MainTicker.tickerContainer.height() <= newHeight ) {
				APP.MainTicker.tickerContainer.height( newHeight )
				$('body').css('paddingTop', `${bodyPadding}px` )
				APP.MainTicker.mainNavDropdown.css('top', `${newDropTop}px` )
			}
		}
		else if ( APP.Scroll.lastScrollTop < window.pageYOffset ) {
			//console.log(`${window.pageYOffset} scrolling down`)
			// scrolling down
			if ( APP.MainTicker.tickerContainer.height() >= newHeight ) {
				APP.MainTicker.tickerContainer.height( newHeight )
				$('body').css('paddingTop', `${bodyPadding}px` )
				APP.MainTicker.mainNavDropdown.css('top', `${newDropTop}px` )
			}
		}
	},
	_toggleTickerHandler : function( closeTicker ) {
		if ( closeTicker == true ) {
			// Hide the ticker
			APP.MainTicker.tickerContainer.slideUp()
			APP.MainTicker.ticker.fadeOut()
			APP.MainTicker.tickerContainer.addClass('hidden')
			APP.MainTicker.ticker.addClass('hidden')
			$('body').css( 'paddingTop', '' )
			$('body').removeClass( 'ticker-enabled' )
			$('.stories--nav').removeClass('stories--inpagenav--tickerenabled')
			if ( APP.MainTicker.mainNavDropdown.css( 'top' ) ) {
				APP.MainTicker.mainNavDropdown.css( 'top', '')
			}
			// Set the cookie
			APP.MainTicker._setCookie( 'hide_ticker', 'True', 1 )
		}
		else {
			APP.MainTicker.tickerContainer.slideDown()
			APP.MainTicker.ticker.fadeIn()
			APP.MainTicker.tickerContainer.removeClass('hidden')
			APP.MainTicker.ticker.removeClass('hidden')
			$('body').addClass( 'ticker-enabled' )
			$('.stories--nav').addClass('stories--inpagenav--tickerenabled')
			if ( APP.MainTicker.mainNavDropdown.css('top') ) {
				// const newTop = 0
				// APP.MainTicker.mainNavDropdown.css('top', newTop)
			}
		}
	},
	/**
	 * [_resizeLoadHandler handle the load & resize event on the window]
	 */
	_resizeLoadHandler : function(){
		// loop through body classes that should have their body tag padding top set to the height of the mainnav with the ticker
		APP.MainTicker.fakeBlockNavBodyClasses.forEach(function(el){
			// does the classname match?
			if( $('body').is(el) ){
				// set the body's padding top to the height of the mainnav
				// $('body').addClass('home--with-ticker');
				// $('body').css('padding-top', APP.MainTicker.mainNav.outerHeight() + 'px');
			}
		});
		// loop through all the elements that are supposed to look like full height elements
		APP.MainTicker.fakeFullHeightDivClasses.forEach(function(el){
			// does el exist?
			if( $(el).length > 0 ){
				// set it's height to equal 100vh minus the main nav with the ticker's height
				// $(el).css('height', 'calc(100vh - ' + APP.MainTicker.mainNav.outerHeight() + 'px)');
			}
		});
	},
	_getCookie : function( cname ) {
		var name = cname + "=";
		var decodedCookie = decodeURIComponent(document.cookie);
		var ca = decodedCookie.split(';');
		for (var i = 0; i < ca.length; i++) {
		  var c = ca[i];
		  while (c.charAt(0) == ' ') {
			c = c.substring(1);
		  }
		  if (c.indexOf(name) == 0) {
			return c.substring(name.length, c.length);
		  }
		}
		return "";
	  },
	  _setCookie : function(cname, cvalue, exdays) {
		var d = new Date();
		d.setTime(d.getTime() + (exdays * 24 * 60 * 60 * 1000));
		var expires = "expires=" + d.toUTCString();
		document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/";
	  }
};

APP.MainTicker._init();
/**
 * [Marginalia handles the behavior for the marginalia]
 * @type {Object}
 */
APP.Marginalia = {
	/**
	 * [modules the marginalia module wrappers]
	 * @type {jQuery obj}
	 */
	modules : $('.marginaliastart-wrapper'),
	/**
	 * [_init entry point]
	 */
	_init : function(){
		// do we have modules?
		if( APP.Marginalia.modules.length > 0 ){
			// listen for scroll and load events on the window
			$(window).on('scroll load', APP.Marginalia._scrollLoadHandler);
			// listen for breakpoint event
			$(document).on('breakpoint', APP.Marginalia._breakpointHandler);
		}
	},
	/**
	 * [_scrollLoadHandler handles the scroll load events on the window. essentailly this controls which marginalia to show when]
	 * @param  {obj} e the event object
	 */
	_scrollLoadHandler : function(e){
		APP.Marginalia.modules.each(function(index, el){
			if(
				$(el).parent().offset().top < $(window).scrollTop()
				&&
				(
					typeof APP.Marginalia.modules[index + 1] != 'undefined'
					&&
					$(APP.Marginalia.modules[index + 1]).parent().offset().top >= $(window).scrollTop()
				)
			){
				$(el).parent().addClass('marginaliastart--active');
			}
			else{
				$(el).parent().removeClass('marginaliastart--active');
			}
		});
	},
	/**
	 * [_breakpointHandler reset the style tags on marginalia modules on mobile]
	 * @param  {obj} e the event object
	 */
	_breakpointHandler : function(e){
		// are we below the largeplus breakpoint?
		if( APP.Breakpoint._is('<', 'largeplus') ){
			// then remove the style attribute from the modules
			APP.Marginalia.modules.removeAttr('style');
		}
	}
};

APP.Marginalia._init();
APP.MasonryLayout = {
  gridContainers: document.querySelectorAll('.grid--masonry, [data-masonry]'),
  grids: [],
  useObserver: false,

  _init() {
      APP.MasonryLayout.grids = Array.from(APP.MasonryLayout.gridContainers).map(grid => {
          const useObserverForGrid = grid.getAttribute('data-masonry') === 'observe'
          APP.MasonryLayout.useObserver = APP.MasonryLayout.useObserver || useObserverForGrid

          const style = getComputedStyle(grid),
                gap = parseFloat(style.getPropertyValue('grid-row-gap'))
          return {
              _el: grid,
              gap: gap,
              items: Array.from(grid.children),
              ncol: 0
          }
      })

      if (APP.MasonryLayout.grids.length > 0 && getComputedStyle( APP.MasonryLayout.grids[0]['_el'] ).gridTemplateRows !== 'masonry' ) {
          if (APP.MasonryLayout.useObserver) {
              APP.MasonryLayout._setUpObserver()
          } 
          else {
              APP.MasonryLayout._layout()
          }

          window.addEventListener('resize', APP.MasonryLayout._debouncedLayout.bind(this))
      }
  },

  _setUpObserver() {
      APP.MasonryLayout.observer = new IntersectionObserver((entries) => {
          entries.forEach((entry) => {
              if (entry.isIntersecting) {
                  APP.MasonryLayout._processItem(entry.target)
                  APP.MasonryLayout.observer.unobserve(entry.target)
              }
          })
      }, {
          rootMargin: '0px',
          threshold: 0.1
      })

      APP.MasonryLayout.grids.forEach(grid => {
          grid.items.forEach(item => APP.MasonryLayout.observer.observe(item))
      })
  },

  _processItem(item) {
      // Add logic here to process a single item if necessary
      // For example, applying styles or classes specific to masonry layout
  },

  _layout() {
      requestAnimationFrame(() => {
          APP.MasonryLayout.grids.forEach(grid => {
              const style = getComputedStyle(grid._el),
                    ncol = style.getPropertyValue('grid-template-columns').split(' ').length

              if (grid.ncol !== ncol) {
                  grid.ncol = ncol
                  grid.items.forEach(item => item.style.removeProperty('margin-top'))

                  if (ncol > 1) {
                      APP.MasonryLayout._adjustMargins(grid, ncol)
                  }
              }
          })
      })
  },

  _adjustMargins(grid, ncol) {
      grid.items.slice(ncol).forEach((item, i) => {
          const prevItem = grid.items[i],
                prevRect = prevItem.getBoundingClientRect(),
                currRect = item.getBoundingClientRect()

          item.style.marginTop = `${prevRect.bottom + grid.gap - currRect.top}px`
      })
  },

  _debouncedLayout() {
      clearTimeout(APP.MasonryLayout.layoutTimeout)
      APP.MasonryLayout.layoutTimeout = setTimeout(() => APP.MasonryLayout._layout(), 0)
  }
}

APP.MasonryLayout._init()
APP.MediaPlayer = {
    videos : document.getElementsByTagName( 'video' ),
    audio : document.getElementsByTagName( 'audio' ),
    audioLoaded : false,
    videosLoaded : false,
    options : {},
    /**
	 * [_init entry point]
	 */
	_init : () => {
       // $(document).on( 'ready', APP.MediaPlayer._documentReadyHandler )
    },
    // _documentReadyHandler : ( e ) =>  {
    //     if ( APP.MediaPlayer.audio.length && ! APP.MediaPlayer.audioLoaded ) {
    //         for ( item of APP.MediaPlayer.audio ) {
    //             APP.MediaPlayer._applyLabels( item )
    //         }
    //         APP.MediaPlayer.audioLoaded = true
    //     }
    //     //if ( APP.MediaPlayer.videos.length ) {
    //     //     for ( item of APP.MediaPlayer.videos ) {
    //     //} 
    // },
	// _applyLabels : ( item ) => {
    //     let toAppend = ''
    //     const $mediaElement = $( item ).parents( '.mejs-mediaelement' ),
    //     $controls = $mediaElement.next().next(),
    //     $display = $controls.find('.mejs-display'),
    //     $button = $controls.find('.mejs-button'),
    //     $captionTextContainer = $mediaElement.parents('.single-column-content')
    //     $mediaContainer = $mediaElement.parents('.sfmoma--media-mejs-container')
    //     const captionTextElementCount = $captionTextContainer.find('>p').length
    //     let $captionTextElement = $captionTextContainer.find('>p:first-of-type')
    //     let captionTextString = ''
    //     if ( $captionTextElement.find('svg' ).length ) {
    //         captionTextString = $captionTextElement.find('svg' )
    //         const captionText = '' //captionTextString.get(0).outerHTML
    //         toAppend = `<h5 class="media-player--caption">${captionText}</h5>`
    //         captionTextString = 'Audio Description'
    //     }
    //     else if ( captionTextElementCount === 1 ) {
    //         toAppend = ''
    //     }
    //     else if ( $captionTextElement.length ) {
    //         captionTextString = $captionTextElement.html()
    //         toAppend = `<h5 class="media-player--caption">${captionTextString.replace( '[Play icon]', '')}</h5>`
    //     }
    //     if ( $display.length ) {
    //         $display.append( toAppend )
    //         setTimeout( () => {
    //             if ( '' !== captionTextString ) {
    //                 $captionTextElement.hide()
    //             }
    //             switch( captionTextString ) {
    //                 default:
    //                     break
    //                 case 'Audio Description':
    //                     $button.addClass( 'position--3' )
    //                     $display.addClass( 'is--audio-description' )
    //                     break
    //                 case 'Español':
    //                     $button.addClass( 'position--1' )
    //                     break
    //                 case '普通话':
    //                     $button.addClass( 'position--2' )
    //                     break
    //             }
    //             // set the container height now that all the content has been moved
    //             $display.addClass( 'is--active' )
    //             $button.addClass( 'is--active' )
    //             $mediaContainer[0].style.height = `${$controls[0].offsetHeight}px`
    //         }, 1 )
            
    //     }
    //     else {
    //         $( item ).add( $(item).parent() ).css( 'display', 'block' )
    //     }
    // },
}
APP.MediaPlayer._init()
/**
 * [NavStories handles the inpage nav]
 * @type {Object}
 */
APP.NavStories = {
	// define vars
	dummy : $('.stories--nav--dummy'),
    container : $('.stories--nav'),
	mainNav : $('.mainnav'),
	items : $('.stories--nav-items'), // the nav items
	backToTop : $('.stories--nav-bottom-backtotop-link'),
	sections : undefined, // holds a pointer to the sections the nav can animate to
	isOpen : false, // is the inpage nav open
	isSliding : false, // is transitioning between open/close states
    isAnimating : false, // is _animatePageScrollTop running or not
    navActivePosition : 74,
    afterHR : $('.stories--nav-hr'),
    navStar : $('.stories--nav-star'),
	tagline : $('.stories--nav-tagline'),
	wrapper : $('.stories--nav-wrapper'),

	/**
	 * [_init entry point]
	 */
	_init : function(){
		// check for inpage nav
		if ( APP.NavStories.container.length > 0 ) {
			// build sections
			$(window).on('load', function(){
				// loop through sections
				APP.NavStories.sections = APP.NavStories.items.map(function( index, el ){
					// if element exists then return it
					if( $(el.hash).length > 0 ) return $(el.hash);
                });
			});
            // started on the load event on the window because that's when _is() is able to perform as expected
            // @TODO uncomment when we want to enable fixed stories nav on scroll.
			// $(window).on('scroll', APP.NavStories._scrollLoadHandler);
            
            // Uneeded.
            // listen for click event on items
			// APP.NavStories.items.on('click', APP.NavStories._itemClickHandler);
			// listen for click event on backtotop
            // APP.NavStories.backToTop.on('click', APP.NavStories._backToTopClickHandler);
            APP.NavStories.navStar.on( 'click', function(e) {
                APP.NavStories.wrapper.toggleClass('tagline--active')
				APP.NavStories.tagline.toggleClass('active')
				APP.NavStories.navStar.toggleClass('active')
			});
		}
	},
	/**
	 * [_animatePageScrollTop utility wrapper for smoothscrolling]
	 * @param  {float} val the value to scroll to (in pixels)
	 */
	_animatePageScrollTop : function(val){
		// set isAnimating
		APP.NavStories.isAnimating = true;
		// animate scrolling
		$('html, body').animate({
			scrollTop : val,
		}, 400, '', function(){
			// update isAnimating
			APP.NavStories.isAnimating = false;
			// so scrollLoadHandler fires - trigger a scroll event on the window
			$(window).trigger('scroll');
		});
	},
	/**
	 * [_itemClickHandler handles what happens when clicking on an stories--nav item]
	 * @param  {obj} e event object
	 */
	_itemClickHandler : function(e){
		if ( typeof e.target.href !== 'undefined' && APP.NavStories._isValidURL( e.target.href ) ) {
			return true;
		}
		// prevent normal clicking on anchor tag
		e.preventDefault();
		// catch the error && bail if there's no module with that hash as an id
		if( $(e.target.hash).offset() == undefined ){
			console.error("There's no module with " + e.target.hash + " as an id...\nMake sure you build your modules with the same IDs you have in your inpage nav or the inpage nav will not work correctly!");
			return false;
		}
		// scroll to the section
		APP.NavStories._animatePageScrollTop( $(e.target.hash).offset().top - APP.NavStories.container.outerHeight() );
		// update the hash
		window.history.replaceState(null,null,e.target.attributes.href.nodeValue);
		// if the section is an accordionrow
		if( $(e.target.hash).hasClass('accordionmodule-row') ){
			// get row in AccordionHandler
			// 
			// loop through accordion rows
			APP.AccordionHandler.accordionRows.forEach(function(ar, index){
				// if the click target's hash is the same as the accordion rows hash (with a hash in front of it) and the accordion row is not open
				if( '#' + ar.hash == e.target.hash && ar.isOpen == false ){
					// run the click handler for the accordion row
					// also fake event object's target atribute :D
					ar._headerClickHandler({
						target : ar.header
					});
				}
			});
		}
	},
	/**
	 * [_backToTopClickHandler scrolls the page back to the top]
	 * @param  {obj} e event object
	 */
	_backToTopClickHandler : function(e){
		e.preventDefault();
		// scroll to the top
		APP.NavStories._animatePageScrollTop(0);
	},
	/**
	 * [_hasMadeContact if bottom of main nav has connected with the dummy (placed directly at the bottom of the stories--nav)]
	 * @return {Boolean}
	 */
	_getContact : function(){
		if( APP.data.SetupTheme.enable_ticker ){
			return $(window).scrollTop() >= APP.NavStories.dummy.offset().top;	
		}
		else{
			return $(window).scrollTop() + APP.NavStories.mainNav.outerHeight() >= APP.NavStories.dummy.offset().top + APP.NavStories.dummy.outerHeight();
		}
	},
	/**
	 * [_scrollLoadHandler controls how stories--nav is displayed based on where the scroll is on the page]
	 * @param  {obj} e event object
	 */
	_scrollLoadHandler : function(e) {
        APP.NavStories.navActivePosition = 25
        // console.log( 'scroll Y ' + window.scrollY )

        if ( APP.Breakpoint._is('==', 'xsmall' ) ) {

        }
        else if ( APP.Breakpoint._is('==', 'small' ) ) {

        }
        else if ( APP.Breakpoint._is('==', 'medium' ) ) {

        }
        else if ( APP.Breakpoint._is('==', 'large' ) ) {
            APP.NavStories.navActivePosition = 50
        }
        else if ( APP.Breakpoint._is('==', 'xlarge' ) ) {

        }
        else if ( APP.Breakpoint._is('==', 'xxlarge' ) ) {

        }
        else if ( APP.Breakpoint._is('==', 'xxlarge' ) ) {

        }

        // if we're at a screen thats greater than or equal to the medium breakpoint and we're not already sliding
		if( APP.Breakpoint._is('>=', 'medium') && APP.NavStories.isSliding == false ) {
            // Find top of page
            if ( window.scrollY > APP.NavStories.navActivePosition && APP.NavStories.isOpen == false ) {
                APP.NavStories._open();
            }
            else if ( window.scrollY <= APP.NavStories.navActivePosition && APP.NavStories.isOpen == true ) {
			    APP.NavStories._close();
            }
			// // if we need to open
			// if( APP.NavStories._getContact() == true && APP.NavStories.isOpen == false ){
			// 	APP.NavStories._open();
			// }
			// // if we need to close
			// else if( APP.NavStories._getContact() == false && APP.NavStories.isOpen == true ){
			// 	APP.NavStories._close();
			// }
		}
		// handle navitem active class placement
		// if( typeof APP.NavStories.sections !== 'undefined' ){
		// 	// inASection is used to determine if we're actually in a section with an id
		// 	var inASection = false;
		// 	// loop over the sections
		// 	$.each(APP.NavStories.sections, function(index, el){
		// 		// check if el is the right kinda object
		// 		if( el.offset() !== undefined ){
		// 			// are we (the top of the window + the height of the inpage nav) in a section and is the nav not animating?
		// 			if(
		// 				$(window).scrollTop() + APP.NavStories.container.outerHeight() >= el.offset().top &&
		// 				$(window).scrollTop() + APP.NavStories.container.outerHeight() < el.offset().top + el.outerHeight() &&
		// 				APP.NavStories.isAnimating == false
		// 			){
		// 				// we're in a section!
		// 				inASection = true;
		// 				// update active class
		// 				APP.NavStories._updateActiveItem(index);
		// 			}
		// 		}
		// 	});
			// if we're not in a section then remove all active classes on the items
			// if ( !inASection ){
			// 	APP.NavStories.items.removeClass('stories--nav-bottom-items-item--active');
			// }
		// }
	},
	/**
	 * [_updateActiveItem updates active item's class so it turns red]
	 * @param  {int} index the position of the navitem in the array of nav items
	 */
	_updateActiveItem : function(index){
		index++;
		$('.stories--nav-bottom-items-item:nth-child(' + index + ')').addClass('stories--nav-bottom-items-item--active');
		$('.stories--nav-bottom-items-item:not(:nth-child(' + index + '))').removeClass('stories--nav-bottom-items-item--active');
	},
	/**
	 * [_open opens the inpage nav & slides up the main nav]
	 */
	_open : function(){
		// start sliding
		APP.NavStories.isSliding = true;
		// is the main nav ticker enabled?
		if( APP.data.SetupTheme.enable_ticker ){
			// make the dummy fill the vertical gap by using the height from the mainNav
			// APP.NavStories.dummy.height(APP.NavStories.mainNav.outerHeight());
		}
		else{
			// make the dummy fill the vertical gap by using the height from the container
			// APP.NavStories.dummy.height(APP.NavStories.container.outerHeight());
		}
        // add css animation classes
		// APP.NavStories.mainNav.addClass('mainnav--slideup');
        APP.NavStories.container.addClass('stories--nav--active');
        APP.NavStories.afterHR.addClass('stories--nav--active');
        $('body').addClass('stories--nav--active');

		// end sliding after css animations
		setTimeout(function(){
			APP.NavStories.isSliding = false;
		}, 400 );
		// inpage is open
		APP.NavStories.isOpen = true;
	},
	/**
	 * [_close closes the inpage nav & slides down the main nav]
	 */
	_close : function(){
		// start sliding
		APP.NavStories.isSliding = true;
        // remove css animation classes
		//APP.NavStories.mainNav.removeClass('mainnav--slideup');
        APP.NavStories.container.removeClass('stories--nav--active');
        APP.NavStories.afterHR.removeClass('stories--nav--active');
        $('body').removeClass('stories--nav--active');

		// end sliding after css animations
		setTimeout(function(){
			APP.NavStories.isSliding = false;
		}, 400);
		// make the dummy close the vertical gap
		//APP.NavStories.dummy.height(0);
		// inpage is not open
		APP.NavStories.isOpen = false;
	},
	_isValidURL : function( string ) {
		let url = null;
		try {
			url = new URL( string );
		}
		catch ( error ) {
			const pattern = new RegExp('^(https?:\\/\\/)?'+ // protocol
            '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.?)+[a-z]{2,}|'+ // domain name
            '((\\d{1,3}\\.){3}\\d{1,3}))'+ // ip (v4) address
            '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*'+ //port
            '(\\?[;&amp;a-z\\d%_.~+=-]*)?'+ // query string
            '(\\#[-a-z\\d_]*)?$','i');
            url = pattern.test( string );
		}
		return url && window.location + string !== url.href ? url : false;
	 }
}
APP.NavStories._init();
APP.ModalNotice = {
	/**
	 * [modal notice modal]
	 * @type {jQuery obj}
	 */
	modal : $( '#modal-notice' ),
	/**
	 * [modalClose close the modal button]
	 * @type {jQuery obj}
	 */
	modalClose : $( '.modal-notice-close' ),
	/**
	 * [isOpen is the modal open or not]
	 * @type {Boolean}
	 */
	isOpen : false,
	/**
	 * [_init entry point]
	 */
	_init : function(){
        // do we have a button?
		if ( APP.ModalNotice.modal.length > 0 ) {
			// listen for click event on the UI
            APP.ModalNotice._toggleModalHandler()
            APP.ModalNotice.modalClose.on( 'click', APP.ModalNotice._toggleModalHandler )
		}
	},
	/**
	 * [_toggleModalHandler
	 */
	_toggleModalHandler : function() {
        // console.log( APP.ModalNotice.modal )
		// prevent the default button click behavior
		// toggle the modal
		APP.ModalNotice.modal.toggleClass( 'modal-notice--active' )
		// is modal open?
		if ( APP.ModalNotice.modal.hasClass( 'modal-notice--active' ) ) {
			// set isOpen to true
			APP.ModalNotice.isOpen = true
		}
		else {
			// set isOpen to false
			APP.ModalNotice.isOpen = false
		}
	}
}
APP.ModalNotice._init()
/**
 * [NavigationBlock handles the single container resizing stuff]
 * @type {Object}
 */
APP.NavigationBlock = {
	navigationBlockElement : $('.navigationblock'),
	navigationBlockContainer : null,
	navigationBlockLinks : null,
	navigationBlockLinksContainer : null,
	/**
	 * [singleContainer the container of the navigation block single]
	 * @type {jQuery obj}
	 */
	singleContainer : $('.navigationblock-wrapper-singlecontainer'),
	/**
	 * [_init entry point]
	 */
	_init : () => {
		// if navigationBlockContainer not found, return
		if ( APP.NavigationBlock.navigationBlockElement.length === 0 ) {
			return
		}
		APP.NavigationBlock.navigationBlockContainer = document.querySelector('.navigationblock-wrapper')
		APP.NavigationBlock.navigationBlockLinks = document.querySelectorAll('a.navigationblock-wrapper-links-link')
		APP.NavigationBlock.navigationBlockLinksContainer = document.querySelectorAll('li.navigationblock-wrapper-links-link')
		// call the hover handler
		APP.NavigationBlock._hoverHandler()
		// call the click handler
		//APP.NavigationBlock._clickHandler()
		// if we got a single container?
		if ( APP.NavigationBlock.singleContainer.length > 0 ) {
			// set text and image containers
			APP.NavigationBlock.singleTextContainer = $('.navigationblock-wrapper-singlecontainer-text')
			APP.NavigationBlock.singleImageContainer = $('.navigationblock-wrapper-singlecontainer-image')
		}
		// listen for resize load events
		$(window).on('resize load', APP.NavigationBlock._resizeLoadHandler )
	},
	_clickHandler : () => {
		// Listen for clicks/taps within either of the following 2 elements `div.navigationblock-wrapper-singlecontainer` or `li.navigationblock-wrapper-links-link`. If clicked/tapped, follow the link that is a child/sibling of the clicked/tapped element. Obviously, if the clicked/tapped element is a link, follow that link.
		//document.addEventListener( 'click', event => {
		//	let container = event.target.closest('.navigationblock-wrapper-singlecontainer, .navigationblock-wrapper-links-link')
		//	if ( container ) {
		//	  let link = event.target.closest('a') || container.querySelector('a')
		//	  if ( link ) {
		//		event.preventDefault()
		//		window.location.href = link.href
		//	  }
		//	}
		//})
	},
	_hoverHandler : () => {
		// Listen for mouseenter/mouseleave events on the `APP.NavigationBlock.navigationBlockLinksContainer element. 
		// When the mouse enters the element, add the class `has--hover` to the element. 
		// When the mouse leaves the element, remove the class `has--hover` from the element.
		APP.NavigationBlock.navigationBlockLinksContainer.forEach( container => {
			container.addEventListener('mouseenter', function() {
				this.classList.add('has--hover')
			})
			container.addEventListener('mouseleave', function() {
				this.classList.remove('has--hover')
			})
		})
	},
	/**
	 * [_resizeLoadHandler resizes the single container navigation block]
	 */
	_resizeLoadHandler : () => {
		if ( APP.NavigationBlock.singleContainer.length > 0 ){
			// use the breakpoint module to determine if we're at a breakpoint greater than medium
			if ( APP.Breakpoint._is('>=', 'medium') ){
				// get the text height
				var textHeight = APP.NavigationBlock.singleTextContainer.outerHeight(true);
				// set the image container to the text height
				// APP.NavigationBlock.singleImageContainer.css('height', textHeight);
			}
			// if we're below the medium breakpoint
			else {
				// remove the height inline css prop
				// APP.NavigationBlock.singleImageContainer.css('height', '');
			}
		}


	}
}
// call the entry point
APP.NavigationBlock._init()
APP.NewsletterSignup = {
	/**
	 * [footerButton the button in the footer]
	 * @type {jQuery obj}
	 */
	footerButton : $('#cta-social-newsletter .ctamodule-wrapper-buttoncontainer > a'),
	/**
	 * [modal newsletter signup modal]
	 * @type {jQuery obj}
	 */
	modal : $('.newslettersignup'),
	/**
	 * [modalClose close the modal button]
	 * @type {jQuery obj}
	 */
	modalClose : $('.newslettersignup-close'),
	/**
	 * [submitButton the Submit button on the form]
	 * @type {jQuery obj}
	 */
	submitButton : $('.newslettersignup-form-submit'),
	/**
	 * [isOpen is the modal open or not]
	 * @type {Boolean}
	 */
	isOpen : false,
	/**
	 * [_init entry point]
	 */
	_init : function(){
		// do we have a button?
		if( APP.NewsletterSignup.footerButton.length > 0 ){
			// listen for click event on the UI
			APP.NewsletterSignup.footerButton.on('click', APP.NewsletterSignup._toggleModalHandler);
			APP.NewsletterSignup.modalClose.on('click', APP.NewsletterSignup._toggleModalHandler);
			APP.NewsletterSignup.submitButton.on('click', APP.NewsletterSignup._submitButtonHandler);
		}
	},
	/**
	 * [_submitButtonHandler closes the modal on submit]
	 * @param  {obj} e the event object
	 */
	_submitButtonHandler : function(e){
		// close the modal
		// using a timeout so opening in a new tab can run
		setTimeout(function(){
			APP.NewsletterSignup._toggleModalHandler(e);
		}, 200);
	},
	/**
	 * [_toggleModalHandler handles the click event on the footer button]
	 * @param  {obj} e the event object
	 */
	_toggleModalHandler : function(e){
		// prevent the default button click behavior
		e.preventDefault();
		// toggle the modal
		APP.NewsletterSignup.modal.toggleClass('newslettersignup--active');
		// is modal open?
		if( APP.NewsletterSignup.modal.hasClass('newslettersignup--active') ){
			// set isOpen to true
			APP.NewsletterSignup.isOpen = true;
		}
		else{
			// set isOpen to false
			APP.NewsletterSignup.isOpen = false;
		}
	}
}
APP.NewsletterSignup._init();
/**
 * [PubsGrid handles the seeall button the events grid fade]
 * @type {Object}
 */
APP.PubsGrid = {
	/**
	 * [seeall the see all button]
	 * @type {jQuery obj}
	 */
	seeall : $('.pubsposts-seeall'),
	/**
	 * [hiddenItems the hide class applied to the grid items]
	 * @type {jQuery obj}
	 */
	hiddenItems : $('.pubsposts-posts-post--hide'),
	/**
	 * [_init entry point]
	 */
	_init : function(){
		// do we have a see all button?
		if( APP.PubsGrid.seeall.length > 0 ){
			// if so then listen for the click event on it
			APP.PubsGrid.seeall.on('click', APP.PubsGrid._seeallClickHandler);
		}
	},
	/**
	 * [_seeallClickHandler handles the click event on the see all button]
	 */
	_seeallClickHandler : function(){
		// slide down the hidden items & fade them in too
		APP.PubsGrid.hiddenItems.slideToggle({
			progress : function(ani, now){
				APP.PubsGrid.hiddenItems.css('opacity', now);
			},
			// just to make sure it does inline block
			start : function(){
				if( $(this).is(':visible') ){		
			        $(this).css('display','inline-block');
				}
			},
		});
		// hide the button
		APP.PubsGrid.seeall.hide();
	}
};

// blast off
APP.PubsGrid._init();
APP.RRP = {
	/**
	 * [primaryview the primary view grid item]
	 * @type {jQuery obj}
	 */
	primaryview : $('.researchmaterialsgrid-wrapper-grid-item--primaryview'),
	/**
	 * [_init entry point]
	 */
	_init : function(){
		// got a primaryview?
		if( APP.RRP.primaryview.length > 0 ){
			// listen for the click
			APP.RRP.primaryview.on('click', APP.RRP._primaryviewClickHandler);
		}
		// does the hash equal a research material type slug?
		if( $.inArray(window.location.hash, ['#views-of-the-artwork', '#commentary-interviews', '#museum-files']) !== -1 ){
			// get the first row in the research materials container
			var viewsOfTheArtworkRow = $('.accordionmodule#researchmaterials > div' + window.location.hash);
			// loop through the accordion rows
			APP.AccordionHandler.accordionRows.forEach(function(el, i){
				// if the offset top of the views of the artwork row is the same as the one in the loop
				if( el.row.offset().top == viewsOfTheArtworkRow.offset().top ){
					// open that row
					el._toggleOpenClose();
				}
			});
		}
	},
	/**
	 * [_primaryviewClickHandler handles the click event for the primary view grid item]
	 * @param  {obj} e event object
	 */
	_primaryviewClickHandler : function(e){
		// prevent default link click behavior
		e.preventDefault();
		// scroll the browser back up to the artwork image
		$('html, body').animate({
			scrollTop : $('#artworkimage').offset().top,
		});
	}
};

APP.RRP._init();
APP.Share = {
    shareLinks : document.querySelectorAll('.share--links-link, .share--links-copylink'),
    elements : [],
    controls : [],
	_init : function() {
        let shareLink
        for( let i = 0; i < APP.Share.shareLinks.length; i++ ) {
            shareLink = APP.Share.shareLinks[i]
            APP.Share.elements[i] = {
                element : shareLink,
                _confirm : shareLink.getAttribute( 'data-click-confirm' ) != '' ? shareLink.getAttribute( 'data-click-confirm' ) : false,
            }
        }

        if (!document.getElementById('share-status')){
            const sr = document.createElement('div');
            sr.id            = 'share-status';
            sr.className     = 'screen-reader-text';
            sr.role          = 'status';
            sr.ariaLive      = 'polite';
            sr.ariaAtomic    = 'true';
            document.body.appendChild(sr);
        }
        APP.Share._addEventListeners( )
    },
    _addEventListeners : ( ) => {const links = document.querySelectorAll('.share--links-link, .share--links-copylink');

    links.forEach(listener => {
      APP.Share.controls.push(listener);
      const target = listener.dataset.shareTarget;

      listener.addEventListener('click', e => {
        e.preventDefault();

        if (target === 'internal') {
          const copy   = listener.dataset.shareUrl
          const status = document.getElementById('share-status')

          navigator.clipboard.writeText(copy).then(() => {
            // Screen-reader announcement
            status.textContent = listener.dataset.clickConfirm
            // Visual feedback
            $('.share--links-control').text(listener.dataset.clickConfirm)

          }, () => console.warn('Clipboard write failed'))
        } else {
          window.open(listener.href, '_blank', 'noopener').focus()
        }
        return false;
      })
    })
  },
}
APP.Share._init()
APP.showHide = {
	element : $('.single-column-content .button' ),
    elements : [],
    controls : [],
	_init : function() {
        const showSections = document.querySelectorAll( '.animate--show-hide' )
        let showHide;
        for( let i = 0; i < showSections.length; i++ ) {
            showHide = showSections[i]
            const collapsedHeight = 0
            APP.showHide.elements[i] = {
                element : showHide,
                _showing : showHide.getAttribute( 'data-hidden' ) === 'true' ? true : false,
            }
        }
        APP.showHide._addEventListeners( )
    },
    _addEventListeners : ( ) => {
        // Add click to the show and hide controls
        const controls = document.querySelectorAll( '.controls--show-hide' )
        controls.forEach( ( listener ) => {
            APP.showHide.controls.push( listener )
            const dataTarget = listener.getAttribute( 'data-show-target' )
            listener.addEventListener( 'click', function(e) {
                if ( dataTarget ) {
                    const target = document.querySelector( dataTarget )
                    const result = APP.showHide.toggle( false, target, listener )
                }
                else {
                    APP.showHide.elements.forEach( ( section, i ) => {
                        APP.showHide.toggle( i )
                    })
                }
            })
        })
    },
    toggle : ( index = 0, target = null, control = null ) => {
        if ( target === null && 0 === APP.showHide.elements.length ) {
            return
        }
        const element = target !== null ? target : APP.showHide.elements[index].element
        if ( typeof element === 'undefined' ) {
            // console.log( 'show/hide element is undefined' )
            return
        }
        const dataStateHidden = element.getAttribute( 'data-hidden' )
        if ( dataStateHidden === 'false' || element._showing ) {
            APP.showHide.hide( element )
            if ( control ) {
                control.classList.remove( 'state--expanded' )
                control.classList.add( 'state--collapsed' )
            }
            return
        }
        APP.showHide.show( element )
        if ( control ) {
            control.classList.add( 'state--expanded' )
            control.classList.remove( 'state--collapsed' )
        }
        return
    },
    hide : ( target = null ) => {
        if ( ! target._showing ) {
            return;
        }
        let element = target
        // get the height of the element's inner content, regardless of its actual size
        var sectionHeight = element.scrollHeight;
        // temporarily disable all css transitions
        var elementTransition = element.style.transition;
        element.style.transition = '';
        // on the next frame (as soon as the previous style change has taken effect),
        // explicitly set the element's height to its current pixel height, so we 
        // aren't transitioning out of 'auto'
        requestAnimationFrame( () => {
            element.style.height = sectionHeight + 'px'
            element.style.transition = elementTransition
            // on the next frame (as soon as the previous style change has taken effect),
            // have the element transition to starting height
            requestAnimationFrame( () => element.style.height = '0px' )
        })
        // mark the section as "currently collapsed"
        element.setAttribute( 'data-hidden', 'true')
        element._showing = false
        element.classList.remove( 'state--expanded')
        element.classList.add( 'state--collapsed')
    },
    show : ( target = null ) => {
        if ( target._showing ) {
            return;
        }
        let element = target
        // get the height of the element's inner content, regardless of its actual size
        // have the element transition to the height of its inner content
        element.style.height = null
        // when the next css transition finishes (which should be the one we just triggered)
        element.addEventListener( 'transitionend', function(e) {
            // remove this event listener so it only gets triggered once
            element.removeEventListener( 'transitionend', arguments.callee )
            // remove "height" from the element's inline styles, so it can return to its initial value
            element.style.height = null
        })
        // mark the section as "currently not collapsed"
        element.setAttribute( 'data-hidden', 'false' )
        element._showing = true
        element.classList.remove( 'state--collapsed')
        element.classList.add( 'state--expanded')
    },
    _handleAccessbility : ( isExpand ) => {
        var tabindexValue = isExpand ? 0 : -1; 
        //this._sectionItemTitle.setAttribute('aria-expanded', isExpand)
        //this._sectionContent.setAttribute('aria-hidden', !isExpand)
        //this._sectionContent.setAttribute('tabindex', tabindexValue)
    },
}
APP.showHide._init();
APP.Scroll = {
    lastScrollTop : 0,
	/**
	 * [_init entry point]
	 */
	_init : function(){
        $(window).on('scroll', APP.Scroll._scrollLoadHandler )
    },
    /**
	 * [_scrollLoadHandler handle scrolling ]
	 * @param  {obj} e event object
	 */
	_scrollLoadHandler : function(e) {
        clearTimeout($.data(this, 'scrollTimer'))
        const st = window.pageYOffset || document.documentElement.scrollTop
        if ( st > APP.Scroll.lastScrollTop ) {
            // downscroll code
            $('body').removeClass('scroll--up')
            $('body').addClass('scroll--down')
         } 
         else {
            // upscroll code
            $('body').removeClass('scroll--down')
            $('body').addClass('scroll--up')
         }
         APP.Scroll.lastScrollTop = st <= 0 ? 0 : st
         $.data(this, 'scrollTimer', setTimeout(function() {
            $('body').removeClass('scroll--up')
            $('body').removeClass('scroll--down')
        }, 150))

        if ( st > 0 ) {
			$('body').addClass('has-scrolled')
		}
		else {
			$('body').removeClass('has-scrolled')
		}
    }
}
APP.Scroll._init()
APP.EssayCitations = {
	citableParagraphs : $('.citable .wysiwygmodule-content p, .citable .imagewithtext-content-text p'),
	createCitationButton : $('#create-citation'),
	modalWindow : $('.essaysinglearticle-modal'),
	modalCard : $('.essaysinglearticle-modal-dialogbox'),
	modalCardButton : $('#copytoclipboard'),
	modalCardTextbox : $('#citationbox'),
	citableContentWrapper : $('.citable'),
	closeModalIcon : $('#close-modal'),
	startEndParagraphs : [],
	buttonString : '',
	selectText : '',
	urlLabel : '',
	_init : function() {
		const { __, _x, _n, _nx } = wp.i18n;
		APP.EssayCitations.buttonString =`<button>${__( 'Create Citation', 'sfmomawp')}</button>`
		APP.EssayCitations.urlLabel = __( 'URL', 'sfmomawp' )
		APP.EssayCitations.selectText = __( 'Manually select the text above and press CTRL + C to copy', 'sfmomawp' )
		APP.EssayCitations.closeModalIcon.on('click', APP.EssayCitations._doCloseModal);
		APP.EssayCitations.citableParagraphs.on('mousedown mouseup', APP.EssayCitations._renderCitationButton);
		// doesn't seem like anythings goin on w this
		// APP.EssayCitations.citableParagraphs.on('mouseup', APP.EssayCitations._checkForSelection);

		// close the modal window if clicked on the background
		APP.EssayCitations.modalWindow.on('click', APP.EssayCitations._doCloseModal);
		// delegate click event to catch clicks on the dynamically generated #create-citation button
		$(document).on( 'click', '#create-citation', APP.EssayCitations._doOpenModal);
		// remove the button on click 'anywhere'
		$(document).on('mouseup', function(e) {
			if ( window.getSelection().toString().length == 0 ) {
				$('#create-citation').remove();
			}
		});
		// Other Stuff:
		var clipboard = new ClipboardJS( APP.EssayCitations.modalCardButton.selector );
		// leaving some commented out 'helpers' here just in case; but I dont want the log flooded generally
		clipboard.on('success', function(e){ e.clearSelection(); });
		clipboard.on('error', function(e){ }); 
	},
	/**
	 * On click the Create Citation Button, open the Modal
	 * @param  {[type]} e [description]
	 * @return {[type]}   [description]
	 */
	_doOpenModal : function(e){
		APP.EssayCitations.modalWindow.addClass('showCitationModal');
	},
	/**
	 * On Click outside the Modal Window close it
	 * @param  {object} e event
	 */
	_doCloseModal : function(e){
		if( e.target === APP.EssayCitations.modalWindow[0] || e.target === APP.EssayCitations.closeModalIcon[0])  {
			e.stopPropagation();
			APP.EssayCitations.modalWindow.removeClass('showCitationModal');
			// remove clipped text?
		}
	},
	/**
	 * On Click Anywhere outside the Citable Paragraphs, remove the 'create citation' button
	 * @param  {object} e event
	 */
	_removeCitationButton : function(e){
		var container = $( "div.text" );
		if ( ! container.is( e.target ) && container.has( e.target ).length === 0 ) {
			$('#create-citation').remove();
		}
	},
	/**
	 * On Click the Citable Paragraphs, Render the "Create Citation" Button
	 * @param  {object} e event
	 */
	_renderCitationButton : function(e){
		// bail if the clicked element is a button or a element
		if(event.target.nodeName == 'BUTTON' || event.target.nodeName == 'A') {
			return;
		}
		// clear startEndParagraphs
		APP.EssayCitations.startEndParagraphs = [];
		// give selected el a citation selected class
		$(this).addClass('citation-selected');
		// if we're at the start of the selection making
		if( e.type == 'mousedown' ){
			// put the starting paragraph in the array
			APP.EssayCitations.startEndParagraphs.push( e.target );
		}
		else if(e.type == 'mouseup'){
			// put the ending paragraph in the array
			APP.EssayCitations.startEndParagraphs.push( e.target );
			// remove dupes
			APP.EssayCitations.startEndParagraphs = APP.EssayCitations.startEndParagraphs.filter(function(value, index, self){
				return self.indexOf(value) === index;
			});
			let buttonString = APP.EssayCitations.buttonString
			// Clear away possible existing create citation button
			$('#create-citation').remove();
			// build citation button's html
			var citation_button = $(buttonString).addClass('btn pill-button citation-button').attr({
				'id': "create-citation",
				"data-toggle": "modal",
				"data-target": "#citation-modal"
			});
			// init median vars
			var mx = 0;
			var my = 0;

			// get median Y of startEndParagraphs
			if( APP.EssayCitations.startEndParagraphs.length == 1 ){
				my = e.pageY - $('.essaysinglearticle-content.citable').offset().top;
				mx = $(APP.EssayCitations.startEndParagraphs[0]).outerWidth() + 100;
			}

			citation_button.css({
				position: "absolute",
				top: my,
				left: mx,
			});

			// Render new create citation button
			$('.essaysinglearticle-content.citable').append(citation_button);
			// $('.essaysinglearticle-content.citable').append('dooo');
		}
	},
	// _checkForSelection : function(e){
	// 	// setup modal contents
	// 	var citation_text = APP.EssayCitations._copyNodeHandler();
	// 	var p_number = $('p.citation-selected span.paragraph-anchor').data('para-number');
	// 	// APP.EssayCitations._setupCiteas(citation_text, p_number);
	// },
	_setupCiteas : function(){
		var cite_as = $('.modal-citation-cite-as').html().replace(/(\r\n|\n|\r)/gm,"").replace(/\t+/g, " ")
		var source_url = 'https://' + window.location.hostname + window.location.pathname
		var url_label = APP.EssayCitations.urlLabel
		var select_text = APP.EssayCitations.selectText

		//chaining .empty().append() doesn't want to cooperate, so let's empty them here
		$('#citeable-copy').find('.modal-citation-selection').empty();
		$('.essaysinglearticle-modal-dialogbox').find('.modal-citation-source-url').empty();
		$('.essaysinglearticle-modal-dialogbox').find('.modal-citation-cite-as').empty();

		//remove tabs preceeding '<' to remove indentation once copied/pasted
		var citation_no_tabs = $('modal-citation-cite-as').html().replace(/[\t ]+\</g, "<");
		$('#citation-content').html(citation_no_tabs);

		$('.essaysinglearticle-modal-dialogbox').find('.modal-citation-selection').html('<p>' + citation_text + '</p>\n');
		$('.essaysinglearticle-modal-dialogbox').find('.modal-citation-source-url').html('<p>' + url_label + ': ' + source_url + '</p>\n');
		$('.essaysinglearticle-modal-dialogbox').find('.modal-citation-cite-as').html('<p>' + cite_as + ' ' + __('Paragraph', 'sfmomawp' ) + ': ' + p_number + '.</p>');

		if (GetIEVersion() == 11 ) {
			$('#copy-to-clipboard').hide();
			if(!$('.essaysinglearticle-modal-dialogbox .modal-footer p.brand-color-text').length){
				$('.essaysinglearticle-modal-dialogbox .modal-footer').append('<p class="brand-color-text">' + select_text + '</p>');
			}
		}
	},
	_copyNodeHandler : function(){
		var copyNode = document.createElement('SPAN');
		if (window.getSelection && window.getSelection().getRangeAt) {
			var tmpText = window.getSelection().getRangeAt(0).cloneContents();
			copyNode.appendChild(tmpText);
		} else if (document.selection && document.selection.createRange) {
			copyNode.innerHTML = document.selection.createRange().htmlText;
		}
		//remove unwanted elements
		$(copyNode).find('sup, .paragraph-anchor, .citation-button, figure, div').remove();
		if (copyNode.innerHTML.indexOf('<p>') == -1) {
			copyNode.innerHTML = '<p>' + copyNode.innerHTML + '</p>';
		}

		$(copyNode).text().replace(/\s+/g, ' ');
		return copyNode.innerHTML;
	},
};
// Disable essay citations
//APP.EssayCitations._init();

APP.Essays = {
	/**
	 * Init Single Essays Functionality
	 */
	_init : function(){
		if ( $('body').hasClass('single-essays') ) {
			$(window).on('load', APP.Essays.footnotes._init);
			$(window).on('load', APP.Essays.paragraphs._init);
			$(window).on('load', APP.Essays.images._init);
		}
	},
	/**
	 * Do things related to the Paragraphs
	 */
	paragraphs : {
		wrappers : $(".essaysinglearticle-content .wysiwygmodule-content > p"),
		/**
		 * [suplinks the footnote links inside the paragraphs]
		 * @type {jQuery obj}	
		 */
		suplinks : $(".essaysinglearticle-content .wysiwygmodule-content sup a"),
		/**
		 * [_init entry point]
		 */
		selectableSelectors : [
			'.citable .wysiwygmodule-content > p',
			'.citable .imagewithtext-content-text p',
		],
		_init : function(){
			/**
			 * Filter & Select for 'countable' paragraphs in the post_content
			 * Dodge empty paragraphs, dodge specific improperly wrapped paragraphs
			 * @type {String} "jquery selector"
			 */
			//var selectableSelector = '.citable p:not(.citable blockquote p, .citable li p, .citable figcaption p, .after-blockquote, .imagewithtext-content-imagecontainer-caption p)';

			/**
			 * Hook into the Supposition Links (scroll to the linked footnote)
			 */
			$(APP.Essays.paragraphs.suplinks).on('click', APP.Essays.paragraphs._scrollToFootnote);
			/**
			 * Adds an indexed counter beside each paragraph
			 */
			$(APP.Essays.paragraphs.selectableSelectors.join(', ')).filter(function( index ){
				// only return elements that meet the selectors that aren't empty and don't only have the text Notes
				return $(this).text().trim().length != 0 && $(this).text().trim() !== "Notes";
			}).each(function( i ){
				// loop through the elements and add a paragraph number
				var count = i + 1;
				// inject counters for each remaining paragraph
				$(this).prepend('<span id="p' + count + '" class="paragraph-anchor" data-para-number="' + count + '"></span>')
			});
		},
		_scrollToFootnote : function(e){
			e.preventDefault();
			var fnID = e.target.hash;
			var pageNavHeight =  $('nav.inpagenav').outerHeight();
			var navHeight = pageNavHeight;
			var mainNavHeight = $('nav.mainnav').outerHeight();
			var lineHeight = $('p').css('line-height');

			if ( pageNavHeight === null ) {
				navHeight = mainNavHeight;
			}
			else if ( mainNavHeight >= 0 ) {
				navHeight += mainNavHeight;
			}
			// Scroll-Into-View the Element w/ ID equal to the footnoteID
			$('html, body').animate({
				scrollTop: $(fnID).offset().top - navHeight
			}, 500);
		}
	},
	/**
	 * Things related to Footnotes
	 * @type {Object}
	 */
	footnotes : {
		arrowUp : null,
		lineitems : $( 'ol.footnotes > li' ),

		_init : () => {
			APP.Essays.footnotes._setIDs()
			$( APP.Essays.footnotes.lineitems ).append( '<a class="sficon-arrow-up sficon"></a>' )
			APP.Essays.footnotes.arrowUp = $('.footnotes li .sficon')
			// Once 'arrow-up' are set; bind event handler
			$(APP.Essays.footnotes.arrowUp).on('click', APP.Essays.footnotes._scrollBackToAnchor)
		},
		_scrollBackToAnchor : (e) => {
			var pageNavHeight = $('nav.inpagenav').outerHeight();
			var navHeight = pageNavHeight;
			var mainNavHeight = $('nav.mainnav').outerHeight();
			var lineHeight = $('p').css('line-height');
			if ( pageNavHeight === null ) {
				navHeight = mainNavHeight;
			}
			else if ( mainNavHeight >= 0 ) {
				navHeight += mainNavHeight;
			}
			lineHeight = Math.floor( parseInt( lineHeight, 10 ) * .35 );
			navHeight = navHeight + lineHeight;

			// Get the 'fnid'
			var fnID = e.target.offsetParent.id;

			// Scroll-Into-View the Element w/ ID equal to the footnoteID
			$('html, body').animate({
				scrollTop: $('a[href="#'+fnID+'"]').offset().top - navHeight
			}, 500);
		},
		_setIDs : function() {
			APP.Essays.footnotes.lineitems.each(function(index){
				var index = index + 1;
				$(this).attr('id', "fn-" + index );
			});
		},
	},
	/**
	 * Printing images
	 * @type {Object}
	 */
	images : {
		captions : $('.genericimage-caption, .imagewithtext-content-imagecontainer-caption, .imagetwoup-wrapper-captions-caption, .essaysingleheader-figure-caption'),
		footnotes : $('ol.footnotes'),
		imageHeader : '<div class="visible-print-block"><h3 class="image-captions">Images</h3><ul id="image-captions"></ol></div>',
		_init : function(){
			// Show an header for the image list.
			// APP.Essays.images.footnotes.after( APP.Essays.images.imageHeader );
			const imageCaptionList = document.getElementById('image-captions');
			const re = /(<i\b[^>]*>)([^<>]*)(<\/i>)/i;
			let imgagesToPrint = [];
			let img = [];
			let twoUpAdded = false;

			for ( let i = 0; i < APP.Essays.images.captions.length; i++ ) {
				let caption = typeof( $( APP.Essays.images.captions[ i ] ).children().get(0) ) !== 'undefined' && 'P' === $( APP.Essays.images.captions[ i ] ).children().get(0).tagName
								? $( APP.Essays.images.captions[ i ] ).children().get(0)
								: APP.Essays.images.captions[ i ],
				parent = $( caption ).hasClass('imagewithtext-content-imagecontainer-caption' ) 
								? $( caption )
								: $( caption ).parent(),
				grandparent = $( parent ).parent(),
				greatGrandparent = $( grandparent ).parent(),
				li = document.createElement( 'li' ),
				captionText = caption.innerHTML,
				strippedText = captionText.replace( re, '$2' ),
				values, alignment, type;

				if ( $( parent ).hasClass( 'essaysingleheader-figure' ) ) {
					type = 'header-figure';
					img[0] = $( parent ).find( '>:first-child' );
					values = {
						'container' : grandparent,
						'caption' : captionText,
						'text' : strippedText,
						'img' : img[0],
						'shadow' : img[0].clone(),
						'alignment' : 'right',
					};
				}
				else if ( $( parent ).hasClass( 'imagewithtext-content-imagecontainer-caption' ) ) {
					type = 'imagewithtext';
					img[0] = $( parent ).prev();
					alignment = grandparent.attr( 'class' )
										   .indexOf( 'alignright' ) !== -1 ? 'right' : 'left';
					values = {
						'container' : greatGrandparent.parent(),
						'caption' : captionText,
						'text' : strippedText,
						'img' : img[0],
						'shadow' : img[0].clone(),
						'alignment' : alignment
					};
				}
				else if ( $( parent ).is( 'figure' ) ||  $( parent ).parent().is( 'figure' ) ) {
					type = 'figure';
					img[0] = $( parent ).parent().is( 'figure' ) ? $( parent ).parent().find( '>:first-child' ) : $( parent ).find( '>:first-child' );
					values = {
						'container' : grandparent.parent(),
						'caption' : captionText,
						'text' : strippedText,
						'img' : img[0],
						'shadow' : img[0].clone(),
						'alignment' : 'center',
					};
				}
				else if ( $( parent ).hasClass( 'imagetwoup-wrapper-captions' ) ) {
					type = 'imagetwoup';
					const key = i + 1;
					let captionTwo = $( APP.Essays.images.captions[ key ] );
					let captionTwoText = captionTwo.length > 0 ? captionTwo.get(0).innerHTML : '';

					if ( typeof imgagesToPrint[type] === 'undefined' ) {
						img[0] = $( parent ).prev().find( 'img' ).eq(0);
						img[1] = $( parent ).prev().find( 'img' ).eq(1);
					}
					else {
						img[0] = $( parent ).prev().find( 'img' ).eq(1);
						img[1] = $( parent ).prev().find( 'img' ).eq(0);
					}
					values = [
						{
							'container' : greatGrandparent,
							'caption' : captionText,
							'text' : strippedText,
							'img' : img[0],
							'shadow' : img[0].clone(),
							'alignment' : 'left'
						},
						{
							'container' : greatGrandparent,
							'caption' : captionTwoText,
							'text' : captionTwoText.replace( re, '$2' ),
							'img' : img[1],
							'shadow' : img[1].clone(),
							'alignment' : 'right'
						}
					];
				}
				else {
					type = '__type__'
					values = {
						'container' : grandparent,
						'caption' : captionText,
						'text' : strippedText, 
						'img' : '',
						'shadow' : '',
						'alignment' : 'center',
					};
				}
				// if ( 'undefined' === typeof type ) {
				// }
				if ( 'undefined' === typeof imgagesToPrint[type] ) {
					imgagesToPrint[type] = [];
				}

				if ( values.img !== '' || ( Object.prototype.toString.call( values ) == '[object Array]' && values[0] !== '' ) ) {
					imgagesToPrint[type].push( values );
					li.appendChild( document.createTextNode( strippedText + ' : ' ) );
					let aTag = document.createElement('a');
					let shadowImageContainer = '<div class="';
					if ( Object.prototype.toString.call( values ) == '[object Array]' ) {
						imgSrc = values[0].img[0].src;
						shadowImageContainer += 'print-image two-up"><div><img src="' + values[0].img[0].src + '" /><div class="print-caption">' + values[0].caption + '</div></div>';
						shadowImageContainer += '<div><img src="' + values[1].img[0].src + '" /><div class="print-caption">' + values[1].caption + '</div></div>';
						values.container = values[0].container;
					}
					else {
						imgSrc = values.img[0].src;
						if ( 'imagewithtext' === type ) {
							shadowImageContainer += 'inline ';
						}
						shadowImageContainer += 'print-image"><div><img src="' + imgSrc + '" /><div class="print-caption">' + values.caption + '</div></div>';
					}
					shadowImageContainer += '</div>';
					aTag.setAttribute('href', imgSrc );
					aTag.innerText = imgSrc;
					li.appendChild( aTag );
					//imageCaptionList.appendChild( li );

					// Add a copy of an image for print only
					if ( 'right' === values.alignment ) {
						$( values.container ).after( shadowImageContainer );
						$( values.container ).addClass('print-processed');
					}
					else if ( 'left' === values.alignment || 'center' === values.alignment  ) {
						$( values.container ).before( shadowImageContainer  );
						$( values.container ).addClass('print-processed');
					}
					else if ( 'imagetwoup' === type ) {
						if ( ! twoUpAdded ) {
							$( values.container ).before( shadowImageContainer );
							twoUpAdded = true;
						}
					}
				}
			}
		},
	},
}
/**
 *	Initialize everything
 */
 APP.Essays._init();
/**
 * [TeacherResources for the querying and filtering of the teacher resources grid]
 * @type {Object}
 */
APP.TeacherResources = {
	/**
	 * [seemore the seemore button]
	 * @type {jQuery obj}
	 */
	seemore : $('.teacherresourcesgrid-wrapper-seemore'),
	/**
	 * [posts list of posts that have been retreived from a response but maybe not displayed]
	 * @type {array}
	 */
	posts : undefined,
	/**
	 * [grid the grid of items]
	 * @type {jQuery obj}
	 */
	grid : $('.teacherresourcesgrid-wrapper-grid'),
	/**
	 * [gridItems list of grid items that are being displayed]
	 * @type {jQuery obj}
	 */
	gridItems : $('.teacherresourcesgrid-wrapper-grid-item'),
	/**
	 * [filterButtons the filter buttons]
	 * @type {jQuery obj}
	 */
	filterButtons : $('.teacherresourcesfilter-wrapper-filter-group-button'),
	/**
	 * [activeTerms list of active term ids]
	 * @type {array}
	 */
	activeTerms : [],
	/**
	 * [titleCount the count in the title]
	 * @type {jQuery obj}
	 */
	titleCount : $('.teacherresourcesgrid-wrapper-title-count'),
	/**
	 * [titleRelation the text saying "relating to" in the title]
	 * @type {jQuery obj}
	 */
	titleRelation : $('.teacherresourcesgrid-wrapper-title-relation'),
	/**
	 * [titleTags the text that will contain the tag names in the title]
	 * @type {jQuery obj}
	 */
	titleTags : $('.teacherresourcesgrid-wrapper-title-tag'),
	/**
	 * [_init entry point]
	 */
	_init : function(){
		// we on the teacher resources page & is posts & terms stored globally on this page?
		if( $('body').hasClass('teacher-resources') && typeof posts != 'undefined' && typeof terms != 'undefined' ){
			// reassign it if it exists
			APP.TeacherResources.posts = posts;
			// listen for click events on the seemore button
			APP.TeacherResources.seemore.on('click', APP.TeacherResources._seemoreClickHandler);
			// listen for click events on the filter buttons
			APP.TeacherResources.filterButtons.on('click', APP.TeacherResources._filterButtonClickHandler);
		}
	},
	/**
	 * [_updateGridItems update the grid items obj]
	 */
	_updateGridItems : function(){
		// update the gridItems
		APP.TeacherResources.gridItems = $('.teacherresourcesgrid-wrapper-grid-item');
	},
	/**
	 * [_seemoreClickHandler handles the click event on the seemore button]
	 * @param  {obj} e the event obj
	 */
	_seemoreClickHandler : function(e){
		// probs not needed but couldn't hurt
		e.preventDefault();
		// update grid items
		APP.TeacherResources._updateGridItems();
		// test if there's more posts already queryed in the posts var
		if( APP.TeacherResources._getRemainingPosts().length > APP.TeacherResources.gridItems.length ){
			// then use the posts to populate the rest of the griditems
			// get 20 more
			APP.TeacherResources._getPostsFromActiveTerms().slice(
				APP.TeacherResources.gridItems.length - 1,
				(APP.TeacherResources.gridItems.length + 20) > APP.TeacherResources._getPostsFromActiveTerms().length ? APP.TeacherResources._getPostsFromActiveTerms().length - 1 : APP.TeacherResources.gridItems.length + 19
			).forEach(APP.TeacherResources._renderGridItem);
		}
		// maybe hide seemore?
		APP.TeacherResources._maybeHideSeemore();
	},
	_getRemainingPosts : function(){
		// update grid items
		APP.TeacherResources._updateGridItems();
		// get grid item ids
		var gridItemIds = $.map(APP.TeacherResources.gridItems, function(item){
			return item.dataset.ID;
		});
		// get the difference between posts from active terms and grid items
		return APP.TeacherResources._getPostsFromActiveTerms().filter(function(post){
			return gridItemIds.indexOf(post.ID) == -1;
		});
	},
	_maybeHideSeemore : function(){
		// update grid items
		APP.TeacherResources._updateGridItems();
		// maybe hide seemore?
		if( APP.TeacherResources._getPostsFromActiveTerms().length == APP.TeacherResources.gridItems.length ){
			APP.TeacherResources.seemore.hide();
		}
		else{
			APP.TeacherResources.seemore.show();	
		}
	},
	_filterButtonClickHandler : function(e){
		// probs not needed but w/e
		e.preventDefault();
		// apply active class
		$(e.target).toggleClass('teacherresourcesfilter-wrapper-filter-group-button--active');
		// get terms from buttons with active classes
		APP.TeacherResources.activeTerms = $.makeArray($('.teacherresourcesfilter-wrapper-filter-group-button--active').map(function(index, el){
			return el.dataset.termid;
		}));
		
		// clear all posts from the grid
		APP.TeacherResources.grid.empty();
		// render the new terms
		APP.TeacherResources._getPostsFromActiveTerms(true).forEach(APP.TeacherResources._renderGridItem);
		// maybe hide seemore?
		APP.TeacherResources._maybeHideSeemore();
	},
	/**
	 * [_getPostsFromActiveTerms returns an array of post objects that have a term in the active term array]
	 * @param {bool} limit return only the first 20 if true
	 * @return {array} array of post objects
	 */
	_getPostsFromActiveTerms : function(limit){
		// set default
		if( typeof limit == 'undefined' ){
			limit = false;
		}
		// init return array
		var tempArr = [];
		// loop through all the posts rendered by php
		APP.TeacherResources.posts.forEach(function(post){
			// are there term buttons selected?
			if( APP.TeacherResources.activeTerms.length > 0 ){
				// if the diff array between the active terms and the post terms has a length of 0 (post has all the active terms)
				if( $(APP.TeacherResources.activeTerms.map(function(at){return Number(at)})).not(post.terms).get().length == 0 ){
					// return the post
					tempArr.push(post);
				}
			}
			// there's no term buttons active
			else{
				// so return all the posts
				tempArr.push(post);
			}
		});
		// update the title count
		APP.TeacherResources.titleCount.html(tempArr.length);
		// update the title relation stuff
		if( APP.TeacherResources.activeTerms.length > 0 ){
			// show the relation
			APP.TeacherResources.titleRelation.addClass('teacherresourcesgrid-wrapper-title-relation--active');
			// init tagnames
			var tagNames = [];
			// build the tag names
			// loop through all the active terms
			APP.TeacherResources.activeTerms.forEach(function(activeTerm){
				// loop through all the terms in the 
				terms.forEach(function(term){
					if( term.term_id == Number(activeTerm) ){
						tagNames.push(term.name);
					}
				});
			});
			// build tag string
			var tagString = '';
			if( tagNames.length > 2 ){
				tagNames.forEach(function(tagName, index){
					if( index == 0 ){
						tagString += tagName;
					}
					else if( index == tagNames.length - 1 ){
						tagString += ' and ' + tagName;
					}
					else{
						tagString += ', ' + tagName;	
					}
				});
			}
			else if( tagNames.length == 2 ){
				tagString = tagNames.join(' and ');
			}
			else{
				tagString = tagNames[0];
			}
			// update the tag names
			APP.TeacherResources.titleTags.html(tagString);

		}
		else{
			APP.TeacherResources.titleTags.html('');
			APP.TeacherResources.titleRelation.removeClass('teacherresourcesgrid-wrapper-title-relation--active');
		}
		// do we have a limit?
		if( limit ){
			// only return the first 20
			tempArr = tempArr.slice(0, 20);
		}
		// return the arr
		return tempArr;
	},
	/**
	 * [_renderGridItem outputs the html of a grid item]
	 * @param  {obj} post post object
	 */
	_renderGridItem : function(post){
		// start the output html
		var outputHTML = '<a href="' + post.permalink + '" class="teacherresourcesgrid-wrapper-grid-item" data-terms="' + post.terms.join(',') + '" data-id="' + post.ID + '">';
		// build text
		outputHTML += '<div class="teacherresourcesgrid-wrapper-grid-item-text">';
		outputHTML += '<h6 class="teacherresourcesgrid-wrapper-grid-item-text-category">' + (post.post_type.substr(0,1).toUpperCase() + post.post_type.substr(1)) + '</h6>';
		outputHTML += '<h5 class="teacherresourcesgrid-wrapper-grid-item-text-title">' + post.post_title + '</h5>';
		outputHTML += '</div>';
		// build image
		if ( post.featured_image ) {
			outputHTML += '<img class="teacherresourcesgrid-wrapper-grid-item-image" src="' + post.featured_image + '">';
		}
		else {
			outputHTML += '<div class="container--image-unavailable" style="width:30%;"><div class="image--unavailable" style="min-heigth:100px;"></div></div>';
		}
		// close the link
		outputHTML += '</a>';
		// add the post
		APP.TeacherResources.grid.append(outputHTML);
	}
};

APP.TeacherResources._init();
APP.VideoSource = {
    legacy : $('.legacyhero-video'),
    videos : document.getElementsByTagName( 'video' ),
    options : {},
    /**
	 * [_init entry point]
	 */
	_init : function(){
        if ( APP.VideoSource.videos.length ) {
            for ( item of APP.VideoSource.videos ) {
                APP.VideoSource._selectVideoSource( item )
            } 
        }
    },
	/**
	 * [_selectVideoSource ]
	 */
    _selectVideoSource : function( $video ) {
        let source = $video.getAttribute('data-src') 
        // if sourece is empty and video src exists, look for src attribute intead.. if that is not there check for source tags
        if ( ! source && $video.src ) {
            source = $video.src
        }
        // if source is still empty, look for source tags
        if ( ! source && $video.querySelector('source') ) {
            source = $video.querySelector('source').src ? $video.querySelector('source').src : null
        }
        if ( ! source ) {
            return
        }
        APP.VideoSource.options = { 
            video: $video, 
            breakpoints: { 
                default: { 
                    src: source
                } 
            } 
        }

        // get a list of video switching points and links to the videos themselves 
        $video.querySelectorAll( '[data-src]' ).forEach( element => APP.VideoSource.options.breakpoints[ element.getAttribute('data-mw') ] = { src: element.getAttribute('data-src') } )
        $video.innerHTML = '' // we clean up so that there is nothing superfluous 
        APP.VideoSource.options.breakpoints.default = APP.VideoSource.options.breakpoints[1920]
        delete APP.VideoSource.options.breakpoints[null]

        // run the handler and track the change in screen width
        APP.VideoSource._responseVideo( APP.VideoSource.options )
        APP.VideoSource._resizer()
    },
    /** Function runs on resize  */
    _resizer : function() {
        window.addEventListener( "resize", () => APP.VideoSource._responseVideo( APP.VideoSource.options ) )
    },
    /** 
     * Change src value of video link to fit screen width 
     * 
     * @param {Object} options object with options 
     */
    _responseVideo :  function(options) {
        const breakpoints = options.breakpoints // get options
        let $video = options.video
        const widthNow = $video.getAttribute('data-width-now') || null
        const filteredKeys = Object.keys( breakpoints ).filter( key => key >= document.body.clientWidth )
        const maxBreakpoint = filteredKeys.length ? Math.min.apply( Math, filteredKeys ) : 'default'
        const nowBreakpoint = maxBreakpoint || 'default' // choose either the maximum value, if not, then the default 
        if ( widthNow && widthNow == nowBreakpoint) {
            return // check if the video needs to be changed 
        }
        // test if .src exists in the current breakpoint
        if ( typeof breakpoints[ nowBreakpoint ] !== 'undefined' && typeof breakpoints[ nowBreakpoint ].src !== 'undefined' ) {
            let source =  breakpoints[ nowBreakpoint ].src
            $video.setAttribute( 'data-width-now', nowBreakpoint )
            $video.src = source
        }
    }
}
APP.VideoSource._init()
APP.URLParams = {
    urlParams : {},
    currentURLParams : {},
	/**
	 * [_init entry point]
	 */
	_init : function() {
        window.onpopstate = APP.URLParams._popStateHandler
        $(document).ready( APP.URLParams._domReady )
    },
    _domReady : () => {
        APP.URLParams._popStateHandler()
        APP.URLParams.updateTicketLinks()
    },
    _get : ( index, substrKeysExclue = [] ) => {
        if ( typeof index == 'undefined' ) {
            index = 0
        }
        const filterParams = {}
        for( const key in APP.URLParams.urlParams ) {
            filterParams[ ( ! substrKeysExclue.includes( key ) ? key.substr( 1 ) : key ) ] = APP.URLParams.urlParams[ key ] [ index ]
        }
        // if the index is available, return the value, otherwise return the object
        return typeof filterParams[ index ] !== 'undefined' ? filterParams[ index ] : filterParams
    },
    /**
	 * [_popStateHandler pop the url params into an object on history changes]
	 * @param  {obj} e event object
	 */
	_popStateHandler : function() {
        let match,
            pl = /\+/g,  // Regex for replacing addition symbol with a space
            search = /([^&=]+)=?([^&]*)/g,
            searchParams = new URLSearchParams( window.location.search.substring( 1 ) ),
            decode = ( s ) => decodeURIComponent( s.replace( /\+/g, " " ) ),
            query = typeof window.location.search !== 'undefined' ? window.location.search.substring( 1 ) : ''

        while ( match = search.exec( query ) ) {
            if ( decode( match[1] ) in APP.URLParams.urlParams ) {
                if ( ! Array.isArray( APP.URLParams.urlParams[ decode( match[1] ) ] ) ) {
                    APP.URLParams.urlParams[ decode( match[1] ) ] = [ APP.URLParams.urlParams[ decode( match[1] ) ] ]
                }
                APP.URLParams.urlParams[ decode( match[1] ) ].push( decode( match[2] ) )
            } 
            else {
                APP.URLParams.urlParams[ decode( match[1] ) ] = [ decode( match[2] ) ]
            }
        }
        // also fill out the current url params
        for ( const [ key, value ] of searchParams.entries() ) {
            APP.URLParams.currentURLParams[ key ] = decode( value )
        }
    },
    encodeAndAppendQuery : (queryString, link) => {
        // URL-encode the entire query string
        const urlEncodedQuery = encodeURIComponent(queryString)
      
        // Base64-encode the URL-encoded query string with UTF-8 encoding
        const utf8ToB64 = str => btoa(unescape(encodeURIComponent(str)))
      
        const base64EncodedQuery = utf8ToB64(urlEncodedQuery)
      
        // URL-encode the Base64-encoded string to ensure it's safe for URLs
        const finalEncodedQuery = encodeURIComponent(base64EncodedQuery)
      
        // Parameter name to use for the encoded query string
        const paramName = 'q'
      
        // Parse the existing href
        const href = link.getAttribute('href')
        const [baseUrl, existingQuery] = href.split('?')
        const params = new URLSearchParams(existingQuery || '')
      
        // Append the encoded query string as a single parameter
        params.set(paramName, finalEncodedQuery)
      
        // Reconstruct the href with the new query string
        const newHref = `${baseUrl}?${params.toString()}`
      
        // Update the link's href attribute
        link.setAttribute('href', newHref)
    },
    updateTicketLinks : () => {
        // Get the current query string, excluding the leading '?'
        const currentQueryString = window.location.search.substring(1)
      
        // If there's no query string, no need to proceed
        if (!currentQueryString) return
      
        // Select all <a> elements where href contains 'tickets.sfmoma.org'
        const links = document.querySelectorAll('a[href*="tickets.sfmoma.org"]')
        // Loop through each link and process it
        links.forEach(link => {
          // Call the main function for matching links
          APP.URLParams.encodeAndAppendQuery(currentQueryString, link)
        })
    }
}
APP.URLParams._init()


	});

})( jQuery, APP, window, document );
//# sourceMappingURL=app.js.map