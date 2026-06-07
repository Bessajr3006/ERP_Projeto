// Enforce production runtime by default across API and worker processes.
if (process.env.NODE_ENV !== 'test') {
    process.env.NODE_ENV = 'production';
}
