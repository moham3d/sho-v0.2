// Form validation and enhancement for tablet compatibility

document.addEventListener('DOMContentLoaded', function() {
    // Add touch-friendly enhancements
    const forms = document.querySelectorAll('form');

    forms.forEach(form => {
        // Add visual feedback for touch interactions
        const inputs = form.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
            input.addEventListener('focus', function() {
                this.parentElement.classList.add('focused');
            });

            input.addEventListener('blur', function() {
                this.parentElement.classList.remove('focused');
            });
        });

        // Form submission with loading state
        form.addEventListener('submit', function(e) {
            const submitBtn = form.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Submitting...';

                // Re-enable after 3 seconds (in case of error)
                setTimeout(() => {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = submitBtn.innerHTML.replace('<i class="fas fa-spinner fa-spin me-2"></i>Submitting...', '<i class="fas fa-save me-2"></i>Submit Assessment');
                }, 3000);
            }
        });
    });

    // Enhanced form submission with loading state announcements
    const nurseForm = document.getElementById('nurseForm');
    const submitBtn = document.getElementById('submitBtn');
    const submitBtnText = document.getElementById('submitBtnText');
    const submitStatus = document.getElementById('submitStatus');

    if (nurseForm) {
        nurseForm.addEventListener('submit', function(e) {
            if (submitBtn && submitBtnText && submitStatus) {
                // Show loading state
                submitBtn.disabled = true;
                submitBtnText.textContent = 'Submitting...';
                submitStatus.textContent = 'Submitting assessment, please wait...';

                // Announce loading state
                announceToScreenReader('Submitting assessment', 'assertive');
            }
        });
    }

    // Enhanced patient search form submission with loading states
    const patientSearchForm = document.getElementById('patientSearchForm');
    const ssnInput = document.getElementById('ssnInput');
    const ssnError = document.getElementById('ssnError');
    const searchBtn = document.getElementById('searchBtn');
    const searchBtnText = document.getElementById('searchBtnText');
    const searchBtnStatus = document.getElementById('searchBtnStatus');

    if (patientSearchForm) {
        patientSearchForm.addEventListener('submit', function(e) {
            const ssnValue = ssnInput ? ssnInput.value.trim() : '';
            const isValidSSN = /^\d{14}$/.test(ssnValue);

            if (!isValidSSN) {
                e.preventDefault();
                if (ssnError) {
                    ssnError.textContent = 'Please enter a valid 14-digit SSN before submitting.';
                    ssnError.style.display = 'block';
                    ssnError.setAttribute('aria-live', 'assertive');
                    ssnInput.focus();
                }
                announceToScreenReader('Form submission blocked. Please enter a valid 14-digit SSN.', 'assertive');
                return false;
            }

            // Show loading state
            if (searchBtn && searchBtnText && searchBtnStatus) {
                searchBtn.disabled = true;
                searchBtnText.textContent = 'Starting Assessment...';
                searchBtnStatus.textContent = 'Starting patient assessment, please wait...';
            }

            // Announce loading state
            const loadingIndicator = document.getElementById('searchLoadingIndicator');
            if (loadingIndicator) {
                loadingIndicator.textContent = 'Starting patient assessment. Please wait while we prepare the assessment form.';
            }

            announceToScreenReader('Starting patient assessment', 'assertive');
        });
    }

    // Enhanced patient search validation with announcements
    const patientSearchInput = document.getElementById('patientSearch');
    const patientSearchError = document.getElementById('patientSearchError');

    if (patientSearchInput && patientSearchError) {
        // Patient search input validation
        patientSearchInput.addEventListener('input', function() {
            const value = this.value.trim();
            const isValid = value.length >= 2 && /^\d+$/.test(value);

            // Update ARIA attributes
            this.setAttribute('aria-invalid', !isValid && value.length > 0 ? 'true' : 'false');

            // Show/hide error message with announcements
            if (value.length > 0 && !isValid) {
                patientSearchError.textContent = value.length < 2 ?
                    'Please enter at least 2 digits to search.' :
                    'Please enter only numbers for SSN search.';
                patientSearchError.style.display = 'block';
                patientSearchError.setAttribute('aria-live', 'assertive');

                announceFieldValidation('Patient search', false, patientSearchError.textContent);
            } else if (value.length === 0) {
                patientSearchError.style.display = 'none';
                patientSearchError.setAttribute('aria-live', 'off');
            } else {
                patientSearchError.style.display = 'none';
                patientSearchError.setAttribute('aria-live', 'off');
                announceFieldValidation('Patient search', true);
            }

            // Enable/disable search button based on validation
            if (searchBtn) {
                searchBtn.disabled = !isValid;
                if (searchBtnStatus) {
                    searchBtnStatus.textContent = isValid ?
                        'Button is enabled. Press Enter or click to search.' :
                        'Button is disabled. Please enter at least 2 digits to search.';
                }
            }
        });

        // Clear error on focus
        patientSearchInput.addEventListener('focus', function() {
            patientSearchError.style.display = 'none';
            patientSearchError.setAttribute('aria-live', 'off');
        });
    }

    if (ssnInput && ssnError) {
        // SSN input validation
        ssnInput.addEventListener('input', function() {
            const value = this.value.trim();
            const isValid = /^\d{14}$/.test(value);

            // Update ARIA attributes
            this.setAttribute('aria-invalid', !isValid && value.length > 0 ? 'true' : 'false');

            // Show/hide error message
            if (value.length > 0 && !isValid) {
                if (value.length < 14) {
                    ssnError.textContent = `Please enter all 14 digits. ${14 - value.length} digits remaining.`;
                } else if (value.length > 14) {
                    ssnError.textContent = 'SSN cannot exceed 14 digits.';
                } else {
                    ssnError.textContent = 'Please enter only numbers for SSN.';
                }
                ssnError.style.display = 'block';
                ssnError.setAttribute('aria-live', 'assertive');

                announceFieldValidation('SSN', false, ssnError.textContent);
            } else {
                ssnError.style.display = 'none';
                ssnError.setAttribute('aria-live', 'off');
                if (value.length === 14) {
                    announceFieldValidation('SSN', true);
                }
            }

            // Update submit button state
            updateSearchButtonState();
        });

        // Clear error on focus
        ssnInput.addEventListener('focus', function() {
            ssnError.style.display = 'none';
            ssnError.setAttribute('aria-live', 'off');
        });
    }

    // Range input value display
    const rangeInputs = document.querySelectorAll('input[type="range"]');
    rangeInputs.forEach(input => {
        const output = input.nextElementSibling;
        if (output && output.tagName === 'OUTPUT') {
            input.addEventListener('input', function() {
                output.value = this.value;
            });
        }
    });

    // Checkbox group handling
    const allergyCheckboxes = document.querySelectorAll('input[name="has_allergies"]');
    allergyCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            const allergyInputs = document.querySelectorAll('input[name*="allergies"]');
            allergyInputs.forEach(input => {
                if (input.type !== 'checkbox') {
                    input.disabled = !this.checked;
                }
            });
        });
    });

    // Function to announce field validation results
    function announceFieldValidation(fieldName, isValid, errorMessage = '') {
        const message = isValid ?
            `${fieldName} validation passed` :
            `${fieldName} validation failed: ${errorMessage}`;
        announceToScreenReader(message, 'polite');
    }

    window.addEventListener('resize', adjustForTablet);
    adjustForTablet();

    // Add swipe gestures for form navigation (basic implementation)
    let startX, startY;
    document.addEventListener('touchstart', function(e) {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
    });

    document.addEventListener('touchend', function(e) {
        if (!startX || !startY) return;

        const endX = e.changedTouches[0].clientX;
        const endY = e.changedTouches[0].clientY;
        const diffX = startX - endX;
        const diffY = startY - endY;

        // Horizontal swipe detection
        if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 50) {
            if (diffX > 0) {
                // Swipe left - could navigate to next section
                console.log('Swipe left detected');
            } else {
                // Swipe right - could navigate to previous section
                console.log('Swipe right detected');
            }
        }
    });

    // Enhanced progress tracking with screen reader announcements
    function updateFormProgress() {
        const nurseForm = document.getElementById('nurseForm');
        const progressBar = document.getElementById('formProgress');
        const progressText = progressBar ? progressBar.querySelector('.progress-text') : null;
        const statusAnnouncements = document.getElementById('formStatusAnnouncements');

        if (!nurseForm || !progressBar || !progressText) return;

        const inputs = nurseForm.querySelectorAll('input[required], select[required], textarea[required]');
        let filledCount = 0;
        let totalCount = inputs.length;

        inputs.forEach(input => {
            if (input.type === 'checkbox') {
                if (input.checked) filledCount++;
            } else if (input.value.trim() !== '') {
                filledCount++;
            }
        });

        const percentage = totalCount > 0 ? Math.round((filledCount / totalCount) * 100) : 0;
        const previousPercentage = parseInt(progressBar.style.width) || 0;

        // Batch DOM updates
        if (percentage !== previousPercentage) {
            progressBar.style.width = percentage + '%';
            progressText.textContent = percentage + '% Complete';

            // Update progress bar color based on completion
            progressBar.className = 'progress-bar';
            if (percentage < 25) {
                progressBar.classList.add('bg-danger');
            } else if (percentage < 50) {
                progressBar.classList.add('bg-warning');
            } else if (percentage < 75) {
                progressBar.classList.add('bg-info');
            } else {
                progressBar.classList.add('bg-success');
            }

            // Announce progress changes to screen readers (throttled)
            if (statusAnnouncements) {
                const announcement = `Form progress: ${percentage}% complete. ${filledCount} of ${totalCount} required fields filled.`;
                announceToScreenReader(announcement, 'polite');
            }

            // Update ARIA attributes
            progressBar.setAttribute('aria-valuenow', percentage);
        }
    }

    // Optimized auto-save with reduced frequency on mobile
    const AUTO_SAVE_INTERVAL = navigator.userAgent.includes('Mobile') ? 60000 : 30000; // 1 min on mobile, 30 sec on desktop

    // Memory-efficient event listeners
    function addOptimizedEventListener(element, event, handler, options = {}) {
        if (!element) return;

        // Use passive listeners where appropriate for better performance
        const passiveEvents = ['touchstart', 'touchmove', 'touchend', 'wheel', 'scroll'];
        if (passiveEvents.includes(event) && !options.passive) {
            options.passive = true;
        }

        element.addEventListener(event, handler, options);
    }

    // Performance optimization for accessibility features
    let announcementQueue = [];
    let isAnnouncing = false;
    const MAX_ANNOUNCEMENT_QUEUE = 5;

    // Optimized screen reader announcement with queuing
    function announceToScreenReader(message, priority = 'polite') {
        if (!message || typeof message !== 'string') return;

        // Add to queue with priority
        announcementQueue.push({ message, priority, timestamp: Date.now() });

        // Limit queue size to prevent memory issues
        if (announcementQueue.length > MAX_ANNOUNCEMENT_QUEUE) {
            announcementQueue = announcementQueue.slice(-MAX_ANNOUNCEMENT_QUEUE);
        }

        // Process queue if not currently announcing
        if (!isAnnouncing) {
            processAnnouncementQueue();
        }
    }

    function processAnnouncementQueue() {
        if (announcementQueue.length === 0) {
            isAnnouncing = false;
            return;
        }

        isAnnouncing = true;
        const announcement = announcementQueue.shift();

        // Create or reuse announcement element for performance
        let announcementElement = document.getElementById('accessibility-announcer');
        if (!announcementElement) {
            announcementElement = document.createElement('div');
            announcementElement.id = 'accessibility-announcer';
            announcementElement.setAttribute('aria-live', 'polite');
            announcementElement.setAttribute('aria-atomic', 'true');
            announcementElement.style.position = 'absolute';
            announcementElement.style.left = '-10000px';
            announcementElement.style.width = '1px';
            announcementElement.style.height = '1px';
            announcementElement.style.overflow = 'hidden';
            document.body.appendChild(announcementElement);
        }

        // Set appropriate politeness level
        announcementElement.setAttribute('aria-live', announcement.priority);

        // Clear and set message
        announcementElement.textContent = '';
        // Use setTimeout to ensure screen readers pick up the change
        setTimeout(() => {
            announcementElement.textContent = announcement.message;

            // Process next announcement after a delay
            setTimeout(() => {
                processAnnouncementQueue();
            }, 100);
        }, 50);
    }

    // Debounced form validation for better performance
    function debounceValidation(func, wait = 300) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func.apply(this, args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Optimized progress tracking with reduced DOM updates
    let lastProgressUpdate = 0;
    const PROGRESS_UPDATE_THROTTLE = 1000; // 1 second

    function throttledUpdateFormProgress() {
        const now = Date.now();
        if (now - lastProgressUpdate < PROGRESS_UPDATE_THROTTLE) {
            return; // Throttle updates
        }
        lastProgressUpdate = now;

        const nurseForm = document.getElementById('nurseForm');
        const progressBar = document.getElementById('formProgress');
        const progressText = progressBar ? progressBar.querySelector('.progress-text') : null;
        const statusAnnouncements = document.getElementById('formStatusAnnouncements');

        if (!nurseForm || !progressBar || !progressText) return;

        const inputs = nurseForm.querySelectorAll('input[required], select[required], textarea[required]');
        let filledCount = 0;
        let totalCount = inputs.length;

        inputs.forEach(input => {
            if (input.type === 'checkbox') {
                if (input.checked) filledCount++;
            } else if (input.value.trim() !== '') {
                filledCount++;
            }
        });

        const percentage = totalCount > 0 ? Math.round((filledCount / totalCount) * 100) : 0;
        const previousPercentage = parseInt(progressBar.style.width) || 0;

        // Batch DOM updates
        if (percentage !== previousPercentage) {
            progressBar.style.width = percentage + '%';
            progressText.textContent = percentage + '% Complete';

            // Update progress bar color based on completion
            progressBar.className = 'progress-bar';
            if (percentage < 25) {
                progressBar.classList.add('bg-danger');
            } else if (percentage < 50) {
                progressBar.classList.add('bg-warning');
            } else if (percentage < 75) {
                progressBar.classList.add('bg-info');
            } else {
                progressBar.classList.add('bg-success');
            }

            // Announce progress changes to screen readers (throttled)
            if (statusAnnouncements) {
                const announcement = `Form progress: ${percentage}% complete. ${filledCount} of ${totalCount} required fields filled.`;
                announceToScreenReader(announcement, 'polite');
            }

            // Update ARIA attributes
            progressBar.setAttribute('aria-valuenow', percentage);
        }
    }
    // Ensure helper exists: adjusts layout for tablet/mobile widths
    function adjustForTablet() {
        try {
            const width = window.innerWidth || document.documentElement.clientWidth;
            // Add a device type class so CSS can adapt
            if (width <= 900) {
                document.body.classList.add('tablet-device');
                document.body.classList.add('mobile-device');
            } else if (width <= 1200) {
                document.body.classList.add('tablet-device');
                document.body.classList.remove('mobile-device');
            } else {
                document.body.classList.remove('tablet-device');
                document.body.classList.remove('mobile-device');
            }
        } catch (err) {
            // swallow errors to avoid breaking page scripts
            console.warn('adjustForTablet error', err);
        }
    }

    // Lightweight form initializer used by multiple EJS templates
    window.initializeFormValidation = function(form) {
        if (!form || form.__initialized) return;
        form.__initialized = true;

        // Use native constraint validation where available
        form.addEventListener('submit', function(e) {
            if (!form.checkValidity()) {
                e.preventDefault();
                e.stopPropagation();
                const firstInvalid = form.querySelector(':invalid');
                if (firstInvalid) {
                    try { firstInvalid.focus(); } catch (err) {}
                }
                // Announce for screen readers
                announceToScreenReader('Form contains invalid fields. Please complete the required fields.', 'assertive');
            }
            form.classList.add('was-validated');
        }, false);

        // Visual feedback for required fields
        const requiredFields = form.querySelectorAll('[required]');
        requiredFields.forEach(field => {
            field.addEventListener('input', function() {
                if (this.checkValidity()) {
                    this.classList.remove('is-invalid');
                    this.classList.add('is-valid');
                } else {
                    this.classList.remove('is-valid');
                    this.classList.add('is-invalid');
                }
            });
        });
    };

    // Initialize mobile accessibility features
    initializeMobileAccessibility();

    // Accessibility testing and validation utilities
    function runAccessibilityTests() {
        console.log('Running accessibility tests...');
        const results = {
            passed: 0,
            failed: 0,
            warnings: 0,
            tests: []
        };

        // Test 1: Check for required ARIA attributes
        function testAriaAttributes() {
            const forms = document.querySelectorAll('form');
            forms.forEach(form => {
                const inputs = form.querySelectorAll('input, select, textarea');
                inputs.forEach(input => {
                    if (input.hasAttribute('required') && !input.hasAttribute('aria-describedby')) {
                        results.tests.push({
                            test: 'ARIA describedby attribute',
                            element: input,
                            status: 'warning',
                            message: 'Required input missing aria-describedby attribute'
                        });
                        results.warnings++;
                    } else {
                        results.tests.push({
                            test: 'ARIA describedby attribute',
                            element: input,
                            status: 'passed',
                            message: 'ARIA attributes properly configured'
                        });
                        results.passed++;
                    }
                });
            });
        }

        // Test 2: Check for proper heading hierarchy
        function testHeadingHierarchy() {
            const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
            let lastLevel = 0;

            headings.forEach(heading => {
                const level = parseInt(heading.tagName.charAt(1));
                if (level - lastLevel > 1) {
                    results.tests.push({
                        test: 'Heading hierarchy',
                        element: heading,
                        status: 'warning',
                        message: `Skipped heading level: went from h${lastLevel} to h${level}`
                    });
                    results.warnings++;
                } else {
                    results.tests.push({
                        test: 'Heading hierarchy',
                        element: heading,
                        status: 'passed',
                        message: 'Proper heading hierarchy maintained'
                    });
                    results.passed++;
                }
                lastLevel = level;
            });
        }

        // Test 3: Check for alt text on images
        function testImageAltText() {
            const images = document.querySelectorAll('img');
            images.forEach(img => {
                if (!img.hasAttribute('alt') || img.getAttribute('alt').trim() === '') {
                    results.tests.push({
                        test: 'Image alt text',
                        element: img,
                        status: 'failed',
                        message: 'Image missing alt attribute or alt text'
                    });
                    results.failed++;
                } else {
                    results.tests.push({
                        test: 'Image alt text',
                        element: img,
                        status: 'passed',
                        message: 'Image has proper alt text'
                    });
                    results.passed++;
                }
            });
        }

        // Test 4: Check for proper form labels
        function testFormLabels() {
            const inputs = document.querySelectorAll('input, select, textarea');
            inputs.forEach(input => {
                const label = document.querySelector(`label[for="${input.id}"]`);
                if (!label && !input.hasAttribute('aria-label') && !input.hasAttribute('aria-labelledby')) {
                    results.tests.push({
                        test: 'Form labels',
                        element: input,
                        status: 'failed',
                        message: 'Form control missing label, aria-label, or aria-labelledby'
                    });
                    results.failed++;
                } else {
                    results.tests.push({
                        test: 'Form labels',
                        element: input,
                        status: 'passed',
                        message: 'Form control properly labeled'
                    });
                    results.passed++;
                }
            });
        }

        // Test 5: Check for sufficient color contrast (basic check)
        function testColorContrast() {
            // This is a basic check - in production, you'd use a proper color contrast library
            const elements = document.querySelectorAll('*');
            elements.forEach(element => {
                const style = window.getComputedStyle(element);
                const backgroundColor = style.backgroundColor;
                const color = style.color;

                // Skip transparent backgrounds and elements without text
                if (backgroundColor === 'rgba(0, 0, 0, 0)' || backgroundColor === 'transparent') {
                    return;
                }

                // Basic check for very light text on light backgrounds
                if (color.includes('rgb(255, 255, 255)') || color.includes('rgb(254') ||
                    color.includes('rgb(253') || color.includes('rgb(252')) {
                    if (backgroundColor.includes('rgb(255') || backgroundColor.includes('rgb(254') ||
                        backgroundColor.includes('rgb(253') || backgroundColor.includes('rgb(252')) {
                        results.tests.push({
                            test: 'Color contrast',
                            element: element,
                            status: 'warning',
                            message: 'Potential low contrast between text and background'
                        });
                        results.warnings++;
                    }
                } else {
                    results.push({
                        test: 'Color contrast',
                        element: element,
                        status: 'passed',
                        message: 'Color contrast appears adequate'
                    });
                    results.passed++;
                }
            });
        }

        // Test 6: Check for keyboard accessibility
        function testKeyboardAccessibility() {
            const interactiveElements = document.querySelectorAll('button, a, input, select, textarea, [tabindex]');
            interactiveElements.forEach(element => {
                const tabindex = element.getAttribute('tabindex');
                if (tabindex === '-1' && !element.hasAttribute('aria-hidden')) {
                    // Check if element should be focusable
                    results.tests.push({
                        test: 'Keyboard accessibility',
                        element: element,
                        status: 'warning',
                        message: 'Element has tabindex="-1" but may need keyboard access'
                    });
                    results.warnings++;
                } else {
                    results.tests.push({
                        test: 'Keyboard accessibility',
                        element: element,
                        status: 'passed',
                        message: 'Interactive element keyboard accessible'
                    });
                    results.passed++;
                }
            });
        }

        // Test 7: Check for live regions
        function testLiveRegions() {
            const liveRegions = document.querySelectorAll('[aria-live]');
            if (liveRegions.length === 0) {
                results.tests.push({
                    test: 'ARIA live regions',
                    element: document.body,
                    status: 'warning',
                    message: 'No ARIA live regions found for dynamic content announcements'
                });
                results.warnings++;
            } else {
                liveRegions.forEach(region => {
                    results.tests.push({
                        test: 'ARIA live regions',
                        element: region,
                        status: 'passed',
                        message: 'ARIA live region properly configured'
                    });
                    results.passed++;
                });
            }
        }

        // Run all tests
        testAriaAttributes();
        testHeadingHierarchy();
        testImageAltText();
        testFormLabels();
        testColorContrast();
        testKeyboardAccessibility();
        testLiveRegions();

        // Log results
        console.log('Accessibility Test Results:', results);
        console.table(results.tests);

        // Announce test completion
        announceToScreenReader(`Accessibility testing completed. ${results.passed} tests passed, ${results.failed} failed, ${results.warnings} warnings.`, 'polite');

        return results;
    }

    // Automated accessibility validation on page load
    function validateAccessibilityOnLoad() {
        // Wait for page to fully load
        window.addEventListener('load', function() {
            setTimeout(() => {
                const results = runAccessibilityTests();

                // Show summary in console
                console.log(`Accessibility Summary: ${results.passed} ✓, ${results.failed} ✗, ${results.warnings} ⚠`);

                // Optional: Show visual indicator for development
                if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                    const indicator = document.createElement('div');
                    indicator.id = 'accessibility-test-indicator';
                    indicator.style.cssText = `
                        position: fixed;
                        bottom: 10px;
                        right: 10px;
                        background: ${results.failed > 0 ? '#dc3545' : results.warnings > 0 ? '#ffc107' : '#28a745'};
                        color: white;
                        padding: 5px 10px;
                        border-radius: 4px;
                        font-size: 12px;
                        z-index: 10000;
                        cursor: pointer;
                    `;
                    indicator.textContent = `A11Y: ${results.passed}✓ ${results.failed}✗ ${results.warnings}⚠`;
                    indicator.title = 'Click to view detailed accessibility test results';
                    indicator.addEventListener('click', () => {
                        console.table(results.tests);
                        alert(`Accessibility Test Results:\n✓ Passed: ${results.passed}\n✗ Failed: ${results.failed}\n⚠ Warnings: ${results.warnings}\n\nCheck console for details.`);
                    });
                    document.body.appendChild(indicator);
                }
            }, 1000);
        });
    }

    // Initialize accessibility testing
    validateAccessibilityOnLoad();

    // Expose testing function globally for manual testing
    window.runAccessibilityTests = runAccessibilityTests;

    // Advanced form patterns with accessibility
    function initializeAdvancedFormPatterns() {
        // Multi-step form navigation
        const formSteps = document.querySelectorAll('.form-step');
        if (formSteps.length > 1) {
            let currentStep = 0;

            function showStep(stepIndex) {
                // Hide all steps
                formSteps.forEach((step, index) => {
                    step.style.display = index === stepIndex ? 'block' : 'none';
                    step.setAttribute('aria-hidden', index !== stepIndex);
                });

                // Update step indicators
                const stepIndicators = document.querySelectorAll('.step-indicator');
                stepIndicators.forEach((indicator, index) => {
                    indicator.classList.toggle('active', index === stepIndex);
                    indicator.setAttribute('aria-current', index === stepIndex ? 'step' : 'false');
                });

                // Announce step change
                const stepTitles = document.querySelectorAll('.form-step h3, .form-step h2');
                const currentTitle = stepTitles[stepIndex] ? stepTitles[stepIndex].textContent : `Step ${stepIndex + 1}`;
                announceToScreenReader(`Form step ${stepIndex + 1} of ${formSteps.length}: ${currentTitle}`, 'polite');

                // Update navigation buttons
                updateStepNavigation(stepIndex);

                currentStep = stepIndex;
            }

            function updateStepNavigation(stepIndex) {
                const prevBtn = document.getElementById('prevStep');
                const nextBtn = document.getElementById('nextStep');
                const submitBtn = document.getElementById('submitForm');

                if (prevBtn) {
                    prevBtn.style.display = stepIndex > 0 ? 'inline-block' : 'none';
                    prevBtn.setAttribute('aria-disabled', stepIndex === 0);
                }

                if (nextBtn) {
                    nextBtn.style.display = stepIndex < formSteps.length - 1 ? 'inline-block' : 'none';
                    nextBtn.setAttribute('aria-disabled', stepIndex === formSteps.length - 1);
                }

                if (submitBtn) {
                    submitBtn.style.display = stepIndex === formSteps.length - 1 ? 'inline-block' : 'none';
                }
            }

            // Add step navigation event listeners
            document.addEventListener('click', function(e) {
                if (e.target.matches('#nextStep')) {
                    e.preventDefault();
                    if (currentStep < formSteps.length - 1) {
                        showStep(currentStep + 1);
                    }
                } else if (e.target.matches('#prevStep')) {
                    e.preventDefault();
                    if (currentStep > 0) {
                        showStep(currentStep - 1);
                    }
                }
            });

            // Keyboard navigation for steps
            document.addEventListener('keydown', function(e) {
                if (e.key === 'ArrowRight' && e.ctrlKey) {
                    e.preventDefault();
                    if (currentStep < formSteps.length - 1) {
                        showStep(currentStep + 1);
                    }
                } else if (e.key === 'ArrowLeft' && e.ctrlKey) {
                    e.preventDefault();
                    if (currentStep > 0) {
                        showStep(currentStep - 1);
                    }
                }
            });

            // Initialize first step
            showStep(0);
        }

        // Conditional form fields
        function initializeConditionalFields() {
            const conditionalTriggers = document.querySelectorAll('[data-conditional-trigger]');

            conditionalTriggers.forEach(trigger => {
                const targetSelector = trigger.getAttribute('data-conditional-trigger');
                const conditionValue = trigger.getAttribute('data-conditional-value');
                const targets = document.querySelectorAll(targetSelector);

                function checkCondition() {
                    const triggerValue = trigger.type === 'checkbox' ? trigger.checked : trigger.value;
                    const conditionMet = conditionValue ? triggerValue === conditionValue :
                                       triggerValue !== '' && triggerValue !== 'false' && triggerValue !== 'no';

                    targets.forEach(target => {
                        if (conditionMet) {
                            target.style.display = 'block';
                            target.setAttribute('aria-hidden', 'false');
                            // Focus on first input in revealed section
                            const firstInput = target.querySelector('input, select, textarea');
                            if (firstInput) {
                                setTimeout(() => firstInput.focus(), 100);
                            }
                        } else {
                            target.style.display = 'none';
                            target.setAttribute('aria-hidden', 'true');
                        }
                    });

                    // Announce conditional content changes
                    if (targets.length > 0) {
                        const action = conditionMet ? 'revealed' : 'hidden';
                        announceToScreenReader(`Additional form fields ${action}`, 'polite');
                    }
                }

                trigger.addEventListener('change', checkCondition);
                // Initial check
                checkCondition();
            });
        }

        // Auto-complete with accessibility
        function initializeAccessibleAutocomplete() {
            const autocompleteInputs = document.querySelectorAll('[data-autocomplete]');

            autocompleteInputs.forEach(input => {
                const listId = input.getAttribute('data-autocomplete');
                const list = document.getElementById(listId);
                let selectedIndex = -1;
                let suggestions = [];

                if (!list) return;

                input.setAttribute('aria-expanded', 'false');
                input.setAttribute('aria-autocomplete', 'list');
                input.setAttribute('aria-owns', listId);
                list.setAttribute('role', 'listbox');

                input.addEventListener('input', function() {
                    const value = this.value.toLowerCase();
                    suggestions = Array.from(list.children).filter(item =>
                        item.textContent.toLowerCase().includes(value)
                    );

                    if (suggestions.length > 0 && value.length > 0) {
                        list.style.display = 'block';
                        input.setAttribute('aria-expanded', 'true');
                        selectedIndex = -1;

                        suggestions.forEach((item, index) => {
                            item.style.display = 'block';
                            item.setAttribute('aria-selected', 'false');
                            item.setAttribute('role', 'option');
                            item.setAttribute('tabindex', '-1');
                        });

                        announceToScreenReader(`${suggestions.length} suggestions available`, 'polite');
                    } else {
                        list.style.display = 'none';
                        input.setAttribute('aria-expanded', 'false');
                    }
                });

                input.addEventListener('keydown', function(e) {
                    if (list.style.display === 'none') return;

                    switch (e.key) {
                        case 'ArrowDown':
                            e.preventDefault();
                            selectedIndex = Math.min(selectedIndex + 1, suggestions.length - 1);
                            updateSelection();
                            break;
                        case 'ArrowUp':
                            e.preventDefault();
                            selectedIndex = Math.max(selectedIndex - 1, -1);
                            updateSelection();
                            break;
                        case 'Enter':
                            e.preventDefault();
                            if (selectedIndex >= 0) {
                                selectSuggestion(suggestions[selectedIndex]);
                            }
                            break;
                        case 'Escape':
                            list.style.display = 'none';
                            input.setAttribute('aria-expanded', 'false');
                            selectedIndex = -1;
                            announceToScreenReader('Suggestions hidden', 'polite');
                            break;
                    }
                });

                function updateSelection() {
                    suggestions.forEach((item, index) => {
                        const isSelected = index === selectedIndex;
                        item.setAttribute('aria-selected', isSelected);
                        item.classList.toggle('selected', isSelected);
                    });

                    if (selectedIndex >= 0) {
                        announceToScreenReader(`Suggestion ${selectedIndex + 1} of ${suggestions.length}: ${suggestions[selectedIndex].textContent}`, 'polite');
                    }
                }

                function selectSuggestion(item) {
                    input.value = item.textContent;
                    list.style.display = 'none';
                    input.setAttribute('aria-expanded', 'false');
                    selectedIndex = -1;
                    announceToScreenReader(`Selected: ${item.textContent}`, 'polite');
                    input.focus();
                }

                // Click selection
                list.addEventListener('click', function(e) {
                    if (e.target.closest('[role="option"]')) {
                        selectSuggestion(e.target.closest('[role="option"]'));
                    }
                });

                // Hide list when clicking outside
                document.addEventListener('click', function(e) {
                    if (!input.contains(e.target) && !list.contains(e.target)) {
                        list.style.display = 'none';
                        input.setAttribute('aria-expanded', 'false');
                    }
                });
            });
        }

        // Progress saving with accessibility
        function initializeProgressSaving() {
            const forms = document.querySelectorAll('form[data-progress-save]');

            forms.forEach(form => {
                const progressKey = `form_progress_${form.id || 'default'}`;

                // Load saved progress
                const savedProgress = localStorage.getItem(progressKey);
                if (savedProgress) {
                    try {
                        const progressData = JSON.parse(savedProgress);
                        Object.keys(progressData).forEach(name => {
                            const inputs = form.querySelectorAll(`[name="${name}"]`);
                            inputs.forEach(input => {
                                if (input.type === 'checkbox') {
                                    input.checked = progressData[name];
                                } else if (input.type === 'radio') {
                                    input.checked = progressData[name] === input.value;
                                } else {
                                    input.value = progressData[name];
                                }
                            });
                        });
                        announceToScreenReader('Form progress restored from previous session', 'polite');
                    } catch (e) {
                        console.error('Error loading form progress:', e);
                    }
                }

                // Save progress on changes
                const saveProgress = debounceValidation(() => {
                    const formData = new FormData(form);
                    const progressData = {};

                    for (let [name, value] of formData.entries()) {
                        if (progressData[name]) {
                            if (Array.isArray(progressData[name])) {
                                progressData[name].push(value);
                            } else {
                                progressData[name] = [progressData[name], value];
                            }
                        } else {
                            progressData[name] = value;
                        }
                    }

                    localStorage.setItem(progressKey, JSON.stringify(progressData));
                }, 2000);

                form.addEventListener('input', saveProgress);
                form.addEventListener('change', saveProgress);
            });
        }

        // Initialize all advanced patterns
        initializeConditionalFields();
        initializeAccessibleAutocomplete();
        initializeProgressSaving();
    }

    // Initialize advanced form patterns
    initializeAdvancedFormPatterns();

    // Basic internationalization support for accessibility
    const accessibilityTranslations = {
        en: {
            loading: 'Loading...',
            complete: 'Complete',
            error: 'Error occurred',
            formProgress: 'Form progress: {0}% complete',
            autoSave: 'Data auto-saved at {0}'
        },
        ar: {
            loading: 'جارٍ التحميل...',
            complete: 'مكتمل',
            error: 'حدث خطأ',
            formProgress: 'تقدم النموذج: {0}% مكتمل',
            autoSave: 'تم الحفظ التلقائي في {0}',
            // Media accessibility messages
            media: {
                played: 'تشغيل الوسائط بدأ',
                paused: 'تشغيل الوسائط متوقف مؤقتاً',
                stopped: 'تشغيل الوسائط متوقف',
                focused: 'عنصر الوسائط مركز عليه',
                playing: 'الوسائط قيد التشغيل',
                ended: 'انتهى تشغيل الوسائط',
                volume: 'مستوى الصوت'
            },
            video: {
                player: 'مشغل الفيديو'
            },
            audio: {
                player: 'مشغل الصوت'
            },
            transcript: {
                show: 'عرض النص',
                hide: 'إخفاء النص'
            }
        }
    };

    let currentLanguage = document.documentElement.lang === 'ar' ? 'ar' : 'en';

    function getTranslatedText(key, ...args) {
        const translation = accessibilityTranslations[currentLanguage] &&
                          accessibilityTranslations[currentLanguage][key];
        if (translation) {
            return translation.replace(/\{(\d+)\}/g, (match, index) => args[index] || match);
        }
        // Fallback to English
        return accessibilityTranslations.en[key] || key;
    }

    // Update announcement functions to use translations
    const originalAnnounceToScreenReader = announceToScreenReader;
    announceToScreenReader = function(message, priority) {
        // Translate common messages
        if (message.includes('Loading')) {
            message = message.replace('Loading', getTranslatedText('loading'));
        } else if (message.includes('Complete')) {
            message = message.replace('Complete', getTranslatedText('complete'));
        } else if (message.includes('Error')) {
            message = message.replace('Error', getTranslatedText('error'));
        }
        return originalAnnounceToScreenReader(message, priority);
    };

    /**
     * Media Accessibility Utilities
     * Provides accessibility support for media elements and content
     */

    /**
     * Initialize media accessibility features
     */
    function initializeMediaAccessibility() {
        // Add keyboard controls for media elements
        addMediaKeyboardControls();

        // Ensure proper focus management for media
        addMediaFocusManagement();

        // Add screen reader support for media status
        addMediaScreenReaderSupport();
    }

    /**
     * Add keyboard controls for media elements
     */
    function addMediaKeyboardControls() {
        // Handle keyboard events for video/audio elements
        document.addEventListener('keydown', function(e) {
            const activeElement = document.activeElement;

            // Space bar for play/pause on media elements
            if (e.key === ' ' && (activeElement.tagName === 'VIDEO' || activeElement.tagName === 'AUDIO')) {
                e.preventDefault();
                if (activeElement.paused) {
                    activeElement.play();
                    announceToScreenReader(getTranslatedText('media.played', 'Media playback started'));
                } else {
                    activeElement.pause();
                    announceToScreenReader(getTranslatedText('media.paused', 'Media playback paused'));
                }
            }

            // Escape key to stop media
            if (e.key === 'Escape' && (activeElement.tagName === 'VIDEO' || activeElement.tagName === 'AUDIO')) {
                activeElement.pause();
                activeElement.currentTime = 0;
                announceToScreenReader(getTranslatedText('media.stopped', 'Media playback stopped'));
            }
        });
    }

    /**
     * Add focus management for media elements
     */
    function addMediaFocusManagement() {
        // Ensure media elements are keyboard accessible
        const mediaElements = document.querySelectorAll('video, audio');
        mediaElements.forEach(function(media) {
            // Add tabindex if not present
            if (!media.hasAttribute('tabindex')) {
                media.setAttribute('tabindex', '0');
            }

            // Add focus event handlers
            media.addEventListener('focus', function() {
                announceToScreenReader(getTranslatedText('media.focused', 'Media element focused'));
            });

            // Add media event handlers for screen reader announcements
            media.addEventListener('play', function() {
                announceToScreenReader(getTranslatedText('media.playing', 'Media is playing'));
            });

            media.addEventListener('pause', function() {
                announceToScreenReader(getTranslatedText('media.paused', 'Media is paused'));
            });

            media.addEventListener('ended', function() {
                announceToScreenReader(getTranslatedText('media.ended', 'Media playback ended'));
            });

            media.addEventListener('volumechange', function() {
                const volume = Math.round(media.volume * 100);
                announceToScreenReader(getTranslatedText('media.volume', 'Volume') + ': ' + volume + '%');
            });
        });
    }

    /**
     * Add screen reader support for media status
     */
    function addMediaScreenReaderSupport() {
        // Add ARIA labels to media controls
        const mediaControls = document.querySelectorAll('video[controls], audio[controls]');
        mediaControls.forEach(function(media) {
            // Ensure media has proper ARIA label
            if (!media.hasAttribute('aria-label') && !media.hasAttribute('aria-labelledby')) {
                const label = media.tagName === 'VIDEO' ? getTranslatedText('video.player', 'Video player') : getTranslatedText('audio.player', 'Audio player');
                media.setAttribute('aria-label', label);
            }

            // Add descriptions for media content
            if (media.tagName === 'VIDEO' && !media.hasAttribute('aria-describedby')) {
                // Look for associated description
                const descriptionId = media.id + '-description';
                const description = document.getElementById(descriptionId);
                if (description) {
                    media.setAttribute('aria-describedby', descriptionId);
                }
            }
        });
    }

    /**
     * Create accessible media element with proper controls
     * @param {string} type - 'video' or 'audio'
     * @param {string} src - media source URL
     * @param {Object} options - additional options
     */
    function createAccessibleMediaElement(type, src, options = {}) {
        const media = document.createElement(type);

        // Set basic attributes
        media.src = src;
        media.controls = true;
        media.preload = options.preload || 'metadata';

        // Add accessibility attributes
        if (options.label) {
            media.setAttribute('aria-label', options.label);
        }

        if (options.description) {
            const descId = 'media-desc-' + Date.now();
            const desc = document.createElement('div');
            desc.id = descId;
            desc.className = 'sr-only';
            desc.textContent = options.description;
            media.parentNode.insertBefore(desc, media.nextSibling);
            media.setAttribute('aria-describedby', descId);
        }

        // Add captions if provided
        if (options.captions && type === 'video') {
            const track = document.createElement('track');
            track.kind = 'captions';
            track.src = options.captions;
            track.srclang = options.captionLang || 'en';
            track.label = options.captionLabel || 'English captions';
            media.appendChild(track);
        }

        // Add transcript if provided
        if (options.transcript) {
            const transcriptId = 'transcript-' + Date.now();
            const transcript = document.createElement('div');
            transcript.id = transcriptId;
            transcript.className = 'media-transcript sr-only';
            transcript.innerHTML = options.transcript;
            media.parentNode.insertBefore(transcript, media.nextSibling);

            // Add button to show/hide transcript
            const toggleBtn = document.createElement('button');
            toggleBtn.type = 'button';
            toggleBtn.className = 'btn btn-link btn-sm mt-2';
            toggleBtn.setAttribute('aria-expanded', 'false');
            toggleBtn.setAttribute('aria-controls', transcriptId);
            toggleBtn.textContent = getTranslatedText('transcript.show', 'Show Transcript');
            toggleBtn.addEventListener('click', function() {
                const isExpanded = toggleBtn.getAttribute('aria-expanded') === 'true';
                toggleBtn.setAttribute('aria-expanded', isExpanded ? 'false' : 'true');
                transcript.classList.toggle('sr-only');
                toggleBtn.textContent = isExpanded ?
                    getTranslatedText('transcript.show', 'Show Transcript') :
                    getTranslatedText('transcript.hide', 'Hide Transcript');
            });
            media.parentNode.insertBefore(toggleBtn, transcript);
        }

        return media;
    }

    // Initialize media accessibility when DOM is ready
    document.addEventListener('DOMContentLoaded', initializeMediaAccessibility);

    // Vital signs validation for nurse assessment form
    function initializeVitalSignsValidation() {
        const nurseForm = document.getElementById('nurseForm');
        if (!nurseForm) return;

        // Vital signs validation ranges (matching server-side validation)
        const validationRules = {
            temperature_celsius: {
                min: 30.0,
                max: 45.0,
                unit: '°C',
                fieldName: 'Temperature'
            },
            pulse_bpm: {
                min: 30,
                max: 200,
                unit: 'bpm',
                fieldName: 'Pulse Rate'
            },
            blood_pressure_systolic: {
                min: 60,
                max: 250,
                unit: 'mmHg',
                fieldName: 'Systolic Blood Pressure'
            },
            blood_pressure_diastolic: {
                min: 40,
                max: 150,
                unit: 'mmHg',
                fieldName: 'Diastolic Blood Pressure'
            },
            respiratory_rate_per_min: {
                min: 5,
                max: 60,
                unit: 'breaths/min',
                fieldName: 'Respiratory Rate'
            },
            oxygen_saturation_percent: {
                min: 70,
                max: 100,
                unit: '%',
                fieldName: 'Oxygen Saturation'
            },
            blood_sugar_mg_dl: {
                min: 20,
                max: 600,
                unit: 'mg/dL',
                fieldName: 'Blood Sugar'
            },
            weight_kg: {
                min: 0.5,
                max: 300,
                unit: 'kg',
                fieldName: 'Weight'
            },
            height_cm: {
                min: 20,
                max: 250,
                unit: 'cm',
                fieldName: 'Height'
            },
            age: {
                min: 0,
                max: 150,
                unit: 'years',
                fieldName: 'Age'
            }
        };

        // Add validation to each vital signs field
        Object.keys(validationRules).forEach(fieldName => {
            const input = document.getElementById(fieldName);
            const errorDiv = document.getElementById(`${fieldName}_error`);

            if (input && errorDiv) {
                const rule = validationRules[fieldName];

                input.addEventListener('input', function() {
                    const value = this.value.trim();
                    let isValid = true;
                    let errorMessage = '';

                    if (value !== '') {
                        const numValue = parseFloat(value);
                        if (isNaN(numValue)) {
                            isValid = false;
                            errorMessage = `${rule.fieldName} must be a valid number.`;
                        } else if (numValue < rule.min || numValue > rule.max) {
                            isValid = false;
                            errorMessage = `${rule.fieldName} must be between ${rule.min} and ${rule.max} ${rule.unit}.`;
                        }
                    }

                    // Update visual feedback
                    this.classList.toggle('is-invalid', !isValid);
                    this.classList.toggle('is-valid', isValid && value !== '');
                    this.setAttribute('aria-invalid', isValid ? 'false' : 'true');

                    // Show/hide error message
                    if (!isValid) {
                        errorDiv.textContent = errorMessage;
                        errorDiv.style.display = 'block';
                        errorDiv.setAttribute('aria-live', 'assertive');
                        announceFieldValidation(rule.fieldName, false, errorMessage);
                    } else {
                        errorDiv.style.display = 'none';
                        errorDiv.setAttribute('aria-live', 'off');
                        if (value !== '') {
                            announceFieldValidation(rule.fieldName, true);
                        }
                    }
                });

                // Clear error on focus
                input.addEventListener('focus', function() {
                    errorDiv.style.display = 'none';
                    errorDiv.setAttribute('aria-live', 'off');
                });
            }
        });

        // Cross-validation for blood pressure (systolic should be > diastolic)
        const systolicInput = document.getElementById('blood_pressure_systolic');
        const diastolicInput = document.getElementById('blood_pressure_diastolic');
        const systolicError = document.getElementById('blood_pressure_systolic_error');
        const diastolicError = document.getElementById('blood_pressure_diastolic_error');

        function validateBloodPressure() {
            if (!systolicInput || !diastolicInput) return;

            const systolic = parseFloat(systolicInput.value);
            const diastolic = parseFloat(diastolicInput.value);

            if (!isNaN(systolic) && !isNaN(diastolic) && systolic <= diastolic) {
                systolicInput.classList.add('is-invalid');
                diastolicInput.classList.add('is-invalid');
                systolicInput.setAttribute('aria-invalid', 'true');
                diastolicInput.setAttribute('aria-invalid', 'true');

                const errorMsg = 'Systolic blood pressure must be higher than diastolic.';
                if (systolicError) {
                    systolicError.textContent = errorMsg;
                    systolicError.style.display = 'block';
                    systolicError.setAttribute('aria-live', 'assertive');
                }
                if (diastolicError) {
                    diastolicError.textContent = errorMsg;
                    diastolicError.style.display = 'block';
                    diastolicError.setAttribute('aria-live', 'assertive');
                }
                announceFieldValidation('Blood Pressure', false, errorMsg);
            }
        }

        if (systolicInput && diastolicInput) {
            systolicInput.addEventListener('input', validateBloodPressure);
            diastolicInput.addEventListener('input', validateBloodPressure);
        }
    }

    // Initialize vital signs validation when DOM is ready
    initializeVitalSignsValidation();
});