import * as fs from 'fs';
import * as path from 'path';
import { logger } from "../infrastructure/logger";


export interface CallCenterScript {
  activity_type: string;
  objectives: string[];
  pitch: string;
  bénéfices: string[];
  questions_qualification: { id: string; text: string; type: string }[];
  objections: { pattern: string; reponse: string }[];
  regles_metier: string[];
  actions_finales: string[];
}

export class CallCenterScriptLoader {
  private scripts: Record<string, CallCenterScript> = {};
  private static instance: CallCenterScriptLoader;

  private constructor() {
    this.loadScripts();
  }

  public static getInstance(): CallCenterScriptLoader {
    if (!CallCenterScriptLoader.instance) {
      CallCenterScriptLoader.instance = new CallCenterScriptLoader();
    }
    return CallCenterScriptLoader.instance;
  }

  private loadScripts(): void {
    const scriptsPath = path.join(__dirname, '../../shared/scripts/callcenter/scripts.json');
    try {
      if (fs.existsSync(scriptsPath)) {
        this.scripts = JSON.parse(fs.readFileSync(scriptsPath, 'utf8'));
      }
    } catch (error: any) {
      logger.error('Error loading call center scripts:', error);
    }
  }

  public getScript(activityType: string): CallCenterScript | null {
    const script = this.scripts[activityType];
    if (!script) {
      logger.warn(`No script found for activity type: ${activityType}`);
      return this.getFallbackScript();
    }
    return script;
  }

  private getFallbackScript(): CallCenterScript {
    return {
      activity_type: 'generic_support',
      objectives: ['Aider le client'],
      pitch: 'Bonjour, service client à votre écoute.',
      bénéfices: ['Service rapide', 'Expertise'],
      questions_qualification: [{ id: 'motif', text: 'Quel est le motif de votre appel ?', type: 'string' }],
      objections: [],
      regles_metier: ['Rester professionnel'],
      actions_finales: ['log_call']
    };
  }
}

export default CallCenterScriptLoader;
