import { logger } from "../../infrastructure/logger";
/**
 * Facebook & Instagram Service - Servicall v2
 * Publication automatisée via l'API Meta Graph
 */

export interface FacebookConfig {
  appId: string;
  appSecret: string;
  accessToken: string;
  pageId: string;
  instagramAccountId?: string;
}

export interface SocialPostContent {
  message: string;
  imageUrl?: string;
  link?: string;
  hashtags?: string[];
}

export interface SocialPostResult {
  success: boolean;
  postId?: string;
  postUrl?: string;
  error?: string;
  simulated?: boolean;
}

export class FacebookService {
  private config: FacebookConfig;
  private configured: boolean = false;
  private baseUrl = "https://graph.facebook.com/v18.0";

  constructor(config: FacebookConfig) {
    this.config = config;
    
    const isValid = config.accessToken && 
                    !config.accessToken.includes("your_") &&
                    config.pageId &&
                    !config.pageId.includes("your_") &&
                    config.accessToken.length > 10;
    
    if (isValid) {
      this.configured = true;
      logger.info("✅ [FacebookService] Initialisé avec succès");
    } else {
      logger.warn("⚠️ [FacebookService] Credentials Facebook non configurés - mode simulation activé");
    }
  }

  isConfigured(): boolean {
    return this.configured;
  }

  /**
   * Publier sur une Page Facebook
   */
  async publishToPage(content: SocialPostContent): Promise<SocialPostResult> {
    if (!this.configured) {
      logger.info(`📘 [SIMULATION Facebook] Post publié: ${content.message.substring(0, 50)}...`);
      return {
        success: true,
        postId: `sim_fb_${Date.now()}`,
        postUrl: `https://www.facebook.com/servicall/posts/sim_${Date.now()}`,
        simulated: true
      };
    }

    try {
      const fullMessage = content.hashtags 
        ? `${content.message}\n\n${content.hashtags.map(h => `#${h}`).join(" ")}`
        : content.message;

      const params: Record<string, string> = {
        message: fullMessage,
        access_token: this.config.accessToken
      };
      
      if (content.imageUrl) params.url = content.imageUrl;
      if (content.link) params.link = content.link;

      const endpoint = content.imageUrl 
        ? `${this.baseUrl}/${this.config.pageId}/photos`
        : `${this.baseUrl}/${this.config.pageId}/feed`;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params)
      });

      const data = await response.json() as Record<string, unknown>;
      
      if ((data as Record<string, unknown>)["error"]) {
        return {
          success: false,
          error: JSON.stringify((data as Record<string, unknown>)["error"])
        };
      }

      const postId = (data as Record<string, unknown>)["id"] as string;
      return {
        success: true,
        postId,
        postUrl: `https://www.facebook.com/${postId}`
      };
    } catch (error: any) {
      logger.error("[FacebookService] publishToPage error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      };
    }
  }

  /**
   * Publier sur Instagram Business via l'API Meta
   */
  async publishToInstagram(content: SocialPostContent): Promise<SocialPostResult> {
    if (!this.configured || !this.config.instagramAccountId) {
      logger.info(`📸 [SIMULATION Instagram] Post publié: ${content.message.substring(0, 50)}...`);
      return {
        success: true,
        postId: `sim_ig_${Date.now()}`,
        postUrl: `https://www.instagram.com/p/sim_${Date.now()}`,
        simulated: true
      };
    }

    try {
      const caption = content.hashtags 
        ? `${content.message}\n\n${content.hashtags.map(h => `#${h}`).join(" ")}`
        : content.message;

      // Étape 1: Créer le container de média
      const containerResponse = await fetch(
        `${this.baseUrl}/${this.config.instagramAccountId}/media`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image_url: content.imageUrl || "https://via.placeholder.com/1080x1080",
            caption,
            access_token: this.config.accessToken
          })
        }
      );

      const containerData = await containerResponse.json() as Record<string, unknown>;
      const containerId = (containerData as Record<string, unknown>)["id"] as string;

      if (!(containerData as Record<string, unknown>)["id"]) {
        return {
          success: false,
          error: JSON.stringify(containerData)
        };
      }

      // Étape 2: Publier le container
      const publishResponse = await fetch(
        `${this.baseUrl}/${this.config.instagramAccountId}/media_publish`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            creation_id: containerId,
            access_token: this.config.accessToken
          })
        }
      );

      const publishData = await publishResponse.json() as Record<string, unknown>;
      const mediaId = (publishData as Record<string, unknown>)["id"] as string;

      return {
        success: true,
        postId: mediaId,
        postUrl: `https://www.instagram.com/p/${mediaId}`
      };
    } catch (error: any) {
      logger.error("[FacebookService] publishToInstagram error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      };
    }
  }

  /**
   * Obtenir les insights d'un post Facebook
   */
  async getPostInsights(postId: string): Promise<Record<string, unknown>> {
    if (!this.configured) {
      return {
        simulated: true,
        impressions: Math.floor(Math.random() * 5000),
        reach: Math.floor(Math.random() * 3000),
        engagement: Math.floor(Math.random() * 200),
        clicks: Math.floor(Math.random() * 100)
      };
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/${postId}/insights?metric=post_impressions,post_reach,post_engaged_users,post_clicks&access_token=${this.config.accessToken}`
      );
      const data = await response.json() as Record<string, unknown>;
      return (data as Record<string, unknown>)["data"] as Record<string, unknown> || {};
    } catch (error: any) {
      logger.error("[FacebookService] getPostInsights error:", error);
      throw error;
    }
  }
}

export function createFacebookService(): FacebookService {
  return new FacebookService({
    appId: process.env['FACEBOOK_APP_ID'] || "",
    appSecret: process.env['FACEBOOK_APP_SECRET'] || "",
    accessToken: process.env['FACEBOOK_ACCESS_TOKEN'] || "",
    pageId: process.env['FACEBOOK_PAGE_ID'] || "",
    instagramAccountId: process.env['INSTAGRAM_ACCOUNT_ID']
  });
}
