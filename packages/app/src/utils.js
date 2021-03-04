import createDebug from 'debug';

export const terminate = (server = null, options = { coredump: false, timeout: 500 }) => {
    const debug = createDebug('cuecue:app:terminate');

    const exit = (code) => {
        if (options.coredump) {
            process.abort();
        } else {
            process.exit(code);
        }
    };

    return (code, reason) => (err) => {
        if (err && err instanceof Error) {
            // Log error information somewhere
            debug('Exit: %s %O', err.message, err.stack);
            debug('Trace: %s %s', code, reason);
        }

        // Attempt a graceful shutdown
        if (server !== null) {
            server.destroy(); // could also call exit on callback here
        }
        setTimeout(exit, options.timeout).unref();
    };
};

export default {
    terminate,
};
