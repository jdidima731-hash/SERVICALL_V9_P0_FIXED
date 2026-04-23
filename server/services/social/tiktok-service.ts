import { logger } from "../../infrastructure/logger";
/**
 * TikTok Automation Service - Servicall v2
 * Gestion de la publication automatisée sur TikTok via l'API TikTok for Business
 */

export interface TikTokConfig {
  clientKey: string;
  clientSecret: string;
  accessToken: string;
  openId: string;
}

export interface TikTokVideoPost {
  videoUrl?: string;
  videoBuffer?: Buffer;
  caption: string;
  hashtags?: string[];
  privacyLevel?: "PUBLIC_TO_EVERYONE" | "MUTUAL_FOLLOW_FRIENDS" | "FOLLOWER_OF_CREATOR" | "SELF_ONLY";
  disableDuet?: boolean;
  disableComment?: boolean;
  disableStitch?: boolean;
}

export interface TikTokPhotoPost {
  imageUrls: string[];
  caption: string;
  hashtags?: string[];
}

export interface TikTokPostResult {
  success: boolean;
  postId?: string;
  shareUrl?: string;
  error?: string;
}

export class TikTokService {
  private config: TikTokConfig;
  private configured: boolean = false;
  private baseUrl = "https://open.tiktokapis.com/v2";

  constructor(config: TikTokConfig) {
    this.config = config;
    
    const isValid = config.clientKey && 
                    config.accessToken && 
                    !config.accessToken.includes("your_") &&
                    config.accessToken.length > 10;
    
    if (isValid) {
      this.configured = true;
      logger.info("✅ [TikTokService] Initialisé avec succès");
    } else {
      logger.error("❌ [TikTokService] Credentials TikTok non configurés");
    }
  }

  isConfigured(): boolean {
    return this.configured;
  }

  private checkConfig() {
    if (!this.configured) {
      throw new Error("Service TikTok non configuré. Veuillez vérifier vos clés API.");
    }
  }

  /**
   * Obtenir les informations du compte TikTok
   */
  async getAccountInfo(): Promise<Record<string, unknown>> {
    this.checkConfig();

    try {
      const response = await fetch(`${this.baseUrl}/user/info/`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.config.accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          fields: ["open_id", "display_name", "avatar_url", "follower_count", "following_count", "likes_count", "video_count"]
        })
      });
      
      const data = await response.json() as Record<string, unknown>;
      return (data as Record<string, unknown>)["data"] as Record<string, unknown> || data;
    } catch (error: any) {
      logger.error("[TikTokService] getAccountInfo error:", error);
      throw error;
    }
  }

  /**
   * Publier une vidéo sur TikTok
   */
  async publishVideo(post: TikTokVideoPost): Promise<TikTokPostResult> {
    this.checkConfig();

    try {
      // Étape 1: Initialiser l'upload
      const initResponse = await fetch(`${this.baseUrl}/post/publish/video/init/`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.config.accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          post_info: {
            title: post.caption + (post.hashtags ? " " + post.hashtags.map(h => `#${h}`).join(" ") : ""),
            privacy_level: post.privacyLevel || "PUBLIC_TO_EVERYONE",
            disable_duet: post.disableDuet || false,
            disable_comment: post.disableComment || false,
            disable_stitch: post.disableStitch || false,
          },
          source_info: {
            source: "PULL_FROM_URL",
            video_url: post.videoUrl
          }
        })
      });

      const initData = await initResponse.json() as Record<string, unknown>;
      
      if ((initData as Record<string, unknown>)["error"] && ((initData as Record<string, unknown>)["error"] as Record<string, unknown>).code !== "ok") {
        return {
          success: false,
          error: JSON.stringify((initData as Record<string, unknown>)["error"])
        };
      }

      const publishId = ((initData as Record<string, unknown>)["data"] as Record<string, unknown>)?.publish_id as string;
      
      return {
        success: true,
        postId: publishId,
        shareUrl: `https://www.tiktok.com/@servicall/video/${publishId}`
      };
    } catch (error: any) {
      logger.error("[TikTokService] publishVideo error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      };
    }
  }

  /**
   * Publier des photos/carousel sur TikTok
   */
  async publishPhotoPost(post: TikTokPhotoPost): Promise<TikTokPostResult> {
    this.checkConfig();

    try {
      const response = await fetch(`${this.baseUrl}/post/publish/content/init/`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.config.accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          post_info: {
            title: post.caption + (post.hashtags ? " " + post.hashtags.map(h => `#${h}`).join(" ") : ""),
            privacy_level: "PUBLIC_TO_EVERYONE",
            post_mode: "DIRECT_POST",
            media_type: "PHOTO"
          },
          source_info: {
            source: "PULL_FROM_URL",
            photo_images: post.imageUrls,
            photo_cover_index: 0
          }
        })
      });

      const data = await response.json() as Record<string, unknown>;
      const publishId = ((data as Record<string, unknown>)["data"] as Record<string, unknown>)?.publish_id as string;
      
      return {
        success: true,
        postId: publishId,
        shareUrl: `https://www.tiktok.com/@servicall/photo/${publishId}`
      };
    } catch (error: any) {
      logger.error("[TikTokService] publishPhotoPost error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      };
    }
  }

  /**
   * Vérifier le statut d'une publication
   */
  async checkPublishStatus(publishId: string): Promise<Record<string, unknown>> {
    this.checkConfig();

    try {
      const response = await fetch(`${this.baseUrl}/post/publish/status/fetch/`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.config.accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ publish_id: publishId })
      });
      
      const data = await response.json() as Record<string, unknown>;
      return (data as Record<string, unknown>)["data"] as Record<string, unknown> || data;
    } catch (error: any) {
      logger.error("[TikTokService] checkPublishStatus error:", error);
      throw error;
    }
  }

  /**
   * Obtenir les analytics d'un post
   */
  async getVideoAnalytics(videoId: string): Promise<Record<string, unknown>> {
    this.checkConfig();

    try {
      const response = await fetch(`${this.baseUrl}/video/query/`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.config.accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          filters: { video_ids: [videoId] },
          fields: ["id", "view_count", "like_count", "comment_count", "share_count", "play_url"]
        })
      });
      
      const data = await response.json() as Record<string, unknown>;
      return ((data as Record<string, unknown>)["data"] as Record<string, unknown>)?.videos?.[0] || {};
    } catch (error: any) {
      logger.error("[TikTokService] getVideoAnalytics error:", error);
      throw error;
    }
  }
}

/**
 * Créer une instance TikTokService depuis les variables d'environnement
 */
export function createTikTokService(): TikTokService {
  return new TikTokService({
    clientKey: process.env['TIKTOK_CLIENT_KEY'] || "",
    clientSecret: process.env['TIKTOK_CLIENT_SECRET'] || "",
    accessToken: process.env['TIKTOK_ACCESS_TOKEN'] || "",
    openId: process.env['TIKTOK_OPEN_ID'] || ""
  });
}
