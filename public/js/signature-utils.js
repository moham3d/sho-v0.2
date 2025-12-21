// Common signature utilities for consistent signature handling across all forms
window.SignatureUtils = {
    renderSignature: function(signatureData, options = {}) {
        const maxHeight = options.maxHeight || 100;
        const showBorder = options.showBorder !== false;
        const altText = options.altText || 'Signature';

        if (!signatureData) {
            return '<span class="text-muted">No signature available</span>';
        }

        const trimmed = signatureData.trim();
        const borderClass = showBorder ? 'border rounded' : '';
        const style = 'max-height: ' + maxHeight + 'px; max-width: 100%; width: auto; height: auto; object-fit: contain;';

        if (trimmed.startsWith('<svg')) {
            return trimmed.replace('<svg', '<svg style="' + style + '" class="' + borderClass + ' mt-2"');
        }

        if (trimmed.startsWith('data:image/svg+xml')) {
            try {
                const base64Data = trimmed.split(',')[1];
                const svgContent = atob(base64Data);
                return svgContent.replace('<svg', '<svg style="' + style + '" class="' + borderClass + ' mt-2"');
            } catch (error) {
                console.warn('Failed to decode SVG signature:', error);
                return '<img src="' + trimmed + '" alt="' + altText + '" class="' + borderClass + ' mt-2" style="' + style + '">';
            }
        }

        if (trimmed.startsWith('data:image') || trimmed.startsWith('http')) {
            return '<img src="' + trimmed + '" alt="' + altText + '" class="' + borderClass + ' mt-2" style="' + style + '">';
        }

        if (trimmed) {
            return '<div class="' + borderClass + ' mt-2 p-2 bg-white" style="' + style + '" aria-label="' + altText + '">' + trimmed + '</div>';
        }

        return '<span class="text-muted">Invalid signature format</span>';
    },

    initSignaturePad: function(canvas, options = {}) {
        const onChange = options.onChange;
        const onClear = options.onClear;

        const ctx = canvas.getContext('2d');
        let isDrawing = false;
        let paths = [];
        let currentPath = [];

        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        function getMousePos(e) {
            const rect = canvas.getBoundingClientRect();
            return {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            };
        }

        function startDrawing(e) {
            isDrawing = true;
            const pos = getMousePos(e);
            currentPath = ['M ' + pos.x + ' ' + pos.y];
            ctx.beginPath();
            ctx.moveTo(pos.x, pos.y);
        }

        function draw(e) {
            if (!isDrawing) return;
            const pos = getMousePos(e);
            currentPath.push('L ' + pos.x + ' ' + pos.y);
            ctx.lineTo(pos.x, pos.y);
            ctx.stroke();
        }

        function stopDrawing() {
            if (!isDrawing) return;
            isDrawing = false;
            if (currentPath.length > 1) {
                paths.push(currentPath.join(' '));
            }
            currentPath = [];
            if (onChange) onChange();
        }

        function clearSignature() {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            paths = [];
            if (onClear) onClear();
        }

        function getSignatureData() {
            if (paths.length === 0) return '';

            const svgData = '<svg xmlns="http://www.w3.org/2000/svg" width="' + canvas.width + '" height="' + canvas.height + '" viewBox="0 0 ' + canvas.width + ' ' + canvas.height + '">' +
                '<rect width="100%" height="100%" fill="white"/>' +
                '<g stroke="#000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none">' +
                paths.map(function(path) { return '<path d="' + path + '"/>'; }).join('') +
                '</g>' +
                '</svg>';

            return 'data:image/svg+xml;base64,' + btoa(svgData);
        }

        canvas.addEventListener('mousedown', startDrawing);
        canvas.addEventListener('mousemove', draw);
        canvas.addEventListener('mouseup', stopDrawing);
        canvas.addEventListener('mouseout', stopDrawing);

        canvas.addEventListener('touchstart', function(e) {
            e.preventDefault();
            const touch = e.touches[0];
            const mouseEvent = new MouseEvent('mousedown', {
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            canvas.dispatchEvent(mouseEvent);
        });

        canvas.addEventListener('touchmove', function(e) {
            e.preventDefault();
            const touch = e.touches[0];
            const mouseEvent = new MouseEvent('mousemove', {
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            canvas.dispatchEvent(mouseEvent);
        });

        canvas.addEventListener('touchend', function(e) {
            e.preventDefault();
            const mouseEvent = new MouseEvent('mouseup');
            canvas.dispatchEvent(mouseEvent);
        });

        return {
            clear: clearSignature,
            getData: getSignatureData,
            isEmpty: function() { return paths.length === 0; }
        };
    }
};
