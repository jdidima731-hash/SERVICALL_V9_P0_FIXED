/**
 * CENTRALIZED STATE MACHINE
 * Enforces legal transitions and provides guards for all entities.
 */

import { statusEnum, outcomeEnum } from "../../../drizzle/schema";

export type ProspectStatus = (typeof statusEnum.enumValues)[number];
export type CallOutcome = (typeof outcomeEnum.enumValues)[number];

export interface StateMachineConfig<T extends string> {
  initial: T;
  states: Record<T, {
    transitions: Record<string, {
      target: T;
      guard?: (context: Record<string, unknown>) => boolean;
    }>;
  }>;
}

export const ProspectStateMachine: StateMachineConfig<ProspectStatus> = {
  initial: 'new',
  states: {
    'new': {
      transitions: {
        'CONTACT': { target: 'contacted' },
        'QUALIFY': { target: 'qualified' },
        'LOSE': { target: 'lost' }
      }
    },
    'contacted': {
      transitions: {
        'QUALIFY': { target: 'qualified' },
        'LOSE': { target: 'lost' }
      }
    },
    'qualified': {
      transitions: {
        'CONVERT': { target: 'converted' },
        'LOSE': { target: 'lost' }
      }
    },
    'converted': {
      transitions: {} // Final state
    },
    'lost': {
      transitions: {
        'REOPEN': { target: 'new' }
      }
    }
  }
};

export class StateMachineEngine {
  static canTransition(
    currentStatus: string,
    action: string,
    config: StateMachineConfig<string>,
    context: Record<string, unknown> = {}
  ): boolean {
    const stateConfig = config.states[currentStatus];
    if (!stateConfig) return false;

    const transition = stateConfig.transitions[action];
    if (!transition) return false;

    if (transition.guard && !transition.guard(context)) {
      return false;
    }

    return true;
  }

  static getNextState(
    currentStatus: string,
    action: string,
    config: StateMachineConfig<string>
  ): string | null {
    const stateConfig = config.states[currentStatus];
    if (!stateConfig) return null;

    const transition = stateConfig.transitions[action];
    return transition ? transition.target : null;
  }
}
