(function($) {
    const setupSfmomaPlayer = (el) => {
        const $container = $(el);
        if ($container.data('sfmoma-init')) return;
        $container.data('sfmoma-init', true);

        if (!$container.hasClass('sfmoma--media-mejs-container')) {
            $container.addClass('sfmoma--media-mejs-container');
        }

        const $controls = $container.find('.mejs-controls');
        // Find the wrapper that contains the original <audio> tag and the <p> tags
        const $parentWrapper = $container.closest('.single-column-content');
        
        let $display = $controls.find('.mejs-display');
        if (!$display.length) {
            $display = $('<div class="mejs-display" role="region" aria-live="polite"></div>');
            $controls.prepend($display);
        }

        const $captionTextElement = $parentWrapper.find('> p:first-of-type');
        const captionTextElementCount = $parentWrapper.find('> p').length;
        const $button = $controls.find('.mejs-button');
        
        let toAppend = '';
        let captionTextString = '';

        if ($captionTextElement.find('svg').length) {
            // It's Audio Description if an SVG is present
            toAppend = '<h5 class="media-player--caption"></h5>';
            captionTextString = 'Audio Description';
        } 
        else if (captionTextElementCount === 1) {
            // Don't add anything if there is only one <p>
            toAppend = '';
        } 
        else if ($captionTextElement.length) {
            // Standard text caption
            captionTextString = $captionTextElement.html();
            toAppend = `<h5 class="media-player--caption">${captionTextString.replace('[Play icon]', '')}</h5>`;
        }

        if ($display.length && toAppend !== '') {
            $display.append(toAppend);
        }

        // Always run the active-state logic
        requestAnimationFrame(() => {
            if ('' !== captionTextString) {
                $captionTextElement.hide();
            }

            switch(captionTextString) {
                case 'Audio Description':
                    $button.addClass('position--3');
                    $display.addClass('is--audio-description');
                    break;
                case 'Español':
                    $button.addClass('position--1');
                    break;
                case '普通话':
                    $button.addClass('position--2');
                    break;
                default:
                    break;
            }

            $display.addClass('is--active');
            $button.addClass('is--active');

            $container[0].style.height = `${$controls[0].offsetHeight}px`;
        });

        if (toAppend === '' && captionTextElementCount === 1) {
            $container.find('audio, video').css('display', 'block');
        }
    };

    // Observer and Ready handlers remain the same to ensure it fires correctly
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === 1) {
                    if (node.classList.contains('mejs-container')) setupSfmomaPlayer(node);
                    $(node).find('.mejs-container').each(function() { setupSfmomaPlayer(this); });
                }
            });
        });
    });

    observer.observe(document.body, { childList: true, subtree: true });

    $(document).ready(() => {
        $('.mejs-container').each(function() { setupSfmomaPlayer(this); });
    });

})(jQuery);