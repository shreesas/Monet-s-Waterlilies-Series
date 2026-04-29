(function (window, document) {
    window.APP = window.APP || {}

    APP.BallAnimation = {
        animationElements: undefined,
        animationOptions : {
            duration: 1000,
            easing: 'linear',
            fill: 'forwards'
        },
        deviceHeight: window.innerHeight,
        deviceWidth: window.innerWidth,
        lastDeviceWidth: undefined,
        lastDeviceHeight: undefined,
        _init: function () {
            this.animationElements = document.querySelectorAll('.sfmoma-animation')
            this.animationElements.forEach( function(element) {
                this.setupAnimation(element);
            }, this )
            this.lastDeviceWidth = this.deviceWidth
            this.lastDeviceHeight = this.deviceHeight
            const resizeHandler = this._throttle( this.handleResize , 200 )
            window.addEventListener('orientationchange', resizeHandler )
        },
        handleResize: function ( event ) {
            // console.log('resize/orientation event', event)
            this.deviceWidth = window.innerWidth
            this.deviceHeight = window.innerHeight
            // Only reset animations if the resize is significant (more than 50px change)
            if ( Math.abs( this.deviceWidth - this.lastDeviceWidth ) > 50 
                || Math.abs(this.deviceHeight - this.lastDeviceHeight ) > 50 ) {
                this.resetAnimations()
                this.animationElements.forEach( function (element) {
                    this.setupAnimation( element )
                }, this )
                this.lastDeviceWidth = this.deviceWidth
                this.lastDeviceHeight = this.deviceHeight
            }
        },
        resetAnimations: function () {
            this.animationElements.forEach( element => {
                const subjects = element.querySelectorAll('.sfmoma-animation--subject')
                subjects.forEach( subject => {
                    this._displayHideNone( subject )
                    subject.style.transform = 'none'
                    if ( subject.getAnimations ) {
                        subject.getAnimations().forEach( (anim) => anim.cancel() )
                    }
                })
            })
            this.animationElements.forEach( element => {
                const subjects = element.querySelectorAll('.sfmoma-animation--subject')
                subjects.forEach( subject => {
                    subject.style.transition = 'opacity 0.3s'
                    subject.style.opacity = '0'
                    subject.style.transform = 'none'
                    if (subject.getAnimations) {
                        subject.getAnimations().forEach((anim) => anim.cancel())
                    }
                    setTimeout( this._displayHideNone( subject ), 300 )
                })
            })
        },
        setupAnimation: function (element) {
            const subjects = element.querySelectorAll('.sfmoma-animation--subject')
            if (subjects.length === 0) return
            
            let lastOriginSide, animationTime, zoom
            let activeIndex = Math.floor(Math.random() * subjects.length)

            const styles = getComputedStyle(element)
            const totalCycleTime = parseFloat(styles.getPropertyValue('--total-cycle-time')) || 14
            const offScreenTime = parseFloat(styles.getPropertyValue('--off-screen-time')) || 0
            const originTopPercentage = parseFloat(styles.getPropertyValue('--origin-top-percentage')) || 20
            const rotate = parseFloat(styles.getPropertyValue('--rotate-z')) || 0
            const pointerEvents = styles.getPropertyValue('--pointer-events') || 'none'
            const pauseOnHover = styles.getPropertyValue('--pause-on-hover') || 'false'
            const skew = parseFloat(styles.getPropertyValue('--skew')) || 10
            const baselineWidth = parseInt( styles.getPropertyValue( '--baseline-width' ) ) || 1400
            const zoomReduce = parseFloat( styles.getPropertyValue( '--zoom-normalize' ) ) / 100 || 0
            const animationNormalize = parseFloat( styles.getPropertyValue( '--animation-normalize' ) ) || 1
            const data = element.dataset
            const movementSpeed = parseFloat(data.movementSpeed) || 1
            const originSides = data.origins ? data.origins.split(',') : ['left', 'right']
            const destinationSides = data.destinations ? data.destinations.split(',') : ['left', 'right', 'top']
            const defaultPaths = data.defaultPaths !== undefined ? data.defaultPaths === 'true' : true
            const linksInNewTab = data.linksInNewTab !== undefined ? data.linksInNewTab === 'true' : false
            // Normalize zoom based on device width
            zoom = parseFloat( styles.getPropertyValue('--zoom') ) / 100 || 1
            if ( zoomReduce ) {
                zoom = zoom * (1 + ( this.deviceWidth - baselineWidth ) / baselineWidth * zoomReduce)
            }
            // Normalize animation time based on device width
            animationTime = totalCycleTime - offScreenTime
            if ( animationNormalize ) {
                animationTime = animationTime + ( this.deviceWidth / baselineWidth ) * animationNormalize
            }
            // Hide all subjects
            subjects.forEach(subject => {
                subject.style.transition = 'opacity 0.3s'
                subject.style.opacity = '0'
                this._displayHideNone( subject )
            })
            // Define the animation
            const animateNext = () => {
                let pathData
                const currentSubject = subjects[activeIndex]

                if (defaultPaths) {
                    pathData = this.generatePath( currentSubject, lastOriginSide, originTopPercentage )
                } 
                else {
                    pathData = this.generateRandomPath( currentSubject, originSides, destinationSides, skew, originTopPercentage, lastOriginSide)
                }

                const { start, end, startSide, endSide } = pathData
                lastOriginSide = startSide

                currentSubject.style.display = 'block'
                currentSubject.style.visibility = 'visible'
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        currentSubject.style.opacity = '1'
                        const animation = this.animateSubject( currentSubject, element, animationTime, { start, end }, zoom, rotate, pauseOnHover)
                        currentSubject.style.pointerEvents = pointerEvents

                        if ( 'none' !== pointerEvents && element.href ) {
                            currentSubject.style.cursor = 'pointer'
                            currentSubject.onclick = event => {
                                event.preventDefault()
                                if ( linksInNewTab ) {
                                    window.open( element.href, '_blank' ).focus()
                                } 
                                else {
                                    window.location.href = element.href
                                }
                            }
                        }
                        let remainingTime = totalCycleTime * 1000
                        // Set a timeout to hide the element after the animation is done
                        let timeoutId = setTimeout( () => hideElement(), remainingTime )
                        if ( pauseOnHover !== 'false' ) {
                            let startTime = new Date()
                            const pauseTimeout = () => {
                                clearTimeout(timeoutId)
                                remainingTime -= new Date() - startTime
                            }
                            const resumeTimeout = () => {
                                startTime = new Date()
                                timeoutId = setTimeout(() => hideElement(), remainingTime)
                            }
                            currentSubject.addEventListener('mouseenter', () => {
                                animation.pause()
                                pauseTimeout()
                            })
                            currentSubject.addEventListener('mouseleave', () => {
                                animation.play()
                                resumeTimeout()
                            })
                        }
                    } )
                } )
                const hideElement = () => {
                    // console.log('hiding element', currentSubject)
                    currentSubject.style.opacity = '0'
                    currentSubject.style.pointerEvents = 'none'
                    currentSubject.style.cursor = 'default'
                    currentSubject.onclick = null
                    // Use setTimeout to ensure the opacity transition is complete before hiding
                    setTimeout(() => {
                        this._displayHideNone( currentSubject )
                        // update the active index and animate the next subject
                        activeIndex = ( activeIndex + 1 ) % subjects.length
                        animateNext()
                    }, 300)
                }
            }
            animateNext()
        },
        generatePath: function ( currentSubject, lastOriginSide, originTopPercentage) {        
            let startSide = Math.random() < 0.5 ? 'left' : 'right'
            if (startSide === lastOriginSide) {
                startSide = startSide === 'left' ? 'right' : 'left'
            }
            const elementWidth = parseFloat(getComputedStyle(currentSubject).width) || 50
            const elementHeight = parseFloat(getComputedStyle(currentSubject).height) || 50
            const startX = startSide === 'left' ? -(elementWidth / this.deviceWidth ) : 1 + (elementWidth /  this.deviceWidth )
            const endSide = startSide === 'left' ? 'right' : 'left'
            const endX = endSide === 'left' ? -(elementWidth /  this.deviceWidth ) : 1 + (elementWidth /  this.deviceWidth )        
            const startY = (Math.random() * originTopPercentage) / 100
            const endY = Math.random() * (1 - startY) + startY

            return {
                start: { x: startX, y: startY },
                end: { x: endX, y: endY },
                startSide,
                endSide
            }
        },
        generateRandomPath: function (currentSubject, defaultOrigins = ['left', 'right'], defaultEnds = ['top', 'right', 'left'], skew = 5, lastOriginSide = null, originTopPercentage = 20) {
            let startSide
            const elementWidth = parseFloat(getComputedStyle(currentSubject).width) || 50;

            do {
                startSide = defaultOrigins[Math.floor(Math.random() * defaultOrigins.length)]
            } while (startSide === lastOriginSide)

            let endSide
            do {
                endSide = defaultEnds[Math.floor(Math.random() * defaultEnds.length)]
            } while (endSide === startSide)

            const startX = startSide === 'left' ? -(elementWidth / this.deviceWidth ) : 1 + (elementWidth / this.deviceWidth )
            let endX = endSide === 'left' ? -(elementWidth / this.deviceWidth ) : 1 + (elementWidth / this.deviceWidth )
        
            const startY = Math.random() * (originTopPercentage / 100)
            let endY = Math.random() * (1 - startY) + startY
        
            if (Math.abs(endY - startY) < skew / 100) {
                endY = startY + (skew / 100) * (Math.random() < 0.5 ? 1 : -1)
            }
        
            if (Math.abs(endX - startX) < skew / 100) {
                endX = startX + (skew / 100) * (Math.random() < 0.5 ? 1 : -1)
            }
            return {
                start: { x: startX, y: startY },
                end: { x: endX, y: endY },
                startSide,
                endSide
            }
        },
        animateSubject: function (subject, element, animationTime, path, zoom, rotate = 0, pauseOnHover = 'false') {
            const delay = parseFloat( getComputedStyle( element ).getPropertyValue('--animation-delay') ) || 0
            this.animationOptions.duration = animationTime * 1000
            this.animationOptions.delay = delay * 1000
            // console.log('animateSubject', subject, element, animationTime, path, zoom, rotate, pauseOnHover)
            const keyframes = [
                { 
                    transform: `translate(${path.start.x * 100}vw, ${path.start.y * 100}vh) rotateZ(0) scale(${zoom})`,
                    opacity: 1
                },
                { 
                    transform: `translate(${path.end.x * 100}vw, ${path.end.y * 100}vh) rotateZ(${rotate}deg) scale(${zoom})`,
                    opacity: 1
                },
            ]
            const animation = subject.animate( keyframes, this.animationOptions )

            if ( pauseOnHover !== 'false' ) {
                const pause = () => animation.pause()
                const play = () => animation.play()
                subject.addEventListener('mouseenter', pause)
                subject.addEventListener('mouseleave', play)
                animation.onfinish = () => {
                    subject.removeEventListener('mouseenter', pause)
                    subject.removeEventListener('mouseleave', play)
                    subject.style.opacity = '0'
                    // Use setTimeout to ensure the opacity transition is complete before hiding
                    setTimeout( this._displayHideNone( subject ), 300)
                }
            }
            else {
                animation.onfinish = () => {
                    subject.style.opacity = '0'
                    setTimeout( this._displayHideNone( subject ), 300 )
                }
            }
            return animation
        },
        _displayHideNone : element => {
            element.style.display = 'none'
            element.style.visibility = 'hidden'
        },
        _throttle: function(func, limit) {
            let lastFunc
            let lastRan
            return function() {
                const context = this
                const args = arguments
                if ( ! lastRan ) {
                    func.apply( context, args )
                    lastRan = Date.now()
                } 
                else {
                    clearTimeout(lastFunc)
                    lastFunc = setTimeout(function() {
                        if ((Date.now() - lastRan) >= limit) {
                            func.apply(context, args)
                            lastRan = Date.now()
                        }
                    }, limit - (Date.now() - lastRan))
                }
            }
        }
    }
    document.addEventListener('DOMContentLoaded', function () {
        APP.BallAnimation._init()
    })
} )( window, document )