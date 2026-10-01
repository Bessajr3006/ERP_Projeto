import { AppError } from './AppError';
import { ActiveSessionInfo } from '../types/User';

export class SessionConflictError extends AppError {
    public readonly code: string = 'SESSION_CONFLICT';
    public readonly sessionInfo: ActiveSessionInfo;

    constructor(message: string, sessionInfo: ActiveSessionInfo) {
        super(message, 409);
        this.sessionInfo = sessionInfo;
        Object.setPrototypeOf(this, new.target.prototype);
    }
}
