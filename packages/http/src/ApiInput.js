import HttpInput from './HttpInput';
import createApi from './createApi';

class ApiInput extends HttpInput {
    constructor(opts = {}) {
        const { app, ...options } = opts;
        super(options);
        this.router = createApi(app, this);
    }
}

export default ApiInput;
