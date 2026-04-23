
import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
// Input removed - unused import
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Share2, 
  Plus, 
  Calendar, 
  BarChart3, 
  Facebook, 
  Instagram, 
  Linkedin, 
  Twitter, 
  Sparkles,
  Send,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Users,
  Eye,
  Trash2,
  Copy,
  Moon,
  Sun,
  Zap,
  MessageCircle,
  Image as ImageIcon,
  Grid3x3,
  List,
  RefreshCw,
  FileJson,
  Heart,
  Settings,
  X,
  Key,
  ExternalLink,
  Lightbulb,
  MessageSquare,
  Target,
  ThumbsDown,
  ThumbsUp,
  Download,
  GripVertical,
 } from 'lucide-react';

// Icône TikTok personnalisée SVG
const TikTokIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.34 6.34 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.76a4.85 4.85 0 01-1.01-.07z"/>
  </svg>
);
import { toast } from "sonner";
import { LoadingState } from "@/components/ui/loading-state";

interface PostDraft {
  id: string;
  content: string;
  platforms: string[];
  imageUrl?: string;
  hashtags: string[];
  scheduledAt?: string;
  status: "draft" | "scheduled" | "published";
  sentiment?: "positive" | "negative" | "neutral";
  engagement?: number;
  abVariant?: "A" | "B";
}

interface MediaItem {
  id: string;
  url: string;
  prompt: string;
  createdAt: string;
  platform: string;
}

interface CommentAnalysis {
  id: string;
  author: string;
  text: string;
  sentiment: "positive" | "negative" | "neutral";
  intent: "question" | "purchase" | "feedback" | "other";
  platform: string;
  aiResponse?: string;
}


// Configuration des plateformes avec toutes les infos API
const PLATFORM_CONFIG = {
  facebook: { 
    icon: Facebook, 
    textColor: "text-blue-600",
    bgLight: "bg-blue-100 dark:bg-blue-900",
    label: "Facebook",
    apiUrl: "https://developers.facebook.com",
    envVars: ["FACEBOOK_APP_ID", "FACEBOOK_APP_SECRET", "FACEBOOK_ACCESS_TOKEN", "FACEBOOK_PAGE_ID"],
    description: "Créez une app sur Facebook Developers pour obtenir vos tokens de page"
  },
  instagram: { 
    icon: Instagram, 
    textColor: "text-pink-600",
    bgLight: "bg-pink-100 dark:bg-pink-900",
    label: "Instagram",
    apiUrl: "https://developers.facebook.com",
    envVars: ["INSTAGRAM_ACCOUNT_ID", "FACEBOOK_ACCESS_TOKEN"],
    description: "Instagram utilise l'API Meta Graph (même app que Facebook)"
  },
  linkedin: { 
    icon: Linkedin, 
    textColor: "text-blue-700",
    bgLight: "bg-blue-200 dark:bg-blue-800",
    label: "LinkedIn",
    apiUrl: "https://www.linkedin.com/developers",
    envVars: ["LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET", "LINKEDIN_ACCESS_TOKEN", "LINKEDIN_ORGANIZATION_ID"],
    description: "Créez une app LinkedIn Developer pour publier sur votre page entreprise"
  },
  twitter: { 
    icon: Twitter, 
    textColor: "text-sky-500",
    bgLight: "bg-sky-100 dark:bg-sky-900",
    label: "Twitter / X",
    apiUrl: "https://developer.twitter.com",
    envVars: ["TWITTER_API_KEY", "TWITTER_API_SECRET", "TWITTER_ACCESS_TOKEN", "TWITTER_ACCESS_TOKEN_SECRET", "TWITTER_BEARER_TOKEN"],
    description: "Créez un projet sur Twitter Developer Portal (niveau Basic ou Pro requis)"
  },
  tiktok: { 
    icon: TikTokIcon, 
    textColor: "text-black dark:text-white",
    bgLight: "bg-gray-100 dark:bg-gray-800",
    label: "TikTok",
    apiUrl: "https://developers.tiktok.com",
    envVars: ["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET", "TIKTOK_ACCESS_TOKEN", "TIKTOK_OPEN_ID"],
    description: "Créez une app sur TikTok for Developers pour l'automatisation vidéo"
  }
} as const;

interface TikTokIdea {
  title: string;
  hook: string;
  duration: string;
  description: string;
  hashtags: string[];
  trend: string;
  estimatedViews: number;
}

