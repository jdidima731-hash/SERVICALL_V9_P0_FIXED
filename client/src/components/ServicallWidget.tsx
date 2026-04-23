import React, { useState } from 'react';
import { MessageSquare, Phone, Mic, X, ChevronRight  } from 'lucide-react';
import { Badge } from "@/components/ui/badge";

export const ServicallWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'menu' | 'chat' | 'voice'>('menu');

  const handleAction = (action: string) => {
    if (import.meta.env.DEV) { console.log(`Widget Action: ${action} - Source: WebWidget`); }
    // Ici on injecterait normalement dans UnifiedInbox via tRPC
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {isOpen && (
        <div className="mb-4 w-80 bg-card border shadow-2xl rounded-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
          {/* Header */}
          <div className="bg-primary p-4 text-primary-foreground flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                <MessageSquare className="h-5 w-5" />
              </div>
              <div>
                <p className="font-bold text-sm">Servicall Assistant</p>
                <p className="text-[10px] opacity-80">En ligne • Réponse immédiate</p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="hover:bg-white/10 p-1 rounded">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-4 min-h-[300px]">
            {activeTab === 'menu' && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground mb-4">Comment pouvons-nous vous aider aujourd'hui ?</p>
                
                <button 
                  onClick={() => handleAction('Appel immédiat')}
                  className="w-full flex items-center justify-between p-3 rounded-xl border hover:border-primary hover:bg-primary/5 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 text-green-600 rounded-lg group-hover:bg-green-600 group-hover:text-white transition-colors">
                      <Phone className="h-4 w-4" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold">Appel immédiat</p>
                      <p className="text-[10px] text-muted-foreground">Parlez à un agent maintenant</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>

                <button 
                  onClick={() => handleAction('Message WhatsApp')}
                  className="w-full flex items-center justify-between p-3 rounded-xl border hover:border-primary hover:bg-primary/5 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 text-blue-600 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-colors">
                      <MessageSquare className="h-4 w-4" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold">Message WhatsApp</p>
                      <p className="text-[10px] text-muted-foreground">Discutez sur votre mobile</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>

                <button 
                  onClick={() => setActiveTab('voice')}
                  className="w-full flex items-center justify-between p-3 rounded-xl border hover:border-primary hover:bg-primary/5 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 text-purple-600 rounded-lg group-hover:bg-purple-600 group-hover:text-white transition-colors">
                      <Mic className="h-4 w-4" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold">Message Vocal IA</p>
                      <p className="text-[10px] text-muted-foreground">Laissez un message analysé par l'IA</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
            )}

            {activeTab === 'voice' && (
              <div className="flex flex-col items-center justify-center py-8 space-y-4">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center animate-pulse">
                  <Mic className="h-8 w-8 text-primary" />
                </div>
                <p className="text-sm font-medium">Enregistrement en cours...</p>
                <p className="text-xs text-muted-foreground text-center px-4">
                  Votre message sera transcrit et envoyé à notre équipe avec le tag <Badge variant="secondary" className="text-[10px]">Source: WebWidget</Badge>
                </p>
                <div className="flex gap-2 w-full pt-4">
                  <button 
                    onClick={() => setActiveTab('menu')}
                    className="flex-1 py-2 text-sm border rounded-lg hover:bg-muted"
                  >
                    Annuler
                  </button>
                  <button 
                    onClick={() => { handleAction('Message Vocal IA'); setActiveTab('menu'); }}
                    className="flex-1 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90"
                  >
                    Envoyer
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-2 bg-muted/30 border-t flex justify-center">
            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
              Propulsé par <span className="font-bold text-primary">Servicall Omnicanal</span>
            </p>
          </div>
        </div>
      )}

      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 ${
          isOpen ? 'bg-white text-primary rotate-90' : 'bg-primary text-primary-foreground hover:scale-110'
        }`}
      >
        {isOpen ? <X className="h-6 w-6" /> : <MessageSquare className="h-6 w-6" />}
      </button>
    </div>
  );
};
