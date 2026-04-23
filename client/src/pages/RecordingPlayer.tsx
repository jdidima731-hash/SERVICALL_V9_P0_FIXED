
import { useState, useRef, useEffect } from "react";
import { Play,
  Pause,
  Volume2,
  Volume1,
  Download,
  Share2,
  Trash2,
  MessageSquare,
  Brain,
  TrendingUp,
 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";

// ============================================
// TYPES
// ============================================

interface Recording {
  id: number;
  callId: number;
  prospectName: string;
  agentName: string;
  duration: number;
  recordedAt: Date;
  url: string;
  transcription?: string;
  summary?: string;
  sentiment: "positive" | "neutral" | "negative";
  qualityScore: number;
  keyPhrases: string[];
}

interface TranscriptionSegment {
  timestamp: number;
  speaker: "agent" | "prospect";
  text: string;
  sentiment: string;
}

interface AnalysisResult {
  overallSentiment: string;
  keyTopics: string[];
  actionItems: string[];
  qualityScore: number;
  recommendations: string[];
}

// ============================================
// RECORDING PLAYER
// ============================================

export function RecordingPlayer() {
  const [selectedRecording, setSelectedRecording] = useState<Recording | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(100);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [_zoomLevel, _setZoomLevel] = useState(1);
  const [_transcriptionSegments, _setTranscriptionSegments] = useState<TranscriptionSegment[]>([]);
  const [_analysisResult, _setAnalysisResult] = useState<AnalysisResult | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [recordings, setRecordings] = useState<Recording[]>([]);

  // Fetch recordings
  const { data: recordingsData } = trpc.communication.recording.list.useQuery({
    limit: 50,
  });

  useEffect(() => {
    if (recordingsData) {
      setRecordings(
        
        (recordingsData as Record<string,unknown>[]).map((rec) => ({
          ...rec,
          recordedAt: new Date(rec.recordedAt as string),
        }))
      );
    }
  }, [recordingsData]);

  const handlePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleSeek = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume / 100;
    }
  };

  const handlePlaybackSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleSelectRecording = (recording: Recording) => {
    setSelectedRecording(recording);
    setCurrentTime(0);
    setIsPlaying(false);
    
    // La transcription et l'analyse sont déjà présentes dans l'objet recording
    // retourné par le routeur trpc.communication.recording.list
    console.log(`Recording ${recording.id} selected with transcription length: ${recording.transcription?.length || 0}`);
  };

  const sentimentColors = {
    positive: "text-green-400 bg-green-500/20",
    neutral: "text-blue-400 bg-blue-500/20",
    negative: "text-red-400 bg-red-500/20",
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8" data-main-content>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-2">Enregistrements & Replay</h1>
        <p className="text-slate-400">
          Écoute, transcription et analyse des appels enregistrés
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Recordings List */}
        <div className="lg:col-span-1">
          <Card className="bg-slate-800 border-slate-700 h-full">
            <CardHeader>
              <CardTitle className="text-white">Enregistrements</CardTitle>
              <CardDescription className="text-slate-400">
                {recordings.length} enregistrement(s)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 max-h-96 overflow-y-auto">
              {recordings.map((recording) => (
                <div
                  key={recording.id}
                  onClick={() => handleSelectRecording(recording)}
                  className={`p-3 rounded-lg cursor-pointer transition-all ${
                    selectedRecording?.id === recording.id
                      ? "bg-primary/20 border-2 border-primary"
                      : "bg-slate-700 hover:bg-slate-600 border border-slate-600"
                  }`}
                >
                  <p className="font-semibold text-white text-sm">{recording.prospectName}</p>
                  <p className="text-slate-400 text-xs">{recording.agentName}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-slate-400 text-xs">
                      {formatTime(recording.duration)}
                    </span>
                    <Badge
                      className={
                        recording.sentiment === "positive"
                          ? "bg-green-500"
                          : recording.sentiment === "neutral"
                          ? "bg-blue-500"
                          : "bg-red-500"
                      }
                    >
                      {recording.sentiment === "positive"
                        ? "😊"
                        : recording.sentiment === "neutral"
                        ? "😐"
                        : "😞"}
                    </Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Player & Analysis */}
        <div className="lg:col-span-3 space-y-6">
          {selectedRecording ? (
            <>
              {/* Player Card */}
              <Card className="bg-slate-800 border-slate-700">
                <CardContent className="pt-6">
                  <div className="space-y-6">
                    {/* Recording Info */}
                    <div>
                      <h2 className="text-2xl font-bold text-white mb-2">
                        {selectedRecording.prospectName}
                      </h2>
                      <div className="flex items-center gap-4 text-slate-400 text-sm">
                        <span>Agent: {selectedRecording.agentName}</span>
                        <span>•</span>
                        <span>
                          {selectedRecording.recordedAt.toLocaleDateString("fr-FR")}
                        </span>
                      </div>
                    </div>

                    {/* Audio Player */}
                    <audio
                      ref={audioRef}
                      src={selectedRecording.url}
                      onTimeUpdate={handleTimeUpdate}
                      onEnded={() => setIsPlaying(false)}
                    />

                    {/* Waveform & Timeline */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-4">
                        <button
                          onClick={handlePlayPause}
                          className="p-3 rounded-full bg-primary hover:bg-primary/90 text-white transition-all hover:shadow-lg hover:shadow-primary/50"
                        >
                          {isPlaying ? (
                            <Pause size={24} />
                          ) : (
                            <Play size={24} className="ml-1" />
                          )}
                        </button>

                        <div className="flex-1">
                          <div className="relative h-12 bg-slate-700 rounded-lg overflow-hidden">
                            {/* Waveform visualization */}
                            <div className="absolute inset-0 flex items-center justify-center">
                              {Array.from({ length: 100 }).map((_, i) => (
                                <div
                                  key={i}
                                  className="flex-1 h-full bg-gradient-to-t from-primary/20 to-primary/40 mx-0.5"
                                  style={{
                                    height: `${Math.random() * 100}%`,
                                  }}
                                />
                              ))}
                            </div>

                            {/* Progress indicator */}
                            <div
                              className="absolute top-0 left-0 h-full bg-primary/50 transition-all"
                              style={{
                                width: `${(currentTime / selectedRecording.duration) * 100}%`,
                              }}
                            />

                            {/* Seek bar */}
                            <input
                              type="range"
                              min="0"
                              max={selectedRecording.duration}
                              value={currentTime}
                              onChange={(e: any) => handleSeek(parseFloat(e.target.value))}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                          </div>
                          <div className="flex justify-between text-xs text-slate-400 mt-1">
                            <span>{formatTime(currentTime)}</span>
                            <span>{formatTime(selectedRecording.duration)}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Controls */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-slate-400 mb-2 block">
                          Vitesse
                        </label>
                        <select
                          value={playbackSpeed}
                          onChange={(e: any) =>
                            handlePlaybackSpeedChange(parseFloat(e.target.value))
                          }
                          className="w-full bg-slate-700 border border-slate-600 text-white rounded px-3 py-2 text-sm"
                        >
                          <option value={0.5}>0.5x</option>
                          <option value={0.75}>0.75x</option>
                          <option value={1}>1x</option>
                          <option value={1.25}>1.25x</option>
                          <option value={1.5}>1.5x</option>
                          <option value={2}>2x</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-xs text-slate-400 mb-2 block">
                          Volume
                        </label>
                        <div className="flex items-center gap-2">
                          {volume > 50 ? (
                            <Volume2 size={16} className="text-slate-400" />
                          ) : (
                            <Volume1 size={16} className="text-slate-400" />
                          )}
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={volume}
                            onChange={(e: any) =>
                              handleVolumeChange(parseFloat(e.target.value))
                            }
                            className="flex-1"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-2"
                      >
                        <Download size={16} />
                        Télécharger
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-2"
                      >
                        <Share2 size={16} />
                        Partager
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="gap-2"
                      >
                        <Trash2 size={16} />
                        Supprimer
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Analysis Tabs */}
              <Tabs defaultValue="transcription" className="space-y-4">
                <TabsList className="bg-slate-700 border-slate-600">
                  <TabsTrigger value="transcription" className="text-slate-300">
                    <MessageSquare size={16} className="mr-2" />
                    Transcription
                  </TabsTrigger>
                  <TabsTrigger value="analysis" className="text-slate-300">
                    <Brain size={16} className="mr-2" />
                    Analyse IA
                  </TabsTrigger>
                  <TabsTrigger value="metrics" className="text-slate-300">
                    <TrendingUp size={16} className="mr-2" />
                    Métriques
                  </TabsTrigger>
                </TabsList>

                {/* Transcription Tab */}
                <TabsContent value="transcription">
                  <Card className="bg-slate-800 border-slate-700">
                    <CardHeader>
                      <CardTitle className="text-white">Transcription</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 max-h-96 overflow-y-auto">
                      {selectedRecording.transcription ? (
                        <div className="space-y-3">
                          {selectedRecording.transcription.split("\n").map((line, i) => (
                            <div key={i} className="text-slate-300 text-sm leading-relaxed">
                              {line}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-slate-400 text-sm">
                          Transcription en cours...
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Analysis Tab */}
                <TabsContent value="analysis">
                  <Card className="bg-slate-800 border-slate-700">
                    <CardHeader>
                      <CardTitle className="text-white">Analyse IA</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* Quality Score */}
                      <div>
                        <div className="flex justify-between mb-2">
                          <span className="text-slate-300">Score de Qualité</span>
                          <span className="text-white font-bold">
                            {selectedRecording.qualityScore}/100
                          </span>
                        </div>
                        <Progress
                          value={selectedRecording.qualityScore}
                          className="h-2 bg-slate-700"
                        />
                      </div>

                      {/* Sentiment */}
                      <div>
                        <p className="text-slate-300 mb-2">Sentiment Global</p>
                        <Badge
                          className={`${
                            sentimentColors[selectedRecording.sentiment]
                          }`}
                        >
                          {selectedRecording.sentiment === "positive"
                            ? "Positif"
                            : selectedRecording.sentiment === "neutral"
                            ? "Neutre"
                            : "Négatif"}
                        </Badge>
                      </div>

                      {/* Key Phrases */}
                      <div>
                        <p className="text-slate-300 mb-2">Phrases Clés</p>
                        <div className="flex flex-wrap gap-2">
                          {selectedRecording.keyPhrases.map((phrase, i) => (
                            <Badge
                              key={i}
                              variant="outline"
                              className="bg-primary/10 text-primary border-primary/50"
                            >
                              {phrase}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      {/* Summary */}
                      {selectedRecording.summary && (
                        <div>
                          <p className="text-slate-300 mb-2">Résumé</p>
                          <p className="text-slate-400 text-sm leading-relaxed">
                            {selectedRecording.summary}
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Metrics Tab */}
                <TabsContent value="metrics">
                  <Card className="bg-slate-800 border-slate-700">
                    <CardHeader>
                      <CardTitle className="text-white">Métriques</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-700 p-4 rounded-lg">
                          <p className="text-slate-400 text-sm mb-1">Durée</p>
                          <p className="text-2xl font-bold text-white">
                            {formatTime(selectedRecording.duration)}
                          </p>
                        </div>
                        <div className="bg-slate-700 p-4 rounded-lg">
                          <p className="text-slate-400 text-sm mb-1">Qualité</p>
                          <p className="text-2xl font-bold text-white">
                            {selectedRecording.qualityScore}%
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </>
          ) : (
            <Card className="bg-slate-800 border-slate-700 h-96 flex items-center justify-center">
              <CardContent className="text-center">
                <p className="text-slate-400 text-lg">
                  Sélectionnez un enregistrement pour commencer
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

export default RecordingPlayer;