export default function SocialMediaManager() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");
  const [darkMode, setDarkMode] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(["facebook", "instagram", "linkedin"]);
  const [drafts, setDrafts] = useState<PostDraft[]>([]);
  const [mediaLibrary, setMediaLibrary] = useState<MediaItem[]>([]);
  const [previewPost, setPreviewPost] = useState<PostDraft | null>(null);
  // showMediaLibrary state removed - unused
  const [abTestingMode, setAbTestingMode] = useState(false);
  const [commentAnalysis, setCommentAnalysis] = useState<CommentAnalysis[]>([]);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [draggedPost, setDraggedPost] = useState<string | null>(null);
  
  // Modal gestion des comptes
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [selectedPlatformConfig, setSelectedPlatformConfig] = useState<keyof typeof PLATFORM_CONFIG | null>(null);
  
  // TikTok automation
  const [tiktokTopic, setTiktokTopic] = useState("");
  const [tiktokIdeas, setTiktokIdeas] = useState<TikTokIdea[]>([]);
  const [isGeneratingTikTok, setIsGeneratingTikTok] = useState(false);
  const [tiktokStyle, setTiktokStyle] = useState<"educational" | "entertaining" | "promotional" | "trending">("entertaining");

  // TRPC Queries
  const { data: connections, isLoading: loadingConnections } = trpc.social.getConnections.useQuery(undefined, {
    enabled: !!user
  });
  
  const { data: postsData, isLoading: loadingPosts, refetch: refetchPosts } = trpc.social.listPosts.useQuery({
    limit: 10,
    page: 1
  }, {
    enabled: !!user
  });

  const { data: analytics, isLoading: loadingAnalytics } = trpc.social.getAnalytics.useQuery(undefined, {
    enabled: !!user
  });

  const commentAnalysisQuery = trpc.social.getCommentAnalysis.useQuery(undefined, {
    enabled: false,
    retry: 1,
  });

  // TRPC Mutations
  const generateMutation = trpc.social.generatePosts.useMutation({
    onSuccess: (data: any) => {
      toast.success("Posts générés avec succès par l'IA !");
      setIsGenerating(false);
      
      // Créer des brouillons au lieu de publier directement
      
      const newDrafts: PostDraft[] = ((data as Record<string,unknown>)?.data as unknown[] || (data as Record<string,unknown>)?.posts as unknown[] || []).map((post: Record<string,unknown>, idx: number) => ({
        id: `draft-${Date.now()}-${idx}`,
        content: post.content as string,
        platforms: selectedPlatforms,
        imageUrl: post.imageUrl as string,
        hashtags: (post.hashtags as string[]) || [],
        status: "draft" as const,
        sentiment: analyzeSentiment(post.content as string),
        engagement: 0,
        abVariant: idx % 2 === 0 ? "A" : "B"
      }));
      
      setDrafts(prev => [...prev, ...newDrafts]);

      // Alimenter la bibliothèque de médias avec les images DALL-E générées
      const newMediaItems: MediaItem[] = newDrafts
        .filter(d => d.imageUrl)
        .map((d, idx) => ({
          id: `media-${Date.now()}-${idx}`,
          url: d.imageUrl!,
          prompt: prompt,
          createdAt: new Date().toISOString(),
          platform: d.platforms[0] ?? "instagram",
        }));
      if (newMediaItems.length > 0) {
        setMediaLibrary(prev => [...newMediaItems, ...prev]);
        toast.success(`${newMediaItems.length} image${newMediaItems.length > 1 ? "s" : ""} générée${newMediaItems.length > 1 ? "s" : ""} par DALL-E ✨`);
      }
      setPrompt("");
      setActiveTab("drafts");
    },
    onError: (err) => {
      toast.error(`Erreur de génération: ${err.message}`);
      setIsGenerating(false);
    }
  });

  const _scheduleMutation = trpc.social.schedulePost.useMutation({
    onSuccess: (data: any) => {
      const status = data?.data?.status || data?.status;
      toast.success(status === "published" ? "Post publié !" : "Post planifié !");
      refetchPosts();
    }
  });

  
  const generateTikTokIdeasMutation = trpc.social.generateTikTokIdeas.useMutation({
    onSuccess: (data: any) => {
      const ideas = data?.data?.ideas || data?.ideas || [];
      setTiktokIdeas(ideas);
      setIsGeneratingTikTok(false);
      toast.success(`${ideas.length || 0} idées TikTok générées !`);
    },
    onError: (err: any) => {
      toast.error(`Erreur: ${err.message}`);
      setIsGeneratingTikTok(false);
    }
  });

  const publishTikTokMutation = trpc.social.publishTikTokVideo.useMutation({
    onSuccess: (data: any) => {
      const res = data?.data || data;
      if (res.success) {
        toast.success(res.simulated ? "TikTok publié (simulation)" : "TikTok publié avec succès !");
        refetchPosts();
      }
    },
    onError: (err: any) => toast.error(`Erreur TikTok: ${err.message}`)
  });

  // Analyse de sentiment basique
  const analyzeSentiment = (text: string): "positive" | "negative" | "neutral" => {
    const positiveWords = ["excellent", "super", "génial", "merveilleux", "fantastique", "incroyable", "formidable"];
    const negativeWords = ["mauvais", "horrible", "terrible", "nul", "décevant", "problème", "erreur"];
    
    const lower = text.toLowerCase();
    const posCount = positiveWords.filter(w => lower.includes(w)).length;
    const negCount = negativeWords.filter(w => lower.includes(w)).length;
    
    if (posCount > negCount) return "positive";
    if (negCount > posCount) return "negative";
    return "neutral";
  };

  // Analyser les commentaires à partir des données réellement enregistrées
  const analyzeComments = async () => {
    try {
      const result = await commentAnalysisQuery.refetch();
      const comments = (result.data ?? []) as CommentAnalysis[];

      if (comments.length === 0) {
        setCommentAnalysis([]);
        toast.info("Aucun commentaire enregistré n'est disponible pour analyse.");
        return;
      }

      setCommentAnalysis(comments);
      toast.success(`Analyse des commentaires complétée (${comments.length})`);
    } catch (error: any) {
      toast.error(`Erreur d'analyse des commentaires : ${error?.message ?? "inconnue"}`);
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error("Veuillez entrer un prompt pour l'IA");
      return;
    }
    if (selectedPlatforms.length === 0) {
      toast.error("Veuillez sélectionner au moins une plateforme");
      return;
    }
    setIsGenerating(true);
    await generateMutation.mutateAsync({
      prompt,
      
      platforms: selectedPlatforms,
      count: abTestingMode ? 6 : 3
    });
  };

  const togglePlatform = (p: string) => {
    setSelectedPlatforms(prev => 
      prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
    );
  };

  const approveDraft = (draftId: string) => {
    const draft = drafts.find(d => d.id === draftId);
    if (draft) {
      setDrafts(prev => prev.map(d => 
        d.id === draftId ? { ...d, status: "scheduled" as const } : d
      ));
      toast.success("Post approuvé et planifié !");
    }
  };

  const deleteDraft = (draftId: string) => {
    setDrafts(prev => prev.filter(d => d.id !== draftId));
    toast.success("Brouillon supprimé");
  };

  const duplicateDraft = (draftId: string) => {
    const draft = drafts.find(d => d.id === draftId);
    if (draft) {
      const newDraft = { ...draft, id: `draft-${Date.now()}`, status: "draft" as const };
      setDrafts(prev => [...prev, newDraft]);
      toast.success("Brouillon dupliqué");
    }
  };

  const handleDragStart = (e: React.DragEvent, postId: string) => {
    setDraggedPost(postId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, targetDate: string) => {
    e.preventDefault();
    if (draggedPost) {
      setDrafts(prev => prev.map(d =>
        d.id === draggedPost ? { ...d, scheduledAt: targetDate } : d
      ));
      toast.success("Post reprogrammé !");
      setDraggedPost(null);
    }
  };

  const handleGenerateTikTokIdeas = async () => {
    if (!tiktokTopic.trim()) { toast.error("Entrez un sujet pour les idées TikTok"); return; }
    setIsGeneratingTikTok(true);
    await generateTikTokIdeasMutation.mutateAsync({
      topic: tiktokTopic,
      count: 5,
      style: tiktokStyle
    });
  };

  const getConnectionStatus = (platform: string) => {
    const status = (connections as Record<string, unknown>)?.[platform];
    if (status === "connected") return { color: "bg-green-500", label: "Connecté" };
    if (status === "configured") return { color: "bg-yellow-500", label: "Configuré (.env)" };
    if (status === "error") return { color: "bg-red-500", label: "Erreur" };
    return { color: "bg-gray-400", label: "Non connecté" };
  };

  const exportAnalytics = () => {
    const data = {
      totalPosts: analytics?.totalPosts || 0,
      totalLikes: analytics?.totalLikes || 0,
      totalReach: analytics?.totalReach || 0,
      drafts: drafts.length,
      mediaLibrary: mediaLibrary.length,
      commentAnalysis: commentAnalysis.length,
      exportedAt: new Date().toISOString()
    };
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `social-analytics-${Date.now()}.json`;
    a.click();
    toast.success("Analytics exportées en JSON !");
  };

  if (loadingConnections || loadingPosts || loadingAnalytics) {
    return <div className="p-8"><LoadingState variant="skeleton" /></div>;
  }

  const containerClass = darkMode ? "dark bg-slate-950 text-white" : "bg-slate-50/50";

  return (
    <div className={`p-8 space-y-8 animate-fade-in min-h-screen transition-colors ${containerClass}`} data-main-content>
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-slate-900 dark:text-white">
            AI <span className="text-primary">Social</span> Manager
          </h1>
          <p className="text-muted-foreground font-medium dark:text-slate-400">Automatisez votre présence sociale avec l'Intelligence Centrale</p>
        </div>
        
        <div className="flex items-center gap-3 bg-white dark:bg-slate-900 p-2 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => setDarkMode(!darkMode)}
            className="rounded-xl"
          >
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>
          <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-1" />
          <div className="flex -space-x-2">
            {['facebook', 'instagram', 'linkedin', 'twitter'].map((p: any) => (
              <div 
                key={p}
                className={`w-8 h-8 rounded-full border-2 border-white dark:border-slate-900 flex items-center justify-center ${
                  connections?.[p] === 'connected' ? 'bg-primary text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                }`}
                title={p.charAt(0).toUpperCase() + p.slice(1)}
              >
                {p === 'facebook' && <Facebook className="w-4 h-4" />}
                {p === 'instagram' && <Instagram className="w-4 h-4" />}
                {p === 'linkedin' && <Linkedin className="w-4 h-4" />}
                {p === 'twitter' && <Twitter className="w-4 h-4" />}
              </div>
            ))}
          </div>
          <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-1" />
          <Button 
            size="sm" 
            variant="ghost" 
            className="text-xs font-bold uppercase tracking-wider text-primary"
            onClick={() => { setSelectedPlatformConfig(null); setShowAccountModal(true); }}
          >
            <Settings className="w-3 h-3 mr-1" /> GÉRER LES COMPTES
          </Button>
        </div>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
        <TabsList className="bg-slate-200/50 dark:bg-slate-800/50 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700 w-fit">
          <TabsTrigger value="overview" className="gap-2 px-6 py-2.5 rounded-xl font-bold">
            <TrendingUp className="w-4 h-4" /> Vue d'ensemble
          </TabsTrigger>
          <TabsTrigger value="generate" className="gap-2 px-6 py-2.5 rounded-xl font-bold">
            <Sparkles className="w-4 h-4" /> Prompt Engine
          </TabsTrigger>
          <TabsTrigger value="drafts" className="gap-2 px-6 py-2.5 rounded-xl font-bold">
            <FileJson className="w-4 h-4" /> Brouillons ({drafts.length})
          </TabsTrigger>
          <TabsTrigger value="calendar" className="gap-2 px-6 py-2.5 rounded-xl font-bold">
            <Calendar className="w-4 h-4" /> Calendrier
          </TabsTrigger>
          <TabsTrigger value="comments" className="gap-2 px-6 py-2.5 rounded-xl font-bold">
            <MessageCircle className="w-4 h-4" /> Commentaires
          </TabsTrigger>
          <TabsTrigger value="tiktok" className="gap-2 px-4 py-2 rounded-xl font-bold">
            <TikTokIcon className="w-4 h-4" /> TikTok Auto
          </TabsTrigger>
          <TabsTrigger value="media" className="gap-2 px-6 py-2.5 rounded-xl font-bold">
            <ImageIcon className="w-4 h-4" /> Médias ({mediaLibrary.length})
          </TabsTrigger>
          <TabsTrigger value="analytics" className="gap-2 px-6 py-2.5 rounded-xl font-bold">
            <BarChart3 className="w-4 h-4" /> Analytics
          </TabsTrigger>
        </TabsList>

        {/* Tab: Overview */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card className="bg-white dark:bg-slate-900 border-none shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-blue-500/10 rounded-xl text-blue-600 dark:text-blue-400">
                  <Share2 className="w-6 h-6" />
                </div>
                <Badge variant="secondary" className="bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200">+12%</Badge>
              </div>
              <h3 className="text-slate-500 dark:text-slate-400 text-sm font-bold uppercase tracking-wider">Posts Publiés</h3>
              <p className="text-3xl font-black text-slate-900 dark:text-white mt-1">{analytics?.totalPosts || 0}</p>
            </Card>

            <Card className="bg-white dark:bg-slate-900 border-none shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-rose-500/10 rounded-xl text-rose-600 dark:text-rose-400">
                  <Heart className="w-6 h-6" />
                </div>
                <Badge variant="secondary" className="bg-rose-100 dark:bg-rose-900 text-rose-700 dark:text-rose-200">+24%</Badge>
              </div>
              <h3 className="text-slate-500 dark:text-slate-400 text-sm font-bold uppercase tracking-wider">Engagement</h3>
              <p className="text-3xl font-black text-slate-900 dark:text-white mt-1">{analytics?.totalLikes || 0} Likes</p>
            </Card>

            <Card className="bg-white dark:bg-slate-900 border-none shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-600 dark:text-emerald-400">
                  <Users className="w-6 h-6" />
                </div>
                <Badge variant="secondary" className="bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-200">+8%</Badge>
              </div>
              <h3 className="text-slate-500 dark:text-slate-400 text-sm font-bold uppercase tracking-wider">Reach Estimé</h3>
              <p className="text-3xl font-black text-slate-900 dark:text-white mt-1">{analytics?.totalReach || 0}</p>
            </Card>

            <Card className="bg-white dark:bg-slate-900 border-none shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-purple-500/10 rounded-xl text-purple-600 dark:text-purple-400">
                  <FileJson className="w-6 h-6" />
                </div>
                <Badge variant="secondary" className="bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-200">+{drafts.length}</Badge>
              </div>
              <h3 className="text-slate-500 dark:text-slate-400 text-sm font-bold uppercase tracking-wider">Brouillons</h3>
              <p className="text-3xl font-black text-slate-900 dark:text-white mt-1">{drafts.length}</p>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card className="bg-white dark:bg-slate-900 border-none shadow-sm overflow-hidden">
              <CardHeader className="border-b border-slate-50 dark:border-slate-800">
                <CardTitle className="text-lg font-bold">Posts Récents</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-slate-50 dark:divide-slate-800">
                  {postsData?.data?.slice(0, 5).map((post: Record<string, unknown>) => (
                    
                    <div key={post.id} className="p-4 flex items-center justify-between hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-lg ${
                          post.platform === 'facebook' ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400' :
                          post.platform === 'instagram' ? 'bg-pink-100 dark:bg-pink-900 text-pink-600 dark:text-pink-400' :
                          post.platform === 'linkedin' ? 'bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200' :
                          'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                        }`}>
                          {post.platform === 'facebook' && <Facebook className="w-4 h-4" />}
                          {post.platform === 'instagram' && <Instagram className="w-4 h-4" />}
                          {post.platform === 'linkedin' && <Linkedin className="w-4 h-4" />}
                          {post.platform === 'twitter' && <Twitter className="w-4 h-4" />}
                        </div>
                        <div>
                          
                          <p className="text-sm font-semibold text-slate-900 dark:text-white line-clamp-1">{String(post.content)}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-slate-400 dark:text-slate-500">
                              
                              {post.publishedAt ? new Date(post.publishedAt).toLocaleDateString() : 'Planifié'}
                            </span>
                            <Badge variant="outline" className="text-[10px] h-4 uppercase">
                              
                              {String(post.status)}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="text-slate-400 dark:text-slate-500">
                        <Eye className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                  {(!postsData?.data || postsData.data.length === 0) && (
                    <div className="p-12 text-center text-slate-400 dark:text-slate-500">
                      <p>Aucun post récent</p>
                      <Button variant="link" onClick={() => setActiveTab("generate")}>Créer votre premier post</Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white dark:bg-slate-900 border-none shadow-sm">
              <CardHeader className="border-b border-slate-50 dark:border-slate-800">
                <CardTitle className="text-lg font-bold">Engagement Automatique</CardTitle>
                <CardDescription>L'IA répond aux commentaires pour vous</CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-between p-4 bg-primary/5 dark:bg-primary/10 rounded-2xl border border-primary/10 dark:border-primary/20">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 dark:bg-primary/20 rounded-xl text-primary">
                      <MessageSquare className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white">Auto-Reply Actif</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Détection d'intention activée</p>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" className="rounded-xl font-bold" onClick={analyzeComments}>
                    Analyser
                  </Button>
                </div>
                
                <div className="space-y-3">
                  <p className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Dernières interactions</p>
                  <div className="space-y-2">
                    {commentAnalysis.slice(0, 2).map(comment => (
                      <div key={comment.id} className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/30">
                        <div className="flex justify-between items-start">
                          <span className="text-xs font-bold text-slate-900 dark:text-white">{comment.author} sur {comment.platform}</span>
                          <Badge className={`border-none text-[10px] ${
                            comment.intent === 'purchase' ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200' :
                            comment.intent === 'question' ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200' :
                            'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                          }`}>
                            {comment.intent.toUpperCase()}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 italic">"{comment.text}"</p>
                        {comment.aiResponse && (
                          <div className="mt-2 flex items-center gap-2 text-[10px] text-primary font-bold">
                            <CheckCircle2 className="w-3 h-3" /> RÉPONDU PAR IA
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab: Generate (Prompt Engine) */}
        <TabsContent value="generate" className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <Card className="bg-white dark:bg-slate-900 border-none shadow-lg overflow-hidden">
                <div className="h-2 bg-primary" />
                <CardHeader className="p-8">
                  <CardTitle className="text-2xl font-black flex items-center gap-2">
                    <Sparkles className="w-6 h-6 text-primary" /> Placeholder Prompt Engine
                  </CardTitle>
                  <CardDescription className="text-base">
                    Décrivez votre campagne, l'IA s'occupe du reste. Utilisez des variables comme {"{product}"} ou {"{city}"}.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-8 pt-0 space-y-6">
                  <div className="space-y-4">
                    <Textarea 
                      placeholder="Ex: Écris 3 posts pour promouvoir notre nouveau service de livraison à {city}. Offre 20% de réduction avec le code PROMO20 jusqu'à la fin du mois."
                      className="min-h-[150px] text-lg p-4 rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-white focus:ring-primary"
                      value={prompt}
                      onChange={(e: any) => setPrompt(e.target.value)}
                    />
                    
                    <div className="flex flex-wrap gap-2">
                      {['{business_name}', '{city}', '{phone_number}', '{product}', '{service}'].map((v: any) => (
                        <button 
                          key={v}
                          onClick={() => setPrompt(prev => prev + v)}
                          className="text-xs font-mono bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 px-2 py-1 rounded transition-colors text-slate-600 dark:text-slate-300"
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <p className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Diffuser sur :</p>
                    <div className="flex gap-4">
                      {['facebook', 'instagram', 'linkedin', 'twitter'].map((p: any) => (
                        <button
                          key={p}
                          onClick={() => togglePlatform(p)}
                          className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${
                            selectedPlatforms.includes(p) 
                              ? 'bg-primary/10 border-primary text-primary font-bold shadow-sm dark:bg-primary/20' 
                              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
                          }`}
                        >
                          {p === 'facebook' && <Facebook className="w-4 h-4" />}
                          {p === 'instagram' && <Instagram className="w-4 h-4" />}
                          {p === 'linkedin' && <Linkedin className="w-4 h-4" />}
                          {p === 'twitter' && <Twitter className="w-4 h-4" />}
                          <span className="capitalize">{p}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700">
                    <input 
                      type="checkbox" 
                      checked={abTestingMode}
                      onChange={(e: any) => setAbTestingMode(e.target.checked)}
                      className="w-4 h-4 rounded cursor-pointer"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-bold text-slate-900 dark:text-white">Mode A/B Testing</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Générer 6 variantes (3 A + 3 B) pour tester les performances</p>
                    </div>
                    <Zap className="w-5 h-5 text-primary" />
                  </div>

                  <div className="pt-4 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                      <AlertCircle className="w-4 h-4" />
                      <span>L'IA générera aussi des visuels via DALL-E</span>
                    </div>
                    <Button 
                      size="lg" 
                      className="rounded-2xl px-8 font-bold gap-2 shadow-lg shadow-primary/20"
                      onClick={handleGenerate}
                      disabled={isGenerating}
                    >
                      {isGenerating ? (
                        <>Génération en cours...</>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" /> Générer les posts
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Tips Card */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="bg-slate-900 dark:bg-slate-950 text-white border-none p-6 rounded-2xl">
                  <h4 className="font-bold flex items-center gap-2 mb-2">
                    <TrendingUp className="w-4 h-4 text-primary" /> Optimisation Automatique
                  </h4>
                  <p className="text-sm text-slate-400">
                    L'Intelligence Centrale analyse vos performances passées pour choisir les meilleurs horaires de publication.
                  </p>
                </Card>
                <Card className="bg-primary text-white border-none p-6 rounded-2xl">
                  <h4 className="font-bold flex items-center gap-2 mb-2">
                    <Target className="w-4 h-4" /> Cible 1000+ Leads
                  </h4>
                  <p className="text-sm text-primary-foreground/80">
                    Chaque post est optimisé pour maximiser la portée organique et toucher au moins 1000 clients potentiels.
                  </p>
                </Card>
              </div>
            </div>

            {/* Live Preview */}
            <div className="space-y-6">
              <Card className="bg-white dark:bg-slate-900 border-none shadow-lg overflow-hidden sticky top-8">
                <CardHeader className="bg-primary/10 dark:bg-primary/20 border-b border-primary/20 dark:border-primary/30">
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <Eye className="w-4 h-4" /> Aperçu en Direct
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  {prompt ? (
                    <div className="space-y-4">
                      <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
                        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Aperçu du contenu</p>
                        <p className="text-sm text-slate-900 dark:text-white line-clamp-4">{prompt}</p>
                      </div>
                      <div className="space-y-2">
                        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Plateformes cibles</p>
                        <div className="flex flex-wrap gap-2">
                          {selectedPlatforms.map((p: any) => (
                            <Badge key={p} className="capitalize">
                              {p === 'facebook' && <Facebook className="w-3 h-3 mr-1" />}
                              {p === 'instagram' && <Instagram className="w-3 h-3 mr-1" />}
                              {p === 'linkedin' && <Linkedin className="w-3 h-3 mr-1" />}
                              {p === 'twitter' && <Twitter className="w-3 h-3 mr-1" />}
                              {p}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-200 dark:border-blue-800">
                        <p className="text-xs font-bold text-blue-600 dark:text-blue-400 mb-2">💡 Conseil IA</p>
                        <p className="text-xs text-blue-700 dark:text-blue-300">Votre prompt est bien structuré. Ajoutez des détails sur votre audience pour de meilleurs résultats.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-slate-400 dark:text-slate-500">
                      <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Entrez un prompt pour voir l'aperçu</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Tab: Drafts */}
        <TabsContent value="drafts" className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">Brouillons et Approbations</h2>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => setViewMode(viewMode === "grid" ? "list" : "grid")}
                className="rounded-xl"
              >
                {viewMode === "grid" ? <List className="w-4 h-4" /> : <Grid3x3 className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          {drafts.length === 0 ? (
            <Card className="bg-white dark:bg-slate-900 border-none shadow-sm p-12 text-center rounded-3xl">
              <FileJson className="w-16 h-16 text-slate-200 dark:text-slate-800 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">Aucun brouillon</h3>
              <p className="text-slate-500 dark:text-slate-400 mt-2">Utilisez le Prompt Engine pour générer vos premiers contenus.</p>
              <Button className="mt-6 rounded-xl font-bold" onClick={() => setActiveTab("generate")}>Démarrer maintenant</Button>
            </Card>
          ) : (
            <div className={viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" : "space-y-4"}>
              {drafts.map(draft => (
                <Card 
                  key={draft.id} 
                  className={`bg-white dark:bg-slate-900 border-none shadow-sm overflow-hidden group ${
                    viewMode === "list" ? "flex items-center" : "flex flex-col"
                  }`}
                  draggable
                  onDragStart={(e: any) => handleDragStart(e, draft.id)}
                >
                  {viewMode === "grid" && (
                    <div className="aspect-video bg-slate-100 dark:bg-slate-800 relative overflow-hidden">
                      {draft.imageUrl ? (
                        <img src={draft.imageUrl} alt="Post media" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-slate-300 dark:text-slate-700">
                          <Share2 className="w-12 h-12 mb-2" />
                          <span className="text-xs font-bold uppercase tracking-tighter">Image IA suggérée</span>
                        </div>
                      )}
                      <div className="absolute top-3 left-3 flex gap-2">
                        <Badge className="bg-white/90 dark:bg-slate-900/90 text-slate-900 dark:text-white backdrop-blur-sm border-none shadow-sm capitalize">
                          {draft.platforms[0]}
                        </Badge>
                        <Badge className={`border-none shadow-sm ${
                          draft.status === 'published' ? 'bg-green-500 text-white' : 
                          draft.status === 'scheduled' ? 'bg-blue-500 text-white' : 'bg-slate-500 text-white'
                        }`}>
                          {draft.status}
                        </Badge>
                      </div>
                      <div className="absolute top-3 right-3 cursor-move opacity-0 group-hover:opacity-100 transition-opacity">
                        <GripVertical className="w-5 h-5 text-white bg-black/50 p-1 rounded" />
                      </div>
                    </div>
                  )}
                  
                  <CardContent className={`flex-1 flex flex-col ${viewMode === "grid" ? "p-6" : "p-4 flex-row flex-1"}`}>
                    <div className={viewMode === "list" ? "flex-1" : ""}>
                      <p className={`text-slate-600 dark:text-slate-400 ${viewMode === "grid" ? "line-clamp-4 mb-4" : "line-clamp-2"}`}>
                        {draft.content}
                      </p>
                      {viewMode === "grid" && (
                        <div className="flex flex-wrap gap-1 mb-4">
                          {draft.hashtags?.map((tag: string) => (
                            <span key={tag} className="text-[10px] font-bold text-primary bg-primary/5 px-2 py-0.5 rounded">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className={`flex items-center gap-2 ${viewMode === "list" ? "ml-4" : "pt-4 border-t border-slate-50 dark:border-slate-800"}`}>
                      <div className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
                        {draft.abVariant && <Badge variant="outline" className="text-[10px]">Variant {draft.abVariant}</Badge>}
                        {draft.sentiment && (
                          <Badge variant="outline" className={`text-[10px] ${
                            draft.sentiment === 'positive' ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300' :
                            draft.sentiment === 'negative' ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300' :
                            'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                          }`}>
                            {draft.sentiment}
                          </Badge>
                        )}
                      </div>
                      <div className="flex-1" />
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => duplicateDraft(draft.id)}
                          className="rounded-lg"
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => setPreviewPost(draft)}
                          className="rounded-lg"
                        >
                          <Eye className="w-3 h-3" />
                        </Button>
                        {draft.status === 'draft' && (
                          <Button 
                            size="sm" 
                            className="rounded-lg font-bold gap-1"
                            onClick={() => approveDraft(draft.id)}
                          >
                            <CheckCircle2 className="w-3 h-3" /> Approuver
                          </Button>
                        )}
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => deleteDraft(draft.id)}
                          className="rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Tab: Calendar with Drag & Drop */}
        <TabsContent value="calendar" className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">File d'attente de publication (Drag & Drop)</h2>
            <Button className="rounded-xl gap-2 font-bold">
              <Plus className="w-4 h-4" /> Nouveau Post
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'].map((day, _idx) => (
              <Card 
                key={day}
                className="bg-white dark:bg-slate-900 border-2 border-dashed border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden"
                onDragOver={handleDragOver}
                onDrop={(e: any) => handleDrop(e, day)}
              >
                <CardHeader className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                  <CardTitle className="text-lg font-bold">{day}</CardTitle>
                  <CardDescription>Déposez les posts ici</CardDescription>
                </CardHeader>
                <CardContent className="p-6 min-h-[300px] space-y-3">
                  {postsData?.data?.filter((p: Record<string, unknown>) => {
                    
                    const postDay = p.scheduledAt ? new Date(p.scheduledAt).toLocaleDateString('fr-FR', { weekday: 'long' }).charAt(0).toUpperCase() + new Date(p.scheduledAt).toLocaleDateString('fr-FR', { weekday: 'long' }).slice(1) : null;
                    return postDay === day;
                  }).map((post: Record<string, unknown>) => (
                    
                    <div key={post.id} className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 cursor-move hover:shadow-md transition-shadow">
                      
                      <p className="text-xs font-semibold text-slate-900 dark:text-white line-clamp-2">{String(post.content)}</p>
                      
                      <Badge className="mt-2 text-[10px] capitalize">{String(post.platform)}</Badge>
                    </div>
                  ))}
                  {(!postsData?.data || postsData.data.length === 0) && (
                    <div className="text-center text-slate-400 dark:text-slate-500 py-8">
                      <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-xs">Aucun post</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Tab: Comments with Sentiment Analysis */}
        <TabsContent value="comments" className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">Analyse des Commentaires</h2>
            <Button onClick={analyzeComments} className="rounded-xl gap-2 font-bold">
              <RefreshCw className="w-4 h-4" /> Analyser
            </Button>
          </div>

          {commentAnalysis.length === 0 ? (
            <Card className="bg-white dark:bg-slate-900 border-none shadow-sm p-12 text-center rounded-3xl">
              <MessageCircle className="w-16 h-16 text-slate-200 dark:text-slate-800 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">Aucun commentaire analysé</h3>
              <p className="text-slate-500 dark:text-slate-400 mt-2">Cliquez sur "Analyser" pour récupérer et analyser les commentaires.</p>
            </Card>
          ) : (
            <div className="space-y-4">
              {commentAnalysis.map(comment => (
                <Card key={comment.id} className="bg-white dark:bg-slate-900 border-none shadow-sm p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <p className="font-bold text-slate-900 dark:text-white">{comment.author}</p>
                        <Badge variant="outline" className="text-[10px] capitalize">{comment.platform}</Badge>
                        <Badge className={`text-[10px] ${
                          comment.sentiment === 'positive' ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200' :
                          comment.sentiment === 'negative' ? 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200' :
                          'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                        }`}>
                          {comment.sentiment === 'positive' && <ThumbsUp className="w-3 h-3 mr-1" />}
                          {comment.sentiment === 'negative' && <ThumbsDown className="w-3 h-3 mr-1" />}
                          {comment.sentiment}
                        </Badge>
                      </div>
                      <p className="text-slate-600 dark:text-slate-400 mb-3">"{comment.text}"</p>
                      {comment.aiResponse && (
                        <div className="p-3 bg-primary/5 dark:bg-primary/10 rounded-lg border border-primary/20 dark:border-primary/30">
                          <p className="text-xs font-bold text-primary mb-1">Réponse IA :</p>
                          <p className="text-sm text-slate-700 dark:text-slate-300">{comment.aiResponse}</p>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="rounded-lg">
                        <Copy className="w-3 h-3" />
                      </Button>
                      <Button size="sm" variant="outline" className="rounded-lg">
                        <Send className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Tab: Media Library */}
        <TabsContent value="media" className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">Bibliothèque de Médias IA</h2>
            <Button className="rounded-xl gap-2 font-bold">
              <Plus className="w-4 h-4" /> Ajouter un Média
            </Button>
          </div>

          {mediaLibrary.length === 0 ? (
            <Card className="bg-white dark:bg-slate-900 border-none shadow-sm p-12 text-center rounded-3xl">
              <ImageIcon className="w-16 h-16 text-slate-200 dark:text-slate-800 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">Aucun média sauvegardé</h3>
              <p className="text-slate-500 dark:text-slate-400 mt-2">Les images générées par l'IA seront automatiquement sauvegardées ici.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {mediaLibrary.map(media => (
                <Card key={media.id} className="bg-white dark:bg-slate-900 border-none shadow-sm overflow-hidden group">
                  <div className="aspect-square bg-slate-100 dark:bg-slate-800 relative overflow-hidden">
                    <img src={media.url} alt="Media" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                      <Button size="icon" variant="ghost" className="bg-white/90 text-slate-900">
                        <Download className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="bg-white/90 text-slate-900">
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <CardContent className="p-4">
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-2">{media.prompt}</p>
                    <Badge variant="outline" className="text-[10px] capitalize">{media.platform}</Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Tab: Analytics */}
        <TabsContent value="analytics" className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">Rapports de Performance</h2>
            <Button onClick={exportAnalytics} className="rounded-xl gap-2 font-bold">
              <Download className="w-4 h-4" /> Exporter JSON
            </Button>
          </div>

          <Card className="p-12 text-center bg-white dark:bg-slate-900 border-none shadow-sm rounded-3xl">
            <BarChart3 className="w-16 h-16 text-slate-200 dark:text-slate-800 mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Rapports de Performance</h3>
            <p className="text-slate-500 dark:text-slate-400 mt-2 max-w-md mx-auto">
              Collecte des données en cours. Vos rapports JSON détaillés apparaîtront ici après vos premières publications.
            </p>
            <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto">
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl">
                <p className="text-2xl font-black text-slate-900 dark:text-white">0</p>
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Impressions</p>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl">
                <p className="text-2xl font-black text-slate-900 dark:text-white">0</p>
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Clics</p>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl">
                <p className="text-2xl font-black text-slate-900 dark:text-white">0</p>
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Conversions</p>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl">
                <p className="text-2xl font-black text-slate-900 dark:text-white">0%</p>
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">CTR</p>
              </div>
            </div>
          </Card>
        </TabsContent>
        {/* Tab: TikTok Automation */}
        <TabsContent value="tiktok" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-white dark:bg-slate-900 border-none shadow-sm rounded-3xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TikTokIcon className="w-5 h-5" /> Generateur d Idees TikTok
                </CardTitle>
                <CardDescription>L IA genere des concepts de videos TikTok virales pour votre business</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Sujet / Theme</Label>
                  <Input
                    placeholder="Ex: Nos services CRM, promotion ete, temoignages clients..."
                    value={tiktokTopic}
                    onChange={(e: any) => setTiktokTopic(e.target.value)}
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Style de contenu</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["educational", "entertaining", "promotional", "trending"] as const).map(style => (
                      <button key={style} onClick={() => setTiktokStyle(style)}
                        className={`p-3 rounded-xl border text-sm font-medium transition-all ${
                          tiktokStyle === style ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                        }`}>
                        {style === "educational" ? "Educatif" : 
                         style === "entertaining" ? "Divertissant" : 
                         style === "promotional" ? "Promotionnel" : "Trending"}
                      </button>
                    ))}
                  </div>
                </div>
                <Button onClick={handleGenerateTikTokIdeas} disabled={isGeneratingTikTok || !tiktokTopic.trim()} className="w-full rounded-xl font-bold gap-2">
                  {isGeneratingTikTok ? (<><RefreshCw className="w-4 h-4 animate-spin" /> Generation...</>) : (<><Lightbulb className="w-4 h-4" /> Generer 5 Idees</>)}
                </Button>
              </CardContent>
            </Card>

            <Card className="bg-white dark:bg-slate-900 border-none shadow-sm rounded-3xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="w-5 h-5 text-slate-500" /> Configuration TikTok API
                </CardTitle>
                <CardDescription>Credentials requis pour la publication automatique</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className={`p-4 rounded-2xl border ${
                  (connections as Record<string, unknown>)?.["tiktok"] === 'connected' || (connections as Record<string, unknown>)?.["tiktok"] === 'configured'
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                    : 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800'
                }`}>
                  <p className="text-sm font-bold mb-1">
                    {(connections as Record<string, unknown>)?.["tiktok"] === 'connected' ? 'TikTok Connecte' :
                     (connections as Record<string, unknown>)?.["tiktok"] === 'configured' ? 'TikTok Configure (.env)' :
                     'TikTok non configuré'}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Configurez vos credentials TikTok dans le .env pour activer la publication reelle
                  </p>
                </div>
                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl space-y-2">
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Variables .env requises :</p>
                  {["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET", "TIKTOK_ACCESS_TOKEN", "TIKTOK_OPEN_ID"].map((v: any) => (
                    <div key={v} className="flex items-center gap-2 p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                      <Key className="w-3 h-3 text-slate-400" />
                      <code className="text-xs font-mono text-slate-600 dark:text-slate-400 flex-1">{v}</code>
                    </div>
                  ))}
                </div>
                <Button size="sm" variant="outline" className="w-full rounded-xl gap-2" onClick={() => window.open("https://developers.tiktok.com", '_blank')}>
                  <ExternalLink className="w-3 h-3" /> TikTok for Developers
                </Button>
                <Button size="sm" className="w-full rounded-xl gap-2" onClick={() => { setSelectedPlatformConfig('tiktok'); setShowAccountModal(true); }}>
                  <Settings className="w-3 h-3" /> Configurer via le gestionnaire
                </Button>
              </CardContent>
            </Card>
          </div>

          {tiktokIdeas.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">Idees Generees ({tiktokIdeas.length})</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {tiktokIdeas.map((idea: any, idx) => (
                  <Card key={idx} className="bg-white dark:bg-slate-900 border-none shadow-sm rounded-3xl overflow-hidden">
                    <div className="h-2 bg-gradient-to-r from-black via-pink-500 to-cyan-400" />
                    <CardContent className="p-5 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-bold text-slate-900 dark:text-white text-sm">{String(idea.title)}</h4>
                        <Badge className="bg-black text-white text-xs flex-shrink-0">{String(idea.duration)}</Badge>
                      </div>
                      <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                        <p className="text-xs font-bold text-slate-500 uppercase mb-1">Hook</p>
                        <p className="text-sm text-slate-700 dark:text-slate-300 italic">{String(idea.hook)}</p>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400">{String(idea.description)}</p>
                      <div className="flex flex-wrap gap-1">
                        {idea.hashtags?.slice(0, 4).map((h: string) => (
                          <Badge key={h} variant="outline" className="text-xs">#{h}</Badge>
                        ))}
                      </div>
                      {idea.trend && (
                        <div className="flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400">
                          <TrendingUp className="w-3 h-3" /> Trend: {String(idea.trend)}
                        </div>
                      )}
                      <div className="flex gap-2 pt-2">
                        <Button size="sm" className="flex-1 rounded-xl text-xs font-bold gap-1" onClick={() => {
                          publishTikTokMutation.mutate({
                            
                            caption: idea as any.title + " " + idea.description,
                            hashtags: idea.hashtags || [],
                            type: "photo"
                          });
                        }}>
                          <Send className="w-3 h-3" /> Publier
                        </Button>
                        <Button size="sm" variant="outline" className="rounded-xl text-xs" onClick={() => {
                          setPrompt("Cree un post TikTok sur: " + idea.title + ". " + idea.description);
                          setSelectedPlatforms(["tiktok"]);
                          setActiveTab("generate");
                        }}>
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

      </Tabs>

      {/* Modal Gestion des Comptes Reseaux Sociaux */}
      {showAccountModal && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <Card className="bg-white dark:bg-slate-900 border-none shadow-2xl max-w-2xl w-full rounded-3xl overflow-hidden max-h-[90vh] overflow-y-auto">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-slate-200 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900 z-10">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5 text-primary" /> Gestion des Comptes Reseaux Sociaux
                </CardTitle>
                <CardDescription>Configurez vos APIs pour activer la publication automatique</CardDescription>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setShowAccountModal(false)} className="rounded-xl">
                <X className="w-4 h-4" />
              </Button>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-200 dark:border-blue-800">
                <p className="text-sm font-bold text-blue-700 dark:text-blue-400 mb-2">Comment configurer les APIs reseaux sociaux</p>
                <p className="text-xs text-blue-600 dark:text-blue-300">
                  1. Creez une application developpeur sur chaque plateforme (liens ci-dessous)
                  2. Copiez les credentials dans votre fichier .env a la racine du projet
                  3. Redemarrez l application : pnpm run build puis node dist/index.js
                  4. Les indicateurs passeront au vert une fois configures
                </p>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700">
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Emplacement du fichier de configuration</p>
                <code className="text-xs font-mono text-slate-600 dark:text-slate-400 block p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                  /votre-projet/servicall/.env
                </code>
              </div>
              {(Object.keys(PLATFORM_CONFIG) as Array<keyof typeof PLATFORM_CONFIG>).map((p: any) => {
                const cfg = PLATFORM_CONFIG[p];
                const IconComp = cfg.icon;
                const status = getConnectionStatus(p);
                const isSelected = selectedPlatformConfig === p;
                return (
                  <div key={p} className={`border rounded-2xl overflow-hidden transition-all ${isSelected ? 'border-primary shadow-md' : 'border-slate-200 dark:border-slate-700'}`}>
                    <button 
                      className="w-full p-4 flex items-center gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left"
                      onClick={() => setSelectedPlatformConfig(isSelected ? null : p)}
                    >
                      <div className={`w-10 h-10 rounded-xl ${cfg.bgLight} flex items-center justify-center flex-shrink-0`}>
                        <IconComp className={`w-5 h-5 ${cfg.textColor}`} />
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-slate-900 dark:text-white">{cfg.label}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{cfg.description}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className={`w-2.5 h-2.5 rounded-full ${status.color}`} />
                        <span className="text-xs text-slate-500 dark:text-slate-400">{status.label}</span>
                      </div>
                    </button>
                    {isSelected && (
                      <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Variables a ajouter dans .env :</p>
                          <Button size="sm" variant="outline" className="rounded-xl gap-1 text-xs" onClick={() => window.open(cfg.apiUrl, '_blank')}>
                            <ExternalLink className="w-3 h-3" /> Creer l app
                          </Button>
                        </div>
                        <div className="space-y-2">
                          {cfg.envVars.map((envVar: string) => (
                            <div key={envVar} className="flex items-center gap-2 p-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
                              <Key className="w-3 h-3 text-slate-400 flex-shrink-0" />
                              <code className="text-xs font-mono text-slate-600 dark:text-slate-400 flex-1">{envVar}</code>
                              <code className="text-xs font-mono text-slate-300 dark:text-slate-600">= your_value_here</code>
                            </div>
                          ))}
                        </div>
                        <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl border border-yellow-200 dark:border-yellow-800">
                          <p className="text-xs text-yellow-700 dark:text-yellow-400">
                            Apres modification du .env : pnpm run build puis node dist/index.js
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              <Button className="w-full rounded-xl font-bold" onClick={() => setShowAccountModal(false)}>
                <RefreshCw className="w-4 h-4 mr-2" /> Fermer et Actualiser
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Preview Modal */}
      {previewPost && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center p-4 z-50">
          <Card className="bg-white dark:bg-slate-900 border-none shadow-2xl max-w-2xl w-full rounded-3xl overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-slate-200 dark:border-slate-800">
              <CardTitle>Aperçu du Post</CardTitle>
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => setPreviewPost(null)}
              >
                ✕
              </Button>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              {previewPost.imageUrl && (
                <div className="aspect-video bg-slate-100 dark:bg-slate-800 rounded-2xl overflow-hidden">
                  <img src={previewPost.imageUrl} alt="Post" className="w-full h-full object-cover" />
                </div>
              )}
              <div>
                <p className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Contenu</p>
                <p className="text-lg text-slate-900 dark:text-white">{previewPost.content}</p>
              </div>
              <div>
                <p className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Hashtags</p>
                <div className="flex flex-wrap gap-2">
                  {previewPost.hashtags.map(tag => (
                    <Badge key={tag}>{tag}</Badge>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Button className="flex-1 rounded-xl font-bold gap-2">
                  <CheckCircle2 className="w-4 h-4" /> Approuver
                </Button>
                <Button variant="outline" className="flex-1 rounded-xl font-bold">
                  Modifier
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}