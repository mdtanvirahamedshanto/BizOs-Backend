import { eventBus } from '../../common/events/eventBus';
import type {
  UserRegisteredEvent,
  UserLoginEvent,
  UserLogoutEvent,
} from '../../common/events/eventTypes';

/**
 * Auth module event publishers.
 * Encapsulates event emission for the auth domain.
 */
export const authEvents = {
  userRegistered(payload: UserRegisteredEvent): void {
    eventBus.emit('user.registered', payload);
  },

  userLogin(payload: UserLoginEvent): void {
    eventBus.emit('user.login', payload);
  },

  userLogout(payload: UserLogoutEvent): void {
    eventBus.emit('user.logout', payload);
  },
};
