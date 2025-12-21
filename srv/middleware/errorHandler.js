/**
 * Error Handling Middleware for Al-Shorouk Radiology System
 */

module.exports = function(app) {
    // 404 handler - must be after all routes
    app.use((req, res, next) => {
        console.log('404 - Page not found:', req.url);
        res.status(404).render('error', {
            message: 'Page not found',
            error: { status: 404, stack: '' },
            user: req.session || {}
        });
    });

    // General error handler
    app.use((err, req, res, next) => {
        // Log error with context
        console.error('Error occurred:', {
            message: err.message,
            stack: err.stack,
            url: req.url,
            method: req.method,
            user: req.session ? req.session.userId : 'anonymous',
            timestamp: new Date().toISOString()
        });

        // Set status
        const status = err.status || 500;
        res.status(status);

        // Render error page
        res.render('error', {
            message: err.message || 'An unexpected error occurred',
            error: app.get('env') === 'development' ? err : { status, stack: '' },
            user: req.session || {}
        });
    });
};
